import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { ExtensionBootstrapResponse } from "@game-library/shared";
import { type BuiltApp, buildApp } from "../app.js";
import { isAllowedCorsOrigin, type PairingManager } from "../auth/pairing.js";
import type { ServerConfig } from "../config.js";

export type ServerLifecycleState =
  | "awake"
  | "suspending"
  | "sleeping"
  | "waking";

export interface SleepWakeServerOptions {
  /** Delay after the last dashboard SSE client closes before suspending (default: 3500ms). */
  idleGraceMs?: number;
  /** Delay after an API-only wake or startup without an SSE dashboard client (default: 15000ms). */
  unattachedWakeGraceMs?: number;
  startWorker?: boolean;
}

export interface SleepWakeServer {
  listen: () => Promise<number>;
  getState: () => ServerLifecycleState;
  shutdown: () => Promise<void>;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

function applySleepingCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  port: number,
  isDev: boolean
): boolean {
  const origin = req.headers.origin;
  if (!isAllowedCorsOrigin(origin, port, isDev)) {
    sendJson(res, 403, {
      error: {
        code: "FORBIDDEN",
        message: "Origin not allowed by CORS policy",
      },
    });
    return false;
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Pairing-Token, X-Requested-With"
    );
  }
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  return true;
}

/**
 * Coordinates automatic sleep and wake around a persistent `127.0.0.1` HTTP socket:
 * closing all dashboard tabs tears down Fastify, SQLite, and the indexer worker once
 * active jobs complete, while reopening the dashboard URL wakes them transparently.
 */
