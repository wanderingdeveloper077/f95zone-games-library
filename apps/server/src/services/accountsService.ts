import type { AccountStatus, CookieItem } from "@game-library/shared";
import { eq } from "drizzle-orm";
import type { EventBroadcaster, SecretCipher } from "../contracts/ports.js";
import type { AppDatabase } from "../db/index.js";
import { serializeAccountStatus } from "../db/queries.js";
import * as schema from "../db/schema.js";
import type { IndexerError } from "../indexer/f95zone.js";
import { type DecryptedSession, verifyF95Session } from "../indexer/scraper.js";

export type SessionVerifier = (
  session: DecryptedSession
) => ReturnType<typeof verifyF95Session>;

export interface AccountsServiceDeps {
  db: AppDatabase;
  cipher: SecretCipher;
  broadcaster: EventBroadcaster;
  verifySession?: SessionVerifier;
  now?: () => number;
}

export type VerifySessionResult =
  | { ok: true; account: AccountStatus; error?: IndexerError }
  | {
      ok: false;
      statusCode: 400 | 500;
      code: string;
      message: string;
    };

export class AccountsService {
  private readonly db: AppDatabase;
  private readonly cipher: SecretCipher;
  private readonly broadcaster: EventBroadcaster;
  private readonly verifySessionFn: SessionVerifier;
  private readonly now: () => number;

  constructor(deps: AccountsServiceDeps) {
    this.db = deps.db;
    this.cipher = deps.cipher;
    this.broadcaster = deps.broadcaster;
    this.verifySessionFn = deps.verifySession ?? verifyF95Session;
    this.now = deps.now ?? Date.now;
  }

  listAccounts(): AccountStatus[] {
    const rows = this.db.select().from(schema.accounts).all();
    return rows.map(serializeAccountStatus);
  }

  syncF95Session(input: {
    cookies: CookieItem[];
    userAgent: string;
  }): AccountStatus {
    const { cookies, userAgent } = input;
    const hasXfUser = cookies.some(
      (c) => c.name === "xf_user" && Boolean(c.value)
    );
    const hasCfClearance = cookies.some(
      (c) => c.name === "cf_clearance" && Boolean(c.value)
    );

    const encryptedPayload = this.cipher.encrypt(
      JSON.stringify({ cookies, userAgent })
    );
    const now = this.now();
    const status = hasXfUser ? "active" : "unconfigured";

    this.db
      .insert(schema.accounts)
      .values({
        id: "f95zone",
        provider: "f95zone",
        label: "F95zone",
        userAgent,
        encryptedPayload,
        cookieCount: cookies.length,
        hasXfUser,
        hasCfClearance,
        status,
        lastVerifiedAtMs: hasXfUser ? now : null,
        updatedAtMs: now,
      })
      .onConflictDoUpdate({
        target: schema.accounts.id,
        set: {
          userAgent,
          encryptedPayload,
          cookieCount: cookies.length,
          hasXfUser,
          hasCfClearance,
          status,
          lastVerifiedAtMs: hasXfUser ? now : null,
          updatedAtMs: now,
        },
      })
      .run();

    const dto = this.requireF95AccountDto();
    this.broadcaster.broadcast({ type: "account_updated", account: dto });
    return dto;
  }

  loadDecryptedF95Session():
    | { ok: true; session: DecryptedSession }
    | { ok: false; code: "NO_SESSION" | "DECRYPT_FAILED"; message: string } {
    const row = this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, "f95zone"))
      .get();

    if (!row || !row.encryptedPayload) {
      return {
        ok: false,
        code: "NO_SESSION",
        message: "No F95zone cookies have been synced yet.",
      };
    }

    try {
      const session = JSON.parse(
        this.cipher.decrypt(row.encryptedPayload)
      ) as DecryptedSession;
      return { ok: true, session };
    } catch {
      return {
        ok: false,
        code: "DECRYPT_FAILED",
        message: "Failed to decrypt stored session payload.",
      };
    }
  }

  async verifyF95Session(): Promise<VerifySessionResult> {
    const existing = this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, "f95zone"))
      .get();

    const loaded = this.loadDecryptedF95Session();
    if (!loaded.ok) {
      return {
        ok: false,
        statusCode: loaded.code === "NO_SESSION" ? 400 : 500,
        code: loaded.code,
        message: loaded.message,
      };
    }

    const verifyRes = await this.verifySessionFn(loaded.session);
    const now = this.now();
    this.db
      .update(schema.accounts)
      .set({
        status: verifyRes.status,
        lastVerifiedAtMs:
          verifyRes.status === "active"
            ? now
            : (existing?.lastVerifiedAtMs ?? null),
        updatedAtMs: now,
      })
      .where(eq(schema.accounts.id, "f95zone"))
      .run();

    const dto = this.requireF95AccountDto();
    this.broadcaster.broadcast({ type: "account_updated", account: dto });

    return {
      ok: true,
      account: dto,
      ...(verifyRes.status !== "active" ? { error: verifyRes.error } : {}),
    };
  }

  clearF95Session(): AccountStatus {
    const now = this.now();
    this.db
      .update(schema.accounts)
      .set({
        userAgent: null,
        encryptedPayload: "",
        cookieCount: 0,
        hasXfUser: false,
        hasCfClearance: false,
        status: "unconfigured",
        lastVerifiedAtMs: null,
        updatedAtMs: now,
      })
      .where(eq(schema.accounts.id, "f95zone"))
      .run();

    const dto = this.requireF95AccountDto();
    this.broadcaster.broadcast({ type: "account_updated", account: dto });
    return dto;
  }

  private requireF95AccountDto(): AccountStatus {
    const row = this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, "f95zone"))
      .get();
    if (!row) {
      throw new Error("F95zone account row is missing from database.");
    }
    return serializeAccountStatus(row);
  }
}
