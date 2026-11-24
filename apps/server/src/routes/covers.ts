import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CoverResolver } from "../contracts/ports.js";
import { sendError } from "./httpError.js";

const CoverFilenameParamSchema = z.object({
  filename: z.string(),
});

export interface CoverRoutesDeps {
  coverResolver: CoverResolver;
}

export function registerCoverRoutes(
  app: FastifyInstance,
  deps: CoverRoutesDeps
): void {
  app.get("/covers/:filename", async (request, reply) => {
    const param = CoverFilenameParamSchema.safeParse(request.params);
    if (!param.success) {
      return sendError(
        reply,
        400,
        "INVALID_FILENAME",
        "Invalid cover filename."
      );
    }

    const resolved = deps.coverResolver.resolveCover(param.data.filename);
    if (!resolved.ok) {
      return sendError(
        reply,
        resolved.statusCode,
        resolved.code,
        resolved.message
      );
    }

    reply.header("Cache-Control", "public, max-age=86400");
    reply.type(resolved.mimeType);
    return reply.send(fs.createReadStream(resolved.filePath));
  });
}
