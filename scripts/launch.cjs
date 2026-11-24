const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const port = process.env.PORT || "57095";
const origin = `http://127.0.0.1:${port}`;

function appRoot() {
  const candidates = [
    __dirname,
    path.resolve(__dirname, ".."),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "apps", "server", "dist", "index.js"))) {
      return dir;
    }
  }
  console.error("The app is not built. Run: pnpm build");
  process.exit(1);
}

function openBrowser(url) {
  const command =
    process.platform === "win32"
      ? "explorer.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", (err) => {
    console.error(`Could not open the browser: ${err.message}`);
  });
  child.unref();
}

async function healthy() {
  try {
    const response = await fetch(`${origin}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function startServer() {
  const child = spawn(process.execPath, [__filename, "--server"], {
    cwd: appRoot(),
    detached: true,
    windowsHide: true,
    stdio: "ignore",
    env: { ...process.env, OPEN_BROWSER: "0" },
  });
  child.unref();
}

async function waitUntilReady() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await healthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function serve() {
  const root = appRoot();
  process.chdir(root);
  await import(
    pathToFileURL(path.join(root, "apps", "server", "dist", "index.js")).href
  );
}

async function main() {
  if (process.argv.includes("--server")) {
    await serve();
    return;
  }

  if (!(await healthy())) {
    startServer();
    const ready = await waitUntilReady();
    if (!ready) {
      console.error(`The server did not start on ${origin}`);
      process.exit(1);
    }
  }
  openBrowser(`${origin}/`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
