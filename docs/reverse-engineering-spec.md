# Reverse-Engineering Specification: F95Checker -> Standalone Windows Game Library Manager

**Reference Repository:** `_reference-repo/` (F95Checker v11.2.2 + F95Indexer)  
**Target Stack:** TypeScript Monorepo (`pnpm` + Turborepo), WXT Extension (Chrome MV3 + Firefox), Fastify + SQLite (`better-sqlite3` WAL + Drizzle ORM) + AES-256-GCM + `worker_threads` (`p-queue` + `undici`) + SSE, React + Vite + Tailwind + TanStack Query.

---

## 1. Executive Overview & Reference Repository Architecture

F95Checker (`_reference-repo`) is a Python desktop application (ImGui + GLFW + `asyncio` + `aiosqlite`) paired with a companion browser addon and an optional server-side caching service (**F95Indexer**, hosted at `api.f95checker.dev`).

The reference repository is organized into four functional layers:

| Layer | Reference Files | Responsibility |
|---|---|---|
| **Shared Models & HTML Parser** | `common/meta.py`, `common/structs.py`, `common/parser.py` | Domain enums (`Type`, `Status`, `Tag`, `TimelineEventType`), dataclasses (`Game`, `Settings`, `Review`, `DdlFile`, `TorrentResult`), and BeautifulSoup/lxml parsers for F95zone threads and reviews. |
| **Desktop Core & Client API** | `main.py`, `modules/globals.py`, `modules/db.py`, `modules/api.py`, `modules/callbacks.py`, `modules/rpdl.py`, `modules/webview.py`, `modules/utils.py`, `modules/colors.py` | Local SQLite persistence (`db.sqlite3`), PyQt6 WebEngine cookie/login/captcha capture, `api.f95checker.dev` fast/full sync, Donor DDL & RPDL.net integration, cover/preview caching, game launching & playtime tracking. |
| **Local Browser RPC Server** | `modules/rpc_thread.py` | `socketserver.TCPServer` bound to `127.0.0.1:57095` exposing unauthenticated CORS endpoints (`/games`, `/settings`, `/games/add`, `/assets/mdi-webfont.ttf`, `/window/*`) to browser extensions and Qt WebChannel. |
| **F95Indexer Service** | `indexer-main.py`, `indexer/threads.py`, `indexer/cache.py`, `indexer/scraper.py`, `indexer/f95zone.py`, `indexer/watcher.py` | FastAPI + Redis service scraping `f95zone.to`, cross-referencing `checker.php` and `latest_data.php`, redacting naked/masked download links to XPath expressions, and polling Latest Updates (5m) & Versions (12h). |
| **Browser Extensions** | `browser/chrome/*`, `browser/firefox/*`, `browser/integrated.js` | Chrome MV3 & Firefox MV2 addons injecting library status icons and tag highlights on `f95zone.to`, plus context-menu/action add-to-library calls to `127.0.0.1:57095`. |

### Architectural Shift in Target System

In the reference architecture, F95Checker offloads direct `f95zone.to` scraping to an external hosted FastAPI+Redis service (`api.f95checker.dev`) while using PyQt6 WebEngine locally for F95zone login (`xf_user`), Cloudflare captcha solving, and `/dl/` link unmasking.

In our **zero-dependency standalone Windows target**, there is **no external Redis or Python WebEngine**:
1. **The user's real browser + WXT extension** replaces PyQt6 WebEngine as the source of authenticated cookies (`xf_user`, `xf_tfa_trust`, `cf_clearance`) and matching `User-Agent`.
2. **A Fastify backend + Node.js `worker_threads` indexer** replaces both `rpc_thread.py` and the Redis-backed `indexer/` pipeline, storing encrypted session material in SQLite (`accounts`) and parsed metadata/jobs in SQLite (`games`, `game_metadata`, `index_jobs`) with covers cached in `./data/covers/`.

---

## 2. External API Endpoints, Request Contracts & Rate-Limit Behaviors

### 2.1 F95zone Endpoints (`https://f95zone.to`)

Observed domains in `modules/api.py`:
- Primary host: `https://f95zone.to` (domains tuple also recognizes `f95zone.com`, `f95zone.ninja` for URL matching).
- Attachment CDN failover hosts (in exact order):
  1. `https://attachments.f95zone.to/`
  2. `https://attachments.f95zone.com/`
  3. `https://attachments.f95zone.ninja/` *(Note: `modules/api.py` explicitly allows insecure TLS on `attachments.f95zone.ninja` due to invalid SSL cert)*

