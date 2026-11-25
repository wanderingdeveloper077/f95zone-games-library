import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { eq, inArray } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface DatabaseConnection {
  sqlite: Database.Database;
  db: AppDatabase;
  journalMode: string;
  busyTimeout: number;
}

const loadedNativeAddons = new Map<string, Record<string, unknown>>();

function loadNativeAddon(addonPath: string): Record<string, unknown> {
  const resolved = path.resolve(addonPath);
  const cached = loadedNativeAddons.get(resolved);
  if (cached) return cached;

  const addonModule: { exports: Record<string, unknown> } = { exports: {} };
  process.dlopen(addonModule, resolved);
  loadedNativeAddons.set(resolved, addonModule.exports);
  return addonModule.exports;
}

/**
 * Open a SQLite connection with mandatory WAL mode, 5s busy timeout,
 * and foreign key enforcement. Call independently on each thread.
 */
export function openDatabase(
  dbPath: string,
  nativeBindingPath?: string
): DatabaseConnection {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  // better-sqlite3's runtime supports an already-dlopen'd addon object in `nativeBinding`,
  // which is required when running inside a Node.js Single Executable Application (SEA).
  const options: Database.Options = nativeBindingPath
    ? { nativeBinding: loadNativeAddon(nativeBindingPath) as unknown as string }
    : {};
  const sqlite = new Database(dbPath, options);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");

  const journalMode = String(
    sqlite.pragma("journal_mode", { simple: true }) ?? ""
  ).toLowerCase();
  const busyTimeout = Number(
    sqlite.pragma("busy_timeout", { simple: true }) ?? 0
  );

  const db = drizzle(sqlite, { schema });
  return { sqlite, db, journalMode, busyTimeout };
}

/**
 * Run bundled SQL migrations and ensure singleton settings & account rows exist.
 */
export function initializeDatabase(
  conn: DatabaseConnection,
  migrationsFolder: string
): void {
  migrate(conn.db, { migrationsFolder });

  const now = Date.now();
  // Reconcile orphaned jobs from an abrupt process termination so they do not block idle sleep.
  conn.db
    .update(schema.indexJobs)
    .set({
      status: "failed",
      errorSummary: "Interrupted by server restart",
      finishedAtMs: now,
    })
    .where(inArray(schema.indexJobs.status, ["queued", "running"]))
    .run();

  // Ensure existing games with at least one registered executable/folder path are marked installed.
  const existingGames = conn.db
    .select({
      id: schema.games.id,
      version: schema.games.version,
      installedVersion: schema.games.installedVersion,
      executablesJson: schema.games.executablesJson,
    })
    .from(schema.games)
    .all();

  for (const row of existingGames) {
    if (
      !row.installedVersion &&
      Array.isArray(row.executablesJson) &&
      row.executablesJson.length > 0
    ) {
      const nextInstalled = row.version || "Installed";
      conn.db
        .update(schema.games)
        .set({
          installedVersion: nextInstalled,
          hasUpdate: nextInstalled !== row.version,
        })
        .where(eq(schema.games.id, row.id))
        .run();
    }
  }

  conn.db
    .insert(schema.appSettings)
    .values({
      id: 0,
      useCacheApiFallback: true,
      cacheApiUrl: "https://api.f95checker.dev",
      scrapeDelayMs: 1000,
      extIconGlow: true,
      extHighlightTags: true,
      tagHighlightsJson: {},
      updatedAtMs: now,
    })
    .onConflictDoNothing()
    .run();

  conn.db
    .insert(schema.accounts)
    .values({
      id: "f95zone",
      provider: "f95zone",
      label: "F95zone",
      userAgent: null,
      encryptedPayload: "",
      cookieCount: 0,
      hasXfUser: false,
      hasCfClearance: false,
      status: "unconfigured",
      lastVerifiedAtMs: null,
      updatedAtMs: now,
    })
    .onConflictDoNothing()
    .run();
}
