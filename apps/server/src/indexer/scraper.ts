import {
  type CookieItem,
  type DownloadSection,
  type Review,
  Status,
  type StatusId,
  Type,
  type TypeId,
  datestampUtcNoon,
  type ThreadMatch,
} from "@game-library/shared";
import type PQueue from "p-queue";
import { request } from "undici";
import {
  BULK_VERSION_CHECK_MAX_IDS,
  CACHE_API_FAST_MAX_IDS,
  CACHE_API_MAX_THREAD_ID,
  type IndexerError,
  LATEST_UPDATES_CATEGORIES,
  URLS,
  classifyF95Error,
  normalizeAttachmentUrl,
  sanitizeLatestUpdatesQuery,
} from "./f95zone.js";
import {
  type ParsedThread,
  parseReviewsHtml,
  parseThreadHtml,
  parseWatchedPageHtml,
} from "./parser.js";

export interface DecryptedSession {
  cookies: CookieItem[];
  userAgent: string;
}

export interface ScrapedThreadData extends ParsedThread {
  version: string;
  reviewsTotal: number;
  reviews: Review[];
}

export type ScrapeResult =
  | { ok: true; data: ScrapedThreadData; source: "direct" | "cache_api" }
  | { ok: false; error: IndexerError; partial?: Partial<ScrapedThreadData> };

const DEFAULT_FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function buildSessionHeaders(
  session: DecryptedSession | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": session?.userAgent || DEFAULT_FALLBACK_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  };
  if (session && session.cookies.length > 0) {
    headers.Cookie = session.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }
  return headers;
}