| Endpoint | Method | Auth Required | Purpose & Contract | Source |
|---|---|---|---|---|
| `/threads/{id}` | `GET` | Optional (needed for private/restricted sections) | Full XenForo thread HTML page parsed for title, OP metadata, tags, cover, previews, downloads, and rating summary. | `indexer/f95zone.py`, `indexer/scraper.py` |
| `/threads/{id}/reviews/` | `GET` | Optional | HTML reviews page (up to 20 most recent reviews). Note: if thread has reviews disabled, server redirects away from `/reviews` (`req.real_url` does not end with `/reviews`). | `indexer/scraper.py`, `common/parser.py` |
| `/sam/checker.php?threads={csv}` | `GET` | No | Bulk version check API. `csv` supports up to 1000 thread IDs (`watcher.py`). Returns JSON `{ "status": "ok" \| "error", "msg": { "<id>": "<version>" \| "Unknown" } \| "Missing threads data" \| "Thread not found" }`. | `indexer/f95zone.py`, `indexer/scraper.py`, `indexer/watcher.py` |
| `/sam/latest_alpha/` | `GET` | `xf_user` | Used by `api.is_logged_in()` (checks absence of `<pre>Sorry, you have to be <a href="/login">logged in</a> to access this page</a></pre>`). Also embeds `<script>var latestUpdates = {...};</script>` containing the live canonical `tags` map (`tags-diff.py`). | `modules/api.py`, `tags-diff.py` |
| `/sam/latest_alpha/latest_data.php` | `GET` | `xf_user` | Query params: `cmd=list`, `cat={games\|comics\|animations\|assets}`, `page={1..N}`, optional `{search\|creator}={query}`, `sort={date\|likes}`, `rows=90`, `_={unixSec}`. Returns JSON `msg.data[]` with `{ thread_id, title, creator, version, prefixes, tags, rating, cover, screens[], ts }`. Returns error `"You have to be logged in to see Latest Updates."` if unauthenticated. | `indexer/f95zone.py`, `indexer/scraper.py`, `indexer/watcher.py`, `modules/api.py` |
| `/direct-messages/popup?_xfResponseType=json` | `GET` | `xf_user` | Unread notification counter. Reads `res.visitor.alerts_unviewed` and `res.visitor.conversations_unread` (comma/dot-formatted strings stripped to `int`). | `modules/api.py` |
| `/watched/threads?...` | `GET` | `xf_user` | Paginated watched & bookmarked thread pages (5 URL variants documented in Section 4.6). | `modules/api.py` |
| `/sam/dddl.php?raw=1` | `POST` | `xf_user` (Donor) | Form-encoded `thread_id` returns `{ status, msg: { session, files } }`; second POST with `{ thread_id, file, session }` returns `{ msg: { url, cookie } }`. Errors: `"Not logged in"`, `"Not a donor"`. | `modules/api.py` |

### 2.2 F95Checker Cache API (`https://api.f95checker.dev`, overridable via `F95INDEXER_URL`)

| Endpoint | Method | Query / Params | Response & Status Codes | Source |
|---|---|---|---|---|
| `/fast?ids={csv}` | `GET` | `ids`: max `10` comma-separated integers in `1..999_999` | `200`: `{ "<id>": <last_change_unix_sec> }`; `400` on >10 IDs, non-numeric, or out-of-range ID. Triggers lazy cache refresh on server if stale. | `indexer/threads.py`, `modules/api.py` |
| `/full/{id}?ts={unixSec}` | `GET` | `id` in `1..999_999`; `ts <= now` | `200`: cached Redis hash fields as JSON; `406` if `ts > time.time()`; `404` if `INDEX_ERROR == "THREAD_MISSING"`; `500` on other `INDEX_ERROR` (still returns any previously cached fields if present!). | `indexer/threads.py`, `indexer/cache.py`, `modules/api.py` |
| `/raw/{id}` | `GET` | `id` in `1..999_999` | Same as `/full/{id}` but with `allow_stale=True` (never scrapes upstream). | `indexer/threads.py` |

### 2.3 RPDL.net API (`https://dl.rpdl.net`)

Used optionally for torrent search and authenticated `.torrent` file download (`modules/rpdl.py`):
- `POST /api/user/login` (`{ login, password }`) -> `{ data: { username, token } }` or `{ error }`
- `POST /api/user/register` (`{ username, password, confirm_password }`)
- `GET /api/torrents?search={query}&sort=uploaded_DESC` -> `{ data: { results: [{ torrent_id, title, file_size, seeders, leechers, upload_date }] } }`
- `GET /api/torrent/download/{id}` with header `Authorization: Bearer <rpdl_token>` -> returns raw bencoded `.torrent` bytes or JSON `{ error: "Token invalid." | "Token expired..." | "Token not found..." }`. Validates authenticated tracker by checking `bencode.announce.split("/announce")[-1]` is non-empty.

### 2.4 Local Extension RPC (`http://127.0.0.1:57095`)

Reference `modules/rpc_thread.py` exposes:
- `GET /games` -> array of `{ id, icon, color, notes }`
- `GET /settings` -> `{ icon_glow, highlight_tags, tags_highlights: { [tagText]: 1 | 2 | 3 } }`
- `GET /assets/mdi-webfont.ttf` -> font binary (`Cache-Control: public, max-age=3600`)
- `POST /games/add` -> JSON array of URL strings `string[]` (parsed by `extract_thread_matches`)
- `POST /window/show`, `POST /window/hide`, `POST /window/refresh_styles`

Allowed origins in reference: empty origin, `chrome-extension://`, `moz-extension://`, `safari-web-extension://`, `https://f95zone.to`, `https://www.f95zone.to`. Preflight responds with `Access-Control-Allow-Private-Network: true` if requested.

### 2.5 Rate Limits, Concurrency & Backoffs

| Scope | Reference Mechanism | Exact Parameters | Target Implementation (`p-queue` / `undici`) |
|---|---|---|---|
| **Indexer Forum Scraper** (`indexer/f95zone.py`, `scraper.py`) | `aiolimiter.AsyncLimiter` | `max_rate=1, time_period=0.25` (4 req/s); HTTP `429` triggers `2s` sleep up to `10` retries; request timeout `30s`. | `PQueue({ interval: 250, intervalCap: 1, concurrency: 2 })` with `429` backoff + retry cap. |
| **Desktop Client Forum Requests** (`modules/api.py`) | `aiolimiter.AsyncLimiter` | `max_rate=1, time_period=1` (1 req/s, excludes `/sam/` endpoints); on `429` or forum rate-limit HTML: up to `10` retries sleeping `5, 10, 15, ...`s (`ratelimit_sleep += 5`). | Conservative default `PQueue({ interval: 1000, intervalCap: 1, concurrency: 1 })` or configurable direct-scrape throttle with exponential/step backoff on `429`. |
| **Attachments / Images** (`modules/api.py`) | `aiolimiter.AsyncLimiter` | `max_rate=2, time_period=1` (2 req/s); timeout `settings.request_timeout * 4` (`120s` default); `allow_redirects=False` to avoid signed-URL loops. | Dedicated image `PQueue({ interval: 500, intervalCap: 1, concurrency: 2 })`, `undici` `maxRedirections: 0`, `bodyTimeout: 120_000`. |
| **Fast Check / Full Check Semaphores** (`modules/api.py`) | `asyncio.Semaphore` | `fast_checks_sem = 1`, `full_checks_sem = max_connections` (default `10`). | Single `index_jobs` orchestrator queue (`concurrency` configurable, default `4` for direct scraping). |
| **Background Watchers** (`indexer/watcher.py`) | Async background loops | `watch_updates`: every `5 minutes` across `games`, `comics`, `animations`, `assets` pages `1..4` (`rows=90`, `sort=date`); `watch_versions`: every `12 hours` in chunks of `1000` IDs to `checker.php`. | Scheduled worker intervals (`setInterval` / `p-queue` background jobs) using `checker.php` chunks of 1000 and Latest Updates polling when authenticated. |

