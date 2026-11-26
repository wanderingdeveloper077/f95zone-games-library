import * as cheerio from "cheerio";

export const F95_HOST = "https://f95zone.to";

export const F95_ATTACHMENTS_HOSTS = [
  "https://attachments.f95zone.to/",
  "https://attachments.f95zone.com/",
  "https://attachments.f95zone.ninja/",
] as const;

export const LATEST_UPDATES_CATEGORIES = [
  "games",
  "comics",
  "animations",
  "assets",
] as const;

export const BULK_VERSION_CHECK_MAX_IDS = 100;
export const CACHE_API_FAST_MAX_IDS = 10;
export const CACHE_API_MAX_THREAD_ID = 999_999;

export const URLS = {
  thread: (id: number) => `${F95_HOST}/threads/${id}`,
  reviews: (id: number) => `${F95_HOST}/threads/${id}/reviews/`,
  bulkVersionCheck: (ids: number[]) =>
    `${F95_HOST}/sam/checker.php?threads=${ids.join(",")}`,
  checkLogin: `${F95_HOST}/sam/latest_alpha/`,
  latestUpdatesSearch: (params: {
    cat: string;
    page: number;
    searchField: "search" | "creator";
    query: string;
    sort: "likes" | "date";
    rows: number;
    ts: number;
  }) => {
    const qs = new URLSearchParams({
      cmd: "list",
      cat: params.cat,
      page: String(params.page),
      [params.searchField]: params.query,
      sort: params.sort,
      rows: String(params.rows),
      _: String(params.ts),
    });
    return `${F95_HOST}/sam/latest_alpha/latest_data.php?${qs.toString()}`;
  },
  watched: [
    {
      variant: "new" as const,
      url: (page: number) =>
        `${F95_HOST}/watched/threads?tab=new&src=watched&hide_seen=0&page=${page}`,
    },
    {
      variant: "struct" as const,
      url: (page: number) =>
        `${F95_HOST}/watched/threads?tab=games&unread=0&page=${page}`,
    },
    {
      variant: "struct" as const,
      url: (page: number) =>
        `${F95_HOST}/watched/threads?tab=other&unread=0&page=${page}`,
    },
  ],
  bookmarks: [
    {
      variant: "new" as const,
      url: (page: number) =>
        `${F95_HOST}/watched/threads?tab=new&src=bookmarked&hide_seen=0&page=${page}`,
    },
    {
      variant: "bookmarks" as const,
      url: (page: number) =>
        `${F95_HOST}/watched/threads?tab=bookmarks&page=${page}`,
    },
  ],
} as const;

export type IndexerErrorFlag =
  | "SESSION_LOGGED_OUT"
  | "F95ZONE_RATELIMIT"
  | "CLOUDFLARE_CAPTCHA"
  | "F95ZONE_UNAVAILABLE"
  | "F95ZONE_ERROR"
  | "THREAD_MISSING"
  | "PARSING_FAILED"
  | "UNKNOWN_RESPONSE"
  | "INTERNAL_ERROR";

export interface IndexerError {
  flag: IndexerErrorFlag;
  retryDelayMs: number;
  details?: string;
}

const MIN_15 = 15 * 60 * 1000;
const HOUR_1 = 60 * 60 * 1000;
const DAYS_14 = 14 * 24 * 60 * 60 * 1000;

export const INDEXER_ERRORS = {
  SESSION_LOGGED_OUT: { flag: "SESSION_LOGGED_OUT", retryDelayMs: MIN_15 },
  F95ZONE_RATELIMIT: { flag: "F95ZONE_RATELIMIT", retryDelayMs: MIN_15 },
  CLOUDFLARE_CAPTCHA: { flag: "CLOUDFLARE_CAPTCHA", retryDelayMs: MIN_15 },
  F95ZONE_UNAVAILABLE: { flag: "F95ZONE_UNAVAILABLE", retryDelayMs: MIN_15 },
  F95ZONE_ERROR: { flag: "F95ZONE_ERROR", retryDelayMs: MIN_15 },
  THREAD_MISSING: { flag: "THREAD_MISSING", retryDelayMs: DAYS_14 },
  PARSING_FAILED: { flag: "PARSING_FAILED", retryDelayMs: HOUR_1 },
  UNKNOWN_RESPONSE: { flag: "UNKNOWN_RESPONSE", retryDelayMs: HOUR_1 },
  INTERNAL_ERROR: { flag: "INTERNAL_ERROR", retryDelayMs: HOUR_1 },
} as const satisfies Record<IndexerErrorFlag, IndexerError>;

const LOGIN_ERROR_MESSAGES = [
  '<a href="/login/" data-xf-click="overlay">Log in or register now.</a>',
  "<title>Log in | F95zone",
  '<form action="/login/login" method="post" class="block"',
];

const RATELIMIT_FORUM_ERRORS = [
  '<body data-template="f95rl_paused">',
  "<title>429 Too Many Requests</title>",
  "<h1>429 Too Many Requests</h1>",
  "<title>Error 429</title>",
  "<title>DDoS-Guard</title>",
  "<title>DDOS-GUARD</title>",
];

const RATELIMIT_API_ERRORS = [
  "You have been temporarily blocked because of a large amount of requests, please try again later",
];

const CLOUDFLARE_CAPTCHA_MESSAGES = [
  "(function(){window._cf_chl_opt = {",
  "<title>Just a moment...</title>",
];

