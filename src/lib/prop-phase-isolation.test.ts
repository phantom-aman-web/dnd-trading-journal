import { describe, it, expect } from "bun:test";
import {
  filterTradesForPhase,
  getPhaseForTrade,
  evaluatePropLifecycle,
  type PropPhaseConfig,
  type PropLifecycleMetadata,
  type TradeForLifecycle,
} from "./prop-lifecycle-engine";

describe("D-019: Prop Challenge Phase Trade Isolation Engine", () => {
  const challengeStartDate = "2026-01-01T00:00:00.000Z";
  const phase1EndDate = "2026-01-15T23:59:59.999Z";
  const phase2StartDate = "2026-01-16T00:00:00.000Z";

  const phase1: PropPhaseConfig = {
    id: "phase-1",
    name: "Phase 1 Evaluation",
    sequence: 1,
    phaseType: "evaluation",
    status: "passed",
    startingBalanceCents: 10000000, // $100k
    profitTargetCents: 800000, // $8k (8%)
    dailyLossLimitCents: 500000, // $5k (5%)
    maxDrawdownCents: 1000000, // $10k (10%)
    startDate: challengeStartDate,
    endDate: phase1EndDate,
    rules: [],
  };

  const phase2: PropPhaseConfig = {
    id: "phase-2",
    name: "Phase 2 Verification",
    sequence: 2,
    phaseType: "verification",
    status: "active",
    startingBalanceCents: 10000000, // $100k
    profitTargetCents: 500000, // $5k (5%)
    dailyLossLimitCents: 500000, // $5k (5%)
    maxDrawdownCents: 1000000, // $10k (10%)
    startDate: phase2StartDate,
    endDate: null,
    rules: [],
  };

  const allPhases = [phase1, phase2];

  // 19 historical trades belonging strictly to Phase 1
  const phase1Trades: TradeForLifecycle[] = Array.from({ length: 19 }, (_, i) => ({
    id: `trade-p1-${i + 1}`,
    entryTime: new Date(new Date(challengeStartDate).getTime() + (i + 1) * 3600000 * 12).toISOString(),
    exitTime: new Date(new Date(challengeStartDate).getTime() + (i + 1) * 3600000 * 14).toISOString(),
    netPnlCents: i % 3 === 0 ? -10000 : 50000, // mostly wins
    grossPnlCents: i % 3 === 0 ? -10000 : 50000,
    status: i % 3 === 0 ? "loss" : "win",
  }));

  // 2 trades belonging strictly to Phase 2
  const phase2Trades: TradeForLifecycle[] = [
    {
      id: "trade-p2-1",
      entryTime: "2026-01-16T10:00:00.000Z",
      exitTime: "2026-01-16T14:00:00.000Z",
      netPnlCents: 120000,
      grossPnlCents: 120000,
      status: "win",
    },
    {
      id: "trade-p2-2",
      entryTime: "2026-01-17T11:00:00.000Z",
      exitTime: "2026-01-17T15:00:00.000Z",
      netPnlCents: -40000,
      grossPnlCents: -40000,
      status: "loss",
    },
  ];

  const allTrades = [...phase1Trades, ...phase2Trades];

  it("filters Phase 1 trades out of Phase 2's active phase view", () => {
    // When Phase 2 has 0 trades yet
    const isolatedEmptyPhase2 = filterTradesForPhase(phase1Trades, phase2, allPhases, challengeStartDate);
    expect(isolatedEmptyPhase2.length).toBe(0);

    // When Phase 2 has 2 trades
    const isolatedPhase2 = filterTradesForPhase(allTrades, phase2, allPhases, challengeStartDate);
    expect(isolatedPhase2.length).toBe(2);
    expect(isolatedPhase2.map((t) => t.id)).toEqual(["trade-p2-1", "trade-p2-2"]);
  });

  it("filters Phase 2 trades out of Phase 1's historical view", () => {
    const isolatedPhase1 = filterTradesForPhase(allTrades, phase1, allPhases, challengeStartDate);
    expect(isolatedPhase1.length).toBe(19);
    for (const t of isolatedPhase1) {
      expect(t.id.startsWith("trade-p1-")).toBe(true);
    }
  });

  it("evaluates Phase 2 lifecycle metrics strictly from Phase 2 trades (zero bleed from Phase 1)", () => {
    const meta: PropLifecycleMetadata = {
      challengeId: "test-challenge",
      currentPhaseId: "phase-2",
      accountModel: "two_step",
      phases: allPhases,
    };

    const res = evaluatePropLifecycle(
      {
        id: "test-challenge",
        propFirm: "AlphaFirms",
        startDate: challengeStartDate,
      },
      meta,
      allTrades,
      new Date("2026-01-18T00:00:00.000Z")
    );

    // Phase 2 must reflect ONLY the 2 Phase 2 trades!
    expect(res.tradeCount).toBe(2);
    expect(res.winCount).toBe(1);
    expect(res.lossCount).toBe(1);
    expect(res.winRate).toBe(50); // 1 win / 2 trades = 50%
    expect(res.netProfitCents).toBe(80000); // 120,000 - 40,000 = +$800
    expect(res.startingBalanceCents).toBe(10000000);
    expect(res.currentBalanceCents).toBe(10080000);
  });

  it("handles a fresh Phase 2 with 0 trades: returns 0 trades, 0% WR, not Phase 1 stats", () => {
    const meta: PropLifecycleMetadata = {
      challengeId: "test-challenge",
      currentPhaseId: "phase-2",
      accountModel: "two_step",
      phases: allPhases,
    };

    // Only Phase 1 trades in the account history
    const res = evaluatePropLifecycle(
      {
        id: "test-challenge",
        propFirm: "AlphaFirms",
        startDate: challengeStartDate,
      },
      meta,
      phase1Trades,
      new Date("2026-01-16T12:00:00.000Z")
    );

    expect(res.tradeCount).toBe(0);
    expect(res.winCount).toBe(0);
    expect(res.lossCount).toBe(0);
    expect(res.netProfitCents).toBe(0);
    expect(res.tradingDaysCount).toBe(0);
    expect(res.winRate).toBe(0);
  });

  it("identifies the correct phase for each trade using getPhaseForTrade", () => {
    const t1 = phase1Trades[0];
    const p1 = getPhaseForTrade(t1, allPhases, challengeStartDate);
    expect(p1?.id).toBe("phase-1");

    const t2 = phase2Trades[0];
    const p2 = getPhaseForTrade(t2, allPhases, challengeStartDate);
    expect(p2?.id).toBe("phase-2");
  });

  it("never double-counts trades at exact boundary transitions", () => {
    const boundaryTrade: TradeForLifecycle = {
      id: "trade-boundary",
      entryTime: "2026-01-15T22:00:00.000Z",
      exitTime: phase1EndDate, // exactly at phase 1 end
      netPnlCents: 10000,
      status: "win",
    };

    const inP1 = filterTradesForPhase([boundaryTrade], phase1, allPhases, challengeStartDate);
    const inP2 = filterTradesForPhase([boundaryTrade], phase2, allPhases, challengeStartDate);

    // Boundary trade at phase1EndDate belongs to Phase 1, never Phase 2
    expect(inP1.length).toBe(1);
    expect(inP2.length).toBe(0);
  });
});
