import {
  type GameDetail,
  type GameSummary,
  type IndexJob,
  Status,
  Type,
  type UpdateGameInput,
  cleanThreadUrl,
  datestampUtcNoon,
  extractThreadMatches,
} from "@game-library/shared";
import type { Database } from "better-sqlite3";
import { eq, min } from "drizzle-orm";
import type {
  CoverCleaner,
  EventBroadcaster,
  GameLauncher,
  JobDispatcher,
  LaunchErrorResult,
} from "../contracts/ports.js";
import type { AppDatabase } from "../db/index.js";
import {
  type GamesFilterQuery,
  createJobRecord,
  getGameDetail,
  listGames,
} from "../db/queries.js";
import * as schema from "../db/schema.js";
import { LocalGameLauncher } from "./gameLauncher.js";

export interface CustomGameInput {
  name: string;
  version: string;
  developer: string;
  type: number;
  url: string;
  notes: string;
}

export interface AddF95ThreadsResult {
  added: GameSummary[];
  duplicateIds: number[];
  invalidCount: number;
  jobId: string | null;
}

export interface GamesServiceDeps {
  db: AppDatabase;
  sqlite: Database;
  coverCleaner: CoverCleaner;
  jobDispatcher: JobDispatcher;
  broadcaster: EventBroadcaster;
  gameLauncher?: GameLauncher;
  now?: () => number;
}

export type LaunchGameServiceResult =
  | { ok: true; executable: string; lastLaunchedAtMs: number }
  | LaunchErrorResult;

export type OpenGameFolderServiceResult =
  | { ok: true; folder: string }
  | LaunchErrorResult;

export function resolveTargetExecutable(
  gameExecutables: string[],
  requested?: string
): { ok: true; executable: string } | LaunchErrorResult {
  if (requested !== undefined) {
    const trimmed = requested.trim();
    if (!gameExecutables.includes(trimmed)) {
      return {
        ok: false,
        statusCode: 400,
        code: "EXECUTABLE_NOT_REGISTERED",
        message: "Requested executable is not attached to this game.",
      };
    }
    return { ok: true, executable: trimmed };
  }

  if (gameExecutables.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      code: "NO_EXECUTABLES",
      message: "No game executable is configured for this game.",
    };
  }

  if (gameExecutables.length > 1) {
    return {
      ok: false,
      statusCode: 400,
      code: "MULTIPLE_EXECUTABLES",
      message:
        "Multiple executables are configured; choose which executable to launch.",
    };
  }

  const single = gameExecutables[0];
  if (!single) {
    return {
      ok: false,
      statusCode: 400,
      code: "NO_EXECUTABLES",
      message: "No game executable is configured for this game.",
    };
  }

  return { ok: true, executable: single };
}

export function computePatchedHasUpdate(
  existingVersion: string,
  patch: UpdateGameInput
): boolean | undefined {
  if (patch.installedVersion !== undefined && patch.hasUpdate === undefined) {
    const targetVersion = patch.version ?? existingVersion;
    return patch.installedVersion !== "" && patch.installedVersion !== targetVersion;
  }
  return patch.hasUpdate;
}

export class GamesService {
  private readonly db: AppDatabase;
  private readonly sqlite: Database;
  private readonly coverCleaner: CoverCleaner;
  private readonly jobDispatcher: JobDispatcher;
  private readonly broadcaster: EventBroadcaster;
  private readonly gameLauncher: GameLauncher;
  private readonly now: () => number;

  constructor(deps: GamesServiceDeps) {
    this.db = deps.db;
    this.sqlite = deps.sqlite;
    this.coverCleaner = deps.coverCleaner;
    this.jobDispatcher = deps.jobDispatcher;
    this.broadcaster = deps.broadcaster;
    this.gameLauncher = deps.gameLauncher ?? new LocalGameLauncher();
    this.now = deps.now ?? Date.now;
  }

  list(filter?: GamesFilterQuery): GameSummary[] {
    return listGames(this.db, filter);
  }

  getDetail(id: number): GameDetail | null {
    return getGameDetail(this.db, id);
  }

  addF95Threads(rawUrls: string[], autoRefresh: boolean): AddF95ThreadsResult {
    const matches = extractThreadMatches(rawUrls.join("\n"));
    if (matches.length === 0) {
      return {
        added: [],
        duplicateIds: [],
        invalidCount: rawUrls.length,
        jobId: null,
      };
    }

    const now = this.now();
    const addedIds: number[] = [];
    const duplicateIds: number[] = [];

    this.sqlite.transaction(() => {
      for (const match of matches) {
        const existing = this.db
          .select({ id: schema.games.id })
          .from(schema.games)
          .where(eq(schema.games.id, match.id))
          .get();

        if (existing) {
          duplicateIds.push(match.id);
          continue;
        }

        const initialName = match.slug
          ? match.slug.replace(/-/g, " ")
          : `Thread ${match.id}`;

        this.db
          .insert(schema.games)
          .values({
            id: match.id,
            custom: false,
            name: initialName,
            version: "Unchecked",
            developer: "",
            type: Type.Unchecked,
            status: Status.Unchecked,
            url: cleanThreadUrl(match.id),
            addedAtMs: now,
          })
          .run();

        this.db
          .insert(schema.gameMetadata)
          .values({
            gameId: match.id,
            updatedAtMs: now,
          })
          .onConflictDoNothing()
          .run();

        addedIds.push(match.id);
      }
    })();

    if (addedIds.length > 0) {
      this.broadcaster.broadcast({ type: "games_added", gameIds: addedIds });
    }

    let jobId: string | null = null;
    if (autoRefresh && addedIds.length > 0) {
      const job = createJobRecord(
        this.db,
        addedIds.length === 1 ? "single_thread" : "bulk_refresh",
        addedIds.length,
        { gameIds: addedIds, force: true }
      );
      this.jobDispatcher.enqueueJob(job.id, job.kind, addedIds, true);
      jobId = job.id;
    }

    const allGames = listGames(this.db);
    const added = allGames.filter((g) => addedIds.includes(g.id));

    return {
      added,
      duplicateIds,
      invalidCount: 0,
      jobId,
    };
  }

