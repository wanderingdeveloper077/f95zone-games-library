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

const SKIP_SCAN_DIRS = new Set([
  "lib",
  "renpy",
  "www",
  "monobleedingedge",
  "__macosx",
  "locales",
  "node_modules",
  "resources",
]);

const HELPER_EXE_PATTERNS = [
  /^unins\d*\.exe$/i,
  /crashhandler/i,
  /^notification_helper\.exe$/i,
  /^pythonw?\.exe$/i,
  /^zsync(?:make)?\.exe$/i,
  /^dxsetup\.exe$/i,
  /vc_redist/i,
  /^nwjc\.exe$/i,
  /^payload\.exe$/i,
  /^elevate\.exe$/i,
  /^createdump\.exe$/i,
];

function isHelperBinary(fileName: string): boolean {
  return HELPER_EXE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function scoreNameMatch(folderName: string, candidateName: string): number {
  const cleanFolder = folderName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const stem = path
    .basename(candidateName, path.extname(candidateName))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!cleanFolder || !stem) return 0;
  if (cleanFolder === stem) return 3;
  if (cleanFolder.includes(stem) || stem.includes(cleanFolder)) return 2;
  if (stem === "game" || stem === "start" || stem === "play" || stem === "launch") {
    return 1;
  }
  return 0;
}

/**
 * Finds the most likely playable binary/entry file inside an extracted game folder.
 */
export function findBestExecutableInFolder(
  folderPath: string,
  platform: NodeJS.Platform = process.platform
): string | null {
  const rootName = path.basename(folderPath);
  const candidates: Array<{
    filePath: string;
    priority: number;
    depth: number;
    nameScore: number;
    size: number;
  }> = [];

  const queue: Array<{ dir: string; depth: number }> = [
    { dir: folderPath, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("~")) continue;
      const fullPath = path.join(current.dir, entry.name);
      const lower = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (platform === "darwin" && lower.endsWith(".app")) {
          candidates.push({
            filePath: fullPath,
            priority: 4,
            depth: current.depth,
            nameScore: scoreNameMatch(rootName, entry.name),
            size: 0,
          });
          continue;
        }
        if (
          current.depth < 3 &&
          !SKIP_SCAN_DIRS.has(lower) &&
          !lower.endsWith("_data")
        ) {
          queue.push({ dir: fullPath, depth: current.depth + 1 });
        }
        continue;
      }

      if (!entry.isFile() || isHelperBinary(entry.name)) {
        continue;
      }

      const ext = path.extname(lower);
      let priority = 0;

      if (platform === "win32") {
        if (ext === ".exe") priority = 4;
        else if (ext === ".bat" || ext === ".cmd") priority = 2;
        else if (lower === "index.html") priority = 1;
      } else if (platform === "darwin") {
        if (ext === ".sh") priority = 3;
        else if (lower === "index.html") priority = 1;
      } else {
        if (ext === ".sh" || ext === ".x86_64" || ext === ".appimage") {
          priority = 3;
        } else if (lower === "index.html") {
          priority = 1;
        } else if (ext === "") {
          try {
            if ((fs.statSync(fullPath).mode & 0o111) !== 0) priority = 3;
          } catch {
            // Ignore un-statable entry
          }
        }
      }

      if (priority > 0) {
        let size = 0;
        try {
          size = fs.statSync(fullPath).size;
        } catch {
          // Ignore size errors
        }
        candidates.push({
          filePath: fullPath,
          priority,
          depth: current.depth,
          nameScore: scoreNameMatch(rootName, entry.name),
          size,
        });
      }
    }
  }

  candidates.sort(
    (a, b) =>
      b.priority - a.priority ||
      a.depth - b.depth ||
      b.nameScore - a.nameScore ||
      b.size - a.size
  );

  return candidates[0]?.filePath ?? null;
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

    let resolved = path.resolve(trimmed);
    if (!fs.existsSync(resolved)) {
      return {
        ok: false,
        statusCode: 404,
        code: "EXECUTABLE_NOT_FOUND",
        message: `Executable or folder not found: ${resolved}`,
      };
    }

    let stat = fs.statSync(resolved);

    if (
      process.platform === "darwin" &&
      resolved.toLowerCase().endsWith(".app") &&
      stat.isDirectory()
    ) {
      spawnDetached("open", [resolved]);
      return { ok: true, target: resolved };
    }

    if (stat.isDirectory()) {
      const innerExe = findBestExecutableInFolder(resolved);
      if (!innerExe) {
        spawnDetached(osOpenCommand(), [resolved], { cwd: resolved });
        return { ok: true, target: resolved };
      }
      resolved = innerExe;
      stat = fs.statSync(resolved);
      if (
        process.platform === "darwin" &&
        resolved.toLowerCase().endsWith(".app") &&
        stat.isDirectory()
      ) {
        spawnDetached("open", [resolved]);
        return { ok: true, target: resolved };
      }
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
