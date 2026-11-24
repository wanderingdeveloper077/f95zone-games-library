# Game Library Manager — Workspace Rules

## 1. Mission & Runtime Constraints

- This project is a **standalone, zero-dependency Windows desktop-companion web application** packaged as a **TypeScript monorepo** (`pnpm workspaces` + `Turborepo`).
- **Zero external services at runtime:** Do NOT introduce Docker, PostgreSQL, Redis, Python, or external message brokers. Persistence uses local **SQLite** (`better-sqlite3` + Drizzle ORM) and background work runs inside Node.js **`worker_threads`** using **`p-queue`** and **`undici`**.
- **Monorepo Layout:**
  - `apps/extension` — WXT cross-browser extension (Chrome MV3 & Firefox)
  - `apps/web` — React + Vite + Tailwind CSS + TanStack Query UI
  - `apps/server` — Fastify API + static SPA host + SSE stream + `worker_threads` indexer + SQLite
  - `packages/shared` — Single source of truth for DTOs, enums, constants, and Zod validation schemas
  - `docs/` — Reverse-engineering specification & architecture docs
  - `scripts/` — Windows build and standalone packaging scripts (`.ps1` / `.bat`)
  - `data/` — Git-ignored runtime state (`library.db`, cover cache in `data/covers/`, local keyfile)

## 2. TypeScript & Shared Contracts

- Strict TypeScript is mandatory across every package (`"strict": true`, `"noUncheckedIndexedAccess": true`). Avoid `any` and unsafe type assertions.
- `@game-library/shared` is the **single source of truth** for API payloads, SSE event envelopes, database/UI enums (`Type`, `Status`, `Tag`), and Zod schemas. Never duplicate DTO shapes across `server`, `web`, and `extension`.

## 3. Cross-Platform Path & OS Discipline

- Always build filesystem paths with `node:path` (`path.join`, `path.resolve`, `path.basename`) or `import.meta.url` / `fileURLToPath`. Never hardcode `/` or `\` path separators or POSIX-only shell commands in scripts or server code.
- Windows runtime targets Node.js directly: ensure native addons (`better-sqlite3`) and ESM/CJS resolution work inside standalone bundled builds.

## 4. SQLite Concurrency & Persistence Rules

- Every SQLite connection (both main API thread and `worker_threads`) MUST initialize:
  - `PRAGMA journal_mode = WAL;`
  - `PRAGMA busy_timeout = 5000;`
  - `PRAGMA foreign_keys = ON;`
- Never pass a `better-sqlite3` instance across `worker_threads` boundaries; open a dedicated connection with WAL + `busy_timeout` inside the worker and keep write transactions short.

## 5. Security & Anti-Bot Boundaries

- **Localhost binding:** Fastify MUST bind exclusively to `127.0.0.1`. Never bind to `0.0.0.0`.
- **CORS:** Allow only `chrome-extension://`, `moz-extension://`, and the local Fastify origin (`http://127.0.0.1:<PORT>` / `http://localhost:<PORT>`).
- **Pairing Token:** All extension-to-server endpoints MUST validate the local Pairing Token (`X-Pairing-Token`) using constant-time comparison (`crypto.timingSafeEqual`).
- **Encryption at rest:** Encrypt extracted browser cookies, session tokens, and credentials with native `node:crypto` **AES-256-GCM** (unique random IV + auth tag) before persisting to SQLite. Never log plaintext cookies, tokens, or pairing secrets.
- **No anti-bot bypass:** Never attempt to solve, spoof, or bypass Cloudflare CAPTCHAs or Turnstile gates programmatically. If a Cloudflare challenge occurs, surface `CLOUDFLARE_CAPTCHA` status and rely strictly on the user refreshing their normal browser session and syncing via the extension.

## 6. Reference Repository Policy

- `_reference-repo/` is read-only reverse-engineering reference material.
- NEVER edit, format, or delete files inside `_reference-repo/`.
- Keep `_reference-repo/` git-ignored and excluded from `pnpm-workspace.yaml` and `tsconfig.json`.

## 7. Domain Skills

Activate the matching workspace skill under `.agent/skills/` before working in that domain:
- `wxt-cross-browser-extension` — Extension architecture, MV3/Firefox manifests, cookie sync, and safe DOM injection.
- `drizzle-sqlite-windows` — SQLite WAL setup, Drizzle schemas/migrations, worker DB access, AES-256-GCM encryption, and Windows `better-sqlite3` builds.
- `fastify-sse-monorepo` — Fastify v5 plugins, Pairing Token auth, static SPA/cover serving, SSE lifecycle, and Turborepo config.
- `python-to-typescript-porting` — Porting `_reference-repo` parsers, sanitizers, rate-limiters, and state semantics into strict TypeScript.
