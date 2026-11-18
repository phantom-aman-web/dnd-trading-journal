import { describe, it, expect } from "bun:test";
import crypto from "crypto";
import {
  encryptBotToken,
  decryptBotToken,
  maskBotToken,
  isValidBotTokenFormat,
} from "./encryption";

describe("Telegram Token Security & Encryption", () => {
  const sampleToken = "1234567890:ABCdefGHIJklmNOPQRstuvwXYZ123456789";

  it("successfully encrypts and decrypts a bot token with AES-256-GCM using dedicated key", () => {
    const encrypted = encryptBotToken(sampleToken);
    expect(encrypted.encryptedBotToken).toBeDefined();
    expect(encrypted.botTokenIv).toBeDefined();
    expect(encrypted.botTokenTag).toBeDefined();

    // Verify ciphertext does not equal plaintext
    expect(encrypted.encryptedBotToken).not.toBe(sampleToken);

    // Decrypt
    const decrypted = decryptBotToken(
      encrypted.encryptedBotToken,
      encrypted.botTokenIv,
      encrypted.botTokenTag
    );
    expect(decrypted).toBe(sampleToken);
  });

  it("fails encryption closed when TELEGRAM_TOKEN_ENCRYPTION_KEY is missing or invalid", () => {
    const originalKey = process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY;
    const originalSession = process.env.SESSION_SECRET;

    try {
      // Set session secret but delete dedicated key
      process.env.SESSION_SECRET = "legacy-session-secret-for-testing-1234";
      delete process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY;

      // Must throw and NOT silently fall back to SESSION_SECRET
      expect(() => encryptBotToken(sampleToken)).toThrow(
        "Dedicated TELEGRAM_TOKEN_ENCRYPTION_KEY is required for encryption. Fail closed."
      );

      // Too short dedicated key
      process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY = "short";
      expect(() => encryptBotToken(sampleToken)).toThrow("too short");
    } finally {
      process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY = originalKey;
      process.env.SESSION_SECRET = originalSession;
    }
  });

  it("preserves backward-compatible legacy decryption with SESSION_SECRET for existing tokens", () => {
    const originalKey = process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY;
    const originalSession = process.env.SESSION_SECRET;

    try {
      const legacySecret = "legacy-session-secret-for-testing-only-32chars";
      const legacyKey = crypto.scryptSync(legacySecret, "alphapips-telegram-key-salt", 32);

      // Create an encrypted token using the legacy key manually
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", legacyKey, iv);
      const encrypted = Buffer.concat([cipher.update(sampleToken, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();

      // Set environment: dedicated key is different, session secret is legacySecret
      process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY = "dedicated-new-encryption-key-32chars-xyz";
      process.env.SESSION_SECRET = legacySecret;

      // Primary decrypt with dedicated key will fail tag verification, then fallback to legacyKey succeeds
      const decrypted = decryptBotToken(
        encrypted.toString("hex"),
        iv.toString("hex"),
        tag.toString("hex")
      );

      expect(decrypted).toBe(sampleToken);
    } finally {
      process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY = originalKey;
      process.env.SESSION_SECRET = originalSession;
    }
  });

  it("fails decryption when ciphertext is tampered with", () => {
    const encrypted = encryptBotToken(sampleToken);
    // Tamper with one hex character
    const tampered =
      encrypted.encryptedBotToken.slice(0, -2) +
      (encrypted.encryptedBotToken.slice(-2) === "aa" ? "bb" : "aa");

    expect(() => {
      decryptBotToken(tampered, encrypted.botTokenIv, encrypted.botTokenTag);
    }).toThrow("cryptographic verification failed");
  });

  it("fails decryption when auth tag is tampered with", () => {
    const encrypted = encryptBotToken(sampleToken);
    const tamperedTag = "00".repeat(16);

    expect(() => {
      decryptBotToken(encrypted.encryptedBotToken, encrypted.botTokenIv, tamperedTag);
    }).toThrow("cryptographic verification failed");
  });

  it("correctly masks the token for display", () => {
    const masked = maskBotToken(sampleToken);
    expect(masked).toBe("1234••••••••••••••••6789");
    expect(masked).not.toContain("ABCdef");
  });

  it("validates bot token format", () => {
    expect(isValidBotTokenFormat(sampleToken)).toBe(true);
    expect(isValidBotTokenFormat("invalid_token")).toBe(false);
    expect(isValidBotTokenFormat("12345:short")).toBe(false);
    expect(isValidBotTokenFormat("")).toBe(false);
  });
});
