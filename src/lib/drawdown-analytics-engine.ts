/**
 * AlphaPips — Historical Equity & Drawdown Analytics Engine
 *
 * Computes balance curve, peak-to-trough drawdowns, recovery periods,
 * underwater durations, losing streak distributions, and risk per trade.
 *
 * Governing Specification: five-phase-upgrade.md § C5
 */

import { formatSignedCents } from "./money";

export interface DrawdownCurvePoint {
  tradeId: string;
  exitTime: string;
  tradePnlCents: number;
  cumulativeBalanceCents: number;
  peakBalanceCents: number;
  drawdownCents: number;
  drawdownPct: number;
  isUnderwater: boolean;
}

export interface LosingStreakSegment {
  startIndex: number;
  endIndex: number;
  tradeCount: number;
  totalLossCents: number;
  startDate: string;
  endDate: string;
  trades: string[];
}

export interface DrawdownReport {
  startingBalanceCents: number | null;
  currentBalanceCents: number | null;
  peakBalanceCents: number | null;
  currentDrawdownCents: number | null;
  currentDrawdownPct: number | null;
  maxDrawdownCents: number | null;
  maxDrawdownPct: number | null;
  maxDrawdownDurationTrades: number;
  longestUnderwaterDays: number;
  averageDrawdownRecoveryTrades: number;
  isCurrentlyUnderwater: boolean;
  curve: DrawdownCurvePoint[];
  losingStreaks: LosingStreakSegment[];
  dailyLossDistribution: {
    bracket: string;
    count: number;
    totalLossCents: number;
  }[];
  normalizedLossDistribution?: {
    bracket: string;
    count: number;
    pctOfLosingTrades: number;
  }[];
  isBalanceEstimated: boolean;
  currencyExplanation: string;
}

export interface TradeDrawdownInput {
  id: string;
  netPnlCents: number;
  exitTime: string | Date | null;
  status: string;
  plannedRiskAmountCents?: number | null;
}

