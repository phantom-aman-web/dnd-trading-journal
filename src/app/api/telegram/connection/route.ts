import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import {
  encryptBotToken,
  decryptBotToken,
  maskBotToken,
  isValidBotTokenFormat,
} from "@/lib/telegram/encryption";
import { getMe, setWebhook, deleteWebhook } from "@/lib/telegram/bot-api";
import crypto from "crypto";

export async function GET(_req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const integration = await db.telegramIntegration.findUnique({
    where: { userId: user.id },
    include: { publishingSettings: true },
  });

  if (!integration) {
    return ok({
      configured: false,
      status: "disconnected",
      botConnected: false,
      channelVerified: false,
      isPrivateLinked: false,
      canPublishTrades: false,
      canSendReminders: false,
    });
  }

  let maskedToken = "••••••••";
  try {
    const raw = decryptBotToken(
      integration.encryptedBotToken,
      integration.botTokenIv,
      integration.botTokenTag
    );
    maskedToken = maskBotToken(raw);
  } catch {}

  const canPublishTrades =
    integration.status === "active" ||
    (Boolean(integration.botId) &&
      Boolean(integration.channelId) &&
      integration.channelVerified &&
      integration.publishingSettings?.enabled === true);

  const canSendReminders =
    Boolean(integration.botId) &&
    Boolean(integration.privateChatId) &&
    integration.isPrivateLinked;

  return ok({
    configured: true,
    id: integration.id,
    status: integration.status,
    botConnected: Boolean(integration.botId),
    botId: integration.botId,
    botUsername: integration.botUsername,
    botFirstName: integration.botFirstName,
    channelId: integration.channelId,
    channelTitle: integration.channelTitle,
    channelUsername: integration.channelUsername,
    channelVerified: integration.channelVerified,
    channelVerifiedAt: integration.channelVerifiedAt,
    isPrivateLinked: integration.isPrivateLinked,
    privateChatUsername: integration.privateChatUsername,
    privateFirstName: integration.privateFirstName,
    privateLinkedAt: integration.privateLinkedAt,
    canPublishTrades,
    canSendReminders,
    maskedToken,
    lastError: integration.lastError,
    updatedAt: integration.updatedAt,
  });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON payload");

  const { botToken, channelId } = body;

  if (!botToken || typeof botToken !== "string") {
    return bad("Bot API token is required.");
  }

  const cleanToken = botToken.trim();
  if (!isValidBotTokenFormat(cleanToken)) {
    return bad(
      "Invalid bot token format. Telegram tokens look like: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    );
  }

  // Verify token with Telegram Bot API getMe
  let botUser;
  try {
    botUser = await getMe(cleanToken);
  } catch (err: any) {
    return bad(`Failed to connect to Telegram: ${err.message || "Invalid bot token"}`);
  }

  if (!botUser.is_bot) {
    return bad("The provided token does not belong to a Telegram bot.");
  }

  // Encrypt token
  let encrypted;
  try {
    encrypted = encryptBotToken(cleanToken);
  } catch (encErr: any) {
    return bad(`Server encryption error: ${encErr.message}`);
  }

  // Generate or keep webhook secret
  const webhookSecret = crypto.randomBytes(32).toString("hex");

  // Upsert integration
  const integration = await db.telegramIntegration.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      encryptedBotToken: encrypted.encryptedBotToken,
      botTokenIv: encrypted.botTokenIv,
      botTokenTag: encrypted.botTokenTag,
      botId: String(botUser.id),
      botUsername: botUser.username,
      botFirstName: botUser.first_name,
      channelId: channelId ? String(channelId).trim() : null,
      channelVerified: false,
      webhookSecret,
      status: "configured",
      publishingSettings: {
        create: {
          enabled: false,
          templateType: "standard",
          includeScreenshots: true,
          includeTags: true,
          includeDescription: true,
          includeRisk: true,
          includePerformance: true,
          autoPublishNewTrades: true,
          publishTradeClosure: true,
        },
      },
    },
    update: {
      encryptedBotToken: encrypted.encryptedBotToken,
      botTokenIv: encrypted.botTokenIv,
      botTokenTag: encrypted.botTokenTag,
      botId: String(botUser.id),
      botUsername: botUser.username,
      botFirstName: botUser.first_name,
      ...(channelId !== undefined ? { channelId: channelId ? String(channelId).trim() : null } : {}),
      status: "configured",
      lastError: null,
    },
  });

  // Attempt automatic webhook registration if public app URL is available
  const appBaseUrl =
    process.env.TELEGRAM_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null;

  if (appBaseUrl && appBaseUrl.startsWith("https://")) {
    const webhookUrl = `${appBaseUrl}/api/telegram/webhook`;
    setWebhook(cleanToken, webhookUrl, webhookSecret).catch(() => {});
  }

  return ok({
    success: true,
    botId: botUser.id,
    botUsername: botUser.username,
    botFirstName: botUser.first_name,
    maskedToken: maskBotToken(cleanToken),
    channelId: integration.channelId,
    status: integration.status,
  });
}

export async function DELETE(_req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const integration = await db.telegramIntegration.findUnique({
    where: { userId: user.id },
  });

  if (integration) {
    try {
      const rawToken = decryptBotToken(
        integration.encryptedBotToken,
        integration.botTokenIv,
        integration.botTokenTag
      );
      await deleteWebhook(rawToken).catch(() => {});
    } catch {}

    await db.telegramIntegration.delete({
      where: { userId: user.id },
    });
  }

  return ok({ disconnected: true });
}
