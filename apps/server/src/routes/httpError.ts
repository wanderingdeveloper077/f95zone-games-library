import type { FastifyReply } from "fastify";
import type { z } from "zod";

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}

export function sendValidationError(
  reply: FastifyReply,
  message: string,
  error: z.ZodError
) {
  return sendError(reply, 400, "VALIDATION_ERROR", message, error.flatten());
}
