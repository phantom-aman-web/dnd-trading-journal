/**
 * DnD — Prop Firm Challenge & Funded Account Rule Engine
 * Evaluates prop firm rules (profit target, daily loss limit with timezone reset,
 * static/trailing drawdown, minimum trading days, consistency) using server-authoritative
 * trade execution data.
 */

export interface PropChallengeConfig {
  id?: string;
  name?: string;
  propFirm?: string;
  stage?: string;
  status?: string;
  startingBalanceCents: number;
  profitTargetCents?: number | null;
  dailyLossLimitCents?: number | null;
  dailyLossLimitPct?: number | null;
  maxDrawdownCents?: number | null;
  maxDrawdownPct?: number | null;
  drawdownType?: string; // "static" | "trailing"
  trailingHighWaterMarkCents?: number | null;
  minTradingDays?: number | null;
  maxTradingDays?: number | null;
  consistencyRuleType?: "single_day_max" | "daily_pnl_consistency" | "none";
  consistencyThresholdPct?: number | null; // e.g. 50 (max 50% profit from single day)
  consistencyAction?: ConsistencyAction;
  resetTimezone?: string; // e.g. "America/New_York", "UTC", "Europe/London"
  resetHour?: number; // 0-23, e.g. 17 for 5:00 PM New York
  startDate: string | Date;
  endDate?: string | Date | null;
}

export type ConsistencyAction =
  | "warning"
  | "dilution_required"
  | "payout_restricted"
  | "hard_breach"
  | "soft_rule"; // backward compatible alias for dilution_required

export interface ChallengeMetadata {
  userNotes: string;
  consistencyRuleType: "single_day_max" | "daily_pnl_consistency" | "none";
  consistencyThresholdPct: number | null;
  consistencyAction: ConsistencyAction;
}

export function parseChallengeMetadata(
  rawNotes: string | null | undefined,
  accountConsistencyRate?: number | null,
): ChallengeMetadata {
  const fallback: ChallengeMetadata = {
    userNotes: "",
    consistencyRuleType: accountConsistencyRate ? "single_day_max" : "none",
    consistencyThresholdPct: accountConsistencyRate ? Math.round(accountConsistencyRate * 100) : null,
    consistencyAction: "soft_rule",
  };

  if (!rawNotes || typeof rawNotes !== "string") {
    return fallback;
  }

  const trimmed = rawNotes.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        let action: ConsistencyAction = "soft_rule";
        if (
          parsed.consistencyAction === "warning" ||
          parsed.consistencyAction === "dilution_required" ||
          parsed.consistencyAction === "payout_restricted" ||
          parsed.consistencyAction === "hard_breach" ||
          parsed.consistencyAction === "soft_rule"
        ) {
          action = parsed.consistencyAction;
        }

        return {
          userNotes: typeof parsed.userNotes === "string" ? parsed.userNotes : "",
          consistencyRuleType:
            parsed.consistencyRuleType === "single_day_max" ||
            parsed.consistencyRuleType === "daily_pnl_consistency" ||
            parsed.consistencyRuleType === "none"
              ? parsed.consistencyRuleType
              : fallback.consistencyRuleType,
          consistencyThresholdPct:
            parsed.consistencyThresholdPct != null && !isNaN(Number(parsed.consistencyThresholdPct))
              ? Number(parsed.consistencyThresholdPct)
              : fallback.consistencyThresholdPct,
          consistencyAction: action,
        };
      }
    } catch {
      return { ...fallback, userNotes: trimmed };
    }
  }

  return { ...fallback, userNotes: trimmed };
}

export function serializeChallengeMetadata(
  meta: Partial<ChallengeMetadata>,
  existingRaw?: string | null,
  accountConsistencyRate?: number | null,
): string {
  const current = parseChallengeMetadata(existingRaw, accountConsistencyRate);
  const updated: ChallengeMetadata = {
    userNotes: meta.userNotes !== undefined ? meta.userNotes : current.userNotes,
    consistencyRuleType: meta.consistencyRuleType !== undefined ? meta.consistencyRuleType : current.consistencyRuleType,
    consistencyThresholdPct: meta.consistencyThresholdPct !== undefined ? meta.consistencyThresholdPct : current.consistencyThresholdPct,
    consistencyAction: meta.consistencyAction !== undefined ? meta.consistencyAction : current.consistencyAction,
  };

  return JSON.stringify({
    __format: "alphapips_challenge_meta_v1",
    userNotes: updated.userNotes,
    consistencyRuleType: updated.consistencyRuleType,
    consistencyThresholdPct: updated.consistencyThresholdPct,
    consistencyAction: updated.consistencyAction,
  });
}

