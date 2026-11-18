import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import {
  evaluatePropChallenge,
  type TradeForChallenge,
} from "@/lib/prop-firm-engine";
import {
  parsePropLifecycleMetadata,
  serializePropLifecycleMetadata,
  evaluatePropLifecycle,
  transitionToNextPhase,
  recordManualFirmRejection,
  requestPayout,
  type TradeForLifecycle,
  type PropRuleDefinition,
  type PropPhaseSnapshot,
} from "@/lib/prop-lifecycle-engine";

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

  // Find earliest trade for this linked account (excluding archived trades)
  const earliestTrade = await db.trade.findFirst({
    where: { userId: user.id, accountId: challenge.accountId, isArchived: false },
    orderBy: { entryTime: "asc" },
    select: { entryTime: true, exitTime: true },
  });

  let effectiveStartDate = challenge.startDate;
  if (earliestTrade) {
    const earliestTime = earliestTrade.entryTime || earliestTrade.exitTime;
    if (earliestTime && new Date(earliestTime).getTime() < new Date(challenge.startDate).getTime()) {
      effectiveStartDate = earliestTime;
    }
  }

  const trades = await db.trade.findMany({
    where: {
      userId: user.id,
      accountId: challenge.accountId,
      isArchived: false,
      ...(challenge.endDate ? {
        OR: [
          { exitTime: { lte: challenge.endDate } },
          { entryTime: { lte: challenge.endDate } },
          { exitTime: null },
        ],
      } : {}),
    },
    select: {
      id: true,
      instrumentSymbol: true,
      direction: true,
      netPnlCents: true,
      grossPnlCents: true,
      feesCents: true,
      commissionCents: true,
      entryTime: true,
      exitTime: true,
      status: true,
      isDraft: true,
      positionSize: true,
      plannedRiskAmountCents: true,
      plannedRiskPct: true,
      newsEvent: true,
      tagsJson: true,
      notes: true,
      setupGrade: true,
    },
    orderBy: { entryTime: "desc" },
  });

  const lifecycleMeta = parsePropLifecycleMetadata(challenge.notes, challenge.account?.consistencyRate, {
    startingBalanceCents: challenge.startingBalanceCents,
    propFirm: challenge.propFirm,
    stage: challenge.stage,
    status: challenge.status,
    profitTargetCents: challenge.profitTargetCents,
    dailyLossLimitCents: challenge.dailyLossLimitCents,
    dailyLossLimitPct: challenge.dailyLossLimitPct,
    maxDrawdownCents: challenge.maxDrawdownCents,
    maxDrawdownPct: challenge.maxDrawdownPct,
    drawdownType: challenge.drawdownType,
    minTradingDays: challenge.minTradingDays,
    maxTradingDays: challenge.maxTradingDays,
    startDate: effectiveStartDate,
  });

  const activePhase = lifecycleMeta.phases.find((p) => p.id === lifecycleMeta.currentPhaseId) || lifecycleMeta.phases[0];
  const consistencyRule = activePhase?.rules.find((r) => r.ruleKey === "consistency");

  const metrics = evaluatePropChallenge(
    {
      ...challenge,
      consistencyRuleType: consistencyRule ? "single_day_max" : "none",
      consistencyThresholdPct: consistencyRule?.config?.threshold ? Number(consistencyRule.config.threshold) : null,
      consistencyAction: consistencyRule?.config?.consistencyAction || "dilution_required",
      startDate: effectiveStartDate,
      endDate: challenge.endDate,
    },
    trades as TradeForChallenge[]
  );

  const lifecycle = evaluatePropLifecycle(
    {
      id: challenge.id,
      propFirm: challenge.propFirm,
      resetTimezone: challenge.resetTimezone,
      resetHour: challenge.resetHour,
      startDate: effectiveStartDate,
      endDate: challenge.endDate,
    },
    lifecycleMeta,
    trades as TradeForLifecycle[]
  );

  const nextStatus = lifecycle.status === "passed" || lifecycle.status === "breached"
    ? lifecycle.status
    : challenge.status;

  if (nextStatus !== challenge.status) {
    await db.propChallenge.update({
      where: { id: challenge.id },
      data: { status: nextStatus },
    }).catch(() => null);
  }

  return ok({
    ...challenge,
    startDate: effectiveStartDate,
    status: nextStatus,
    userNotes: lifecycleMeta.userNotes,
    metrics,
    lifecycle,
    rules: lifecycle.rules,
    violations: lifecycle.violations,
    warnings: lifecycle.warnings,
    isFirmDispute: lifecycle.isFirmDispute,
    payoutEligibility: lifecycle.payoutEligibility,
    activePhase: lifecycle.activePhase,
    trades,
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
    include: { account: { include: { trades: true } } },
  });

  if (!existing || existing.userId !== user.id) {
    return notFound("Prop challenge not found");
  }

  const body = await parseJson<any>(req);
  if (!body) return bad("Invalid JSON payload");

  let lifecycleMeta = parsePropLifecycleMetadata(existing.notes, existing.account?.consistencyRate, {
    startingBalanceCents: existing.startingBalanceCents,
    propFirm: existing.propFirm,
    stage: existing.stage,
    status: existing.status,
    profitTargetCents: existing.profitTargetCents,
    dailyLossLimitCents: existing.dailyLossLimitCents,
    dailyLossLimitPct: existing.dailyLossLimitPct,
    maxDrawdownCents: existing.maxDrawdownCents,
    maxDrawdownPct: existing.maxDrawdownPct,
    drawdownType: existing.drawdownType,
    minTradingDays: existing.minTradingDays,
    maxTradingDays: existing.maxTradingDays,
    startDate: existing.startDate,
  });

  const dbUpdates: any = {};

  // 1. Action: Phase Transition (e.g. from Phase 1 -> Phase 2 -> Funded)
  if (body.action === "transition_phase") {
    const currentPhase = lifecycleMeta.phases.find((p) => p.id === lifecycleMeta.currentPhaseId);
    const trades = (existing.account?.trades || []) as unknown as TradeForLifecycle[];
    const lifecycleEval = evaluatePropLifecycle(
      {
        id: existing.id,
        propFirm: existing.propFirm,
        resetTimezone: existing.resetTimezone,
        resetHour: existing.resetHour,
        startDate: existing.startDate,
        endDate: existing.endDate,
      },
      lifecycleMeta,
      trades
    );

    const passedRulesCount = lifecycleEval.rules.filter((r) => r.status === "passed").length;
    const totalRulesCount = lifecycleEval.rules.length;
    const nowIso = new Date().toISOString();

    const currentSnapshot: PropPhaseSnapshot = {
      phaseId: currentPhase?.id || "phase_1",
      phaseName: currentPhase?.name || "Evaluation Phase",
      sequence: currentPhase?.sequence || 1,
      completedAt: nowIso,
      startingBalanceCents: currentPhase?.startingBalanceCents || existing.startingBalanceCents,
      finalBalanceCents: lifecycleEval.currentBalanceCents,
      finalEquityCents: lifecycleEval.currentEquityCents,
      netProfitCents: lifecycleEval.netProfitCents,
      tradeCount: lifecycleEval.tradeCount,
      winRate: lifecycleEval.winRate,
      profitFactor: lifecycleEval.profitFactor,
      tradingDaysCount: lifecycleEval.tradingDaysCount,
      status: "passed",
      rulesPassedCount: passedRulesCount,
      rulesTotalCount: totalRulesCount,
      rules: currentPhase?.rules ? JSON.parse(JSON.stringify(currentPhase.rules)) : [],
      calculationMethods: {
        drawdownType: (currentPhase?.drawdownType || existing.drawdownType || "trailing") as "static" | "trailing",
        drawdownBasis: (currentPhase?.drawdownBasis || "balance") as "balance" | "equity",
      },
      resetConfig: {
        timezone: existing.resetTimezone || "America/Chicago",
        resetHour: existing.resetHour ?? 17,
      },
      ruleSourceVersion: "alphapips_challenge_meta_v1",
    };

    const { updatedMeta, newPhase, message } = transitionToNextPhase(
      lifecycleMeta,
      body.confirmed !== false,
      {
        policy: body.policy || "carry_forward",
        targetPhaseId: body.targetPhaseId,
        currentSnapshot,
        fundedAccountId: body.fundedAccountId || body.newAccountId,
        fundedAccountName: body.fundedAccountName,
        activationDate: body.activationDate,
      }
    );
    if (!newPhase) {
      return bad(message);
    }
    lifecycleMeta = updatedMeta;

    if (body.fundedAccountId || body.newAccountId) {
      dbUpdates.accountId = body.fundedAccountId || body.newAccountId;
    }

    dbUpdates.name = `${existing.propFirm} ${newPhase.name}`;
    dbUpdates.stage = newPhase.phaseType === "funded" ? "funded" : newPhase.id;
    dbUpdates.status = newPhase.status === "funded" ? "funded" : "active";
    dbUpdates.startingBalanceCents = newPhase.startingBalanceCents;
    dbUpdates.profitTargetCents = newPhase.profitTargetCents;
    dbUpdates.dailyLossLimitCents = newPhase.dailyLossLimitCents;
    dbUpdates.dailyLossLimitPct = newPhase.dailyLossLimitPct;
    dbUpdates.maxDrawdownCents = newPhase.maxDrawdownCents;
    dbUpdates.maxDrawdownPct = newPhase.maxDrawdownPct;
    dbUpdates.drawdownType = newPhase.drawdownType;
    dbUpdates.minTradingDays = newPhase.minTradingDays;
    dbUpdates.maxTradingDays = newPhase.maxTradingDays;
    dbUpdates.startDate = new Date(newPhase.startDate);
  }
  // 2. Action: Record Firm Rejection / Dispute (Hidden rule investigation workflow)
  else if (body.action === "record_firm_rejection") {
    if (!body.firmCommunication || !body.firmCommunication.trim()) {
      return bad("firmCommunication explanation is required");
    }
    lifecycleMeta = recordManualFirmRejection(lifecycleMeta, {
      firmCommunication: body.firmCommunication.trim(),
      undisclosedRuleName: body.undisclosedRuleName?.trim(),
      userVerified: Boolean(body.userVerified),
      date: body.date,
      documents: body.documents,
    });
    dbUpdates.status = "failed";
  }
  // 3. Action: Request Payout
  else if (body.action === "request_payout") {
    const amountCents = Number(body.amountCents);
    if (!amountCents || amountCents <= 0) {
      return bad("amountCents must be greater than zero");
    }
    const { updatedMeta } = requestPayout(lifecycleMeta, amountCents, body.notes);
    lifecycleMeta = updatedMeta;
  }
  // 4. Action: Update Payout Status (approved, rejected, paid)
  else if (body.action === "update_payout_status") {
    const { payoutId, status, processedAt, notes, transactionRef } = body;
    if (!payoutId || !status) return bad("payoutId and status are required");
    lifecycleMeta = {
      ...lifecycleMeta,
      payouts: lifecycleMeta.payouts.map((p) => {
        if (p.id === payoutId) {
          return {
            ...p,
            status,
            processedAt: processedAt || new Date().toISOString(),
            notes: notes ?? p.notes,
            transactionRef: transactionRef ?? p.transactionRef,
          };
        }
        return p;
      }),
    };
  }
  // 5. Action: Update Specific Rule in Active Phase
  else if (body.action === "update_rule") {
    const { ruleId, ruleUpdate } = body;
    if (!ruleId || !ruleUpdate) return bad("ruleId and ruleUpdate are required");
    lifecycleMeta = {
      ...lifecycleMeta,
      phases: lifecycleMeta.phases.map((ph) => {
        if (ph.id === lifecycleMeta.currentPhaseId) {
          return {
            ...ph,
            rules: ph.rules.map((r) => (r.id === ruleId ? { ...r, ...ruleUpdate, lastEvaluatedAt: new Date().toISOString() } : r)),
          };
        }
        return ph;
      }),
    };
  }
  // 6. Action: Add Custom Rule to Active Phase
  else if (body.action === "add_rule") {
    const newRule: PropRuleDefinition = {
      id: `rule_custom_${Date.now()}`,
      ruleKey: body.ruleKey || `custom_${Date.now()}`,
      category: body.category || "custom",
      name: body.name || "Custom Firm Rule",
      description: body.description || "",
      ruleSource: "manual_custom",
      config: body.config || {},
      calculationMethod: body.calculationMethod || "Manual firm compliance verification",
      status: body.status || "unverified",
      lastEvaluatedAt: new Date().toISOString(),
    };
    lifecycleMeta = {
      ...lifecycleMeta,
      phases: lifecycleMeta.phases.map((ph) => {
        if (ph.id === lifecycleMeta.currentPhaseId) {
          return { ...ph, rules: [...ph.rules, newRule] };
        }
        return ph;
      }),
    };
  }
  // 7. Direct Property Updates
  else {
    const standardFields = [
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
      "startDate",
      "endDate",
    ];

    for (const field of standardFields) {
      if (body[field] !== undefined) {
        dbUpdates[field] = field === "startDate" || field === "endDate"
          ? (body[field] ? new Date(body[field]) : null)
          : body[field];
      }
    }

    if (body.accountId && body.accountId !== existing.accountId) {
      const targetAccount = await db.tradingAccount.findFirst({
        where: { id: body.accountId, userId: user.id },
      });
      if (!targetAccount) {
        return bad("Target trading account not found or access denied");
      }
      const conflicting = await db.propChallenge.findFirst({
        where: {
          userId: user.id,
          accountId: body.accountId,
          id: { not: existing.id },
          status: { in: ["in_progress", "active", "funded", "awaiting_activation"] },
        },
      });
      if (conflicting) {
        return bad(`Account "${targetAccount.name}" is already linked to active challenge "${conflicting.name}".`);
      }
      dbUpdates.accountId = body.accountId;
    }

    if (body.accountModel) {
      lifecycleMeta.accountModel = body.accountModel;
    }
    if (body.userNotes !== undefined) {
      lifecycleMeta.userNotes = String(body.userNotes);
    }
    if (body.accountCostCents !== undefined) {
      lifecycleMeta.accountCostCents = Number(body.accountCostCents);
    }
    if (body.payoutConfig) {
      lifecycleMeta.payoutConfig = { ...lifecycleMeta.payoutConfig, ...body.payoutConfig };
    }
    if (body.phases && Array.isArray(body.phases)) {
      lifecycleMeta.phases = body.phases;
    }
  }

  // Persist updated serialized metadata to notes
  dbUpdates.notes = serializePropLifecycleMetadata(lifecycleMeta);

  const updated = await db.propChallenge.update({
    where: { id },
    data: dbUpdates,
    include: { account: true },
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

  return ok({ success: true });
}
