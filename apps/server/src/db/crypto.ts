import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SecretCipher } from "../contracts/ports.js";

const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Load a 32-byte AES-256-GCM key from `APP_MASTER_KEY` or a local keyfile,
 * creating one atomically if absent. Never store this key inside SQLite.
 */
export function loadOrCreateMasterKey(keyPath: string): Buffer {
  const envKey = process.env.APP_MASTER_KEY?.trim();
  if (envKey) {
    const raw = /^[0-9a-fA-F]{64}$/.test(envKey)
      ? Buffer.from(envKey, "hex")
      : Buffer.from(envKey, "base64");
    if (raw.length !== KEY_BYTES) {
      throw new Error("APP_MASTER_KEY must decode to exactly 32 bytes.");
    }
    return raw;
  }

  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  if (fs.existsSync(keyPath)) {
    const hex = fs.readFileSync(keyPath, "utf8").trim();
    const key = Buffer.from(hex, "hex");
    if (key.length === KEY_BYTES) {
      return key;
    }
    throw new Error(`Invalid master key length in ${keyPath}`);
  }

  const key = crypto.randomBytes(KEY_BYTES);
  fs.writeFileSync(keyPath, key.toString("hex"), {
    encoding: "utf8",
    mode: 0o600,
  });
  return key;
}

/**
 * Encrypt UTF-8 plaintext with AES-256-GCM and a fresh 12-byte random IV.
 */
export function encryptSecret(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new Error("AES-256-GCM key must be 32 bytes.");
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

/**
 * Decrypt a versioned AES-256-GCM envelope and verify its auth tag.
 */
export function decryptSecret(envelope: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new Error("AES-256-GCM key must be 32 bytes.");
  }
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
    throw new Error("Unsupported encrypted payload envelope.");
  }
  const iv = Buffer.from(parts[1]!, "base64url");
  const authTag = Buffer.from(parts[2]!, "base64url");
  const ciphertext = Buffer.from(parts[3]!, "base64url");

  if (iv.length !== IV_BYTES || authTag.length !== 16) {
    throw new Error("Malformed encrypted payload metadata.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Constant-time token comparison using SHA-256 digests so buffer lengths match.
 */
export function timingSafeTokenEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = crypto.createHash("sha256").update(provided, "utf8").digest();
  const b = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Create an AES-256-GCM SecretCipher bound to a validated 32-byte master key.
 */
export function createAesGcmCipher(masterKey: Buffer): SecretCipher {
  if (masterKey.length !== KEY_BYTES) {
    throw new Error("AES-256-GCM key must be 32 bytes.");
  }
  const keyCopy = Buffer.from(masterKey);
  return {
    encrypt(plaintext: string): string {
      return encryptSecret(plaintext, keyCopy);
    },
    decrypt(envelope: string): string {
      return decryptSecret(envelope, keyCopy);
    },
  };
}
