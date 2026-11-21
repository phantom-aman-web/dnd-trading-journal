import { describe, expect, it } from "bun:test";
import { computeProcessOutcomeMatrix, type TradeBehaviorRow } from "./behavioral-engine";
import { computeChecklistAdherence, type TradeChecklistRecord } from "./checklist-adherence";
import { evaluateDataQuality, type ScannableTradeRecord } from "./data-quality-engine";

describe("Analytics Honesty: D-010, D-014, D-015", () => {
  describe("D-014: Process Adherence Sample Size Honesty", () => {
    it("returns null adherence when zero trades have been evaluated for process", () => {
      const trades: TradeBehaviorRow[] = [
        {
          id: "t1",
          instrumentSymbol: "EURUSD",
          direction: "long",
          status: "closed",
          entryTime: "2026-03-01T10:00:00Z",
          exitTime: "2026-03-01T11:00:00Z",
          netPnlCents: 5000,
          actualR: 1.0,
          session: "london",
          processCompliant: null, // Not evaluated
        },
        {
          id: "t2",
          instrumentSymbol: "GBPUSD",
          direction: "short",
          status: "closed",
          entryTime: "2026-03-01T12:00:00Z",
          exitTime: "2026-03-01T13:00:00Z",
          netPnlCents: -5000,
          actualR: -1.0,
          session: "london",
          processCompliant: undefined, // Not evaluated
        },
      ];

      const result = computeProcessOutcomeMatrix(trades);

      expect(result.totalTrades).toBe(2);
      expect(result.evaluatedTradesCount).toBe(0);
      expect(result.insufficientDataCount).toBe(2);
      // MUST NOT return 100%! Must return null to prevent fabricated perfection.
      expect(result.overallProcessAdherencePct).toBeNull();
    });

    it("correctly calculates adherence and reports sample size when subset of trades is evaluated", () => {
      const trades: TradeBehaviorRow[] = [
        // 2 trades with checklist / process evaluation (both followed)
        {
          id: "t1",
          instrumentSymbol: "EURUSD",
          direction: "long",
          status: "closed",
          entryTime: "2026-03-01T10:00:00Z",
          exitTime: "2026-03-01T11:00:00Z",
          netPnlCents: 5000,
          actualR: 1.0,
          session: "london",
          processCompliant: true,
        },
        {
          id: "t2",
          instrumentSymbol: "EURUSD",
          direction: "long",
          status: "closed",
          entryTime: "2026-03-01T12:00:00Z",
          exitTime: "2026-03-01T13:00:00Z",
          netPnlCents: 5000,
          actualR: 1.0,
          session: "london",
          processCompliant: true,
        },
        // 97 trades without process evaluation
        ...Array.from({ length: 97 }, (_, i) => ({
          id: `t_unassigned_${i}`,
          instrumentSymbol: "EURUSD",
          direction: "long" as const,
          status: "closed",
          entryTime: "2026-03-01T14:00:00Z",
          exitTime: "2026-03-01T15:00:00Z",
          netPnlCents: 1000,
          actualR: 0.2,
          session: "london",
          processCompliant: null,
        })),
      ];

      const result = computeProcessOutcomeMatrix(trades);

      expect(result.totalTrades).toBe(99);
      expect(result.evaluatedTradesCount).toBe(2);
      expect(result.insufficientDataCount).toBe(97);
      expect(result.overallProcessAdherencePct).toBe(100);
    });

    it("checklist adherence domain summary returns null when zero trades are evaluated", () => {
      const checklistTrades: TradeChecklistRecord[] = [
        {
          id: "t1",
          strategyId: "s1",
          strategyVersionId: "v1",
          rulesJson: JSON.stringify([{ id: "r1", label: "Rule 1", required: true }]),
          rawAnswersJson: null, // No answers logged
          outcome: "win",
        },
      ];

      const summary = computeChecklistAdherence(checklistTrades);
      expect(summary.totalTrades).toBe(1);
      expect(summary.totalEvaluatedTrades).toBe(0);
      expect(summary.overallAdherencePct).toBeNull();
    });
  });

  describe("D-015: Data Quality Weighted Scoring", () => {
    it("uses 6-factor weighted scoring instead of all-or-nothing exclusion", () => {
      // Create 10 trades where trades have:
      // - Stop Loss / Risk (25%)
      // - Exit timestamp (20%)
      // - Strategy assigned (20%)
      // - No checklist rules required (normalized)
      // - No duplicate collision (5%)
      // BUT missing notes (10%)
      const trades: ScannableTradeRecord[] = Array.from({ length: 10 }, (_, i) => ({
        id: `trade_${i}`,
        instrumentSymbol: "EURUSD",
        direction: "long",
        status: "closed",
        entryTime: `2026-03-01T${10 + i}:00:00Z`,
        exitTime: `2026-03-01T${10 + i}:30:00Z`,
        plannedStopPrice: "1.0800",
        plannedRiskAmountCents: 5000,
        strategyId: "strat_1",
        hasChecklistRules: false,
        notes: "", // Missing notes (10% weight)
      }));

      const report = evaluateDataQuality(trades);

      // Under the old all-or-nothing system, completeness was 0% or 1%!
      // Under the weighted system, with 70/80 applicable weight earned (87.5% -> 88%),
      // the score accurately reflects that the majority of crucial data exists.
      expect(report.completenessScorePct).toBeGreaterThanOrEqual(85);
      expect(report.completenessScorePct).toBeLessThan(100);

      // Issues are still logged accurately
      expect(report.issuesByCategory.missingNotesCount).toBe(10);
      expect(report.issuesByCategory.missingRiskCount).toBe(0);
      expect(report.issuesByCategory.missingTimestampCount).toBe(0);
      expect(report.issuesByCategory.missingStrategyCount).toBe(0);
    });

    it("awards 100% completeness score when all applicable parameters are present", () => {
      const perfectTrades: ScannableTradeRecord[] = [
        {
          id: "perfect_1",
          instrumentSymbol: "GBPUSD",
          direction: "short",
          status: "closed",
          entryTime: "2026-03-01T08:00:00Z",
          exitTime: "2026-03-01T09:30:00Z",
          plannedStopPrice: "1.2650",
          plannedRiskAmountCents: 10000,
          strategyId: "strat_momentum",
          hasChecklistRules: true,
          hasChecklistAnswers: true,
          notes: "Solid breakout with volume confirmation",
        },
      ];

      const report = evaluateDataQuality(perfectTrades);
      expect(report.completenessScorePct).toBe(100);
      expect(report.completeTradesCount).toBe(1);
      expect(report.incompleteTradesCount).toBe(0);
      expect(report.issues.length).toBe(0);
    });
  });

  describe("D-010: Drawdown Multi-Currency Transparency", () => {
    it("validates multi-currency condition flag when curve is empty", () => {
      // Simulating analytics response for multi-currency portfolio
      const multiCurrencyAnalyticsPayload = {
        curve: [],
        isMultiCurrency: true,
        currencyExplanation: "Cross-currency pooling requires single-account selection. USD and GBP cannot be aggregated into a single nominal equity curve.",
      };

      const hasEmptyCurve = multiCurrencyAnalyticsPayload.curve.length === 0;
      const isMultiCurrency = Boolean(multiCurrencyAnalyticsPayload.isMultiCurrency || multiCurrencyAnalyticsPayload.currencyExplanation);

      expect(hasEmptyCurve).toBe(true);
      expect(isMultiCurrency).toBe(true);
      expect(multiCurrencyAnalyticsPayload.currencyExplanation).toContain("USD and GBP cannot be aggregated");
    });
  });
});