### 2.6 Error, Rate-Limit, Cloudflare & Downtime Detection Signatures

Port verbatim from `indexer/f95zone.py` (`check_error`) and `modules/api.py` (`raise_f95zone_error`):

| Condition | Detection Signature (HTTP Body / JSON / Exception) | Reference Flag & Retry Delay |
|---|---|---|
| **Thread Missing / No Permission** | Body contains `<body data-template="error">` AND `.p-body-pageContent .blockMessage` trimmed text equals `"The requested thread could not be found."` or `"You do not have permission to view this page or perform this action."` | `THREAD_MISSING` (`14 days`) |
| **Generic Forum Error** | `<body data-template="error">` with any other `.blockMessage` text | `F95ZONE_ERROR` (`15 mins`) + `details` |
| **Forum Rate Limit** | HTTP `429` OR body contains `<body data-template="f95rl_paused">`, `<title>429 Too Many Requests</title>`, `<h1>429 Too Many Requests</h1>`, `<title>Error 429</title>`, `<title>DDoS-Guard</title>`, `<title>DDOS-GUARD</title>` | `F95ZONE_RATELIMIT` (`15 mins`) |
| **API Rate Limit** | JSON `status === "error"` and `msg === "You have been temporarily blocked because of a large amount of requests, please try again later"` | `F95ZONE_RATELIMIT` (`15 mins`) |
| **Cloudflare Challenge** | Body contains `(function(){window._cf_chl_opt = {` OR `<title>Just a moment...</title>` OR empty body | `CLOUDFLARE_CAPTCHA` (`15 mins`) |
| **Temp Downtime / Maintenance** | Body contains `<div id="cf-error-details" class="p-0">`, `<b>504 - Gateway Timeout .</b>`, `<title>502 Bad Gateway</title>`, `<title>Error 502</title>`, `An unexpected error occurred. Please try again later.`, `An unexpected database error occurred. Please try again later.\n<!--`, `<!-- Connection refused -->`, `<!-- Too many connections -->`, `<p>Automated backups are currently executing. During this time, the site will be unavailable</p>`, `<title>F95Zone :: Maintenance</title>`, `<title>F95Zone :: Scheduled Maintenance</title>`, `<script src="https://static.f95zone.to/assets/SamF95/ErrorPage`, `<div class="blockMessage"><p>Please check back in 10 mins</p></div>`, OR network timeout / connection error | `F95ZONE_UNAVAILABLE` (`15 mins`) |
| **Session Logged Out** | Body contains `<a href="/login/" data-xf-click="overlay">Log in or register now.</a>`, `<title>Log in \| F95zone`, `<form action="/login/login" method="post" class="block"`, OR JSON `errors` contains `"Cookies are required to use this site. You must accept them to continue using the site."` | `SESSION_LOGGED_OUT` (`15 mins`) |
| **Parse / Invalid Payload** | Missing `.p-body-header` or `.message-threadStarterPost`/`.message--article` or invalid JSON | `PARSING_FAILED` / `UNKNOWN_RESPONSE` (`1 hour`) |

---

## 3. Authentication, Session & Cookie Lifecycle

### 3.1 How the Reference Repository Handles Auth

1. **Desktop client (`modules/api.py` + `modules/webview.py`):**
   - Opens a private PyQt6 `QWebEngineView` window to `https://f95zone.to/login/`.
   - Listens to `cookieStore.cookieAdded` for every cookie set during login (supports 2FA seamlessly because the user completes 2FA inside the webview) and resolves login once `xf_user` is observed (`modules/api.py:577-582`).
   - Persists all captured cookies as plain `{ key, value }` pairs in SQLite `cookies` table (`modules/db.py:354-360`).
   - **Critical detail:** `modules/api.py:306-307` overrides the `User-Agent` header on forum requests with `webview.get_user_agent()` (`app.window.webview.profile.httpUserAgent()`). This is required because Cloudflare `cf_clearance` cookies are cryptographically bound to the browser `User-Agent` and TLS context that solved the challenge.
   - **Verification:** `is_logged_in()` fetches `GET /sam/latest_alpha/` and returns `true` iff the response does not contain `<pre>Sorry, you have to be <a href="/login">logged in</a> to access this page</a></pre>`.
2. **F95Indexer (`indexer/f95zone.py`):**
   - Uses a headless `COOKIE_XF_USER` env var (`indexer.env-example`) with a custom `F95Indexer/<ver> Python/... aiohttp/...` User-Agent (relying on server IP/allowlisting or non-CF-gated routes; in `scraper.py` note `TODO` comment on auto-login).

### 3.2 Auth Requirements Matrix

