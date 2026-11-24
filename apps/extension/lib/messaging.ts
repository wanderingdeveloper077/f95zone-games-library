import type { ExtensionBootstrapResponse } from "@game-library/shared";

export type ExtensionRequest =
  | { type: "GET_PAGE_DATA" }
  | { type: "ADD_GAME"; url: string }
  | { type: "SYNC_SESSION" }
  | { type: "PAIR_WITH_CODE"; code: string }
  | { type: "SET_PAIRING_TOKEN"; token: string }
  | { type: "SET_SERVER_PORT"; port: number }
  | { type: "GET_EXTENSION_STATE" }
  | { type: "REFRESH_BOOTSTRAP" };

export type BackgroundPushMessage =
  | { type: "LIBRARY_UPDATED"; data: ExtensionBootstrapResponse }
  | { type: "TOAST"; message: string; level: "info" | "error" };

export interface ExtensionActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
