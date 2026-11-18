import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import {
  evaluatePropChallenge,
  type TradeForChallenge,
} from "@/lib/prop-firm-engine";
import {
  parsePropLifecycleMetadata,
  serializePropLifecycleMetadata,
  generateDefaultPhasesForModel,
  evaluatePropLifecycle,
  calculatePropAggregates,
  type PropAccountModel,
  type TradeForLifecycle,
} from "@/lib/prop-lifecycle-engine";

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
          consistencyRate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate live metrics & lifecycle intelligence for each challenge
  const items = await Promise.all(
    challenges.map(async (c) => {
      // Find the earliest trade for this linked account (excluding archived trades)
      const earliestTrade = await db.trade.findFirst({
        where: { userId: user.id, accountId: c.accountId, isArchived: false },
        orderBy: { entryTime: "asc" },
        select: { entryTime: true, exitTime: true },
      });

      let effectiveStartDate = c.startDate;
      if (earliestTrade) {
        const earliestTime = earliestTrade.entryTime || earliestTrade.exitTime;
        if (earliestTime && new Date(earliestTime).getTime() < new Date(c.startDate).getTime()) {
          effectiveStartDate = earliestTime;
          await db.propChallenge.update({
            where: { id: c.id },
            data: { startDate: earliestTime },
          }).catch(() => null);
        }
      }

      const trades = await db.trade.findMany({
        where: {
          userId: user.id,
          accountId: c.accountId,
          isArchived: false,
          OR: [
            { exitTime: { gte: effectiveStartDate } },
            { entryTime: { gte: effectiveStartDate } },
            { exitTime: null }, // open trades
          ],
          ...(c.endDate ? {
            OR: [
              { exitTime: { lte: c.endDate } },
              { entryTime: { lte: c.endDate } },
            ],
          } : {}),
        },
        select: {
          id: true,
          netPnlCents: true,
          entryTime: true,
          exitTime: true,
          status: true,
          isDraft: true,
          positionSize: true,
          plannedRiskAmountCents: true,
          newsEvent: true,
          instrumentSymbol: true,
          tagsJson: true,
          notes: true,
        },
      });

      // Parse full lifecycle metadata
      const lifecycleMeta = parsePropLifecycleMetadata(c.notes, c.account?.consistencyRate, {
        startingBalanceCents: c.startingBalanceCents,
        propFirm: c.propFirm,
        stage: c.stage,
        status: c.status,
        profitTargetCents: c.profitTargetCents,
        dailyLossLimitCents: c.dailyLossLimitCents,
        dailyLossLimitPct: c.dailyLossLimitPct,
        maxDrawdownCents: c.maxDrawdownCents,
        maxDrawdownPct: c.maxDrawdownPct,
        drawdownType: c.drawdownType,
        minTradingDays: c.minTradingDays,
        maxTradingDays: c.maxTradingDays,
        startDate: effectiveStartDate,
      });

      // Standard engine evaluation for backward compatibility
      const activePhase = lifecycleMeta.phases.find((p) => p.id === lifecycleMeta.currentPhaseId) || lifecycleMeta.phases[0];
      const consistencyRule = activePhase?.rules.find((r) => r.ruleKey === "consistency");

      const metrics = evaluatePropChallenge(
        {
          ...c,
          consistencyRuleType: consistencyRule ? "single_day_max" : "none",
          consistencyThresholdPct: consistencyRule?.config?.threshold ? Number(consistencyRule.config.threshold) : null,
          consistencyAction: consistencyRule?.config?.consistencyAction || "dilution_required",
          startDate: effectiveStartDate,
          endDate: c.endDate,
        },
        trades as TradeForChallenge[]
      );

      // Advanced lifecycle & compliance evaluation
      const lifecycleEval = evaluatePropLifecycle(
        {
          id: c.id,
          propFirm: c.propFirm,
          resetTimezone: c.resetTimezone,
          resetHour: c.resetHour,
          startDate: effectiveStartDate,
          endDate: c.endDate,
        },
        lifecycleMeta,
        trades as TradeForLifecycle[]
      );

      // Auto-update challenge status if changed
      const nextStatus = lifecycleEval.status === "passed" || lifecycleEval.status === "breached"
        ? lifecycleEval.status
        : c.status;

      if (nextStatus !== c.status) {
        await db.propChallenge.update({
          where: { id: c.id },
          data: { status: nextStatus },
        }).catch(() => null);
      }

      return {
        ...c,
        startDate: effectiveStartDate,
        status: nextStatus,
        userNotes: lifecycleMeta.userNotes,
        metrics,
        lifecycle: lifecycleEval,
        meta: lifecycleMeta,
      };
    })
  );

  // Compute aggregated statistics across all user challenges
  const aggregates = calculatePropAggregates(
    items.map((item) => ({
      id: item.id,
      propFirm: item.propFirm,
      currency: item.account?.currency || "USD",
      meta: item.meta,
      evalResult: item.lifecycle,
    }))
  );

  return ok({ items, aggregates });
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
    accountModel?: PropAccountModel;
    stage?: string;
    startingBalanceCents?: number;
    profitTargetCents?: number;
    dailyLossLimitCents?: number;
    dailyLossLimitPct?: number;
    maxDrawdownCents?: number;
    maxDrawdownPct?: number;
    drawdownType?: "static" | "trailing";
    drawdownBasis?: "balance" | "equity";
    minTradingDays?: number;
    maxTradingDays?: number;
    resetTimezone?: string;
    resetHour?: number;
    startDate?: string;
    notes?: string;
    accountCostCents?: number;
    consistencyRuleType?: "single_day_max" | "daily_pnl_consistency" | "none";
    consistencyThresholdPct?: number;
    consistencyAction?: "soft_rule" | "hard_breach";
    customPhaseCount?: number;
  }>(req);

  if (!body) return bad("Invalid JSON payload");
  const {
    accountId,
    name,
    propFirm = "Prop Firm",
    accountModel = "two_step",
    stage = "phase1",
    startingBalanceCents,
    profitTargetCents,
    dailyLossLimitCents,
    dailyLossLimitPct,
    maxDrawdownCents,
    maxDrawdownPct,
    drawdownType = "static",
    drawdownBasis = "balance",
    minTradingDays = 4,
    maxTradingDays,
    resetTimezone = "America/New_York",
    resetHour = 17,
    startDate,
    notes,
    accountCostCents = 54000,
    consistencyRuleType,
    consistencyThresholdPct,
    consistencyAction,
    customPhaseCount,
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

  // Safeguard: Check if this account is already linked to another active prop challenge
  const existingActive = await db.propChallenge.findFirst({
    where: {
      userId: user.id,
      accountId,
      status: { in: ["in_progress", "active", "funded", "awaiting_activation"] },
    },
    select: { id: true, name: true, propFirm: true },
  });
  if (existingActive) {
    return bad(
      `Trading account "${account.name}" is already linked to active challenge "${existingActive.name}" (${existingActive.propFirm}). Each challenge requires a dedicated trading account to prevent trade and P&L metric collisions.`
    );
  }

  const normalizedRate = account.consistencyRate != null
    ? (account.consistencyRate > 1 ? Math.round(account.consistencyRate) : Math.round(account.consistencyRate * 100))
    : null;

  // Auto-detect earliest trade if startDate not explicitly provided
  let effectiveStartDate: Date;
  if (startDate) {
    effectiveStartDate = new Date(startDate);
  } else {
    const earliestTrade = await db.trade.findFirst({
      where: { userId: user.id, accountId },
      orderBy: { entryTime: "asc" },
      select: { entryTime: true, exitTime: true },
    });
    effectiveStartDate = earliestTrade?.entryTime || earliestTrade?.exitTime || new Date();
  }

  // Generate full lifecycle metadata
  const phases = generateDefaultPhasesForModel(accountModel, {
    startingBalanceCents,
    profitTargetCents,
    dailyLossLimitCents,
    dailyLossLimitPct,
    maxDrawdownCents,
    maxDrawdownPct,
    drawdownType,
    drawdownBasis,
    minTradingDays,
    maxTradingDays,
    consistencyThresholdPct: consistencyThresholdPct ?? normalizedRate,
    consistencyAction,
    startDate: effectiveStartDate.toISOString(),
    customPhaseCount,
  });

  const activePhase = phases[0];

  const serializedNotes = serializePropLifecycleMetadata({
    __format: "alphapips_prop_lifecycle_v2",
    userNotes: notes?.trim() || "",
    accountModel,
    customPhaseCount,
    accountCostCents,
    currentPhaseId: activePhase.id,
    phases,
    violations: [],
    payoutConfig: {
      profitSplitPct: 80,
      minPayoutCents: 10000,
      waitingPeriodDays: 14,
      minProfitableDays: 5,
    },
    payouts: [],
    events: [
      {
        id: `event_create_${Date.now()}`,
        timestamp: effectiveStartDate.toISOString(),
        type: "created",
        title: "Challenge Created",
        description: `Purchased and configured as ${accountModel.replace("_", " ")} challenge with ${propFirm.trim()}.`,
      },
    ],
    isFirmDispute: false,
  });

  const challenge = await db.propChallenge.create({
    data: {
      userId: user.id,
      accountId,
      name: name.trim(),
      propFirm: propFirm.trim(),
      stage: activePhase.phaseType === "funded" ? "funded" : stage,
      status: activePhase.phaseType === "funded" ? "funded" : "active",
      startingBalanceCents,
      profitTargetCents: activePhase.profitTargetCents,
      dailyLossLimitCents: activePhase.dailyLossLimitCents,
      dailyLossLimitPct: activePhase.dailyLossLimitPct,
      maxDrawdownCents: activePhase.maxDrawdownCents,
      maxDrawdownPct: activePhase.maxDrawdownPct,
      drawdownType: activePhase.drawdownType,
      minTradingDays: activePhase.minTradingDays,
      maxTradingDays: activePhase.maxTradingDays,
      resetTimezone,
      resetHour,
      startDate: effectiveStartDate,
      notes: serializedNotes,
    },
  });

  return ok(challenge, 201);
}