async function requestFollowingRedirects(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 30_000,
  maxRedirects = 5
): Promise<{ status: number; body: string; finalUrl: string }> {
  let currentUrl = url;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const res = await request(currentUrl, {
      method: "GET",
      headers,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
    const location = res.headers.location;
    if (
      res.statusCode >= 300 &&
      res.statusCode < 400 &&
      typeof location === "string" &&
      hop < maxRedirects
    ) {
      await res.body.dump().catch(() => undefined);
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    const body = await res.body.text();
    return { status: res.statusCode, body, finalUrl: currentUrl };
  }
  throw new Error(`Too many redirects fetching ${url}`);
}

async function fetchWithRateRetry(
  url: string,
  headers: Record<string, string>,
  queue: PQueue,
  maxRateRetries = 4
): Promise<{ status: number; body: string; finalUrl: string } | IndexerError> {
  let backoffMs = 2000;
  for (let attempt = 0; attempt <= maxRateRetries; attempt += 1) {
    try {
      const result = await queue.add(() =>
        requestFollowingRedirects(url, headers, 30_000, 5)
      );

      if (!result) {
        return { flag: "INTERNAL_ERROR", retryDelayMs: 3600_000 };
      }

      if (result.status === 429 && attempt < maxRateRetries) {
        await new Promise((r) => setTimeout(r, backoffMs));
        backoffMs = Math.min(backoffMs + 3000, 15_000);
        continue;
      }

      return result;
    } catch (err) {
      if (attempt === maxRateRetries) {
        return classifyF95Error(err instanceof Error ? err : new Error("Network error")) ?? {
          flag: "F95ZONE_UNAVAILABLE",
          retryDelayMs: 900_000,
        };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { flag: "F95ZONE_RATELIMIT", retryDelayMs: 900_000 };
}

/**
 * Fetch latest promoted version strings from F95zone's bulk checker API (max 100 IDs per request).
 */
export async function fetchBulkVersions(
  threadIds: number[],
  headers: Record<string, string>,
  endpointUrl: (ids: number[]) => string = URLS.bulkVersionCheck
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const uniqueIds = Array.from(
    new Set(threadIds.filter((id) => Number.isInteger(id) && id > 0))
  );

  const reqHeaders: Record<string, string> = {
    "User-Agent": headers["User-Agent"] ?? DEFAULT_FALLBACK_UA,
    Accept: "application/json,text/plain,*/*",
  };
  if (headers.Cookie) {
    reqHeaders.Cookie = headers.Cookie;
  }

  for (let i = 0; i < uniqueIds.length; i += BULK_VERSION_CHECK_MAX_IDS) {
    const chunk = uniqueIds.slice(i, i + BULK_VERSION_CHECK_MAX_IDS);
    if (chunk.length === 0) continue;

    for (let attempt = 0; attempt <= 2; attempt += 1) {
      try {
        const res = await request(endpointUrl(chunk), {
          method: "GET",
          headers: reqHeaders,
          headersTimeout: 30_000,
          bodyTimeout: 30_000,
        });

        if (res.statusCode === 429 && attempt < 2) {
          await res.body.dump().catch(() => undefined);
          await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
          continue;
        }

        const text = await res.body.text();
        const parsed = JSON.parse(text) as {
          status?: string;
          msg?: Record<string, string> | string;
        };

        if (
          parsed.msg === "Missing threads data" ||
          parsed.msg === "Thread not found"
        ) {
          break;
        }

        if (parsed.status === "ok" && parsed.msg && typeof parsed.msg === "object") {
          for (const [idStr, ver] of Object.entries(parsed.msg)) {
            const id = Number(idStr);
            if (
              Number.isInteger(id) &&
              id > 0 &&
              typeof ver === "string" &&
              ver.length > 0 &&
              ver !== "Unknown"
            ) {
              result.set(id, ver);
            }
          }
        }
        break;
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
          continue;
        }
        // Non-fatal; fallback and individual thread scrapes can still resolve version
      }
    }
  }

  return result;
}

/**
 * Port of _reference-repo/modules/api.py:fast_check().
 * Queries the reference Cache API (/fast?ids=...) in chunks of up to 10 valid thread IDs
 * to detect upstream changes without scraping every thread page.
 */
export async function fetchFastCheckTimestamps(
  threadIds: number[],
  cacheApiUrl: string
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  const base = cacheApiUrl.replace(/\/+$/, "");
  const validIds = Array.from(
    new Set(
      threadIds.filter(
        (id) =>
          Number.isInteger(id) && id >= 1 && id <= CACHE_API_MAX_THREAD_ID
      )
    )
  );

  for (let i = 0; i < validIds.length; i += CACHE_API_FAST_MAX_IDS) {
    const chunk = validIds.slice(i, i + CACHE_API_FAST_MAX_IDS);
    if (chunk.length === 0) continue;

    try {
      const res = await request(`${base}/fast?ids=${chunk.join(",")}`, {
        method: "GET",
        headersTimeout: 30_000,
        bodyTimeout: 30_000,
      });
      if (res.statusCode !== 200) {
        await res.body.dump().catch(() => undefined);
        continue;
      }
      const fastJson = (await res.body.json()) as Record<string, unknown>;
      if (!fastJson || typeof fastJson !== "object") continue;

      for (const [idStr, tsVal] of Object.entries(fastJson)) {
        const id = Number(idStr);
        const tsNum = typeof tsVal === "number" ? tsVal : Number(tsVal);
        if (
          Number.isInteger(id) &&
          id > 0 &&
          Number.isFinite(tsNum) &&
          tsNum > 0
        ) {
          result.set(id, Math.floor(tsNum));
        }
      }
    } catch {
      // Non-fatal; failed chunk will not abort the rest of the refresh job
    }
  }

  return result;
}

/**
 * Verify whether stored F95zone cookies correspond to a valid logged-in session.
 */
export async function verifyF95Session(
  session: DecryptedSession
): Promise<
  | { status: "active" }
  | { status: "expired" | "captcha_required"; error: IndexerError }
> {
  const headers = buildSessionHeaders(session);
  try {
    const res = await requestFollowingRedirects(URLS.checkLogin, headers, 20_000, 5);
    const text = res.body;
    const classified = classifyF95Error(text, res.status);
    if (classified?.flag === "CLOUDFLARE_CAPTCHA") {
      return { status: "captcha_required", error: classified };
    }
    if (
      classified?.flag === "SESSION_LOGGED_OUT" ||
      text.includes(
        '<pre>Sorry, you have to be <a href="/login">logged in</a> to access this page</a></pre>'
      )
    ) {
      return {
        status: "expired",
        error: { flag: "SESSION_LOGGED_OUT", retryDelayMs: 900_000 },
      };
    }
    return { status: "active" };
  } catch (err) {
    return {
      status: "expired",
      error: classifyF95Error(err instanceof Error ? err : new Error("Network error")) ?? {
        flag: "F95ZONE_UNAVAILABLE",
        retryDelayMs: 900_000,
      },
    };
  }
}

/**
 * Directly scrape an F95zone thread, enrich from latest_data.php when authenticated,
 * and fetch recent reviews.
 */
export async function scrapeThreadDirect(
  threadId: number,
  knownBulkVersion: string | undefined,
  session: DecryptedSession | null,
  forumQueue: PQueue
): Promise<ScrapeResult> {
  const headers = buildSessionHeaders(session);
  const threadResp = await fetchWithRateRetry(
    URLS.thread(threadId),
    headers,
    forumQueue
  );
  if ("flag" in threadResp) {
    return { ok: false, error: threadResp };
  }

  const pageError = classifyF95Error(threadResp.body, threadResp.status);
  if (pageError) {
    return { ok: false, error: pageError };
  }

  const parsedThread = parseThreadHtml(threadResp.body);
  if (!parsedThread.ok) {
    return {
      ok: false,
      error: {
        flag: "PARSING_FAILED",
        retryDelayMs: 3600_000,
        details: parsedThread.message,
      },
    };
  }

  const data = parsedThread.data;
  let version = knownBulkVersion ?? "";

  if (!version) {
    const bulkMap = await fetchBulkVersions([threadId], headers);
    version = bulkMap.get(threadId) ?? "";
  }

  // Enrich from Latest Updates if tracked and user has xf_user cookie
  const hasXfUser = Boolean(session?.cookies.some((c) => c.name === "xf_user" && c.value));
  if (version && hasXfUser) {
    const query = sanitizeLatestUpdatesQuery(data.name);
    if (query) {
      for (const cat of LATEST_UPDATES_CATEGORIES) {
        const searchUrl = URLS.latestUpdatesSearch({
          cat,
          page: 1,
          searchField: "search",
          query,
          sort: "likes",
          rows: 90,
          ts: Math.floor(Date.now() / 1000),
        });
        const luResp = await fetchWithRateRetry(searchUrl, headers, forumQueue, 1);
        if ("flag" in luResp) continue;
        try {
          const json = JSON.parse(luResp.body) as {
            status?: string;
            msg?: {
              data?: Array<{
                thread_id?: number;
                title?: string;
                creator?: string;
                rating?: number;
                cover?: string;
                screens?: string[];
                ts?: number;
              }>;
            };
          };
          const rows = json.msg?.data ?? [];
          const hit = rows.find((r) => r.thread_id === threadId);
          if (hit) {
            if (hit.title) data.name = hit.title;
            if (hit.creator) data.developer = hit.creator;
            if (typeof hit.rating === "number") {
              data.score = Math.round(hit.rating * 10) / 10;
            }
            if (hit.cover && hit.cover.length > "https://".length) {
              data.imageUrl = normalizeAttachmentUrl(hit.cover) || data.imageUrl;
            }
            for (const scr of hit.screens ?? []) {
              const normalized = normalizeAttachmentUrl(scr);
              if (
                normalized &&
                normalized !== data.imageUrl &&
                !data.previewsUrls.includes(normalized)
              ) {
                data.previewsUrls.push(normalized);
              }
            }
            if (typeof hit.ts === "number") {
              const promoted = datestampUtcNoon(hit.ts);
              const nowSec = Math.floor(Date.now() / 1000);
              if (data.lastUpdated > nowSec || promoted > data.lastUpdated) {
                data.lastUpdated = promoted;
              }
            }
            break;
          }
        } catch {
          // Non-fatal enrichment failure
        }
      }
    }
  }

  let reviewsTotal = 0;
  let reviews: Review[] = [];
  if (data.votes > 0) {
    const revResp = await fetchWithRateRetry(
      URLS.reviews(threadId),
      headers,
      forumQueue,
      2
    );
    if (
      !("flag" in revResp) &&
      revResp.finalUrl.replace(/\/+$/, "").endsWith("/reviews") &&
      !classifyF95Error(revResp.body, revResp.status)
    ) {
      const parsedRev = parseReviewsHtml(revResp.body);
      if (parsedRev.ok) {
        reviewsTotal = parsedRev.data.total;
        reviews = parsedRev.data.items;
      }
    }
  }

  return {
    ok: true,
    source: "direct",
    data: {
      ...data,
      version: version || data.threadVersion || "N/A",
      reviewsTotal,
      reviews,
    },
  };
}

/**
 * Optional fallback to F95Checker Cache API (`api.f95checker.dev`).
 */
export async function fetchThreadFromCacheApi(
  threadId: number,
  cacheApiUrl: string,
  knownBulkVersion?: string
): Promise<ScrapeResult> {
  const base = cacheApiUrl.replace(/\/+$/, "");
  try {
    let safeTs = Math.floor(Date.now() / 1000);
    if (
      Number.isInteger(threadId) &&
      threadId >= 1 &&
      threadId <= CACHE_API_MAX_THREAD_ID
    ) {
      const fastRes = await request(`${base}/fast?ids=${threadId}`, {
        method: "GET",
        headersTimeout: 30_000,
        bodyTimeout: 30_000,
      });
      if (fastRes.statusCode === 200) {
        const fastJson = (await fastRes.body.json()) as Record<string, number>;
        const ts = Number(fastJson[String(threadId)] ?? safeTs);
        if (Number.isFinite(ts) && ts > 0) {
          safeTs = Math.min(Math.floor(ts), safeTs);
        }
      } else {
        await fastRes.body.dump().catch(() => undefined);
      }
    }

    const fullRes = await request(`${base}/full/${threadId}?ts=${safeTs}`, {
      method: "GET",
      headersTimeout: 30_000,
      bodyTimeout: 30_000,
    });
    const raw = (await fullRes.body.json()) as Record<string, string>;

    if (!raw.name) {
      if (raw.INDEX_ERROR === "THREAD_MISSING") {
        return { ok: false, error: { flag: "THREAD_MISSING", retryDelayMs: 14 * 86_400_000 } };
      }
      return {
        ok: false,
        error: {
          flag: "F95ZONE_ERROR",
          retryDelayMs: 900_000,
          details: raw.INDEX_ERROR ?? "Cache API returned no thread data",
        },
      };
    }

    const parsedType = Number.parseInt(raw.type ?? "", 10);
    const parsedStatus = Number.parseInt(raw.status ?? "", 10);
    const validType: TypeId =
      Number.isInteger(parsedType) && parsedType >= 1 && parsedType <= 32
        ? (parsedType as TypeId)
        : Type.Unknown;
    const validStatus: StatusId =
      Number.isInteger(parsedStatus) && parsedStatus >= 1 && parsedStatus <= 7
        ? (parsedStatus as StatusId)
        : Status.Unknown;

    const rawDownloads = JSON.parse(raw.downloads ?? "[]") as Array<
      [string, Array<[string, string]>]
    >;
    const downloads: DownloadSection[] = rawDownloads.map(([sec, links]) => ({
      name: sec,
      mirrors: links.map(([label, url]) => ({ label, url })),
    }));

    return {
      ok: true,
      source: "cache_api",
      data: {
        name: raw.name,
        version: knownBulkVersion || raw.version || "N/A",
        threadVersion: raw.version || "",
        developer: raw.developer ?? "",
        type: validType,
        status: validStatus,
        lastUpdated: Number.parseInt(raw.last_updated ?? "0", 10) || 0,
        score: Number.parseFloat(raw.score ?? "0") || 0,
        votes: Number.parseInt(raw.votes ?? "0", 10) || 0,
        description: raw.description ?? "",
        changelog: raw.changelog ?? "",
        tags: JSON.parse(raw.tags ?? "[]") as number[],
        unknownTags: JSON.parse(raw.unknown_tags ?? "[]") as string[],
        imageUrl: raw.image_url ?? "missing",
        previewsUrls: JSON.parse(raw.previews_urls ?? "[]") as string[],
        downloads,
        reviewsTotal: Number.parseInt(raw.reviews_total ?? "0", 10) || 0,
        reviews: JSON.parse(raw.reviews ?? "[]") as Review[],
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        flag: "F95ZONE_UNAVAILABLE",
        retryDelayMs: 900_000,
        details: err instanceof Error ? err.message : "Cache API error",
      },
    };
  }
}

/**
 * Import F95zone watched or bookmarked threads across all paginated endpoints.
 */
export async function importF95ThreadList(
  kind: "watched" | "bookmarks",
  session: DecryptedSession,
  forumQueue: PQueue
): Promise<{ ok: true; matches: ThreadMatch[] } | { ok: false; error: IndexerError }> {
  const headers = buildSessionHeaders(session);
  const sources = kind === "watched" ? URLS.watched : URLS.bookmarks;
  const deduped = new Map<number, ThreadMatch>();

  for (const source of sources) {
    let page = 1;
    while (page <= 100) {
      const resp = await fetchWithRateRetry(source.url(page), headers, forumQueue);
      if ("flag" in resp) {
        return { ok: false, error: resp };
      }
      const err = classifyF95Error(resp.body, resp.status);
      if (err) {
        return { ok: false, error: err };
      }
      const found = parseWatchedPageHtml(resp.body, source.variant);
      if (found.length === 0) break;
      let newlyAdded = 0;
      for (const m of found) {
        if (!deduped.has(m.id)) {
          deduped.set(m.id, m);
          newlyAdded += 1;
        }
      }
      if (newlyAdded === 0) break;
      page += 1;
    }
  }

  return { ok: true, matches: [...deduped.values()] };
}
