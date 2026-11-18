import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { triggerWorkerProcessing } from "@/lib/telegram/delivery-engine";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const jobType = searchParams.get("jobType");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const where: any = { userId: user.id };
  if (status && status !== "all") {
    where.status = status;
  }
  if (jobType && jobType !== "all") {
    where.jobType = jobType;
  }

  const deliveries = await db.telegramDelivery.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      trade: {
        select: {
          id: true,
          instrumentSymbol: true,
          direction: true,
          status: true,
          netPnlCents: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          priority: true,
          status: true,
          dueDate: true,
          dueTime: true,
        },
      },
    },
  });

  // Calculate aggregates
  const totalCount = await db.telegramDelivery.count({ where: { userId: user.id } });
  const deliveredCount = await db.telegramDelivery.count({
    where: { userId: user.id, status: "delivered" },
  });
  const failedCount = await db.telegramDelivery.count({
    where: { userId: user.id, status: "failed" },
  });
  const pendingCount = await db.telegramDelivery.count({
    where: { userId: user.id, status: "pending" },
  });

  return ok({
    items: deliveries,
    aggregates: {
      total: totalCount,
      delivered: deliveredCount,
      failed: failedCount,
      pending: pendingCount,
    },
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
  const deliveryId = body?.deliveryId;

  if (!deliveryId) {
    return bad("deliveryId is required for retry.");
  }

  const delivery = await db.telegramDelivery.findFirst({
    where: { id: deliveryId, userId: user.id },
  });

  if (!delivery) {
    return notFound("Delivery record not found or not owned by user.");
  }

  // Reset delivery job to pending with immediate execution
  const updated = await db.telegramDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "pending",
      scheduledFor: new Date(),
      leaseExpiresAt: null,
      lastError: null,
    },
  });

  triggerWorkerProcessing().catch(() => {});

  return ok({
    success: true,
    message: "Delivery job queued for retry.",
    delivery: updated,
  });
}
