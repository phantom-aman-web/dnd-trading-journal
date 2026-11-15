import { describe, expect, it } from "bun:test";
import { METRIC_DEFINITIONS } from "@/lib/metric-definitions";
import { evaluateDataQuality, type ScannableTradeRecord } from "@/lib/data-quality-engine";
import { computeDrawdownAnalytics, type TradeDrawdownInput } from "@/lib/drawdown-analytics-engine";

describe("Phase 3: Metric Definitions Dictionary (§ C1.3)", () => {
  it("defines all mandatory analytical metrics with complete metadata", () => {
    const requiredKeys = [
      "totalTrades",
      "winRate",
      "netPnl",
      "grossPnl",
      "profitFactor",
      "expectancy",
      "avgR",
      "avgHoldTime",
      "checklistAdherence",
      "ruleViolationsCorrelation",
      "maxDrawdown",
      "drawdownRecovery",
    ];

    for (const key of requiredKeys) {
      const def = METRIC_DEFINITIONS[key];
      expect(def).toBeDefined();
      expect(def.id).toBe(key);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.formula.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.includedRecords.length).toBeGreaterThan(0);
      expect(def.excludedRecords.length).toBeGreaterThan(0);
      expect(def.missingDataBehavior.length).toBeGreaterThan(0);
      expect(def.sampleSizeGuidance.length).toBeGreaterThan(0);
    }
  });

  it("categorizes metrics into financial, risk, compliance, and temporal groups", () => {
    expect(METRIC_DEFINITIONS.winRate.category).toBe("financial");
    expect(METRIC_DEFINITIONS.maxDrawdown.category).toBe("risk");
    expect(METRIC_DEFINITIONS.checklistAdherence.category).toBe("compliance");
    expect(METRIC_DEFINITIONS.avgHoldTime.category).toBe("temporal");
  });
});

