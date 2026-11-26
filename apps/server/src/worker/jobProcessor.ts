import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  type IndexJob,
  type IndexJobKind,
  Status,
  type SseEvent,
  cleanThreadUrl,
  datestampUtcNoon,
} from "@game-library/shared";
import type { Database } from "better-sqlite3";
import { eq, inArray } from "drizzle-orm";
import PQueue from "p-queue";
import type { SecretCipher } from "../contracts/ports.js";
import type { AppDatabase } from "../db/index.js";
import {
  getAppSettings,
  serializeAccountStatus,
  serializeIndexJob,
} from "../db/queries.js";
import * as schema from "../db/schema.js";
import type { IndexerError, IndexerErrorFlag } from "../indexer/f95zone.js";
import { downloadCoverImage } from "../indexer/images.js";
import {
  CacheApiMetadataProvider,
  DirectF95MetadataProvider,
  fetchMetadataWithFallback,
} from "../indexer/metadataProvider.js";
import {
  type DecryptedSession,
  type ScrapeResult,
  type ScrapedThreadData,
  buildSessionHeaders,
  fetchBulkVersions,
  fetchFastCheckTimestamps,
  importF95ThreadList,
} from "../indexer/scraper.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const ERROR_FLAG_TO_ACCOUNT_STATUS: Partial<
  Record<IndexerErrorFlag, "captcha_required" | "expired">
> = {
  CLOUDFLARE_CAPTCHA: "captcha_required",
  SESSION_LOGGED_OUT: "expired",
};

export type FetchThreadMetadataFn = (params: {
  threadId: number;
  knownBulkVersion: string | undefined;
  session: DecryptedSession | null;
  forumQueue: PQueue;
  useCacheApiFallback: boolean;
  cacheApiUrl: string;
}) => Promise<ScrapeResult>;

export interface IndexJobProcessorDeps {
  db: AppDatabase;
  sqlite: Database;
  coversDir: string;
  cipher: SecretCipher;
  emitEvent: (event: SseEvent) => void;
  fetchMetadata?: FetchThreadMetadataFn;
  importThreadList?: typeof importF95ThreadList;
  fetchBulkVersions?: typeof fetchBulkVersions;
  fetchFastTimestamps?: typeof fetchFastCheckTimestamps;
  downloadCover?: typeof downloadCoverImage;
  coverExists?: (coverFile: string) => boolean;
  now?: () => number;
}

export function computeContentHash(data: ScrapedThreadData): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        name: data.name,
        version: data.version,
        developer: data.developer,
        type: data.type,
        status: data.status,
        lastUpdated: data.lastUpdated,
        score: data.score,
        votes: data.votes,
        description: data.description,
        changelog: data.changelog,
        tags: data.tags,
        imageUrl: data.imageUrl,
        downloads: data.downloads,
      })
    )
    .digest("hex");
}

export function shouldScrapeGame(params: {
  force: boolean;
  game: Pick<
    typeof schema.games.$inferSelect,
    "status" | "lastCheckedAtMs" | "version"
  >;
  meta: typeof schema.gameMetadata.$inferSelect | undefined;
  bulkVersion: string | undefined;
  fastChangedAtSec?: number | undefined;
  coverExists: boolean;
  nowMs: number;
}): boolean {
  const {
    force,
    game,
    meta,
    bulkVersion,
    fastChangedAtSec,
    coverExists,
    nowMs,
  } = params;
  const cacheFresh =
    meta?.expiresAtMs !== null &&
    meta?.expiresAtMs !== undefined &&
    nowMs < meta.expiresAtMs;
  const lastCheckedSec = Math.floor(game.lastCheckedAtMs / 1000);
  const fastChanged =
    fastChangedAtSec !== undefined &&
    fastChangedAtSec > 0 &&
    fastChangedAtSec > lastCheckedSec;

  return (
    force ||
    game.status === Status.Unchecked ||
    game.lastCheckedAtMs === 0 ||
    (Boolean(bulkVersion) && bulkVersion !== game.version) ||
    fastChanged ||
    (!coverExists && Boolean(meta?.imageUrl?.startsWith("http"))) ||
    !cacheFresh
  );
}

