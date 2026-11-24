import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { GameLauncher, LaunchErrorResult } from "../contracts/ports.js";

/**
 * Returns true if the target string uses a custom/web URI scheme
 * (for example `http://`, `https://`, or `steam://`) rather than a
 * Windows drive path or local filesystem path.
 */
export function isUriTarget(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return false;
  }
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:(?:\/\/|[^\\/])/.test(trimmed);
}

function osOpenCommand(): string {
  if (process.platform === "win32") return "explorer.exe";
  if (process.platform === "darwin") return "open";
  return "xdg-open";
}

function spawnDetached(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
): void {
  const child = spawn(command, args, {
    cwd: options?.cwd,
    env: options?.env,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
  });
  child.on("error", (err) => {
    console.error(`[launcher] Failed to launch "${command}": ${err.message}`);
  });
  child.unref();
}

function readMagicHeader(filePath: string): Buffer {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, buf, 0, 8, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

export class LocalGameLauncher implements GameLauncher {
  async launch(
    executable: string
  ): Promise<{ ok: true; target: string } | LaunchErrorResult> {
    const trimmed = executable.trim();
    if (!trimmed) {
      return {
        ok: false,
        statusCode: 400,
        code: "INVALID_PATH",
        message: "Executable path cannot be empty.",
      };
    }

    if (isUriTarget(trimmed)) {
      spawnDetached(osOpenCommand(), [trimmed]);
      return { ok: true, target: trimmed };
    }

    const resolved = path.resolve(trimmed);
    if (!fs.existsSync(resolved)) {
      return {
        ok: false,
        statusCode: 404,
        code: "EXECUTABLE_NOT_FOUND",
        message: `Executable or folder not found: ${resolved}`,
      };
    }

    const stat = fs.statSync(resolved);

    if (
      process.platform === "darwin" &&
      resolved.toLowerCase().endsWith(".app") &&
      stat.isDirectory()
    ) {
      spawnDetached("open", [resolved]);
      return { ok: true, target: resolved };
    }

    if (stat.isDirectory()) {
      spawnDetached(osOpenCommand(), [resolved], { cwd: resolved });
      return { ok: true, target: resolved };
    }

    const ext = path.extname(resolved).toLowerCase();
    if (ext === ".html" || ext === ".htm") {
      spawnDetached(osOpenCommand(), [pathToFileURL(resolved).href], {
        cwd: path.dirname(resolved),
      });
      return { ok: true, target: resolved };
    }

    const cwd = path.dirname(resolved);
    const magic = readMagicHeader(resolved);

    if (process.platform === "win32") {
      const isPe =
        (magic[0] === 0x4d && magic[1] === 0x5a) ||
        (magic[0] === 0x5a && magic[1] === 0x4d);
      if (isPe && ext === ".exe") {
        spawnDetached(resolved, [], { cwd });
      } else {
        // Use env vars rather than inline string interpolation to prevent shell quoting issues.
        spawnDetached(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            "Start-Process -FilePath $env:GLM_TARGET -WorkingDirectory $env:GLM_CWD",
          ],
          {
            cwd,
            env: {
              ...process.env,
              GLM_TARGET: resolved,
              GLM_CWD: cwd,
            },
          }
        );
      }
      return { ok: true, target: resolved };
    }

    const isUnixScriptOrElf =
      (magic[0] === 0x23 && magic[1] === 0x21) ||
      (magic[0] === 0x7f &&
        magic[1] === 0x45 &&
        magic[2] === 0x4c &&
        magic[3] === 0x46);

    let mode = stat.mode;
    if (isUnixScriptOrElf && (mode & 0o111) === 0) {
      mode |= 0o111;
      fs.chmodSync(resolved, mode);
    }

    if ((mode & 0o111) !== 0) {
      spawnDetached(resolved, [], { cwd });
    } else {
      spawnDetached(osOpenCommand(), [resolved], { cwd });
    }
    return { ok: true, target: resolved };
  }

  async openFolder(
    executable: string
  ): Promise<{ ok: true; folder: string } | LaunchErrorResult> {
    const trimmed = executable.trim();
    if (!trimmed) {
      return {
        ok: false,
        statusCode: 400,
        code: "INVALID_PATH",
        message: "Executable path cannot be empty.",
      };
    }

    if (isUriTarget(trimmed)) {
      return {
        ok: false,
        statusCode: 400,
        code: "INVALID_PATH",
        message: "Cannot open a local folder for a URI.",
      };
    }

    const resolved = path.resolve(trimmed);
    const folder =
      fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
        ? resolved
        : path.dirname(resolved);

    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
      return {
        ok: false,
        statusCode: 404,
        code: "FOLDER_NOT_FOUND",
        message: `Folder not found: ${folder}`,
      };
    }

    spawnDetached(osOpenCommand(), [folder], { cwd: folder });
    return { ok: true, folder };
  }
}
