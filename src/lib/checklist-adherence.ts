/**
 * AlphaPips — Checklist Adherence Domain Module
 *
 * Calculates true checklist adherence from actual recorded checklist answers
 * on individual trades, strictly decoupled from strategy win rate.
 *
 * Formula:
 *   Adherence % = (Completed applicable required checklist items) / (Total applicable required checklist items) * 100
 *
 * Handles:
 *   - Required vs optional checklist items
 *   - Completed vs incomplete items
 *   - Missing checklist responses (flagged as missing data, not counted as completed)
 *   - Trades without an associated checklist or strategy
 *   - Strategy versioning: respects the checklist rules of each trade's recorded StrategyVersion
 */

import { ChecklistItem, parseAnswers, extractChecklist } from "./checklist-evaluation";

export interface TradeChecklistRecord {
  id: string;
  strategyId: string | null;
  strategyName?: string | null;
  strategyVersionId: string | null;
  strategyVersionLabel?: string | null;
  rulesJson?: string | null;
  rawAnswersJson?: string | null;
  outcome: string; // win | loss | breakeven | open | etc.
  netPnlCents?: number;
  actualR?: string | null;
}

export interface StrategyVersionAdherence {
  versionId: string;
  versionLabel: string;
  evaluatedTrades: number;
  totalTrades: number;
  missingDataTrades: number;
  completedRequiredItems: number;
  totalRequiredItems: number;
  adherencePct: number | null; // 0..100 or null if no required items or 0 evaluated trades
  winRate: number | null; // 0..1 or null (independent metric!)
}

export interface StrategyChecklistAdherence {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  evaluatedTrades: number;
  missingDataTrades: number;
  completedRequiredItems: number;
  totalRequiredItems: number;
  adherencePct: number | null; // 0..100 or null if insufficient data
  winRate: number | null; // 0..1 or null (completely independent!)
  wins: number;
  losses: number;
  breakevens: number;
  netPnlCents: number;
  avgR: string | null;
  versions: StrategyVersionAdherence[];
}

export interface ChecklistAdherenceSummary {
  overallAdherencePct: number | null;
  totalTrades: number;
  totalEvaluatedTrades: number;
  totalMissingDataTrades: number;
  totalCompletedRequiredItems: number;
  totalApplicableRequiredItems: number;
  strategies: StrategyChecklistAdherence[];
}

/**
 * Calculates checklist adherence for a single trade given its checklist definition
 * and recorded answers.
 */
export function evaluateTradeAdherence(
  items: ChecklistItem[],
  rawAnswersJson: string | null | undefined
): {
  hasRecordedAnswers: boolean;
  requiredTotal: number;
  requiredCompleted: number;
  optionalTotal: number;
  optionalCompleted: number;
} {
  if (!rawAnswersJson || rawAnswersJson.trim() === "" || rawAnswersJson === "{}") {
    const requiredTotal = items.filter((i) => i.required).length;
    return {
      hasRecordedAnswers: false,
      requiredTotal,
      requiredCompleted: 0,
      optionalTotal: items.filter((i) => !i.required).length,
      optionalCompleted: 0,
    };
  }

  const answers = parseAnswers(rawAnswersJson);
  const hasRecordedAnswers = Object.keys(answers).length > 0;

  let requiredTotal = 0;
  let requiredCompleted = 0;
  let optionalTotal = 0;
  let optionalCompleted = 0;

  for (const item of items) {
    const isChecked = answers[item.id]?.checked === true;
    if (item.required) {
      requiredTotal++;
      if (isChecked) requiredCompleted++;
    } else {
      optionalTotal++;
      if (isChecked) optionalCompleted++;
    }
  }

  return {
    hasRecordedAnswers,
    requiredTotal,
    requiredCompleted,
    optionalTotal,
    optionalCompleted,
  };
}

/**
 * Computes aggregate checklist adherence across a set of trades, grouped by strategy.
 * Win rate is computed strictly independently from trade outcomes.
 */