export function createSleepWakeServer(
  config: ServerConfig,
  options?: SleepWakeServerOptions
): SleepWakeServer {
  const idleGraceMs = options?.idleGraceMs ?? 3500;
  const unattachedWakeGraceMs = options?.unattachedWakeGraceMs ?? 15000;
  const startWorker = options?.startWorker ?? true;

  let boundPort = config.port;
  let state: ServerLifecycleState = "sleeping";
  let built: BuiltApp | null = null;
  let unsubClientCount: (() => void) | null = null;
  let unsubBroadcast: (() => void) | null = null;
  let cachedBootstrap: ExtensionBootstrapResponse | null = null;
  let cachedPairing: PairingManager | null = null;

  let idleTimer: NodeJS.Timeout | null = null;
  let jobPollTimer: NodeJS.Timeout | null = null;
  let suspendingPromise: Promise<void> | null = null;
  let wakePromise: Promise<BuiltApp> | null = null;
  let hadDashboardClient = false;
  let loggedWaitingForJob = false;
  let disposed = false;

  const clearTimers = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (jobPollTimer) {
      clearTimeout(jobPollTimer);
      jobPollTimer = null;
    }
  };

  const scheduleIdleCheck = (delayMs: number) => {
    if (disposed || state !== "awake") return;
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      idleTimer = null;
      void evaluateIdle();
    }, delayMs);
    idleTimer.unref?.();
  };

  const scheduleJobPoll = () => {
    if (disposed || state !== "awake" || jobPollTimer) return;
    jobPollTimer = setTimeout(() => {
      jobPollTimer = null;
      void evaluateIdle();
    }, 2000);
    jobPollTimer.unref?.();
  };

  const suspendNow = async (): Promise<void> => {
    if (suspendingPromise) return suspendingPromise;
    if (state !== "awake" || !built) return;

    suspendingPromise = (async () => {
      clearTimers();
      state = "suspending";
      loggedWaitingForJob = false;

      const target = built;
      built = null;

      unsubClientCount?.();
      unsubClientCount = null;
      unsubBroadcast?.();
      unsubBroadcast = null;

      if (target) {
        try {
          cachedBootstrap = target.getExtensionBootstrapSnapshot();
          cachedPairing = target.pairing;
        } catch {
          // Retain previous snapshot if DB was already closing.
        }
        try {
          await target.closeResources();
        } catch (err) {
          console.error("[server] Error during idle shutdown:", err);
        }
      }

      hadDashboardClient = false;
      state = "sleeping";
      console.log(
        "[server] Dashboard closed; Fastify, SQLite, and worker shut down (auto-wake listening)."
      );
    })();

    try {
      await suspendingPromise;
    } finally {
      suspendingPromise = null;
    }
  };

  const evaluateIdle = async (): Promise<void> => {
    if (disposed || state !== "awake" || !built) return;
    if (built.sseHub.clientCount > 0) return;

    if (built.hasActiveJobs()) {
      if (!loggedWaitingForJob) {
        loggedWaitingForJob = true;
        console.log(
          "[server] Dashboard closed while an indexing job is active; waiting for completion before sleep."
        );
      }
      scheduleJobPoll();
      return;
    }

    await suspendNow();
  };

  const startAppInstance = async (): Promise<BuiltApp> => {
    const nextBuilt = await buildApp(
      { ...config, port: boundPort },
      { startWorker }
    );
    await nextBuilt.app.ready();

    unsubClientCount = nextBuilt.sseHub.onClientCountChange((count) => {
      if (count > 0) {
        hadDashboardClient = true;
        loggedWaitingForJob = false;
        clearTimers();
      } else if (state === "awake") {
        scheduleIdleCheck(hadDashboardClient ? idleGraceMs : unattachedWakeGraceMs);
      }
    });

    unsubBroadcast = nextBuilt.sseHub.onBroadcast((event) => {
      if (
        (event.type === "job_completed" || event.type === "job_failed") &&
        nextBuilt.sseHub.clientCount === 0 &&
        state === "awake"
      ) {
        if (jobPollTimer) {
          clearTimeout(jobPollTimer);
          jobPollTimer = null;
        }
        scheduleIdleCheck(idleGraceMs);
      }
    });

    cachedPairing = nextBuilt.pairing;
    built = nextBuilt;
    return nextBuilt;
  };

  const ensureAwake = async (): Promise<BuiltApp> => {
    if (disposed) {
      throw new Error("Server is shutting down.");
    }
    if (state === "awake" && built) {
      return built;
    }
    if (suspendingPromise) {
      await suspendingPromise;
    }
    if (state === "awake" && built) {
      return built;
    }
    if (wakePromise) {
      return wakePromise;
    }

    state = "waking";
    wakePromise = (async () => {
      try {
        const nextBuilt = await startAppInstance();
        hadDashboardClient = false;
        loggedWaitingForJob = false;
        state = "awake";
        scheduleIdleCheck(unattachedWakeGraceMs);
        console.log(
          "[server] Activity detected; Fastify, SQLite, and worker restarted."
        );
        return nextBuilt;
      } catch (err) {
        state = "sleeping";
        throw err;
      }
    })();

    try {
      return await wakePromise;
    } finally {
      wakePromise = null;
    }
  };

  const httpServer: http.Server = http.createServer((req, res) => {
    void (async () => {
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;

      if (state === "sleeping" || state === "suspending") {
        if (
          req.method === "OPTIONS" &&
          (pathname === "/api/health" || pathname === "/api/extension/bootstrap")
        ) {
          if (!applySleepingCorsHeaders(req, res, boundPort, config.isDev)) {
            return;
          }
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === "GET" && pathname === "/api/health") {
          if (!applySleepingCorsHeaders(req, res, boundPort, config.isDev)) {
            return;
          }
          sendJson(res, 200, {
            status: "sleeping",
            journalMode: "wal",
            busyTimeout: 5000,
            port: boundPort,
            version: config.appVersion,
            sseClients: 0,
          });
          return;
        }

        if (
          req.method === "GET" &&
          pathname === "/api/extension/bootstrap" &&
          cachedBootstrap &&
          cachedPairing
        ) {
          if (!applySleepingCorsHeaders(req, res, boundPort, config.isDev)) {
            return;
          }
          if (!cachedPairing.verifyHeaderToken(req.headers["x-pairing-token"])) {
            sendJson(res, 401, {
              error: {
                code: "INVALID_PAIRING_TOKEN",
                message: "Missing or invalid X-Pairing-Token header.",
              },
            });
            return;
          }
          sendJson(res, 200, cachedBootstrap);
          return;
        }
      }

      const active =
        state === "awake" && built ? built : await ensureAwake();

      if (active.sseHub.clientCount === 0 && pathname !== "/api/health") {
        scheduleIdleCheck(
          hadDashboardClient ? idleGraceMs : unattachedWakeGraceMs
        );
      }

      active.app.routing(req, res);
    })().catch((err) => {
      console.error("[server] Gateway request error:", err);
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: {
            code: "INTERNAL_ERROR",
            message:
              err instanceof Error ? err.message : "Failed to wake server.",
          },
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  });

  const listen = async (): Promise<number> => {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        httpServer.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        httpServer.off("error", onError);
        resolve();
      };
      httpServer.once("error", onError);
      httpServer.once("listening", onListening);
      httpServer.listen(config.port, config.host);
    });

    const address = httpServer.address();
    if (address && typeof address === "object") {
      boundPort = address.port;
    }

    try {
      await startAppInstance();
      state = "awake";
      scheduleIdleCheck(unattachedWakeGraceMs);
      return boundPort;
    } catch (err) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      throw err;
    }
  };

  const shutdown = async (): Promise<void> => {
    disposed = true;
    clearTimers();
    if (suspendingPromise) {
      await suspendingPromise;
    }
    if (wakePromise) {
      await wakePromise.catch(() => undefined);
    }

    unsubClientCount?.();
    unsubClientCount = null;
    unsubBroadcast?.();
    unsubBroadcast = null;

    if (built) {
      const toClose = built;
      built = null;
      await toClose.closeResources();
    }

    httpServer.closeAllConnections?.();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    state = "sleeping";
  };

  return {
    listen,
    getState: () => state,
    shutdown,
  };
}