| Capability | Unauthenticated (No `xf_user`) | Authenticated (`xf_user` + `xf_tfa_trust` / `cf_clearance`) |
|---|---|---|
| `GET /sam/checker.php?threads=...` | Works | Works |
| `GET /threads/{id}` & `/threads/{id}/reviews/` | Works for public threads (fails if Cloudflare gated without `cf_clearance` or if restricted thread) | Works for all accessible threads |
| `GET /sam/latest_alpha/latest_data.php` | Fails (`"You have to be logged in..."`) | Works (needed for Latest Updates polling, search, high-res cover/screen fallback) |
| `GET /watched/threads?...` | Fails | Works (imports watched & bookmarked threads) |
| `GET /direct-messages/popup` | Fails | Works (unread alerts/DMs) |
| `POST /sam/dddl.php` | Fails | Works (Donor accounts) |

### 3.3 Target Architecture Replacement (Browser Extension + AES-256-GCM)

1. The user logs into `https://f95zone.to` in Chrome or Firefox normally (handling passwords, 2FA, and any Cloudflare interstitials natively in their browser).
2. The WXT extension background worker uses `browser.cookies.getAll({ domain: "f95zone.to" })` (which captures `HttpOnly` cookies including `xf_user`, `xf_tfa_trust`, `xf_session`, `cf_clearance`) alongside `navigator.userAgent`.
3. The extension sends `{ cookies, userAgent }` to `POST /api/accounts/f95zone/session` on `http://127.0.0.1:<PORT>` authenticated with `X-Pairing-Token`.
4. Fastify validates with Zod, encrypts `{ cookies, userAgent }` as JSON using native `node:crypto` **AES-256-GCM** (random 12-byte IV + auth tag), and stores it in SQLite `accounts` (`status = "active"`).
5. The `worker_threads` indexer decrypts the session payload, builds the `Cookie: key=val; ...` header and matching `User-Agent` header on `undici` requests, and marks the account `expired` / `captcha_required` + emits an SSE event if `SESSION_LOGGED_OUT` or `CLOUDFLARE_CAPTCHA` is detected.

---

## 4. HTML & JSON Parsing, Normalization & Data Models

### 4.1 Thread Page Parser (`common/parser.py:thread`)

**Pre-processing & Text Sanitization:**
- Regex helpers:
  - `sanitize_whitespace`: replace `(?:[^\S\r\n]|\u200b)` with `" "`, then replace ` *(?:\r\n?|\n)` with `"\n"`.
  - `fixed_newlines`: replace `(?: *\n){2}(?: *\n)+` with `"\n\n"`, then `.strip()`.
  - `fixed_spaces`: replace ` +` with `" "`, then `.strip()`.
  - `clean_text(t) = fixed_spaces(fixed_newlines(sanitize_whitespace(t)))`.
- Root elements:
  - `head = .p-body-header`
  - `post = .message-threadStarterPost` OR `.message--article`
  - If either is missing: inspect `.p-header-logo img[alt]` starting with `"F95zone"` to distinguish `"Thread structure missing"` vs `"Not an F95zone payload"`.
- Before building `plain` text from `post article`:
  1. Clear the inner text of every `.bbCodeSpoiler-button > span > span` so spoiler button labels (`Spoiler`) do not pollute plain-text attributes.
  2. Insert `"\n"` after every `<div>` inside `post` so line breaks match browser rendering.
  3. Extract `plain = sanitize_whitespace(post.find("article").get_text())`.

**Field Extraction Rules:**

1. **`name` (Title):**
   - Concatenate children of `.p-title-value` excluding elements with classes `p-title-prefix`, `labelLink`, `label-append`.
   - Strip trailing bracketed tags/versions via regex: `^\s*(.*?)(?:\s*\[.*?\]\s*)*$` (with `DOTALL`), replace `\n` with `" "`, run `sanitize_whitespace` + `fixed_spaces`.

2. **`version` Resolution Chain:**
   - First check `thread_version` in OP plain text using `get_game_attr("version", "mod version", "game version")`:
     - Regex: `^ *<name> *(?: *\n? *:|: *\n? *) *(.*)` (`MULTILINE | IGNORECASE`).
   - Fallback if empty: extract first bracket group after title in HTML `<title>` via `(?:\[.+?\] - )*.+?\[(.+?)\]`.
   - In `indexer/scraper.py`: `checker.php` version **overrides** parsed `thread_version` whenever present and not `"Unknown"`. If neither produces a version, client normalizes empty string to `"N/A"`.
   - *TTL hint from `cache.py`*: threads tracked by `checker.php` get standard `7 day` cache TTL; untracked threads that only yielded `thread_version` get `2 day` (`SHORT_TTL`) so unpromoted updates are spotted sooner.

3. **`developer` Cleanup Pipeline:**
   - Match `get_game_attr` across 14 labels in order: `"developer/publisher"`, `"developer & publisher"`, `"developer / publisher"`, `"original developer"`, `"developers"`, `"developer"`, `"publisher"`, `"artist"`, `"animator"`, `"producer"`, `"modder"`, `"remake by"`, `"game by"`, `"posted by"`.
   - Split and take index `[0]` for each of 14 `developer_chop_separators`: `"is creating"`, `"and h"`, `" - "`, `" – "`, `" | "`, `" ｜ "`, `" \\ "`, `" / "`, `"'s "`, `": "`, `", "`, `"("`, `"["`, `"{"`.
   - Loop removing all 63 `developer_remove_patterns` (`patreon`, `ko-?fi`, `itch(\.io)?`, `subscr?ibe?star`, `discord`, `https?://\S*`, etc. — see `common/parser.py:483-547`) until string stabilizes, **reverting to `prev_developer` if removal makes the string empty**.
   - Finally strip leading/trailing chars in set `"-–|｜\\/':,)(][}{ "` and collapse spaces.