export interface TradeForChallenge {
  id: string;
  netPnlCents: number;
  entryTime: string | Date | null;
  exitTime: string | Date | null;
  status: string; // "open" | "closed" | "planned" | "draft"
  isDraft?: boolean;
}

export interface PropChallengeMetrics {
  startingBalanceCents: number;
  currentBalanceCents: number;
  netProfitCents: number;
  profitTargetCents: number | null;
  profitTargetProgressPct: number | null;
  profitTargetReached: boolean;

  // Daily Loss
  dailyLossLimitCents: number | null;
  todayPnlCents: number;
  todayLossCents: number;
  remainingDailyLossCents: number | null;
  dailyLossUsedPct: number | null;
  dailyLossBreached: boolean;
  cycleResetTime: string;

  // Max Drawdown
  maxDrawdownLimitCents: number | null;
  drawdownType: "static" | "trailing";
  highWaterMarkCents: number;
  currentDrawdownCents: number;
  remainingDrawdownCents: number | null;
  drawdownUsedPct: number | null;
  drawdownBreached: boolean;

  // Trading Days
  minTradingDays: number | null;
  tradingDaysCount: number;
  minDaysMet: boolean;

  // Consistency (single day max profit rule or custom)
  consistencyRuleType: "single_day_max" | "daily_pnl_consistency" | "none";
  consistencyThresholdPct: number | null;
  consistencyAction: ConsistencyAction;
  bestDayProfitCents: number;
  bestDayPctOfTotal: number | null;
  consistencyBreached: boolean;
  consistencyStatus: "satisfied" | "at_risk" | "breached" | "unconfigured";

  // Aggregate Status
  status: "safe" | "approaching_limit" | "at_risk" | "breached" | "passed";
  statusReason: string;
}

/**
 * Returns a key representing the trading day cycle for a given date in the target timezone & reset hour.
 * A trading day starting at resetHour:00 on day D runs until resetHour:00 on day D+1.
 */
export function getTradingCycleKey(
  date: Date,
  timezone = "America/New_York",
  resetHour = 17
): string {
  // Format the date into year, month, day, hour in the given timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = "";
  let month = "";
  let day = "";
  let hour = 0;

  for (const part of parts) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value;
    if (part.type === "day") day = part.value;
    if (part.type === "hour") hour = parseInt(part.value, 10);
  }

  // If the local hour in the timezone is < resetHour, it belongs to the cycle that started yesterday
  const localDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (hour < resetHour) {
    localDate.setUTCDate(localDate.getUTCDate() - 1);
  }

  const cycleYear = localDate.getUTCFullYear();
  const cycleMonth = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const cycleDay = String(localDate.getUTCDate()).padStart(2, "0");

  return `${cycleYear}-${cycleMonth}-${cycleDay}`;
}

