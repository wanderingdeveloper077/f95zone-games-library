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

  it("supports limit/offset pagination metadata on GET /api/games", async () => {
    const { app } = await createTestServer();

    await app.inject({
      method: "POST",
      url: "/api/games",
      payload: { custom: true, name: "Alpha Game", version: "1.0" },
    });
    await app.inject({
      method: "POST",
      url: "/api/games",
      payload: { custom: true, name: "Beta Game", version: "1.0" },
    });

    const page1 = await app.inject({
      method: "GET",
      url: "/api/games?sort=name&dir=asc&limit=1&offset=0",
    });
    expect(page1.statusCode).toBe(200);
    expect(page1.json()).toMatchObject({
      total: 2,
      hasMore: true,
      nextOffset: 1,
    });
    expect(page1.json().games).toHaveLength(1);
    expect(page1.json().games[0].name).toBe("Alpha Game");

    const page2 = await app.inject({
      method: "GET",
      url: "/api/games?sort=name&dir=asc&limit=1&offset=1",
    });
    expect(page2.statusCode).toBe(200);
    expect(page2.json()).toMatchObject({
      total: 2,
      hasMore: false,
      nextOffset: null,
    });
    expect(page2.json().games).toHaveLength(1);
    expect(page2.json().games[0].name).toBe("Beta Game");
  });

  it("filters GET /api/games by installed, finished, and tags", async () => {
    const { app } = await createTestServer();

    const g1Res = await app.inject({
      method: "POST",
      url: "/api/games",
      payload: { custom: true, name: "Installed Finished", version: "1.0" },
    });
    const g1Id = g1Res.json().added[0].id as number;
    await app.inject({
      method: "PATCH",
      url: `/api/games/${g1Id}`,
      payload: { installedVersion: "1.0", finishedVersion: "1.0" },
    });

    const g2Res = await app.inject({
      method: "POST",
      url: "/api/games",
      payload: { custom: true, name: "Outdated Unfinished", version: "2.0" },
    });
    const g2Id = g2Res.json().added[0].id as number;
    await app.inject({
      method: "PATCH",
      url: `/api/games/${g2Id}`,
      payload: { installedVersion: "1.0" },
    });

    await app.inject({
      method: "POST",
      url: "/api/games",
      payload: { custom: true, name: "Not Installed", version: "1.0" },
    });

    const upToDate = await app.inject({
      method: "GET",
      url: "/api/games?installed=up_to_date",
    });
    expect(upToDate.json().games.map((g: { name: string }) => g.name)).toEqual([
      "Installed Finished",
    ]);

    const outdated = await app.inject({
      method: "GET",
      url: "/api/games?installed=outdated",
    });
    expect(outdated.json().games.map((g: { name: string }) => g.name)).toEqual([
      "Outdated Unfinished",
    ]);

    const notInstalled = await app.inject({
      method: "GET",
      url: "/api/games?installed=not_installed",
    });
    expect(
      notInstalled.json().games.map((g: { name: string }) => g.name)
    ).toEqual(["Not Installed"]);

    const finished = await app.inject({
      method: "GET",
      url: "/api/games?finished=finished",
    });
    expect(finished.json().games.map((g: { name: string }) => g.name)).toEqual([
      "Installed Finished",
    ]);

    const tagFiltered = await app.inject({
      method: "GET",
      url: "/api/games?tags=999999",
    });
    expect(tagFiltered.json().games).toEqual([]);
  });

  it("serves cached gallery images safely and exposes galleryFiles in GET /api/games/:id", async () => {
    const { app, config } = await createTestServer();

    const created = await app.inject({
      method: "POST",
      url: "/api/games",
      payload: { custom: true, name: "Gallery API Game", version: "1.0" },
    });
    const gameId = created.json().added[0].id as number;

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/games/${gameId}`,
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().game.galleryFiles).toEqual([]);

    const galleryDir = path.join(config.coversDir, "gallery", String(gameId));
    fs.mkdirSync(galleryDir, { recursive: true });
    const pngStub = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    fs.writeFileSync(path.join(galleryDir, "sample.png"), pngStub);

    const imgRes = await app.inject({
      method: "GET",
      url: `/covers/gallery/${gameId}/sample.png`,
    });
    expect(imgRes.statusCode).toBe(200);
    expect(imgRes.headers["content-type"]).toBe("image/png");
    expect(imgRes.headers["cache-control"]).toBe("public, max-age=86400");

    const traversal = await app.inject({
      method: "GET",
      url: `/covers/gallery/${gameId}/..%2F..%2Flibrary.db`,
    });
    expect(traversal.statusCode).toBe(400);
  });

  it("defaults downloadGalleryImages to true, sfwMode to false, and theme to dark, and persists updates via PATCH /api/settings", async () => {
    const { app } = await createTestServer();

    const getInitial = await app.inject({
      method: "GET",
      url: "/api/settings",
    });
    expect(getInitial.statusCode).toBe(200);
    expect(getInitial.json().settings.downloadGalleryImages).toBe(true);
    expect(getInitial.json().settings.sfwMode).toBe(false);
    expect(getInitial.json().settings.theme).toBe("dark");

    const patched = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      payload: {
        downloadGalleryImages: false,
        sfwMode: true,
        theme: "catppuccin",
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().settings.downloadGalleryImages).toBe(false);
    expect(patched.json().settings.sfwMode).toBe(true);
    expect(patched.json().settings.theme).toBe("catppuccin");

    const getAfter = await app.inject({
      method: "GET",
      url: "/api/settings",
    });
    expect(getAfter.statusCode).toBe(200);
    expect(getAfter.json().settings.downloadGalleryImages).toBe(false);
    expect(getAfter.json().settings.sfwMode).toBe(true);
    expect(getAfter.json().settings.theme).toBe("catppuccin");
  });
});
