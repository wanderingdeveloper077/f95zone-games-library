# Changelog

All notable changes to the **Game Library Manager** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Covers commits `03b66d5` through `1bb95a8` (2026-11-25) on `main`._

### Added

- **Auto-register extracted games in `standalone/games`**:
  - Added `gamesDir` resolution (`standalone/games` on Windows, Application Support on macOS) in `apps/server/src/config.ts`.
  - Added `GamesDirectoryWatcher` (`apps/server/src/services/gamesDirectoryWatcher.ts`) wired into `apps/server/src/app.ts` to detect newly extracted folders, match them by folder name or metadata to existing library entries, ignore archives/incomplete extractions (`.zip`, `.rar`, `.part`, etc.), avoid duplicate registrations, and handle unmatched folders safely.
  - Added `findBestExecutableInFolder` in `apps/server/src/services/gameLauncher.ts` to resolve and launch the best executable inside registered game folders.
- **Automatic installed status for games with paths**:
  - Automatically set `installedVersion` when executable/folder paths are registered via `GamesDirectoryWatcher`, added via `GamesService.updateGame` (`apps/server/src/services/gamesService.ts`), or backfilled on startup in `apps/server/src/db/index.ts`.
- **Sleep & Auto-Wake server lifecycle**:
  - Added `createSleepWakeServer` HTTP gateway (`apps/server/src/runtime/sleepWakeServer.ts`) and bootstrapped the server through it (`apps/server/src/index.ts`) so the Fastify server suspends gracefully when dashboard tabs close (after active index jobs finish) and wakes automatically on the next request.
  - Added `onClientCountChange` and `onBroadcast` observer hooks to `SseHub` (`apps/server/src/sse/hub.ts`) and `hasActiveJobs` / `getExtensionBootstrapSnapshot` wiring in `apps/server/src/app.ts`.
  - Updated `useSseEvents` (`apps/web/src/hooks/useSseEvents.ts`) to close `EventSource` on `pagehide`, reconnect on bfcache `pageshow`, and preserve loaded page counts during SSE refreshes.
- **Infinite scroll & server-side pagination**:
  - Added `limit`/`offset` pagination to `listGamesPage` (`apps/server/src/db/queries.ts`), `GamesService.listPage`, and `GET /api/games` (`apps/server/src/routes/games.ts`).
  - Updated `apps/web/src/services/gamesService.ts`, `apps/web/src/store/slices/gamesSlice.ts` (`fetchMoreGamesThunk` with deduplication), `apps/web/src/hooks/useGameLibrary.ts`, and `apps/web/src/hooks/useInfiniteScroll.ts` (`IntersectionObserver`) to stream subsequent pages automatically inside `GameGrid` and `App.tsx`.
- **Small Grid view mode**:
  - Added compact `GameSmallCard` component (`apps/web/src/components/games/GameSmallCard.tsx`), integrated it into `GameGrid` (`apps/web/src/components/GameGrid.tsx`), added a `Small Grid` toggle in `FilterToolbar`, and persisted `LibraryViewMode` in `localStorage`.
- **Collapsible Advanced Filters accordion**:
  - Added `AdvancedFiltersPanel` (`apps/web/src/components/filters/AdvancedFiltersPanel.tsx`) under `FilterToolbar` containing **Status**, **Engine Types**, **Installed**, **Finished**, and searchable **Tags**, paired with an active filter count badge via `countActiveAdvancedFilters` (`apps/web/src/lib/gamePresentation.ts`).
  - Added backend query support for `tags`, `installed`, and `finished` on `GET /api/games` and `listGamesPage`.
- **Testing**:
  - Added unit and integration tests for `GamesDirectoryWatcher` & folder launching (`apps/server/src/__tests__/games-watcher.test.ts`), `SleepWakeServer` idle suspend & auto-wake (`apps/server/src/__tests__/sleep-wake.test.ts`), `GET /api/games` pagination & filters (`apps/server/src/__tests__/api.test.ts`), and `updateGame` auto-installed marking (`apps/server/src/__tests__/solid-services.test.ts`).
  - Added web tests for `small-grid` view mode & `fetchMoreGamesThunk` deduplication (`apps/web/src/store/__tests__/gamesSlice.test.ts`) and `countActiveAdvancedFilters` (`apps/web/src/lib/__tests__/solidArchitecture.test.ts`).

### Changed

- Made `FilterToolbar` (`apps/web/src/components/FilterToolbar.tsx`) sticky at `top: 0` with an opaque/blurred backdrop and updated `HeaderBar` (`apps/web/src/components/HeaderBar.tsx`) to be non-sticky so the filter bar docks cleanly at the top during scroll.
- Wired paginated `totalCount`, `hasMore`, `loadingMore`, and `loadMore` props across `App.tsx`, `HeaderBar`, and `GameGrid`.
- Updated `scripts/build-app.mjs` to create and preserve `release/standalone/games` across standalone builds and document it in `README.txt`.

### Fixed

- Reconcile orphaned `index_jobs` on database startup (`apps/server/src/db/index.ts`) so interrupted background indexing jobs do not remain stuck in an active state after restart.

## [1.0.0] - 2026-11-24

_Initial commit (`331e584`)._

### Added

- **Monorepo & Shared Contracts (`packages/shared`)**:
  - Set up `pnpm` workspaces + Turborepo monorepo (`apps/server`, `apps/web`, `apps/extension`, `packages/shared`) with strict TypeScript configuration.
  - Defined `@game-library/shared` as the single source of truth for DTOs, enums, utilities, and Zod schemas.
- **Backend Server (`apps/server`)**:
  - Fastify v5 API bound exclusively to `127.0.0.1` with localhost/extension CORS, static SPA serving, local cover cache route, and constant-time `X-Pairing-Token` authentication (`src/auth/pairing.ts`).
  - Local SQLite persistence via `better-sqlite3` and Drizzle ORM with mandatory `WAL` mode, `busy_timeout = 5000`, `foreign_keys = ON`, and AES-256-GCM credential/cookie encryption (`src/db/crypto.ts`).
  - Background indexer running in Node.js `worker_threads` with `p-queue`, `undici`, and `cheerio` (`src/worker/`, `src/indexer/`), plus real-time Server-Sent Events (`src/sse/hub.ts`).
  - Native OS file/folder picker integration (`src/services/nativeFilePicker.ts`) and local game executable launcher (`src/services/gameLauncher.ts`).
- **Web Dashboard (`apps/web`)**:
  - React 19 + Vite + Tailwind CSS v4 + Radix UI + Redux Toolkit desktop-companion interface with Grid and List views, search/sort/filter controls, and live indexing status banner.
  - Modals and drawers for adding games (F95 URLs & custom games), inspecting/editing game details (notes, star ratings, executables, tabs), configuring settings & tag highlights, and pairing with the browser extension.
- **Browser Extension (`apps/extension`)**:
  - WXT cross-browser extension targeting Chrome MV3 and Firefox for extracting F95zone cookies/User-Agent, syncing securely via Pairing Token, popup status UI, and page content integration.
- **Standalone Build & Packaging (`scripts/`)**:
  - Added Windows (`scripts/build-app.mjs`, `scripts/bundle.mjs`, `scripts/build-windows.ps1`, `scripts/build-windows.bat`) and macOS (`scripts/build-macos.sh`, `scripts/macos-dmg.mjs`, `scripts/macos-entitlements.plist`) standalone packaging scripts and icon generators.