4. **`type` (30 values) and `status` (7 values) via Prefix Matching:**
   - `game_has_prefixes()` checks `head` for `<span>` with exact text matching F95zone thread prefix badges.
   - **Priority order matters** (`Cheat Mod` before `Mod`, `CG`/`Manga`/`Comics`/`Pinup`, then engines `ADRIFT`..`Wolf RPG`, fallback `Type.Misc`).
   - *Quirk noticed in `_reference-repo`*: `common/parser.py:283` references `Type.READ_ME` while `common/structs.py:866` defines `README = 12`. In our TypeScript port, match `"READ ME"` prefix cleanly to enum member `Type.README` (`id: 12`).
   - `Status` checks prefixes `"Completed"` (2), `"Onhold"` (3 -> `OnHold`), `"Abandoned"` (4), else `"Normal"` (1). Client also uses `Unchecked` (5), `Custom` (6), `Unknown` (7).

   **Complete `Type` Lookup (`common/structs.py:842-873` + `common/parser.py:275-334`):**
   - `Games`: `ADRIFT`(2), `Flash`(4), `Godot`(31), `HTML`(5), `Java`(6), `Others`(9), `QSP`(10), `RAGS`(11), `RPGM`(13), `RenPy`(14, prefix `"Ren'Py"`), `Tads`(16), `Unity`(19), `Unreal_Eng`(20, prefix `"Unreal Engine"`), `WebGL`(21), `Wolf_RPG`(22, prefix `"Wolf RPG"`).
   - `Animations`: `GIF`(25), `Video`(29).
   - `Comics`: `CG`(30), `Comics`(24), `Manga`(26), `Pinup`(27).
   - `Misc`: `Cheat_Mod`(3, prefix `"Cheat Mod"`), `Mod`(8), `README`(12, prefix `"READ ME"`), `Request`(15), `Tool`(17), `Tutorial`(18), `Misc`(1), `Unchecked`(23), `Unknown`(32).

5. **`last_updated` & `datestamp()` Normalization:**
   - Try OP attributes `"thread updated"`, `"updated"`, `"release date"` (replace `/` with `-`, parse ISO date).
   - Fallback to `.message-lastEdit time[data-timestamp]` or `.message-attribution-main time[data-timestamp]`.
   - Normalize via `datestamp(ts)`: convert Unix timestamp to **12:00:00 UTC** of that UTC calendar date (`Date.UTC(y, m, d, 12, 0, 0) / 1000`).
   - In `scraper.py`: if matched in Latest Updates search and (`last_updated > now` OR `datestamp(update.ts) > last_updated`), adopt `datestamp(update.ts)`.
   - In `cache.py`: if `version` changed from previously cached `version`, overwrite `last_updated = datestamp(now)`; otherwise preserve previous `last_updated`.

6. **`score` & `votes`:**
   - First check `<script type="application/ld+json">` for `@context == "http://schema.org/"` and `aggregateRating` (`ratingValue`, `ratingCount`).
   - Fallback: `.f95rv-banner-ringValue` (float) and `.f95rv-banner-count` matching `([\d,]+)\s*reviews`.
   - In `scraper.py`: if matched in Latest Updates, `score = round(update.rating, 1)`.
   - Weighted Bayesian rating in `modules/utils.py`: `((votes * score) + 100 * 0) / (votes + 100)`.

7. **`description` & `changelog` (Dual HTML + Regex Extraction):**
   - `description`: labels `"overview"`, `"story"`.
   - `changelog`: labels `"changelog"`, `"change-log"`, `"change log"`.
   - Runs **both**:
     1. Plain-text regex capture up to 7 blank lines, 2 consecutive `Key:` headers, or `Download` section.
     2. DOM sibling walk starting after the matching label node until hitting `.bbWrapper`, `article`, a `<b>` tag, or an inline `style*="center"` element.
   - Picks the longer result, with a cross-leak guard ensuring `description` does not accidentally swallow `changelog` when `regex` overruns into `changelog`.

8. **`tags` & `unknown_tags`:**
   - Iterates children of `.p-body-header .js-tagList` with `href` containing `"/tags/"`.
   - Extracts slug (`href.replace("/tags/", "").strip("/")`). Known slugs map to the canonical **154 `Tag` enum entries** (`common/structs.py:399-554`, numeric IDs `1..154` with `unknown = 154`), sorted alphabetically by tag name; unrecognized slugs are stored in `unknown_tags` and flag `unknown_tags_flag = true` on client.
   - Note: `tags-diff.py` compares the `Tag` enum against live `latestUpdates.tags` from `/sam/latest_alpha/`.

9. **`image_url` (Cover) & `previews_urls` (Gallery):**
   - `attachment(url)` helper: rewrites `https://preview.f95zone.to/<path>` -> `https://attachments.f95zone.to/<path>` and strips `?h=...` query hashes from `attachments.f95zone.to` URLs.
   - Cover: first `div[data-src]` inside `.bbWrapper` with `data-src.length > "https://".length`, else `"missing"`. Overridden by Latest Updates `update.cover` if valid.
   - Previews: all `.js-lbImage` `href` attributes starting with `https://attachments.f95zone.to/` (deduplicated, excluding `image_url`), plus `update.screens` from Latest Updates.
   - Local disk storage in reference (`common/structs.py:1051-1166`):
     - Cover cached as `<images_dir>/<thread_id>.<ext>` (extension detected via image bytes).
     - Previews cached lazily under `<images_dir>/previews/<thread_id>/<sha1(url)>.<ext>`.
     - On `i.imgur.com` 4xx -> URL status set to `"blocked"`; other 4xx / dead DNS -> `"dead"`.

