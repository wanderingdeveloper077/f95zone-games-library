import crypto from "node:crypto";
import {
  type AccountStatus,
  type AppSettings,
  type GameDetail,
  type GameSummary,
  type IndexJob,
  type IndexJobKind,
  STATUS_META,
  type StatusId,
} from "@game-library/shared";
import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import * as schema from "../db/schema.js";

export type GameSortKey = "lastUpdated" | "addedAt" | "name" | "score" | "rating";

export interface GamesFilterQuery {
  search?: string;
  status?: number;
  type?: number;
  updatesOnly?: boolean;
  archived?: boolean;
  sort?: GameSortKey;
  dir?: "asc" | "desc";
}

export const GAME_SORT_COMPARATORS: Record<
  GameSortKey,
  (a: GameSummary, b: GameSummary) => number
> = {
  name: (a, b) => a.name.localeCompare(b.name),
  addedAt: (a, b) => a.addedAtMs - b.addedAtMs,
  score: (a, b) => a.score - b.score,
  rating: (a, b) => a.rating - b.rating,
  lastUpdated: (a, b) =>
    a.lastUpdatedTsSec - b.lastUpdatedTsSec || a.addedAtMs - b.addedAtMs,
};

export function listGames(
  db: AppDatabase,
  filter: GamesFilterQuery = {}
): GameSummary[] {
  const rows = db
    .select({
      game: schema.games,
      meta: schema.gameMetadata,
    })
    .from(schema.games)
    .leftJoin(
      schema.gameMetadata,
      eq(schema.games.id, schema.gameMetadata.gameId)
    )
    .all();

  let items: GameSummary[] = rows.map(({ game, meta }) => ({
    id: game.id,
    custom: game.custom,
    name: game.name,
    version: game.version,
    developer: game.developer,
    type: game.type,
    status: game.status,
    url: game.url,
    installedVersion: game.installedVersion,
    finishedVersion: game.finishedVersion,
    hasUpdate: game.hasUpdate,
    archived: game.archived,
    rating: game.rating,
    notes: game.notes,
    addedAtMs: game.addedAtMs,
    lastUpdatedTsSec: game.lastUpdatedTsSec,
    lastCheckedAtMs: game.lastCheckedAtMs,
    coverFile: game.coverFile,
    score: meta?.score ?? 0,
    votes: meta?.votes ?? 0,
    tags: meta?.tagsJson ?? [],
    executables: Array.isArray(game.executablesJson) ? game.executablesJson : [],
    lastError: meta?.lastError ?? null,
  }));

  if (filter.archived !== undefined) {
    items = items.filter((g) => g.archived === filter.archived);
  }
  if (filter.updatesOnly) {
    items = items.filter((g) => g.hasUpdate);
  }
  if (filter.status !== undefined) {
    items = items.filter((g) => g.status === filter.status);
  }
  if (filter.type !== undefined) {
    items = items.filter((g) => g.type === filter.type);
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    items = items.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.developer.toLowerCase().includes(q) ||
        g.notes.toLowerCase().includes(q)
    );
  }

  const sortKey: GameSortKey = filter.sort ?? "lastUpdated";
  const dirMul = filter.dir === "asc" ? 1 : -1;
  const comparator = GAME_SORT_COMPARATORS[sortKey];
  items.sort((a, b) => comparator(a, b) * dirMul);

  return items;
}

