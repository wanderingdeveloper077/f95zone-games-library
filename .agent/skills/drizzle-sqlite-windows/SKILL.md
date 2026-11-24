---
name: drizzle-sqlite-windows
description: >-
  Guides Drizzle ORM and better-sqlite3 database architecture on Windows, including
  mandatory WAL mode and busy_timeout pragmas, worker_threads connection safety,
  AES-256-GCM credential encryption with node:crypto, and pnpm/Windows native addon
  packaging. Use when editing database schemas, migrations, crypto utilities, or
  Windows build scripts.
---

# Drizzle ORM + SQLite (`better-sqlite3`) on Windows

Use this skill whenever implementing or modifying SQLite connections, Drizzle schemas/migrations, encryption utilities, or standalone Windows builds in `apps/server` and `scripts/`.

## 1. Mandatory SQLite Initialization Pragmas

Every `better-sqlite3` connection—both in the Fastify main thread and inside `worker_threads`—MUST execute these pragmas immediately upon opening the database file:

```ts
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export function openDatabase(dbPath: string, schema: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}
```

- Always resolve `dbPath` with `path.join` / `path.resolve` (defaulting to `<root>/data/library.db`).
- Verify `sqlite.pragma("journal_mode", { simple: true }) === "wal"` in startup diagnostics or tests.

## 2. Multi-Thread Concurrency (`apps/server` + `worker_threads`)

- `better-sqlite3` instances are NOT thread-safe and cannot be cloned over `MessagePort`.
- Open **one** connection on the Fastify main thread and **one** separate connection inside the Indexer `Worker` thread pointing to the same `library.db`.
- WAL mode enables concurrent readers and serialized writers; `busy_timeout = 5000` instructs SQLite to wait up to 5 seconds instead of throwing `SQLITE_BUSY` immediately.
- **Keep write transactions short:** Wrap multi-row updates in `sqlite.transaction(...)` / `db.transaction(...)` and NEVER perform HTTP fetches or image downloads inside an open transaction.
- **Graceful shutdown:** Register `sqlite.close()` on both server shutdown (`fastify.onClose`) and worker exit so WAL `-wal`/`-shm` files checkpoint cleanly.

## 3. Drizzle ORM Schema & Zero-Dependency Migrations

- Store Drizzle schema definitions in `apps/server/src/db/schema.ts` and generate SQL migrations via `drizzle-kit generate` into `apps/server/drizzle/`.
- **Programmatic runtime migrations:** Do NOT rely on `drizzle-kit push` at runtime (end users on standalone Windows do not run dev CLI tools). Run Drizzle's `migrate(db, { migrationsFolder })` at server startup before accepting requests or launching the worker.
- Ensure `scripts/` copies the `drizzle/` SQL folder alongside the compiled server bundle and resolves `migrationsFolder` relative to the bundled entrypoint via `import.meta.url` + `path.join`.
- Use `integer("...", { mode: "boolean" })` for booleans, `integer("...", { mode: "timestamp_ms" })` or integer Unix seconds consistently (document unit explicitly per column), and `text("...", { mode: "json" }).$type<T>()` for structured arrays/objects (`tags`, `previewsUrls`, `downloads`, `reviews`).

## 4. AES-256-GCM Encryption at Rest (`node:crypto`)

Encrypt sensitive account data (`cookiesJson`, `authToken`, `rpdlToken`) before storing in SQLite `accounts`:

- **Key management:** Load a 32-byte master key from `APP_MASTER_KEY` (hex/base64) or auto-generate and persist a local random 32-byte keyfile at `path.join(dataDir, ".master.key")` on first run. Never store the encryption key inside `library.db`.
- **Cipher envelope:** Use `aes-256-gcm` with a fresh 12-byte random IV (`crypto.randomBytes(12)`) per write and store `"v1:" + iv.toString("base64url") + ":" + tag.toString("base64url") + ":" + ciphertext.toString("base64url")`.
- **Verification:** Always call `decipher.setAuthTag(tag)` before `decipher.final()` so tampered/corrupted rows fail loudly.
- Never log decrypted cookie strings or keys.

## 5. Windows Native Build & `pnpm` 11 Awareness

- This workspace runs on **Windows** with **Node.js v26.5.0** and **pnpm 11.15.1**.
- `pnpm` 11 blocks postinstall scripts by default unless explicitly permitted in `pnpm-workspace.yaml` via `allowBuilds` (`better-sqlite3: true`, `esbuild: true`) so native prebuilds/compilations execute cleanly during `pnpm install`.
- If a prebuilt binary is unavailable for a given Node ABI on Windows, `node-gyp` requires Visual Studio Build Tools ("Desktop development with C++") + Python. Document this clearly in build scripts and verify `require("better-sqlite3")` succeeds after install.
- **Bundling caveat:** Do NOT bundle `better-sqlite3`'s native `.node` addon inside an `esbuild`/`tsup` single JS file. Mark `better-sqlite3` as `external` when bundling `apps/server` (or ship pruned production `node_modules` alongside the bundle) and verify `better_sqlite3.node` loads from the bundle root.

## 6. Verification Steps

1. Run schema/migration + WAL verification tests checking `PRAGMA journal_mode` returns `"wal"` and `PRAGMA busy_timeout` returns `5000`.
2. Run a unit test verifying AES-256-GCM encryption/decryption round-trip and auth-tag failure on tampered ciphertext.
3. Run a concurrency smoke test executing parallel writes from main thread and a `worker_threads` worker without `SQLITE_BUSY`.
