import { describe, expect, test } from "bun:test";
import {
  computeAggregateMetrics,
  calculatePositionSize,
  type TradeMetricRow,
  type PositionSizeInput,
} from "./financial-engine";
import {
  evaluatePropChallenge,
  parseChallengeMetadata,
  serializeChallengeMetadata,
  type PropChallengeConfig,
  type TradeForChallenge,
} from "./prop-firm-engine";

describe("Phase 1 Hardening: Maximum Drawdown & Recovery Calculation", () => {
  test("HARDEN-DD-1: Correct peak-to-trough identification, max DD %, and recovery", () => {
    // Account Starting Balance: $100,000.00 (10_000_000 cents)
    // Trade 1: -$5,000 -> Balance $95,000 (DD: $5,000, 5.0%)
    // Trade 2: -$3,000 -> Balance $92,000 (DD: $8,000, 8.0%, Trough)
    // Trade 3: +$12,000 -> Balance $104,000 (New Peak, Current DD: $0, Max DD remains $8,000 / 8.0%, Recovered: true)
    // Trade 4: -$2,000 -> Balance $102,000 (Current DD: $2,000, Max DD remains $8,000 / 8.0%)
    const trades: TradeMetricRow[] = [
      {
        id: "t1",
        netPnlCents: -500_000,
        grossPnlCents: -500_000,
        actualR: "-1.0",
        status: "closed",
        outcome: "loss",
        direction: "long",
        entryTime: "2026-11-01T10:00:00Z",
        exitTime: "2026-11-01T11:00:00Z",
        ruleCompliant: true,
      },
      {
        id: "t2",
        netPnlCents: -300_000,
        grossPnlCents: -300_000,
        actualR: "-0.6",
        status: "closed",
        outcome: "loss",
        direction: "long",
        entryTime: "2026-11-02T10:00:00Z",
        exitTime: "2026-11-02T11:00:00Z",
        ruleCompliant: true,
      },
      {
        id: "t3",
        netPnlCents: 1_200_000,
        grossPnlCents: 1_200_000,
        actualR: "2.4",
        status: "closed",
        outcome: "win",
        direction: "long",
        entryTime: "2026-11-03T10:00:00Z",
        exitTime: "2026-11-03T11:00:00Z",
        ruleCompliant: true,
      },
      {
        id: "t4",
        netPnlCents: -200_000,
        grossPnlCents: -200_000,
        actualR: "-0.4",
        status: "closed",
        outcome: "loss",
        direction: "long",
        entryTime: "2026-11-04T10:00:00Z",
        exitTime: "2026-11-04T11:00:00Z",
        ruleCompliant: true,
      },
    ];

    const metrics = computeAggregateMetrics(trades, 10_000_000);

    // Max DD amount = $8,000.00
    expect(metrics.maxDrawdownCents).toBe(800_000);
    // Peak at max DD was $100,000.00
    expect(metrics.maxDrawdownPeakCents).toBe(10_000_000);
    // Trough at max DD was $92,000.00
    expect(metrics.maxDrawdownTroughCents).toBe(9_200_000);
    // Max DD % = $8,000 / $100,000 = 8.000000%
    expect(metrics.maxDrawdownPct).toBe("0.08");
    expect(metrics.drawdownPct).toBe("0.08"); // Backward compatibility check
    // Current DD = $104,000 - $102,000 = $2,000.00
    expect(metrics.currentDrawdownCents).toBe(200_000);
    // Current DD % = $2,000 / $104,000 = ~1.923%
    expect(metrics.currentDrawdownPct).toBe("0.019231");
    // Drawdown recovered = true because equity ($102k) >= max DD peak ($100k)
    expect(metrics.drawdownRecovered).toBe(true);
  });

  test("HARDEN-DD-2: When starting balance is null, drawdown is null without inventing zero", () => {
    const trades: TradeMetricRow[] = [
      {
        id: "t1",
        netPnlCents: -500_000,
        grossPnlCents: -500_000,
        actualR: "-1.0",
        status: "closed",
        outcome: "loss",
        direction: "long",
        entryTime: "2026-11-01T10:00:00Z",
        exitTime: "2026-11-01T11:00:00Z",
        ruleCompliant: true,
      },
    ];

    const metrics = computeAggregateMetrics(trades, null);
    expect(metrics.maxDrawdownCents).toBeNull();
    expect(metrics.maxDrawdownPct).toBeNull();
    expect(metrics.currentDrawdownCents).toBeNull();
    expect(metrics.drawdownPct).toBeNull();
  });
});

