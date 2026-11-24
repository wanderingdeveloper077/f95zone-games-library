import type {
  AppSettings,
  ExtensionBootstrapResponse,
  UpdateAppSettings,
} from "@game-library/shared";
import { eq } from "drizzle-orm";
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
