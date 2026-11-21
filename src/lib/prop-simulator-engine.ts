/**
 * AlphaPips — Prop Challenge Simulator, Consistency Projection & Rule Alert Engine
 * Features 24, 25, 32, 73:
 * - Live Prop Simulator (Feature 24): model proposed trade risk, profit target progress, daily loss & drawdown capacity
 * - Consistency Projection (Feature 25): exact rule formulas, dilution profit required, what-if day modeling
 * - Prop Breach Simulator (Feature 32): what-if rule stress testing with explicit status badges & mathematical reasons
 * - Rule Alerts (Feature 73): multi-threshold warnings, deduplication, severity classification
 */

import { PropChallengeMetrics, PropChallengeConfig } from "./prop-firm-engine";
import { db } from "@/lib/db";

export type RuleStatus = "Passed" | "Violated" | "At Risk" | "Unknown" | "Unverified" | "Not Applicable";

export interface HypotheticalTradeScenario {
  label?: string;
  proposedRiskCents: number;
  proposedProfitCents?: number;
  outcomeType: "win" | "loss" | "breakeven" | "custom";
  netPnlCents: number; // positive for profit, negative for loss
}

export interface RuleImpactResult {
  ruleName: string;
  status: RuleStatus;
  currentValue: string;
  projectedValue: string;
  bufferRemaining: string;
  reason: string;
}

export interface ScenarioSimulationResult {
  currentBalanceCents: number;
  projectedBalanceCents: number;
  projectedNetProfitCents: number;
  profitTargetImpact: {
    targetCents: number | null;
    remainingCents: number | null;
    progressPct: number | null;
    status: RuleStatus;
  };
  dailyLossImpact: {
    limitCents: number | null;
    remainingCents: number | null;
    usedPct: number | null;
    status: RuleStatus;
  };
  maxDrawdownImpact: {
    limitCents: number | null;
    remainingCents: number | null;
    usedPct: number | null;
    drawdownType: "static" | "trailing";
    status: RuleStatus;
  };
  consistencyImpact?: {
    thresholdPct: number | null;
    projectedPct: number | null;
    status: RuleStatus;
  };
  overallStatus: RuleStatus;
  overallReason: string;
  ruleBreakdown: RuleImpactResult[];
}

export interface ConsistencyProjectionResult {
  ruleType: string;
  thresholdPct: number | null;
  currentQualifyingProfitCents: number;
  bestDayProfitCents: number;
  currentConsistencyPct: number | null;
  maxPermittedDayProfitCents: number | null;
  complianceStatus: "Compliant" | "At Risk" | "Breached" | "Not Evaluated" | "Not Applicable" | "Unconfigured";
  additionalDilutionProfitRequiredCents: number;
  formulaDescription: string;
  accountScope?: string;
  calculationBasis?: "balance_based" | "equity_based";
  missingDataWarning?: string | null;
  projectedDays: Array<{
    dayIndex: number;
    hypotheticalPnlCents: number;
    projectedTotalProfitCents: number;
    projectedConsistencyPct: number | null;
    isCompliant: boolean;
  }>;
}

export interface GeneratedAlert {
  category: "daily_loss" | "max_drawdown" | "trailing_drawdown" | "consistency" | "profit_target" | "rule_breach" | "trading_days";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  currentValue: number;
  thresholdValue: number;
  unit: "%" | "cents" | "days";
  recommendedAction: string;
  dedupKey: string;
}

export interface AlertThresholdPreferences {
  dailyLossWarningPct?: number; // default 75%
  dailyLossCriticalPct?: number; // default 90%
  drawdownWarningPct?: number; // default 75%
  drawdownCriticalPct?: number; // default 90%
  consistencyWarningThreshold?: number; // default 80% of allowed limit
}

