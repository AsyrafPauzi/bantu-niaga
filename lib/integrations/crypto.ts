import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * AES-256-GCM encryption for integration credentials.
 *
 * - Master key comes from `INTEGRATION_ENCRYPTION_KEY` env var.
 * - When the env var is a 32-byte hex string (recommended), it's used
 *   verbatim.
 * - When it's a passphrase, we derive a key with scrypt + a fixed salt.
 *   Stable derivation is critical so an existing row can still be decrypted
 *   after a restart.
 *
 * Each ciphertext is wrapped as `{ v: 1, alg, iv, ct, tag }`. Storing the
 * algorithm with the payload lets us rotate ciphers later without breaking
 * existing rows.
 */

const ALG = "aes-256-gcm" as const;
const KEY_BYTES = 32;
const IV_BYTES = 12; // GCM canonical IV size.
const SALT = "bn-integrations-v1"; // stable scrypt salt — DO NOT change.

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not set. Generate with `openssl rand -hex 32` and add to .env.local.",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, "hex");
  } else {
    cachedKey = scryptSync(raw, SALT, KEY_BYTES);
  }
  return cachedKey;
}

export interface SealedSecret {
  v: 1;
  alg: typeof ALG;
  /** base64 IV. */
  iv: string;
  /** base64 ciphertext. */
  ct: string;
  /** base64 auth tag. */
  tag: string;
}

export function encryptSecret(plaintext: string): SealedSecret {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: ALG,
    iv: iv.toString("base64"),
    ct: enc.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(sealed: SealedSecret): string {
  if (sealed.v !== 1 || sealed.alg !== ALG) {
    throw new Error(`Unsupported sealed-secret payload: v=${sealed.v} alg=${sealed.alg}`);
  }
  const key = getKey();
  const decipher = createDecipheriv(
    ALG,
    key,
    Buffer.from(sealed.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(sealed.ct, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/**
 * Returns true when an INTEGRATION_ENCRYPTION_KEY is configured. The UI
 * uses this to warn the admin before they try to save credentials.
 */
export function encryptionConfigured(): boolean {
  return !!process.env.INTEGRATION_ENCRYPTION_KEY;
}