10. **`downloads` Parsing & Link Masking:**
    - Locates `"downloads"` / `"download"` node inside `post` and walks siblings until `<img>`, `<video>`, or `.bbWrapper`/`article` boundary, skipping `.u-hidden`.
    - Groups links `.link[href]` under preceding section labels into `Array<[sectionLabel, Array<[mirrorLabel, urlOrXpath]>]>`.
    - **Why reference code converts URLs to XPath (`common/parser.py:171-194`):** Because `api.f95checker.dev` is a *public* cache API, WillyJL redacted external URLs and user-tied `/dl/` masked links into XPath expressions (`//a[starts-with(@href,'...') and starts-with(text(),'...')][N]`) so the desktop client opens the thread in PyQt6 WebView and clicks the link using the user's own session (`callbacks.py:675-731`).
    - **Target implication:** Because our indexer runs **100% locally** on the user's machine, we can store actual parsed URLs (`href`) in SQLite (supporting direct opening in browser, plus recognizing `/dl/` masked links so the user opens them in their authenticated browser).

### 4.2 Reviews Parser (`common/parser.py:reviews`)

- Parses `/threads/{id}/reviews/` inside `.p-body-pageContent`.
- Extracts `total` from `.f95rv-banner-count` regex `([\d,]+)\s*reviews`.
- Iterates `.f95rv-cards .f95rv-card`:
  - `user`: `data-author` attribute
  - `score`: `parseFloat(.f95rv-stars[aria-label].split(" ")[0])`
  - `message`: `.bbWrapper .bbWrapper` text stripped of invisible Unicode (`\u2063`, `\u200c`, `\u200b`, `\u2064`)
  - `likes`: `parseInt(.f95rv-vote.text.split(" ").at(-1))`
  - `timestamp`: `parseInt(.u-dt[data-timestamp])`

### 4.3 Latest Updates Search Query Sanitizer (`latest_updates_search_sanitize_query`)

Both `indexer/f95zone.py` and `modules/api.py` implement the identical query sanitizer required by F95zone's Redis search backend:
1. Replace `’s ` / `'s ` with `" "`.
2. Transliterate non-ASCII to `?` (`ascii` replace).
3. Replace `\.+ | \.+` with `" "`, and replace each character in `?&/':;-.+!~(),*` with `" "`.
4. Collapse whitespace and split on `" "`.
5. Remove any token matching (case-insensitive) the **33 stopwords**: `a, is, the, an, and, are, as, at, be, but, by, for, if, in, into, it, no, not, of, on, or, such, that, their, then, there, these, they, this, to, was, will, with`.
6. Greedily append words separated by `" "` up to `30` characters max; if a word overflows `30`, slice it to fit remaining length and append **only if** `slice.length > 3` and `slice.trim().toLowerCase()` is not a stopword.

### 4.4 Watched, Bookmarks & Thread URL Extraction

- Regex for extracting thread IDs everywhere (`modules/utils.py:242-248`):
  `/threads\/(?:([^./]*)\.)?(\d+)/g` -> `{ slugTitle, id }`.
- Watched & Bookmark HTML selectors (`modules/api.py:892-975`):
  - `/watched/threads?tab=new&src=watched&hide_seen=0&page={p}` -> `.p-body-pageContent .f95wg-row` -> `.f95wg-row-title a[href]`
  - `/watched/threads?tab=games&unread=0&page={p}` & `tab=other` -> `.structItemContainer .structItem-title[uix-href]`
  - `/watched/threads?tab=new&src=bookmarked&hide_seen=0&page={p}` -> `.f95wg-row .f95wg-row-title a[href]`
  - `/watched/threads?tab=bookmarks&page={p}` -> `.listPlain .contentRow-title a[href]`

### 4.5 Change Detection, `updated` State Machine & Timeline Events

- `Game.updated` (`common/structs.py:1038`, `modules/api.py:1138-1147`):
  - Tracked `installed` and `finished` store **version strings** (not booleans), enabling 3-state semantics: `installed === version` (up to date), `installed && installed !== version` (update available), `""` (not installed).
  - When `version !== old_version` on a non-`Unchecked`, non-`archived` game, `updated = true` and timeline event `ChangedVersion` is emitted.
- `LAST_CHANGE_ELIGIBLE_FIELDS` (`indexer/cache.py:21-40`): `name`, `version`, `developer`, `type`, `status`, `last_updated`, `score`, `votes`, `description`, `changelog`, `tags`, `unknown_tags`, `image_url`, `previews_urls`, `downloads`, `reviews_total`, `reviews`, `INDEX_ERROR`.
- `TimelineEventType` (`15` event types in `common/structs.py:636-652`): `GameAdded`, `GameLaunched`, `GameFinished`, `GameInstalled`, `ChangedName`, `ChangedStatus`, `ChangedVersion`, `ChangedDeveloper`, `ChangedType`, `TagsAdded`, `TagsRemoved`, `ScoreIncreased`, `ScoreDecreased`, `RecheckExpired`, `RecheckUserReq`.

---

## 5. Browser Extension & Local RPC Analysis

### 5.1 DOM Injection & Tag Highlighting (`browser/chrome/extension.js` & `browser/firefox/extension.js`)

1. Triggers on `webNavigation.onCompleted` for `hostSuffix: 'f95zone.to'`.
2. Injects `@font-face` `"MDI Custom"` pointing to `fonts/mdi-webfont.ttf` via `web_accessible_resources`.
3. Scans `a[href*="/threads/"]` and filters out non-game links via `isValidHrefElem()`:
   - Excludes `/reply\?/`, `/page-/`, `/more\?k=[0-9a-f]+$/`, `.pageNav`, `.pageNav-page`, `ul.message-attribution-opposite`, links inside `.message-threadStarterPost` pointing to the same `pageId`, `.button`, `.tabs-tab`, `.u-concealed`, and `/\/reviews\/(?:$|\?)/`.
4. Places `.f95checker-library-icons` badges:
   - Tile/carousel images (`.resource-tile_link` or `.es-slides`): absolute top-left badge (`28px`, `#262626` bg, optional `boxShadow` glow).
   - Search results: inserted after last `span.label-append` or before `.link--internal` (skipping `img[data-src]` thumbnails).
   - Thread header: inserted inside `.p-title-value` before the last child node.
