import { z } from "zod";
import { Category, Status, TagHighlight, Type } from "./enums.js";

export const DownloadMirrorSchema = z.object({
  label: z.string(),
  url: z.string(),
});
export type DownloadMirror = z.infer<typeof DownloadMirrorSchema>;

export const DownloadSectionSchema = z.object({
  name: z.string(),
  mirrors: z.array(DownloadMirrorSchema),
});
export type DownloadSection = z.infer<typeof DownloadSectionSchema>;

export const ReviewSchema = z.object({
  user: z.string(),
  score: z.number(),
  message: z.string(),
  likes: z.number().int(),
  timestamp: z.number().int(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const StatusIdSchema = z.union([
  z.literal(Status.Normal),
  z.literal(Status.Completed),
  z.literal(Status.OnHold),
  z.literal(Status.Abandoned),
  z.literal(Status.Unchecked),
  z.literal(Status.Custom),
  z.literal(Status.Unknown),
]);

export const TypeIdSchema = z.union([
  z.literal(Type.Misc),
  z.literal(Type.ADRIFT),
  z.literal(Type.CheatMod),
  z.literal(Type.Flash),
  z.literal(Type.HTML),
  z.literal(Type.Java),
  z.literal(Type.Mod),
  z.literal(Type.Others),
  z.literal(Type.QSP),
  z.literal(Type.RAGS),
  z.literal(Type.README),
  z.literal(Type.RPGM),
  z.literal(Type.RenPy),
  z.literal(Type.Request),
  z.literal(Type.Tads),
  z.literal(Type.Tool),
  z.literal(Type.Tutorial),
  z.literal(Type.Unity),
  z.literal(Type.UnrealEng),
  z.literal(Type.WebGL),
  z.literal(Type.WolfRPG),
  z.literal(Type.Unchecked),
  z.literal(Type.Comics),
  z.literal(Type.GIF),
  z.literal(Type.Manga),
  z.literal(Type.Pinup),
  z.literal(Type.Video),
  z.literal(Type.CG),
  z.literal(Type.Godot),
  z.literal(Type.Unknown),
]);

export const CategoryIdSchema = z.union([
  z.literal(Category.Games),
  z.literal(Category.Animations),
  z.literal(Category.Comics),
  z.literal(Category.Misc),
]);

export const TagHighlightIdSchema = z.union([
  z.literal(TagHighlight.Positive),
  z.literal(TagHighlight.Negative),
  z.literal(TagHighlight.Critical),
]);

export const GameSummarySchema = z.object({
  id: z.number().int(),
  custom: z.boolean(),
  name: z.string(),
  version: z.string(),
  developer: z.string(),
  type: z.number().int(),
  status: z.number().int(),
  url: z.string(),
  installedVersion: z.string(),
  finishedVersion: z.string(),
  hasUpdate: z.boolean(),
  archived: z.boolean(),
  rating: z.number(),
  notes: z.string(),
  addedAtMs: z.number().int(),
  lastUpdatedTsSec: z.number().int(),
  lastCheckedAtMs: z.number().int(),
  coverFile: z.string().nullable(),
  score: z.number(),
  votes: z.number().int(),
  tags: z.array(z.number().int()),
  executables: z.array(z.string()).default([]),
  lastError: z.string().nullable(),
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

export const GameDetailSchema = GameSummarySchema.extend({
  description: z.string(),
  changelog: z.string(),
  unknownTags: z.array(z.string()),
  unknownTagsFlag: z.boolean(),
  imageUrl: z.string(),
  previewsUrls: z.array(z.string()),
  downloads: z.array(DownloadSectionSchema),
  reviewsTotal: z.number().int(),
  reviews: z.array(ReviewSchema),
  playtimeSec: z.number(),
  lastLaunchedAtMs: z.number().int(),
  updatedAtMs: z.number().int(),
});
export type GameDetail = z.infer<typeof GameDetailSchema>;

export const CreateGamesInputSchema = z.union([
  z.object({
    urls: z.array(z.string().min(1)).min(1).max(500),
    autoRefresh: z.boolean().default(true),
  }),
  z.object({
    custom: z.literal(true),
    name: z.string().trim().min(1).max(200),
    version: z.string().trim().max(100).default("1.0"),
    developer: z.string().trim().max(200).default(""),
    type: z.number().int().default(Type.Misc),
    url: z.string().trim().max(500).default(""),
    notes: z.string().max(10000).default(""),
  }),
]);
export type CreateGamesInput = z.input<typeof CreateGamesInputSchema>;

export const UpdateGameInputSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  version: z.string().trim().max(100).optional(),
  developer: z.string().trim().max(200).optional(),
  type: z.number().int().optional(),
  status: z.number().int().optional(),
  url: z.string().trim().max(500).optional(),
  installedVersion: z.string().max(100).optional(),
  finishedVersion: z.string().max(100).optional(),
  hasUpdate: z.boolean().optional(),
  archived: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().max(20000).optional(),
  executables: z.array(z.string().trim().min(1).max(1000)).max(50).optional(),
});
export type UpdateGameInput = z.infer<typeof UpdateGameInputSchema>;

export const LaunchGameInputSchema = z.object({
  executable: z.string().trim().min(1).max(1000).optional(),
});
export type LaunchGameInput = z.infer<typeof LaunchGameInputSchema>;

export const LaunchGameResponseSchema = z.object({
  launched: z.literal(true),
  executable: z.string(),
  lastLaunchedAtMs: z.number().int(),
});
export type LaunchGameResponse = z.infer<typeof LaunchGameResponseSchema>;

export const OpenFolderInputSchema = z.object({
  executable: z.string().trim().min(1).max(1000).optional(),
});
export type OpenFolderInput = z.infer<typeof OpenFolderInputSchema>;

export const OpenFolderResponseSchema = z.object({
  opened: z.literal(true),
  folder: z.string(),
});
export type OpenFolderResponse = z.infer<typeof OpenFolderResponseSchema>;

export const PickFileInputSchema = z.object({
  mode: z.enum(["file", "folder"]).default("file"),
  title: z.string().trim().max(200).optional(),
});
export type PickFileInput = z.input<typeof PickFileInputSchema>;

export const PickFileResponseSchema = z.object({
  path: z.string().nullable(),
});
export type PickFileResponse = z.infer<typeof PickFileResponseSchema>;

export const RefreshGamesInputSchema = z.object({
  gameIds: z.array(z.number().int().positive()).max(1000).optional(),
  force: z.boolean().default(false),
});
export type RefreshGamesInput = z.input<typeof RefreshGamesInputSchema>;

export const CookieItemSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().max(8192),
  domain: z.string().min(1).max(256),
  path: z.string().default("/"),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  expirationDate: z.number().optional(),
});
export type CookieItem = z.input<typeof CookieItemSchema>;

export const SyncSessionInputSchema = z.object({
  cookies: z.array(CookieItemSchema).min(1).max(200),
  userAgent: z.string().min(5).max(1024),
});
export type SyncSessionInput = z.input<typeof SyncSessionInputSchema>;

export const AccountStatusValueSchema = z.enum([
  "unconfigured",
  "active",
  "expired",
  "captcha_required",
]);
export type AccountStatusValue = z.infer<typeof AccountStatusValueSchema>;

export const AccountStatusSchema = z.object({
  id: z.string(),
  provider: z.enum(["f95zone", "rpdl"]),
  label: z.string(),
  status: AccountStatusValueSchema,
  cookieCount: z.number().int(),
  hasXfUser: z.boolean(),
  hasCfClearance: z.boolean(),
  userAgent: z.string().nullable(),
  lastVerifiedAtMs: z.number().int().nullable(),
  updatedAtMs: z.number().int(),
});
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const PairingStatusSchema = z.object({
  pairingToken: z.string(),
  tokenPreview: z.string(),
  activeCode: z
    .object({
      code: z.string(),
      expiresAtMs: z.number().int(),
    })
    .nullable(),
});
export type PairingStatus = z.infer<typeof PairingStatusSchema>;

export const PairingCodeResponseSchema = z.object({
  code: z.string(),
  expiresAtMs: z.number().int(),
});
export type PairingCodeResponse = z.infer<typeof PairingCodeResponseSchema>;

export const PairingExchangeInputSchema = z.object({
  code: z.string().trim().min(4).max(16),
});
export type PairingExchangeInput = z.infer<typeof PairingExchangeInputSchema>;

export const PairingExchangeResponseSchema = z.object({
  pairingToken: z.string(),
});
export type PairingExchangeResponse = z.infer<typeof PairingExchangeResponseSchema>;

export const AppSettingsSchema = z.object({
  useCacheApiFallback: z.boolean(),
  cacheApiUrl: z.string().url(),
  scrapeDelayMs: z.number().int().min(250).max(10000),
  extIconGlow: z.boolean(),
  extHighlightTags: z.boolean(),
  tagHighlights: z.record(z.string(), TagHighlightIdSchema),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const UpdateAppSettingsSchema = AppSettingsSchema.partial();
export type UpdateAppSettings = z.infer<typeof UpdateAppSettingsSchema>;

export const IndexJobKindSchema = z.enum([
  "single_thread",
  "bulk_refresh",
  "watchlist_import",
  "bookmarks_import",
]);
export type IndexJobKind = z.infer<typeof IndexJobKindSchema>;

export const IndexJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type IndexJobStatus = z.infer<typeof IndexJobStatusSchema>;

export const IndexJobSchema = z.object({
  id: z.string(),
  kind: IndexJobKindSchema,
  status: IndexJobStatusSchema,
  totalCount: z.number().int(),
  processedCount: z.number().int(),
  updatedCount: z.number().int(),
  errorCount: z.number().int(),
  errorSummary: z.string().nullable(),
  createdAtMs: z.number().int(),
  startedAtMs: z.number().int().nullable(),
  finishedAtMs: z.number().int().nullable(),
});
export type IndexJob = z.infer<typeof IndexJobSchema>;

export const ExtensionBootstrapResponseSchema = z.object({
  games: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      status: z.number().int(),
      hasUpdate: z.boolean(),
      notes: z.string(),
      badgeColor: z.string(),
    })
  ),
  settings: z.object({
    iconGlow: z.boolean(),
    highlightTags: z.boolean(),
    tagHighlights: z.record(z.string(), TagHighlightIdSchema),
  }),
});
export type ExtensionBootstrapResponse = z.infer<typeof ExtensionBootstrapResponseSchema>;

export const SseEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("connected"),
    serverTimeMs: z.number().int(),
  }),
  z.object({
    type: z.literal("job_started"),
    job: IndexJobSchema,
  }),
  z.object({
    type: z.literal("job_progress"),
    job: IndexJobSchema,
    currentGameId: z.number().int().optional(),
    currentGameName: z.string().optional(),
  }),
  z.object({
    type: z.literal("job_completed"),
    job: IndexJobSchema,
  }),
  z.object({
    type: z.literal("job_failed"),
    job: IndexJobSchema,
    error: z.string(),
  }),
  z.object({
    type: z.literal("game_updated"),
    gameId: z.number().int(),
    versionChanged: z.boolean(),
    name: z.string(),
    version: z.string(),
  }),
  z.object({
    type: z.literal("games_added"),
    gameIds: z.array(z.number().int()),
  }),
  z.object({
    type: z.literal("account_updated"),
    account: AccountStatusSchema,
  }),
]);
export type SseEvent = z.infer<typeof SseEventSchema>;

export const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
