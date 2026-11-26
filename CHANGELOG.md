# Changelog

All notable changes to the **Game Library Manager** project are documented in this file.

## 1.0.0 (2026-11-26)

### Features

* **server:** accept clientId on SSE stream and add client-closing beacon route ([dfe009f](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/dfe009fef800673992877150fff60f3e7b18178b))
* **server:** add batched cache API fast timestamps and prefer knownBulkVersion ([3cb80c5](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/3cb80c5ff0c600aaa3e7a3ed056a55015dc82e1b))
* **server:** add client count and broadcast observer hooks to SseHub ([0d57f3a](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/0d57f3a9ecdc8bbc8ad228aeeb3c2356f9aaf390))
* **server:** add clientKey and removeClient to SseClientRegistry contract ([9aa0a9b](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/9aa0a9be6520f7c5311a728423a2768bafeee540))
* **server:** add exitOnIdle mode and refine idle scheduling for client-closing ([b654500](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/b654500de4510258a39d922476392d0b397d4b72))
* **server:** add galleryFilesJson, downloadGalleryImages, and sfwMode columns to SQLite schema ([d49e6c1](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/d49e6c16b663a0976eca29ab43d89b8b3c03f6d1))
* **server:** add GamesDirectoryWatcher for auto-registering extracted games ([ee1efb8](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/ee1efb8be717cf370367ce9490d2e607a1b8c56a))
* **server:** add limit/offset pagination and advanced filters to listGamesPage ([be3630f](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/be3630f40389ac9f59e176a0cbc5163a8e3d2aa1))
* **server:** add migration for app_settings download_gallery_images column ([1cca8c0](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/1cca8c04254e4cea1f9917ce30b7a558cb8fcf53))
* **server:** add migration for app_settings sfw_mode column ([56eb04b](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/56eb04ba3b6e996b0ce08d9de66c8da11b1d482f))
* **server:** add migration for game_metadata gallery_files_json column ([32dd265](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/32dd2652349e6a1f769f53f6e3a1765d362f0749))
* **server:** add paginated listPage and auto-mark games installed when paths are added ([2d42a9c](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/2d42a9ce52eb7621585bac8f6fa43f10c469734d))
* **server:** add resolveGalleryImage to CoverResolver port ([2125b23](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/2125b23f55b755910f14a478990502f6d25f6fde))
* **server:** add SleepWakeServer gateway for idle suspend and auto-wake ([323db71](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/323db7194094f3c324e3c9c8dbaf2d4cf1ad7164))
* **server:** add standalone gamesDir resolution to server config ([03b66d5](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/03b66d57714eebc26b3587879411e66d5a7cb6f2))
* **server:** bootstrap Fastify server through createSleepWakeServer ([0f56af1](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/0f56af18d31f644383a56b9dbfb44765e46da9dd))
* **server:** download and persist galleryFiles during indexing when enabled ([942255c](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/942255cda8251de1b432ea8d2494b2c3ad28bb7c))
* **server:** download, cache, reuse, and prune local gallery attachment images ([6968d0a](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/6968d0a0206f7d56a38932137406432feef8a46b))
* **server:** enable exitOnIdle shutdown when last dashboard tab closes ([bf09d5a](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/bf09d5a0524671d02154734d8a7873f4482ec6b7))
* **server:** export bulk version check and cache API batch limit constants ([1b4c7fb](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/1b4c7fb17fc6374b593461f6b527ae1e1f38dcbd))
* **server:** extract all starter-post attachment images excluding cover ([6ea83cb](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/6ea83cbde7e248d79b6ec5bc55e2d142d6d9d56d))
* **server:** initialize default downloadGalleryImages and sfwMode settings on DB startup ([d61834a](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/d61834a925a93487ff3bec6d0f19c980c8fe5ece))
* **server:** integrate fast timestamp checks and bulk version fallback in IndexJobProcessor ([8d4d97f](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/8d4d97f13808722d375e32b40f646e9e28a4d5ca))
* **server:** normalize attachment CDN/thumbnail URLs and filter non-image attachments ([03e647d](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/03e647d93ccb81d1c66965466f47a6c800deb470))
* **server:** normalize preview URLs and exclude cover after Latest Updates enrichment ([f274e3a](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/f274e3aea3c811339078afe678d2177af611ad30))
* **server:** pass knownBulkVersion to fetchThreadFromCacheApi ([742a030](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/742a030b8b263c54352d970b50a3b32a122a22f9))
* **server:** persist downloadGalleryImages and sfwMode settings and invalidate uncached galleries when re-enabled ([119c3f8](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/119c3f8effc3d2d85f29898fe2556e4297e9fbbb))
* **server:** resolve and clean up cached gallery images in LocalCoverStorage ([55b99a2](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/55b99a2ab6274d5fa5d262eedb00f8ac0224a653))
* **server:** resolve best executable inside registered game folders ([9c4d158](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/9c4d158bdb4023ec42eabe013a38f0d15acce677))
* **server:** serialize galleryFiles, downloadGalleryImages, and sfwMode in DB queries ([66a95f2](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/66a95f2ed9c38de50dd06f36d9ce4c7ef57a36ad))
* **server:** serve cached gallery images at GET /covers/gallery/:gameId/:filename ([155d423](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/155d4231e0163ded180b95a7c671199687720e9e))
* **server:** support keyed SSE client registration and explicit removal in SseHub ([23c723d](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/23c723d5960009789d3ebd104c470e3b876bf01b))
* **server:** support pagination and tags/installed/finished filters on GET /api/games ([c94ca23](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/c94ca235b388125d7108263b166edbb2a3a03b76))
* **server:** wire GamesDirectoryWatcher and sleep-wake hooks into buildApp ([0bf0dc7](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/0bf0dc75ec5256cf7e216488b52f95b251b63806))
* **shared:** add galleryFiles, downloadGalleryImages, and sfwMode to shared schemas ([4efd0a3](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/4efd0a3840b2fa089e80eda169ffd50d38b17ab6))
* **shared:** export canonical APP_VERSION constant ([b317ff5](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/b317ff587e0695afb99a6c859b163e54c37750ac))
* **shared:** re-export version module from package entrypoint ([f70aa81](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/f70aa8132516fda328b518e519dcf79746abfe05))
* **web:** add collapsible AdvancedFiltersPanel accordion with status, engine, installed, finished, and tags ([86e3188](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/86e3188038dc1021950ffbc3f78428912acea94d))
* **web:** add compact GameSmallCard component for Small Grid view ([2a33630](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/2a33630cfd756047c49d31190c7768a479b665d8))
* **web:** add countActiveAdvancedFilters presentation helper ([f543e4e](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/f543e4e553269efde63a2d51f9afcb3ddb605e3b))
* **web:** add downloadGalleryImages and sfwMode to indexerSettingsFormSchema ([f5bc0ba](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/f5bc0baac2ed8e75d2f4d263b00f4db699820de8))
* **web:** add gallery download and SFW mode switches to settings sheet ([cf81617](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/cf81617201b861835323ac4e2e2a32648b8a7be8))
* **web:** add Gallery tab and wire gallery and SFW props in GameDetailTabs ([f33bd50](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/f33bd50e4c832bf7e83db1f41c7754bb29705268))
* **web:** add GameGalleryTab with thumbnail grid, SFW blur, and lightbox viewer ([10773bb](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/10773bb4c8ddd8c78c6048c8e42b3c4b88d7ad2c))
* **web:** add getSfwImageBlurClass presentation helper ([f426785](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/f426785176bcf1d788cfc6d240528b5eec3e7187))
* **web:** add IntersectionObserver-based useInfiniteScroll hook ([b2533a6](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/b2533a6e483da28449762405472fa53839a9fd8a))
* **web:** add paginated getGames response types and advanced filter query params ([0b9635e](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/0b9635e3e9c952d4ff1dd53b5be0bd72d7ab8d18))
* **web:** add small-grid view persistence, infinite scroll pagination, and advanced filter state ([181c701](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/181c701e00c901ed0782033833e48a7abdebf265))
* **web:** blur detail cover in SFW mode and pass gallery settings to tabs ([d5498af](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/d5498af26c006fc0fb8c5de75323059c18deb160))
* **web:** blur game card cover image when sfwMode is enabled ([ed54233](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/ed54233f30831495e70da6663314cd1d13c319f9))
* **web:** blur small grid card cover image when sfwMode is enabled ([7e92ff3](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/7e92ff364d2eae1e5e61ae6a459a391f04864d44))
* **web:** cache sfwMode in localStorage and sync on settings load and update ([1a71043](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/1a710433db2738cbbe6836173386ce75ec334d6b))
* **web:** close SSE on pagehide, reconnect on pageshow, and preserve loaded count ([f8dca9b](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/f8dca9b7b01547253887cbef58113281b4b146eb))
* **web:** expose downloadGalleryImages and sfwMode from useGameDetail hook ([7612519](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/7612519f01dccec71bb5c621491419cdd0fe8e07))
* **web:** expose pagination state and LibraryViewMode from useGameLibrary ([4ec1ff8](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/4ec1ff8b09c792e944a138f8e57be8fc43cadce5))
* **web:** expose sfwMode from useSystemStatus hook ([b73606f](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/b73606f6209274db0a8fb32d1b68150ed1e85149))
* **web:** forward sfwMode prop to GameCard and GameSmallCard ([ebfccbb](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/ebfccbbd2d939c20353c1c6a607fef4c9e56e622))
* **web:** make FilterToolbar sticky, add Small Grid toggle, and integrate AdvancedFiltersPanel ([6484dcc](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/6484dccb9bab3bc64275c0bb564f560834524952))
* **web:** render GameSmallCard in small-grid mode and attach infinite scroll sentinel ([367771d](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/367771d6a59b18ed3419f1f250dab5d8b7d1fe83))
* **web:** send clientId on SSE stream and client-closing beacon on pagehide ([b4d16e6](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/b4d16e66ee99ecaf429a199194090ea16ea09162))
* **web:** wire sfwMode from system status into GameGrid ([c8f11f9](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/c8f11f97329f83acc05008824045bfccf6c2394a))
* **web:** wire totalCount and infinite scroll props to HeaderBar and GameGrid ([fb3878c](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/fb3878ca18eb6ab562a44e8f6250b11ecdd40d38))

