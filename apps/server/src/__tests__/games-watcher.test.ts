import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type SseEvent, Type } from "@game-library/shared";
import { afterEach, describe, expect, it } from "vitest";
import type { EventBroadcaster } from "../contracts/ports.js";
import { initializeDatabase, openDatabase } from "../db/index.js";
import * as schema from "../db/schema.js";
import { findBestExecutableInFolder } from "../services/gameLauncher.js";
import {
  GamesDirectoryWatcher,
  isIgnoredEntryName,
  isPathAlreadyRegistered,
  parseFolderTitle,
} from "../services/gamesDirectoryWatcher.js";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle"
);

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

function createWatcherEnv() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "gl-games-watcher-"));
  const dbPath = path.join(rootDir, "data", "library.db");
  const gamesDir = path.join(rootDir, "games");
  const conn = openDatabase(dbPath);
  initializeDatabase(conn, migrationsDir);

  cleanups.push(() => {
    conn.sqlite.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  const events: SseEvent[] = [];
  const broadcaster: EventBroadcaster = {
    broadcast: (e) => events.push(e),
  };

  return { rootDir, gamesDir, conn, events, broadcaster };
}

describe("GamesDirectoryWatcher & extracted folder matching", () => {
  it("normalizes folder titles and detects archive/temp entry names", () => {
    expect(parseFolderTitle("Being_a_DIK-0.9.1-pc")).toEqual({
      normalized: "being a dik",
      compact: "beingadik",
      explicitId: null,
    });
    expect(parseFolderTitle("SummertimeSaga-v0.20.16-win-x64")).toEqual({
      normalized: "summertime saga",
      compact: "summertimesaga",
      explicitId: null,
    });
    expect(parseFolderTitle("[1001] Custom Wrapper (Final)")).toEqual({
      normalized: "custom wrapper",
      compact: "customwrapper",
      explicitId: 1001,
    });

    expect(isIgnoredEntryName("archive.zip")).toBe(true);
    expect(isIgnoredEntryName("game.part")).toBe(true);
    expect(isIgnoredEntryName("game.rar")).toBe(true);
    expect(isIgnoredEntryName("__MACOSX")).toBe(true);
    expect(isIgnoredEntryName("Being a DIK")).toBe(false);
  });

  it("creates standalone/games automatically, matches folders, ignores incomplete files, and avoids duplicates", () => {
    const { gamesDir, conn, events, broadcaster } = createWatcherEnv();

    conn.db
      .insert(schema.games)
      .values([
        {
          id: 5001,
          custom: false,
          name: "Being a DIK",
          version: "0.9.1",
          developer: "DrPinkCake",
          type: Type.RenPy,
          status: 1,
          url: "https://f95zone.to/threads/5001/",
          addedAtMs: 1_000,
        },
        {
          id: 5002,
          custom: false,
          name: "Summertime Saga",
          version: "0.20.16",
          developer: "DarkCookie",
          type: Type.RenPy,
          status: 1,
          url: "https://f95zone.to/threads/5002/",
          addedAtMs: 1_000,
        },
        {
          id: 5003,
          custom: false,
          name: "Existing Binary Game",
          version: "1.0",
          developer: "Dev",
          type: Type.Unity,
          status: 1,
          url: "https://f95zone.to/threads/5003/",
          executablesJson: [path.resolve(gamesDir, "Existing_Binary_Game-1.0", "Game.exe")],
          addedAtMs: 1_000,
        },
      ])
      .run();

    const watcher = new GamesDirectoryWatcher({
      db: conn.db,
      broadcaster,
      gamesDir,
      settleDelayMs: 50,
    });

    expect(fs.existsSync(gamesDir)).toBe(false);
    const emptyScan = watcher.scanNow();
    expect(fs.existsSync(gamesDir)).toBe(true);
    expect(emptyScan.registered).toEqual([]);

    // Archives and unfinished folders must be ignored / delayed.
    fs.writeFileSync(path.join(gamesDir, "Being_a_DIK-0.9.1.zip"), "zip");
    fs.writeFileSync(path.join(gamesDir, "SummertimeSaga.rar.part"), "part");

    const dikDir = path.join(gamesDir, "Being_a_DIK-0.9.1-pc");
    fs.mkdirSync(dikDir, { recursive: true });
    fs.writeFileSync(path.join(dikDir, "Being a DIK.exe"), "MZ");

    // In-progress extraction containing a .part file inside the folder.
    const sagaDir = path.join(gamesDir, "SummertimeSaga-v0.20.16-win-x64");
    fs.mkdirSync(sagaDir, { recursive: true });
    fs.writeFileSync(path.join(sagaDir, "game.rpa.part"), "partial");

    // Nested exe already registered -> should not duplicate folder path.
    const existingDir = path.join(gamesDir, "Existing_Binary_Game-1.0");
    fs.mkdirSync(existingDir, { recursive: true });
    fs.writeFileSync(path.join(existingDir, "Game.exe"), "MZ");

    // Unmatched folder & empty folder -> ignored gracefully.
    const unknownDir = path.join(gamesDir, "Completely Unknown Game 999");
    fs.mkdirSync(unknownDir, { recursive: true });
    fs.writeFileSync(path.join(unknownDir, "unknown.exe"), "MZ");
    fs.mkdirSync(path.join(gamesDir, "Empty Extracted Folder"), {
      recursive: true,
    });

    const firstScan = watcher.scanNow();
    expect(firstScan.registered).toEqual([
      { gameId: 5001, path: path.resolve(dikDir) },
    ]);
    expect(firstScan.skippedIncomplete).toContain(path.resolve(sagaDir));
    expect(firstScan.unmatched).toContain(path.resolve(unknownDir));
    expect(events.filter((e) => e.type === "game_updated")).toHaveLength(2);

    const rowsAfterFirst = conn.db.select().from(schema.games).all();
    expect(rowsAfterFirst.find((g) => g.id === 5001)).toMatchObject({
      installedVersion: "0.9.1",
      hasUpdate: false,
    });
    expect(rowsAfterFirst.find((g) => g.id === 5003)).toMatchObject({
      installedVersion: "1.0",
      hasUpdate: false,
    });

    // Finish extraction on Summertime Saga and re-scan.
    fs.rmSync(path.join(sagaDir, "game.rpa.part"));
    fs.writeFileSync(path.join(sagaDir, "SummertimeSaga.exe"), "MZ");

    const secondScan = watcher.scanNow();
    expect(secondScan.registered).toEqual([
      { gameId: 5002, path: path.resolve(sagaDir) },
    ]);
    const rowsAfterSecond = conn.db.select().from(schema.games).all();
    expect(rowsAfterSecond.find((g) => g.id === 5002)).toMatchObject({
      installedVersion: "0.20.16",
      hasUpdate: false,
    });
    // Running again does not duplicate already-registered paths.
    const thirdScan = watcher.scanNow();
    expect(thirdScan.registered).toEqual([]);
  });

  it("checks already-registered folders case-insensitively on win32 and finds playable binaries", () => {
    const { rootDir } = createWatcherEnv();
    const gameDir = path.join(rootDir, "MyUnityGame");
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, "UnityCrashHandler64.exe"), "MZ");
    fs.writeFileSync(path.join(gameDir, "unins000.exe"), "MZ");
    fs.writeFileSync(path.join(gameDir, "MyUnityGame.exe"), "MZ_REAL_BINARY");

    expect(
      isPathAlreadyRegistered(
        gameDir,
        [gameDir.toUpperCase()],
        "win32"
      )
    ).toBe(true);

    expect(findBestExecutableInFolder(gameDir, "win32")).toBe(
      path.join(gameDir, "MyUnityGame.exe")
    );
  });
});
