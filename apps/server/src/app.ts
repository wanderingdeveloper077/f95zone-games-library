import fs from "node:fs";
import path from "node:path";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import {
  PairingManager,
  createPairingTokenGuard,
  isAllowedCorsOrigin,
  requireLocalUiOrigin,
} from "./auth/pairing.js";
import type { ServerConfig } from "./config.js";
import { createAesGcmCipher, loadOrCreateMasterKey } from "./db/crypto.js";
import { initializeDatabase, openDatabase } from "./db/index.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerCoverRoutes } from "./routes/covers.js";
import { registerGameRoutes } from "./routes/games.js";
import { registerPairingRoutes } from "./routes/pairing.js";
import { registerSystemRoutes } from "./routes/system.js";
import { AccountsService } from "./services/accountsService.js";
import { LocalCoverStorage } from "./services/coverStorage.js";
import { LocalGameLauncher } from "./services/gameLauncher.js";
import { GamesService } from "./services/gamesService.js";
import { OsNativeFilePicker } from "./services/nativeFilePicker.js";
import { SettingsService } from "./services/settingsService.js";
import { SseHub } from "./sse/hub.js";
import { IndexerWorkerManager } from "./worker/manager.js";

export interface BuiltApp {
  app: FastifyInstance;
  sseHub: SseHub;
  worker: IndexerWorkerManager;
  pairing: PairingManager;
  closeResources: () => Promise<void>;
}

export async function buildApp(
  config: ServerConfig,
  options?: { startWorker?: boolean }
): Promise<BuiltApp> {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.coversDir, { recursive: true });

  const conn = openDatabase(config.dbPath, config.nativeBindingPath);
  initializeDatabase(conn, config.migrationsDir);

  const masterKey = loadOrCreateMasterKey(config.masterKeyPath);
  const cipher = createAesGcmCipher(masterKey);
  const coverStorage = new LocalCoverStorage(config.coversDir);
  const pairing = new PairingManager(config.pairingTokenPath);
  const sseHub = new SseHub();
  const worker = new IndexerWorkerManager(config, sseHub);

  const settingsService = new SettingsService({ db: conn.db });
  const accountsService = new AccountsService({
    db: conn.db,
    cipher,
    broadcaster: sseHub,
  });
  const gamesService = new GamesService({
    db: conn.db,
    sqlite: conn.sqlite,
    coverCleaner: coverStorage,
    jobDispatcher: worker,
    broadcaster: sseHub,
    gameLauncher: new LocalGameLauncher(),
  });
  const filePicker = new OsNativeFilePicker();

  if (options?.startWorker !== false) {
    worker.start();
  }

  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (isAllowedCorsOrigin(origin, config.port, config.isDev)) {
        cb(null, true);
      } else {
        const err = new Error("Origin not allowed by CORS policy") as Error & {
          statusCode?: number;
        };
        err.statusCode = 403;
        cb(err, false);
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Pairing-Token", "X-Requested-With"],
  });

  // Chrome Private Network Access preflight support
  app.addHook("onSend", async (request, reply, payload) => {
    if (
      request.headers["access-control-request-private-network"] === "true"
    ) {
      reply.header("Access-Control-Allow-Private-Network", "true");
    }
    return payload;
  });

  const requirePairingToken = createPairingTokenGuard(pairing);

  registerSystemRoutes(app, {
    healthInfo: {
      journalMode: conn.journalMode,
      busyTimeout: conn.busyTimeout,
      port: config.port,
      appVersion: config.appVersion,
    },
    db: conn.db,
    settingsService,
    jobCanceller: worker,
    sseRegistry: sseHub,
    filePicker,
    isAllowedOrigin: (origin) =>
      isAllowedCorsOrigin(origin, config.port, config.isDev),
    requirePairingToken,
    requireLocalUiOrigin,
  });

  registerCoverRoutes(app, {
    coverResolver: coverStorage,
  });

  registerPairingRoutes(app, {
    pairing,
    requireLocalUiOrigin,
  });

  registerAccountRoutes(app, {
    accountsService,
    requirePairingToken,
    requireLocalUiOrigin,
  });

  registerGameRoutes(app, {
    gamesService,
    requirePairingToken,
    requireLocalUiOrigin,
  });

  const hasWebDist =
    fs.existsSync(config.webDistDir) &&
    fs.existsSync(path.join(config.webDistDir, "index.html"));

  if (hasWebDist) {
    await app.register(fastifyStatic, {
      root: config.webDistDir,
      prefix: "/",
      wildcard: false,
    });
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (
      hasWebDist &&
      request.method === "GET" &&
      !request.url.startsWith("/api/") &&
      !request.url.startsWith("/covers/")
    ) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found.`,
      },
    });
  });

  const closeResources = async () => {
    sseHub.closeAll();
    await worker.shutdown();
    await app.close();
    conn.sqlite.close();
  };

  return { app, sseHub, worker, pairing, closeResources };
}
