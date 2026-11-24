import type { ServerResponse } from "node:http";
import type { IndexJobKind, SseEvent } from "@game-library/shared";

export interface EventBroadcaster {
  broadcast(event: SseEvent): void;
}

export interface SseClientRegistry {
  readonly clientCount: number;
  addClient(res: ServerResponse, originHeader?: string): void;
  closeAll(): void;
}

export interface JobDispatcher {
  enqueueJob(
    jobId: string,
    kind: IndexJobKind,
    gameIds?: number[],
    force?: boolean
  ): void;
}

export interface JobCanceller {
  cancelJob(jobId: string): void;
}

export interface PairingTokenVerifier {
  verifyHeaderToken(headerValue: string | string[] | undefined): boolean;
}

export interface PairingCodeView {
  code: string;
  expiresAtMs: number;
}

export interface PairingService extends PairingTokenVerifier {
  getToken(): string;
  getTokenPreview(): string;
  rotateToken(): string;
  getActiveCode(): PairingCodeView | null;
  createPairingCode(): PairingCodeView;
  exchangeCode(submitted: string): string | null;
}

export interface SecretCipher {
  encrypt(plaintext: string): string;
  decrypt(envelope: string): string;
}

export interface CoverCleaner {
  deleteCovers(gameId: number): Promise<void>;
}

export type ResolvedCover =
  | { ok: true; filePath: string; mimeType: string }
  | { ok: false; statusCode: 400 | 403 | 404; code: string; message: string };

export interface CoverResolver {
  resolveCover(filename: string): ResolvedCover;
}

export interface LaunchErrorResult {
  ok: false;
  statusCode: 400 | 404 | 500;
  code: string;
  message: string;
}

export interface GameLauncher {
  launch(
    executable: string
  ): Promise<{ ok: true; target: string } | LaunchErrorResult>;
  openFolder(
    executable: string
  ): Promise<{ ok: true; folder: string } | LaunchErrorResult>;
}

export interface FilePicker {
  pickPath(mode: "file" | "folder", title?: string): Promise<string | null>;
}