export function getGameDetail(
  db: AppDatabase,
  id: number
): GameDetail | null {
  const row = db
    .select({
      game: schema.games,
      meta: schema.gameMetadata,
    })
    .from(schema.games)
    .leftJoin(
      schema.gameMetadata,
      eq(schema.games.id, schema.gameMetadata.gameId)
    )
    .where(eq(schema.games.id, id))
    .get();

  if (!row) return null;
  const { game, meta } = row;

  return {
    id: game.id,
    custom: game.custom,
    name: game.name,
    version: game.version,
    developer: game.developer,
    type: game.type,
    status: game.status,
    url: game.url,
    installedVersion: game.installedVersion,
    finishedVersion: game.finishedVersion,
    hasUpdate: game.hasUpdate,
    archived: game.archived,
    rating: game.rating,
    notes: game.notes,
    addedAtMs: game.addedAtMs,
    lastUpdatedTsSec: game.lastUpdatedTsSec,
    lastCheckedAtMs: game.lastCheckedAtMs,
    coverFile: game.coverFile,
    score: meta?.score ?? 0,
    votes: meta?.votes ?? 0,
    tags: meta?.tagsJson ?? [],
    lastError: meta?.lastError ?? null,
    description: meta?.description ?? "",
    changelog: meta?.changelog ?? "",
    unknownTags: meta?.unknownTagsJson ?? [],
    unknownTagsFlag: meta?.unknownTagsFlag ?? false,
    imageUrl: meta?.imageUrl ?? "",
    previewsUrls: meta?.previewsUrlsJson ?? [],
    downloads: meta?.downloadsJson ?? [],
    reviewsTotal: meta?.reviewsTotal ?? 0,
    reviews: meta?.reviewsJson ?? [],
    executables: Array.isArray(game.executablesJson) ? game.executablesJson : [],
    playtimeSec: game.playtimeSec,
    lastLaunchedAtMs: game.lastLaunchedAtMs,
    updatedAtMs: meta?.updatedAtMs ?? game.addedAtMs,
  };
}

export function serializeAccountStatus(
  row: typeof schema.accounts.$inferSelect
): AccountStatus {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    status: row.status,
    cookieCount: row.cookieCount,
    hasXfUser: row.hasXfUser,
    hasCfClearance: row.hasCfClearance,
    userAgent: row.userAgent,
    lastVerifiedAtMs: row.lastVerifiedAtMs,
    updatedAtMs: row.updatedAtMs,
  };
}

export function getAppSettings(db: AppDatabase): AppSettings {
  const row = db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, 0))
    .get();
  return {
    useCacheApiFallback: row?.useCacheApiFallback ?? true,
    cacheApiUrl: row?.cacheApiUrl ?? "https://api.f95checker.dev",
    scrapeDelayMs: row?.scrapeDelayMs ?? 1000,
    extIconGlow: row?.extIconGlow ?? true,
    extHighlightTags: row?.extHighlightTags ?? true,
    tagHighlights: row?.tagHighlightsJson ?? {},
  };
}

export function createJobRecord(
  db: AppDatabase,
  kind: IndexJobKind,
  totalCount: number,
  payload: unknown
): IndexJob {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.insert(schema.indexJobs)
    .values({
      id,
      kind,
      status: "queued",
      totalCount,
      processedCount: 0,
      updatedCount: 0,
      errorCount: 0,
      payloadJson: JSON.stringify(payload ?? {}),
      errorSummary: null,
      createdAtMs: now,
      startedAtMs: null,
      finishedAtMs: null,
    })
    .run();

  return {
    id,
    kind,
    status: "queued",
    totalCount,
    processedCount: 0,
    updatedCount: 0,
    errorCount: 0,
    errorSummary: null,
    createdAtMs: now,
    startedAtMs: null,
    finishedAtMs: null,
  };
}

export function serializeIndexJob(
  row: typeof schema.indexJobs.$inferSelect
): IndexJob {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    totalCount: row.totalCount,
    processedCount: row.processedCount,
    updatedCount: row.updatedCount,
    errorCount: row.errorCount,
    errorSummary: row.errorSummary,
    createdAtMs: row.createdAtMs,
    startedAtMs: row.startedAtMs,
    finishedAtMs: row.finishedAtMs,
  };
}

export function listRecentJobs(db: AppDatabase, limit = 20): IndexJob[] {
  return db
    .select()
    .from(schema.indexJobs)
    .orderBy(desc(schema.indexJobs.createdAtMs))
    .limit(limit)
    .all()
    .map(serializeIndexJob);
}

export function statusColorForBadge(statusId: number, hasUpdate: boolean): string {
  if (hasUpdate) return "#F59E0B";
  return STATUS_META[statusId as StatusId]?.color ?? "#FD5555";
}
