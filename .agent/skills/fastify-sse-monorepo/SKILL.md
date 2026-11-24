---
name: fastify-sse-monorepo
description: >-
  Guides Fastify v5 API design, localhost CORS and Private Network Access headers,
  Pairing Token authentication, safe static SPA and cover serving, Server-Sent Events
  streaming from worker_threads, and pnpm/Turborepo workspace configuration. Use when
  working on apps/server, apps/web static integration, or monorepo tooling.
---

# Fastify + SSE + TypeScript Monorepo Patterns

Use this skill whenever configuring root Turborepo/pnpm settings or implementing Fastify routes, auth middleware, SSE streams, and static asset hosting in `apps/server`.

## 1. Monorepo & TypeScript Configuration

- `pnpm-workspace.yaml`: include `apps/*` and `packages/*`; explicitly exclude `_reference-repo` (never place it under `apps/` or `packages/`).
- `tsconfig.base.json`: enable `strict: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: "bundler"` (or `"NodeNext"` for pure ESM Node server—ensure consistent interop with `apps/server`, `apps/web`, and `apps/extension`), `skipLibCheck: true`, `resolveJsonModule: true`.
- `turbo.json`: define `build` with `"dependsOn": ["^build"]` and `"outputs": ["dist/**", ".output/**"]`; define `typecheck` with `"dependsOn": ["^build"]`; configure `dev` with `"cache": false, "persistent": true`.
- Workspace imports use `"@game-library/shared": "workspace:*"`. `@game-library/shared` must compile cleanly (or export clean TS/ESM entrypoints built before downstream `server`, `web`, `extension`).

## 2. Fastify Server Bootstrap, Host Binding & CORS

- **Host binding:** Always call `fastify.listen({ host: "127.0.0.1", port })`. Never expose on `0.0.0.0`.
- **CORS (`@fastify/cors`):**
  - Allow origins matching `/^(chrome-extension|moz-extension):\/\/.+/` plus local UI origin (`http://127.0.0.1:<PORT>`, `http://localhost:<PORT>`, and Vite dev origin `http://127.0.0.1:5173` / `http://localhost:5173` only when `NODE_ENV !== "production"`).
  - Allow methods `GET, POST, PATCH, PUT, DELETE, OPTIONS` and headers `Content-Type, X-Pairing-Token, X-Requested-With`.
  - **Chrome Private Network Access (PNA):** Handle preflight requests carrying `Access-Control-Request-Private-Network: true` by setting `Access-Control-Allow-Private-Network: true` in an `onSend` / `onRequest` hook.

## 3. Pairing Token Security Pattern

- Generate a 32-byte random pairing secret (`crypto.randomBytes(32).toString("hex")`) and persist it (or its hash) locally in `data/` so pairings survive server restarts, with an explicit "Rotate Token" action.
- **Bootstrap pairing flow:**
  1. Local web UI (`http://127.0.0.1:<PORT>`, same-origin only) displays the Pairing Token or generates a short-lived one-time pairing code (`POST /api/pairing/code`, TTL 120s).
  2. Extension submits the code (`POST /api/pairing/exchange`) or user pastes token in extension popup -> extension receives and persists `pairingToken` in `browser.storage.local`.
  3. All extension routes (`/api/extension/*`, `/api/accounts/cookies`, `/api/games` mutations from extension) require `X-Pairing-Token` validated via `crypto.timingSafeEqual` on equal-length UTF-8 buffers.
- Same-origin local UI routes must still reject arbitrary third-party web `Origin` headers (block CSRF via strict origin allowlist).

## 4. Static Frontend & Safe Cover Serving

- **SPA (`@fastify/static`):** Serve `apps/web/dist` at `/` with `wildcard: false`. Register `setNotFoundHandler` to serve `index.html` ONLY for `GET` requests whose `url` does not start with `/api/` or `/covers/` (return JSON `404` for unknown `/api/*` routes).
- **Cached Covers (`/covers/:filename`):**
  - Validate filename strictly against `/^[a-zA-Z0-9._-]+$/` (and reject `..`).
  - Resolve target path via `path.resolve(coversDir, filename)` and verify `resolved.startsWith(path.resolve(coversDir) + path.sep)` before streaming.
  - Set `Cache-Control: public, max-age=86400` and appropriate `Content-Type` (`image/jpeg`, `image/png`, `image/webp`, `image/gif`).

## 5. Server-Sent Events (`GET /api/events`)

- Keep SSE client management in a dedicated broadcaster module fed by `worker_threads` events.
- Implementation rules:
  1. Call `reply.hijack()` before writing directly to `reply.raw`.
  2. Write status `200` and headers:
     - `Content-Type: text/event-stream; charset=utf-8`
     - `Cache-Control: no-cache, no-transform`
     - `Connection: keep-alive`
     - `X-Accel-Buffering: no`
     - Matching CORS header if `Origin` is present and allowed.
  3. Send an initial `connected` event and a `: keepalive\n\n` heartbeat every 25 seconds.
  4. Format events cleanly: `id: <seq>\nevent: <eventName>\ndata: <json>\n\n`.
  5. Remove client and clear heartbeat timer on `request.raw.on("close", ...)` and `reply.raw.on("error", ...)`.

## 6. Verification Steps

1. Test Fastify routes using `app.inject()` for:
   - CORS preflight (`OPTIONS`) for `chrome-extension://` and `moz-extension://` + rejection of disallowed external origins.
   - Pairing Token enforcement (`401` on missing/wrong `X-Pairing-Token`, `200` on valid token).
   - Path-traversal rejection on `/covers/../library.db`.
   - `/api/*` 404 returning JSON instead of `index.html`.
2. Verify SSE endpoint emits initial frame, forwards worker events, and cleans up timers/subscribers on client abort.
3. Run `pnpm build` across the workspace via Turborepo.
