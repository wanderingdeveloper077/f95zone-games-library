import fs from "node:fs";
import path from "node:path";
import { extractThreadMatches } from "@game-library/shared";
import { eq } from "drizzle-orm";
import type { EventBroadcaster } from "../contracts/ports.js";
import type { AppDatabase } from "../db/index.js";
import * as schema from "../db/schema.js";
import { isUriTarget } from "./gameLauncher.js";

const IGNORED_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".zst",
  ".iso",
  ".part",
  ".partial",
  ".crdownload",
  ".tmp",
  ".temp",
  ".download",
  ".extracting",
  ".unpack",
  ".001",
];

const IGNORED_SYSTEM_NAMES = new Set([
  "__macosx",
  "$recycle.bin",
  "system volume information",
]);

const INCOMPLETE_FILE_EXTENSIONS = [
  ".part",
  ".partial",
  ".crdownload",
  ".tmp",
  ".temp",
  ".download",
  ".extracting",
  ".7z.tmp",
  ".!ut",
  ".!qb",
];

const TRAILING_NOISE_TOKENS = new Set([
  "pc",
  "win",
  "win32",
  "win64",
  "windows",
  "x64",
  "x86",
  "x86_64",
  "mac",
  "macos",
  "osx",
  "linux",
  "android",
  "apk",
  "compressed",
  "repack",
  "final",
  "public",
  "patreon",
  "subscribestar",
  "uncensored",
  "censored",
  "mod",
  "eng",
  "en",
  "english",
  "release",
  "full",
  "free",
]);

export interface GameMatchCandidate {
  id: number;
  name: string;
  version: string;
  installedVersion: string;
  archived: boolean;
  executables: string[];
}

export interface ParsedFolderTitle {
  normalized: string;
  compact: string;
  explicitId: number | null;
}

export function isIgnoredEntryName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.startsWith(".") || trimmed.startsWith("~")) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  if (IGNORED_SYSTEM_NAMES.has(lower)) {
    return true;
  }
  if (/\.r\d{2}$/i.test(lower)) {
    return true;
  }
  return IGNORED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isIncompleteInnerFileName(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith("~$") || lower.startsWith(".#")) {
    return true;
  }
  return INCOMPLETE_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function hasIncompleteExtractionArtifacts(
  folderPath: string,
  maxDepth = 3
): boolean {
  let rootEntries: fs.Dirent[];
  try {
    rootEntries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return true;
  }

  const visibleRootEntries = rootEntries.filter(
    (e) =>
      !e.name.startsWith(".") &&
      !e.name.startsWith("~") &&
      e.name.toLowerCase() !== "__macosx"
  );
  if (visibleRootEntries.length === 0) {
    return true;
  }

  const stack: Array<{ dir: string; depth: number }> = [
    { dir: folderPath, depth: 0 },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      return true;
    }

    for (const entry of entries) {
      if (isIncompleteInnerFileName(entry.name)) {
        return true;
      }
      if (
        entry.isDirectory() &&
        current.depth < maxDepth &&
        !isIgnoredEntryName(entry.name)
      ) {
        stack.push({
          dir: path.join(current.dir, entry.name),
          depth: current.depth + 1,
        });
      }
    }
  }

  return false;
}

function normalizePathForCompare(
  targetPath: string,
  platform: NodeJS.Platform
): string {
  const resolved = path.resolve(targetPath).replace(/[\\/]+$/, "");
  return platform === "win32" || platform === "darwin"
    ? resolved.toLowerCase()
    : resolved;
}

export function isPathAlreadyRegistered(
  folderPath: string,
  existingExecutables: string[],
  platform: NodeJS.Platform = process.platform
): boolean {
  const target = normalizePathForCompare(folderPath, platform);
  const targetPrefix = `${target}${path.sep}`;

  for (const exe of existingExecutables) {
    const trimmed = exe.trim();
    if (!trimmed || isUriTarget(trimmed)) continue;
    const registered = normalizePathForCompare(trimmed, platform);
    if (registered === target || registered.startsWith(targetPrefix)) {
      return true;
    }
  }

  return false;
}

