import {
  type DownloadMirror,
  type DownloadSection,
  type Review,
  STATUS_PREFIX_ORDER,
  Status,
  type StatusId,
  TAG_BY_ID,
  TAG_BY_SLUG,
  TYPE_PREFIX_ORDER,
  Type,
  type TypeId,
  datestampUtcNoon,
  extractThreadMatches,
  stripChars,
  type ThreadMatch,
} from "@game-library/shared";
import * as cheerio from "cheerio";
import { normalizeAttachmentUrl } from "./f95zone.js";

type AnyNode = ReturnType<ReturnType<cheerio.CheerioAPI>["contents"]>[number];
type Element = Extract<AnyNode, { name: string; attribs: Record<string, string> }>;

export interface ParsedThread {
  name: string;
  threadVersion: string;
  developer: string;
  type: TypeId;
  status: StatusId;
  lastUpdated: number;
  score: number;
  votes: number;
  description: string;
  changelog: string;
  tags: number[];
  unknownTags: string[];
  imageUrl: string;
  previewsUrls: string[];
  downloads: DownloadSection[];
}

export interface ParsedReviews {
  total: number;
  items: Review[];
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const sanitizeWhitespace = (text: string): string =>
  text.replace(/(?:[^\S\r\n]|\u200b)/g, " ").replace(/ *(?:\r\n?|\n)/g, "\n");

const fixedNewlines = (text: string): string =>
  text.replace(/(?: *\n){2}(?: *\n)+/g, "\n\n").trim();

const fixedSpaces = (text: string): string => text.replace(/ +/g, " ").trim();

const cleanText = (text: string): string =>
  fixedSpaces(fixedNewlines(sanitizeWhitespace(text)));

const DEVELOPER_STRIP_CHARS = "-–|｜\\/':,)(][}{ ";

const DEVELOPER_CHOP_SEPARATORS = [
  "is creating",
  "and h",
  " - ",
  " – ",
  " | ",
  " ｜ ",
  " \\ ",
  " / ",
  "'s ",
  ": ",
  ", ",
  "(",
  "[",
  "{",
];

const DEVELOPER_REMOVE_PATTERNS = [
  /commissions?/gi,
  /blogspot/gi,
  /profile/gi,
  /website/gi,
  /trailer/gi,
  /weebly/gi,
  / blog/gi,
  / page/gi,
  / web/gi,
  /linktr(?:\.| *)?ee/gi,
  /instagram/gi,
  /facebook/gi,
  /youtube/gi,
  /discord/gi,
  /twitter/gi,
  /reddit/gi,
  /tumblr/gi,
  /buy *me *a *coffee/gi,
  /(?: |-)itch(?:\.io)?/gi,
  /subscr?ibe?star/gi,
  /kickstarter/gi,
  /tip *jar/gi,
  /indiegogo/gi,
  /gumroad/gi,
  /patreon/gi,
  /ko-?fi/gi,
  /fanbox/gi,
  /fantia/gi,
  /slushe/gi,
  /naughty *machinima/gi,
  /hypnopics *collective/gi,
  /affect3d(?:store)?/gi,
  /rule34(?:video)?/gi,
  /picarto(?:\.tv)?/gi,
  /furaffinity/gi,
  /newgrounds/gi,
  /deviantart/gi,
  /artstation/gi,
  /(?:porn)?3dx/gi,
  /redgifs?/gi,
  /pornhub/gi,
  /xvideos/gi,
  /pixiv/gi,
  /hentai-?foundry/gi,
  /hentaiengine/gi,
  /lewdpixels/gi,
  /waifu\.nl/gi,
  /bowlroll/gi,
  /2dmarket/gi,
  /ci-en/gi,
  /iwara/gi,
  /fakku/gi,
  / vndb/gi,
  / dmm/gi,
  /tfgames?site/gi,
  /f95(?:zone)?/gi,
  /gamejolt/gi,
  /dlsite/gi,
  /fenoxo/gi,
  /boosty/gi,
  /steam/gi,
  / enty/gi,
  /https?:\/\/\S*/gi,
];

function isTagNode(node: AnyNode | null | undefined): node is Element {
  return Boolean(node && "name" in node && "attribs" in node);
}

function hasClass(node: AnyNode | null | undefined, className: string): boolean {
  if (!isTagNode(node)) return false;
  const cls = node.attribs?.class ?? "";
  return cls.split(/\s+/).includes(className);
}

function getNodeText($: cheerio.CheerioAPI, node: AnyNode): string {
  if (node.type === "text") {
    return node.data ?? "";
  }
  if (isTagNode(node)) {
    return $(node).text();
  }
  return "";
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFirstTextElement(
  $: cheerio.CheerioAPI,
  root: ReturnType<cheerio.CheerioAPI>,
  names: string[]
): AnyNode | null {
  const allEls = root.find("*").toArray();
  for (const name of names) {
    const lower = name.toLowerCase();
    for (const el of allEls) {
      const val = sanitizeWhitespace($(el).text().toLowerCase());
      if (val === lower || val.startsWith(`${lower}:`)) {
        return el;
      }
    }
  }
  return null;
}

/**
 * Parse an F95zone thread HTML page.
 * Direct TypeScript port of _reference-repo/common/parser.py:thread().
 */
export function parseThreadHtml(html: string): ParseResult<ParsedThread> {
  try {
    const $ = cheerio.load(html);
    const head = $(".p-body-header").first();
    let post = $(".message-threadStarterPost").first();
    if (post.length === 0) {
      post = $(".message--article").first();
    }

    if (head.length === 0 || post.length === 0) {
      const logoAlt = $(".p-header-logo img").first().attr("alt") ?? "";
      return {
        ok: false,
        message: logoAlt.startsWith("F95zone")
          ? "Thread structure missing"
          : "Not an F95zone payload",
      };
    }

    // Clear spoiler button text and insert newlines after <div> elements
    post.find(".bbCodeSpoiler-button > span > span").each((_, el) => {
      $(el).text("");
    });
    post.find("div").each((_, el) => {
      $(el).after("\n");
    });

    const plain = sanitizeWhitespace(post.find("article").first().text());

    const getGameAttr = (...names: string[]): string => {
      for (const name of names) {
        const re = new RegExp(
          `^ *${escapeRegExp(name)} *(?: *\\n? *:|: *\\n? *) *(.*)`,
          "mi"
        );
        const m = re.exec(plain);
        if (m && m[1] !== undefined) {
          return fixedSpaces(m[1]);
        }
      }
      return "";
    };

    const getLongGameAttr = (...names: string[]): [string, string] => {
      let valueRegex = "";
      for (const name of names) {
        const re = new RegExp(
          `^ *${escapeRegExp(name)} *:? *\\n? *:? *((?:.|\\n)*)`,
          "mi"
        );
        const m = re.exec(plain);
        if (m && m[1] !== undefined) {
          valueRegex = m[1].replace(
            /(?:(?: *\n){7}|(?:\n *[A-Z a-z]+:(?:.|\n)+?){2}|\n *(?:DOWNLOAD|Download) *(?:\n|:))(?:.|\n)*/m,
            ""
          );
          valueRegex = fixedNewlines(valueRegex);
          break;
        }
      }

      let valueHtml = "";
      let elem: AnyNode | null = findFirstTextElement($, post, names);
      if (elem) {
        while (isTagNode(elem) && elem.children.length > 0) {
          elem = elem.children[0] ?? null;
        }
        while (
          elem &&
          !(hasClass(elem, "bbWrapper") || (isTagNode(elem.parent) && elem.parent.name === "article"))
        ) {
          if (elem.next) {
            elem = elem.next;
          } else {
            elem = elem.parent;
            continue;
          }
          if (
            isTagNode(elem) &&
            (elem.name === "b" || (elem.attribs?.style ?? "").includes("center"))
          ) {
            break;
          }
          const txt = sanitizeWhitespace(getNodeText($, elem));
          const trimmed = txt.trim();
          if (trimmed === ":" || trimmed === "") {
            continue;
          }
          valueHtml += txt;
        }
        valueHtml = fixedNewlines(valueHtml);
      }

      return [valueHtml, valueRegex];
    };

    const getGameDownloads = (...names: string[]): DownloadSection[] => {
      let elem: AnyNode | null = findFirstTextElement($, post, names);
      if (!elem) return [];
      while (isTagNode(elem) && !hasClass(elem, "link") && elem.children.length > 0) {
        elem = elem.children[0] ?? null;
      }

      const downloads: DownloadSection[] = [];
      let downloadName = "";
      let downloadMirrors: DownloadMirror[] = [];

      const flushSection = () => {
        downloadName = cleanText(downloadName);
        const lines = downloadName.split("\n");
        const lastLine = lines.pop() ?? "";
        downloadName = stripChars(cleanText(lastLine), ":");
        for (const rawLine of lines) {
          const line = stripChars(cleanText(rawLine), ":");
          if (line) {
            downloads.push({ name: line, mirrors: [] });
          }
        }
        if (downloadName || downloadMirrors.length > 0) {
          downloads.push({ name: downloadName, mirrors: downloadMirrors });
          downloadName = "";
          downloadMirrors = [];
        }
      };

      while (
        elem &&
        !(hasClass(elem, "bbWrapper") || (isTagNode(elem.parent) && elem.parent.name === "article"))
      ) {
        if (elem.next) {
          elem = elem.next;
        } else {
          elem = elem.parent;
          continue;
        }
        if (hasClass(elem, "u-hidden")) {
          continue;
        }

        while (isTagNode(elem) && !hasClass(elem, "link") && elem.children.length > 0) {
          elem = elem.children[0] ?? null;
        }
        if (!elem) break;

        if (isTagNode(elem) && hasClass(elem, "link") && elem.attribs?.href) {
          const rawHref = elem.attribs.href;
          const resolvedHref = rawHref.startsWith("/")
            ? `https://f95zone.to${rawHref}`
            : rawHref;
          downloadMirrors.push({
            label: cleanText($(elem).text()),
            url: resolvedHref,
          });
        } else {
          if (isTagNode(elem) && (elem.name === "img" || elem.name === "video")) {
            break;
          }
          const txt = sanitizeWhitespace(getNodeText($, elem));
          if (!stripChars(txt, "-,*:/ \r\n\t")) {
            continue;
          }
          if (downloadMirrors.length > 0) {
            flushSection();
          }
          downloadName += txt;
        }
      }

      flushSection();
      return downloads;
    };

    // Title
    const titleEl = $(".p-title-value").first();
    let rawName = "";
    if (titleEl.length > 0) {
      for (const child of titleEl.contents().toArray()) {
        if (
          !hasClass(child, "p-title-prefix") &&
          !hasClass(child, "labelLink") &&
          !hasClass(child, "label-append")
        ) {
          rawName += getNodeText($, child);
        }
      }
    }
    const nameMatch = /^\s*(.*?)(?:\s*\[.*?\]\s*)*$/s.exec(rawName);
    const name = fixedSpaces(
      sanitizeWhitespace(nameMatch?.[1] ?? rawName).replace(/\n/g, " ")
    );

    // Version
    let threadVersion = getGameAttr("version", "mod version", "game version");
    if (!threadVersion) {
      const htmlTitle = $("title").first().text();
      const titleVerMatch = /(?:\[.+?\] - )*.+?\[(.+?)\]/.exec(htmlTitle);
      if (titleVerMatch?.[1]) {
        threadVersion = fixedSpaces(sanitizeWhitespace(titleVerMatch[1]));
      }
    }

    // Developer
    let developer = getGameAttr(
      "developer/publisher",
      "developer & publisher",
      "developer / publisher",
      "original developer",
      "developers",
      "developer",
      "publisher",
      "artist",
      "animator",
      "producer",
      "modder",
      "remake by",
      "game by",
      "posted by"
    );
    for (const sep of DEVELOPER_CHOP_SEPARATORS) {
      developer = developer.split(sep)[0] ?? "";
    }
    for (let guard = 0; guard < 10; guard += 1) {
      const prev = developer;
      for (const pattern of DEVELOPER_REMOVE_PATTERNS) {
        developer = developer.replace(pattern, "");
      }
      if (!developer) {
        developer = prev;
        break;
      }
      if (developer === prev) {
        break;
      }
    }
    developer = fixedSpaces(stripChars(developer, DEVELOPER_STRIP_CHARS));

    // Prefixes (Type & Status)
    const prefixTexts = new Set<string>();
    head.find("span").each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) prefixTexts.add(txt);
    });

