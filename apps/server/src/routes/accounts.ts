import { SyncSessionInputSchema } from "@game-library/shared";
import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AccountsService } from "../services/accountsService.js";
import { sendError, sendValidationError } from "./httpError.js";

export interface AccountRouteDeps {
  accountsService: AccountsService;
  requirePairingToken: preHandlerHookHandler;
  requireLocalUiOrigin: preHandlerHookHandler;
}

export function registerAccountRoutes(
  app: FastifyInstance,
  deps: AccountRouteDeps
): void {
  app.get(
    "/api/accounts",
    { preHandler: deps.requireLocalUiOrigin },
    async () => {
      return { accounts: deps.accountsService.listAccounts() };
    }
  );

  app.post(
    "/api/accounts/f95zone/session",
    { preHandler: deps.requirePairingToken },
    async (request, reply) => {
      const parsed = SyncSessionInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(
          reply,
          "Invalid cookie session payload.",
          parsed.error
        );
      }

      const account = deps.accountsService.syncF95Session(parsed.data);
      return { account };
    }
  );

  app.post(
    "/api/accounts/f95zone/verify",
    { preHandler: deps.requireLocalUiOrigin },
    async (_request, reply) => {
      const result = await deps.accountsService.verifyF95Session();
      if (!result.ok) {
        return sendError(reply, result.statusCode, result.code, result.message);
      }
      return {
        account: result.account,
        ...(result.error ? { error: result.error } : {}),
      };
    }
  );

  app.delete(
    "/api/accounts/f95zone",
    { preHandler: deps.requireLocalUiOrigin },
    async () => {
      const account = deps.accountsService.clearF95Session();
      return { account };
    }
  );
}