const TEMP_ERROR_MESSAGES = [
  '<div id="cf-error-details" class="p-0">',
  "<b>504 - Gateway Timeout .</b>",
  "<title>502 Bad Gateway</title>",
  "<title>Error 502</title>",
  "An unexpected error occurred. Please try again later.",
  "An unexpected database error occurred. Please try again later.\n<!--",
  "<!-- Connection refused -->",
  "<!-- Too many connections -->",
  "<p>Automated backups are currently executing. During this time, the site will be unavailable</p>",
  "<title>F95Zone :: Maintenance</title>",
  "<title>F95Zone :: Scheduled Maintenance</title>",
  '<script src="https://static.f95zone.to/assets/SamF95/ErrorPage',
  '<div class="blockMessage"><p>Please check back in 10 mins</p></div>',
];

const THREAD_MISSING_MESSAGES = new Set([
  "The requested thread could not be found.",
  "You do not have permission to view this page or perform this action.",
]);

/**
 * Port of _reference-repo/common/parser.py:attachment().
 */
export function normalizeAttachmentUrl(rawUrl: string): string {
  let url = rawUrl;
  if (url.startsWith("https://preview.f95zone.to/")) {
    url =
      "https://attachments.f95zone.to/" +
      url.slice("https://preview.f95zone.to/".length);
  }
  if (url.startsWith("https://attachments.f95zone.to/") && url.includes("?h=")) {
    url = url.split("?h=")[0] ?? url;
  }
  return url;
}

/**
 * Port of _reference-repo/indexer/f95zone.py:check_error().
 */
export function classifyF95Error(
  input: string | Record<string, unknown> | Error,
  httpStatus?: number
): IndexerError | null {
  if (input instanceof Error) {
    return INDEXER_ERRORS.F95ZONE_UNAVAILABLE;
  }

  if (typeof input === "string") {
    if (!input) {
      return INDEXER_ERRORS.CLOUDFLARE_CAPTCHA;
    }

    if (input.includes('<body data-template="error">')) {
      try {
        const $ = cheerio.load(input);
        const msg = $(".p-body-pageContent .blockMessage").first().text().trim();
        if (THREAD_MISSING_MESSAGES.has(msg)) {
          return INDEXER_ERRORS.THREAD_MISSING;
        }
        if (msg) {
          return { ...INDEXER_ERRORS.F95ZONE_ERROR, details: msg };
        }
      } catch {
        return INDEXER_ERRORS.UNKNOWN_RESPONSE;
      }
      return INDEXER_ERRORS.UNKNOWN_RESPONSE;
    }

    if (httpStatus === 429 || RATELIMIT_FORUM_ERRORS.some((m) => input.includes(m))) {
      return INDEXER_ERRORS.F95ZONE_RATELIMIT;
    }

    if (CLOUDFLARE_CAPTCHA_MESSAGES.some((m) => input.includes(m))) {
      return INDEXER_ERRORS.CLOUDFLARE_CAPTCHA;
    }

    if (TEMP_ERROR_MESSAGES.some((m) => input.includes(m))) {
      return INDEXER_ERRORS.F95ZONE_UNAVAILABLE;
    }

    if (LOGIN_ERROR_MESSAGES.some((m) => input.includes(m))) {
      return INDEXER_ERRORS.SESSION_LOGGED_OUT;
    }

    return null;
  }

  if (typeof input === "object" && input !== null) {
    if (input.status === "error") {
      const msg = input.msg;
      if (typeof msg === "string" && RATELIMIT_API_ERRORS.includes(msg)) {
        return INDEXER_ERRORS.F95ZONE_RATELIMIT;
      }
      const errors = Array.isArray(input.errors) ? input.errors : [];
      if (
        errors.includes(
          "Cookies are required to use this site. You must accept them to continue using the site."
        )
      ) {
        return INDEXER_ERRORS.SESSION_LOGGED_OUT;
      }
      if (typeof msg === "string") {
        return { ...INDEXER_ERRORS.F95ZONE_ERROR, details: msg };
      }
      return INDEXER_ERRORS.UNKNOWN_RESPONSE;
    }
  }

  return null;
}

const REDIS_STOPWORDS = new Set([
  "a",
  "is",
  "the",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "if",
  "in",
  "into",
  "it",
  "no",
  "not",
  "of",
  "on",
  "or",
  "such",
  "that",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "will",
  "with",
]);

/**
 * Exact TypeScript port of _reference-repo/indexer/f95zone.py:latest_updates_search_sanitize_query().
 */
export function sanitizeLatestUpdatesQuery(rawQuery: string): string {
  let q = rawQuery.replace(/’s |'s /g, " ");
  // ASCII replace equivalent
  q = q.replace(/[^\x00-\x7F]/g, "?");
  q = q.replace(/\.+ | \.+/g, " ");
  for (const ch of "?&/':;-.+!~(),*") {
    q = q.split(ch).join(" ");
  }
  q = q.replace(/\s+/g, " ").trim();
  if (!q) return "";

  const words = q
    .split(" ")
    .filter((w) => !REDIS_STOPWORDS.has(w.toLowerCase()));

  let out = "";
  while (words.length > 0) {
    const nextWord = words.shift()!;
    const append = `${out ? " " : ""}${nextWord}`;
    if (out.length + append.length > 30) {
      const sliced = append.slice(0, 30 - out.length);
      if (
        sliced.length > 3 &&
        !REDIS_STOPWORDS.has(sliced.trim().toLowerCase())
      ) {
        out += sliced;
      }
      break;
    }
    out += append;
  }
  return out;
}
