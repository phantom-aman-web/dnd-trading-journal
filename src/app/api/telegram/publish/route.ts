import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { queueTradePublication } from "@/lib/telegram/delivery-engine";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const body = await parseJson(req);
  const tradeId = body?.tradeId;
  const requestId = body?.requestId || req.headers.get("x-request-id") || undefined;

  if (!tradeId) {
    return bad("tradeId is required.");
  }

  // Validate trade ownership
  const trade = await db.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) {
    return notFound("Trade not found or not owned by user.");
  }

  if (trade.isDraft) {
    return bad("Draft trades cannot be published to Telegram until finalized.");
  }

  // Verify integration
  const integration = await db.telegramIntegration.findUnique({
    where: { userId: user.id },
    include: { publishingSettings: true },
  });

  if (!integration || !integration.channelId || !integration.channelVerified) {
    return bad("Telegram trade channel is not configured and verified.");
  }

  // Temporarily ensure publishing settings exist if not created yet
  if (!integration.publishingSettings) {
    await db.telegramPublishingSettings.create({
      data: {
        integrationId: integration.id,
        enabled: true,
      },
    });
  }

  const deliveryId = await queueTradePublication({
    tradeId: trade.id,
    userId: user.id,
    isManual: true,
    requestId,
  });

  return ok({
    success: true,
    message: "Trade publication queued successfully.",
    deliveryId,
  });
}
