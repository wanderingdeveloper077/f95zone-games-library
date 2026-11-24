import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  loadOrCreateMasterKey,
  timingSafeTokenEqual,
} from "../db/crypto.js";
import { initializeDatabase, openDatabase } from "../db/index.js";
import * as schema from "../db/schema.js";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle"
);

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gl-db-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("SQLite WAL database and AES-256-GCM crypto", () => {
  it("enables WAL mode, busy_timeout = 5000, migrations, and cascade delete", () => {
    const dir = makeTempDir();
    const dbPath = path.join(dir, "library.db");
    const conn = openDatabase(dbPath);
    try {
      expect(conn.journalMode).toBe("wal");
      expect(conn.busyTimeout).toBe(5000);

      initializeDatabase(conn, migrationsDir);

      conn.db
        .insert(schema.games)
        .values({ id: 999, name: "Cascade Test", addedAtMs: Date.now() })
        .run();
      conn.db
        .insert(schema.gameMetadata)
        .values({ gameId: 999, description: "Meta", updatedAtMs: Date.now() })
        .run();

      conn.db.delete(schema.games).where(eq(schema.games.id, 999)).run();

      const remainingMeta = conn.db
        .select()
        .from(schema.gameMetadata)
        .where(eq(schema.gameMetadata.gameId, 999))
        .get();
      expect(remainingMeta).toBeUndefined();
    } finally {
      conn.sqlite.close();
    }
  });

  it("encrypts and decrypts secrets via AES-256-GCM and rejects tampering", () => {
    const dir = makeTempDir();
    const keyPath = path.join(dir, ".master.key");
    const key = loadOrCreateMasterKey(keyPath);
    expect(key.length).toBe(32);

    const payload = JSON.stringify({
      cookies: [{ name: "xf_user", value: "12345_secret" }],
      userAgent: "TestAgent/1.0",
    });
    const encrypted = encryptSecret(payload, key);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain("12345_secret");
    expect(decryptSecret(encrypted, key)).toBe(payload);

    // Tamper with ciphertext segment
    const parts = encrypted.split(":");
    const corruptedCt =
      parts[3]!.slice(0, -2) + (parts[3]!.endsWith("AA") ? "BB" : "AA");
    const tampered = [parts[0], parts[1], parts[2], corruptedCt].join(":");
    expect(() => decryptSecret(tampered, key)).toThrow();
  });

  it("compares pairing tokens in constant time", () => {
    expect(timingSafeTokenEqual("abc123", "abc123")).toBe(true);
    expect(timingSafeTokenEqual("abc123", "abc124")).toBe(false);
    expect(timingSafeTokenEqual("", "abc123")).toBe(false);
  });
});