5. Tag highlighting:
   - Colors: `1` (Positive `#006600`), `2` (Negative `#990000`), `3` (Critical `#000000`), white text, `1px solid #ffffff55` border.
   - Targets: `div.resource-tile-hover div.resource-tile_tags span` (Latest Updates cards, observed via `MutationObserver` on `div.resource-tile_body`) and `a.tagItem` (Thread headers).
   - Dynamic pagination on Latest Updates observed via `MutationObserver` on `#latest-page_items-wrap`.
6. Entrypoints to add games: toolbar icon click (`action.onClicked` / `browserAction.onClicked`), context menu on thread page, context menu on thread link.

### 5.2 Reference Extension Limitations Fixed in Our WXT Port

| Reference Flaw | Target WXT Fix |
|---|---|
| Top-level `chrome.contextMenus.create(...)` throws duplicate ID errors on MV3 service worker restarts. | Register inside `browser.runtime.onInstalled` after `await browser.contextMenus.removeAll()`. |
| `setInterval(getData, 5 * 60 * 1000)` + RAM globals (`games`, `settings`) wipe when MV3 SW sleeps. | Persist synced library index/settings in `browser.storage.local` and schedule refreshes via `browser.alarms`. |
| Unauthenticated RPC on `127.0.0.1:57095` allows any allowed origin to spam `/games/add` or read notes. | Enforce `X-Pairing-Token` header on all extension endpoints; store token in `browser.storage.local`. |
| No cookie/session extraction in extension (relied on PyQt6 WebView). | Use `browser.cookies.getAll({ domain: "f95zone.to" })` + `navigator.userAgent` in background worker to sync login & Cloudflare clearance cookies securely. |
| `alert(...)` popups on RPC error or badge click. | Replace with extension popup status, badge indicator, and non-blocking in-page toast using `textContent`. |

---

## 6. Reference Logic -> Target TypeScript/Node.js Implementation Mapping

### 6.1 Module & Library Mapping

| Reference Component | Target Package / Path | Target Tech / Implementation |
|---|---|---|
| `common/structs.py` (`Type`, `Status`, `Tag`, DTOs) | `packages/shared/src/` | Zod schemas, TypeScript types, canonical `Type`/`Status`/`Tag` metadata tables. |
| `common/parser.py` (`thread`, `reviews`, `attachment`, `datestamp`) | `apps/server/src/indexer/parser.ts` (pure TS) | `cheerio` DOM parsing + strict TS regex ports with unit test suite. |
| `indexer/f95zone.py` (`check_error`, `latest_updates_search_sanitize_query`) | `apps/server/src/indexer/f95zone.ts` | Error classifier, query sanitizer, URL builders, constants. |
| `indexer/scraper.py` + `indexer/watcher.py` + `modules/api.py` (image download) | `apps/server/src/worker/indexer.worker.ts` | Node.js `worker_threads` running `p-queue` + `undici`, executing thread scrapes, `checker.php` batch checks, optional Latest Updates polling, and downloading covers to `data/covers/`. |
| `modules/rpc_thread.py` + `indexer/threads.py` | `apps/server/src/routes/` | Fastify v5 API (`@fastify/cors`, `@fastify/static`, Pairing Token auth guard, SSE `/api/events`, `/covers/:file`, `/api/games/*`, `/api/accounts/*`, `/api/jobs/*`). |
| `modules/db.py` + `indexer/cache.py` (Redis) | `apps/server/src/db/` | `better-sqlite3` (`PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 5000`) + Drizzle ORM + programmatic `migrate()` + `node:crypto` AES-256-GCM cookie encryption. |
| `modules/gui.py` | `apps/web/src/` | React + Vite + Tailwind CSS + TanStack Query + `EventSource` SSE client. |
| `browser/chrome` + `browser/firefox` + `modules/webview.py` (cookies) | `apps/extension/` | WXT (Chrome MV3 & Firefox) with background cookie+UA sync, Pairing Token auth, safe DOM injection, and popup UI. |

### 6.2 Database Schema Mapping

Target SQLite database (`data/library.db`) unifies F95Checker's local library tables and F95Indexer's Redis cache into 4 core Drizzle tables (plus optional UI tables like `tabs`/`labels`/`timeline_events` as scope permits):

| Reference Storage | Target SQLite Table | Key Columns & Responsibilities |
|---|---|---|
| SQLite `games` (`modules/db.py`) | `games` | `id` (PK, positive F95 thread ID or negative custom ID), `custom`, `name`, `version`, `developer`, `type` (`Type` enum ID), `status` (`Status` enum ID), `url`, `installedVersion`, `finishedVersion`, `hasUpdate` (`updated`), `archived`, `rating` (personal), `notes`, `executablesJson`, `addedAtMs`, `lastUpdatedTsSec`, `lastCheckedAtMs`, `lastLaunchedAtMs`, `playtimeSec`, `coverFile` (cached filename in `data/covers/`). |
| Redis `thread:{id}` + extra `games` fields | `game_metadata` | `gameId` (FK -> `games.id` ON DELETE CASCADE, PK), `score`, `votes`, `description`, `changelog`, `tagsJson` (`Tag[]`), `unknownTagsJson` (`string[]`), `unknownTagsFlag`, `imageUrl`, `previewsUrlsJson`, `downloadsJson`, `reviewsTotal`, `reviewsJson`, `contentHash`, `lastError`, `nextRetryAtMs`, `expiresAtMs`, `updatedAtMs`. |
| SQLite `cookies` + `settings` (`rpdl_*`) | `accounts` | `id` (PK), `provider` (`"f95zone"` \| `"rpdl"`), `label`, `userAgent`, `encryptedPayload` (AES-256-GCM `"v1:<iv>:<tag>:<ct>"` holding `{ cookies, token, ... }`), `status` (`"active"` \| `"expired"` \| `"captcha_required"` \| `"unconfigured"`), `lastVerifiedAtMs`, `updatedAtMs`. |
| Ephemeral `globals.refresh_*` / `tasks` | `index_jobs` | `id` (UUID/PK), `kind` (`"single_thread"` \| `"bulk_refresh"` \| `"watchlist_import"` \| `"latest_updates_poll"`), `status` (`"queued"` \| `"running"` \| `"completed"` \| `"failed"` \| `"cancelled"`), `totalCount`, `processedCount`, `updatedCount`, `errorCount`, `payloadJson`, `errorSummary`, `createdAtMs`, `startedAtMs`, `finishedAtMs`. |

