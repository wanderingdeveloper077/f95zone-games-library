import type {
  AppSettings,
  ExtensionBootstrapResponse,
  UpdateAppSettings,
} from "@game-library/shared";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import {
  getAppSettings,
  listGames,
  statusColorForBadge,
} from "../db/queries.js";
import * as schema from "../db/schema.js";

export interface SettingsServiceDeps {
  db: AppDatabase;
  now?: () => number;
}

export class SettingsService {
  private readonly db: AppDatabase;
  private readonly now: () => number;

  constructor(deps: SettingsServiceDeps) {
    this.db = deps.db;
    this.now = deps.now ?? Date.now;
  }

  getSettings(): AppSettings {
    return getAppSettings(this.db);
  }

  updateSettings(patch: UpdateAppSettings): AppSettings {
    const previous = getAppSettings(this.db);

    this.db
      .update(schema.appSettings)
      .set({
        ...(patch.useCacheApiFallback !== undefined
          ? { useCacheApiFallback: patch.useCacheApiFallback }
          : {}),
        ...(patch.cacheApiUrl !== undefined
          ? { cacheApiUrl: patch.cacheApiUrl }
          : {}),
        ...(patch.scrapeDelayMs !== undefined
          ? { scrapeDelayMs: patch.scrapeDelayMs }
          : {}),
        ...(patch.downloadGalleryImages !== undefined
          ? { downloadGalleryImages: patch.downloadGalleryImages }
          : {}),
        ...(patch.sfwMode !== undefined ? { sfwMode: patch.sfwMode } : {}),
        ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
        ...(patch.extIconGlow !== undefined
          ? { extIconGlow: patch.extIconGlow }
          : {}),
        ...(patch.extHighlightTags !== undefined
          ? { extHighlightTags: patch.extHighlightTags }
          : {}),
        ...(patch.tagHighlights !== undefined
          ? { tagHighlightsJson: patch.tagHighlights }
          : {}),
        updatedAtMs: this.now(),
      })
      .where(eq(schema.appSettings.id, 0))
      .run();

    if (!previous.downloadGalleryImages && patch.downloadGalleryImages === true) {
      this.db
        .update(schema.gameMetadata)
        .set({ expiresAtMs: 0 })
        .where(
          and(
            isNotNull(schema.gameMetadata.expiresAtMs),
            sql`${schema.gameMetadata.previewsUrlsJson} != '[]'`,
            sql`${schema.gameMetadata.galleryFilesJson} = '[]'`
          )
        )
        .run();
    }

    return getAppSettings(this.db);
  }

  getExtensionBootstrap(): ExtensionBootstrapResponse {
    const games = listGames(this.db).filter((g) => !g.custom && g.id > 0);
    const settings = getAppSettings(this.db);
    return {
      games: games.map((g) => ({
        id: g.id,
        name: g.name,
        status: g.status,
        hasUpdate: g.hasUpdate,
        notes: g.notes,
        badgeColor: statusColorForBadge(g.status, g.hasUpdate),
      })),
      settings: {
        iconGlow: settings.extIconGlow,
        highlightTags: settings.extHighlightTags,
        tagHighlights: settings.tagHighlights,
      },
    };
  }
}
