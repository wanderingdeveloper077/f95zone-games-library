import { spawn } from "node:child_process";

/**
 * Open a URL in the user's default OS browser without blocking server startup.
 */
export function openBrowser(url: string): void {
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
    console.error(`[server] Could not open browser: ${err.message}`);
  });
  child.unref();
}
