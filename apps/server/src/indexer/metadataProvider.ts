import type PQueue from "p-queue";
import type { IndexerError, IndexerErrorFlag } from "./f95zone.js";
import {
  type DecryptedSession,
  type ScrapeResult,
  fetchThreadFromCacheApi,
  scrapeThreadDirect,
} from "./scraper.js";

export interface MetadataFetchContext {
  threadId: number;
  knownBulkVersion?: string;
  session: DecryptedSession | null;
  forumQueue: PQueue;
}

export interface MetadataProvider {
  readonly name: string;
  fetchThread(ctx: MetadataFetchContext): Promise<ScrapeResult>;
}

export const FALLBACK_TRIGGER_FLAGS = new Set<IndexerErrorFlag>([
  "CLOUDFLARE_CAPTCHA",
  "SESSION_LOGGED_OUT",
  "F95ZONE_RATELIMIT",
]);

export class DirectF95MetadataProvider implements MetadataProvider {
  readonly name = "direct";

  async fetchThread(ctx: MetadataFetchContext): Promise<ScrapeResult> {
    return scrapeThreadDirect(
      ctx.threadId,
      ctx.knownBulkVersion,
      ctx.session,
      ctx.forumQueue
    );
  }
}

export class CacheApiMetadataProvider implements MetadataProvider {
  readonly name = "cache_api";
  private readonly cacheApiUrl: string;

  constructor(cacheApiUrl: string) {
    this.cacheApiUrl = cacheApiUrl;
  }

  async fetchThread(ctx: MetadataFetchContext): Promise<ScrapeResult> {
    return fetchThreadFromCacheApi(ctx.threadId, this.cacheApiUrl);
  }
}

export async function fetchMetadataWithFallback(
  primary: MetadataProvider,
  fallback: MetadataProvider | null,
  ctx: MetadataFetchContext,
  shouldFallback: (error: IndexerError) => boolean = (err) =>
    FALLBACK_TRIGGER_FLAGS.has(err.flag)
): Promise<ScrapeResult> {
  const primaryResult = await primary.fetchThread(ctx);
  if (primaryResult.ok || !fallback || !shouldFallback(primaryResult.error)) {
    return primaryResult;
  }

  const fallbackResult = await fallback.fetchThread(ctx);
  return fallbackResult.ok ? fallbackResult : primaryResult;
}
