import {
  CreateGamesInputSchema,
  LaunchGameInputSchema,
  OpenFolderInputSchema,
  RefreshGamesInputSchema,
  UpdateGameInputSchema,
} from "@game-library/shared";
import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { z } from "zod";
import type { GamesService } from "../services/gamesService.js";
import { sendError, sendValidationError } from "./httpError.js";

const GamesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.coerce.number().int().optional(),
  type: z.coerce.number().int().optional(),
  updatesOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  archived: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z
    .enum(["lastUpdated", "addedAt", "name", "score", "rating"])
    .optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

const GameIdParamSchema = z.object({
  id: z.coerce.number().int(),
});

const ImportSourceParamSchema = z.object({
  source: z.enum(["watched", "bookmarks"]),
});

const ExtensionAddBodySchema = z.object({
  urls: z.array(z.string().min(1)).min(1).max(100),
});

export interface GamesRouteDeps {
  gamesService: GamesService;
  requirePairingToken: preHandlerHookHandler;
  requireLocalUiOrigin: preHandlerHookHandler;
}

export function registerGameRoutes(
  app: FastifyInstance,
  deps: GamesRouteDeps
): void {
  app.get(
    "/api/games",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const parsed = GamesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Invalid query parameters.",
          parsed.error
        );
      }
      return { games: deps.gamesService.list(parsed.data) };
    }
  );

  app.get(
    "/api/games/:id",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const param = GameIdParamSchema.safeParse(request.params);
      if (!param.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid game ID.");
      }
      const detail = deps.gamesService.getDetail(param.data.id);
      if (!detail) {
        return sendError(reply, 404, "NOT_FOUND", "Game not found.");
      }
      return { game: detail };
    }
  );

  app.post(
    "/api/games",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const parsed = CreateGamesInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, "Invalid game payload.", parsed.error);
      }

      if ("custom" in parsed.data) {
        const result = deps.gamesService.createCustomGame(parsed.data);
        return reply.code(201).send(result);
      }

      const result = deps.gamesService.addF95Threads(
        parsed.data.urls,
        parsed.data.autoRefresh
      );
      if (result.added.length === 0 && result.duplicateIds.length === 0) {
        return sendError(
          reply,
          400,
          "NO_VALID_THREADS",
          "No valid F95zone thread URLs were found."
        );
      }
      return reply.code(201).send(result);
    }
  );

  app.patch(
    "/api/games/:id",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const param = GameIdParamSchema.safeParse(request.params);
      if (!param.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid game ID.");
      }
      const parsed = UpdateGameInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Invalid game update payload.",
          parsed.error
        );
      }

      const updated = deps.gamesService.updateGame(param.data.id, parsed.data);
      if (!updated) {
        return sendError(reply, 404, "NOT_FOUND", "Game not found.");
      }
      return { game: updated };
    }
  );

  app.delete(
    "/api/games/:id",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const param = GameIdParamSchema.safeParse(request.params);
      if (!param.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid game ID.");
      }
      const deleted = await deps.gamesService.deleteGame(param.data.id);
      if (!deleted) {
        return sendError(reply, 404, "NOT_FOUND", "Game not found.");
      }
      return { deleted: true, id: param.data.id };
    }
  );

  app.post(
    "/api/games/:id/launch",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const param = GameIdParamSchema.safeParse(request.params);
      if (!param.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid game ID.");
      }
      const parsed = LaunchGameInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Invalid launch request.",
          parsed.error
        );
      }
      const result = await deps.gamesService.launchGame(
        param.data.id,
        parsed.data.executable
      );
      if (!result.ok) {
        return sendError(
          reply,
          result.statusCode,
          result.code,
          result.message
        );
      }
      return {
        launched: true,
        executable: result.executable,
        lastLaunchedAtMs: result.lastLaunchedAtMs,
      };
    }
  );

  app.post(
    "/api/games/:id/open-folder",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const param = GameIdParamSchema.safeParse(request.params);
      if (!param.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid game ID.");
      }
      const parsed = OpenFolderInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Invalid open-folder request.",
          parsed.error
        );
      }
      const result = await deps.gamesService.openGameFolder(
        param.data.id,
        parsed.data.executable
      );
      if (!result.ok) {
        return sendError(
          reply,
          result.statusCode,
          result.code,
          result.message
        );
      }
      return {
        opened: true,
        folder: result.folder,
      };
    }
  );

  app.post(
    "/api/games/refresh",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const parsed = RefreshGamesInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Invalid refresh request.",
          parsed.error
        );
      }

      const job = deps.gamesService.enqueueRefresh(
        parsed.data.gameIds,
        parsed.data.force
      );
      return reply.code(202).send({ job });
    }
  );

  app.post(
    "/api/games/import/:source",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const param = ImportSourceParamSchema.safeParse(request.params);
      if (!param.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Import source must be watched or bookmarks."
        );
      }

      const job = deps.gamesService.enqueueImport(param.data.source);
      return reply.code(202).send({ job });
    }
  );

  // Extension-protected add route
  app.post(
    "/api/extension/add",
    { preHandler: deps.requirePairingToken },
    async (request, reply) => {
      const parsed = ExtensionAddBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Expected { urls: string[] }.",
          parsed.error
        );
      }
      const result = deps.gamesService.addF95Threads(parsed.data.urls, true);
      if (result.added.length === 0 && result.duplicateIds.length === 0) {
        return sendError(
          reply,
          400,
          "NO_VALID_THREADS",
          "No valid F95zone thread URLs found."
        );
      }
      return reply.code(201).send(result);
    }
  );
}
