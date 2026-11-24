---
name: wxt-cross-browser-extension
description: >-
  Guides WXT cross-browser extension development targeting Chrome MV3 and Firefox,
  including manifest configuration, service worker lifecycle safety, cookie and
  User-Agent extraction, Pairing Token HTTP authentication, and safe DOM injection.
  Use when creating, editing, or debugging files inside apps/extension.
---

# WXT Cross-Browser Extension Development

Use this skill whenever working on `apps/extension` to ensure Chrome (Manifest V3) and Firefox parity without MV3 lifecycle bugs or security leaks.

## 1. WXT Project Layout

```text
apps/extension/
├── wxt.config.ts
├── entrypoints/
│   ├── background.ts        # Service worker (Chrome) / background script (Firefox)
│   ├── content.ts           # F95zone DOM enhancer (library badges + tag highlights)
│   └── popup/               # Extension popup UI (pairing, sync status, quick actions)
│       ├── index.html
│       └── main.tsx
├── lib/
│   ├── api.ts               # Typed 127.0.0.1 client (background-only)
│   ├── cookies.ts           # browser.cookies extraction + UA capture (background-only)
│   └── messaging.ts         # Typed runtime messages between popup/content/background
└── public/                  # Icons and bundled fonts (e.g. MDI webfont)
```

## 2. Dual-Target Manifest (`wxt.config.ts`)

- Build targets:
  - Chrome MV3: `wxt build` (`chrome-mv3`)
  - Firefox: `wxt build -b firefox` (`firefox-mv2` or `firefox-mv3`—prefer explicit manifest hooks per browser target).
- Configure `manifest` as a function `({ browser }) => ({ ... })` in `wxt.config.ts`:
  - **Permissions:** `["cookies", "storage", "activeTab", "contextMenus", "scripting", "alarms"]`.
  - **Host permissions:** `["*://*.f95zone.to/*", "http://127.0.0.1/*"]` (in Firefox MV2, WXT automatically maps `host_permissions` into `permissions` when targeting MV2, or verify generated `manifest.json`).
  - **Firefox Gecko ID:** Set `browser_specific_settings: { gecko: { id: "...", strict_min_version: "109.0" } }` when `browser === "firefox"` so `storage` and `cookies` APIs work reliably.
  - **Web Accessible Resources:** Declare bundled font/icon assets scoped strictly to `matches: ["https://f95zone.to/*", "https://*.f95zone.to/*"]`.
  - **Action API:** Use WXT's unified `browser.action` / `wxt/browser` wrapper (`action` in MV3, `browser_action` in Firefox MV2 if MV2 is emitted).

## 3. MV3 Service Worker Lifecycle Rules

Chrome MV3 terminates the background service worker after ~30s of inactivity. Never copy the reference extension's top-level `setInterval` or bare `contextMenus.create()` calls.

1. **No reliance on global mutable RAM state:** Persist pairing token, server port, cached library IDs/tags, and last-sync timestamp in `browser.storage.local` (or `wxt/storage` `storage.defineItem`). Read from storage on wakeup.
2. **Alarms instead of `setInterval`:** Register periodic refresh tasks with `browser.alarms.create("sync-library", { periodInMinutes: 5 })` inside `browser.runtime.onInstalled` / `onStartup`, and handle `browser.alarms.onAlarm` at the top level.
3. **Context Menus inside `onInstalled`:**
   ```ts
   browser.runtime.onInstalled.addListener(async () => {
     await browser.contextMenus.removeAll();
     browser.contextMenus.create({
       id: "add-page-to-library",
       title: "Add this page to Game Library",
       contexts: ["page"],
       documentUrlPatterns: ["*://*.f95zone.to/threads/*"],
     });
     browser.contextMenus.create({
       id: "add-link-to-library",
       title: "Add this link to Game Library",
       contexts: ["link"],
       targetUrlPatterns: ["*://*.f95zone.to/threads/*"],
     });
   });
   ```
4. **Top-level event listeners:** Register `onClicked`, `onMessage`, `onAlarm`, and `cookies.onChanged` synchronously at module top-level inside `defineBackground(() => { ... })`.

## 4. Cookie & User-Agent Extraction

- Use `browser.cookies.getAll({ domain: "f95zone.to" })` in the background script (which reads `HttpOnly` cookies such as `xf_user`, `xf_tfa_trust`, `xf_session`, and `cf_clearance`—unreachable from content scripts).
- Always pair extracted cookies with `navigator.userAgent` from the browser context, because Cloudflare binds `cf_clearance` to the exact TLS/UA fingerprint.
- Serialize cookies cleanly (`name`, `value`, `domain`, `path`, `expiresAt`, `httpOnly`, `secure`) matching the Zod schema in `@game-library/shared`, and transmit only over `http://127.0.0.1:<PORT>` with `X-Pairing-Token`.
- Debounce `browser.cookies.onChanged` updates (watching `xf_user`, `xf_tfa_trust`, `cf_clearance`, `xf_session` on `f95zone.to`) so rapid login redirects trigger a single sync request.

## 5. Pairing Token & Local Server Communication

- Store `serverPort` (default configurable) and `pairingToken` in `browser.storage.local`.
- Send `X-Pairing-Token: <token>` and `Content-Type: application/json` on every authenticated request to `http://127.0.0.1:<PORT>`.
- Never use `window.alert()` in background or content scripts on network/401 failures: update extension badge text/color (`ERR` / `PAIR`), store last error in `browser.storage.local` for the popup, or show a non-blocking toast inside the content script.

## 6. Safe DOM Injection on F95zone Pages

- Match `*://*.f95zone.to/*` in `entrypoints/content.ts`.
- Request cached library index (`id`, `tabIcon`, `tabColor`, `notes`) and tag highlight preferences from the background script via `browser.runtime.sendMessage`.
- Remove previously injected `.gl-library-badge` elements before re-injecting so updates are idempotent.
- Observe dynamic pagination/hover updates using scoped `MutationObserver`s on `#latest-page_items-wrap` (`attributes: true, childList: true`) and `div.resource-tile_body` rather than `document.body` subtree observers.
- Use `document.createElement` and `.textContent` for tooltips/notes—never `innerHTML`.

## 7. Verification Steps

1. Run `pnpm --filter @game-library/extension typecheck` (or `wxt prepare && tsc --noEmit`).
2. Build both targets and verify emitted manifests/entrypoints:
   - `pnpm --filter @game-library/extension build` (Chrome MV3 under `.output/chrome-mv3/`)
   - `pnpm --filter @game-library/extension build:firefox` (Firefox under `.output/firefox-mv2/` or `.output/firefox-mv3/`)
3. Confirm no `chrome.*` hardcoding remains without `wxt/browser` abstraction and no `innerHTML` sinks exist in content scripts.
