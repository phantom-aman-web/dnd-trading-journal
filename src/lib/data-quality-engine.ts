/**
 * AlphaPips — Data Quality & Journal Completeness Engine
 *
 * Scans trade records to detect data hygiene issues, missing parameters,
 * potential duplicates, and computes overall journal health metrics.
 *
 * Governing Specification: five-phase-upgrade.md § C4
 */

export interface DataQualityIssue {
  tradeId: string;
  instrumentSymbol: string;
  entryDate: string | null;
  direction: string;
  category: "missing_risk" | "missing_timestamp" | "missing_strategy" | "missing_checklist" | "potential_duplicate" | "missing_notes";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel: string;
}

export interface DataQualityReport {
  totalTradesScanned: number;
  completeTradesCount: number;
  incompleteTradesCount: number;
  completenessScorePct: number;
  issuesByCategory: {
    missingRiskCount: number;
    missingTimestampCount: number;
    missingStrategyCount: number;
    missingChecklistCount: number;
    potentialDuplicatesCount: number;
    missingNotesCount: number;
  };
  issues: DataQualityIssue[];
}

export interface ScannableTradeRecord {
  id: string;
  instrumentSymbol: string;
  direction: string;
  status: string;
  accountId?: string | null;
  entryTime: string | Date | null;
  exitTime: string | Date | null;
  plannedStopPrice?: string | null;
  plannedRiskAmountCents?: number | null;
  plannedRiskPct?: string | null;
  strategyId?: string | null;
  strategyName?: string | null;
  strategyVersionId?: string | null;
  hasChecklistRules?: boolean;
  hasChecklistAnswers?: boolean;
  notes?: string | null;
  executionsCount?: number;
}

export function evaluateDataQuality(trades: ScannableTradeRecord[]): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  let completeTrades = 0;

  // Track potential duplicate candidates (same symbol, same direction, within 60s)
  const sortedByTime = [...trades]
    .filter((t) => t.entryTime != null)
    .sort((a, b) => new Date(a.entryTime!).getTime() - new Date(b.entryTime!).getTime());

  const duplicateCandidateIds = new Set<string>();
  for (let i = 0; i < sortedByTime.length - 1; i++) {
    const t1 = sortedByTime[i];
    const t2 = sortedByTime[i + 1];
    const sameAccount = !t1.accountId || !t2.accountId || t1.accountId === t2.accountId;
    if (
      t1.instrumentSymbol === t2.instrumentSymbol &&
      t1.direction === t2.direction &&
      sameAccount
    ) {
      const timeDiffMs = Math.abs(
        new Date(t1.entryTime!).getTime() - new Date(t2.entryTime!).getTime()
      );
      if (timeDiffMs <= 60_000) {
        duplicateCandidateIds.add(t2.id);
        issues.push({
          tradeId: t2.id,
          instrumentSymbol: t2.instrumentSymbol,
          entryDate: t2.entryTime ? new Date(t2.entryTime).toISOString() : null,
          direction: t2.direction,
          category: "potential_duplicate",
          severity: "low",
          title: "Potential Duplicate Trade",
          description: `Logged within ${Math.round(timeDiffMs / 1000)}s of trade ${t1.id.slice(0, 8)} with matching symbol & direction. If this was an intentional scale-in or laddered execution, no action is required.`,
          actionLabel: "Review in Trade Detail",
        });
      }
    }
  }

  for (const t of trades) {
    let tradeHasIssue = false;
    const entryDateStr = t.entryTime ? new Date(t.entryTime).toISOString() : null;

    // 1. Missing Risk / Stop Loss
    const hasRisk = (t.plannedRiskAmountCents != null && t.plannedRiskAmountCents > 0) ||
      (t.plannedStopPrice != null && t.plannedStopPrice.trim() !== "");
    if (!hasRisk && t.status !== "planned") {
      tradeHasIssue = true;
      issues.push({
        tradeId: t.id,
        instrumentSymbol: t.instrumentSymbol,
        entryDate: entryDateStr,
        direction: t.direction,
        category: "missing_risk",
        severity: "high",
        title: "Missing Stop-Loss or Risk Budget",
        description: "Trade logged without stop-loss price or monetary risk, preventing accurate R-multiple calculation.",
        actionLabel: "Add Risk in Trade Detail",
      });
    }

    // 2. Missing Timestamp on Closed Positions
    const sLower = (t.status || "").toLowerCase();
    if ((sLower === "closed" || sLower === "win" || sLower === "loss" || sLower === "breakeven") && !t.exitTime) {
      tradeHasIssue = true;
      issues.push({
        tradeId: t.id,
        instrumentSymbol: t.instrumentSymbol,
        entryDate: entryDateStr,
        direction: t.direction,
        category: "missing_timestamp",
        severity: "high",
        title: "Missing Exit Timestamp",
        description: "Closed trade lacks a recorded exit timestamp, impairing holding duration and calendar placement.",
        actionLabel: "Set Exit Time",
      });
    }

    // 3. Missing Strategy Assignment
    if (!t.strategyId) {
      tradeHasIssue = true;
      issues.push({
        tradeId: t.id,
        instrumentSymbol: t.instrumentSymbol,
        entryDate: entryDateStr,
        direction: t.direction,
        category: "missing_strategy",
        severity: "medium",
        title: "No Strategy Assigned",
        description: "Trade logged without strategy attribution, excluding it from setup-specific edge analytics.",
        actionLabel: "Assign Setup",
      });
    }

    // 4. Missing Checklist Answers (when trade has a strategy with configured rules)
    if (t.strategyId && t.hasChecklistRules && !t.hasChecklistAnswers) {
      tradeHasIssue = true;
      issues.push({
        tradeId: t.id,
        instrumentSymbol: t.instrumentSymbol,
        entryDate: entryDateStr,
        direction: t.direction,
        category: "missing_checklist",
        severity: "medium",
        title: "Unanswered Strategy Checklist",
        description: "Strategy has defined execution rules, but checklist responses were left uncompleted.",
        actionLabel: "Score Checklist",
      });
    }

    // 5. Missing Trade Notes / Journal Thesis
    if (!t.notes || t.notes.trim().length === 0) {
      tradeHasIssue = true;
      issues.push({
        tradeId: t.id,
        instrumentSymbol: t.instrumentSymbol,
        entryDate: entryDateStr,
        direction: t.direction,
        category: "missing_notes",
        severity: "low",
        title: "Missing Journal Notes",
        description: "No trade narrative or entry thesis recorded.",
        actionLabel: "Add Journal Notes",
      });
    }

    if (!tradeHasIssue && !duplicateCandidateIds.has(t.id)) {
      completeTrades++;
    }
  }

  const total = trades.length;
  const completenessScorePct = total > 0 ? Math.round((completeTrades / total) * 100) : 100;

  return {
    totalTradesScanned: total,
    completeTradesCount: completeTrades,
    incompleteTradesCount: total - completeTrades,
    completenessScorePct,
    issuesByCategory: {
      missingRiskCount: issues.filter((i) => i.category === "missing_risk").length,
      missingTimestampCount: issues.filter((i) => i.category === "missing_timestamp").length,
      missingStrategyCount: issues.filter((i) => i.category === "missing_strategy").length,
      missingChecklistCount: issues.filter((i) => i.category === "missing_checklist").length,
      potentialDuplicatesCount: issues.filter((i) => i.category === "potential_duplicate").length,
      missingNotesCount: issues.filter((i) => i.category === "missing_notes").length,
    },
    issues: issues.sort((a, b) => {
      const sevOrder = { high: 0, medium: 1, low: 2 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    }),
  };
}