describe("Phase 3: Data Quality & Completeness Engine (§ C4)", () => {
  it("scores a pristine, fully-documented trade as 100% complete with 0 issues", () => {
    const pristineTrade: ScannableTradeRecord = {
      id: "t1",
      instrumentSymbol: "EURUSD",
      direction: "BUY",
      status: "CLOSED",
      entryTime: new Date("2026-03-01T10:00:00Z"),
      exitTime: new Date("2026-03-01T11:00:00Z"),
      plannedStopPrice: "1.08000",
      plannedRiskAmountCents: 10000,
      strategyId: "strat-1",
      strategyName: "Trend Pullback",
      strategyVersionId: "v-1",
      hasChecklistRules: true,
      hasChecklistAnswers: true,
      notes: "High time-frame order block rejection confirmation.",
    };

    const result = evaluateDataQuality([pristineTrade]);
    expect(result.totalTradesScanned).toBe(1);
    expect(result.completenessScorePct).toBe(100);
    expect(result.issues.length).toBe(0);
    expect(result.issuesByCategory.missingRiskCount).toBe(0);
  });

  it("identifies missing stop-loss/risk and missing exit timestamps on closed trades", () => {
    const incompleteTrades: ScannableTradeRecord[] = [
      {
        id: "t2",
        instrumentSymbol: "GBPUSD",
        direction: "SELL",
        status: "CLOSED",
        entryTime: new Date("2026-03-02T10:00:00Z"),
        exitTime: null, // missing exit on closed trade!
        plannedStopPrice: null, // missing SL!
        plannedRiskAmountCents: null,
        strategyId: "strat-1",
        notes: "Some note",
      },
    ];

    const result = evaluateDataQuality(incompleteTrades);
    expect(result.completenessScorePct).toBeLessThan(100);
    expect(result.issuesByCategory.missingRiskCount).toBe(1);
    expect(result.issuesByCategory.missingTimestampCount).toBe(1);
    expect(result.issues.some((i) => i.category === "missing_risk")).toBe(true);
    expect(result.issues.some((i) => i.category === "missing_timestamp")).toBe(true);
  });

  it("identifies missing strategy attribution, missing checklist, and missing thesis", () => {
    const trade: ScannableTradeRecord = {
      id: "t3",
      instrumentSymbol: "USDJPY",
      direction: "BUY",
      status: "CLOSED",
      entryTime: new Date("2026-03-03T10:00:00Z"),
      exitTime: new Date("2026-03-03T10:30:00Z"),
      plannedStopPrice: "150.00",
      plannedRiskAmountCents: 5000,
      strategyId: null, // missing strategy!
      hasChecklistRules: false,
      hasChecklistAnswers: false,
      notes: null, // missing notes!
    };

    const result = evaluateDataQuality([trade]);
    expect(result.issuesByCategory.missingStrategyCount).toBe(1);
    expect(result.issuesByCategory.missingNotesCount).toBe(1);
    expect(result.issues.some((i) => i.category === "missing_strategy")).toBe(true);
    expect(result.issues.some((i) => i.category === "missing_notes")).toBe(true);
  });

  it("detects potential duplicate trades placed within 60 seconds with matching symbol and direction", () => {
    const duplicates: ScannableTradeRecord[] = [
      {
        id: "t4",
        instrumentSymbol: "XAUUSD",
        direction: "BUY",
        status: "CLOSED",
        entryTime: new Date("2026-03-04T14:00:00Z"),
        exitTime: new Date("2026-03-04T15:00:00Z"),
        plannedStopPrice: "2600.00",
        plannedRiskAmountCents: 5000,
        strategyId: "strat-1",
      },
      {
        id: "t5",
        instrumentSymbol: "XAUUSD",
        direction: "BUY",
        status: "CLOSED",
        entryTime: new Date("2026-03-04T14:00:25Z"), // 25 seconds later!
        exitTime: new Date("2026-03-04T15:00:00Z"),
        plannedStopPrice: "2600.00",
        plannedRiskAmountCents: 5000,
        strategyId: "strat-1",
      },
    ];

    const result = evaluateDataQuality(duplicates);
    expect(result.issuesByCategory.potentialDuplicatesCount).toBe(1);
    expect(result.issues.some((i) => i.category === "potential_duplicate")).toBe(true);
  });
});

