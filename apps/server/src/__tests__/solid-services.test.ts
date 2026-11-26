import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Status, type SseEvent, Type } from "@game-library/shared";
import { eq } from "drizzle-orm";
import PQueue from "p-queue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PairingManager, type TokenStore } from "../auth/pairing.js";
import { resolveDefaultSeaDataDir } from "../config.js";
import { resolveBundledNativeAddonPath } from "../runtime/embedded.js";
import type {
  CoverCleaner,
  EventBroadcaster,
  GameLauncher,
  JobDispatcher,
} from "../contracts/ports.js";
import { createAesGcmCipher } from "../db/crypto.js";
import { initializeDatabase, openDatabase } from "../db/index.js";
import { createJobRecord } from "../db/queries.js";
import * as schema from "../db/schema.js";
import {
  CacheApiMetadataProvider,
  type MetadataProvider,
  fetchMetadataWithFallback,
} from "../indexer/metadataProvider.js";
import {
  type ScrapedThreadData,
  fetchBulkVersions,
  fetchFastCheckTimestamps,
} from "../indexer/scraper.js";
import { AccountsService } from "../services/accountsService.js";
import { isUriTarget } from "../services/gameLauncher.js";
import { GamesService } from "../services/gamesService.js";
import { IndexJobProcessor } from "../worker/jobProcessor.js";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle"
);

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    cleanup?.();
  }
});

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gl-solid-server-"));
  const dbPath = path.join(dir, "library.db");
  const coversDir = path.join(dir, "covers");
  fs.mkdirSync(coversDir, { recursive: true });
  const conn = openDatabase(dbPath);
  initializeDatabase(conn, migrationsDir);

  cleanups.push(() => {
    conn.sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return { dir, coversDir, conn };
}

function makeScrapedData(
  overrides: Partial<ScrapedThreadData> = {}
): ScrapedThreadData {
  return {
    name: "Indexed Adventure",
    version: "0.2.0",
    threadVersion: "0.2.0",
    developer: "Indie Studio",
    type: Type.RenPy,
    status: Status.Normal,
    lastUpdated: 1_700_000_000,
    score: 4.7,
    votes: 42,
    description: "Description",
    changelog: "v0.2.0",
    tags: [1, 2],
    unknownTags: [],
    imageUrl: "",
    previewsUrls: [],
    downloads: [],
    reviewsTotal: 0,
    reviews: [],
    ...overrides,
  };
}

describe("PairingManager DIP storage & clock abstractions", () => {
  it("manages codes, 120s TTL expiry, exchange invalidation, and token rotation in memory", () => {
    let storedToken: string | null = null;
    const store: TokenStore = {
      read: () => storedToken,
      write: (token) => {
        storedToken = token;
      },
    };
    let nowMs = 1_000_000;
    const manager = new PairingManager(store, () => nowMs);

    const initialToken = manager.getToken();
    expect(initialToken.length).toBe(64);
    expect(storedToken).toBe(initialToken);

    const codeEntry = manager.createPairingCode();
    expect(codeEntry.code).toHaveLength(6);
    expect(codeEntry.expiresAtMs).toBe(nowMs + 120_000);

    // Exchange succeeds before expiry and consumes one-time code
    expect(manager.exchangeCode(codeEntry.code.toLowerCase())).toBe(
      initialToken
    );
    expect(manager.exchangeCode(codeEntry.code)).toBeNull();

    // Expiry invalidates active code once 120s elapse
    const expiredCode = manager.createPairingCode();
    nowMs += 120_000;
    expect(manager.getActiveCode()).toBeNull();
    expect(manager.exchangeCode(expiredCode.code)).toBeNull();

    // Rotation persists fresh token and clears active code
    const pendingCode = manager.createPairingCode();
    const rotated = manager.rotateToken();
    expect(rotated).not.toBe(initialToken);
    expect(storedToken).toBe(rotated);
    expect(manager.exchangeCode(pendingCode.code)).toBeNull();
    expect(manager.verifyHeaderToken(rotated)).toBe(true);
  });
});

describe("AccountsService SRP & DIP encryption/verification", () => {
  it("syncs encrypted cookies, verifies with injected verifier, emits SSE events, and clears session", async () => {
    const { conn } = createTempDb();
    const cipher = createAesGcmCipher(crypto.randomBytes(32));
    const events: SseEvent[] = [];
    const broadcaster: EventBroadcaster = {
      broadcast: (event) => events.push(event),
    };

    const verifySession = vi
      .fn()
      .mockResolvedValueOnce({ status: "active" })
      .mockResolvedValueOnce({
        status: "captcha_required",
        error: { flag: "CLOUDFLARE_CAPTCHA", retryDelayMs: 900_000 },
      });

    const accountsService = new AccountsService({
      db: conn.db,
      cipher,
      broadcaster,
      verifySession,
      now: () => 5_000_000,
    });

    const synced = accountsService.syncF95Session({
      cookies: [
        {
          name: "xf_user",
          value: "42_secret",
          domain: ".f95zone.to",
          path: "/",
        },
      ],
      userAgent: "TestAgent/1.0",
    });
    expect(synced).toMatchObject({
      status: "active",
      cookieCount: 1,
      hasXfUser: true,
    });

    const activeRes = await accountsService.verifyF95Session();
    expect(activeRes).toMatchObject({ ok: true, account: { status: "active" } });

    const captchaRes = await accountsService.verifyF95Session();
    expect(captchaRes).toMatchObject({
      ok: true,
      account: { status: "captcha_required" },
      error: { flag: "CLOUDFLARE_CAPTCHA" },
    });

    const cleared = accountsService.clearF95Session();
    expect(cleared).toMatchObject({
      status: "unconfigured",
      cookieCount: 0,
      hasXfUser: false,
    });
    expect(events.filter((e) => e.type === "account_updated")).toHaveLength(4);
  });
});

describe("GamesService SRP, OCP sorting & CoverCleaner DIP", () => {
  it("creates, sorts, patches, and deletes games using injected collaborators", async () => {
    const { conn } = createTempDb();
    const events: SseEvent[] = [];
    const broadcaster: EventBroadcaster = {
      broadcast: (event) => events.push(event),
    };
    const enqueueJob = vi.fn();
    const jobDispatcher: JobDispatcher = { enqueueJob };
    const deleteCovers = vi.fn().mockResolvedValue(undefined);
    const coverCleaner: CoverCleaner = { deleteCovers };

    const service = new GamesService({
      db: conn.db,
      sqlite: conn.sqlite,
      coverCleaner,
      jobDispatcher,
      broadcaster,
      now: () => 1_700_000_000_000,
    });

    const firstAdd = service.addF95Threads(
      ["https://f95zone.to/threads/alpha.101/"],
      true
    );
    expect(firstAdd.added).toHaveLength(1);
    expect(firstAdd.duplicateIds).toHaveLength(0);
    expect(firstAdd.jobId).toBeTruthy();
    expect(enqueueJob).toHaveBeenCalledTimes(1);

    const duplicateAdd = service.addF95Threads(
      ["https://f95zone.to/threads/alpha.101/"],
      true
    );
    expect(duplicateAdd.added).toHaveLength(0);
    expect(duplicateAdd.duplicateIds).toEqual([101]);
    expect(enqueueJob).toHaveBeenCalledTimes(1);

    const customCreated = service.createCustomGame({
      name: "Zeta Custom",
      version: "1.0",
      developer: "Studio",
      type: Type.Misc,
      url: "",
      notes: "",
    });
    const customId = customCreated.added[0]?.id;
    expect(customId).toBe(-1);

    const patched = service.updateGame(101, {
      installedVersion: "Outdated",
      rating: 5,
    });
    expect(patched?.hasUpdate).toBe(true);
    expect(patched?.rating).toBe(5);

    const sortedAsc = service.list({ sort: "name", dir: "asc" });
    expect(sortedAsc.map((g) => g.name)).toEqual(["alpha", "Zeta Custom"]);

    const deleted = await service.deleteGame(101);
    expect(deleted).toBe(true);
    expect(deleteCovers).toHaveBeenCalledWith(101);
    expect(events.some((e) => e.type === "games_added")).toBe(true);
    expect(events.some((e) => e.type === "game_updated")).toBe(true);
  });
});

describe("MetadataProvider fallback chain & IndexJobProcessor", () => {
  it("uses fallback on transient block flags and skips fallback on THREAD_MISSING", async () => {
    const queue = new PQueue({ concurrency: 1 });
    const ctx = { threadId: 777, session: null, forumQueue: queue };

    const captchaPrimary: MetadataProvider = {
      name: "primary",
      fetchThread: async () => ({
        ok: false,
        error: { flag: "CLOUDFLARE_CAPTCHA", retryDelayMs: 900_000 },
      }),
    };
    const cacheFallback: MetadataProvider = {
      name: "cache_api",
      fetchThread: async () => ({
        ok: true,
        source: "cache_api",
        data: makeScrapedData({ name: "Recovered Game" }),
      }),
    };

    const recovered = await fetchMetadataWithFallback(
      captchaPrimary,
      cacheFallback,
      ctx
    );
    expect(recovered).toMatchObject({
      ok: true,
      source: "cache_api",
      data: { name: "Recovered Game" },
    });

    const missingPrimary: MetadataProvider = {
      name: "primary",
      fetchThread: async () => ({
        ok: false,
        error: { flag: "THREAD_MISSING", retryDelayMs: 1_000 },
      }),
    };
    const fallbackSpy = vi.fn();
    const skipped = await fetchMetadataWithFallback(
      missingPrimary,
      { name: "cache", fetchThread: fallbackSpy },
      ctx
    );
    expect(skipped).toMatchObject({
      ok: false,
      error: { flag: "THREAD_MISSING" },
    });
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  it("processes queued jobs end-to-end against SQLite via injected mocks", async () => {
    const { conn, coversDir } = createTempDb();
    const cipher = createAesGcmCipher(crypto.randomBytes(32));
    const events: SseEvent[] = [];

    conn.db
      .insert(schema.games)
      .values([
        {
          id: 501,
          custom: false,
          name: "Existing Game",
          version: "0.1.0",
          installedVersion: "0.1.0",
          status: Status.Normal,
          type: Type.RenPy,
          addedAtMs: 1000,
        },
        {
          id: 502,
          custom: false,
          name: "Blocked Game",
          version: "Unchecked",
          status: Status.Unchecked,
          type: Type.Unchecked,
          addedAtMs: 1000,
        },
      ])
      .run();

    const job = createJobRecord(conn.db, "bulk_refresh", 2, {
      gameIds: [501, 502],
      force: true,
    });

    const processor = new IndexJobProcessor({
      db: conn.db,
      sqlite: conn.sqlite,
      coversDir,
      cipher,
      emitEvent: (ev) => events.push(ev),
      fetchBulkVersions: async () => new Map([[501, "0.2.0"]]),
      fetchMetadata: async ({ threadId }) => {
        if (threadId === 501) {
          return {
            ok: true,
            source: "direct",
            data: makeScrapedData({
              name: "Existing Game Updated",
              version: "0.2.0",
            }),
          };
        }
        return {
          ok: false,
          error: { flag: "CLOUDFLARE_CAPTCHA", retryDelayMs: 900_000 },
        };
      },
      now: () => 2_000_000,
    });

    await processor.processJob(job.id, "bulk_refresh", [501, 502], true);

    const updatedGame = conn.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, 501))
      .get();
    expect(updatedGame).toMatchObject({
      name: "Existing Game Updated",
      version: "0.2.0",
      hasUpdate: true,
    });

    const accountRow = conn.db.select().from(schema.accounts).all()[0];
    expect(accountRow?.status).toBe("captcha_required");

    expect(events.some((e) => e.type === "job_started")).toBe(true);
    expect(events.some((e) => e.type === "game_updated")).toBe(true);
    expect(events.some((e) => e.type === "account_updated")).toBe(true);
    expect(
      events.find((e) => e.type === "job_completed")
    ).toMatchObject({
      type: "job_completed",
      job: {
        status: "completed",
        processedCount: 2,
        errorCount: 1,
      },
    });
  });
});

describe("resolveDefaultSeaDataDir", () => {
  it("stores macOS .app state inside Application Support", () => {
    expect(
      resolveDefaultSeaDataDir(
        "darwin",
        "/Applications/Game Library Manager.app/Contents/MacOS/Game Library Manager",
        "/Users/alice"
      )
    ).toBe(
      path.join(
        "/Users/alice",
        "Library",
        "Application Support",
        "Game Library Manager"
      )
    );
  });

  it("stores Windows SEA state in ./data beside the executable", () => {
    expect(
      resolveDefaultSeaDataDir(
        "win32",
        "C:\\Apps\\Game Library Manager\\Game Library Manager.exe",
        "C:\\Users\\alice"
      )
    ).toBe(
      path.join(
        path.dirname(
          "C:\\Apps\\Game Library Manager\\Game Library Manager.exe"
        ),
        "data"
      )
    );
  });
});

describe("GamesService executables & launcher", () => {
  it("detects URI targets separately from local Windows drive paths", () => {
    expect(isUriTarget("https://example.com/play")).toBe(true);
    expect(isUriTarget("steam://rungameid/12345")).toBe(true);
    expect(isUriTarget("C:\\Games\\Title\\Game.exe")).toBe(false);
    expect(isUriTarget("D:/Games/Title/Game.exe")).toBe(false);
    expect(isUriTarget("/Applications/Game.app")).toBe(false);
  });

  it("deduplicates executables, enforces registered paths, and updates lastLaunchedAtMs", async () => {
    const { conn } = createTempDb();
    const events: SseEvent[] = [];
    const broadcaster: EventBroadcaster = {
      broadcast: (e) => events.push(e),
    };
    const jobDispatcher: JobDispatcher = {
      enqueueJob: vi.fn(),
    };
    const coverCleaner: CoverCleaner = {
      deleteCovers: async () => {},
    };
    const launchCalls: string[] = [];
    const folderCalls: string[] = [];
    const launcher: GameLauncher = {
      launch: async (executable) => {
        launchCalls.push(executable);
        return { ok: true, target: executable };
      },
      openFolder: async (executable) => {
        folderCalls.push(executable);
        return { ok: true, folder: path.dirname(executable) };
      },
    };

    const service = new GamesService({
      db: conn.db,
      sqlite: conn.sqlite,
      coverCleaner,
      jobDispatcher,
      broadcaster,
      gameLauncher: launcher,
      now: () => 1_700_000_099_000,
    });

    const created = service.createCustomGame({
      name: "Playable Title",
      version: "1.0",
      developer: "Dev",
      type: Type.RenPy,
      url: "",
      notes: "",
    });
    const gameId = created.added[0]!.id;

    const noExe = await service.launchGame(gameId);
    expect(noExe).toMatchObject({ ok: false, code: "NO_EXECUTABLES", statusCode: 400 });

    const updated = service.updateGame(gameId, {
      executables: [
        "  C:\\Games\\Playable\\Game.exe ",
        "C:\\Games\\Playable\\Game.exe",
        "",
      ],
    });
    expect(updated?.executables).toEqual(["C:\\Games\\Playable\\Game.exe"]);
    expect(updated?.installedVersion).toBe("1.0");
    expect(updated?.hasUpdate).toBe(false);

    const unregistered = await service.launchGame(gameId, "C:\\Other\\Evil.exe");
    expect(unregistered).toMatchObject({
      ok: false,
      code: "EXECUTABLE_NOT_REGISTERED",
      statusCode: 400,
    });

    const launched = await service.launchGame(gameId);
    expect(launched).toEqual({
      ok: true,
      executable: "C:\\Games\\Playable\\Game.exe",
      lastLaunchedAtMs: 1_700_000_099_000,
    });
    expect(launchCalls).toEqual(["C:\\Games\\Playable\\Game.exe"]);
    expect(service.getDetail(gameId)?.lastLaunchedAtMs).toBe(1_700_000_099_000);

    const folderRes = await service.openGameFolder(gameId);
    expect(folderRes).toEqual({
      ok: true,
      folder: path.dirname("C:\\Games\\Playable\\Game.exe"),
    });
    expect(folderCalls).toEqual(["C:\\Games\\Playable\\Game.exe"]);
  });
});

describe("resolveBundledNativeAddonPath", () => {
  it("prefers signed Contents/Frameworks/better_sqlite3.node on darwin when present", () => {
    const execPath =
      "/Applications/Game Library Manager.app/Contents/MacOS/Game Library Manager";
    const expected = path.resolve(
      path.dirname(execPath),
      "..",
      "Frameworks",
      "better_sqlite3.node"
    );
    expect(
      resolveBundledNativeAddonPath("darwin", execPath, (p) => p === expected)
    ).toBe(expected);
  });

  it("returns null on darwin when Frameworks addon is absent and on non-darwin", () => {
    expect(
      resolveBundledNativeAddonPath(
        "darwin",
        "/Applications/Game Library Manager.app/Contents/MacOS/Game Library Manager",
        () => false
      )
    ).toBeNull();
    expect(
      resolveBundledNativeAddonPath(
        "win32",
        "C:\\Apps\\Game Library Manager.exe",
        () => true
      )
    ).toBeNull();
  });
});

async function startMockHttpServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<string> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  cleanups.push(() => {
    server.close();
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Unexpected mock server address");
  }
  return `http://127.0.0.1:${addr.port}`;
}

describe("Bulk checker, /fast change check, and Refresh All version detection", () => {
  it("chunks fetchBulkVersions requests at 100 IDs max, forwards session headers, and handles missing threads", async () => {
    const requestedChunks: number[][] = [];
    const seenCookies: Array<string | undefined> = [];

    const baseUrl = await startMockHttpServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      const threadsParam = reqUrl.searchParams.get("threads") ?? "";
      const ids = threadsParam
        .split(",")
        .filter(Boolean)
        .map((s) => Number(s));
      requestedChunks.push(ids);
      seenCookies.push(req.headers.cookie);

      if (ids.length > 100) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({ status: "error", msg: "Invalid threads data or >100" })
        );
        return;
      }

      if (ids.length === 50) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "error", msg: "Thread not found" }));
        return;
      }

      const msg: Record<string, string> = {};
      for (const id of ids) {
        msg[String(id)] = id === 1 ? "Unknown" : `v${id}.0`;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", msg }));
    });

    const ids = Array.from({ length: 250 }, (_, idx) => idx + 1);
    const versions = await fetchBulkVersions(
      [...ids, 1, 2],
      { Cookie: "xf_user=session123", "User-Agent": "TestAgent/2.0" },
      (chunk) => `${baseUrl}/sam/checker.php?threads=${chunk.join(",")}`
    );

    expect(requestedChunks.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(seenCookies).toEqual([
      "xf_user=session123",
      "xf_user=session123",
      "xf_user=session123",
    ]);
    expect(versions.has(1)).toBe(false);
    expect(versions.get(2)).toBe("v2.0");
    expect(versions.get(200)).toBe("v200.0");
    expect(versions.size).toBe(199);
  });

  it("chunks fetchFastCheckTimestamps at 10 IDs max and filters invalid thread IDs", async () => {
    const requestedChunks: number[][] = [];

    const baseUrl = await startMockHttpServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      const ids = (reqUrl.searchParams.get("ids") ?? "")
        .split(",")
        .filter(Boolean)
        .map((s) => Number(s));
      requestedChunks.push(ids);

      const payload: Record<string, number> = {};
      for (const id of ids) {
        payload[String(id)] = 1_790_000_000 + id;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    });

    const ids = [
      -5,
      0,
      1_500_000,
      ...Array.from({ length: 12 }, (_, i) => i + 101),
      101,
    ];
    const timestamps = await fetchFastCheckTimestamps(ids, baseUrl);

    expect(requestedChunks.map((c) => c.length)).toEqual([10, 2]);
    expect(timestamps.get(101)).toBe(1_790_000_101);
    expect(timestamps.get(112)).toBe(1_790_000_112);
    expect(timestamps.size).toBe(12);
  });

  it("checks bulk versions and reference /fast timestamps during Refresh All (force=false), advances lastUpdatedTsSec, and preserves new bulk version on scrape failure", async () => {
    const { conn, coversDir } = createTempDb();
    const cipher = createAesGcmCipher(crypto.randomBytes(32));
    const events: SseEvent[] = [];

    const nowMs = 1_800_000_000_000;
    const futureExpiryMs = nowMs + 7 * 24 * 60 * 60 * 1000;
    const staleCheckedAtMs = nowMs - 2 * 60 * 60 * 1000;

    conn.db
      .insert(schema.games)
      .values([
        {
          id: 701,
          custom: false,
          name: "Bulk Updated Game",
          version: "v0.10",
          installedVersion: "v0.10",
          status: Status.Normal,
          type: Type.RenPy,
          lastCheckedAtMs: staleCheckedAtMs,
          lastUpdatedTsSec: 1_700_000_000,
          addedAtMs: 1000,
        },
        {
          id: 702,
          custom: false,
          name: "Fast Updated Game",
          version: "v1.0",
          installedVersion: "v1.0",
          status: Status.Normal,
          type: Type.Unity,
          lastCheckedAtMs: staleCheckedAtMs,
          lastUpdatedTsSec: 1_700_000_000,
          addedAtMs: 1000,
        },
        {
          id: 703,
          custom: false,
          name: "Unchanged Cached Game",
          version: "v2.0",
          status: Status.Normal,
          type: Type.HTML,
          lastCheckedAtMs: staleCheckedAtMs,
          lastUpdatedTsSec: 1_700_000_000,
          addedAtMs: 1000,
        },
        {
          id: 704,
          custom: false,
          name: "Scrape Failed But Bulk Updated",
          version: "v3.0",
          installedVersion: "v3.0",
          status: Status.Normal,
          type: Type.RenPy,
          lastCheckedAtMs: staleCheckedAtMs,
          lastUpdatedTsSec: 1_700_000_000,
          addedAtMs: 1000,
        },
      ])
      .run();

    conn.db
      .insert(schema.gameMetadata)
      .values([
        { gameId: 701, expiresAtMs: futureExpiryMs, updatedAtMs: staleCheckedAtMs },
        { gameId: 702, expiresAtMs: futureExpiryMs, updatedAtMs: staleCheckedAtMs },
        { gameId: 703, expiresAtMs: futureExpiryMs, updatedAtMs: staleCheckedAtMs },
        { gameId: 704, expiresAtMs: futureExpiryMs, updatedAtMs: staleCheckedAtMs },
      ])
      .run();

    const scrapedIds: number[] = [];
    const fastRequestedIds: number[][] = [];
    const job = createJobRecord(conn.db, "bulk_refresh", 4, { force: false });

    const processor = new IndexJobProcessor({
      db: conn.db,
      sqlite: conn.sqlite,
      coversDir,
      cipher,
      emitEvent: (ev) => events.push(ev),
      fetchBulkVersions: async () =>
        new Map([
          [701, "v0.11"],
          [703, "v2.0"],
          [704, "v3.1"],
        ]),
      fetchFastTimestamps: async (ids) => {
        fastRequestedIds.push(ids);
        return new Map([[702, Math.floor(nowMs / 1000) - 60]]);
      },
      fetchMetadata: async ({ threadId, knownBulkVersion }) => {
        scrapedIds.push(threadId);
        if (threadId === 704) {
          return {
            ok: false,
            error: { flag: "F95ZONE_UNAVAILABLE", retryDelayMs: 900_000 },
          };
        }
        return {
          ok: true,
          source: "direct",
          data: makeScrapedData({
            name: `Game ${threadId}`,
            version: knownBulkVersion ?? (threadId === 702 ? "v1.1" : "v0.11"),
            lastUpdated: 1_700_000_000,
          }),
        };
      },
      now: () => nowMs,
    });

    await processor.processJob(job.id, "bulk_refresh", undefined, false);

    // Only 702 was unresolved by bulk checker, so /fast should query [702]
    expect(fastRequestedIds).toEqual([[702]]);
    // Unchanged cached game 703 is skipped; 701, 702, and 704 are checked
    expect(scrapedIds).toEqual([701, 702, 704]);

    const game701 = conn.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, 701))
      .get();
    expect(game701).toMatchObject({
      version: "v0.11",
      hasUpdate: true,
    });
    expect(game701?.lastUpdatedTsSec).toBeGreaterThan(1_700_000_000);

    const game702 = conn.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, 702))
      .get();
    expect(game702).toMatchObject({
      version: "v1.1",
      hasUpdate: true,
    });

    const game704 = conn.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, 704))
      .get();
    expect(game704).toMatchObject({
      version: "v3.1",
      hasUpdate: true,
    });
    const meta704 = conn.db
      .select()
      .from(schema.gameMetadata)
      .where(eq(schema.gameMetadata.gameId, 704))
      .get();
    expect(meta704?.expiresAtMs).toBe(0);

    expect(
      events.find((e) => e.type === "job_completed")
    ).toMatchObject({
      type: "job_completed",
      job: {
        status: "completed",
        processedCount: 4,
        updatedCount: 3,
        errorCount: 1,
      },
    });
  });

  it("prefers knownBulkVersion over stale cached version in CacheApiMetadataProvider", async () => {
    const baseUrl = await startMockHttpServer((req, res) => {
      if (req.url?.startsWith("/fast")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ "888": 1_790_000_000 }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          name: "Cached Game",
          version: "v0.9",
          developer: "Dev",
          type: "14",
          status: "1",
          last_updated: "1790000000",
          score: "4.5",
          votes: "10",
          description: "desc",
          changelog: "",
          tags: "[]",
          unknown_tags: "[]",
          image_url: "missing",
          previews_urls: "[]",
          downloads: "[]",
          reviews_total: "0",
          reviews: "[]",
        })
      );
    });

    const provider = new CacheApiMetadataProvider(baseUrl);
    const res = await provider.fetchThread({
      threadId: 888,
      knownBulkVersion: "v0.10",
      session: null,
      forumQueue: new PQueue({ concurrency: 1 }),
    });

    expect(res).toMatchObject({
      ok: true,
      source: "cache_api",
      data: {
        name: "Cached Game",
        version: "v0.10",
        threadVersion: "v0.9",
      },
    });
  });
});