export function parseFolderTitle(rawName: string): ParsedFolderTitle {
  const idMatch =
    /^\s*\[(\d{3,10})\]/.exec(rawName) ??
    /\[(?:id|f95)[:=\s_-]*(\d{3,10})\]/i.exec(rawName) ??
    /\bf95[-_]?(\d{3,10})\b/i.exec(rawName);
  const explicitId = idMatch?.[1] ? Number.parseInt(idMatch[1], 10) : null;

  let cleaned = rawName
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, " ")
    // Split CamelCase boundaries before normalizing separators.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    // Strip multi-segment versions (e.g. 0.9.1, v0.20.16) while dots are intact.
    .replace(/\bv?\d+(?:\.\d+)+[a-z]*\b/gi, " ")
    .replace(/\bv\d+[a-z]*\b/gi, " ")
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .toLowerCase();

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  while (tokens.length > 1) {
    const tail = tokens[tokens.length - 1];
    if (!tail || !TRAILING_NOISE_TOKENS.has(tail)) {
      break;
    }
    tokens.pop();
  }

  const normalized = tokens.join(" ");
  return {
    normalized,
    compact: tokens.join(""),
    explicitId: Number.isFinite(explicitId) ? explicitId : null,
  };
}

function bigramSet(text: string): Set<string> {
  const padded = text.replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 1; i += 1) {
    out.add(padded.slice(i, i + 2));
  }
  return out;
}

function diceSimilarity(a: string, b: string): number {
  const setA = bigramSet(a);
  const setB = bigramSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const bg of setA) {
    if (setB.has(bg)) intersection += 1;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

function findThreadIdInShortcuts(folderPath: string): number | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".url")) {
      continue;
    }
    try {
      const content = fs.readFileSync(
        path.join(folderPath, entry.name),
        "utf8"
      );
      const matches = extractThreadMatches(content.slice(0, 16_384));
      if (matches[0]) {
        return matches[0].id;
      }
    } catch {
      // Ignore unreadable shortcut files
    }
  }
  return null;
}

function findSingleSubfolderName(folderPath: string): string | null {
  try {
    const dirs = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !isIgnoredEntryName(e.name));
    if (dirs.length === 1 && dirs[0]) {
      return dirs[0].name;
    }
  } catch {
    // Ignore read failure
  }
  return null;
}

function matchByParsedTitle(
  parsed: ParsedFolderTitle,
  games: GameMatchCandidate[]
): GameMatchCandidate | null {
  if (!parsed.normalized) return null;

  const gameTitles = games.map((game) => ({
    game,
    parsed: parseFolderTitle(game.name),
  }));

  const exactNormalized = gameTitles.filter(
    (entry) => entry.parsed.normalized === parsed.normalized
  );
  if (exactNormalized.length === 1 && exactNormalized[0]) {
    return exactNormalized[0].game;
  }
  if (exactNormalized.length > 1) {
    const activeOnly = exactNormalized.filter((e) => !e.game.archived);
    if (activeOnly.length === 1 && activeOnly[0]) {
      return activeOnly[0].game;
    }
    return null;
  }

  if (parsed.compact.length >= 3) {
    const exactCompact = gameTitles.filter(
      (entry) => entry.parsed.compact === parsed.compact
    );
    if (exactCompact.length === 1 && exactCompact[0]) {
      return exactCompact[0].game;
    }
  }

  if (parsed.normalized.length < 4) {
    return null;
  }

  let bestScore = 0;
  let secondScore = 0;
  let bestGame: GameMatchCandidate | null = null;

  for (const entry of gameTitles) {
    if (entry.parsed.normalized.length < 4) continue;
    const score = diceSimilarity(parsed.normalized, entry.parsed.normalized);
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestGame = entry.game;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestGame && bestScore >= 0.86 && bestScore - secondScore >= 0.08) {
    return bestGame;
  }

  return null;
}

export function matchFolderToGame(
  folderName: string,
  folderPath: string,
  games: GameMatchCandidate[]
): GameMatchCandidate | null {
  const parsedTop = parseFolderTitle(folderName);
  if (parsedTop.explicitId !== null) {
    const byId = games.find((g) => g.id === parsedTop.explicitId);
    if (byId) return byId;
  }

  const shortcutId = findThreadIdInShortcuts(folderPath);
  if (shortcutId !== null) {
    const byShortcut = games.find((g) => g.id === shortcutId);
    if (byShortcut) return byShortcut;
  }

  const topMatch = matchByParsedTitle(parsedTop, games);
  if (topMatch) return topMatch;

  const nestedName = findSingleSubfolderName(folderPath);
  if (nestedName) {
    const parsedNested = parseFolderTitle(nestedName);
    if (parsedNested.explicitId !== null) {
      const byNestedId = games.find((g) => g.id === parsedNested.explicitId);
      if (byNestedId) return byNestedId;
    }
    return matchByParsedTitle(parsedNested, games);
  }

  return null;
}

export interface GamesDirectoryWatcherDeps {
  db: AppDatabase;
  broadcaster: EventBroadcaster;
  gamesDir: string;
  settleDelayMs?: number;
  maxIncompleteRetries?: number;
}

export interface ScanResult {
  registered: Array<{ gameId: number; path: string }>;
  skippedIncomplete: string[];
  unmatched: string[];
}

