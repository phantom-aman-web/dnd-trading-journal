import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { evaluatePropChallenge, type PropChallengeConfig, type TradeForChallenge } from "@/lib/prop-firm-engine";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");

  const where: any = { userId: user.id };
  if (accountId) {
    where.accountId = accountId;
  }

  const challenges = await db.propChallenge.findMany({
    where,
    include: {
      account: {
        select: {
          id: true,
          name: true,
          currency: true,
          startingBalanceCents: true,
          currentBalanceCents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate live metrics for each challenge
  const items = await Promise.all(
    challenges.map(async (c) => {
      const trades = await db.trade.findMany({
        where: {
          userId: user.id,
          accountId: c.accountId,
          exitTime: { gte: c.startDate },
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

      const metrics = evaluatePropChallenge(
        {
          ...c,
          startDate: c.startDate,
          endDate: c.endDate,
        },
        trades as TradeForChallenge[]
      );

      return {
        ...c,
        metrics,
      };
    })
  );

  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const body = await parseJson<{
    accountId?: string;
    name?: string;
    propFirm?: string;
    stage?: string;
    startingBalanceCents?: number;
    profitTargetCents?: number;
    dailyLossLimitCents?: number;
    dailyLossLimitPct?: number;
    maxDrawdownCents?: number;
    maxDrawdownPct?: number;
    drawdownType?: string;
    minTradingDays?: number;
    maxTradingDays?: number;
    resetTimezone?: string;
    resetHour?: number;
    startDate?: string;
    notes?: string;
  }>(req);

  if (!body) return bad("Invalid JSON payload");
  const {
    accountId,
    name,
    propFirm = "Prop Firm",
    stage = "phase1",
    startingBalanceCents,
    profitTargetCents,
    dailyLossLimitCents,
    dailyLossLimitPct,
    maxDrawdownCents,
    maxDrawdownPct,
    drawdownType = "static",
    minTradingDays = 4,
    maxTradingDays,
    resetTimezone = "America/New_York",
    resetHour = 17,
    startDate,
    notes,
  } = body;

  if (!accountId) return bad("accountId is required");
  if (!name || !name.trim()) return bad("name is required");
  if (!startingBalanceCents || startingBalanceCents <= 0) {
    return bad("startingBalanceCents must be greater than zero");
  }

  // Verify account belongs to user
  const account = await db.tradingAccount.findFirst({
    where: { id: accountId, userId: user.id },
  });
  if (!account) return bad("Trading account not found or access denied");

  const challenge = await db.propChallenge.create({
    data: {
      userId: user.id,
      accountId,
      name: name.trim(),
      propFirm: propFirm.trim(),
      stage,
      status: "active",
      startingBalanceCents,
      profitTargetCents: profitTargetCents ?? null,
      dailyLossLimitCents: dailyLossLimitCents ?? null,
      dailyLossLimitPct: dailyLossLimitPct ?? null,
      maxDrawdownCents: maxDrawdownCents ?? null,
      maxDrawdownPct: maxDrawdownPct ?? null,
      drawdownType,
      minTradingDays,
      maxTradingDays: maxTradingDays ?? null,
      resetTimezone,
      resetHour,
      startDate: startDate ? new Date(startDate) : new Date(),
      notes: notes?.trim() || null,
    },
  });

  return ok(challenge, 201);
}