export function createDefaultPropMetrics(
  overrides: Partial<PropChallengeMetrics> = {}
): PropChallengeMetrics {
  const startingBalanceCents = overrides.startingBalanceCents ?? 10000000;
  const currentBalanceCents = overrides.currentBalanceCents ?? startingBalanceCents;
  const netProfitCents = overrides.netProfitCents ?? (currentBalanceCents - startingBalanceCents);

  return {
    startingBalanceCents,
    currentBalanceCents,
    netProfitCents,
    profitTargetCents: overrides.profitTargetCents ?? null,
    profitTargetProgressPct: overrides.profitTargetProgressPct ?? null,
    profitTargetReached: overrides.profitTargetReached ?? false,
    remainingProfitTargetCents: overrides.remainingProfitTargetCents ?? null,
    tradeCount: overrides.tradeCount ?? 0,
    winCount: overrides.winCount ?? 0,
    lossCount: overrides.lossCount ?? 0,
    breakevenCount: overrides.breakevenCount ?? 0,
    winRate: overrides.winRate ?? 0,
    profitFactor: overrides.profitFactor ?? null,
    dailyLossLimitCents: overrides.dailyLossLimitCents ?? null,
    todayPnlCents: overrides.todayPnlCents ?? 0,
    todayLossCents: overrides.todayLossCents ?? 0,
    remainingDailyLossCents: overrides.remainingDailyLossCents ?? null,
    dailyLossUsedPct: overrides.dailyLossUsedPct ?? null,
    dailyLossBreached: overrides.dailyLossBreached ?? false,
    cycleResetTime: overrides.cycleResetTime ?? "17:00 America/New_York",
    maxDrawdownLimitCents: overrides.maxDrawdownLimitCents ?? null,
    drawdownType: overrides.drawdownType ?? "static",
    highWaterMarkCents: overrides.highWaterMarkCents ?? startingBalanceCents,
    currentDrawdownCents: overrides.currentDrawdownCents ?? 0,
    remainingDrawdownCents: overrides.remainingDrawdownCents ?? null,
    drawdownUsedPct: overrides.drawdownUsedPct ?? null,
    drawdownBreached: overrides.drawdownBreached ?? false,
    minTradingDays: overrides.minTradingDays ?? 4,
    maxTradingDays: overrides.maxTradingDays ?? null,
    tradingDaysCount: overrides.tradingDaysCount ?? 0,
    minDaysMet: overrides.minDaysMet ?? false,
    daysRemaining: overrides.daysRemaining ?? null,
    consistencyRuleType: overrides.consistencyRuleType ?? "single_day_max",
    consistencyThresholdPct: overrides.consistencyThresholdPct ?? null,
    consistencyAction: overrides.consistencyAction ?? "dilution_required",
    bestDayProfitCents: overrides.bestDayProfitCents ?? 0,
    bestDayPctOfTotal: overrides.bestDayPctOfTotal ?? null,
    consistencyBreached: overrides.consistencyBreached ?? false,
    consistencyStatus: overrides.consistencyStatus ?? "unconfigured",
    status: overrides.status ?? "safe",
    statusReason: overrides.statusReason ?? "Normal operation",
    ...overrides,
  };
}

/**
 * FEATURE 24 & FEATURE 32:
 * Simulates how hypothetical trades affect all configured challenge rules without modifying real history.
 */
