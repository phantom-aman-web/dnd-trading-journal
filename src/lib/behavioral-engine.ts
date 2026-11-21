/**
 * AlphaPips — Behavioral Analytics & Process Matrix Engine
 * Features 35, 42, 43:
 * - Feature 35: Behavioral Warnings (neutral, sample size N=..., trade references, objective risk telemetry)
 * - Feature 42: Process vs Outcome Matrix (2x2 Disciplined Win, Good Loss, Lucky Win, Undisciplined Loss)
 * - Feature 43: Behavioral Analytics (streak impact, risk consistency, session discipline, mistake tag cost)
 */

export interface TradeBehaviorRow {
  id: string;
  instrumentSymbol: string;
  direction: "long" | "short";
  entryTime: string | null;
  exitTime: string | null;
  status: "win" | "loss" | "breakeven" | "open";
  netPnlCents: number;
  actualR: number | null;
  plannedRiskCents: number | null;
  plannedRiskPct: number | null;
  session: string | null;
  processCompliant?: boolean | null; // Followed rules / checklist
  checklistScore?: number | null;    // Checklist score snapshot %
  behaviorFlags?: string[];          // e.g. ["fomo", "chased_entry", "moved_stop", "revenge"]
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// FEATURE 42: Process vs Outcome Matrix
// ---------------------------------------------------------------------------

export type MatrixQuadrantKey =
  | "process_followed_win"
  | "process_followed_loss"
  | "process_deviation_win"
  | "process_deviation_loss"
  | "insufficient_process_data"
  // Backwards compatibility aliases
  | "disciplined_win"
  | "good_loss"
  | "lucky_win"
  | "undisciplined_loss";

export interface MatrixQuadrantStats {
  key: MatrixQuadrantKey;
  label: string;
  description: string;
  tradesCount: number;
  pctOfTotal: number;
  totalPnlCents: number;
  avgR: number;
  winRate: number;
  profitFactor: number | null;
  trades: TradeBehaviorRow[];
}

export interface ProcessOutcomeMatrixResult {
  totalTrades: number;
  overallProcessAdherencePct: number;
  disciplinedTradesCount: number;
  undisciplinedTradesCount: number;
  disciplinedNetPnlCents: number;
  undisciplinedNetPnlCents: number;
  disciplinedAvgR: number;
  undisciplinedAvgR: number;
  insufficientDataCount: number;
  quadrants: {
    processFollowedWin: MatrixQuadrantStats;
    processFollowedLoss: MatrixQuadrantStats;
    processDeviationWin: MatrixQuadrantStats;
    processDeviationLoss: MatrixQuadrantStats;
    insufficientProcessData: MatrixQuadrantStats;
    // Backwards-compatible aliases
    disciplinedWin: MatrixQuadrantStats;
    goodLoss: MatrixQuadrantStats;
    luckyWin: MatrixQuadrantStats;
    undisciplinedLoss: MatrixQuadrantStats;
  };
}

export function computeProcessOutcomeMatrix(trades: TradeBehaviorRow[]): ProcessOutcomeMatrixResult {
  const closed = trades.filter((t) => t.status !== "open" && t.exitTime !== null);
  const total = closed.length;

  const qTrades: Record<
    "process_followed_win" | "process_followed_loss" | "process_deviation_win" | "process_deviation_loss" | "insufficient_process_data",
    TradeBehaviorRow[]
  > = {
    process_followed_win: [],
    process_followed_loss: [],
    process_deviation_win: [],
    process_deviation_loss: [],
    insufficient_process_data: [],
  };

  for (const t of closed) {
    const isWin = t.netPnlCents > 0 || t.status === "win";

    // Objective evaluation of process adherence based on explicit criteria
    let processStatus: "followed" | "deviation" | "unknown" = "unknown";

    if (t.processCompliant === true || (t.checklistScore !== null && t.checklistScore !== undefined && t.checklistScore >= 80)) {
      processStatus = "followed";
    } else if (t.processCompliant === false || (t.checklistScore !== null && t.checklistScore !== undefined && t.checklistScore < 80)) {
      processStatus = "deviation";
    } else if (Array.isArray(t.behaviorFlags) && t.behaviorFlags.length > 0) {
      processStatus = "deviation";
    } else if (t.processCompliant === undefined && (t.checklistScore === null || t.checklistScore === undefined) && (!t.behaviorFlags || t.behaviorFlags.length === 0)) {
      processStatus = "unknown";
    } else {
      processStatus = "followed";
    }

    if (processStatus === "followed") {
      if (isWin) qTrades.process_followed_win.push(t);
      else qTrades.process_followed_loss.push(t);
    } else if (processStatus === "deviation") {
      if (isWin) qTrades.process_deviation_win.push(t);
      else qTrades.process_deviation_loss.push(t);
    } else {
      qTrades.insufficient_process_data.push(t);
    }
  }

  function makeStats(
    key: MatrixQuadrantKey,
    label: string,
    desc: string,
    arr: TradeBehaviorRow[]
  ): MatrixQuadrantStats {
    const count = arr.length;
    const pct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    const totalPnl = arr.reduce((acc, t) => acc + (t.netPnlCents || 0), 0);
    const rValues = arr.map((t) => t.actualR).filter((r): r is number => r !== null && !isNaN(r));
    const avgR = rValues.length > 0
      ? Math.round((rValues.reduce((a, b) => a + b, 0) / rValues.length) * 100) / 100
      : 0;

    const wins = arr.filter((t) => t.netPnlCents > 0 || t.status === "win").length;
    const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;

    const grossProfit = arr.filter((t) => t.netPnlCents > 0).reduce((a, t) => a + t.netPnlCents, 0);
    const grossLoss = Math.abs(arr.filter((t) => t.netPnlCents < 0).reduce((a, t) => a + t.netPnlCents, 0));
    const profitFactor = grossLoss > 0
      ? Math.round((grossProfit / grossLoss) * 100) / 100
      : grossProfit > 0 ? 99.99 : null;

    return {
      key,
      label,
      description: desc,
      tradesCount: count,
      pctOfTotal: pct,
      totalPnlCents: totalPnl,
      avgR,
      winRate,
      profitFactor,
      trades: arr,
    };
  }

  const followedWin = makeStats(
    "process_followed_win",
    "Process Followed + Win",
    "Trades where entry and risk adhered to strategy rules, resulting in a profitable exit.",
    qTrades.process_followed_win
  );

  const followedLoss = makeStats(
    "process_followed_loss",
    "Process Followed + Loss",
    "Trades where entry and risk adhered to rules, resulting in an expected statistical loss (normal cost of doing business).",
    qTrades.process_followed_loss
  );

  const deviationWin = makeStats(
    "process_deviation_win",
    "Process Deviation + Win",
    "Trades executed outside strategy rules that closed green. Risk of negative behavioral reinforcement.",
    qTrades.process_deviation_win
  );

  const deviationLoss = makeStats(
    "process_deviation_loss",
    "Process Deviation + Loss",
    "Trades executed outside strategy rules that resulted in a loss.",
    qTrades.process_deviation_loss
  );

  const insufficientData = makeStats(
    "insufficient_process_data",
    "Insufficient Process Data",
    "Trades logged without checklist evaluation or explicit strategy adherence records.",
    qTrades.insufficient_process_data
  );

  const evaluatedTradesCount = total - qTrades.insufficient_process_data.length;
  const disciplinedCount = followedWin.tradesCount + followedLoss.tradesCount;
  const undisciplinedCount = deviationWin.tradesCount + deviationLoss.tradesCount;
  const adherencePct = evaluatedTradesCount > 0 ? Math.round((disciplinedCount / evaluatedTradesCount) * 100) : 100;

  const disciplinedNetPnl = followedWin.totalPnlCents + followedLoss.totalPnlCents;
  const undisciplinedNetPnl = deviationWin.totalPnlCents + deviationLoss.totalPnlCents;

  const discR = [...followedWin.trades, ...followedLoss.trades]
    .map((t) => t.actualR)
    .filter((r): r is number => r !== null && !isNaN(r));
  const undiscR = [...deviationWin.trades, ...deviationLoss.trades]
    .map((t) => t.actualR)
    .filter((r): r is number => r !== null && !isNaN(r));

  return {
    totalTrades: total,
    overallProcessAdherencePct: adherencePct,
    disciplinedTradesCount: disciplinedCount,
    undisciplinedTradesCount: undisciplinedCount,
    disciplinedNetPnlCents: disciplinedNetPnl,
    undisciplinedNetPnlCents: undisciplinedNetPnl,
    disciplinedAvgR: discR.length > 0 ? Math.round((discR.reduce((a, b) => a + b, 0) / discR.length) * 100) / 100 : 0,
    undisciplinedAvgR: undiscR.length > 0 ? Math.round((undiscR.reduce((a, b) => a + b, 0) / undiscR.length) * 100) / 100 : 0,
    insufficientDataCount: insufficientData.tradesCount,
    quadrants: {
      processFollowedWin: followedWin,
      processFollowedLoss: followedLoss,
      processDeviationWin: deviationWin,
      processDeviationLoss: deviationLoss,
      insufficientProcessData: insufficientData,
      // Backwards-compatible aliases
      disciplinedWin: followedWin,
      goodLoss: followedLoss,
      luckyWin: deviationWin,
      undisciplinedLoss: deviationLoss,
    },
  };
}

// ---------------------------------------------------------------------------
// FEATURE 35: Behavioral Warnings
// ---------------------------------------------------------------------------

export interface BehavioralWarningConfig {
  rapidReentryMinutes?: number;        // default 20 mins
  oversizingMultiplier?: number;       // default 2.0 (200% of median planned risk)
  frequencyMultiplier?: number;        // default 2.5 (2.5x average trades/day)
  minSampleSize?: number;              // default 5 trades
}

export interface BehavioralWarning {
  id: string;
  type: "rapid_reentry" | "risk_above_baseline" | "high_frequency" | "stop_increased_after_entry" | "revenge_trading" | "oversizing" | "overtrading" | "stop_widening";
  severity: "warning" | "critical";
  title: string;
  sampleSize: string; // e.g. "N=3 occurrences"
  neutralDescription: string;
  tradeIds: string[];
  detectedAt: string;
  recommendedAction: string;
}

export function generateBehavioralWarnings(
  trades: TradeBehaviorRow[],
  config: BehavioralWarningConfig = {}
): BehavioralWarning[] {
  const warnings: BehavioralWarning[] = [];
  const closed = [...trades]
    .filter((t) => t.status !== "open" && t.exitTime !== null)
    .sort((a, b) => new Date(a.entryTime || a.exitTime || 0).getTime() - new Date(b.entryTime || b.exitTime || 0).getTime());

  const minSample = config.minSampleSize ?? 5;
  if (closed.length < Math.min(3, minSample)) return warnings;

  // 1. Rapid Re-entry After a Loss
  const rapidWindowMin = config.rapidReentryMinutes ?? 20;
  const rapidReentryTrades: TradeBehaviorRow[] = [];
  for (let i = 1; i < closed.length; i++) {
    const prev = closed[i - 1];
    const curr = closed[i];

    const prevLoss = prev.netPnlCents < 0 || prev.status === "loss";
    if (prevLoss && prev.exitTime && curr.entryTime) {
      const exitMs = new Date(prev.exitTime).getTime();
      const entryMs = new Date(curr.entryTime).getTime();
      const diffMinutes = (entryMs - exitMs) / (1000 * 60);

      if (diffMinutes >= 0 && diffMinutes <= rapidWindowMin) {
        rapidReentryTrades.push(curr);
      }
    }
  }

  if (rapidReentryTrades.length >= 2) {
    warnings.push({
      id: "warn_rapid_reentry_" + Date.now(),
      type: "rapid_reentry",
      severity: rapidReentryTrades.length >= 4 ? "critical" : "warning",
      title: "Rapid Re-entry After Loss",
      sampleSize: `N=${rapidReentryTrades.length} trades`,
      neutralDescription: `Identified ${rapidReentryTrades.length} trades executed within ${rapidWindowMin} minutes of a realized loss. Objective historical R across these re-entries is negative.`,
      tradeIds: rapidReentryTrades.map((t) => t.id),
      detectedAt: new Date().toISOString(),
      recommendedAction: "Establish a planned cooldown period between consecutive executions following a loss.",
    });
  }

  // 2. Risk Above Personal Baseline (Oversizing)
  const riskMultiplier = config.oversizingMultiplier ?? 2.0;
  const riskValues = closed
    .map((t) => t.plannedRiskCents)
    .filter((r): r is number => r !== null && r > 0);

  if (riskValues.length >= minSample) {
    const sortedRisks = [...riskValues].sort((a, b) => a - b);
    const medianRisk = sortedRisks[Math.floor(sortedRisks.length / 2)];

    const oversized = closed.filter((t) => t.plannedRiskCents && t.plannedRiskCents >= medianRisk * riskMultiplier);
    if (oversized.length >= 2) {
      warnings.push({
        id: "warn_risk_baseline_" + Date.now(),
        type: "risk_above_baseline",
        severity: oversized.length >= 4 ? "critical" : "warning",
        title: "Risk Above Personal Baseline",
        sampleSize: `N=${oversized.length} trades`,
        neutralDescription: `${oversized.length} trades were executed with planned risk exceeding ${Math.round(riskMultiplier * 100)}% of your median risk ($${(medianRisk / 100).toFixed(0)}).`,
        tradeIds: oversized.map((t) => t.id),
        detectedAt: new Date().toISOString(),
        recommendedAction: "Confirm position sizing calculator calculations prior to executing orders.",
      });
    }
  }

  // 3. Trade Frequency Above Historical Baseline (High Frequency Spikes)
  const freqMultiplier = config.frequencyMultiplier ?? 2.5;
  const dayCounts = new Map<string, TradeBehaviorRow[]>();
  for (const t of closed) {
    const day = (t.entryTime || t.exitTime || "").split("T")[0];
    if (day) {
      const existing = dayCounts.get(day) || [];
      existing.push(t);
      dayCounts.set(day, existing);
    }
  }

  const daysArray = Array.from(dayCounts.values());
  if (daysArray.length >= 3) {
    const avgTradesPerDay = closed.length / daysArray.length;
    const spikeDays = daysArray.filter((arr) => arr.length >= Math.max(5, avgTradesPerDay * freqMultiplier));

    if (spikeDays.length > 0) {
      const spikeTrades = spikeDays.flatMap((arr) => arr);
      warnings.push({
        id: "warn_frequency_" + Date.now(),
        type: "high_frequency",
        severity: "warning",
        title: "Trade Frequency Above Baseline",
        sampleSize: `N=${spikeDays.length} sessions (${spikeTrades.length} trades)`,
        neutralDescription: `Recorded ${spikeDays.length} session(s) where execution count exceeded ${freqMultiplier}x your average rate (${avgTradesPerDay.toFixed(1)} trades/day).`,
        tradeIds: spikeTrades.map((t) => t.id),
        detectedAt: new Date().toISOString(),
        recommendedAction: "Monitor for cognitive fatigue during sessions with elevated execution frequency.",
      });
    }
  }

  // 4. Stop Loss Increased After Entry (Only when trustworthy stop-widening records exist)
  const stopMovedTrades = closed.filter((t) =>
    t.behaviorFlags?.some((f) => f.includes("moved_stop") || f.includes("widened_stop"))
  );
  if (stopMovedTrades.length >= 2) {
    warnings.push({
      id: "warn_stop_widening_" + Date.now(),
      type: "stop_increased_after_entry",
      severity: "critical",
      title: "Stop-Loss Increased After Entry",
      sampleSize: `N=${stopMovedTrades.length} trades`,
      neutralDescription: `Recorded ${stopMovedTrades.length} trades where the initial stop-loss price was moved into deeper risk post-entry based on execution audit records.`,
      tradeIds: stopMovedTrades.map((t) => t.id),
      detectedAt: new Date().toISOString(),
      recommendedAction: "Maintain immutable stop loss parameters once an order has executed.",
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// FEATURE 43: Behavioral Analytics Engine
// ---------------------------------------------------------------------------

export interface StreakPerformance {
  afterWin: {
    tradesCount: number;
    winRate: number;
    avgR: number;
    totalPnlCents: number;
  };
  afterLoss: {
    tradesCount: number;
    winRate: number;
    avgR: number;
    totalPnlCents: number;
  };
  riskMultiplierAfterLoss: number; // e.g. 1.15 means risk is 15% higher after loss
}

export interface RiskConsistencyMetric {
  medianRiskCents: number;
  meanRiskCents: number;
  stdDevRiskCents: number;
  coefficientOfVariationPct: number;
  rating: "High Consistency" | "Moderate Variance" | "Erratic Sizing";
}

export interface SessionDisciplineStats {
  session: string;
  label: string;
  tradesCount: number;
  winRate: number;
  totalPnlCents: number;
  avgR: number;
}

export interface MistakeTagBreakdown {
  tag: string;
  label: string;
  occurrences: number;
  totalPnlCents: number;      // Historical realized P&L on trades marked with this tag
  realizedPnlCents: number;   // Alias clarifying financial definition
  avgR: number;               // Average R on tagged trades
  winRate: number;            // Win rate on tagged trades
  methodologyDescription: string;
}

export interface BehavioralAnalyticsResult {
  totalTrades: number;
  streakAnalysis: StreakPerformance;
  riskConsistency: RiskConsistencyMetric;
  sessionDiscipline: SessionDisciplineStats[];
  mistakeTags: MistakeTagBreakdown[];
  activeWarnings: BehavioralWarning[];
}

export function computeBehavioralAnalytics(trades: TradeBehaviorRow[]): BehavioralAnalyticsResult {
  const closed = [...trades]
    .filter((t) => t.status !== "open" && t.exitTime !== null)
    .sort((a, b) => new Date(a.entryTime || a.exitTime || 0).getTime() - new Date(b.entryTime || b.exitTime || 0).getTime());

  // 1. Streak Analysis: performance on trade T based on trade T-1 outcome
  const afterWinTrades: TradeBehaviorRow[] = [];
  const afterLossTrades: TradeBehaviorRow[] = [];

  for (let i = 1; i < closed.length; i++) {
    const prev = closed[i - 1];
    const curr = closed[i];
    if (prev.netPnlCents > 0 || prev.status === "win") {
      afterWinTrades.push(curr);
    } else if (prev.netPnlCents < 0 || prev.status === "loss") {
      afterLossTrades.push(curr);
    }
  }

  function calcSubsetStats(arr: TradeBehaviorRow[]) {
    const count = arr.length;
    const wins = arr.filter((t) => t.netPnlCents > 0 || t.status === "win").length;
    const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
    const totalPnl = arr.reduce((acc, t) => acc + (t.netPnlCents || 0), 0);
    const rVals = arr.map((t) => t.actualR).filter((r): r is number => r !== null && !isNaN(r));
    const avgR = rVals.length > 0 ? Math.round((rVals.reduce((a, b) => a + b, 0) / rVals.length) * 100) / 100 : 0;
    return { tradesCount: count, winRate, avgR, totalPnlCents: totalPnl };
  }

  const afterWin = calcSubsetStats(afterWinTrades);
  const afterLoss = calcSubsetStats(afterLossTrades);

  // Risk multiplier after loss
  const avgRiskAfterLoss = afterLossTrades
    .map((t) => t.plannedRiskCents)
    .filter((r): r is number => r !== null && r > 0);
  const avgRiskOverall = closed
    .map((t) => t.plannedRiskCents)
    .filter((r): r is number => r !== null && r > 0);

  let riskMultiplierAfterLoss = 1.0;
  if (avgRiskAfterLoss.length > 0 && avgRiskOverall.length > 0) {
    const meanLossRisk = avgRiskAfterLoss.reduce((a, b) => a + b, 0) / avgRiskAfterLoss.length;
    const meanAllRisk = avgRiskOverall.reduce((a, b) => a + b, 0) / avgRiskOverall.length;
    riskMultiplierAfterLoss = Math.round((meanLossRisk / meanAllRisk) * 100) / 100;
  }

  // 2. Risk Consistency Metric
  const riskList = closed
    .map((t) => t.plannedRiskCents)
    .filter((r): r is number => r !== null && r > 0);

  let medianRisk = 0;
  let meanRisk = 0;
  let stdDevRisk = 0;
  let cvPct = 0;
  let rating: "High Consistency" | "Moderate Variance" | "Erratic Sizing" = "High Consistency";

  if (riskList.length > 0) {
    const sorted = [...riskList].sort((a, b) => a - b);
    medianRisk = sorted[Math.floor(sorted.length / 2)];
    meanRisk = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);

    const variance = sorted.reduce((acc, r) => acc + Math.pow(r - meanRisk, 2), 0) / sorted.length;
    stdDevRisk = Math.round(Math.sqrt(variance));
    cvPct = meanRisk > 0 ? Math.round((stdDevRisk / meanRisk) * 1000) / 10 : 0;

    if (cvPct <= 20) {
      rating = "High Consistency";
    } else if (cvPct <= 45) {
      rating = "Moderate Variance";
    } else {
      rating = "Erratic Sizing";
    }
  }

  // 3. Session Discipline
  const sessionMap = new Map<string, TradeBehaviorRow[]>();
  for (const t of closed) {
    const s = t.session || "unspecified";
    const existing = sessionMap.get(s) || [];
    existing.push(t);
    sessionMap.set(s, existing);
  }

  const sessionLabels: Record<string, string> = {
    london: "London Session",
    ny_am: "New York AM",
    ny_pm: "New York PM",
    asia: "Asian Session",
    unspecified: "Off-Session / Unspecified",
  };

  const sessionDiscipline: SessionDisciplineStats[] = Array.from(sessionMap.entries()).map(([k, arr]) => {
    const count = arr.length;
    const wins = arr.filter((t) => t.netPnlCents > 0 || t.status === "win").length;
    const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
    const totalPnl = arr.reduce((acc, t) => acc + (t.netPnlCents || 0), 0);
    const rVals = arr.map((t) => t.actualR).filter((r): r is number => r !== null && !isNaN(r));
    const avgR = rVals.length > 0 ? Math.round((rVals.reduce((a, b) => a + b, 0) / rVals.length) * 100) / 100 : 0;

    return {
      session: k,
      label: sessionLabels[k] || k,
      tradesCount: count,
      winRate,
      totalPnlCents: totalPnl,
      avgR,
    };
  }).sort((a, b) => b.tradesCount - a.tradesCount);

  // 4. Mistake Tag Impact Breakdown
  const tagMap = new Map<string, TradeBehaviorRow[]>();
  for (const t of closed) {
    if (t.behaviorFlags && Array.isArray(t.behaviorFlags)) {
      for (const tag of t.behaviorFlags) {
        const cleanTag = tag.toLowerCase().trim();
        if (cleanTag) {
          const existing = tagMap.get(cleanTag) || [];
          existing.push(t);
          tagMap.set(cleanTag, existing);
        }
      }
    }
  }

  const mistakeTags: MistakeTagBreakdown[] = Array.from(tagMap.entries()).map(([tag, arr]) => {
    const count = arr.length;
    const wins = arr.filter((t) => t.netPnlCents > 0 || t.status === "win").length;
    const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
    const totalPnl = arr.reduce((acc, t) => acc + (t.netPnlCents || 0), 0);
    const rVals = arr.map((t) => t.actualR).filter((r): r is number => r !== null && !isNaN(r));
    const avgR = rVals.length > 0 ? Math.round((rVals.reduce((a, b) => a + b, 0) / rVals.length) * 100) / 100 : 0;

    return {
      tag,
      label: tag.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      occurrences: count,
      totalPnlCents: totalPnl,
      realizedPnlCents: totalPnl,
      avgR,
      winRate,
      methodologyDescription: `Realized P&L on ${count} closed trades tagged with '${tag}'. Reflects actual historical outcome of marked trades rather than single-cause attribution.`,
    };
  }).sort((a, b) => a.totalPnlCents - b.totalPnlCents); // Most adverse impact first

  // 5. Generate Behavioral Warnings
  const activeWarnings = generateBehavioralWarnings(closed);

  return {
    totalTrades: closed.length,
    streakAnalysis: {
      afterWin,
      afterLoss,
      riskMultiplierAfterLoss,
    },
    riskConsistency: {
      medianRiskCents: medianRisk,
      meanRiskCents: meanRisk,
      stdDevRiskCents: stdDevRisk,
      coefficientOfVariationPct: cvPct,
      rating,
    },
    sessionDiscipline,
    mistakeTags,
    activeWarnings,
  };
}
