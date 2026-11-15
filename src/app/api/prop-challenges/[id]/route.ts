import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import {
  evaluatePropChallenge,
  parseChallengeMetadata,
  serializeChallengeMetadata,
  type TradeForChallenge,
} from "@/lib/prop-firm-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id } = await params;
  const challenge = await db.propChallenge.findUnique({
    where: { id },
    include: {
      account: true,
    },
  });

  if (!challenge || challenge.userId !== user.id) {
    return notFound("Prop challenge not found");
  }

  const trades = await db.trade.findMany({
    where: {
      userId: user.id,
      accountId: challenge.accountId,
      exitTime: { gte: challenge.startDate },
    },
    select: {
      id: true,
      netPnlCents: true,
      entryTime: true,
      exitTime: true,
      status: true,
      isDraft: true,
    },
  });

  const meta = parseChallengeMetadata(challenge.notes, challenge.account?.consistencyRate);

  const metrics = evaluatePropChallenge(
    {
      ...challenge,
      consistencyRuleType: meta.consistencyRuleType,
      consistencyThresholdPct: meta.consistencyThresholdPct,
      consistencyAction: meta.consistencyAction,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
    },
    trades as TradeForChallenge[]
  );

  return ok({
    ...challenge,
    userNotes: meta.userNotes,
    metrics,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id } = await params;
  const existing = await db.propChallenge.findUnique({
    where: { id },
    include: { account: true },
  });

  if (!existing || existing.userId !== user.id) {
    return notFound("Prop challenge not found");
  }

  const body = await parseJson<any>(req);
  if (!body) return bad("Invalid JSON payload");

  const allowedFields = [
    "name",
    "propFirm",
    "stage",
    "status",
    "startingBalanceCents",
    "profitTargetCents",
    "dailyLossLimitCents",
    "dailyLossLimitPct",
    "maxDrawdownCents",
    "maxDrawdownPct",
    "drawdownType",
    "minTradingDays",
    "maxTradingDays",
    "resetTimezone",
    "resetHour",
  ];

  const data: any = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  if (body.endDate !== undefined) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }

  if (
    body.notes !== undefined ||
    body.consistencyRuleType !== undefined ||
    body.consistencyThresholdPct !== undefined ||
    body.consistencyAction !== undefined
  ) {
    data.notes = serializeChallengeMetadata(
      {
        userNotes: body.notes !== undefined ? body.notes : undefined,
        consistencyRuleType: body.consistencyRuleType,
        consistencyThresholdPct: body.consistencyThresholdPct,
        consistencyAction: body.consistencyAction,
      },
      existing.notes,
      existing.account?.consistencyRate
    );
  }

  const updated = await db.propChallenge.update({
    where: { id },
    data,
  });

  return ok(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id } = await params;
  const existing = await db.propChallenge.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    return notFound("Prop challenge not found");
  }

  await db.propChallenge.delete({
    where: { id },
  });

  return ok({ deleted: true, id });
}