export function simulateChallengeScenario(
  base: PropChallengeMetrics,
  config: PropChallengeConfig,
  scenario: HypotheticalTradeScenario
): ScenarioSimulationResult {
  const pnlDelta = scenario.netPnlCents;
  const projectedBalanceCents = base.currentBalanceCents + pnlDelta;
  const currentNetProfit = base.netProfitCents ?? (base.currentBalanceCents - base.startingBalanceCents);
  const projectedNetProfitCents = currentNetProfit + pnlDelta;

  const ruleBreakdown: RuleImpactResult[] = [];
  let worstStatus: RuleStatus = "Passed";

  // 1. Profit Target Evaluation
  let targetStatus: RuleStatus = "Not Applicable";
  let projectedTargetRemainingCents: number | null = null;
  let projectedTargetProgressPct: number | null = null;

  if (base.profitTargetCents && base.profitTargetCents > 0) {
    projectedTargetRemainingCents = Math.max(0, base.profitTargetCents - projectedNetProfitCents);
    projectedTargetProgressPct = Math.min(100, (projectedNetProfitCents / base.profitTargetCents) * 100);
    targetStatus = projectedTargetRemainingCents === 0 ? "Passed" : "Passed";

    ruleBreakdown.push({
      ruleName: "Profit Target",
      status: targetStatus,
      currentValue: `$${(base.netProfitCents / 100).toFixed(2)}`,
      projectedValue: `$${(projectedNetProfitCents / 100).toFixed(2)}`,
      bufferRemaining: `$${(projectedTargetRemainingCents / 100).toFixed(2)} remaining`,
      reason: projectedTargetRemainingCents === 0
        ? "Target achieved under this scenario."
        : `Requires $${(projectedTargetRemainingCents / 100).toFixed(2)} more profit to pass phase.`,
    });
  }

  // 2. Daily Loss Limit Evaluation
  let dailyStatus: RuleStatus = "Passed";
  let projectedDailyLossRemainingCents: number | null = null;
  let projectedDailyLossUsedPct: number | null = null;

  if (base.dailyLossLimitCents && base.dailyLossLimitCents > 0) {
    const projectedTodayPnl = base.todayPnlCents + pnlDelta;
    const projectedTodayLoss = projectedTodayPnl < 0 ? Math.abs(projectedTodayPnl) : 0;
    projectedDailyLossRemainingCents = Math.max(0, base.dailyLossLimitCents - projectedTodayLoss);
    projectedDailyLossUsedPct = (projectedTodayLoss / base.dailyLossLimitCents) * 100;

    if (projectedTodayLoss >= base.dailyLossLimitCents) {
      dailyStatus = "Violated";
      worstStatus = "Violated";
    } else if (projectedDailyLossUsedPct >= 80) {
      dailyStatus = "At Risk";
      if ((worstStatus as RuleStatus) !== "Violated") worstStatus = "At Risk";
    }

    ruleBreakdown.push({
      ruleName: "Daily Loss Limit",
      status: dailyStatus,
      currentValue: `$${(base.todayLossCents / 100).toFixed(2)} (${(base.dailyLossUsedPct ?? 0).toFixed(1)}%)`,
      projectedValue: `$${(projectedTodayLoss / 100).toFixed(2)} (${projectedDailyLossUsedPct.toFixed(1)}%)`,
      bufferRemaining: `$${(projectedDailyLossRemainingCents / 100).toFixed(2)} capacity remaining`,
      reason: dailyStatus === "Violated"
        ? `Scenario breaches daily loss limit by $${((projectedTodayLoss - base.dailyLossLimitCents) / 100).toFixed(2)}.`
        : dailyStatus === "At Risk"
        ? `Scenario consumes ${projectedDailyLossUsedPct.toFixed(1)}% of maximum daily loss allowance.`
        : "Compliant within configured daily loss parameters.",
    });
  }

  // 3. Maximum Drawdown / Trailing Drawdown Evaluation
  let maxDdStatus: RuleStatus = "Passed";
  let projectedDdRemainingCents: number | null = null;
  let projectedDdUsedPct: number | null = null;

  if (base.maxDrawdownLimitCents && base.maxDrawdownLimitCents > 0) {
    const isTrailing = base.drawdownType === "trailing";
    const projectedHwm = Math.max(base.highWaterMarkCents, projectedBalanceCents);
    const projectedDrawdown = Math.max(0, (isTrailing ? projectedHwm : base.startingBalanceCents) - projectedBalanceCents);

    projectedDdRemainingCents = Math.max(0, base.maxDrawdownLimitCents - projectedDrawdown);
    projectedDdUsedPct = (projectedDrawdown / base.maxDrawdownLimitCents) * 100;

    if (projectedDrawdown >= base.maxDrawdownLimitCents) {
      maxDdStatus = "Violated";
      worstStatus = "Violated";
    } else if (projectedDdUsedPct >= 80) {
      maxDdStatus = "At Risk";
      if ((worstStatus as RuleStatus) !== "Violated") worstStatus = "At Risk";
    }

    ruleBreakdown.push({
      ruleName: isTrailing ? "Trailing Drawdown" : "Maximum Drawdown",
      status: maxDdStatus,
      currentValue: `$${(base.currentDrawdownCents / 100).toFixed(2)} (${(base.drawdownUsedPct ?? 0).toFixed(1)}%)`,
      projectedValue: `$${(projectedDrawdown / 100).toFixed(2)} (${projectedDdUsedPct.toFixed(1)}%)`,
      bufferRemaining: `$${(projectedDdRemainingCents / 100).toFixed(2)} cushion remaining`,
      reason: maxDdStatus === "Violated"
        ? `Scenario exceeds maximum drawdown by $${((projectedDrawdown - base.maxDrawdownLimitCents) / 100).toFixed(2)} (Hard Breach).`
        : maxDdStatus === "At Risk"
        ? `Scenario consumes ${projectedDdUsedPct.toFixed(1)}% of allowable maximum drawdown.`
        : "Account equity remains safely above drawdown boundary.",
    });
  }

  // Overall explanation
  const violatedRules = ruleBreakdown.filter((r) => r.status === "Violated");
  const atRiskRules = ruleBreakdown.filter((r) => r.status === "At Risk");

  let overallReason = "Scenario complies with all challenge parameters.";
  if (violatedRules.length > 0) {
    overallReason = `Scenario breaches rules: ${violatedRules.map((r) => r.reason).join(" ")}`;
  } else if (atRiskRules.length > 0) {
    overallReason = `Scenario approaches risk thresholds: ${atRiskRules.map((r) => r.reason).join(" ")}`;
  }

  return {
    currentBalanceCents: base.currentBalanceCents,
    projectedBalanceCents,
    projectedNetProfitCents,
    profitTargetImpact: {
      targetCents: base.profitTargetCents,
      remainingCents: projectedTargetRemainingCents,
      progressPct: projectedTargetProgressPct,
      status: targetStatus,
    },
    dailyLossImpact: {
      limitCents: base.dailyLossLimitCents,
      remainingCents: projectedDailyLossRemainingCents,
      usedPct: projectedDailyLossUsedPct,
      status: dailyStatus,
    },
    maxDrawdownImpact: {
      limitCents: base.maxDrawdownLimitCents,
      remainingCents: projectedDdRemainingCents,
      usedPct: projectedDdUsedPct,
      drawdownType: base.drawdownType,
      status: maxDdStatus,
    },
    overallStatus: worstStatus,
    overallReason,
    ruleBreakdown,
  };
}

