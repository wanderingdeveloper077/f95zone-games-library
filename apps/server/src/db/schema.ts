import type {
  AccountStatusValue,
  DownloadSection,
  IndexJobKind,
  IndexJobStatus,
  Review,
  TagHighlightId,
} from "@game-library/shared";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const games = sqliteTable("games", {
  id: integer("id").primaryKey(),
  custom: integer("custom", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull().default(""),
  version: text("version").notNull().default("Unchecked"),
  developer: text("developer").notNull().default(""),
  // Default 23 = Type.Unchecked
  type: integer("type").notNull().default(23),
  // Default 5 = Status.Unchecked
  status: integer("status").notNull().default(5),
  url: text("url").notNull().default(""),
  installedVersion: text("installed_version").notNull().default(""),
  finishedVersion: text("finished_version").notNull().default(""),
  hasUpdate: integer("has_update", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  rating: real("rating").notNull().default(0),
  notes: text("notes").notNull().default(""),
  executablesJson: text("executables_json", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  addedAtMs: integer("added_at_ms").notNull().default(0),
  lastUpdatedTsSec: integer("last_updated_ts_sec").notNull().default(0),
  lastCheckedAtMs: integer("last_checked_at_ms").notNull().default(0),
  lastLaunchedAtMs: integer("last_launched_at_ms").notNull().default(0),
  playtimeSec: real("playtime_sec").notNull().default(0),
  coverFile: text("cover_file"),
});

export const gameMetadata = sqliteTable("game_metadata", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  score: real("score").notNull().default(0),
  votes: integer("votes").notNull().default(0),
  description: text("description").notNull().default(""),
  changelog: text("changelog").notNull().default(""),
  tagsJson: text("tags_json", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .default([]),
  unknownTagsJson: text("unknown_tags_json", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  unknownTagsFlag: integer("unknown_tags_flag", { mode: "boolean" })
    .notNull()
    .default(false),
  imageUrl: text("image_url").notNull().default(""),
  previewsUrlsJson: text("previews_urls_json", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  downloadsJson: text("downloads_json", { mode: "json" })
    .$type<DownloadSection[]>()
    .notNull()
    .default([]),
  reviewsTotal: integer("reviews_total").notNull().default(0),
  reviewsJson: text("reviews_json", { mode: "json" })
    .$type<Review[]>()
    .notNull()
    .default([]),
  contentHash: text("content_hash").notNull().default(""),
  lastError: text("last_error"),
  nextRetryAtMs: integer("next_retry_at_ms"),
  expiresAtMs: integer("expires_at_ms"),
  updatedAtMs: integer("updated_at_ms").notNull().default(0),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  provider: text("provider").$type<"f95zone" | "rpdl">().notNull(),
  label: text("label").notNull().default(""),
  userAgent: text("user_agent"),
  encryptedPayload: text("encrypted_payload").notNull().default(""),
  cookieCount: integer("cookie_count").notNull().default(0),
  hasXfUser: integer("has_xf_user", { mode: "boolean" }).notNull().default(false),
  hasCfClearance: integer("has_cf_clearance", { mode: "boolean" })
    .notNull()
    .default(false),
  status: text("status")
    .$type<AccountStatusValue>()
    .notNull()
    .default("unconfigured"),
  lastVerifiedAtMs: integer("last_verified_at_ms"),
  updatedAtMs: integer("updated_at_ms").notNull().default(0),
});

export const indexJobs = sqliteTable("index_jobs", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<IndexJobKind>().notNull(),
  status: text("status").$type<IndexJobStatus>().notNull().default("queued"),
  totalCount: integer("total_count").notNull().default(0),
  processedCount: integer("processed_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  payloadJson: text("payload_json").notNull().default("{}"),
  errorSummary: text("error_summary"),
  createdAtMs: integer("created_at_ms").notNull(),
  startedAtMs: integer("started_at_ms"),
  finishedAtMs: integer("finished_at_ms"),
});

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  useCacheApiFallback: integer("use_cache_api_fallback", { mode: "boolean" })
    .notNull()
    .default(true),
  cacheApiUrl: text("cache_api_url")
    .notNull()
    .default("https://api.f95checker.dev"),
  scrapeDelayMs: integer("scrape_delay_ms").notNull().default(1000),
  extIconGlow: integer("ext_icon_glow", { mode: "boolean" })
    .notNull()
    .default(true),
  extHighlightTags: integer("ext_highlight_tags", { mode: "boolean" })
    .notNull()
    .default(true),
  tagHighlightsJson: text("tag_highlights_json", { mode: "json" })
    .$type<Record<string, TagHighlightId>>()
    .notNull()
    .default({}),
  updatedAtMs: integer("updated_at_ms").notNull().default(0),
});
