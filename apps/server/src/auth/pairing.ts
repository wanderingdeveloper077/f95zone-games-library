import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  PairingCodeView,
  PairingService,
  PairingTokenVerifier,
} from "../contracts/ports.js";
import { timingSafeTokenEqual } from "../db/crypto.js";

const PAIRING_CODE_TTL_MS = 120_000;
const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface TokenStore {
  read(): string | null;
  write(token: string): void;
}

export class FileTokenStore implements TokenStore {
  private readonly tokenPath: string;

  constructor(tokenPath: string) {
    this.tokenPath = tokenPath;
  }

  read(): string | null {
    fs.mkdirSync(path.dirname(this.tokenPath), { recursive: true });
    if (fs.existsSync(this.tokenPath)) {
      const existing = fs.readFileSync(this.tokenPath, "utf8").trim();
      if (existing.length >= 32) {
        return existing;
      }
    }
    return null;
  }

  write(token: string): void {
    fs.mkdirSync(path.dirname(this.tokenPath), { recursive: true });
    fs.writeFileSync(this.tokenPath, token, { encoding: "utf8", mode: 0o600 });
  }
}

export class PairingManager implements PairingService {
  private readonly store: TokenStore;
  private readonly now: () => number;
  private token: string;
  private activeCode: PairingCodeView | null = null;

  constructor(
    tokenPathOrStore: string | TokenStore,
    now: () => number = Date.now
  ) {
    this.store =
      typeof tokenPathOrStore === "string"
        ? new FileTokenStore(tokenPathOrStore)
        : tokenPathOrStore;
    this.now = now;
    this.token = this.loadOrCreateToken();
  }

  private loadOrCreateToken(): string {
    const existing = this.store.read();
    if (existing && existing.length >= 32) {
      return existing;
    }
    const fresh = crypto.randomBytes(32).toString("hex");
    this.store.write(fresh);
    return fresh;
  }

  getToken(): string {
    return this.token;
  }

  getTokenPreview(): string {
    return `${this.token.slice(0, 6)}...${this.token.slice(-4)}`;
  }

  rotateToken(): string {
    const fresh = crypto.randomBytes(32).toString("hex");
    this.store.write(fresh);
    this.token = fresh;
    this.activeCode = null;
    return fresh;
  }

  getActiveCode(): PairingCodeView | null {
    if (!this.activeCode) return null;
    if (this.now() >= this.activeCode.expiresAtMs) {
      this.activeCode = null;
      return null;
    }
    return this.activeCode;
  }

  createPairingCode(): PairingCodeView {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      const idx = crypto.randomInt(0, PAIRING_CODE_ALPHABET.length);
      code += PAIRING_CODE_ALPHABET.charAt(idx);
    }
    const entry = { code, expiresAtMs: this.now() + PAIRING_CODE_TTL_MS };
    this.activeCode = entry;
    return entry;
  }

  exchangeCode(submitted: string): string | null {
    const active = this.getActiveCode();
    if (!active) return null;
    const normalized = submitted.trim().toUpperCase();
    if (!timingSafeTokenEqual(normalized, active.code)) {
      return null;
    }
    this.activeCode = null;
    return this.token;
  }

  verifyHeaderToken(headerValue: string | string[] | undefined): boolean {
    const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!raw) return false;
    return timingSafeTokenEqual(raw.trim(), this.token);
  }
}

export function isLocalUiOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  port: number,
  isDev: boolean
): boolean {
  if (!origin) return true;
  if (/^(chrome-extension|moz-extension):\/\/[a-zA-Z0-9._-]+$/.test(origin)) {
    return true;
  }
  const exactAllowed = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ]);
  if (isDev) {
    exactAllowed.add("http://127.0.0.1:5173");
    exactAllowed.add("http://localhost:5173");
  }
  return exactAllowed.has(origin);
}

export function createPairingTokenGuard(verifier: PairingTokenVerifier) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers["x-pairing-token"];
    if (!verifier.verifyHeaderToken(header)) {
      return reply.code(401).send({
        error: {
          code: "INVALID_PAIRING_TOKEN",
          message: "Missing or invalid X-Pairing-Token header.",
        },
      });
    }
  };
}

export async function requireLocalUiOrigin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const origin = request.headers.origin;
  if (!isLocalUiOrigin(origin)) {
    return reply.code(403).send({
      error: {
        code: "FORBIDDEN_ORIGIN",
        message: "This endpoint may only be invoked from the local UI.",
      },
    });
  }
}
