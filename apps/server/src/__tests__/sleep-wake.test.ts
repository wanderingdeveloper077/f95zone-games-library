import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerConfig } from "../config.js";
import { openDatabase } from "../db/index.js";
import * as schema from "../db/schema.js";
import {
  createSleepWakeServer,
  type SleepWakeServer,
} from "../runtime/sleepWakeServer.js";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle"
);

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

function makeTestConfig(): ServerConfig {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gl-sleep-wake-"));
  const coversDir = path.join(dataDir, "covers");
  const webDistDir = path.join(dataDir, "web-empty");
  fs.mkdirSync(coversDir, { recursive: true });
  fs.mkdirSync(webDistDir, { recursive: true });

  cleanups.push(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  return {
    host: "127.0.0.1",
    port: 0,
    dataDir,
    gamesDir: path.join(dataDir, "games"),
    dbPath: path.join(dataDir, "library.db"),
    coversDir,
    masterKeyPath: path.join(dataDir, ".master.key"),
    pairingTokenPath: path.join(dataDir, ".pairing.token"),
    webDistDir,
    migrationsDir,
    isDev: false,
    appVersion: "1.0.0-test",
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5000,
  stepMs = 40
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

function connectSse(port: number): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      `http://127.0.0.1:${port}/api/events`,
      { headers: { Accept: "text/event-stream" } },
      (res) => {
        res.once("data", () => {
          resolve(() => {
            res.destroy();
            req.destroy();
          });
        });
        res.on("error", () => {
          // Expected when test destroys the SSE stream.
        });
      }
    );
    req.on("error", reject);
  });
}

describe("SleepWakeServer idle shutdown and auto-wake", () => {
  it("suspends Fastify/SQLite/Worker when the last dashboard SSE tab closes, serves sleeping health & extension bootstrap, and auto-wakes on dashboard activity", async () => {
    const config = makeTestConfig();
    const gateway: SleepWakeServer = createSleepWakeServer(config, {
      idleGraceMs: 120,
      unattachedWakeGraceMs: 5000,
      startWorker: false,
    });
    cleanups.push(() => gateway.shutdown());

    const port = await gateway.listen();
    expect(gateway.getState()).toBe("awake");

    const closeSse = await connectSse(port);
    closeSse();

    await waitFor(() => gateway.getState() === "sleeping", 4000);
    expect(gateway.getState()).toBe("sleeping");

    const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(healthRes.status).toBe(200);
    expect(await healthRes.json()).toMatchObject({
      status: "sleeping",
      sseClients: 0,
    });
    expect(gateway.getState()).toBe("sleeping");

    const token = fs.readFileSync(config.pairingTokenPath, "utf8").trim();
    const unauthorizedBootstrap = await fetch(
      `http://127.0.0.1:${port}/api/extension/bootstrap`,
      { headers: { "X-Pairing-Token": "wrong-token" } }
    );
    expect(unauthorizedBootstrap.status).toBe(401);
    expect(gateway.getState()).toBe("sleeping");

    const bootstrapRes = await fetch(
      `http://127.0.0.1:${port}/api/extension/bootstrap`,
      { headers: { "X-Pairing-Token": token } }
    );
    expect(bootstrapRes.status).toBe(200);
    expect(await bootstrapRes.json()).toMatchObject({
      games: [],
      settings: { iconGlow: true },
    });
    expect(gateway.getState()).toBe("sleeping");

    const gamesRes = await fetch(`http://127.0.0.1:${port}/api/games`);
    expect(gamesRes.status).toBe(200);
    expect(await gamesRes.json()).toMatchObject({
      games: [],
      total: 0,
      hasMore: false,
    });
    expect(gateway.getState()).toBe("awake");

    const awakeHealth = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(awakeHealth.status).toBe(200);
    expect(await awakeHealth.json()).toMatchObject({
      status: "ok",
      journalMode: "wal",
    });
  });

  it("waits for active indexing/import jobs to finish before going to sleep", async () => {
    const config = makeTestConfig();
    const gateway = createSleepWakeServer(config, {
      idleGraceMs: 100,
      unattachedWakeGraceMs: 5000,
      startWorker: false,
    });
    cleanups.push(() => gateway.shutdown());

    const port = await gateway.listen();
    const closeSse = await connectSse(port);

    const conn = openDatabase(config.dbPath);
    conn.db
      .insert(schema.indexJobs)
      .values({
        id: "active-job-1",
        kind: "bulk_refresh",
        status: "running",
        totalCount: 5,
        processedCount: 2,
        updatedCount: 1,
        errorCount: 0,
        payloadJson: "{}",
        errorSummary: null,
        createdAtMs: Date.now(),
        startedAtMs: Date.now(),
        finishedAtMs: null,
      })
      .run();
    conn.sqlite.close();

    closeSse();

    // Even after idleGraceMs expires, active job keeps the server awake.
    await new Promise((r) => setTimeout(r, 350));
    expect(gateway.getState()).toBe("awake");

    const connDone = openDatabase(config.dbPath);
    connDone.db
      .update(schema.indexJobs)
      .set({ status: "completed", finishedAtMs: Date.now() })
      .where(eq(schema.indexJobs.id, "active-job-1"))
      .run();
    connDone.sqlite.close();

    await waitFor(() => gateway.getState() === "sleeping", 5000);
    expect(gateway.getState()).toBe("sleeping");
  });
});