export function computePostScrapeHasUpdate(
  game: Pick<
    typeof schema.games.$inferSelect,
    "status" | "hasUpdate" | "installedVersion" | "archived"
  >,
  newVersion: string,
  versionChanged: boolean
): boolean {
  if (game.status === Status.Unchecked) {
    return false;
  }
  if (game.installedVersion) {
    return game.installedVersion !== newVersion;
  }
  if (versionChanged && !game.archived) {
    return true;
  }
  return game.hasUpdate;
}

function defaultFetchMetadata(params: {
  threadId: number;
  knownBulkVersion: string | undefined;
  session: DecryptedSession | null;
  forumQueue: PQueue;
  useCacheApiFallback: boolean;
  cacheApiUrl: string;
}): Promise<ScrapeResult> {
  const primary = new DirectF95MetadataProvider();
  const fallback = params.useCacheApiFallback
    ? new CacheApiMetadataProvider(params.cacheApiUrl)
    : null;
  return fetchMetadataWithFallback(primary, fallback, {
    threadId: params.threadId,
    knownBulkVersion: params.knownBulkVersion,
    session: params.session,
    forumQueue: params.forumQueue,
  });
}

export class IndexJobProcessor {
  private readonly db: AppDatabase;
  private readonly sqlite: Database;
  private readonly coversDir: string;
  private readonly cipher: SecretCipher;
  private readonly emitEvent: (event: SseEvent) => void;
  private readonly fetchMetadataFn: FetchThreadMetadataFn;
  private readonly importThreadListFn: typeof importF95ThreadList;
  private readonly fetchBulkVersionsFn: typeof fetchBulkVersions;
  private readonly fetchFastTimestampsFn: typeof fetchFastCheckTimestamps;
  private readonly downloadCoverFn: typeof downloadCoverImage;
  private readonly coverExistsFn: (coverFile: string) => boolean;
  private readonly now: () => number;

  private readonly cancelledJobs = new Set<string>();
  private shuttingDown = false;

  constructor(deps: IndexJobProcessorDeps) {
    this.db = deps.db;
    this.sqlite = deps.sqlite;
    this.coversDir = deps.coversDir;
    this.cipher = deps.cipher;
    this.emitEvent = deps.emitEvent;
    this.fetchMetadataFn = deps.fetchMetadata ?? defaultFetchMetadata;
    this.importThreadListFn = deps.importThreadList ?? importF95ThreadList;
    this.fetchBulkVersionsFn = deps.fetchBulkVersions ?? fetchBulkVersions;
    this.fetchFastTimestampsFn =
      deps.fetchFastTimestamps ?? fetchFastCheckTimestamps;
    this.downloadCoverFn = deps.downloadCover ?? downloadCoverImage;
    this.coverExistsFn =
      deps.coverExists ??
      ((coverFile) => fs.existsSync(path.join(this.coversDir, coverFile)));
    this.now = deps.now ?? Date.now;
  }

  cancelJob(jobId: string): void {
    this.cancelledJobs.add(jobId);
  }

  beginShutdown(): void {
    this.shuttingDown = true;
  }

