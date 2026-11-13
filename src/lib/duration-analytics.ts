/**
 * DnD — Time-in-Trade & Holding Duration Analytics Engine
 * Derives duration statistics and performance correlations strictly from
 * reliable entry and exit timestamps for closed positions.
 */

import { computeAggregateMetrics, type TradeMetricRow } from "./financial-engine";

export interface TradeForDuration {
  id: string;
  netPnlCents: number;
  grossPnlCents?: number;
  actualR?: string | null;
  status: string; // "win" | "loss" | "breakeven" | "open" | "planned" | "draft"
  entryTime: string | Date | null;
  exitTime: string | Date | null;
  instrumentSymbol?: string;
  direction?: string;
  isDraft?: boolean;
}

export interface DurationBucketStats {
  bucketKey: string;
  label: string;
  rangeDesc: string;
  tradesCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRatePct: number | null;
  netPnlCents: number;
  avgR: string | null;
  expectancyCents: number | null;
  profitFactor: string | null;
}

export interface TimeInTradeAnalytics {
  totalClosedAnalyzed: number;
  openExcludedCount: number;
  avgMinutes: number | null;
  medianMinutes: number | null;
  shortestMinutes: number | null;
  longestMinutes: number | null;
  winAvgMinutes: number | null;
  winMedianMinutes: number | null;
  lossAvgMinutes: number | null;
  lossMedianMinutes: number | null;
  winLossDurationRatio: number | null;
  buckets: DurationBucketStats[];
}

export const DURATION_BUCKETS = [
  { key: "under_5m", label: "Scalp (< 5m)", minMin: 0, maxMin: 5 },
  { key: "5m_to_1h", label: "Intraday Quick (5m–1h)", minMin: 5, maxMin: 60 },
  { key: "1h_to_4h", label: "Session (1h–4h)", minMin: 60, maxMin: 240 },
  { key: "4h_to_1d", label: "Day Trade (4h–24h)", minMin: 240, maxMin: 1440 },
  { key: "1d_to_1w", label: "Swing (1d–7d)", minMin: 1440, maxMin: 10080 },
  { key: "over_1w", label: "Position (> 7d)", minMin: 10080, maxMin: Infinity },
];

function calculateMedian(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function formatDurationHuman(minutes: number | null): string {
  if (minutes === null || isNaN(minutes)) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  const remHours = Math.round((minutes % 1440) / 60);
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function computeTimeInTradeAnalytics(trades: TradeForDuration[]): TimeInTradeAnalytics {
  let openExcludedCount = 0;
  const validClosed: { trade: TradeForDuration; durationMin: number }[] = [];

  for (const t of trades) {
    // Exclude drafts and planned trades
    if (t.isDraft || t.status === "planned") continue;

    // Open positions MUST BE excluded from closed duration distributions
    if (t.status === "open" || !t.exitTime) {
      openExcludedCount++;
      continue;
    }

    if (!t.entryTime) continue;

    const entryMs = new Date(t.entryTime).getTime();
    const exitMs = new Date(t.exitTime).getTime();
    if (isNaN(entryMs) || isNaN(exitMs) || exitMs < entryMs) continue;

    const durationMin = Math.round((exitMs - entryMs) / 60000);
    validClosed.push({ trade: t, durationMin });
  }

  if (validClosed.length === 0) {
    return {
      totalClosedAnalyzed: 0,
      openExcludedCount,
      avgMinutes: null,
      medianMinutes: null,
      shortestMinutes: null,
      longestMinutes: null,
      winAvgMinutes: null,
      winMedianMinutes: null,
      lossAvgMinutes: null,
      lossMedianMinutes: null,
      winLossDurationRatio: null,
      buckets: DURATION_BUCKETS.map((b) => ({
        bucketKey: b.key,
        label: b.label,
        rangeDesc: b.label,
        tradesCount: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        winRatePct: null,
        netPnlCents: 0,
        avgR: null,
        expectancyCents: null,
        profitFactor: null,
      })),
    };
  }

  const allDurations = validClosed.map((v) => v.durationMin);
  const avgMinutes = Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length);
  const medianMinutes = calculateMedian(allDurations);
  const shortestMinutes = Math.min(...allDurations);
  const longestMinutes = Math.max(...allDurations);

  const winDurations = validClosed
    .filter((v) => v.trade.status === "win" || v.trade.netPnlCents > 0)
    .map((v) => v.durationMin);

  const lossDurations = validClosed
    .filter((v) => v.trade.status === "loss" || v.trade.netPnlCents < 0)
    .map((v) => v.durationMin);

  const winAvgMinutes =
    winDurations.length > 0
      ? Math.round(winDurations.reduce((a, b) => a + b, 0) / winDurations.length)
      : null;
  const winMedianMinutes = calculateMedian(winDurations);

  const lossAvgMinutes =
    lossDurations.length > 0
      ? Math.round(lossDurations.reduce((a, b) => a + b, 0) / lossDurations.length)
      : null;
  const lossMedianMinutes = calculateMedian(lossDurations);

  const winLossDurationRatio =
    winAvgMinutes !== null && lossAvgMinutes !== null && lossAvgMinutes > 0
      ? +(winAvgMinutes / lossAvgMinutes).toFixed(2)
      : null;

  // Bucket distribution
  const buckets: DurationBucketStats[] = DURATION_BUCKETS.map((b) => {
    const bucketTrades = validClosed.filter((v) => {
      if (b.maxMin === Infinity) {
        return v.durationMin >= b.minMin;
      }
      return v.durationMin >= b.minMin && v.durationMin < b.maxMin;
    });

    const rows: TradeMetricRow[] = bucketTrades.map((v) => ({
      id: v.trade.id,
      netPnlCents: v.trade.netPnlCents,
      grossPnlCents: v.trade.grossPnlCents ?? v.trade.netPnlCents,
      actualR: v.trade.actualR ? String(v.trade.actualR) : null,
      status: "closed",
      outcome:
        v.trade.netPnlCents > 0
          ? "win"
          : v.trade.netPnlCents < 0
          ? "loss"
          : "breakeven",
      exitTime: v.trade.exitTime ? new Date(v.trade.exitTime).toISOString() : null,
      entryTime: v.trade.entryTime ? new Date(v.trade.entryTime).toISOString() : null,
      instrumentSymbol: v.trade.instrumentSymbol || "UNKNOWN",
      direction: v.trade.direction || "long",
    }));

    const agg = computeAggregateMetrics(rows, null);
    const winRatePct = agg.winRate ? Math.round(parseFloat(agg.winRate) * 100) : null;

    return {
      bucketKey: b.key,
      label: b.label,
      rangeDesc: b.label,
      tradesCount: agg.totalTrades,
      wins: agg.wins,
      losses: agg.losses,
      breakevens: agg.breakevens,
      winRatePct,
      netPnlCents: agg.netPnlCents,
      avgR: agg.avgR,
      expectancyCents: agg.expectancyCents,
      profitFactor: agg.profitFactor,
    };
  });

  return {
    totalClosedAnalyzed: validClosed.length,
    openExcludedCount,
    avgMinutes,
    medianMinutes,
    shortestMinutes,
    longestMinutes,
    winAvgMinutes,
    winMedianMinutes,
    lossAvgMinutes,
    lossMedianMinutes,
    winLossDurationRatio,
    buckets,
  };
}