export function evaluatePropChallenge(
  config: PropChallengeConfig,
  trades: TradeForChallenge[],
  now = new Date()
): PropChallengeMetrics {
  const startMs = new Date(config.startDate).getTime();
  const timezone = config.resetTimezone || "America/New_York";
  const resetHour = config.resetHour ?? 17;
  const drawdownType = (config.drawdownType === "trailing" ? "trailing" : "static") as "static" | "trailing";

  // Filter valid trades on or after challenge start date (excluding drafts/planned)
  const validTrades = trades
    .filter((t) => !t.isDraft && t.status !== "planned")
    .filter((t) => {
      const tradeTime = t.exitTime ? new Date(t.exitTime).getTime() : t.entryTime ? new Date(t.entryTime).getTime() : 0;
      return tradeTime >= startMs;
    })
    .sort((a, b) => {
      const timeA = a.exitTime ? new Date(a.exitTime).getTime() : new Date(a.entryTime || 0).getTime();
      const timeB = b.exitTime ? new Date(b.exitTime).getTime() : new Date(b.entryTime || 0).getTime();
      return timeA - timeB;
    });

  // Calculate Starting & Current Balance
  const startingBalanceCents = config.startingBalanceCents;
  let currentBalanceCents = startingBalanceCents;
  let highWaterMarkCents = startingBalanceCents;
  let lowestBalanceCents = startingBalanceCents;

  // Track daily P&L by cycle
  const dailyPnlMap = new Map<string, number>();
  const tradingDayKeys = new Set<string>();

  for (const trade of validTrades) {
    const timestamp = trade.exitTime ? new Date(trade.exitTime) : new Date(trade.entryTime || 0);
    const cycleKey = getTradingCycleKey(timestamp, timezone, resetHour);
    tradingDayKeys.add(cycleKey);

    const prevDaily = dailyPnlMap.get(cycleKey) || 0;
    dailyPnlMap.set(cycleKey, prevDaily + trade.netPnlCents);

    currentBalanceCents += trade.netPnlCents;
    if (currentBalanceCents > highWaterMarkCents) {
      highWaterMarkCents = currentBalanceCents;
    }
    if (currentBalanceCents < lowestBalanceCents) {
      lowestBalanceCents = currentBalanceCents;
    }
  }

  const netProfitCents = currentBalanceCents - startingBalanceCents;

  // Effective Limits
  const profitTargetCents = config.profitTargetCents ?? null;

  let dailyLossLimitCents: number | null = null;
  if (config.dailyLossLimitCents) {
    dailyLossLimitCents = config.dailyLossLimitCents;
  } else if (config.dailyLossLimitPct && config.dailyLossLimitPct > 0) {
    dailyLossLimitCents = Math.round(startingBalanceCents * (config.dailyLossLimitPct / 100));
  }

  let maxDrawdownLimitCents: number | null = null;
  if (config.maxDrawdownCents) {
    maxDrawdownLimitCents = config.maxDrawdownCents;
  } else if (config.maxDrawdownPct && config.maxDrawdownPct > 0) {
    maxDrawdownLimitCents = Math.round(startingBalanceCents * (config.maxDrawdownPct / 100));
  }

  // Today's Trading Cycle Metrics
  const currentCycleKey = getTradingCycleKey(now, timezone, resetHour);
  const todayPnlCents = dailyPnlMap.get(currentCycleKey) || 0;
  const todayLossCents = todayPnlCents < 0 ? Math.abs(todayPnlCents) : 0;

  let dailyLossUsedPct: number | null = null;
  let dailyLossBreached = false;
  if (dailyLossLimitCents && dailyLossLimitCents > 0) {
    dailyLossUsedPct = Math.round((todayLossCents / dailyLossLimitCents) * 100);
    dailyLossBreached = todayLossCents >= dailyLossLimitCents;
  }

  // Drawdown Calculation
  let currentDrawdownCents = 0;
  if (drawdownType === "trailing") {
    currentDrawdownCents = Math.max(0, highWaterMarkCents - currentBalanceCents);
  } else {
    currentDrawdownCents = Math.max(0, startingBalanceCents - currentBalanceCents);
  }

  let drawdownUsedPct: number | null = null;
  let drawdownBreached = false;
  if (maxDrawdownLimitCents && maxDrawdownLimitCents > 0) {
    drawdownUsedPct = Math.round((currentDrawdownCents / maxDrawdownLimitCents) * 100);
    drawdownBreached = currentDrawdownCents >= maxDrawdownLimitCents;
  }

  // Profit Target Progress
  let profitTargetProgressPct: number | null = null;
  let profitTargetReached = false;
  if (profitTargetCents && profitTargetCents > 0) {
    profitTargetProgressPct = Math.round((netProfitCents / profitTargetCents) * 100);
    profitTargetReached = netProfitCents >= profitTargetCents;
  }

  // Trading Days
  const tradingDaysCount = tradingDayKeys.size;
  const minTradingDays = config.minTradingDays ?? null;
  const minDaysMet = minTradingDays ? tradingDaysCount >= minTradingDays : true;

  // Consistency Metric (Single-day profit dominance or configured rule)
  const consistencyRuleType = config.consistencyRuleType ?? (config.consistencyThresholdPct ? "single_day_max" : "none");
  const consistencyThresholdPct = config.consistencyThresholdPct ?? null;

  let bestDayProfitCents = 0;
  for (const dayPnl of dailyPnlMap.values()) {
    if (dayPnl > bestDayProfitCents) {
      bestDayProfitCents = dayPnl;
    }
  }

  let bestDayPctOfTotal: number | null = null;
  if (netProfitCents > 0 && bestDayProfitCents > 0) {
    bestDayPctOfTotal = Math.round((bestDayProfitCents / netProfitCents) * 100);
  }

  let consistencyBreached = false;
  let consistencyStatus: "satisfied" | "at_risk" | "breached" | "unconfigured" = "unconfigured";

  if (consistencyRuleType !== "none" && consistencyThresholdPct != null && consistencyThresholdPct > 0) {
    if (bestDayPctOfTotal !== null) {
      if (bestDayPctOfTotal > consistencyThresholdPct) {
        consistencyBreached = true;
        consistencyStatus = "breached";
      } else if (bestDayPctOfTotal >= consistencyThresholdPct * 0.85) {
        consistencyStatus = "at_risk";
      } else {
        consistencyStatus = "satisfied";
      }
    } else {
      consistencyStatus = "satisfied";
    }
  }

  const consistencyAction = config.consistencyAction ?? "dilution_required";

  // Determine Overall Status
  let status: "safe" | "approaching_limit" | "at_risk" | "breached" | "passed" = "safe";
  let statusReason = "All challenge parameters within normal boundaries.";

  if (dailyLossBreached) {
    status = "breached";
    statusReason = `Daily loss limit of $${((dailyLossLimitCents || 0) / 100).toFixed(2)} was breached.`;
  } else if (drawdownBreached) {
    status = "breached";
    statusReason = `Maximum ${drawdownType} drawdown limit of $${((maxDrawdownLimitCents || 0) / 100).toFixed(2)} was breached.`;
  } else if (consistencyBreached && consistencyAction === "hard_breach") {
    status = "breached";
    statusReason = `Consistency rule hard breach: single-day profit made up ${bestDayPctOfTotal}% of total profit (exceeded ${consistencyThresholdPct}% limit). Challenge failed.`;
  } else if (profitTargetReached && minDaysMet) {
    if (consistencyBreached) {
      if (consistencyAction === "warning") {
        status = "passed";
        statusReason = `Target profit achieved, minimum trading days fulfilled. (Note: Single-day profit concentration was ${bestDayPctOfTotal}% vs ${consistencyThresholdPct}% informational limit).`;
      } else if (consistencyAction === "payout_restricted") {
        status = "at_risk";
        statusReason = `Profit target achieved, but passing and payout eligibility restricted due to profit concentration (${bestDayPctOfTotal}% vs ${consistencyThresholdPct}% limit).`;
      } else {
        // dilution_required / soft_rule
        status = "at_risk";
        statusReason = `Profit target achieved, but single-day profit (${bestDayPctOfTotal}%) exceeds consistency limit (${consistencyThresholdPct}%). Dilution required: continue trading on subsequent days to dilute and satisfy consistency.`;
      }
    } else {
      status = "passed";
      statusReason = "Target profit achieved, minimum trading days fulfilled, and rules respected.";
    }
  } else if (consistencyBreached) {
    if (consistencyAction === "warning") {
      status = "safe";
      statusReason = `Parameters within normal boundaries. Note: Single-day profit reached ${bestDayPctOfTotal}% of total (informational warning).`;
    } else {
      status = "at_risk";
      statusReason = `Single-day profit makes up ${bestDayPctOfTotal}% of total profit (exceeds ${consistencyThresholdPct}% consistency limit). Additional trading days required to dilute best day.`;
    }
  } else if (
    (dailyLossUsedPct !== null && dailyLossUsedPct >= 90) ||
    (drawdownUsedPct !== null && drawdownUsedPct >= 90) ||
    consistencyStatus === "at_risk"
  ) {
    status = "at_risk";
    statusReason = consistencyStatus === "at_risk"
      ? `Approaching consistency limit: single-day profit is ${bestDayPctOfTotal}% (threshold: ${consistencyThresholdPct}%).`
      : "Critical: Within 10% of maximum loss or drawdown boundary.";
  } else if (
    (dailyLossUsedPct !== null && dailyLossUsedPct >= 75) ||
    (drawdownUsedPct !== null && drawdownUsedPct >= 75)
  ) {
    status = "approaching_limit";
    statusReason = "Caution: More than 75% of allowable risk buffer consumed.";
  }

  const remainingDailyLossCents =
    dailyLossLimitCents !== null ? Math.max(0, dailyLossLimitCents - todayLossCents) : null;
  const remainingDrawdownCents =
    maxDrawdownLimitCents !== null ? Math.max(0, maxDrawdownLimitCents - currentDrawdownCents) : null;

  return {
    startingBalanceCents,
    currentBalanceCents,
    netProfitCents,
    profitTargetCents,
    profitTargetProgressPct,
    profitTargetReached,
    dailyLossLimitCents,
    todayPnlCents,
    todayLossCents,
    remainingDailyLossCents,
    dailyLossUsedPct,
    dailyLossBreached,
    cycleResetTime: `${String(resetHour).padStart(2, "0")}:00 ${timezone}`,
    maxDrawdownLimitCents,
    drawdownType,
    highWaterMarkCents,
    currentDrawdownCents,
    remainingDrawdownCents,
    drawdownUsedPct,
    drawdownBreached,
    minTradingDays,
    tradingDaysCount,
    minDaysMet,
    consistencyRuleType,
    consistencyThresholdPct,
    consistencyAction,
    bestDayProfitCents,
    bestDayPctOfTotal,
    consistencyBreached,
    consistencyStatus,
    status,
    statusReason,
  };
}