    let type: TypeId = Type.Misc;
    for (const entry of TYPE_PREFIX_ORDER) {
      if (prefixTexts.has(entry.prefix)) {
        type = entry.id;
        break;
      }
    }

    let status: StatusId = Status.Normal;
    for (const entry of STATUS_PREFIX_ORDER) {
      if (prefixTexts.has(entry.prefix)) {
        status = entry.id;
        break;
      }
    }

    // Last updated timestamp
    let lastUpdatedRaw = 0;
    const updatedAttr = getGameAttr(
      "thread updated",
      "updated",
      "release date"
    ).replace(/\//g, "-");
    if (updatedAttr) {
      const parsedMs = Date.parse(updatedAttr);
      if (!Number.isNaN(parsedMs)) {
        lastUpdatedRaw = Math.floor(parsedMs / 1000);
      }
    }
    if (!lastUpdatedRaw) {
      const editTime = post.find(".message-lastEdit time").first().attr("data-timestamp");
      const attrTime = post
        .find(".message-attribution-main time")
        .first()
        .attr("data-timestamp");
      const tsStr = editTime || attrTime;
      if (tsStr) {
        const parsed = Number.parseInt(tsStr, 10);
        if (Number.isFinite(parsed)) {
          lastUpdatedRaw = parsed;
        }
      }
    }
    const lastUpdated = datestampUtcNoon(lastUpdatedRaw);

    // Score & Votes
    let score: number | null = null;
    let votes: number | null = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (score !== null && votes !== null) return;
      try {
        const parsed = JSON.parse($(el).text()) as Record<string, unknown>;
        if (
          parsed["@context"] === "http://schema.org/" &&
          typeof parsed.aggregateRating === "object" &&
          parsed.aggregateRating !== null
        ) {
          const agg = parsed.aggregateRating as Record<string, unknown>;
          const rv = Number(agg.ratingValue);
          const rc = Number(agg.ratingCount);
          if (Number.isFinite(rv) && Number.isFinite(rc)) {
            score = rv;
            votes = Math.trunc(rc);
          }
        }
      } catch {
        // Ignore malformed ld+json blocks
      }
    });

    if (score === null) {
      const ringText = $(".f95rv-banner-ringValue").first().text().trim();
      const parsedScore = Number.parseFloat(ringText);
      score = Number.isFinite(parsedScore) ? parsedScore : 0;
    }

    if (votes === null) {
      const countText = $(".f95rv-banner-count").first().text();
      const countMatch = /([\d,]+)\s*reviews/i.exec(countText);
      if (countMatch?.[1]) {
        const parsedVotes = Number.parseInt(countMatch[1].replace(/,/g, ""), 10);
        votes = Number.isFinite(parsedVotes) ? parsedVotes : 0;
      } else {
        votes = 0;
      }
    }

    // Description & Changelog
    const [descHtml, descRegex] = getLongGameAttr("overview", "story");
    const [chgHtml, chgRegex] = getLongGameAttr(
      "changelog",
      "change-log",
      "change log"
    );
    const chgCombined = chgHtml + chgRegex;

    let description: string;
    if (descRegex.length > descHtml.length) {
      description =
        descHtml && chgCombined.includes(descRegex) ? descHtml : descRegex;
    } else {
      description =
        descRegex && chgCombined.includes(descHtml) ? descRegex : descHtml;
    }
    const changelog = chgRegex.length > chgHtml.length ? chgRegex : chgHtml;

    // Tags
    const tagSet = new Set<number>();
    const unknownTags: string[] = [];
    head.find(".js-tagList a[href*='/tags/']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const slug = stripChars(href.replace(/^.*\/tags\//, ""), "/");
      if (!slug) return;
      const meta = TAG_BY_SLUG.get(slug);
      if (meta) {
        tagSet.add(meta.id);
      } else if (!unknownTags.includes(slug)) {
        unknownTags.push(slug);
      }
    });
    const tags = [...tagSet].sort((a, b) => {
      const ta = TAG_BY_ID.get(a)?.slug ?? "";
      const tb = TAG_BY_ID.get(b)?.slug ?? "";
      return ta.localeCompare(tb);
    });

    // Cover & Previews
    const bbWrapper = post.find(".bbWrapper").first();
    let imageUrl = "missing";
    bbWrapper.find("div[data-src]").each((_, el) => {
      if (imageUrl !== "missing") return;
      const src = $(el).attr("data-src") ?? "";
      if (src.length > "https://".length) {
        imageUrl = normalizeAttachmentUrl(src);
      }
    });

    const previewsUrls: string[] = [];
    bbWrapper.find(".js-lbImage").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!href.startsWith("https://attachments.f95zone.to/")) return;
      const normalized = normalizeAttachmentUrl(href);
      if (normalized !== imageUrl && !previewsUrls.includes(normalized)) {
        previewsUrls.push(normalized);
      }
    });

    const downloads = getGameDownloads("downloads", "download");

    return {
      ok: true,
      data: {
        name,
        threadVersion,
        developer,
        type,
        status,
        lastUpdated,
        score,
        votes,
        description,
        changelog,
        tags,
        unknownTags,
        imageUrl,
        previewsUrls,
        downloads,
      },
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unhandled parser error",
    };
  }
}