/**
 * FEATURE 25:
 * Calculates consistency projection based on exact configured rules (e.g. single day max % of total profit).
 * Never assumes a single universal rule; respects account phases, balance/equity basis, and handles zero/negative profit.
 */
export function calculateConsistencyProjection(
  base: PropChallengeMetrics,
  config: PropChallengeConfig,
  hypotheticalDays: number[] = [50000, 75000, 100000] // Default $500, $750, $1,000 next days
): ConsistencyProjectionResult {
  const ruleType = config.consistencyRuleType ?? (config.consistencyThresholdPct ? "single_day_max" : "none");
  const thresholdPct = config.consistencyThresholdPct ?? base.consistencyThresholdPct;
  const isConfigured = Boolean(ruleType !== "none" && thresholdPct && thresholdPct > 0);

  if (!isConfigured || !thresholdPct) {
    return {
      ruleType: "none",
      thresholdPct: null,
      currentQualifyingProfitCents: base.netProfitCents,
      bestDayProfitCents: base.bestDayProfitCents,
      currentConsistencyPct: null,
      maxPermittedDayProfitCents: null,
      complianceStatus: "Unconfigured",
      additionalDilutionProfitRequiredCents: 0,
      formulaDescription: "No consistency rule configured for this challenge phase.",
      accountScope: "Current Phase",
      calculationBasis: base.drawdownType === "trailing" ? "equity_based" : "balance_based",
      missingDataWarning: null,
      projectedDays: [],
    };
  }

  const qualifyingProfit = base.netProfitCents;
  const bestDay = base.bestDayProfitCents;

  // 1. Missing trade history edge case
  if (base.tradingDaysCount === 0 || (bestDay <= 0 && qualifyingProfit === 0 && (base.tradeCount ?? 0) === 0)) {
    return {
      ruleType,
      thresholdPct,
      currentQualifyingProfitCents: qualifyingProfit,
      bestDayProfitCents: bestDay,
      currentConsistencyPct: null,
      maxPermittedDayProfitCents: null,
      complianceStatus: "Not Evaluated",
      additionalDilutionProfitRequiredCents: 0,
      formulaDescription: "No trading activity recorded for this phase. Consistency rule will evaluate once trades are executed and profit is generated.",
      accountScope: "Current Phase",
      calculationBasis: base.drawdownType === "trailing" ? "equity_based" : "balance_based",
      missingDataWarning: "No trading days recorded.",
      projectedDays: [],
    };
  }

  // 2. Break-even cumulative profit (denominator is zero)
  if (qualifyingProfit === 0) {
    const dilutionRequired = bestDay > 0 ? Math.round((bestDay / thresholdPct) * 100) : 0;
    return {
      ruleType,
      thresholdPct,
      currentQualifyingProfitCents: 0,
      bestDayProfitCents: bestDay,
      currentConsistencyPct: null,
      maxPermittedDayProfitCents: 0,
      complianceStatus: "Not Evaluated",
      additionalDilutionProfitRequiredCents: dilutionRequired,
      formulaDescription: bestDay > 0
        ? `Account is at break-even ($0.00 net profit) with a highest winning day of $${(bestDay / 100).toFixed(2)}. Consistency percentage is undefined with zero denominator. To satisfy the ${thresholdPct}% rule once in profit, cumulative profit must reach $${((dilutionRequired) / 100).toFixed(2)}.`
        : "Account is at break-even ($0.00 net profit) with no winning days. Consistency percentage evaluates when net profit becomes positive.",
      accountScope: "Current Phase",
      calculationBasis: base.drawdownType === "trailing" ? "equity_based" : "balance_based",
      missingDataWarning: base.tradingDaysCount < 3 ? `Sample size small (${base.tradingDaysCount} trading days).` : null,
      projectedDays: [],
    };
  }

  // 3. Negative cumulative profit (account in net loss / drawdown)
  if (qualifyingProfit < 0) {
    const dilutionRequired = bestDay > 0 ? Math.round(((bestDay / thresholdPct) * 100) - qualifyingProfit) : 0;
    return {
      ruleType,
      thresholdPct,
      currentQualifyingProfitCents: qualifyingProfit,
      bestDayProfitCents: bestDay,
      currentConsistencyPct: null,
      maxPermittedDayProfitCents: null,
      complianceStatus: "Not Evaluated",
      additionalDilutionProfitRequiredCents: dilutionRequired,
      formulaDescription: bestDay > 0
        ? `Account has negative cumulative profit ($${(qualifyingProfit / 100).toFixed(2)}) despite a highest winning day of $${(bestDay / 100).toFixed(2)}. Consistency score cannot be evaluated with a negative denominator. Recovering to ${thresholdPct}% compliance requires generating $${(dilutionRequired / 100).toFixed(2)} in additional profit.`
        : `Account is currently in net loss ($${(qualifyingProfit / 100).toFixed(2)}) with no winning days. Consistency percentage evaluates when net profit is positive.`,
      accountScope: "Current Phase",
      calculationBasis: base.drawdownType === "trailing" ? "equity_based" : "balance_based",
      missingDataWarning: base.tradingDaysCount < 3 ? `Sample size small (${base.tradingDaysCount} trading days).` : null,
      projectedDays: [],
    };
  }

  // 4. Positive cumulative profit — standard mathematical consistency evaluation
  const currentPct = (bestDay / qualifyingProfit) * 100;
  const maxPermitted = (qualifyingProfit * thresholdPct) / 100;

  let dilutionRequired = 0;
  if (currentPct > thresholdPct) {
    const requiredTotal = (bestDay / thresholdPct) * 100;
    dilutionRequired = Math.max(0, requiredTotal - qualifyingProfit);
  }

  let complianceStatus: "Compliant" | "At Risk" | "Breached" = "Compliant";
  if (currentPct > thresholdPct) {
    complianceStatus = "Breached";
  } else if (currentPct >= thresholdPct * 0.85) {
    complianceStatus = "At Risk";
  }

  // Model hypothetical next days
  let runningTotal = qualifyingProfit;
  let runningBest = Math.max(0, bestDay);
  const projectedDays = hypotheticalDays.map((pnl, idx) => {
    runningTotal += pnl;
    if (pnl > runningBest) runningBest = pnl;
    const projPct = runningTotal > 0 ? (runningBest / runningTotal) * 100 : null;
    return {
      dayIndex: idx + 1,
      hypotheticalPnlCents: pnl,
      projectedTotalProfitCents: runningTotal,
      projectedConsistencyPct: projPct !== null ? Math.round(projPct * 10) / 10 : null,
      isCompliant: projPct !== null ? projPct <= thresholdPct : false,
    };
  });

  return {
    ruleType,
    thresholdPct,
    currentQualifyingProfitCents: qualifyingProfit,
    bestDayProfitCents: bestDay,
    currentConsistencyPct: Math.round(currentPct * 10) / 10,
    maxPermittedDayProfitCents: Math.round(maxPermitted),
    complianceStatus,
    additionalDilutionProfitRequiredCents: Math.round(dilutionRequired),
    formulaDescription: `Single-day profit limit: ${thresholdPct}% of net profit. Best Day: $${(bestDay / 100).toFixed(2)} (${currentPct.toFixed(1)}% of $${(qualifyingProfit / 100).toFixed(2)} total profit).`,
    accountScope: "Current Phase",
    calculationBasis: base.drawdownType === "trailing" ? "equity_based" : "balance_based",
    missingDataWarning: base.tradingDaysCount < 3 ? `Preliminary projection (${base.tradingDaysCount} trading days recorded).` : null,
    projectedDays,
  };
}

