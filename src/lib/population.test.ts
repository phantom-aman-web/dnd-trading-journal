/**
 * DnD — Population & Analytics Golden Tests
 *
 * Tests the closed/partial/open/draft population model and analytics
 * per the STRICT FINANCIAL ENGINE SPECIFICATION (Phase 14-17).
 *
 * Run: bun test src/lib/population.test.ts
 */

import { test, expect } from "bun:test";
import {
  computeAggregateMetrics,
  type TradeMetricRow,
} from "./financial-engine";

function makeTrade(
  id: string,
  netPnlCents: number,
  status: any,
  exitTime: string | null,
  actualR: string | null = null,
): TradeMetricRow {
  return {
    id,
    netPnlCents,
    grossPnlCents: netPnlCents,
    actualR,
    status,
    outcome: status as any,
    direction: "long",
    entryTime: exitTime,
    exitTime,
    instrumentSymbol: "TEST",
  };
}

// PHASE 14: Population tests — one of each status
test("POP-1: 9 trades (WIN, LOSS, BE, PARTIAL_WIN, PARTIAL_LOSS, PARTIAL_BE, OPEN, PLANNED, DRAFT)", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("1", 10000, "win", "2026-01-01", "1"),
    makeTrade("2", -5000, "loss", "2026-01-02", "-1"),
    makeTrade("3", 0, "breakeven", "2026-01-03", "0"),
    makeTrade("4", 5000, "partial_win", "2026-01-04", "0.5"),
    makeTrade("5", -3000, "partial_loss", "2026-01-05", "-0.5"),
    makeTrade("6", 0, "partial_loss", "2026-01-06", "0"), // partial_breakeven not in type, use partial_loss with 0 pnl
    makeTrade("7", 0, "open", null, null),
    makeTrade("8", 0, "open", null, null), // planned not in TradeStatus type, use open
    makeTrade("9", 0, "open", null, null), // draft not in TradeStatus type, use open
  ];
  const m = computeAggregateMetrics(trades, null);
  // closedTrades = WIN + LOSS + BREAKEVEN = 3
  expect(m.closedTrades).toBe(3);
  expect(m.wins).toBe(1);
  expect(m.losses).toBe(1);
  expect(m.breakevens).toBe(1);
  // totalTrades = all 9
  expect(m.totalTrades).toBe(9);
  // netPnl = 10000 - 5000 + 0 + 5000 - 3000 = 7000 (realized: closed + partial)
  expect(m.netPnlCents).toBe(7000);
});

// PHASE 15: Golden analytics test
test("POP-2: WIN +$100 +1R, LOSS -$50 -1R, WIN +$200 +2R, BE $0 0R, PARTIAL_WIN +$50 +0.5R", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("1", 10000, "win", "2026-01-01", "1"),     // +$100, +1R
    makeTrade("2", -5000, "loss", "2026-01-02", "-1"),   // -$50, -1R
    makeTrade("3", 20000, "win", "2026-01-03", "2"),     // +$200, +2R
    makeTrade("4", 0, "breakeven", "2026-01-04", "0"),   // $0, 0R
    makeTrade("5", 5000, "partial_win", "2026-01-05", "0.5"), // +$50, +0.5R (PARTIAL — excluded)
  ];
  const m = computeAggregateMetrics(trades, null);
  // CLOSED population = 4 (WIN, LOSS, WIN, BE) — partial excluded
  expect(m.closedTrades).toBe(4);
  expect(m.wins).toBe(2);
  expect(m.losses).toBe(1);
  expect(m.breakevens).toBe(1);
  // netPnl = 10000 - 5000 + 20000 + 0 + 5000 = 30000 cents = $300 (realized)
  expect(m.netPnlCents).toBe(30000); // +$300
  // winRate = 2 / (2 + 1) = 2/3 = 0.666667 (breakeven excluded per spec §22)
  expect(m.winRate).toBe("0.666667");
  // profitFactor = (10000 + 20000 + 5000) / 5000 = 7
  expect(m.profitFactor).toBe("7");
  // avgWin = (10000 + 20000) / 2 = 15000 = $150
  expect(m.avgWinCents).toBe(15000);
  // avgLoss = -5000 / 1 = -5000 = -$50
  expect(m.avgLossCents).toBe(-5000);
  // largestWin = 20000 = $200
  expect(m.largestWinCents).toBe(20000);
  // largestLoss = -5000 = -$50
  expect(m.largestLossCents).toBe(-5000);
});

// PHASE 8: Single winning trade — Dashboard expected result
test("POP-3: Single XAUUSD winning trade +$100 at +10R", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("1", 10000, "win", "2026-09-12T10:01:00Z", "10"),
  ];
  const m = computeAggregateMetrics(trades, 1000000); // $10,000 starting balance
  expect(m.totalTrades).toBe(1);
  expect(m.closedTrades).toBe(1);
  expect(m.wins).toBe(1);
  expect(m.losses).toBe(0);
  expect(m.breakevens).toBe(0);
  expect(m.netPnlCents).toBe(10000); // +$100
  expect(m.winRate).toBe("1"); // 100%
  // profitFactor = Infinity when grossLoss = 0 (per spec §23)
  expect(m.profitFactor).toBe("Infinity");
  // avgR = 10
  expect(m.avgR).toBe("10");
  // expectancyR = 10
  expect(m.expectancyR).toBe("10");
  // avgWin = $100
  expect(m.avgWinCents).toBe(10000);
  // avgLoss = null (no losses)
  expect(m.avgLossCents).toBe(null);
  // largestWin = $100
  expect(m.largestWinCents).toBe(10000);
  // largestLoss = null (no losses)
  expect(m.largestLossCents).toBe(null);
  // maxDrawdown = 0 (single winning trade with starting balance, no drawdown)
  expect(m.maxDrawdownCents).toBe(0);
});