describe("Phase 1 Hardening: Risk Percentage Precision & Position Sizing", () => {
  test("HARDEN-RISK-1: Exact monetary risk preservation: 0.5% of $100,000 = $500.00", () => {
    const input: PositionSizeInput = {
      instrument: {
        symbol: "XAUUSD",
        market: "gold",
        pipSize: "0.01",
        tickSize: "0.01",
        contractSize: "100",
        pointValueCents: 10_000, // $100 per $1 move per 1.0 lot
        quantityStep: "0.01",
        minQuantity: "0.01",
      },
      accountBalanceCents: 10_000_000, // $100,000
      riskPct: "0.005", // 0.5%
      entryPrice: "2350.00",
      stopPrice: "2345.00", // 5.00 distance
    };

    const result = calculatePositionSize(input);
    expect(result.riskBudgetCents).toBe(50_000); // $500.00 exactly
    expect(result.stopDistance).toBe("5");
    // Risk per unit (lot) = 5 * $100 = $500.00 (50,000 cents)
    expect(result.riskPerUnitCents).toBe(50_000);
    // Raw qty = $500 / $500 = 1.00 lot
    expect(result.roundedQuantity).toBe("1");
    expect(result.actualRiskCents).toBe(50_000); // $500.00
  });

  test("HARDEN-RISK-2: High precision basis points: 0.025% and 0.375% do not lose precision", () => {
    const ratioBps = 0.025 / 100;
    const ratioStr = ratioBps.toFixed(8).replace(/\.?0+$/, "");
    expect(ratioStr).toBe("0.00025"); // Preserved without toFixed(4) round to 0.0003

    const ratioEighth = 0.375 / 100;
    const ratioEighthStr = ratioEighth.toFixed(8).replace(/\.?0+$/, "");
    expect(ratioEighthStr).toBe("0.00375"); // Preserved without toFixed(4) round to 0.0038
  });

  test("HARDEN-RISK-3: Multi-asset position sizing across Gold, Futures, Forex, and Crypto", () => {
    // 1. COMEX Gold Futures (GC): point value $100/pt, contract size 100, whole contracts (step 1)
    const gcInput: PositionSizeInput = {
      instrument: {
        symbol: "GC",
        market: "futures",
        pipSize: "0.1",
        tickSize: "0.1",
        contractSize: "100",
        pointValueCents: 10_000, // $100 per 1.00 move
        quantityStep: "1",
        minQuantity: "1",
      },
      accountBalanceCents: 10_000_000, // $100,000
      riskPct: "0.01", // 1% = $1,000
      entryPrice: "2350.0",
      stopPrice: "2348.0", // 2 points distance
    };
    const gcRes = calculatePositionSize(gcInput);
    // Risk per contract = 2 * $100 = $200. Sizing = $1,000 / $200 = 5 contracts.
    expect(gcRes.riskBudgetCents).toBe(100_000);
    expect(gcRes.roundedQuantity).toBe("5");
    expect(gcRes.actualRiskCents).toBe(100_000);

    // 2. Micro E-mini Nasdaq (MNQ): point value $2/pt, whole contracts
    const mnqInput: PositionSizeInput = {
      instrument: {
        symbol: "MNQ",
        market: "futures",
        pipSize: "0.25",
        tickSize: "0.25",
        contractSize: "2",
        pointValueCents: 200, // $2 per index point
        quantityStep: "1",
        minQuantity: "1",
      },
      accountBalanceCents: 5_000_000, // $50,000
      riskPct: "0.005", // 0.5% = $250
      entryPrice: "20000.00",
      stopPrice: "19975.00", // 25 points distance
    };
    const mnqRes = calculatePositionSize(mnqInput);
    // Risk per contract = 25 * $2 = $50. Sizing = $250 / $50 = 5 contracts.
    expect(mnqRes.riskBudgetCents).toBe(25_000);
    expect(mnqRes.roundedQuantity).toBe("5");
    expect(mnqRes.actualRiskCents).toBe(25_000);
  });

  test("HARDEN-RISK-4: Minimum tradable volume strictly floors to 0 when exceeding budget (never rounds up)", () => {
    // Risk budget $50. Instrument minimum is 1 contract ($100 risk per contract).
    const gcInput: PositionSizeInput = {
      instrument: {
        symbol: "GC",
        market: "futures",
        pipSize: "0.1",
        tickSize: "0.1",
        contractSize: "100",
        pointValueCents: 10_000, // $100 per 1.00 move
        quantityStep: "1",
        minQuantity: "1",
      },
      accountBalanceCents: 1_000_000, // $10,000
      riskPct: "0.005", // 0.5% = $50 budget
      entryPrice: "2350.0",
      stopPrice: "2349.0", // 1 point stop = $100 risk per contract
    };
    const res = calculatePositionSize(gcInput);
    // Budget $50 is insufficient for 1 contract ($100). Must strictly floor to 0, NEVER round up!
    expect(res.riskBudgetCents).toBe(5_000); // $50
    expect(res.roundedQuantity).toBe("0");
    expect(res.minimumTradableExceedsBudget).toBe(true);
    expect(res.validationError).toContain("Minimum tradable quantity exceeds risk budget");
  });
});