export class GamesDirectoryWatcher {
  private readonly db: AppDatabase;
  private readonly broadcaster: EventBroadcaster;
  private readonly gamesDir: string;
  private readonly settleDelayMs: number;
  private readonly maxIncompleteRetries: number;
  private watcher: fs.FSWatcher | null = null;
  private scanTimer: NodeJS.Timeout | null = null;
  private incompleteRetries = 0;
  private stopped = false;

  constructor(deps: GamesDirectoryWatcherDeps) {
    this.db = deps.db;
    this.broadcaster = deps.broadcaster;
    this.gamesDir = path.resolve(deps.gamesDir);
    this.settleDelayMs = deps.settleDelayMs ?? 1500;
    this.maxIncompleteRetries = deps.maxIncompleteRetries ?? 20;
  }

  start(): void {
    this.stopped = false;
    fs.mkdirSync(this.gamesDir, { recursive: true });
    if (this.watcher) return;

    try {
      this.watcher = fs.watch(this.gamesDir, { persistent: false }, () => {
        if (!this.stopped) {
          this.incompleteRetries = 0;
          this.scheduleScan(this.settleDelayMs);
        }
      });
      this.watcher.on("error", (err) => {
        console.error(`[games-watcher] Watch error on ${this.gamesDir}:`, err);
      });
    } catch (err) {
      console.error(`[games-watcher] Could not watch ${this.gamesDir}:`, err);
    }

    this.scheduleScan(50);
  }

  stop(): void {
    this.stopped = true;
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  scheduleScan(delayMs: number = this.settleDelayMs): void {
    if (this.stopped) return;
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
    }
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null;
      if (!this.stopped) {
        this.scanNow();
      }
    }, delayMs);
    this.scanTimer.unref?.();
  }

  scanNow(): ScanResult {
    const result: ScanResult = {
      registered: [],
      skippedIncomplete: [],
      unmatched: [],
    };

    fs.mkdirSync(this.gamesDir, { recursive: true });

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.gamesDir, { withFileTypes: true });
    } catch {
      return result;
    }

    const rows = this.db
      .select({
        id: schema.games.id,
        name: schema.games.name,
        version: schema.games.version,
        installedVersion: schema.games.installedVersion,
        archived: schema.games.archived,
        executablesJson: schema.games.executablesJson,
      })
      .from(schema.games)
      .all();

    const candidates: GameMatchCandidate[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      version: row.version,
      installedVersion: row.installedVersion,
      archived: row.archived,
      executables: Array.isArray(row.executablesJson)
        ? [...row.executablesJson]
        : [],
    }));

    for (const entry of entries) {
      if (!entry.isDirectory() || isIgnoredEntryName(entry.name)) {
        continue;
      }

      const folderPath = path.resolve(this.gamesDir, entry.name);
      if (hasIncompleteExtractionArtifacts(folderPath)) {
        result.skippedIncomplete.push(folderPath);
        continue;
      }

      const matched = matchFolderToGame(entry.name, folderPath, candidates);
      if (!matched) {
        result.unmatched.push(folderPath);
        continue;
      }

      const alreadyRegistered = isPathAlreadyRegistered(
        folderPath,
        matched.executables
      );
      const needsInstallMark = !matched.installedVersion;
      if (alreadyRegistered && !needsInstallMark) {
        continue;
      }

      const nextExecutables = alreadyRegistered
        ? matched.executables
        : [...matched.executables, folderPath];
      const nextInstalledVersion = needsInstallMark
        ? matched.version || "Installed"
        : matched.installedVersion;

      this.db
        .update(schema.games)
        .set({
          executablesJson: nextExecutables,
          ...(needsInstallMark
            ? {
                installedVersion: nextInstalledVersion,
                hasUpdate: nextInstalledVersion !== matched.version,
              }
            : {}),
        })
        .where(eq(schema.games.id, matched.id))
        .run();

      matched.executables = nextExecutables;
      matched.installedVersion = nextInstalledVersion;

      this.broadcaster.broadcast({
        type: "game_updated",
        gameId: matched.id,
        versionChanged: false,
        name: matched.name,
        version: matched.version,
      });

      if (!alreadyRegistered) {
        result.registered.push({ gameId: matched.id, path: folderPath });
      }
    }

    if (
      result.skippedIncomplete.length > 0 &&
      this.incompleteRetries < this.maxIncompleteRetries
    ) {
      this.incompleteRetries += 1;
      this.scheduleScan(Math.max(this.settleDelayMs, 2000));
    } else if (result.skippedIncomplete.length === 0) {
      this.incompleteRetries = 0;
    }

    return result;
  }
}