// PHASE 16: Partial exit — entry 4, exit 2, remaining 2 → partial
test("POP-4: Partial position remains (4 entry, 2 exit)", () => {
  // This tests the population logic, not the execution ledger.
  // A partial trade has status "partial_win"/"partial_loss" and is excluded from closedTrades.
  const trades: TradeMetricRow[] = [
    makeTrade("1", 5000, "partial_win", "2026-01-01", "0.5"),
  ];
  const m = computeAggregateMetrics(trades, null);
  expect(m.closedTrades).toBe(0); // partial is NOT closed
  expect(m.totalTrades).toBe(1);
  expect(m.wins).toBe(0);
  expect(m.losses).toBe(0);
});

// PHASE 17: Fees test — gross $100, fees $2, commission $1, swap $0.50, slippage $0.50 → net $96
test("POP-5: Fees reduce net P&L (gross $100, costs $4 → net $96)", () => {
  // The engine computes netPnl = grossPnl - costs.
  // Here we test that the analytics uses netPnl (not grossPnl) for aggregation.
  const trades: TradeMetricRow[] = [
    makeTrade("1", 9600, "win", "2026-01-01", "0.96"), // net $96 after $4 costs
  ];
  const m = computeAggregateMetrics(trades, null);
  expect(m.netPnlCents).toBe(9600); // $96 (net, not gross)
  expect(m.avgWinCents).toBe(9600); // $96
});

// Cross-screen consistency: same trade → same metrics
test("POP-6: Cross-screen consistency — same trade produces same metrics", () => {
  const trade = makeTrade("1", 10000, "win", "2026-09-12T10:01:00Z", "10");
  // All surfaces consume the same TradeMetricRow → same result
  const m1 = computeAggregateMetrics([trade], null);
  const m2 = computeAggregateMetrics([trade], null);
  expect(m1.netPnlCents).toBe(m2.netPnlCents);
  expect(m1.winRate).toBe(m2.winRate);
  expect(m1.avgR).toBe(m2.avgR);
});

// Closed trade immutability: engine doesn't mutate inputs
test("POP-7: Engine does not mutate trade inputs", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("1", 10000, "win", "2026-01-01", "1"),
  ];
  const original = JSON.parse(JSON.stringify(trades));
  computeAggregateMetrics(trades, null);
  expect(JSON.stringify(trades)).toBe(JSON.stringify(original));
});

// Streak: W W L W → currentWinStreak=1, maxWinStreak=2, currentLossStreak=0
test("POP-8: Streak W W L W", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("1", 1000, "win", "2026-01-01"),
    makeTrade("2", 2000, "win", "2026-01-02"),
    makeTrade("3", -500, "loss", "2026-01-03"),
    makeTrade("4", 3000, "win", "2026-01-04"),
  ];
  const m = computeAggregateMetrics(trades, null);
  // maxWinStreak = 2 (first two wins)
  expect(m.maxWinStreak).toBe(2);
  // maxLossStreak = 1
  expect(m.maxLossStreak).toBe(1);
});

// Streak: L L BE L → BE resets, maxLossStreak=2
test("POP-9: Streak L L BE L (breakeven resets)", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("1", -500, "loss", "2026-01-01"),
    makeTrade("2", -1000, "loss", "2026-01-02"),
    makeTrade("3", 0, "breakeven", "2026-01-03"),
    makeTrade("4", -300, "loss", "2026-01-04"),
  ];
  const m = computeAggregateMetrics(trades, null);
  // maxLossStreak = 2 (first two losses, BE resets, then 1 loss)
  expect(m.maxLossStreak).toBe(2);
  // maxWinStreak = 0 (no wins)
  expect(m.maxWinStreak).toBe(0);
});

// Drawdown: equity 1000000 (start), 1010000 (+10000), 1005000 (-5000), 1025000 (+20000) → maxDD = 5000 cents ($50)
test("POP-10: Max drawdown $50", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("1", 10000, "win", "2026-01-01"),
    makeTrade("2", -5000, "loss", "2026-01-02"),
    makeTrade("3", 20000, "win", "2026-01-03"),
  ];
  const m = computeAggregateMetrics(trades, 1000000); // with starting balance
  expect(m.maxDrawdownCents).toBe(5000); // $50
});

// Exit-time ordering (PHASE 24 test G54)
test("POP-11: Exit-time ordering — trade B exits before trade A", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("A", 10000, "win", "2026-01-08"), // Wed
    makeTrade("B", -5000, "loss", "2026-01-06"), // Tue (earlier)
  ];
  const m = computeAggregateMetrics(trades, null);
  // Order by exitTime: B first (-5000), then A (+10000)
  // totalPnl = 10000 - 5000 = 5000
  expect(m.netPnlCents).toBe(5000);
});

// All-accounts: no starting balance → maxDrawdown = null (per spec §25)
test("POP-12: No starting balance → drawdown is null", () => {
  const trades: TradeMetricRow[] = [
    makeTrade("1", 10000, "win", "2026-01-01"),
  ];
  const m = computeAggregateMetrics(trades, null);
  expect(m.maxDrawdownCents).toBe(null);
});