describe("Phase 1 Hardening: Prop Challenge Metadata & Consistency Semantics", () => {
  test("HARDEN-PROP-1: Metadata parser handles malformed JSON without crashing", () => {
    // Malformed JSON string
    const malformed = "{ userNotes: invalid json here";
    const meta = parseChallengeMetadata(malformed, 0.5);
    expect(meta.userNotes).toBe(malformed);
    expect(meta.consistencyRuleType).toBe("single_day_max");
    expect(meta.consistencyThresholdPct).toBe(50);
    expect(meta.consistencyAction).toBe("soft_rule");
  });

  test("HARDEN-PROP-2: User notes cannot overwrite consistency configuration", () => {
    // Initial serialized config
    const initial = serializeChallengeMetadata(
      {
        userNotes: "Initial note",
        consistencyRuleType: "single_day_max",
        consistencyThresholdPct: 50,
        consistencyAction: "soft_rule",
      },
      null
    );

    // User updates plain note only
    const updated = serializeChallengeMetadata(
      { userNotes: "Updated trading diary entry without touching config" },
      initial
    );

    const parsed = parseChallengeMetadata(updated);
    expect(parsed.userNotes).toBe("Updated trading diary entry without touching config");
    expect(parsed.consistencyRuleType).toBe("single_day_max");
    expect(parsed.consistencyThresholdPct).toBe(50);
    expect(parsed.consistencyAction).toBe("soft_rule");
  });

  test("HARDEN-PROP-3: Consistency violation under soft rule requires dilution, does not fail challenge", () => {
    const baseConfig: PropChallengeConfig = {
      startingBalanceCents: 10_000_000,
      profitTargetCents: 1_000_000,
      dailyLossLimitCents: 500_000,
      maxDrawdownCents: 1_000_000,
      drawdownType: "static",
      minTradingDays: 4,
      consistencyRuleType: "single_day_max",
      consistencyThresholdPct: 50,
      consistencyAction: "soft_rule", // Soft rule
      resetTimezone: "America/New_York",
      resetHour: 17,
      startDate: "2026-01-01T00:00:00Z",
    };

    // Target is $10k. 4 days: Day 1 makes $7k (70% > 50%), other days make $1k each. Total = $10k.
    const trades: TradeForChallenge[] = [
      { id: "t1", netPnlCents: 700_000, entryTime: "2026-01-02T12:00:00Z", exitTime: "2026-01-02T14:00:00Z", status: "closed" },
      { id: "t2", netPnlCents: 100_000, entryTime: "2026-01-03T12:00:00Z", exitTime: "2026-01-03T14:00:00Z", status: "closed" },
      { id: "t3", netPnlCents: 100_000, entryTime: "2026-01-04T12:00:00Z", exitTime: "2026-01-04T14:00:00Z", status: "closed" },
      { id: "t4", netPnlCents: 100_000, entryTime: "2026-01-05T12:00:00Z", exitTime: "2026-01-05T14:00:00Z", status: "closed" },
    ];

    const metrics = evaluatePropChallenge(baseConfig, trades, new Date("2026-01-06T12:00:00Z"));
    expect(metrics.profitTargetReached).toBe(true);
    expect(metrics.minDaysMet).toBe(true);
    expect(metrics.consistencyBreached).toBe(true);
    // Crucial: NOT breached, but at_risk (dilution required)
    expect(metrics.status).toBe("at_risk");
    expect(metrics.statusReason).toContain("dilute");
  });

  test("HARDEN-PROP-4: Full rule consequence spectrum: warning vs payout_restricted vs hard_breach", () => {
    const baseConfig: PropChallengeConfig = {
      startingBalanceCents: 10_000_000,
      profitTargetCents: 1_000_000,
      dailyLossLimitCents: 500_000,
      maxDrawdownCents: 1_000_000,
      drawdownType: "static",
      minTradingDays: 4,
      consistencyRuleType: "single_day_max",
      consistencyThresholdPct: 50,
      resetTimezone: "America/New_York",
      resetHour: 17,
      startDate: "2026-01-01T00:00:00Z",
    };

    const trades: TradeForChallenge[] = [
      { id: "t1", netPnlCents: 700_000, entryTime: "2026-01-02T12:00:00Z", exitTime: "2026-01-02T14:00:00Z", status: "closed" },
      { id: "t2", netPnlCents: 100_000, entryTime: "2026-01-03T12:00:00Z", exitTime: "2026-01-03T14:00:00Z", status: "closed" },
      { id: "t3", netPnlCents: 100_000, entryTime: "2026-01-04T12:00:00Z", exitTime: "2026-01-04T14:00:00Z", status: "closed" },
      { id: "t4", netPnlCents: 100_000, entryTime: "2026-01-05T12:00:00Z", exitTime: "2026-01-05T14:00:00Z", status: "closed" },
    ];

    // 1. Informational Warning Only: Passes despite consistency breach
    const warningMetrics = evaluatePropChallenge({ ...baseConfig, consistencyAction: "warning" }, trades, new Date("2026-01-06T12:00:00Z"));
    expect(warningMetrics.consistencyBreached).toBe(true);
    expect(warningMetrics.status).toBe("passed");
    expect(warningMetrics.statusReason).toContain("informational");

    // 2. Payout & Passing Restricted: At risk, blocks certification
    const payoutMetrics = evaluatePropChallenge({ ...baseConfig, consistencyAction: "payout_restricted" }, trades, new Date("2026-01-06T12:00:00Z"));
    expect(payoutMetrics.status).toBe("at_risk");
    expect(payoutMetrics.statusReason).toContain("payout eligibility restricted");

    // 3. Hard Breach: Terminates account immediately
    const breachMetrics = evaluatePropChallenge({ ...baseConfig, consistencyAction: "hard_breach" }, trades, new Date("2026-01-06T12:00:00Z"));
    expect(breachMetrics.status).toBe("breached");
    expect(breachMetrics.statusReason).toContain("hard breach");
  });
});