export function computeChecklistAdherence(
  trades: TradeChecklistRecord[],
  strategyMetaMap?: Map<string, { name: string; versions: Map<string, { label: string; rulesJson: string }> }>
): ChecklistAdherenceSummary {
  const strategyBuckets = new Map<string, TradeChecklistRecord[]>();

  for (const trade of trades) {
    const sId = trade.strategyId || "__none__";
    const bucket = strategyBuckets.get(sId) || [];
    bucket.push(trade);
    strategyBuckets.set(sId, bucket);
  }

  let overallCompletedRequired = 0;
  let overallTotalRequired = 0;
  let overallEvaluatedTrades = 0;
  let overallMissingTrades = 0;

  const strategies: StrategyChecklistAdherence[] = [];

  for (const [strategyId, stratTrades] of strategyBuckets.entries()) {
    const sMeta = strategyMetaMap?.get(strategyId);
    const strategyName = strategyId === "__none__" 
      ? "No Strategy / Unassigned" 
      : (sMeta?.name || stratTrades[0]?.strategyName || "Unknown Strategy");

    let stratCompletedRequired = 0;
    let stratTotalRequired = 0;
    let stratEvaluatedTrades = 0;
    let stratMissingTrades = 0;

    let wins = 0;
    let losses = 0;
    let breakevens = 0;
    let netPnlCents = 0;
    const rValues: number[] = [];

    // Group by version
    const versionBuckets = new Map<string, TradeChecklistRecord[]>();

    for (const t of stratTrades) {
      // P&L and Win Rate
      if (t.netPnlCents != null) netPnlCents += t.netPnlCents;
      if (t.outcome === "win") wins++;
      else if (t.outcome === "loss") losses++;
      else if (t.outcome === "breakeven") breakevens++;

      if (t.actualR != null && t.actualR !== "") {
        const rNum = Number(t.actualR);
        if (Number.isFinite(rNum)) rValues.push(rNum);
      }

      const vId = t.strategyVersionId || "__none__";
      const vBucket = versionBuckets.get(vId) || [];
      vBucket.push(t);
      versionBuckets.set(vId, vBucket);

      // Determine checklist items: prefer version's rulesJson from meta or trade
      let rulesJson = t.rulesJson;
      if (!rulesJson && sMeta && t.strategyVersionId) {
        rulesJson = sMeta.versions.get(t.strategyVersionId)?.rulesJson;
      }

      const items = extractChecklist(rulesJson);
      const evalResult = evaluateTradeAdherence(items, t.rawAnswersJson);

      if (evalResult.hasRecordedAnswers && evalResult.requiredTotal > 0) {
        stratEvaluatedTrades++;
        stratCompletedRequired += evalResult.requiredCompleted;
        stratTotalRequired += evalResult.requiredTotal;
      } else {
        stratMissingTrades++;
      }
    }

    // Version level stats
    const versions: StrategyVersionAdherence[] = [];
    for (const [vId, vTrades] of versionBuckets.entries()) {
      let vCompleted = 0;
      let vTotalReq = 0;
      let vEvaluated = 0;
      let vMissing = 0;
      let vWins = 0;
      let vLosses = 0;

      const vMeta = sMeta?.versions.get(vId);
      const versionLabel = vId === "__none__" 
        ? "Unversioned" 
        : (vMeta?.label || vTrades[0]?.strategyVersionLabel || "v1.0");

      for (const vt of vTrades) {
        if (vt.outcome === "win") vWins++;
        else if (vt.outcome === "loss") vLosses++;

        let rulesJson = vt.rulesJson;
        if (!rulesJson && vMeta) {
          rulesJson = vMeta.rulesJson;
        }
        const items = extractChecklist(rulesJson);
        const res = evaluateTradeAdherence(items, vt.rawAnswersJson);
        if (res.hasRecordedAnswers && res.requiredTotal > 0) {
          vEvaluated++;
          vCompleted += res.requiredCompleted;
          vTotalReq += res.requiredTotal;
        } else {
          vMissing++;
        }
      }

      const vWinRate = (vWins + vLosses > 0) ? Math.round((vWins / (vWins + vLosses)) * 1000) / 1000 : null;
      const vAdherence = (vTotalReq > 0 && vEvaluated > 0) ? Math.round((vCompleted / vTotalReq) * 1000) / 10 : null;

      versions.push({
        versionId: vId,
        versionLabel,
        evaluatedTrades: vEvaluated,
        totalTrades: vTrades.length,
        missingDataTrades: vMissing,
        completedRequiredItems: vCompleted,
        totalRequiredItems: vTotalReq,
        adherencePct: vAdherence,
        winRate: vWinRate,
      });
    }

    const stratAdherence = (stratTotalRequired > 0 && stratEvaluatedTrades > 0)
      ? Math.round((stratCompletedRequired / stratTotalRequired) * 1000) / 10
      : null;

    const stratWinRate = (wins + losses > 0)
      ? Math.round((wins / (wins + losses)) * 1000) / 1000
      : null;

    const avgR = rValues.length > 0
      ? (rValues.reduce((s, r) => s + r, 0) / rValues.length).toFixed(2)
      : null;

    strategies.push({
      strategyId,
      strategyName,
      totalTrades: stratTrades.length,
      evaluatedTrades: stratEvaluatedTrades,
      missingDataTrades: stratMissingTrades,
      completedRequiredItems: stratCompletedRequired,
      totalRequiredItems: stratTotalRequired,
      adherencePct: stratAdherence,
      winRate: stratWinRate,
      wins,
      losses,
      breakevens,
      netPnlCents,
      avgR,
      versions,
    });

    overallCompletedRequired += stratCompletedRequired;
    overallTotalRequired += stratTotalRequired;
    overallEvaluatedTrades += stratEvaluatedTrades;
    overallMissingTrades += stratMissingTrades;
  }

  const overallAdherencePct = (overallTotalRequired > 0 && overallEvaluatedTrades > 0)
    ? Math.round((overallCompletedRequired / overallTotalRequired) * 1000) / 10
    : null;

  return {
    overallAdherencePct,
    totalTrades: trades.length,
    totalEvaluatedTrades: overallEvaluatedTrades,
    totalMissingDataTrades: overallMissingTrades,
    totalCompletedRequiredItems: overallCompletedRequired,
    totalApplicableRequiredItems: overallTotalRequired,
    strategies: strategies.sort((a, b) => b.totalTrades - a.totalTrades),
  };
}
