import { describe, it, expect } from "bun:test";
import {
  simulateChallengeScenario,
  calculateConsistencyProjection,
  evaluateRuleAlerts,
} from "./prop-simulator-engine";
import { PropChallengeMetrics, PropChallengeConfig } from "./prop-firm-engine";

describe("Phase 3: Prop Challenge Simulator, Consistency & Alert Tests", () => {
  const mockBaseMetrics: PropChallengeMetrics = {
    startingBalanceCents: 10000000, // $100,000
    currentBalanceCents: 10250000,  // $102,500
    netProfitCents: 250000,         // $2,500
    profitTargetCents: 1000000,     // $10,000 target (10%)
    profitTargetProgressPct: 25.0,
    profitTargetReached: false,
    remainingProfitTargetCents: 750000,

    tradeCount: 12,
    winCount: 8,
    lossCount: 4,
    breakevenCount: 0,
    winRate: 66.7,
    profitFactor: 2.4,

    dailyLossLimitCents: 500000,    // $5,000 (5%)
    todayPnlCents: -150000,         // -$1,500 today
    todayLossCents: 150000,
    remainingDailyLossCents: 350000, // $3,500 remaining
    dailyLossUsedPct: 30.0,
    dailyLossBreached: false,
    cycleResetTime: "17:00 NY",

    maxDrawdownLimitCents: 1000000, // $10,000 (10%)
    drawdownType: "static",
    highWaterMarkCents: 10300000,
    currentDrawdownCents: 50000,    // $500 from starting
    remainingDrawdownCents: 950000,
    drawdownUsedPct: 5.0,
    drawdownBreached: false,

    minTradingDays: 4,
    maxTradingDays: null,
    tradingDaysCount: 5,
    minDaysMet: true,
    daysRemaining: 0,

    consistencyRuleType: "single_day_max",
    consistencyThresholdPct: 50,    // max 50% from one day
    consistencyAction: "dilution_required",
    bestDayProfitCents: 150000,     // $1,500
    bestDayPctOfTotal: 60.0,        // 1500 / 2500 = 60%
    consistencyBreached: true,
    consistencyStatus: "breached",

    status: "at_risk",
    statusReason: "Consistency rule exceeded (best day 60.0% of profit).",
  };

  const mockConfig: PropChallengeConfig = {
    startingBalanceCents: 10000000,
    profitTargetCents: 1000000,
    dailyLossLimitCents: 500000,
    maxDrawdownCents: 1000000,
    consistencyThresholdPct: 50,
    consistencyRuleType: "single_day_max",
    startDate: "2026-11-01",
  };

  it("simulates a proposed winning trade scenario correctly", () => {
    const res = simulateChallengeScenario(mockBaseMetrics, mockConfig, {
      proposedRiskCents: 100000, // $1,000 risk
      outcomeType: "win",
      netPnlCents: 200000, // $2,000 win
    });

    expect(res.projectedBalanceCents).toBe(10450000); // $104,500
    expect(res.projectedNetProfitCents).toBe(450000); // $4,500
    expect(res.overallStatus).toBe("Passed");
    expect(res.profitTargetImpact.remainingCents).toBe(550000); // $5,500 left
    expect(res.dailyLossImpact.status).toBe("Passed");
  });

  it("simulates a proposed loss that breaches daily loss limit", () => {
    const res = simulateChallengeScenario(mockBaseMetrics, mockConfig, {
      proposedRiskCents: 400000, // $4,000 risk
      outcomeType: "loss",
      netPnlCents: -400000, // -$4,000 loss
    });

    // Today already lost $1,500. Losing $4,000 more => $5,500 loss. Limit is $5,000!
    expect(res.dailyLossImpact.status).toBe("Violated");
    expect(res.overallStatus).toBe("Violated");
    expect(res.overallReason).toContain("breaches daily loss limit");
  });

  it("calculates consistency projection and required dilution profit", () => {
    // Current profit = $2,500. Best day = $1,500 (60% of total, threshold is 50%).
    // Required total profit: $1,500 / 0.50 = $3,000.
    // Required additional dilution profit: $3,000 - $2,500 = $500 (50,000 cents).
    const proj = calculateConsistencyProjection(mockBaseMetrics, mockConfig, [50000, 100000]);

    expect(proj.complianceStatus).toBe("Breached");
    expect(proj.currentConsistencyPct).toBe(60.0);
    expect(proj.additionalDilutionProfitRequiredCents).toBe(50000); // $500 required!
    expect(proj.projectedDays.length).toBe(2);

    // After +$500 hypothetical profit: total = $3,000. 1500 / 3000 = 50.0% => Compliant!
    expect(proj.projectedDays[0].projectedConsistencyPct).toBe(50.0);
    expect(proj.projectedDays[0].isCompliant).toBe(true);
  });

  it("evaluates rule alerts and generates warnings at thresholds", () => {
    // Test metrics with daily loss used at 80% (warning threshold 75%)
    const metricsWithWarning: PropChallengeMetrics = {
      ...mockBaseMetrics,
      todayLossCents: 400000, // $4,000 of $5,000
      dailyLossUsedPct: 80.0,
      dailyLossBreached: false,
      profitTargetReached: false,
    };

    const alerts = evaluateRuleAlerts("challenge_123", metricsWithWarning);
    expect(alerts.length).toBeGreaterThan(0);

    const dailyAlert = alerts.find((a) => a.category === "daily_loss");
    expect(dailyAlert).toBeDefined();
    expect(dailyAlert?.severity).toBe("warning");
    expect(dailyAlert?.message).toContain("80.0%");
  });

  it("generates critical alert when rule is breached", () => {
    const breachedMetrics: PropChallengeMetrics = {
      ...mockBaseMetrics,
      dailyLossBreached: true,
      todayLossCents: 520000,
    };

    const alerts = evaluateRuleAlerts("challenge_123", breachedMetrics);
    const breachAlert = alerts.find((a) => a.category === "rule_breach");
    expect(breachAlert).toBeDefined();
    expect(breachAlert?.severity).toBe("critical");
  });

  it("handles negative cumulative profit with a winning day followed by losses without fabricated pass status", () => {
    // Best day = $200 (20,000 cents), but net profit is -$500 (-50,000 cents). Threshold = 50%.
    const losingMetrics = {
      ...mockBaseMetrics,
      netProfitCents: -50000,
      bestDayProfitCents: 20000,
      bestDayPctOfTotal: 0,
      tradingDaysCount: 4,
    };

    const res = calculateConsistencyProjection(losingMetrics, mockConfig);
    // Denominator is negative: status is Not Evaluated, concentration % is null (not 0% or negative)
    expect(res.complianceStatus).toBe("Not Evaluated");
    expect(res.currentConsistencyPct).toBeNull();
    // Required cumulative profit to reach 50% consistency: bestDay / 0.5 = $400 (40,000 cents).
    // From current -$500, additional dilution needed = 40,000 - (-50,000) = 90,000 cents ($900).
    expect(res.additionalDilutionProfitRequiredCents).toBe(90000);
    expect(res.formulaDescription).toContain("negative cumulative profit");
  });

  it("handles break-even cumulative profit ($0.00) with a winning day followed by losses", () => {
    // Best day = $1,000 (100,000 cents), but subsequent loss brings net profit to $0.
    const breakevenMetrics = {
      ...mockBaseMetrics,
      netProfitCents: 0,
      bestDayProfitCents: 100000,
      tradingDaysCount: 3,
    };

    const res = calculateConsistencyProjection(breakevenMetrics, mockConfig);
    expect(res.complianceStatus).toBe("Not Evaluated");
    expect(res.currentConsistencyPct).toBeNull();
    // At 50% limit, $1,000 best day requires $2,000 total profit. From $0, dilution needed is $2,000.
    expect(res.additionalDilutionProfitRequiredCents).toBe(200000);
  });

  it("handles missing history (0 trading days) appropriately", () => {
    const noHistoryMetrics = {
      ...mockBaseMetrics,
      netProfitCents: 0,
      bestDayProfitCents: 0,
      tradingDaysCount: 0,
      tradeCount: 0,
    };

    const res = calculateConsistencyProjection(noHistoryMetrics, mockConfig);
    expect(res.complianceStatus).toBe("Not Evaluated");
    expect(res.currentConsistencyPct).toBeNull();
    expect(res.additionalDilutionProfitRequiredCents).toBe(0);
    expect(res.missingDataWarning).toContain("No trading days");
  });

  it("supports different consistency thresholds (30%, 40%, 50%) correctly", () => {
    // Profit = $10,000 (1,000,000 cents), Best day = $4,000 (400,000 cents) => 40%
    const metrics = {
      ...mockBaseMetrics,
      netProfitCents: 1000000,
      bestDayProfitCents: 400000,
      tradingDaysCount: 10,
    };

    // Under 50% threshold: 40% <= 50% => Compliant, 0 dilution
    const res50 = calculateConsistencyProjection(metrics, { ...mockConfig, consistencyThresholdPct: 50 });
    expect(res50.complianceStatus).toBe("Compliant");
    expect(res50.currentConsistencyPct).toBe(40.0);
    expect(res50.additionalDilutionProfitRequiredCents).toBe(0);

    // Under 30% threshold: 40% > 30% => Breached!
    // Required total = $4,000 / 0.30 = $13,333.33 => Dilution = $3,333.33 (333,333 cents)
    const res30 = calculateConsistencyProjection(metrics, { ...mockConfig, consistencyThresholdPct: 30 });
    expect(res30.complianceStatus).toBe("Breached");
    expect(res30.currentConsistencyPct).toBe(40.0);
    expect(res30.additionalDilutionProfitRequiredCents).toBe(333333);
  });

  it("handles unconfigured consistency rules properly", () => {
    const unconfiguredConfig: PropChallengeConfig = {
      ...mockConfig,
      consistencyRuleType: "none",
      consistencyThresholdPct: null,
    };

    const res = calculateConsistencyProjection(mockBaseMetrics, unconfiguredConfig);
    expect(res.complianceStatus).toBe("Unconfigured");
    expect(res.thresholdPct).toBeNull();
  });

  it("guarantees pure hypothetical simulations without mutating base metrics", () => {
    const originalBalance = mockBaseMetrics.currentBalanceCents;
    const originalPnl = mockBaseMetrics.netProfitCents;

    simulateChallengeScenario(mockBaseMetrics, mockConfig, {
      proposedRiskCents: 500000,
      outcomeType: "loss",
      netPnlCents: -500000,
    });

    expect(mockBaseMetrics.currentBalanceCents).toBe(originalBalance);
    expect(mockBaseMetrics.netProfitCents).toBe(originalPnl);
  });
});
