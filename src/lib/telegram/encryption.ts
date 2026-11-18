import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const SALT = "alphapips-telegram-key-salt";

/**
 * Derives a uniform 32-byte key from a secret string using scrypt.
 */
function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Retrieves and validates the dedicated primary encryption key.
 * Strictly required for all new encryptions — does NOT silently fall back to SESSION_SECRET.
 * Fails closed if missing or invalid.
 */
export function getDedicatedEncryptionKey(): Buffer {
  const secret = process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Dedicated TELEGRAM_TOKEN_ENCRYPTION_KEY is required for encryption. Fail closed."
    );
  }
  const trimmed = secret.trim();
  if (trimmed.length < 16) {
    throw new Error(
      "TELEGRAM_TOKEN_ENCRYPTION_KEY is too short. It must be at least 16 characters (recommended 32+)."
    );
  }
  return deriveKey(trimmed);
}

/**
 * Retrieves the legacy encryption key (derived from SESSION_SECRET), if present.
 * Used ONLY for backward-compatible decryption of existing database records.
 */
export function getLegacyDecryptionKey(): Buffer | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim().length === 0) {
    return null;
  }
  return deriveKey(secret.trim());
}

export interface EncryptedTokenResult {
  encryptedBotToken: string;
  botTokenIv: string;
  botTokenTag: string;
}

/**
 * Encrypts a bot API token using authenticated AES-256-GCM with the dedicated encryption key.
 * Fails closed if TELEGRAM_TOKEN_ENCRYPTION_KEY is missing or invalid.
 * Never logs the token.
 */
export function encryptBotToken(token: string): EncryptedTokenResult {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Cannot encrypt empty token.");
  }

  const cleanToken = token.trim();
  const key = getDedicatedEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(cleanToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedBotToken: encrypted.toString("hex"),
    botTokenIv: iv.toString("hex"),
    botTokenTag: tag.toString("hex"),
  };
}

/**
 * Decrypts a bot API token using authenticated AES-256-GCM.
 * Attempts primary decryption using TELEGRAM_TOKEN_ENCRYPTION_KEY.
 * If that fails or primary key is unset, attempts backward-compatible legacy decryption with SESSION_SECRET.
 * Throws if authentication tag verification fails or data is corrupt.
 */
export function decryptBotToken(
  encryptedBotToken: string,
  botTokenIv: string,
  botTokenTag: string
): string {
  if (!encryptedBotToken || !botTokenIv || !botTokenTag) {
    throw new Error("Missing encrypted token components.");
  }

  const iv = Buffer.from(botTokenIv, "hex");
  const tag = Buffer.from(botTokenTag, "hex");
  const encrypted = Buffer.from(encryptedBotToken, "hex");

  // Attempt 1: Dedicated primary key
  let primaryKey: Buffer | null = null;
  try {
    primaryKey = getDedicatedEncryptionKey();
  } catch {
    // Primary key not configured; fall through to legacy check
  }

  if (primaryKey) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, primaryKey, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      // Primary decryption failed (e.g. tag mismatch). Fall through to legacy fallback.
    }
  }

  // Attempt 2: Legacy fallback with SESSION_SECRET
  const legacyKey = getLegacyDecryptionKey();
  if (legacyKey) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      // Legacy decryption also failed
    }
  }

  throw new Error("Failed to decrypt bot token: cryptographic verification failed.");
}

/**
 * Masks a bot token for safe frontend display without exposing the secret.
 * Example: '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' -> '1234••••••••••••••••ew11'
 */
export function maskBotToken(token: string): string {
  if (!token || typeof token !== "string") return "••••••••";
  const trimmed = token.trim();
  if (trimmed.length < 10) return "••••••••";

  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}${"•".repeat(16)}${suffix}`;
}

/**
 * Validates the basic structural format of a Telegram Bot API token.
 * Typically: 1234567890:AAAAA-BBBBBBBBBBBBBBBBBBBBBBBBBB (digits followed by colon and base64-like string)
 */
export function isValidBotTokenFormat(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const trimmed = token.trim();
  return /^\d{8,11}:[A-Za-z0-9_-]{30,50}$/.test(trimmed);
}
