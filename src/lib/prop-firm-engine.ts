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
  resetTimezone?: string; // e.g. "America/New_York", "UTC", "Europe/London"
  resetHour?: number; // 0-23, e.g. 17 for 5:00 PM New York
  startDate: string | Date;
  endDate?: string | Date | null;
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
  dailyLossUsedPct: number | null;
  dailyLossBreached: boolean;
  cycleResetTime: string;

  // Max Drawdown
  maxDrawdownLimitCents: number | null;
  drawdownType: "static" | "trailing";
  highWaterMarkCents: number;
  currentDrawdownCents: number;
  drawdownUsedPct: number | null;
  drawdownBreached: boolean;

  // Trading Days
  minTradingDays: number | null;
  tradingDaysCount: number;
  minDaysMet: boolean;

  // Consistency (single day max profit rule)
  bestDayProfitCents: number;
  bestDayPctOfTotal: number | null;

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

  // Consistency Metric (Single-day profit dominance)
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

  // Determine Overall Status
  let status: "safe" | "approaching_limit" | "at_risk" | "breached" | "passed" = "safe";
  let statusReason = "All challenge parameters within normal boundaries.";

  if (dailyLossBreached) {
    status = "breached";
    statusReason = `Daily loss limit of $${((dailyLossLimitCents || 0) / 100).toFixed(2)} was breached.`;
  } else if (drawdownBreached) {
    status = "breached";
    statusReason = `Maximum ${drawdownType} drawdown limit of $${((maxDrawdownLimitCents || 0) / 100).toFixed(2)} was breached.`;
  } else if (
    (dailyLossUsedPct !== null && dailyLossUsedPct >= 90) ||
    (drawdownUsedPct !== null && drawdownUsedPct >= 90)
  ) {
    status = "at_risk";
    statusReason = "Critical: Within 10% of maximum loss or drawdown boundary.";
  } else if (
    (dailyLossUsedPct !== null && dailyLossUsedPct >= 75) ||
    (drawdownUsedPct !== null && drawdownUsedPct >= 75)
  ) {
    status = "approaching_limit";
    statusReason = "Caution: More than 75% of allowable risk buffer consumed.";
  } else if (profitTargetReached && minDaysMet) {
    status = "passed";
    statusReason = "Target profit achieved and minimum trading days fulfilled.";
  }

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
    dailyLossUsedPct,
    dailyLossBreached,
    cycleResetTime: `${String(resetHour).padStart(2, "0")}:00 ${timezone}`,
    maxDrawdownLimitCents,
    drawdownType,
    highWaterMarkCents,
    currentDrawdownCents,
    drawdownUsedPct,
    drawdownBreached,
    minTradingDays,
    tradingDaysCount,
    minDaysMet,
    bestDayProfitCents,
    bestDayPctOfTotal,
    status,
    statusReason,
  };
}

