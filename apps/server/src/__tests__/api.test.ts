import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { resolveConfig } from "../config.js";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle"
);

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const fn = cleanups.pop()!;
    await fn();
  }
});

async function createTestServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gl-api-test-"));
  const config = resolveConfig({
    dataDir,
    migrationsDir,
    webDistDir: path.join(dataDir, "nonexistent-web"),
    isDev: false,
    port: 57095,
  });

  const built = await buildApp(config, { startWorker: false });
  cleanups.push(async () => {
    await built.closeResources();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  return { ...built, config };
}

describe("Fastify API security, pairing, CRUD, and static protection", () => {
  it("reports WAL health and rejects unknown /api/* routes with JSON 404", async () => {
    const { app } = await createTestServer();

    const health = await app.inject({ method: "GET", url: "/api/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: "ok",
      journalMode: "wal",
      busyTimeout: 5000,
    });

    const missing = await app.inject({ method: "GET", url: "/api/unknown" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("NOT_FOUND");
  });

  it("enforces CORS allowlist, PNA preflight headers, and Pairing Token auth", async () => {
    const { app } = await createTestServer();

    // Extension origin preflight with Private Network Access
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/extension/bootstrap",
      headers: {
        origin: "chrome-extension://abcdefabcdefabcdefabcdefabcdefab",
        "access-control-request-method": "GET",
        "access-control-request-private-network": "true",
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe(
      "chrome-extension://abcdefabcdefabcdefabcdefabcdefab"
    );
    expect(preflight.headers["access-control-allow-private-network"]).toBe(
      "true"
    );

    // Foreign web origin is rejected
    const evilCors = await app.inject({
      method: "GET",
      url: "/api/games",
      headers: { origin: "https://evil.example.com" },
    });
    expect(evilCors.statusCode).toBe(403);

    // Missing or wrong pairing token fails with 401
    const unauth = await app.inject({
      method: "GET",
      url: "/api/extension/bootstrap",
    });
    expect(unauth.statusCode).toBe(401);

    // Pairing code create + exchange flow
    const codeResp = await app.inject({
      method: "POST",
      url: "/api/pairing/code",
    });
    expect(codeResp.statusCode).toBe(200);
    const { code } = codeResp.json() as { code: string };

    const exchangeResp = await app.inject({
      method: "POST",
      url: "/api/pairing/exchange",
      payload: { code },
    });
    expect(exchangeResp.statusCode).toBe(200);
    const { pairingToken } = exchangeResp.json() as { pairingToken: string };
    expect(pairingToken.length).toBeGreaterThanOrEqual(32);

    // Sync encrypted cookies with valid token
    const syncResp = await app.inject({
      method: "POST",
      url: "/api/accounts/f95zone/session",
      headers: { "x-pairing-token": pairingToken },
      payload: {
        cookies: [
          {
            name: "xf_user",
            value: "42_supersecret",
            domain: ".f95zone.to",
            path: "/",
          },
          {
            name: "cf_clearance",
            value: "cf_token_val",
            domain: ".f95zone.to",
            path: "/",
          },
        ],
        userAgent: "Mozilla/5.0 TestBrowser",
      },
    });
    expect(syncResp.statusCode).toBe(200);
    expect(syncResp.json().account).toMatchObject({
      status: "active",
      hasXfUser: true,
      hasCfClearance: true,
      cookieCount: 2,
    });
  });

  it("supports game CRUD and rejects path traversal on /covers/", async () => {
    const { app } = await createTestServer();

    const createCustom = await app.inject({
      method: "POST",
      url: "/api/games",
      payload: {
        custom: true,
        name: "Local Visual Novel",
        version: "1.2",
        developer: "Indie Dev",
      },
    });
    expect(createCustom.statusCode).toBe(201);
    const createdId = createCustom.json().added[0].id as number;
    expect(createdId).toBeLessThan(0);

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/games/${createdId}`,
      payload: { installedVersion: "1.2", rating: 4.5, notes: "Great story" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().game).toMatchObject({
      installedVersion: "1.2",
      hasUpdate: false,
      rating: 4.5,
      notes: "Great story",
    });

    const traversal = await app.inject({
      method: "GET",
      url: "/covers/..%2Flibrary.db",
    });
    expect(traversal.statusCode).toBe(400);
  });
});
