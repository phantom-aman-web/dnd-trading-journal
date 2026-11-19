import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError } from "@/lib/api";
import { decryptBotToken } from "@/lib/telegram/encryption";
import { ensureWebhookRegistered } from "@/lib/telegram/bot-api";
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
    select: {
      isPrivateLinked: true,
      privateChatId: true,
      privateChatUsername: true,
      privateFirstName: true,
      privateLinkedAt: true,
      linkingTokenExpiresAt: true,
    },
  });

  if (!integration) {
    return bad("Telegram integration not configured.");
  }

  const isExpired = Boolean(
    integration.linkingTokenExpiresAt &&
      new Date() > integration.linkingTokenExpiresAt &&
      !integration.isPrivateLinked
  );

  return NextResponse.json(
    {
      isPrivateLinked: integration.isPrivateLinked,
      privateChatUsername: integration.privateChatUsername,
      privateFirstName: integration.privateFirstName,
      privateLinkedAt: integration.privateLinkedAt,
      expired: isExpired,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

export async function POST(_req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const integration = await db.telegramIntegration.findUnique({
    where: { userId: user.id },
  });

  if (!integration || !integration.botUsername) {
    return bad("Telegram bot not connected. Connect your bot first.");
  }

  // Ensure webhook registration is active or attempted with production URL
  let webhookStatus = { registered: false, error: null as string | null };
  if (integration.encryptedBotToken) {
    try {
      const rawToken = decryptBotToken(
        integration.encryptedBotToken,
        integration.botTokenIv,
        integration.botTokenTag
      );
      const secret = integration.webhookSecret || crypto.randomBytes(32).toString("hex");
      if (!integration.webhookSecret) {
        await db.telegramIntegration.update({
          where: { id: integration.id },
          data: { webhookSecret: secret },
        });
      }
      const reg = await ensureWebhookRegistered(rawToken, secret);
      webhookStatus = {
        registered: reg.success,
        error: reg.error || null,
      };
    } catch (decErr: any) {
      webhookStatus = { registered: false, error: decErr.message };
    }
  }

  // Generate cryptographically random 32-character single-use linking token (16 bytes = 32 hex chars, well below Telegram 64 char limit)
  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

  await db.telegramIntegration.update({
    where: { userId: user.id },
    data: {
      linkingToken: token,
      linkingTokenExpiresAt: expiresAt,
    },
  });

  const deepLink = `https://t.me/${integration.botUsername}?start=${token}`;

  return ok({
    token,
    deepLink,
    botUsername: integration.botUsername,
    expiresAt,
    webhookRegistered: webhookStatus.registered,
    webhookError: webhookStatus.error,
  });
}