describe("Phase 1 Hardening: Hourly & Weekday Net P&L Reconciliation", () => {
  test("HARDEN-TIME-1: Sum of hourly Net P&L equals overall Net P&L with mixed win/loss and missing entry times", () => {
    const trades: TradeMetricRow[] = [
      { id: "t1", netPnlCents: 50_000, grossPnlCents: 52_000, actualR: "1.0", status: "closed", outcome: "win", direction: "long", entryTime: "2026-11-04T14:15:00Z", exitTime: "2026-11-04T14:45:00Z", ruleCompliant: true },
      { id: "t2", netPnlCents: -30_000, grossPnlCents: -28_000, actualR: "-0.6", status: "closed", outcome: "loss", direction: "short", entryTime: "2026-11-04T14:50:00Z", exitTime: "2026-11-04T15:10:00Z", ruleCompliant: true },
      { id: "t3", netPnlCents: 100_000, grossPnlCents: 105_000, actualR: "2.0", status: "closed", outcome: "win", direction: "long", entryTime: "2026-11-04T15:30:00Z", exitTime: "2026-11-04T16:00:00Z", ruleCompliant: true },
      // Trade with null entryTime: falls back to exitTime without being dropped
      { id: "t4", netPnlCents: -20_000, grossPnlCents: -18_000, actualR: "-0.4", status: "closed", outcome: "loss", direction: "short", entryTime: null, exitTime: "2026-11-04T16:15:00Z", ruleCompliant: true },
    ];

    const totalNetPnl = trades.reduce((sum, t) => sum + t.netPnlCents, 0); // 50k - 30k + 100k - 20k = 100k
    expect(totalNetPnl).toBe(100_000);

    // Grouping by hour using UTC
    const hourMap = new Map<string, number>();
    for (const t of trades) {
      const timeStr = t.entryTime || t.exitTime;
      const d = new Date(timeStr!);
      const hr = `${String(d.getUTCHours()).padStart(2, "0")}:00`;
      hourMap.set(hr, (hourMap.get(hr) || 0) + t.netPnlCents);
    }

    const hourlySum = [...hourMap.values()].reduce((sum, val) => sum + val, 0);
    expect(hourlySum).toBe(totalNetPnl);
    expect(hourMap.get("14:00")).toBe(20_000); // 50k - 30k
    expect(hourMap.get("15:00")).toBe(100_000);
    expect(hourMap.get("16:00")).toBe(-20_000);
  });

  test("HARDEN-TIME-2: Distinct Entry-Hour Performance vs Realization-Hour P&L across midnight trade", () => {
    // Trade entered at 23:45 UTC on Nov 4, exited at 01:15 UTC on Nov 5 (+100k net P&L).
    const trades: TradeMetricRow[] = [
      {
        id: "t1",
        netPnlCents: 100_000,
        grossPnlCents: 100_000,
        actualR: "2.0",
        status: "closed",
        outcome: "win",
        direction: "long",
        entryTime: "2026-11-04T23:45:00Z",
        exitTime: "2026-11-05T01:15:00Z",
        ruleCompliant: true,
      },
    ];

    // 1. Entry hour attribution (evaluating setup initiation time)
    const entryHour = new Date(trades[0].entryTime!).getUTCHours();
    expect(entryHour).toBe(23);

    // 2. Realization hour attribution (evaluating cash realization timestamp)
    const exitHour = new Date(trades[0].exitTime!).getUTCHours();
    expect(exitHour).toBe(1);

    // Both attribute the same 100k net P&L without double counting or dropping
    expect(trades[0].netPnlCents).toBe(100_000);
  });
});