  createCustomGame(input: CustomGameInput): {
    added: GameDetail[];
    jobId: null;
  } {
    const minRow = this.db
      .select({ minId: min(schema.games.id) })
      .from(schema.games)
      .get();
    const minId = minRow?.minId ?? 0;
    const customId = minId < 0 ? minId - 1 : -1;
    const now = this.now();
    const noon = datestampUtcNoon(Math.floor(now / 1000));

    this.sqlite.transaction(() => {
      this.db
        .insert(schema.games)
        .values({
          id: customId,
          custom: true,
          name: input.name,
          version: input.version,
          developer: input.developer,
          type: input.type,
          status: Status.Custom,
          url: input.url,
          notes: input.notes,
          addedAtMs: now,
          lastUpdatedTsSec: noon,
        })
        .run();

      this.db
        .insert(schema.gameMetadata)
        .values({
          gameId: customId,
          updatedAtMs: now,
        })
        .run();
    })();

    this.broadcaster.broadcast({ type: "games_added", gameIds: [customId] });
    const detail = getGameDetail(this.db, customId);
    return { added: detail ? [detail] : [], jobId: null };
  }

  updateGame(id: number, patch: UpdateGameInput): GameDetail | null {
    const existing = this.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, id))
      .get();
    if (!existing) return null;

    const computedHasUpdate = computePatchedHasUpdate(existing.version, patch);

    this.db
      .update(schema.games)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.version !== undefined ? { version: patch.version } : {}),
        ...(patch.developer !== undefined
          ? { developer: patch.developer }
          : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.url !== undefined ? { url: patch.url } : {}),
        ...(patch.installedVersion !== undefined
          ? { installedVersion: patch.installedVersion }
          : {}),
        ...(patch.finishedVersion !== undefined
          ? { finishedVersion: patch.finishedVersion }
          : {}),
        ...(computedHasUpdate !== undefined
          ? { hasUpdate: computedHasUpdate }
          : {}),
        ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
        ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.executables !== undefined
          ? {
              executablesJson: Array.from(
                new Set(patch.executables.map((e) => e.trim()).filter(Boolean))
              ),
            }
          : {}),
      })
      .where(eq(schema.games.id, id))
      .run();

    const updated = getGameDetail(this.db, id);
    if (!updated) return null;

    this.broadcaster.broadcast({
      type: "game_updated",
      gameId: updated.id,
      versionChanged: false,
      name: updated.name,
      version: updated.version,
    });
    return updated;
  }

  async launchGame(
    id: number,
    executable?: string
  ): Promise<LaunchGameServiceResult> {
    const existing = this.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, id))
      .get();
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Game not found.",
      };
    }

    const resolved = resolveTargetExecutable(
      existing.executablesJson,
      executable
    );
    if (!resolved.ok) return resolved;

    const launched = await this.gameLauncher.launch(resolved.executable);
    if (!launched.ok) return launched;

    const lastLaunchedAtMs = this.now();
    this.db
      .update(schema.games)
      .set({ lastLaunchedAtMs })
      .where(eq(schema.games.id, id))
      .run();

    return {
      ok: true,
      executable: resolved.executable,
      lastLaunchedAtMs,
    };
  }

  async openGameFolder(
    id: number,
    executable?: string
  ): Promise<OpenGameFolderServiceResult> {
    const existing = this.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, id))
      .get();
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Game not found.",
      };
    }

    const resolved = resolveTargetExecutable(
      existing.executablesJson,
      executable
    );
    if (!resolved.ok) return resolved;

    return this.gameLauncher.openFolder(resolved.executable);
  }

  async deleteGame(id: number): Promise<boolean> {
    const existing = this.db
      .select({ id: schema.games.id })
      .from(schema.games)
      .where(eq(schema.games.id, id))
      .get();
    if (!existing) return false;

    this.db.delete(schema.games).where(eq(schema.games.id, id)).run();
    await this.coverCleaner.deleteCovers(id);
    return true;
  }

  enqueueRefresh(gameIds: number[] | undefined, force: boolean): IndexJob {
    const kind =
      gameIds && gameIds.length === 1 ? "single_thread" : "bulk_refresh";
    const targetCount = gameIds
      ? gameIds.length
      : this.db
          .select({ id: schema.games.id })
          .from(schema.games)
          .all()
          .filter((g) => !g.id.toString().startsWith("-")).length;

    const job = createJobRecord(this.db, kind, targetCount, {
      gameIds,
      force,
    });
    this.jobDispatcher.enqueueJob(job.id, kind, gameIds, force);
    return job;
  }

  enqueueImport(source: "watched" | "bookmarks"): IndexJob {
    const kind =
      source === "watched" ? "watchlist_import" : "bookmarks_import";
    const job = createJobRecord(this.db, kind, 0, { source });
    this.jobDispatcher.enqueueJob(job.id, kind, undefined, true);
    return job;
  }
}
