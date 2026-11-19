import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { resolveWebhookBaseUrl, ensureWebhookRegistered } from "./bot-api";
import { POST, GET } from "@/app/api/telegram/webhook/route";
import { GET as getLinkToken, POST as postLinkToken } from "@/app/api/telegram/link-token/route";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import crypto from "crypto";

describe("Telegram Inbound Webhook & Private Chat Linking Tests", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe("Webhook URL Resolution & Priority", () => {
    it("prioritizes TELEGRAM_WEBHOOK_BASE_URL over other variables", () => {
      process.env.TELEGRAM_WEBHOOK_BASE_URL = "https://custom.alphapips.com/";
      process.env.NEXT_PUBLIC_APP_URL = "https://public.alphapips.com";
      process.env.VERCEL_URL = "alphapips-git-preview.vercel.app";

      const url = resolveWebhookBaseUrl();
      expect(url).toBe("https://custom.alphapips.com");
    });

    it("falls back to NEXT_PUBLIC_APP_URL if TELEGRAM_WEBHOOK_BASE_URL is unset", () => {
      delete process.env.TELEGRAM_WEBHOOK_BASE_URL;
      process.env.NEXT_PUBLIC_APP_URL = "https://app.alphapips.com";
      process.env.VERCEL_URL = "alphapips-git-preview.vercel.app";

      const url = resolveWebhookBaseUrl();
      expect(url).toBe("https://app.alphapips.com");
    });

    it("falls back to VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL if app URLs unset", () => {
      delete process.env.TELEGRAM_WEBHOOK_BASE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "alphapips-main.vercel.app";

      const url = resolveWebhookBaseUrl();
      expect(url).toBe("https://alphapips-main.vercel.app");
    });

    it("returns null if no public HTTPS domain is available", () => {
      delete process.env.TELEGRAM_WEBHOOK_BASE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.VERCEL_URL;

      const url = resolveWebhookBaseUrl();
      expect(url).toBeNull();
    });

    it("safely skips registration when no HTTPS base URL is configured", async () => {
      delete process.env.TELEGRAM_WEBHOOK_BASE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.VERCEL_URL;

      const res = await ensureWebhookRegistered("dummy_token", "dummy_secret");
      expect(res.success).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.error).toContain("No public HTTPS base URL configured");
    });
  });

  describe("Webhook Request Authentication & Parsing", () => {
    const testUserId = `test_wh_user_${Date.now()}`;
    const testBotToken = "9999999999:AAH_test_webhook_fake_token_123456";
    const testSecret = "test_webhook_secret_64chars_abcdef1234567890abcdef1234567890abcdef";
    let integrationId: string;

    beforeEach(async () => {
      // Create user and integration in test database
      await db.user.create({
        data: {
          id: testUserId,
          email: `${testUserId}@example.com`,
          name: "Webhook Test User",
          passwordHash: "dummyhash",
        },
      });

      const int = await db.telegramIntegration.create({
        data: {
          userId: testUserId,
          botId: "9999999999",
          botUsername: "TestAlphaPipsBot",
          encryptedBotToken: "dummy_enc",
          botTokenIv: "dummy_iv",
          botTokenTag: "dummy_tag",
          webhookSecret: testSecret,
          status: "configured",
        },
      });
      integrationId = int.id;
    });

    afterEach(async () => {
      await db.telegramIntegration.deleteMany({ where: { userId: testUserId } });
      await db.user.deleteMany({ where: { id: testUserId } });
    });

    it("responds with status: webhook_endpoint_ready on GET", async () => {
      const req = new NextRequest("https://alphapips.com/api/telegram/webhook", { method: "GET" });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.status).toBe("webhook_endpoint_ready");
    });

    it("rejects invalid webhook secret with HTTP 401", async () => {
      const token = "linking_token_auth_test_1";
      await db.telegramIntegration.update({
        where: { id: integrationId },
        data: {
          linkingToken: token,
          linkingTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const req = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": "wrong_secret_token",
        },
        body: JSON.stringify({
          update_id: Date.now(),
          message: {
            message_id: 1,
            chat: { id: 12345678, type: "private" },
            text: `/start ${token}`,
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized webhook secret");
    });

    it("links private chat correctly for /start <token> with valid secret", async () => {
      const token = "linking_token_success_1";
      await db.telegramIntegration.update({
        where: { id: integrationId },
        data: {
          linkingToken: token,
          linkingTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          isPrivateLinked: false,
        },
      });

      const uniqueUpdateId = `upd_${Date.now()}_${Math.random()}`;
      const req = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": testSecret,
        },
        body: JSON.stringify({
          update_id: uniqueUpdateId,
          message: {
            message_id: 101,
            chat: { id: 777888999, type: "private", username: "trader_alice", first_name: "Alice" },
            from: { id: 777888999, username: "trader_alice", first_name: "Alice" },
            text: `/start ${token}`,
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const updated = await db.telegramIntegration.findUnique({
        where: { id: integrationId },
      });

      expect(updated?.isPrivateLinked).toBe(true);
      expect(updated?.privateChatId).toBe("777888999");
      expect(updated?.privateChatUsername).toBe("trader_alice");
      expect(updated?.privateFirstName).toBe("Alice");
      // Single-use token must be atomically consumed
      expect(updated?.linkingToken).toBeNull();
      expect(updated?.linkingTokenExpiresAt).toBeNull();
    });

    it("supports /start@BotUsername <token> and irregular whitespace", async () => {
      const token = "linking_token_botname_2";
      await db.telegramIntegration.update({
        where: { id: integrationId },
        data: {
          linkingToken: token,
          linkingTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          isPrivateLinked: false,
        },
      });

      const uniqueUpdateId = `upd_${Date.now()}_${Math.random()}`;
      const req = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": testSecret,
        },
        body: JSON.stringify({
          update_id: uniqueUpdateId,
          message: {
            message_id: 102,
            chat: { id: 111222333, type: "private", username: "trader_bob" },
            from: { id: 111222333, username: "trader_bob" },
            text: `/start@TestAlphaPipsBot    ${token}`,
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const updated = await db.telegramIntegration.findUnique({
        where: { id: integrationId },
      });

      expect(updated?.isPrivateLinked).toBe(true);
      expect(updated?.privateChatId).toBe("111222333");
      expect(updated?.linkingToken).toBeNull();
    });

    it("strictly rejects non-private chats (group / supergroup) for private linking", async () => {
      const token = "linking_token_group_reject";
      await db.telegramIntegration.update({
        where: { id: integrationId },
        data: {
          linkingToken: token,
          linkingTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          isPrivateLinked: false,
        },
      });

      const uniqueUpdateId = `upd_${Date.now()}_${Math.random()}`;
      const req = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": testSecret,
        },
        body: JSON.stringify({
          update_id: uniqueUpdateId,
          message: {
            message_id: 103,
            chat: { id: -100999888777, type: "supergroup", title: "Public Trading Group" },
            text: `/start ${token}`,
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ignored).toBe("non_private_chat");

      const untouched = await db.telegramIntegration.findUnique({
        where: { id: integrationId },
      });
      expect(untouched?.isPrivateLinked).toBe(false);
      expect(untouched?.privateChatId).toBeNull();
      expect(untouched?.linkingToken).toBe(token); // Not consumed
    });

    it("rejects expired linking tokens safely without linking", async () => {
      const token = "linking_token_expired";
      const expiredDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
      await db.telegramIntegration.update({
        where: { id: integrationId },
        data: {
          linkingToken: token,
          linkingTokenExpiresAt: expiredDate,
          isPrivateLinked: false,
        },
      });

      const uniqueUpdateId = `upd_${Date.now()}_${Math.random()}`;
      const req = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": testSecret,
        },
        body: JSON.stringify({
          update_id: uniqueUpdateId,
          message: {
            message_id: 104,
            chat: { id: 555666777, type: "private" },
            text: `/start ${token}`,
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.reason).toBe("token_expired");

      const untouched = await db.telegramIntegration.findUnique({
        where: { id: integrationId },
      });
      expect(untouched?.isPrivateLinked).toBe(false);
    });

    it("ignores already-consumed or reused linking tokens safely", async () => {
      const uniqueUpdateId = `upd_${Date.now()}_${Math.random()}`;
      const req = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": testSecret,
        },
        body: JSON.stringify({
          update_id: uniqueUpdateId,
          message: {
            message_id: 105,
            chat: { id: 555666777, type: "private" },
            text: `/start already_used_or_nonexistent_token`,
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.reason).toBe("invalid_or_consumed_token");
    });

    it("handles /start without token without linking and without crashing", async () => {
      const uniqueUpdateId = `upd_${Date.now()}_${Math.random()}`;
      const req = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": testSecret,
        },
        body: JSON.stringify({
          update_id: uniqueUpdateId,
          message: {
            message_id: 106,
            chat: { id: 555666777, type: "private" },
            text: `/start`,
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const untouched = await db.telegramIntegration.findUnique({
        where: { id: integrationId },
      });
      expect(untouched?.isPrivateLinked).toBe(false);
    });

    it("deduplicates identical update_id safely", async () => {
      const updateId = `upd_dedup_${Date.now()}`;
      const payload = {
        update_id: updateId,
        message: {
          message_id: 107,
          chat: { id: 123456, type: "private" },
          text: `/start`,
        },
      };

      const req1 = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second identical update
      const req2 = new NextRequest("https://alphapips.com/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.duplicate).toBe(true);
    });
  });
});
