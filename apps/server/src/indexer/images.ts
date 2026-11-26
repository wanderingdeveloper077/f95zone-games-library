import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Agent, request } from "undici";
import { F95_ATTACHMENTS_HOSTS, normalizeAttachmentUrl } from "./f95zone.js";

const insecureNinjaDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

/**
 * Detect common image format extension from buffer magic bytes.
 */
export function detectImageExtension(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg";
  }
  if (buf.length >= 6 && buf.subarray(0, 6).toString("ascii").startsWith("GIF8")) {
    return "gif";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") {
      return "avif";
    }
  }
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return "bmp";
  }
  return "img";
}

export interface CoverDownloadResult {
  coverFile: string | null;
  finalImageUrl: string;
}

/**
 * Remove existing cover files matching `<gameId>.*` in `coversDir`.
 */
export async function deleteCoverFiles(
  gameId: number,
  coversDir: string
): Promise<void> {
  if (!fs.existsSync(coversDir)) return;
  const prefix = `${gameId}.`;
  const entries = await fsp.readdir(coversDir);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => fsp.unlink(path.join(coversDir, name)).catch(() => undefined))
  );
}

const VALID_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "bmp",
]);

interface FetchedImageResult {
  buffer: Buffer | null;
  ext: string;
  finalImageUrl: string;
}

async function fetchImageBytes(
  rawUrl: string,
  headers: Record<string, string>
): Promise<FetchedImageResult> {
  if (!rawUrl || !rawUrl.startsWith("http")) {
    return { buffer: null, ext: "img", finalImageUrl: rawUrl || "missing" };
  }

  let candidateUrl = rawUrl;

  for (let attempt = 0; attempt < F95_ATTACHMENTS_HOSTS.length; attempt += 1) {
    const isNinja = candidateUrl.startsWith("https://attachments.f95zone.ninja/");
    try {
      const res = await request(candidateUrl, {
        method: "GET",
        headers,
        headersTimeout: 30_000,
        bodyTimeout: 120_000,
        ...(isNinja ? { dispatcher: insecureNinjaDispatcher } : {}),
      });

      if (res.statusCode >= 400) {
        await res.body.dump().catch(() => undefined);
        return {
          buffer: null,
          ext: "img",
          finalImageUrl: candidateUrl.startsWith("https://i.imgur.com")
            ? "blocked"
            : "dead",
        };
      }
      if (res.statusCode >= 300) {
        await res.body.dump().catch(() => undefined);
        return { buffer: null, ext: "img", finalImageUrl: candidateUrl };
      }

      const arrayBuf = await res.body.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      if (buffer.length === 0) {
        return { buffer: null, ext: "img", finalImageUrl: candidateUrl };
      }

      const ext = detectImageExtension(buffer);
      return { buffer, ext, finalImageUrl: candidateUrl };
    } catch {
      const hostIdx = F95_ATTACHMENTS_HOSTS.findIndex((h) =>
        candidateUrl.startsWith(h)
      );
      if (hostIdx !== -1 && hostIdx < F95_ATTACHMENTS_HOSTS.length - 1) {
        const currentPrefix = F95_ATTACHMENTS_HOSTS[hostIdx]!;
        const nextPrefix = F95_ATTACHMENTS_HOSTS[hostIdx + 1]!;
        candidateUrl = nextPrefix + candidateUrl.slice(currentPrefix.length);
        continue;
      }
      break;
    }
  }

  return { buffer: null, ext: "img", finalImageUrl: candidateUrl };
}

/**
 * Remove existing cached gallery directory for `<gameId>` under `coversDir/gallery/<gameId>`.
 */
export async function deleteGalleryFiles(
  gameId: number,
  coversDir: string
): Promise<void> {
  const galleryDir = path.join(coversDir, "gallery", String(gameId));
  await fsp.rm(galleryDir, { recursive: true, force: true }).catch(() => undefined);
}

/**
 * Download and atomically cache a cover image locally under `data/covers/<gameId>.<ext>`.
 * Implements CDN failover (.to -> .com -> .ninja) and no-redirect protection.
 */