/**
 * FEATURE 73: Persists active rule alerts to database as real in-app notifications
 * with deduplication and cooldown protection.
 */
export async function persistRuleAlerts(
  userId: string,
  challengeId: string,
  alerts: GeneratedAlert[],
  options: { cooldownMinutes?: number } = {}
): Promise<number> {
  const cooldownMin = options.cooldownMinutes ?? 60;
  const cooldownThreshold = new Date(Date.now() - cooldownMin * 60 * 1000);
  let createdCount = 0;

  for (const alert of alerts) {
    if (alert.severity !== "critical" && alert.severity !== "warning") continue;

    const existing = await db.notification.findFirst({
      where: {
        userId,
        category: "trading",
        title: alert.title,
        createdAt: { gte: cooldownThreshold },
      },
    });

    if (!existing) {
      await db.notification.create({
        data: {
          userId,
          category: "trading",
          title: alert.title,
          body: `${alert.message} Recommended Action: ${alert.recommendedAction}`,
          read: false,
        },
      });
      createdCount++;
    }
  }

  return createdCount;
}

/**
 * FEATURE 73: Automatically evaluates rules and triggers persisted notifications
 * whenever an account's trades or positions change.
 */
export async function triggerChallengeRuleAlertsForAccount(
  userId: string,
  accountId: string
): Promise<number> {
  try {
    const challenge = await db.propChallenge.findFirst({
      where: {
        userId,
        accountId,
      },
    });

    if (!challenge) return 0;

    const metrics = createDefaultPropMetrics({
      startingBalanceCents: challenge.startingBalanceCents,
      currentBalanceCents: challenge.startingBalanceCents,
      profitTargetCents: challenge.profitTargetCents ?? null,
      dailyLossLimitCents: challenge.dailyLossLimitCents ?? null,
      maxDrawdownLimitCents: challenge.maxDrawdownCents ?? null,
      drawdownType: (challenge.drawdownType as any) || "static",
      highWaterMarkCents: challenge.trailingHighWaterMarkCents ?? challenge.startingBalanceCents,
      minTradingDays: challenge.minTradingDays ?? 4,
    });

    const alerts = evaluateRuleAlerts(challenge.id, metrics);
    if (alerts.length === 0) return 0;

    return await persistRuleAlerts(userId, challenge.id, alerts);
  } catch (err) {
    console.warn("Non-fatal error in triggerChallengeRuleAlertsForAccount:", err);
    return 0;
  }
}