---

## 7. Edge Cases, Anti-Bot Quirks & Windows Standalone Constraints

1. **Cloudflare `cf_clearance` + `User-Agent` Coupling:** If `undici` uses a Node/bot `User-Agent` while sending a browser's `cf_clearance` cookie, Cloudflare immediately invalidates clearance and returns `"Just a moment..."` (`_cf_chl_opt`). Both cookies and `navigator.userAgent` MUST be synced together from the browser extension. We never attempt to bypass or solve CAPTCHAs programmatically; on `CLOUDFLARE_CAPTCHA`, indexing pauses/marks the job and prompts the user to visit `f95zone.to` in their browser so `cookies.onChanged` refreshes clearance.
2. **CDN Failover & Image Quirks (`modules/api.py:620-664`):**
   - `preview.f95zone.to` must be rewritten to `attachments.f95zone.to` and `?h=` stripped.
   - Disable redirects (`maxRedirections: 0`) on image downloads to avoid hitting attachment auth loops.
   - On connection failure to `attachments.f95zone.to`, retry `.com`, then `.ninja` (note: `.ninja` historically presented invalid TLS certs).
   - HTTP `4xx` on `i.imgur.com` maps to `"blocked"` rather than `"dead"`.
3. **Windows Networking & Filesystem:**
   - `modules/api.py:399` guards against Windows `OSError errno 121` (`ERROR_SEM_TIMEOUT`) on transient socket calls — retry transient network errors cleanly with bounded retries.
   - Always sanitize cover/game filenames with `path.basename` and `node:path` joins (`path.join(dataDir, "covers", ...)`), never hardcoded `/` paths.
4. **SQLite WAL + `worker_threads`:**
   - Main Fastify thread and indexer worker MUST open independent `better-sqlite3` connections with `journal_mode = WAL` and `busy_timeout = 5000`.
   - Never hold a SQLite transaction open across an `undici` HTTP request or disk cover write.
5. **Windows Native Addons (`Node v26.5.0` / `pnpm 11.15.1`):**
   - Configure `pnpm.onlyBuiltDependencies: ["better-sqlite3", "esbuild"]` in root `package.json` so `pnpm install` builds/unpacks `better_sqlite3.node`.
   - Standalone bundling scripts (`scripts/`) must keep `better-sqlite3` external (not inlined into a JS bundle) and ship the native `.node` addon + Drizzle SQL `migrations/` folder + `apps/web/dist` alongside the compiled `server` entrypoint.

---

## 8. Open Design Decisions for User Review (Before Phase 2 & Phase 3)

Before scaffolding the monorepo (Phase 2) and implementing the core stack (Phase 3), please confirm your preferences on these 4 architectural decisions discovered during reverse engineering:

1. **Metadata Indexing Source Strategy:**
   - **Option A (Recommended):** **Direct Local F95zone Scraping** in `worker_threads` (`checker.php` bulk version check + direct `/threads/{id}`, `/threads/{id}/reviews/`, and `latest_data.php` using the synced browser session), storing full raw download mirror URLs locally — with an optional settings fallback to `api.f95checker.dev` if Cloudflare blocks direct requests.
   - **Option B:** **Direct-Only** (never contact `api.f95checker.dev`).
   - **Option C:** **`api.f95checker.dev` Primary** (fast `/fast` + `/full/{id}` cache hits, though external download links are XPath-redacted rather than direct URLs).

2. **Extension Cookie & Session Sync Trigger:**
   - **Option A (Recommended):** **Automatic debounced sync** via `browser.cookies.onChanged` for `f95zone.to` once the extension is paired, plus a manual **"Sync Session Now"** button in the popup.
   - **Option B:** **Manual-only sync** (cookies are only read and sent when the user explicitly clicks Sync in the popup).

3. **Phase 3 MVP Feature Scope (Beyond Core Library, Indexer, SSE & Extension):**
   `_reference-repo` includes several secondary subsystems alongside core thread tracking. Which of these should be **included in Phase 3** vs. **deferred to a post-MVP phase**?
   - **(a) F95zone Watched / Bookmarks HTML Importer** (syncing the user's watched/bookmarked threads using their synced cookie session)
   - **(b) Local Executable Launcher & Playtime Tracker** (picking `.exe`/`.html`/URI and tracking process duration)
   - **(c) Custom Tabs, Labels & Timeline Events** (in addition to core `games`, `game_metadata`, `accounts`, `index_jobs`)
   - **(d) Donor DDL (`/sam/dddl.php`) & RPDL.net Torrent Search**
   - *(Recommended MVP: Core Library + Direct Indexer + Cover Cache + SSE + Extension Pairing/Cookie Sync/Badges/Tag Highlights + Watched/Bookmarks Importer; defer Launcher/Playtime, Donor DDL, and RPDL to Phase 4 unless needed immediately.)*

4. **Default Local Server Port:**
   - **Option A (Recommended):** `57095` (configurable via `PORT` env var) — matches F95Checker's default port so users migrating recognize it immediately.
   - **Option B:** `57096` (or `38475`) so this app can run side-by-side with an open instance of the Python F95Checker without port collision.
