---
name: python-to-typescript-porting
description: >-
  Guides porting Python scraping, parsing, normalization, and rate-limiting logic from
  _reference-repo into idiomatic, strictly typed Node.js TypeScript using undici,
  p-queue, and cheerio. Use when implementing metadata parsers, scrapers, or worker
  indexing logic based on docs/reverse-engineering-spec.md.
---

# Porting Python Logic to Strict TypeScript

Use this skill whenever translating logic from `_reference-repo` (Python) and `docs/reverse-engineering-spec.md` into `packages/shared` and `apps/server`.

## 1. Porting Workflow

1. Read the corresponding section in `docs/reverse-engineering-spec.md` and inspect the exact reference Python function in `_reference-repo`.
2. Define or reuse strict Zod schemas & TypeScript types in `@game-library/shared`.
3. Port the logic into small, pure, unit-testable TypeScript modules (separate HTTP transport from HTML/JSON parsing so parsers are pure `Buffer | string -> Result` functions).
4. Validate external HTML/JSON responses defensively; never assume scraped DOM nodes or third-party JSON keys exist.

## 2. Python -> Node.js / TypeScript Library Mapping

| Reference (Python) | Target (Node.js / TS) | Notes |
|---|---|---|
| `aiohttp.ClientSession` | `undici.request` / `Pool` | Configure timeouts (`headersTimeout`, `bodyTimeout`, `connect`), manual `Cookie` header injection, and `maxRedirections: 0` when redirects must be avoided (images). |
| `aiolimiter.AsyncLimiter` + `asyncio.Semaphore` | `p-queue` (`PQueue`) | Map `1 req / 0.25s` (`interval: 250, intervalCap: 1`) or `1 req / 1s` (`interval: 1000, intervalCap: 1`) + `concurrency`. |
| `BeautifulSoup4` + `lxml` | `cheerio` | Use `cheerio.load(html)` for DOM queries, attribute lookup, and sibling walking. |
| `aiosqlite` | `better-sqlite3` + Drizzle | Synchronous per-thread API wrapped in short transactions; WAL + `busy_timeout = 5000`. |
| `redis.asyncio` cache | SQLite (`game_metadata`, `index_jobs`) | Store normalized JSON columns and TTL/error metadata directly in SQLite. |
| `PIL.Image` format sniffer | Magic-byte buffer inspector | Inspect header bytes for PNG, JPEG, GIF, WEBP, AVIF, BMP rather than pulling native image libraries. |
| `PyQt6` WebEngine cookie capture | WXT `browser.cookies` + UA sync | User logs in via their normal browser; extension syncs cookies + `navigator.userAgent` over Pairing-Token-authenticated HTTP. |

## 3. High-Risk Python -> TypeScript Semantic Traps

Watch for these exact differences when porting `_reference-repo`:

1. **`str.strip(chars)` is a character-set strip, NOT substring trim:**
   - JS `.trim()` only strips whitespace. Python `.strip("-–|｜\\/':,)(][}{ ")` strips ANY leading/trailing character in that set!
   - Implement a dedicated `stripChars(value: string, chars: string): string` helper and use it for `developer_strip_chars` and download name colon stripping.
2. **Regex flag translations:**
   - `re.DOTALL` -> JS `/s` flag (so `.` matches `\n`).
   - `re.MULTILINE` -> JS `/m` flag (`^` and `$` match line boundaries).
   - `re.IGNORECASE` -> JS `/i` flag.
   - Never reuse a module-level `/g` regex with `.exec()` or `.test()` without resetting `lastIndex = 0`, or instantiate inside the function / use `matchAll`.
3. **Truthiness of empty arrays/objects:**
   - Python `if not downloads:` is `True` for `[]`; JS `if (!downloads)` is `false` for `[]`. Always check `.length === 0`.
4. **Seconds vs. milliseconds timestamps:**
   - Python `time.time()` and F95zone `data-timestamp` / `ts` are Unix **seconds**. JS `Date.now()` is **milliseconds**. Standardize units explicitly in column names (`*AtMs` vs `*TsSec`).
5. **`datestamp()` UTC noon normalization:**
   - Python `utc_time.replace(hour=12, minute=0, second=0, microsecond=0)` maps any timestamp to `12:00:00 UTC` of that date. Port using `Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0) / 1000`.
6. **DOM plain-text extraction parity (`common/parser.py`):**
   - Reference parser clears text inside `.bbCodeSpoiler-button > span > span`, inserts `\n` after every `<div>` inside the starter post, then extracts plain text before running attribute regexes (`Version`, `Developer`, `Overview`, `Changelog`). Replicate these mutations on a cloned/loaded Cheerio post element so newline boundaries match identically.
7. **`IntEnumHack` numeric IDs & display names:**
   - Preserve exact numeric enum IDs (`Type`, `Status`, `Tag`) from `common/structs.py` in `@game-library/shared` alongside their canonical string keys, display labels, and categories so existing data semantics remain 100% compatible.
8. **Error & empty-revert guards:**
   - In developer cleanup, replicate the `prev_developer` guard: if stripping `developer_remove_patterns` produces an empty string, restore `prev_developer`.
   - In `get_long_game_attr`, replicate the cross-leak guard preventing `changelog` text from swallowing `description`.

## 4. Verification Steps

1. Write Vitest/node:test fixture tests covering every parser edge case:
   - Title bracket stripping (`My Game [v1.2] [Author]`)
   - Version fallback chain (`checker.php` -> OP attribute -> `<title>` -> `"N/A"`)
   - Developer alias matching, chop separators, noise pattern removal, and empty-revert guard
   - All 30 `Type` prefixes and 4 `Status` prefixes in exact priority order
   - Tags (`Tag` slug normalization + `unknown_tags`)
   - Spoiler button stripping and dual HTML/regex `description` & `changelog`
   - `latest_updates_search_sanitize_query` stopword & 30-char truncation rules
   - Error signature classification (`THREAD_MISSING`, `RATELIMIT`, `CLOUDFLARE_CAPTCHA`, `SESSION_LOGGED_OUT`, `TEMP_ERROR`)
2. Run parser and sanitizer tests after any edit and ensure 100% pass without skipped assertions.
