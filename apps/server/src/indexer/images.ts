import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Agent, request } from "undici";
import { F95_ATTACHMENTS_HOSTS } from "./f95zone.js";

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

  await fsp.mkdir(coversDir, { recursive: true });
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
          coverFile: null,
          finalImageUrl: candidateUrl.startsWith("https://i.imgur.com")
            ? "blocked"
            : "dead",
        };
      }
      if (res.statusCode >= 300) {
        await res.body.dump().catch(() => undefined);
        return { coverFile: null, finalImageUrl: candidateUrl };
      }

      const arrayBuf = await res.body.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      if (buffer.length === 0) {
        return { coverFile: null, finalImageUrl: candidateUrl };
      }

      const ext = detectImageExtension(buffer);
      const filename = `${gameId}.${ext}`;
      const tempPath = path.join(coversDir, `.tmp-${gameId}-${Date.now()}.${ext}`);
      const finalPath = path.join(coversDir, filename);

      await fsp.writeFile(tempPath, buffer);
      await deleteCoverFiles(gameId, coversDir);
      await fsp.rename(tempPath, finalPath);

      return { coverFile: filename, finalImageUrl: candidateUrl };
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

  return { coverFile: null, finalImageUrl: candidateUrl };
}
