<div align="center">

# 🎮 Game Library Manager

**A standalone, zero-dependency desktop-companion web app & cross-browser extension for organizing, indexing, and launching your F95zone & local games.**

![Windows](https://img.shields.io/badge/Windows-x64%20Standalone-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-000000?style=for-the-badge&logo=apple&logoColor=white)
![Chrome](https://img.shields.io/badge/Chrome-MV3%20Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Firefox](https://img.shields.io/badge/Firefox-MV2%20Extension-FF7139?style=for-the-badge&logo=firefox&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Monorepo-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL%20Local%20DB-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

</div>

---

Everything runs **100% locally** on your machine at `http://127.0.0.1:57095` using **SQLite** (WAL mode), background **Node.js worker threads**, and **AES-256-GCM** encrypted session storage—no Docker, external databases, or cloud services required.

---

## ✨ Key Features

- 🤖 **Automated F95zone Indexing**
  - Pulls game titles, versions, developers, engine types, thread statuses, forum scores, tags, descriptions, changelogs, download mirror links, and recent reviews.
  - Combines bulk version checks (`/sam/checker.php`), Cache API `/fast` change detection, optional Cache API fallback, and authenticated Latest Updates enrichment.
- 🖼️ **Local Cover & Gallery Caching + Lightbox**
  - Downloads and caches covers (`data/covers/`) and starter-post attachment screenshots (`data/covers/gallery/<gameId>/`) locally for instant offline viewing.
  - Includes a dedicated **Gallery** tab with a full-size lightbox (`ArrowLeft` / `ArrowRight` / `Escape`) plus a settings toggle to skip gallery downloads during refreshes.
- 🫣 **SFW Mode**
  - Flip one switch in **Settings & Pairing** to blur all covers and gallery thumbnails across main library cards, the detail modal header, and the gallery grid.
- 🚀 **Local Game Launcher & Auto-Discovery**
  - Attach executables, folders, or URIs to any game and launch them directly from library cards or the detail dialog.
  - Tracks **Installed**, **Outdated**, and **Finished** versions per game, and automatically watches `./games` (or macOS Application Support `games`) to register extracted game folders.
- 🧩 **Cross-Browser Companion Extension (Chrome MV3 & Firefox)**
  - Pairs securely via a short-lived 6-character code and `X-Pairing-Token` authentication.
  - Syncs F95zone cookies and `User-Agent` automatically for private threads, Watched/Bookmarks imports, and Cloudflare sessions.
  - Injects live library badges (with optional glow) and **Positive** / **Negative** / **Critical** tag highlights onto F95zone pages, with 1-click and context-menu thread adding.
- 🔒 **Local-First Security & Auto-Shutdown**
  - Fastify binds strictly to `127.0.0.1`, verifies extension tokens in constant time, and encrypts stored cookies at rest with **AES-256-GCM**.
  - Automatically closes the background server cleanly when your last dashboard tab is closed.

---

## 📦 Using Released Files

Grab the latest build assets from the repository's **GitHub Releases** page:

| Platform / Component         | Release Asset                                              | What's Inside                                                                           |
| ---------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 🪟 **Windows (x64)**         | `Game-Library-Manager-<version>-win-x64.zip`               | Standalone `Game Library Manager.exe` (no Node.js needed), `./extensions`, `README.txt` |
| 🍎 **macOS (Apple Silicon)** | `Game-Library-Manager-<version>-macos-arm64.dmg`           | `Game Library Manager.app` bundle, `./extensions`, `README.txt`                         |
| 🌐 **Chrome / Edge / Brave** | `Game-Library-Manager-Extension-<version>-chrome-mv3.zip`  | Unpacked Chrome MV3 companion extension (`manifest.json` at root)                       |
| 🦊 **Firefox**               | `Game-Library-Manager-Extension-<version>-firefox-mv2.zip` | Firefox MV2 companion extension (`manifest.json` at root)                               |

### 🪟 1. Windows Setup

> [!TIP]
> No Node.js installation or extra dependencies are required—just extract and run!

1. Extract `Game-Library-Manager-<version>-win-x64.zip` to a folder of your choice (e.g., `D:\Games\Game Library Manager\`).
2. Double-click **`Game Library Manager.exe`**.
3. Your default browser opens automatically to **`http://127.0.0.1:57095`**.
4. **Runtime folders created next to the executable:**
   - 📁 `./data` — Holds `library.db` (SQLite), `.master.key`, `.pairing.token`, and `./data/covers` (cached covers & galleries).
   - 📁 `./games` — Extract game folders here to auto-register their **Play** executable path.
   - 📁 `./extensions` — Bundled `chrome-mv3` and `firefox-mv2` companion extension folders.
5. Closing all open dashboard browser tabs shuts down the background server automatically.

### 🍎 2. macOS Apple Silicon Setup

1. Open `Game-Library-Manager-<version>-macos-arm64.dmg`.
2. Drag **`Game Library Manager.app`** into **`Applications`**.
3. **First launch (ad-hoc signed builds):** Right-click `Game Library Manager.app` and click **Open** if Gatekeeper prompts, or run:
   ```bash
   xattr -dr com.apple.quarantine "/Applications/Game Library Manager.app"
   ```
4. Launch the app to start the local server and open **`http://127.0.0.1:57095`**.
5. **Runtime folders on macOS:**
   - 📁 Data & covers: `~/Library/Application Support/Game Library Manager`
   - 📁 Watched games folder: `~/Library/Application Support/Game Library Manager/games`
   - 📁 Bundled extensions are included inside the DMG (`extensions/`) and `Game Library Manager.app/Contents/Resources/extensions`.

### 🧩 3. Browser Companion Extension Setup

Use the standalone extension `.zip` archives from GitHub Releases or the `./extensions` folder inside the Windows/macOS package:

- **🌐 Chrome / Edge / Brave (`chrome-mv3`):**
  1. Extract the `.zip` archive to a permanent folder (`manifest.json` at the root).
  2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
  3. Click **Load unpacked** and select the extracted `chrome-mv3` folder.

- **🦊 Firefox (`firefox-mv2`):**
  1. Extract the `.zip` archive (or use the `firefox-mv2` folder).
  2. Open `about:debugging#/runtime/this-firefox`.
  3. Click **Load Temporary Add-on...** and select `manifest.json` inside `firefox-mv2`.

- **🔗 Pairing & Syncing Your F95zone Session:**
  1. Ensure **Game Library Manager** is running (`http://127.0.0.1:57095`).
  2. Click **⚙️ Settings & Pairing** in the top-right header and press **Generate Pairing Code** (valid for 120 seconds).
  3. Open the **Game Library Companion** extension popup, enter the 6-character code, and click **Pair**.
  4. Log into `f95zone.to` in your browser and click **Sync Session Now** in the popup (subsequent cookie changes sync automatically while paired).

---

## 🧭 Sections of the Application

### 1. 🏠 Header Bar & Live Indexing Banner

- Shows total library count, available updates badge, and live **SSE** connection status (`Live SSE connected`).
- **🛡️ Session Status Button**: Displays `Session: Not Paired`, `Session: Active`, `Cloudflare Challenge`, or `Session Expired` and opens **Settings & Pairing** on click.
- **🔄 Refresh All**: Queues a smart bulk update check across non-archived F95zone games.
- **➕ Add Game**: Opens the modal to import F95zone URLs or add a custom local game.
- **⚙️ Settings & Pairing**: Opens the configuration and pairing drawer.
- **📊 Live Indexing Banner**: Appears during background indexing/import jobs with a progress bar, active game name, cancel button, and error notice if any issue occurred.

### 2. 🔍 Filter Toolbar & Advanced Filters Accordion

A sticky toolbar docked at the top while you scroll:

- **Search**: Instant filtering by game title, developer, or personal notes.
- **Quick Toggles**: **Updates Only** and **Archived** checkboxes.
- **Sort & Direction**: Sort by **Last Updated**, **Date Added**, **Name**, **Forum Score**, or **Personal Rating** (`ASC` / `DESC`).
- **View Switcher**: Toggle between **Grid View** (large widescreen cards), **Small Grid View** (high-density compact cards), and **List View** (table view).
- **🎛️ Advanced Filters Accordion**: Expands to filter by **Status**, **Engine Types**, **Installed** (`All`, `Installed`, `Up to Date`, `Outdated`, `Not Installed`), **Finished** (`All`, `Finished`, `Unfinished`), and searchable **Tags**.

### 3. 🕹️ Library Views (Grid, Small Grid & List)

- Smooth infinite-scroll pagination (`Load more` fallback at the bottom).
- Displays engine, status, version, update badge, score/rating, and quick action buttons for **▶ Play**, **⬇ Installed / Outdated**, and **✔ Finished**.
- Games with multiple registered executables open the **Choose Executable** dialog on **Play**.

### 4. ➕ Add Game Modal

- **🔗 F95zone URLs**: Paste one or many thread URLs and optionally auto-fetch metadata right away.
- **📝 Custom Local Game**: Create custom entries with name, version, developer, engine type, optional URL, and personal notes.

### 5. 📖 Game Detail Dialog

Click any game card or row to open its full detail modal:

- **Header & Rating**: Cover art (blurred in **SFW Mode**), engine/status/version badges, external thread link, developer, forum score, highlighted tags, and 5-star personal rating.
- **💻 Local Executables**: Pick executables or game folders via native OS dialog, launch **Play**, or **Open Folder**.
- **📑 Detail Tabs**:
  - **Overview** — Parsed story/overview text.
  - **Gallery** — Responsive thumbnail grid of cached thread attachment images (excluding the cover) with a full-size **Lightbox Viewer** (`ArrowLeft` / `ArrowRight` / `Escape` + **Open Full Size** link).
  - **Changelog** — Parsed thread changelog.
  - **Downloads** — Extracted download sections and mirror buttons.
  - **Reviews** — Cached recent user reviews and scores.
- **📝 Personal Notes & Actions**: Save notes, **Re-index** that game, **Archive / Unarchive**, or **Remove Game**.

### 6. ⚙️ Settings & Pairing Drawer

- **🔑 Extension Pairing**: View masked pairing token, generate a 6-character pairing code, or rotate your token.
- **🍪 F95zone Session & Imports**: Verify active cookies, import **Watched Threads** or **Bookmarks**, or clear stored session cookies.
- **🛠️ Indexer & Extension Settings**:

  | Setting                                       | Description                                                                          |
  | --------------------------------------------- | ------------------------------------------------------------------------------------ |
  | **Fallback to Cache API on Cloudflare block** | Falls back to the configured Cache API if direct scraping hits Cloudflare            |
  | **Download gallery images on refresh**        | Toggle off to skip downloading gallery attachments during game refreshes             |
  | **SFW mode (blur covers and gallery images)** | Blurs game covers and gallery cards across the main grid, detail header, and gallery |
  | **Extension icon glow on forum tiles**        | Enables/disables status badge glow on F95zone forum tiles                            |
  | **Highlight tags in UI and extension**        | Enables tag highlight colors in both the dashboard and F95zone pages                 |
  | **Scrape delay (ms)**                         | Minimum delay (`250`–`10000` ms) between direct forum requests                       |

- **🎨 Tag Highlights**: Assign **Positive** (green), **Negative** (red), or **Critical** (black) highlight rules to specific tags.

### 7. 🧩 Browser Extension Popup & On-Page Integration

- **Popup**: Live server reachability pill, **Add Current F95zone Thread**, **Sync Session Now**, **Dashboard** launcher, pairing code / token inputs, and configurable server port (`57095` default).
- **On-Page F95zone Integration**: Automatically badges tracked threads on listings/thread headers and applies your configured tag highlights.

---

## 🛠️ Development & Building from Source

The repository is a `pnpm` workspaces + Turborepo TypeScript monorepo:

| Workspace Package                                              | Purpose                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`packages/shared`](packages/shared) (`@game-library/shared`)  | Shared DTOs, enums, Zod schemas, version constant, and utilities            |
| [`apps/server`](apps/server) (`@game-library/server`)          | Fastify v5 API, SQLite + Drizzle ORM, SSE hub, and `worker_threads` indexer |
| [`apps/web`](apps/web) (`@game-library/web`)                   | React 19 + Vite + Tailwind CSS v4 + Redux Toolkit dashboard UI              |
| [`apps/extension`](apps/extension) (`@game-library/extension`) | WXT cross-browser extension (Chrome MV3 & Firefox)                          |

> [!NOTE]
> Development and building require **Node.js 22+** (or **Node.js 26+** with `--build-sea` for standalone executable builds) and **pnpm 11+**.

```bash
# 📥 Install workspace dependencies
pnpm install

# ⚡ Run development servers
pnpm dev

# 🧪 Build, typecheck, and run all tests
pnpm build
pnpm typecheck
pnpm test

# 📦 Package standalone desktop binaries
pnpm build:app           # Windows .exe (on Windows) or macOS .app (on macOS)
pnpm build:mac:dmg       # macOS .app + .dmg (on macOS)
```

---

## 🙏 Credits & Acknowledgements

- Inspired by and built with reference to **[F95Checker](https://github.com/WillyJL/F95Checker)** by **WillyJL** — huge thanks for pioneering the F95zone library manager ecosystem, parsing conventions, and companion extension workflow.

---

## 💖 Support

If you find **Game Library Manager** helpful and would like to support its development, donations are greatly appreciated!

- **💎 Gram Coin (GRAM/Ton Network):**
  ```text
  UQDwI_94-hFOZZK5sL6n4yzdyytr5ntX3LBYlnTQHXkYfUyH
  ```
