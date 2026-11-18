import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { decryptBotToken } from "@/lib/telegram/encryption";
import {
  verifyChannelAdminPermissions,
  sendMessage,
} from "@/lib/telegram/bot-api";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const body = await parseJson(req);
  const channelId = body?.channelId ? String(body.channelId).trim() : null;
  const sendTestMessage = Boolean(body?.sendTestMessage);

  const integration = await db.telegramIntegration.findUnique({
    where: { userId: user.id },
  });

  if (!integration) {
    return bad("Telegram integration not configured. Connect your bot first.");
  }

  const effectiveChannelId = channelId || integration.channelId;
  if (!effectiveChannelId) {
    return bad("Channel identifier is required (e.g. @mychannel or -1001234567890).");
  }

  let botToken: string;
  try {
    botToken = decryptBotToken(
      integration.encryptedBotToken,
      integration.botTokenIv,
      integration.botTokenTag
    );
  } catch (err: any) {
    return bad(`Decryption failure: ${err.message}`);
  }

  const verification = await verifyChannelAdminPermissions(botToken, effectiveChannelId);

  if (!verification.verified) {
    await db.telegramIntegration.update({
      where: { userId: user.id },
      data: {
        channelId: effectiveChannelId,
        channelVerified: false,
        lastError: verification.error || "Channel verification failed.",
      },
    });

    return bad(
      verification.error ||
        "Could not verify channel. Ensure the bot is an administrator with permission to post messages."
    );
  }

  const channelTitle = verification.channel?.title || null;
  const channelUsername = verification.channel?.username || null;

  let testMessageSent = false;
  if (sendTestMessage) {
    try {
      const testText =
        "🔔 <b>AlphaPips Telegram Integration</b>\n\n✅ <b>Channel Connection Verified!</b>\nYour AlphaPips trading journal is now successfully connected to this channel.";
      await sendMessage(botToken, effectiveChannelId, testText);
      testMessageSent = true;
    } catch (msgErr: any) {
      console.warn("Could not send test message:", msgErr);
    }
  }

  await db.telegramIntegration.update({
    where: { userId: user.id },
    data: {
      channelId: effectiveChannelId,
      channelTitle,
      channelUsername,
      channelVerified: true,
      channelVerifiedAt: new Date(),
      status: "active",
      lastError: null,
    },
  });

  return ok({
    verified: true,
    channelId: effectiveChannelId,
    channelTitle,
    channelUsername,
    testMessageSent,
  });
}
