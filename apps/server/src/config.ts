import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION, DEFAULT_SERVER_PORT } from "@game-library/shared";
import { extractSeaRuntime, isBundledApp } from "./runtime/embedded.js";

export interface ServerConfig {
  host: "127.0.0.1";
  port: number;
  dataDir: string;
  gamesDir: string;
  dbPath: string;
  coversDir: string;
  masterKeyPath: string;
  pairingTokenPath: string;
  webDistDir: string;
  migrationsDir: string;
  nativeBindingPath?: string;
  workerScriptPath?: string;
  isDev: boolean;
  appVersion: string;
}

function resolveDefaultRoot(): string {
  if (isBundledApp()) {
    return path.dirname(process.execPath);
  }
  const metaUrl =
    typeof import.meta?.url === "string" ? import.meta.url : "";
  const currentDir = metaUrl
    ? path.dirname(fileURLToPath(metaUrl))
    : process.cwd();
  // In monorepo dev/dist: apps/server/(src|dist)/config.(ts|js) -> repo root is 3 levels up.
  // In standalone bundle: release/server/index.mjs -> bundle root is 1 level up.
  const bundleRoot = path.resolve(currentDir, "..");
  if (
    fs.existsSync(path.join(bundleRoot, "drizzle")) &&
    fs.existsSync(path.join(bundleRoot, "web"))
  ) {
    return bundleRoot;
  }
  return path.resolve(currentDir, "..", "..", "..");
}

/**
 * Resolves the default writable runtime data directory for a single-executable bundle.
 * On macOS `.app` bundles, `Contents/MacOS` may live under read-only `/Applications` or
 * an app translocation path, so state belongs in Application Support.
 */
export function resolveDefaultSeaDataDir(
  platform: NodeJS.Platform = process.platform,
  execPath: string = process.execPath,
  homeDir: string = os.homedir()
): string {
  if (platform === "darwin") {
    return path.join(
      homeDir,
      "Library",
      "Application Support",
      "Game Library Manager"
    );
  }
  return path.join(path.dirname(execPath), "data");
}

/**
 * Resolves the default directory watched for extracted game folders (`standalone/games`).
 */
export function resolveDefaultSeaGamesDir(
  platform: NodeJS.Platform = process.platform,
  execPath: string = process.execPath,
  homeDir: string = os.homedir()
): string {
  if (platform === "darwin") {
    return path.join(
      resolveDefaultSeaDataDir(platform, execPath, homeDir),
      "games"
    );
  }
  return path.join(path.dirname(execPath), "games");
}

export function resolveConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  const seaRuntime = extractSeaRuntime();
  const rootDir = resolveDefaultRoot();
  const isLegacyBundle =
    !seaRuntime &&
    fs.existsSync(path.join(rootDir, "drizzle")) &&
    fs.existsSync(path.join(rootDir, "web"));

  const dataDir = overrides?.dataDir
    ? path.resolve(overrides.dataDir)
    : process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : seaRuntime
        ? resolveDefaultSeaDataDir()
        : path.join(rootDir, "data");

  const gamesDir = overrides?.gamesDir
    ? path.resolve(overrides.gamesDir)
    : process.env.GAMES_DIR
      ? path.resolve(process.env.GAMES_DIR)
      : seaRuntime
        ? resolveDefaultSeaGamesDir()
        : isLegacyBundle
          ? path.join(rootDir, "games")
          : path.join(rootDir, "release", "standalone", "games");

  const webDistDir = overrides?.webDistDir
    ? path.resolve(overrides.webDistDir)
    : process.env.WEB_DIST_DIR
      ? path.resolve(process.env.WEB_DIST_DIR)
      : seaRuntime
        ? seaRuntime.webDistDir
        : isLegacyBundle
          ? path.join(rootDir, "web")
          : path.join(rootDir, "apps", "web", "dist");

  const migrationsDir = overrides?.migrationsDir
    ? path.resolve(overrides.migrationsDir)
    : process.env.MIGRATIONS_DIR
      ? path.resolve(process.env.MIGRATIONS_DIR)
      : seaRuntime
        ? seaRuntime.migrationsDir
        : isLegacyBundle
          ? path.join(rootDir, "drizzle")
          : path.join(rootDir, "apps", "server", "drizzle");

  const parsedPort = Number(process.env.PORT ?? DEFAULT_SERVER_PORT);
  const port =
    overrides?.port ??
    (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
      ? parsedPort
      : DEFAULT_SERVER_PORT);

  const nativeBindingPath =
    overrides?.nativeBindingPath ?? seaRuntime?.nativeBindingPath;
  const workerScriptPath =
    overrides?.workerScriptPath ?? seaRuntime?.workerScriptPath;

  return {
    host: "127.0.0.1",
    port,
    dataDir,
    gamesDir,
    dbPath: overrides?.dbPath ?? path.join(dataDir, "library.db"),
    coversDir: overrides?.coversDir ?? path.join(dataDir, "covers"),
    masterKeyPath: overrides?.masterKeyPath ?? path.join(dataDir, ".master.key"),
    pairingTokenPath:
      overrides?.pairingTokenPath ?? path.join(dataDir, ".pairing.token"),
    webDistDir,
    migrationsDir,
    ...(nativeBindingPath ? { nativeBindingPath } : {}),
    ...(workerScriptPath ? { workerScriptPath } : {}),
    isDev:
      overrides?.isDev ??
      (!seaRuntime && process.env.NODE_ENV !== "production"),
    appVersion: overrides?.appVersion ?? APP_VERSION,
  };
}
