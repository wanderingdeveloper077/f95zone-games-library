import { PickFileInputSchema, UpdateAppSettingsSchema } from "@game-library/shared";
import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { z } from "zod";
import type {
  FilePicker,
  JobCanceller,
  SseClientRegistry,
} from "../contracts/ports.js";
import type { AppDatabase } from "../db/index.js";
import { listRecentJobs } from "../db/queries.js";
import type { SettingsService } from "../services/settingsService.js";
import { sendError, sendValidationError } from "./httpError.js";

const JobIdParamSchema = z.object({
  id: z.string().min(1),
});

export interface SystemRouteDeps {
  healthInfo: {
    journalMode: string;
    busyTimeout: number;
    port: number;
    appVersion: string;
  };
  db: AppDatabase;
  settingsService: SettingsService;
  jobCanceller: JobCanceller;
  sseRegistry: SseClientRegistry;
  filePicker?: FilePicker;
  isAllowedOrigin: (origin: string | undefined) => boolean;
  requirePairingToken: preHandlerHookHandler;
  requireLocalUiOrigin: preHandlerHookHandler;
}

export function registerSystemRoutes(
  app: FastifyInstance,
  deps: SystemRouteDeps
): void {
  app.get("/api/health", async () => {
    return {
      status: "ok",
      journalMode: deps.healthInfo.journalMode,
      busyTimeout: deps.healthInfo.busyTimeout,
      port: deps.healthInfo.port,
      version: deps.healthInfo.appVersion,
      sseClients: deps.sseRegistry.clientCount,
    };
  });

  app.get(
    "/api/jobs",
    { preHandler: deps.requireLocalUiOrigin },
    async () => {
      return { jobs: listRecentJobs(deps.db) };
    }
  );

  app.post(
    "/api/jobs/:id/cancel",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const param = JobIdParamSchema.safeParse(request.params);
      if (!param.success) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Invalid job ID.");
      }
      deps.jobCanceller.cancelJob(param.data.id);
      return { cancelling: true, id: param.data.id };
    }
  );

  app.get(
    "/api/settings",
    { preHandler: deps.requireLocalUiOrigin },
    async () => {
      return { settings: deps.settingsService.getSettings() };
    }
  );

  app.patch(
    "/api/settings",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const parsed = UpdateAppSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Invalid settings payload.",
          parsed.error
        );
      }

      return { settings: deps.settingsService.updateSettings(parsed.data) };
    }
  );

  app.post(
    "/api/system/pick-file",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const parsed = PickFileInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Invalid file picker request.",
          parsed.error
        );
      }
      const picked = deps.filePicker
        ? await deps.filePicker.pickPath(parsed.data.mode, parsed.data.title)
        : null;
      return { path: picked };
    }
  );

  app.get(
    "/api/extension/bootstrap",
    { preHandler: deps.requirePairingToken },
    async () => {
      return deps.settingsService.getExtensionBootstrap();
    }
  );

  app.get(
    "/api/events",
    { preHandler: deps.requireLocalUiOrigin },
    async (request, reply) => {
      const origin = request.headers.origin;
      const allowedOrigin =
        origin && deps.isAllowedOrigin(origin) ? origin : undefined;
      reply.hijack();
      deps.sseRegistry.addClient(reply.raw, allowedOrigin);
    }
  );
}