/**
 * Parse an F95zone `/threads/{id}/reviews/` HTML page.
 */
export function parseReviewsHtml(html: string): ParseResult<ParsedReviews> {
  try {
    const $ = cheerio.load(html);
    const body = $(".p-body-pageContent").first();
    if (body.length === 0) {
      const logoAlt = $(".p-header-logo img").first().attr("alt") ?? "";
      return {
        ok: false,
        message: logoAlt.startsWith("F95zone")
          ? "Review structure missing"
          : "Not an F95zone payload",
      };
    }

    const items: Review[] = [];
    body.find(".f95rv-cards .f95rv-card").each((_, el) => {
      const card = $(el);
      const user = card.attr("data-author") ?? "Anonymous";
      const aria = card.find(".f95rv-stars").first().attr("aria-label") ?? "0";
      const score = Number.parseFloat(aria.split(" ")[0] ?? "0") || 0;
      let message = card.find(".bbWrapper .bbWrapper").first().text();
      message = message.replace(/[\u2063\u200c\u200b\u2064]/g, "").trim();
      const voteText = card.find(".f95rv-vote").first().text().trim();
      const likes =
        Number.parseInt(voteText.split(" ").pop() ?? "0", 10) || 0;
      const timestamp =
        Number.parseInt(
          card.find(".u-dt").first().attr("data-timestamp") ?? "0",
          10
        ) || 0;

      items.push({ user, score, message, likes, timestamp });
    });

    const bannerText = $(".f95rv-banner-count").first().text();
    const totalMatch = /([\d,]+)\s*reviews/i.exec(bannerText);
    const total = totalMatch?.[1]
      ? Number.parseInt(totalMatch[1].replace(/,/g, ""), 10) || items.length
      : items.length;

    return { ok: true, data: { total, items } };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unhandled review parser error",
    };
  }
}

/**
 * Parse thread links from F95zone watched / bookmarks HTML pages.
 */
export function parseWatchedPageHtml(
  html: string,
  variant: "new" | "struct" | "bookmarks"
): ThreadMatch[] {
  const $ = cheerio.load(html);
  const content = $(".p-body-pageContent").first();
  if (content.length === 0) return [];

  const matches: ThreadMatch[] = [];
  const seen = new Set<number>();

  const pushHref = (href: string | undefined) => {
    if (!href) return;
    for (const m of extractThreadMatches(href)) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        matches.push(m);
      }
    }
  };

  if (variant === "new") {
    content.find(".f95wg-row").each((_, row) => {
      pushHref($(row).find(".f95wg-row-title a").first().attr("href"));
    });
  } else if (variant === "struct") {
    content.find(".structItemContainer .structItem-title").each((_, title) => {
      pushHref($(title).attr("uix-href") ?? $(title).find("a").first().attr("href"));
    });
  } else {
    content.find(".listPlain .contentRow-title a").each((_, anchor) => {
      pushHref($(anchor).attr("href"));
    });
  }

  return matches;
}
