import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import {
  encryptBotToken,
  decryptBotToken,
  maskBotToken,
  isValidBotTokenFormat,
} from "@/lib/telegram/encryption";
import {
  getMe,
  getWebhookInfo,
  deleteWebhook,
  resolveWebhookBaseUrl,
  ensureWebhookRegistered,
} from "@/lib/telegram/bot-api";
import crypto from "crypto";

export const dynamic = "force-dynamic";

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
      webhookBaseUrlConfigured: Boolean(resolveWebhookBaseUrl()),
      webhookBaseUrl: resolveWebhookBaseUrl(),
    });
  }

  let maskedToken = "••••••••";
  let webhookInfo: any = null;

  if (integration.encryptedBotToken) {
    try {
      const raw = decryptBotToken(
        integration.encryptedBotToken,
        integration.botTokenIv,
        integration.botTokenTag
      );
      maskedToken = maskBotToken(raw);

      const liveInfo = await getWebhookInfo(raw);
      webhookInfo = {
        registered: Boolean(liveInfo.url && liveInfo.url.length > 0),
        url: liveInfo.url || null,
        hasCustomCertificate: liveInfo.has_custom_certificate,
        pendingUpdateCount: liveInfo.pending_update_count,
        lastErrorDate: liveInfo.last_error_date
          ? new Date(liveInfo.last_error_date * 1000).toISOString()
          : null,
        lastErrorMessage: liveInfo.last_error_message || null,
        maxConnections: liveInfo.max_connections,
        allowedUpdates: liveInfo.allowed_updates || [],
      };
    } catch (err: any) {
      webhookInfo = {
        registered: false,
        error: err.message,
      };
    }
  }

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
    webhookInfo,
    webhookBaseUrlConfigured: Boolean(resolveWebhookBaseUrl()),
    webhookBaseUrl: resolveWebhookBaseUrl(),
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

  // On-demand webhook sync/repair action
  if (body.action === "sync_webhook") {
    const integration = await db.telegramIntegration.findUnique({
      where: { userId: user.id },
    });
    if (!integration) return bad("Integration not configured.");

    let rawToken: string;
    try {
      rawToken = decryptBotToken(
        integration.encryptedBotToken,
        integration.botTokenIv,
        integration.botTokenTag
      );
    } catch (e: any) {
      return bad(`Decryption failure: ${e.message}`);
    }

    const secret = integration.webhookSecret || crypto.randomBytes(32).toString("hex");
    if (!integration.webhookSecret) {
      await db.telegramIntegration.update({
        where: { id: integration.id },
        data: { webhookSecret: secret },
      });
    }

    const regResult = await ensureWebhookRegistered(rawToken, secret);
    const liveInfo = await getWebhookInfo(rawToken).catch(() => null);

    if (!regResult.success) {
      await db.telegramIntegration.update({
        where: { id: integration.id },
        data: { lastError: regResult.error },
      });
      return bad(regResult.error || "Failed to register webhook with Telegram.");
    }

    await db.telegramIntegration.update({
      where: { id: integration.id },
      data: { lastError: null },
    });

    return ok({
      success: true,
      webhookUrl: regResult.webhookUrl,
      webhookInfo: liveInfo,
    });
  }

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

  // Preserve existing webhook secret or create new hex secret
  const existing = await db.telegramIntegration.findUnique({
    where: { userId: user.id },
  });
  const effectiveSecret = existing?.webhookSecret || crypto.randomBytes(32).toString("hex");

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
      webhookSecret: effectiveSecret,
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
      webhookSecret: effectiveSecret,
      ...(channelId !== undefined ? { channelId: channelId ? String(channelId).trim() : null } : {}),
      status: "configured",
      lastError: null,
    },
  });

  // Automatically attempt webhook registration if public app URL is available
  const webhookReg = await ensureWebhookRegistered(cleanToken, effectiveSecret);
  if (!webhookReg.success && !webhookReg.skipped) {
    await db.telegramIntegration.update({
      where: { id: integration.id },
      data: { lastError: `Webhook warning: ${webhookReg.error}` },
    });
  }

  return ok({
    success: true,
    botId: botUser.id,
    botUsername: botUser.username,
    botFirstName: botUser.first_name,
    maskedToken: maskBotToken(cleanToken),
    channelId: integration.channelId,
    status: integration.status,
    webhookRegistered: webhookReg.success,
    webhookUrl: webhookReg.webhookUrl,
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