### Bug Fixes

* **server:** exclude custom and non-forced archived games from refresh target count ([3c72f75](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/3c72f75983bd3d9007d733d4160f085299de2f6d))
* **server:** reconcile orphaned index jobs and backfill installed games on startup ([a5262c2](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/a5262c2db44695d90cda54b54f7c1d217db11089))
* **web:** record lastJobError from completed job payload in systemSlice ([071a579](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/071a57950e3b982ed9a1dafe1f3474321b71735e))

### Documentation

* add CHANGELOG.md ([e1b22c9](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/e1b22c96b050e5f5a6c4c15e215dcaea75823526))

### Code Refactoring

* **extension:** read extension manifest version dynamically from package.json ([4336e27](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/4336e2761200cf829c63e29df61eec37f48b50d1))
* **server:** source default appVersion from shared APP_VERSION ([de7f919](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/de7f919a6d7b2bd70a707a99f629860bdc32ad66))
* **web:** make HeaderBar non-sticky so FilterToolbar docks cleanly at top ([4637bc7](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/4637bc7dbdbc42863b435146a8a5a28e64addc33))

### Build System

* add sync-version script for monorepo release version stamping ([18f6d9b](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/18f6d9b89ad007dbe721212b79c497bd78b41904))
* create and preserve release/standalone/games directory in standalone build script ([1bb95a8](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/1bb95a865b6173da26e1dbf9c050a4c3f3bdd61a))
* read standalone app version dynamically from root package.json ([292acba](https://github.com/wanderingdeveloper077/f95zone-games-library/commit/292acba40282bb6cfa66c524110d42e75d7fc32e))

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
