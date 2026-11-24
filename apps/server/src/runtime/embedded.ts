import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAsset, getAssetKeys, isSea } from "node:sea";

const WEB_PREFIX = "web/";
const DRIZZLE_PREFIX = "drizzle/";
const NATIVE_ADDON_KEY = "native/better_sqlite3.node";
const WORKER_SCRIPT_KEY = "worker/indexer.worker.cjs";

export interface ExtractedSeaRuntime {
  webDistDir: string;
  migrationsDir: string;
  nativeBindingPath: string;
  workerScriptPath: string;
}

let cachedRuntime: ExtractedSeaRuntime | null = null;

export function isBundledApp(): boolean {
  return isSea();
}

/**
 * Inside a signed macOS `.app` bundle, `better_sqlite3.node` is shipped and signed in
 * `Contents/Frameworks/better_sqlite3.node`. Loading it directly avoids Apple Silicon
 * dlopen code-signature / quarantine issues with binaries extracted to `/var/folders`.
 */
export function resolveBundledNativeAddonPath(
  platform: NodeJS.Platform = process.platform,
  execPath: string = process.execPath,
  exists: (candidate: string) => boolean = fs.existsSync
): string | null {
  if (platform !== "darwin") return null;
  const candidate = path.resolve(
    path.dirname(execPath),
    "..",
    "Frameworks",
    "better_sqlite3.node"
  );
  return exists(candidate) ? candidate : null;
}

function writeAssetIfNeeded(filePath: string, data: Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    if (
      fs.existsSync(filePath) &&
      fs.statSync(filePath).size === data.length &&
      fs.readFileSync(filePath).equals(data)
    ) {
      return;
    }
  } catch {
    // Re-extract on read/stat failure
  }
  fs.writeFileSync(filePath, data);
}

/**
 * Extract assets embedded via Node.js SEA to an immutable content-hashed temp folder
 * so static files, Drizzle SQL migrations, worker scripts, and native .node addons
 * can be accessed directly from disk by Fastify, Drizzle, worker_threads, and dlopen.
 */
export function extractSeaRuntime(): ExtractedSeaRuntime | null {
  if (!isSea()) return null;
  if (cachedRuntime) return cachedRuntime;

  const keys = getAssetKeys();
  const hasher = crypto.createHash("sha256");
  for (const key of [NATIVE_ADDON_KEY, WORKER_SCRIPT_KEY, `${WEB_PREFIX}index.html`]) {
    if (keys.includes(key)) {
      hasher.update(Buffer.from(getAsset(key)));
    }
  }
  const fingerprint = hasher.digest("hex").slice(0, 16);
  const extractRoot = path.join(
    os.tmpdir(),
    "game-library-manager-sea",
    fingerprint
  );

  const webDistDir = path.join(extractRoot, "web");
  const migrationsDir = path.join(extractRoot, "drizzle");
  const bundledNative = resolveBundledNativeAddonPath();
  const nativeBindingPath =
    bundledNative ?? path.join(extractRoot, "native", "better_sqlite3.node");
  const workerScriptPath = path.join(
    extractRoot,
    "worker",
    "indexer.worker.cjs"
  );

  for (const key of keys) {
    const data = Buffer.from(getAsset(key));
    if (key.startsWith(WEB_PREFIX)) {
      const rel = key.slice(WEB_PREFIX.length).split("/").join(path.sep);
      writeAssetIfNeeded(path.join(webDistDir, rel), data);
    } else if (key.startsWith(DRIZZLE_PREFIX)) {
      const rel = key.slice(DRIZZLE_PREFIX.length).split("/").join(path.sep);
      writeAssetIfNeeded(path.join(migrationsDir, rel), data);
    } else if (key === NATIVE_ADDON_KEY && !bundledNative) {
      writeAssetIfNeeded(nativeBindingPath, data);
    } else if (key === WORKER_SCRIPT_KEY) {
      writeAssetIfNeeded(workerScriptPath, data);
    }
  }

  cachedRuntime = {
    webDistDir,
    migrationsDir,
    nativeBindingPath,
    workerScriptPath,
  };
  return cachedRuntime;
}