export async function downloadCoverImage(
  rawUrl: string,
  gameId: number,
  coversDir: string,
  headers: Record<string, string>
): Promise<CoverDownloadResult> {
  if (!rawUrl || !rawUrl.startsWith("http")) {
    return { coverFile: null, finalImageUrl: rawUrl || "missing" };
  }

  const fetched = await fetchImageBytes(rawUrl, headers);
  if (!fetched.buffer) {
    return { coverFile: null, finalImageUrl: fetched.finalImageUrl };
  }

  await fsp.mkdir(coversDir, { recursive: true });
  const filename = `${gameId}.${fetched.ext}`;
  const tempPath = path.join(
    coversDir,
    `.tmp-${gameId}-${Date.now()}.${fetched.ext}`
  );
  const finalPath = path.join(coversDir, filename);

  await fsp.writeFile(tempPath, fetched.buffer);
  await deleteCoverFiles(gameId, coversDir);
  await fsp.rename(tempPath, finalPath);

  return { coverFile: filename, finalImageUrl: fetched.finalImageUrl };
}

export interface DownloadGalleryOptions {
  excludeUrls?: Iterable<string>;
  schedule?: <T>(fn: () => Promise<T>) => Promise<T | void>;
  shouldAbort?: () => boolean;
}

/**
 * Download and cache gallery attachment images under `data/covers/gallery/<gameId>/<sha1>.<ext>`.
 * Reuses already-cached files, excludes cover URLs, and prunes stale gallery files.
 */
export async function downloadGalleryImages(
  urls: string[],
  gameId: number,
  coversDir: string,
  headers: Record<string, string>,
  options?: DownloadGalleryOptions
): Promise<string[]> {
  const excluded = new Set<string>();
  for (const raw of options?.excludeUrls ?? []) {
    if (raw) {
      excluded.add(normalizeAttachmentUrl(raw));
    }
  }

  const uniqueUrls: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    if (!raw || !raw.startsWith("http")) continue;
    const normalized = normalizeAttachmentUrl(raw);
    if (excluded.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueUrls.push(normalized);
  }

  if (uniqueUrls.length === 0) {
    if (!options?.shouldAbort?.()) {
      await deleteGalleryFiles(gameId, coversDir);
    }
    return [];
  }

  const galleryDir = path.join(coversDir, "gallery", String(gameId));
  await fsp.mkdir(galleryDir, { recursive: true });

  const existingEntries = await fsp
    .readdir(galleryDir, { withFileTypes: true })
    .catch(() => []);
  const existingByDigest = new Map<string, string>();
  for (const entry of existingEntries) {
    if (!entry.isFile() || entry.name.startsWith(".tmp-")) continue;
    const parsed = path.parse(entry.name);
    const ext = parsed.ext.slice(1).toLowerCase();
    if (
      !/^[a-f0-9]{40}$/.test(parsed.name) ||
      !VALID_IMAGE_EXTENSIONS.has(ext)
    ) {
      continue;
    }
    const stat = await fsp
      .stat(path.join(galleryDir, entry.name))
      .catch(() => null);
    if (stat && stat.size > 0) {
      existingByDigest.set(parsed.name, entry.name);
    }
  }

  const desiredDigests = new Set<string>();
  const galleryFiles: string[] = [];
  let aborted = false;

  for (const url of uniqueUrls) {
    if (options?.shouldAbort?.()) {
      aborted = true;
      break;
    }

    const digest = crypto.createHash("sha1").update(url).digest("hex");
    desiredDigests.add(digest);

    const cached = existingByDigest.get(digest);
    if (cached) {
      galleryFiles.push(cached);
      continue;
    }

    const task = () => fetchImageBytes(url, headers);
    const fetched = options?.schedule
      ? await options.schedule(task)
      : await task();
    if (!fetched?.buffer || !VALID_IMAGE_EXTENSIONS.has(fetched.ext)) {
      continue;
    }

    const filename = `${digest}.${fetched.ext}`;
    const rand = crypto.randomBytes(4).toString("hex");
    const tempPath = path.join(
      galleryDir,
      `.tmp-${digest}-${Date.now()}-${rand}.${fetched.ext}`
    );
    const finalPath = path.join(galleryDir, filename);

    await fsp.writeFile(tempPath, fetched.buffer);
    await fsp.rename(tempPath, finalPath);
    existingByDigest.set(digest, filename);
    galleryFiles.push(filename);
  }

  if (!aborted) {
    const currentEntries = await fsp
      .readdir(galleryDir, { withFileTypes: true })
      .catch(() => []);
    await Promise.all(
      currentEntries
        .filter((entry) => {
          if (!entry.isFile()) return false;
          if (entry.name.startsWith(".tmp-")) return true;
          const stem = path.parse(entry.name).name;
          return /^[a-f0-9]{40}$/.test(stem) && !desiredDigests.has(stem);
        })
        .map((entry) =>
          fsp.unlink(path.join(galleryDir, entry.name)).catch(() => undefined)
        )
    );
  }

  return galleryFiles;
}
