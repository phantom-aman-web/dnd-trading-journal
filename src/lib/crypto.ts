/**
 * DnD — Client-side encryption for Local Privacy Mode (spec section 94).
 * Uses Web Crypto API with AES-GCM and PBKDF2 key derivation.
 *
 * IMPORTANT HONESTY (spec section 95):
 * - Only the configured sensitive fields are encrypted client-side before persistence.
 * - Metadata (instrument, direction, P&L, R, etc.) remains available server-side for analytics.
 * - If the user loses their passphrase, encrypted data cannot be recovered.
 * - We do not claim "even DnD cannot access your data" — we only claim that the configured
 *   sensitive fields are encrypted client-side before they leave the device.
 */

const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export interface EncryptedPayload {
  v: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptField(passphrase: string, plaintext: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  return {
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(new Uint8Array(ct)),
  };
}

export async function decryptField(passphrase: string, payload: EncryptedPayload): Promise<string> {
  if (payload.v !== 1) throw new Error("Unsupported payload version");
  const salt = fromB64(payload.salt);
  const iv = fromB64(payload.iv);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    fromB64(payload.ciphertext),
  );
  return dec.decode(pt);
}

/** Sensitive field configuration. Only these are encrypted when privacy mode is on. */
export const SENSITIVE_FIELDS = [
  "notes",
  "lessons",
  "thesis.why",
  "thesis.narrative",
  "psychBefore",
  "psychAfter",
] as const;

/** Check if Web Crypto is available (requires HTTPS or localhost). */
export function isPrivacyModeSupported(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}