describe("Phase 3: Drawdown & Equity Analytics Engine (§ C5)", () => {
  it("calculates sequential balance curve, peak, trough, and max drawdown", () => {
    const startingBalanceCents = 1000000; // $10,000.00

    const trades: TradeDrawdownInput[] = [
      {
        id: "t1",
        symbol: "EURUSD",
        netPnlCents: 50000, // +$500 => Balance: $10,500 (Peak: $10,500, DD: $0)
        exitTime: new Date("2026-03-01T12:00:00Z"),
      },
      {
        id: "t2",
        symbol: "EURUSD",
        netPnlCents: -100000, // -$1,000 => Balance: $9,500 (Peak: $10,500, DD: $1,000 / 9.52%)
        exitTime: new Date("2026-03-02T12:00:00Z"),
      },
      {
        id: "t3",
        symbol: "GBPUSD",
        netPnlCents: -50000, // -$500 => Balance: $9,000 (Peak: $10,500, DD: $1,500 / 14.29%)
        exitTime: new Date("2026-03-03T12:00:00Z"),
      },
      {
        id: "t4",
        symbol: "USDJPY",
        netPnlCents: 200000, // +$2,000 => Balance: $11,000 (Peak: $11,000, Recovered!)
        exitTime: new Date("2026-03-04T12:00:00Z"),
      },
    ];

    const result = computeDrawdownAnalytics(trades, startingBalanceCents, "USD");

    expect(result.startingBalanceCents).toBe(1000000);
    expect(result.peakBalanceCents).toBe(1100000); // $11,000 peak
    expect(result.currentBalanceCents).toBe(1100000); // At peak currently
    expect(result.currentDrawdownCents).toBe(0);
    expect(result.currentDrawdownPct).toBe(0);
    expect(result.isCurrentlyUnderwater).toBe(false);

    // Max drawdown was $1,500 at trade 3 ($10,500 - $9,000)
    expect(result.maxDrawdownCents).toBe(150000);
    // 1500 / 10500 = 14.29%
    expect(result.maxDrawdownPct).toBeCloseTo(14.29, 1);

    // Recovery took 2 trades (t2, t3) before new peak
    expect(result.averageDrawdownRecoveryTrades).toBe(2);

    // Losing streak of 2 consecutive losses (t2 and t3)
    expect(result.losingStreaks.length).toBeGreaterThan(0);
    expect(result.losingStreaks[0].tradeCount).toBe(2);
    expect(result.losingStreaks[0].totalLossCents).toBe(-150000);
  });

  it("correctly identifies active underwater state when current balance is below peak", () => {
    const startingBalanceCents = 1000000; // $10,000

    const trades: TradeDrawdownInput[] = [
      {
        id: "t1",
        symbol: "EURUSD",
        netPnlCents: 100000, // +$1,000 => $11,000 Peak
        exitTime: new Date("2026-03-01T12:00:00Z"),
      },
      {
        id: "t2",
        symbol: "EURUSD",
        netPnlCents: -50000, // -$500 => $10,500 (still underwater)
        exitTime: new Date("2026-03-02T12:00:00Z"),
      },
    ];

    const result = computeDrawdownAnalytics(trades, startingBalanceCents, "USD");
    expect(result.isCurrentlyUnderwater).toBe(true);
    expect(result.currentDrawdownCents).toBe(50000);
    expect(result.currentDrawdownPct).toBeCloseTo(4.55, 1); // 500 / 11000 = 4.55%
  });

  it("handles null or undefined starting balance by estimating curve from $0 baseline", () => {
    const trades: TradeDrawdownInput[] = [
      {
        id: "t1",
        symbol: "EURUSD",
        netPnlCents: 25000,
        exitTime: new Date("2026-03-01T12:00:00Z"),
      },
    ];

    const result = computeDrawdownAnalytics(trades, null, "USD");
    expect(result.isBalanceEstimated).toBe(true);
    expect(result.startingBalanceCents).toBe(null);
    expect(result.currentBalanceCents).toBe(null);
  });

  it("partitions losing trades into daily loss distribution brackets", () => {
    const trades: TradeDrawdownInput[] = [
      { id: "t1", symbol: "A", netPnlCents: -4000, exitTime: new Date() }, // -$40 (< $100 and < 0.5% of $10,000)
      { id: "t2", symbol: "B", netPnlCents: -25000, exitTime: new Date() }, // -$250 ($100-$500)
      { id: "t3", symbol: "C", netPnlCents: -75000, exitTime: new Date() }, // -$750 ($500-$1000)
      { id: "t4", symbol: "D", netPnlCents: -150000, exitTime: new Date() }, // -$1500 (> $1000)
    ];

    const result = computeDrawdownAnalytics(trades, 1000000, "USD");
    expect(result.dailyLossDistribution.length).toBe(4);

    const b1 = result.dailyLossDistribution.find((b) => b.bracket.startsWith("< $100"));
    expect(b1?.count).toBe(1);
    expect(b1?.totalLossCents).toBe(-4000);

    const b4 = result.dailyLossDistribution.find((b) => b.bracket.startsWith("> $1,000"));
    expect(b4?.count).toBe(1);
    expect(b4?.totalLossCents).toBe(-150000);

    // Verify normalized loss distribution (% of starting capital)
    expect(result.normalizedLossDistribution).toBeDefined();
    expect(result.normalizedLossDistribution?.length).toBe(4);
    const n1 = result.normalizedLossDistribution?.find((nb) => nb.bracket === "< 0.5% Capital");
    expect(n1?.count).toBe(1); // -$40 on $10,000 is 0.4% (< 0.5%)
  });
});
