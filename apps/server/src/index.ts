import { resolveConfig } from "./config.js";
import { isBundledApp } from "./runtime/embedded.js";
import { openBrowser } from "./runtime/openBrowser.js";
import { createSleepWakeServer } from "./runtime/sleepWakeServer.js";

async function main() {
  const config = resolveConfig();
  const exitOnIdle = process.env.EXIT_ON_IDLE !== "0";
  const gateway = createSleepWakeServer(config, {
    exitOnIdle,
    idleGraceMs: 2000,
    unattachedWakeGraceMs: 30_000,
    onIdleExit: () => {
      console.log(
        "[server] Dashboard closed; terminating Game Library Manager process."
      );
      process.exit(0);
    },
  });
  const appUrl = `http://${config.host}:${config.port}/`;
  const shouldOpenBrowser =
    process.env.OPEN_BROWSER !== undefined
      ? process.env.OPEN_BROWSER === "1"
      : isBundledApp();

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await gateway.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    await gateway.listen();
  } catch (err) {
    const errCode =
      err && typeof err === "object" && "code" in err ? err.code : undefined;
    if (errCode === "EADDRINUSE" && isBundledApp()) {
      console.error(
        `[server] Port ${config.port} is already in use. Opening the running app instead.`
      );
      if (shouldOpenBrowser) {
        openBrowser(appUrl);
      }
      await gateway.shutdown();
      process.exit(0);
    }
    throw err;
  }

  console.log(`[server] Game Library Manager listening at ${appUrl}`);
  console.log(`[server] Data directory: ${config.dataDir}`);

  if (shouldOpenBrowser) {
    openBrowser(appUrl);
  }
}

main().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
