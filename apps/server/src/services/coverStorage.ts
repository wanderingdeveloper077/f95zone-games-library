import fs from "node:fs";
import path from "node:path";
import type {
  CoverCleaner,
  CoverResolver,
  ResolvedCover,
} from "../contracts/ports.js";
import { deleteCoverFiles } from "../indexer/images.js";

const COVER_FILENAME_RE = /^[a-zA-Z0-9._-]+$/;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
};

export class LocalCoverStorage implements CoverResolver, CoverCleaner {
  private readonly coversDir: string;

  constructor(coversDir: string) {
    this.coversDir = coversDir;
  }

  resolveCover(filename: string): ResolvedCover {
    if (!COVER_FILENAME_RE.test(filename) || filename.includes("..")) {
      return {
        ok: false,
        statusCode: 400,
        code: "INVALID_FILENAME",
        message: "Unsafe cover filename.",
      };
    }

    const coversRoot = path.resolve(this.coversDir);
    const targetPath = path.resolve(coversRoot, filename);
    if (!targetPath.startsWith(coversRoot + path.sep)) {
      return {
        ok: false,
        statusCode: 403,
        code: "FORBIDDEN",
        message: "Path traversal rejected.",
      };
    }

    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      return {
        ok: false,
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Cover not found.",
      };
    }

    const ext = path.extname(filename).toLowerCase();
    return {
      ok: true,
      filePath: targetPath,
      mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
    };
  }

  async deleteCovers(gameId: number): Promise<void> {
    await deleteCoverFiles(gameId, this.coversDir);
  }
}
