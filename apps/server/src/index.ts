import { buildApp } from "./app.js";
import { resolveConfig } from "./config.js";
import { isBundledApp } from "./runtime/embedded.js";
import { openBrowser } from "./runtime/openBrowser.js";

async function main() {
  const config = resolveConfig();
  const { app, closeResources } = await buildApp(config, { startWorker: true });
  const appUrl = `http://${config.host}:${config.port}/`;
  const shouldOpenBrowser =
    process.env.OPEN_BROWSER !== undefined
      ? process.env.OPEN_BROWSER === "1"
      : isBundledApp();

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await closeResources();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    });
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
      await closeResources();
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
