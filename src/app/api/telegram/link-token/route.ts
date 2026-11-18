import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError } from "@/lib/api";
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

  return ok({
    isPrivateLinked: integration.isPrivateLinked,
    privateChatUsername: integration.privateChatUsername,
    privateFirstName: integration.privateFirstName,
    privateLinkedAt: integration.privateLinkedAt,
  });
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

  // Generate cryptographically random 32-character single-use linking token
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
  });
}
