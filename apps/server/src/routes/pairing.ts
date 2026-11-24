import { PairingExchangeInputSchema } from "@game-library/shared";
import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { PairingService } from "../contracts/ports.js";
import { sendError, sendValidationError } from "./httpError.js";

export interface PairingRouteDeps {
  pairing: PairingService;
  requireLocalUiOrigin: preHandlerHookHandler;
}

export function registerPairingRoutes(
  app: FastifyInstance,
  deps: PairingRouteDeps
): void {
  app.get(
    "/api/pairing/status",
    { preHandler: deps.requireLocalUiOrigin },
    async () => {
      return {
        pairingToken: deps.pairing.getToken(),
        tokenPreview: deps.pairing.getTokenPreview(),
        activeCode: deps.pairing.getActiveCode(),
      };
    }
  );

  app.post(
    "/api/pairing/code",
    { preHandler: deps.requireLocalUiOrigin },
    async () => {
      return deps.pairing.createPairingCode();
    }
  );

  app.post(
    "/api/pairing/rotate",
    { preHandler: deps.requireLocalUiOrigin },
    async () => {
      const token = deps.pairing.rotateToken();
      return {
        pairingToken: token,
        tokenPreview: deps.pairing.getTokenPreview(),
        activeCode: null,
      };
    }
  );

  // Callable by the browser extension with a short-lived code
  app.post("/api/pairing/exchange", async (request, reply) => {
    const parsed = PairingExchangeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(
        reply,
        "Invalid pairing code format.",
        parsed.error
      );
    }

    const token = deps.pairing.exchangeCode(parsed.data.code);
    if (!token) {
      return sendError(
        reply,
        401,
        "INVALID_PAIRING_CODE",
        "Pairing code is invalid or expired."
      );
    }

    return { pairingToken: token };
  });
}