  async processJob(
    jobId: string,
    kind: IndexJobKind,
    requestedIds?: number[],
    force = false
  ): Promise<void> {
    const startedJob = this.updateJobRow(jobId, {
      status: "running",
      startedAtMs: this.now(),
    });
    if (startedJob) {
      this.emitEvent({ type: "job_started", job: startedJob });
    }

    const appSettings = getAppSettings(this.db);
    const settings = {
      useCacheApiFallback: appSettings.useCacheApiFallback,
      cacheApiUrl: appSettings.cacheApiUrl,
      scrapeDelayMs: Math.max(250, appSettings.scrapeDelayMs),
    };

    const forumQueue = new PQueue({
      concurrency: 1,
      intervalCap: 1,
      interval: settings.scrapeDelayMs,
    });
    const imageQueue = new PQueue({
      concurrency: 2,
      intervalCap: 1,
      interval: 500,
    });

    try {
      let targetIds = requestedIds ?? [];
      const session = this.loadDecryptedF95Session();

      if (kind === "watchlist_import" || kind === "bookmarks_import") {
        const importOutcome = await this.importListCandidates(
          jobId,
          kind === "watchlist_import" ? "watched" : "bookmarks",
          session,
          forumQueue
        );
        if (!importOutcome.ok) return;
        targetIds = importOutcome.addedIds;
      }

      const candidates = this.selectCandidates(targetIds, force);
      const totalCount = candidates.length;
      this.updateJobRow(jobId, { totalCount });

      if (totalCount === 0) {
        const done = this.updateJobRow(jobId, {
          status: "completed",
          finishedAtMs: this.now(),
        });
        if (done) this.emitEvent({ type: "job_completed", job: done });
        return;
      }

      const sessionHeaders = buildSessionHeaders(session);
      const candidateIds = candidates.map((g) => g.id);
      const bulkVersions = await this.fetchBulkVersionsFn(
        candidateIds,
        sessionHeaders
      );
      const unresolvedIds = candidateIds.filter((id) => !bulkVersions.has(id));
      const fastTimestamps =
        settings.useCacheApiFallback && unresolvedIds.length > 0
          ? await this.fetchFastTimestampsFn(
              unresolvedIds,
              settings.cacheApiUrl
            )
          : new Map<number, number>();

      let processedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      let lastErrorSummary: string | null = null;

      for (const game of candidates) {
        if (this.shuttingDown || this.cancelledJobs.has(jobId)) {
          const cancelled = this.updateJobRow(jobId, {
            status: "cancelled",
            processedCount,
            updatedCount,
            errorCount,
            finishedAtMs: this.now(),
          });
          if (cancelled) {
            this.emitEvent({ type: "job_completed", job: cancelled });
          }
          return;
        }

        const meta = this.db
          .select()
          .from(schema.gameMetadata)
          .where(eq(schema.gameMetadata.gameId, game.id))
          .get();

        const bulkVer = bulkVersions.get(game.id);
        const fastChangedAtSec = fastTimestamps.get(game.id);
        const coverExists =
          Boolean(game.coverFile) && this.coverExistsFn(game.coverFile!);

        if (
          !shouldScrapeGame({
            force,
            game,
            meta,
            bulkVersion: bulkVer,
            fastChangedAtSec,
            coverExists,
            nowMs: this.now(),
          })
        ) {
          processedCount += 1;
          const prog = this.updateJobRow(jobId, { processedCount });
          if (prog) {
            this.emitEvent({
              type: "job_progress",
              job: prog,
              currentGameId: game.id,
              currentGameName: game.name,
            });
          }
          continue;
        }

        const scrapeRes = await this.fetchMetadataFn({
          threadId: game.id,
          knownBulkVersion: bulkVer,
          session,
          forumQueue,
          useCacheApiFallback: settings.useCacheApiFallback,
          cacheApiUrl: settings.cacheApiUrl,
        });

        if (!scrapeRes.ok) {
          errorCount += 1;
          const failureOutcome = this.handleScrapeFailure(
            game,
            bulkVer,
            scrapeRes.error
          );
          lastErrorSummary = failureOutcome.flagMsg;
          if (failureOutcome.versionUpdated && bulkVer) {
            updatedCount += 1;
            this.emitEvent({
              type: "game_updated",
              gameId: game.id,
              versionChanged: true,
              name: game.name,
              version: bulkVer,
            });
          }
          processedCount += 1;
          const prog = this.updateJobRow(jobId, {
            processedCount,
            ...(failureOutcome.versionUpdated ? { updatedCount } : {}),
            errorCount,
            errorSummary: lastErrorSummary,
          });
          if (prog) {
            this.emitEvent({
              type: "job_progress",
              job: prog,
              currentGameId: game.id,
              currentGameName: game.name,
            });
          }
          continue;
        }

        const data = scrapeRes.data;
        const shouldDownloadCover =
          data.imageUrl.startsWith("http") &&
          (!coverExists || meta?.imageUrl !== data.imageUrl);

        let coverFile = coverExists ? game.coverFile : null;
        let finalImageUrl = data.imageUrl;

        if (shouldDownloadCover) {
          const dlRes = await imageQueue.add(() =>
            this.downloadCoverFn(
              data.imageUrl,
              game.id,
              this.coversDir,
              sessionHeaders
            )
          );
          if (dlRes) {
            if (dlRes.coverFile) {
              coverFile = dlRes.coverFile;
            }
            finalImageUrl = dlRes.finalImageUrl;
          }
        }

        const { changed, versionChanged } = this.persistScrapedGame({
          game,
          meta,
          data,
          coverFile,
          finalImageUrl,
          hasBulkVersion: Boolean(bulkVer),
        });

        if (changed) {
          updatedCount += 1;
        }
        processedCount += 1;

        this.emitEvent({
          type: "game_updated",
          gameId: game.id,
          versionChanged,
          name: data.name || game.name,
          version: data.version,
        });

        const prog = this.updateJobRow(jobId, {
          processedCount,
          updatedCount,
        });
        if (prog) {
          this.emitEvent({
            type: "job_progress",
            job: prog,
            currentGameId: game.id,
            currentGameName: data.name || game.name,
          });
        }
      }

      const done = this.updateJobRow(jobId, {
        status: "completed",
        processedCount,
        updatedCount,
        errorCount,
        errorSummary: lastErrorSummary,
        finishedAtMs: this.now(),
      });
      if (done) {
        this.emitEvent({ type: "job_completed", job: done });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Worker job crashed";
      const failed = this.updateJobRow(jobId, {
        status: "failed",
        errorSummary: message,
        finishedAtMs: this.now(),
      });
      if (failed) {
        this.emitEvent({ type: "job_failed", job: failed, error: message });
      }
    }
  }

  private async importListCandidates(
    jobId: string,
    listKind: "watched" | "bookmarks",
    session: DecryptedSession | null,
    forumQueue: PQueue
  ): Promise<{ ok: true; addedIds: number[] } | { ok: false }> {
    if (
      !session ||
      !session.cookies.some((c) => c.name === "xf_user" && c.value)
    ) {
      const failed = this.updateJobRow(jobId, {
        status: "failed",
        errorSummary:
          "SESSION_LOGGED_OUT: Active F95zone login cookies are required to import threads.",
        finishedAtMs: this.now(),
      });
      if (failed) {
        this.emitEvent({
          type: "job_failed",
          job: failed,
          error: failed.errorSummary ?? "Missing F95zone session",
        });
      }
      return { ok: false };
    }

    const importRes = await this.importThreadListFn(
      listKind,
      session,
      forumQueue
    );
    if (!importRes.ok) {
      this.recordAccountStatusFromError(importRes.error.flag);
      const summary = `${importRes.error.flag}${importRes.error.details ? `: ${importRes.error.details}` : ""}`;
      const failed = this.updateJobRow(jobId, {
        status: "failed",
        errorSummary: summary,
        finishedAtMs: this.now(),
      });
      if (failed) {
        this.emitEvent({ type: "job_failed", job: failed, error: summary });
      }
      return { ok: false };
    }

    const newlyAddedIds: number[] = [];
    const now = this.now();
    this.sqlite.transaction(() => {
      for (const m of importRes.matches) {
        const exists = this.db
          .select({ id: schema.games.id })
          .from(schema.games)
          .where(eq(schema.games.id, m.id))
          .get();
        if (!exists) {
          this.db
            .insert(schema.games)
            .values({
              id: m.id,
              custom: false,
              name: m.slug.replace(/-/g, " ") || `Thread ${m.id}`,
              version: "Unchecked",
              developer: "",
              type: 23,
              status: Status.Unchecked,
              url: cleanThreadUrl(m.id),
              addedAtMs: now,
            })
            .run();
          this.db
            .insert(schema.gameMetadata)
            .values({ gameId: m.id, updatedAtMs: now })
            .onConflictDoNothing()
            .run();
          newlyAddedIds.push(m.id);
        }
      }
    })();

    if (newlyAddedIds.length > 0) {
      this.emitEvent({ type: "games_added", gameIds: newlyAddedIds });
    }
    return { ok: true, addedIds: newlyAddedIds };
  }

  private selectCandidates(targetIds: number[], force: boolean) {
    if (targetIds.length > 0) {
      return this.db
        .select()
        .from(schema.games)
        .where(inArray(schema.games.id, targetIds))
        .all()
        .filter((g) => !g.custom);
    }
    return this.db
      .select()
      .from(schema.games)
      .all()
      .filter((g) => !g.custom && (force || !g.archived));
  }

  private handleScrapeFailure(
    game: typeof schema.games.$inferSelect,
    bulkVer: string | undefined,
    error: IndexerError
  ): { flagMsg: string; versionUpdated: boolean } {
    const flagMsg = error.details
      ? `${error.flag}: ${error.details}`
      : error.flag;
    this.recordAccountStatusFromError(error.flag);

    const now = this.now();
    const versionUpdated =
      Boolean(bulkVer) &&
      bulkVer !== game.version &&
      game.status !== Status.Unchecked;
    const todayNoonTsSec = datestampUtcNoon(Math.floor(now / 1000));

    this.sqlite.transaction(() => {
      if (versionUpdated && bulkVer) {
        this.db
          .update(schema.games)
          .set({
            version: bulkVer,
            hasUpdate: computePostScrapeHasUpdate(game, bulkVer, true),
            lastUpdatedTsSec: Math.max(game.lastUpdatedTsSec, todayNoonTsSec),
          })
          .where(eq(schema.games.id, game.id))
          .run();
      }

      this.db
        .insert(schema.gameMetadata)
        .values({
          gameId: game.id,
          lastError: flagMsg,
          nextRetryAtMs: now + error.retryDelayMs,
          ...(versionUpdated ? { expiresAtMs: 0 } : {}),
          updatedAtMs: now,
        })
        .onConflictDoUpdate({
          target: schema.gameMetadata.gameId,
          set: {
            lastError: flagMsg,
            nextRetryAtMs: now + error.retryDelayMs,
            ...(versionUpdated ? { expiresAtMs: 0 } : {}),
            updatedAtMs: now,
          },
        })
        .run();
    })();

    return { flagMsg, versionUpdated };
  }

  private persistScrapedGame(params: {
    game: typeof schema.games.$inferSelect;
    meta: typeof schema.gameMetadata.$inferSelect | undefined;
    data: ScrapedThreadData;
    coverFile: string | null;
    finalImageUrl: string;
    hasBulkVersion: boolean;
  }): { changed: boolean; versionChanged: boolean } {
    const { game, meta, data, coverFile, finalImageUrl, hasBulkVersion } =
      params;
    const nowMs = this.now();
    const versionChanged =
      game.status !== Status.Unchecked &&
      Boolean(game.version) &&
      data.version !== game.version;
    const hasUpdate = computePostScrapeHasUpdate(
      game,
      data.version,
      versionChanged
    );
    const todayNoonTsSec = datestampUtcNoon(Math.floor(nowMs / 1000));
    const nextLastUpdatedTsSec = versionChanged
      ? Math.max(data.lastUpdated || 0, todayNoonTsSec)
      : data.lastUpdated || game.lastUpdatedTsSec;
    const ttlMs = hasBulkVersion ? 7 * DAY_MS : 2 * DAY_MS;
    const contentHash = computeContentHash(data);
    const changed =
      !meta || meta.contentHash !== contentHash || versionChanged;

    this.sqlite.transaction(() => {
      this.db
        .update(schema.games)
        .set({
          name: data.name || game.name,
          version: data.version,
          developer: data.developer,
          type: data.type,
          status: data.status,
          url: cleanThreadUrl(game.id),
          hasUpdate,
          lastUpdatedTsSec: nextLastUpdatedTsSec,
          lastCheckedAtMs: nowMs,
          coverFile,
        })
        .where(eq(schema.games.id, game.id))
        .run();

      this.db
        .insert(schema.gameMetadata)
        .values({
          gameId: game.id,
          score: data.score,
          votes: data.votes,
          description: data.description,
          changelog: data.changelog,
          tagsJson: data.tags,
          unknownTagsJson: data.unknownTags,
          unknownTagsFlag: data.unknownTags.length > 0,
          imageUrl: finalImageUrl,
          previewsUrlsJson: data.previewsUrls,
          downloadsJson: data.downloads,
          reviewsTotal: data.reviewsTotal,
          reviewsJson: data.reviews,
          contentHash,
          lastError: null,
          nextRetryAtMs: null,
          expiresAtMs: nowMs + ttlMs,
          updatedAtMs: nowMs,
        })
        .onConflictDoUpdate({
          target: schema.gameMetadata.gameId,
          set: {
            score: data.score,
            votes: data.votes,
            description: data.description,
            changelog: data.changelog,
            tagsJson: data.tags,
            unknownTagsJson: data.unknownTags,
            unknownTagsFlag: data.unknownTags.length > 0,
            imageUrl: finalImageUrl,
            previewsUrlsJson: data.previewsUrls,
            downloadsJson: data.downloads,
            reviewsTotal: data.reviewsTotal,
            reviewsJson: data.reviews,
            contentHash,
            lastError: null,
            nextRetryAtMs: null,
            expiresAtMs: nowMs + ttlMs,
            updatedAtMs: nowMs,
          },
        })
        .run();
    })();

    return { changed, versionChanged };
  }

  private loadDecryptedF95Session(): DecryptedSession | null {
    const row = this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, "f95zone"))
      .get();
    if (!row || !row.encryptedPayload) return null;
    try {
      const json = this.cipher.decrypt(row.encryptedPayload);
      const parsed = JSON.parse(json) as DecryptedSession;
      if (!Array.isArray(parsed.cookies)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private recordAccountStatusFromError(flag: IndexerErrorFlag): void {
    const status = ERROR_FLAG_TO_ACCOUNT_STATUS[flag];
    if (!status) return;

    const now = this.now();
    const existing = this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, "f95zone"))
      .get();
    if (!existing || existing.status === status) return;

    this.db
      .update(schema.accounts)
      .set({ status, updatedAtMs: now })
      .where(eq(schema.accounts.id, "f95zone"))
      .run();

    const updated = this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, "f95zone"))
      .get();
    if (updated) {
      this.emitEvent({
        type: "account_updated",
        account: serializeAccountStatus(updated),
      });
    }
  }

  private updateJobRow(
    jobId: string,
    patch: Partial<typeof schema.indexJobs.$inferInsert>
  ): IndexJob | null {
    this.db
      .update(schema.indexJobs)
      .set(patch)
      .where(eq(schema.indexJobs.id, jobId))
      .run();
    const row = this.db
      .select()
      .from(schema.indexJobs)
      .where(eq(schema.indexJobs.id, jobId))
      .get();
    return row ? serializeIndexJob(row) : null;
  }
}