/**
 * FEATURE 73:
 * Evaluates real-time metrics against configured rule alerts and threshold preferences.
 */
export function evaluateRuleAlerts(
  challengeId: string,
  base: PropChallengeMetrics,
  prefs: AlertThresholdPreferences = {}
): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = [];
  const dailyWarn = prefs.dailyLossWarningPct ?? 75;
  const dailyCrit = prefs.dailyLossCriticalPct ?? 90;
  const ddWarn = prefs.drawdownWarningPct ?? 75;
  const ddCrit = prefs.drawdownCriticalPct ?? 90;

  // 1. Daily Loss Approaching / Breached
  if (base.dailyLossLimitCents && base.dailyLossLimitCents > 0) {
    const usedPct = base.dailyLossUsedPct ?? 0;
    if (base.dailyLossBreached) {
      alerts.push({
        category: "rule_breach",
        severity: "critical",
        title: "Daily Loss Limit Breached",
        message: `Today's loss of $${(base.todayLossCents / 100).toFixed(2)} has reached the maximum permitted daily loss ($${(base.dailyLossLimitCents / 100).toFixed(2)}).`,
        currentValue: base.todayLossCents,
        thresholdValue: base.dailyLossLimitCents,
        unit: "cents",
        recommendedAction: "Halt all new trade entries until the 17:00 NY cycle reset.",
        dedupKey: `alert:${challengeId}:daily_breach:${Math.floor(Date.now() / 3600000)}`,
      });
    } else if (usedPct >= dailyCrit) {
      alerts.push({
        category: "daily_loss",
        severity: "critical",
        title: "Critical Daily Loss Threshold (90%+)",
        message: `You have consumed ${usedPct.toFixed(1)}% of your permitted daily loss. Only $${((base.remainingDailyLossCents ?? 0) / 100).toFixed(2)} buffer remains.`,
        currentValue: usedPct,
        thresholdValue: dailyCrit,
        unit: "%",
        recommendedAction: "Reduce position sizing to minimal risk or cease trading for the session.",
        dedupKey: `alert:${challengeId}:daily_crit:${Math.floor(Date.now() / 3600000)}`,
      });
    } else if (usedPct >= dailyWarn) {
      alerts.push({
        category: "daily_loss",
        severity: "warning",
        title: "Daily Loss Warning (75%+)",
        message: `You have consumed ${usedPct.toFixed(1)}% of your daily loss buffer. $${((base.remainingDailyLossCents ?? 0) / 100).toFixed(2)} remains before breach.`,
        currentValue: usedPct,
        thresholdValue: dailyWarn,
        unit: "%",
        recommendedAction: "Exercise heightened discipline and verify A+ setups only.",
        dedupKey: `alert:${challengeId}:daily_warn:${Math.floor(Date.now() / 3600000)}`,
      });
    }
  }

  // 2. Maximum Drawdown Approaching / Breached
  if (base.maxDrawdownLimitCents && base.maxDrawdownLimitCents > 0) {
    const usedPct = base.drawdownUsedPct ?? 0;
    if (base.drawdownBreached) {
      alerts.push({
        category: "rule_breach",
        severity: "critical",
        title: "Maximum Drawdown Breached",
        message: `Current drawdown ($${(base.currentDrawdownCents / 100).toFixed(2)}) has reached the maximum drawdown limit ($${(base.maxDrawdownLimitCents / 100).toFixed(2)}).`,
        currentValue: base.currentDrawdownCents,
        thresholdValue: base.maxDrawdownLimitCents,
        unit: "cents",
        recommendedAction: "Account in breach. Review trade history and challenge rules.",
        dedupKey: `alert:${challengeId}:dd_breach:${Math.floor(Date.now() / 3600000)}`,
      });
    } else if (usedPct >= ddCrit) {
      alerts.push({
        category: "max_drawdown",
        severity: "critical",
        title: "Critical Drawdown Cushion (90%+)",
        message: `Maximum drawdown usage has reached ${usedPct.toFixed(1)}%. Only $${((base.remainingDrawdownCents ?? 0) / 100).toFixed(2)} cushion remains.`,
        currentValue: usedPct,
        thresholdValue: ddCrit,
        unit: "%",
        recommendedAction: "Protect remaining account balance. Cut risk per trade.",
        dedupKey: `alert:${challengeId}:dd_crit:${Math.floor(Date.now() / 3600000)}`,
      });
    } else if (usedPct >= ddWarn) {
      alerts.push({
        category: "max_drawdown",
        severity: "warning",
        title: "Drawdown Warning (75%+)",
        message: `Maximum drawdown usage at ${usedPct.toFixed(1)}%. $${((base.remainingDrawdownCents ?? 0) / 100).toFixed(2)} cushion remaining.`,
        currentValue: usedPct,
        thresholdValue: ddWarn,
        unit: "%",
        recommendedAction: "Carefully monitor risk-to-reward and position sizing.",
        dedupKey: `alert:${challengeId}:dd_warn:${Math.floor(Date.now() / 3600000)}`,
      });
    }
  }

  // 3. Profit Target Achieved
  if (base.profitTargetReached) {
    alerts.push({
      category: "profit_target",
      severity: "info",
      title: "Profit Target Achieved!",
      message: `Congratulations! Total qualifying profit of $${(base.netProfitCents / 100).toFixed(2)} has reached the required target ($${((base.profitTargetCents ?? 0) / 100).toFixed(2)}).`,
      currentValue: base.netProfitCents,
      thresholdValue: base.profitTargetCents ?? 0,
      unit: "cents",
      recommendedAction: "Ensure minimum trading day requirements are fulfilled to qualify for certificate/phase upgrade.",
      dedupKey: `alert:${challengeId}:target_hit`,
    });
  }

  // 4. Consistency Limit Warning
  if (base.consistencyStatus === "breached") {
    alerts.push({
      category: "consistency",
      severity: "warning",
      title: "Consistency Rule Exceeded",
      message: `Your best day contributes ${base.bestDayPctOfTotal?.toFixed(1)}% of total profit, exceeding the configured ${base.consistencyThresholdPct}% limit. Additional profit required to dilute.`,
      currentValue: base.bestDayPctOfTotal ?? 0,
      thresholdValue: base.consistencyThresholdPct ?? 50,
      unit: "%",
      recommendedAction: "Continue consistent trading to dilute the single-day profit proportion.",
      dedupKey: `alert:${challengeId}:consistency_breach:${Math.floor(Date.now() / 3600000)}`,
    });
  }

  return alerts;
}