export function computeDrawdownAnalytics(
  trades: TradeDrawdownInput[],
  startingBalanceCents: number | null,
  accountCurrency: string = "USD",
  isMultiCurrency: boolean = false,
): DrawdownReport {
  // Sort trades strictly by chronological exit time
  const closedTrades = [...trades]
    .filter((t) => t.exitTime != null && Number.isFinite(t.netPnlCents))
    .sort((a, b) => new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime());

  if (closedTrades.length === 0 || startingBalanceCents == null || isMultiCurrency) {
    const reason = isMultiCurrency
      ? "Multi-account aggregation contains mixed currencies without synchronized spot exchange rates."
      : startingBalanceCents == null
        ? "Account starting balance is unrecorded. Drawdown percentages cannot be safely calculated without a capital baseline."
        : "No closed trades with exit timestamps recorded in this period.";

    return {
      startingBalanceCents: startingBalanceCents ?? null,
      currentBalanceCents: null,
      peakBalanceCents: null,
      currentDrawdownCents: null,
      currentDrawdownPct: null,
      maxDrawdownCents: null,
      maxDrawdownPct: null,
      maxDrawdownDurationTrades: 0,
      longestUnderwaterDays: 0,
      averageDrawdownRecoveryTrades: 0,
      isCurrentlyUnderwater: false,
      curve: [],
      losingStreaks: [],
      dailyLossDistribution: [],
      isBalanceEstimated: true,
      currencyExplanation: reason,
    };
  }

  let runningBalance = startingBalanceCents;
  let peakBalance = startingBalanceCents;
  let maxDdCents = 0;
  let maxDdPct = 0;

  const curve: DrawdownCurvePoint[] = [];
  let underwaterStartTimestamp: number | null = null;
  let maxUnderwaterMs = 0;
  let currentUnderwaterMs = 0;

  let currentDrawdownTradesCount = 0;
  let maxDrawdownTradesCount = 0;
  const recoveryDurations: number[] = [];

  for (let i = 0; i < closedTrades.length; i++) {
    const t = closedTrades[i];
    runningBalance += t.netPnlCents;
    const exitTs = new Date(t.exitTime!).getTime();

    if (runningBalance > peakBalance) {
      if (underwaterStartTimestamp !== null) {
        const periodMs = exitTs - underwaterStartTimestamp;
        if (periodMs > maxUnderwaterMs) maxUnderwaterMs = periodMs;
        recoveryDurations.push(currentDrawdownTradesCount);
        underwaterStartTimestamp = null;
        currentDrawdownTradesCount = 0;
      }
      peakBalance = runningBalance;
    } else if (runningBalance < peakBalance) {
      if (underwaterStartTimestamp === null) {
        underwaterStartTimestamp = exitTs;
      }
      currentDrawdownTradesCount++;
    }

    const ddCents = Math.max(0, peakBalance - runningBalance);
    const ddPct = peakBalance > 0 ? (ddCents / peakBalance) * 100 : 0;

    if (ddCents > maxDdCents) maxDdCents = ddCents;
    if (ddPct > maxDdPct) {
      maxDdPct = ddPct;
      maxDrawdownTradesCount = currentDrawdownTradesCount;
    }

    curve.push({
      tradeId: t.id,
      exitTime: new Date(t.exitTime!).toISOString(),
      tradePnlCents: t.netPnlCents,
      cumulativeBalanceCents: runningBalance,
      peakBalanceCents: peakBalance,
      drawdownCents: ddCents,
      drawdownPct: +ddPct.toFixed(2),
      isUnderwater: runningBalance < peakBalance,
    });
  }

  if (underwaterStartTimestamp !== null) {
    const lastTs = new Date(closedTrades[closedTrades.length - 1].exitTime!).getTime();
    currentUnderwaterMs = lastTs - underwaterStartTimestamp;
    if (currentUnderwaterMs > maxUnderwaterMs) maxUnderwaterMs = currentUnderwaterMs;
  }

  // Losing streak detection
  const losingStreaks: LosingStreakSegment[] = [];
  let currentStreak: { startIndex: number; trades: string[]; totalLoss: number; startTs: string; endTs: string } | null = null;

  for (let i = 0; i < closedTrades.length; i++) {
    const t = closedTrades[i];
    if (t.netPnlCents < 0) {
      if (!currentStreak) {
        currentStreak = {
          startIndex: i,
          trades: [t.id],
          totalLoss: t.netPnlCents,
          startTs: new Date(t.exitTime!).toISOString(),
          endTs: new Date(t.exitTime!).toISOString(),
        };
      } else {
        currentStreak.trades.push(t.id);
        currentStreak.totalLoss += t.netPnlCents;
        currentStreak.endTs = new Date(t.exitTime!).toISOString();
      }
    } else {
      if (currentStreak && currentStreak.trades.length >= 2) {
        losingStreaks.push({
          startIndex: currentStreak.startIndex,
          endIndex: i - 1,
          tradeCount: currentStreak.trades.length,
          totalLossCents: currentStreak.totalLoss,
          startDate: currentStreak.startTs,
          endDate: currentStreak.endTs,
          trades: currentStreak.trades,
        });
      }
      currentStreak = null;
    }
  }

  if (currentStreak && currentStreak.trades.length >= 2) {
    losingStreaks.push({
      startIndex: currentStreak.startIndex,
      endIndex: closedTrades.length - 1,
      tradeCount: currentStreak.trades.length,
      totalLossCents: currentStreak.totalLoss,
      startDate: currentStreak.startTs,
      endDate: currentStreak.endTs,
      trades: currentStreak.trades,
    });
  }

  // Daily loss brackets (<$100, $100-$500, $500-$1000, >$1000)
  const lossTrades = closedTrades.filter((t) => t.netPnlCents < 0);
  const brackets = [
    { label: "< $100", min: 0, max: 10_000 },
    { label: "$100 – $500", min: 10_000, max: 50_000 },
    { label: "$500 – $1,000", min: 50_000, max: 100_000 },
    { label: "> $1,000", min: 100_000, max: Infinity },
  ];

  const dailyLossDistribution = brackets.map((b) => {
    const matching = lossTrades.filter((t) => {
      const absLoss = Math.abs(t.netPnlCents);
      return absLoss >= b.min && absLoss < b.max;
    });
    return {
      bracket: `${b.label} ${accountCurrency}`,
      count: matching.length,
      totalLossCents: matching.reduce((s, t) => s + t.netPnlCents, 0),
    };
  });

  // Normalized % of account capital loss brackets (independent of fiat currency)
  const normBrackets = [
    { label: "< 0.5% Capital", minPct: 0, maxPct: 0.005 },
    { label: "0.5% – 1.0% Capital", minPct: 0.005, maxPct: 0.01 },
    { label: "1.0% – 2.0% Capital", minPct: 0.01, maxPct: 0.02 },
    { label: "> 2.0% Capital", minPct: 0.02, maxPct: Infinity },
  ];

  const normalizedLossDistribution = startingBalanceCents > 0
    ? normBrackets.map((nb) => {
        const matching = lossTrades.filter((t) => {
          const lossPct = Math.abs(t.netPnlCents) / startingBalanceCents;
          return lossPct >= nb.minPct && lossPct < nb.maxPct;
        });
        return {
          bracket: nb.label,
          count: matching.length,
          pctOfLosingTrades: lossTrades.length > 0 ? Math.round((matching.length / lossTrades.length) * 100) : 0,
        };
      })
    : undefined;

  const avgRecovery = recoveryDurations.length > 0
    ? Math.round(recoveryDurations.reduce((a, b) => a + b, 0) / recoveryDurations.length)
    : 0;

  const currentDdCents = Math.max(0, peakBalance - runningBalance);
  const currentDdPct = peakBalance > 0 ? (currentDdCents / peakBalance) * 100 : 0;

  return {
    startingBalanceCents,
    currentBalanceCents: runningBalance,
    peakBalanceCents: peakBalance,
    currentDrawdownCents: currentDdCents,
    currentDrawdownPct: +currentDdPct.toFixed(2),
    maxDrawdownCents: maxDdCents,
    maxDrawdownPct: +maxDdPct.toFixed(2),
    maxDrawdownDurationTrades: maxDrawdownTradesCount,
    longestUnderwaterDays: Math.round(maxUnderwaterMs / (1000 * 60 * 60 * 24)),
    averageDrawdownRecoveryTrades: avgRecovery,
    isCurrentlyUnderwater: runningBalance < peakBalance,
    curve,
    losingStreaks: losingStreaks.sort((a, b) => a.totalLossCents - b.totalLossCents), // Largest losses first
    dailyLossDistribution,
    normalizedLossDistribution,
    isBalanceEstimated: false,
    currencyExplanation: `Calculated from initial balance ${formatSignedCents(startingBalanceCents).text} and historical realized trade closures in ${accountCurrency}. Note: Unrealized equity fluctuations and manual external deposits/withdrawals are not included.`,
  };
}
