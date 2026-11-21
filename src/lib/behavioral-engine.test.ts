import { describe, it, expect } from "bun:test";
import {
  computeProcessOutcomeMatrix,
  generateBehavioralWarnings,
  computeBehavioralAnalytics,
  type TradeBehaviorRow,
} from "./behavioral-engine";

describe("Phase 4: Behavioral Engine & Process Matrix Tests", () => {
  const mockTrades: TradeBehaviorRow[] = [
    // Disciplined Win
    {
      id: "t1",
      instrumentSymbol: "EURUSD",
      direction: "long",
      entryTime: "2026-09-01T08:00:00Z",
      exitTime: "2026-09-01T09:30:00Z",
      status: "win",
      netPnlCents: 50000, // +$500
      actualR: 2.0,
      plannedRiskCents: 25000,
      plannedRiskPct: 1.0,
      session: "london",
      processCompliant: true,
      behaviorFlags: [],
    },
    // Good Loss (Variance)
    {
      id: "t2",
      instrumentSymbol: "GBPUSD",
      direction: "short",
      entryTime: "2026-09-01T10:00:00Z",
      exitTime: "2026-09-01T11:00:00Z",
      status: "loss",
      netPnlCents: -25000, // -$250
      actualR: -1.0,
      plannedRiskCents: 25000,
      plannedRiskPct: 1.0,
      session: "london",
      processCompliant: true,
      behaviorFlags: [],
    },
    // Rapid re-entry after loss => Revenge trading test
    {
      id: "t3",
      instrumentSymbol: "GBPUSD",
      direction: "long",
      entryTime: "2026-09-01T11:08:00Z", // 8 mins after loss!
      exitTime: "2026-09-01T11:45:00Z",
      status: "loss",
      netPnlCents: -50000, // -$500, oversized
      actualR: -1.0,
      plannedRiskCents: 50000, // 2x normal risk
      plannedRiskPct: 2.0,
      session: "london",
      processCompliant: false,
      behaviorFlags: ["revenge", "oversizing"],
    },
    // Lucky Win (Bad Habit)
    {
      id: "t4",
      instrumentSymbol: "XAUUSD",
      direction: "long",
      entryTime: "2026-09-02T13:30:00Z",
      exitTime: "2026-09-02T14:15:00Z",
      status: "win",
      netPnlCents: 30000, // +$300
      actualR: 1.2,
      plannedRiskCents: 25000,
      plannedRiskPct: 1.0,
      session: "ny_am",
      processCompliant: false,
      behaviorFlags: ["fomo"],
    },
    // Undisciplined Loss
    {
      id: "t5",
      instrumentSymbol: "NAS100",
      direction: "short",
      entryTime: "2026-09-02T15:00:00Z",
      exitTime: "2026-09-02T15:40:00Z",
      status: "loss",
      netPnlCents: -75000, // -$750
      actualR: -2.5,
      plannedRiskCents: 30000,
      plannedRiskPct: 1.2,
      session: "ny_pm",
      processCompliant: false,
      behaviorFlags: ["moved_stop", "chased_entry"],
    },
    // Another rapid re-entry after loss
    {
      id: "t6",
      instrumentSymbol: "NAS100",
      direction: "long",
      entryTime: "2026-09-02T15:48:00Z", // 8 mins after t5 loss!
      exitTime: "2026-09-02T16:30:00Z",
      status: "loss",
      netPnlCents: -30000,
      actualR: -1.0,
      plannedRiskCents: 30000,
      plannedRiskPct: 1.2,
      session: "ny_pm",
      processCompliant: false,
      behaviorFlags: ["revenge"],
    },
  ];

  it("calculates the 2x2 Process vs Outcome Matrix accurately", () => {
    const res = computeProcessOutcomeMatrix(mockTrades);

    expect(res.totalTrades).toBe(6);
    expect(res.quadrants.disciplinedWin.tradesCount).toBe(1);
    expect(res.quadrants.disciplinedWin.totalPnlCents).toBe(50000);
    expect(res.quadrants.disciplinedWin.avgR).toBe(2.0);

    expect(res.quadrants.goodLoss.tradesCount).toBe(1);
    expect(res.quadrants.goodLoss.totalPnlCents).toBe(-25000);
    expect(res.quadrants.goodLoss.avgR).toBe(-1.0);

    expect(res.quadrants.luckyWin.tradesCount).toBe(1);
    expect(res.quadrants.luckyWin.totalPnlCents).toBe(30000);

    expect(res.quadrants.undisciplinedLoss.tradesCount).toBe(3); // t3, t5, t6
    expect(res.overallProcessAdherencePct).toBe(33); // 2 of 6 trades followed process
  });

  it("generates behavioral warnings for revenge trading sequences", () => {
    const warnings = generateBehavioralWarnings(mockTrades);

    const revengeWarn = warnings.find((w) => w.type === "rapid_reentry" || w.type === "revenge_trading");
    expect(revengeWarn).toBeDefined();
    expect(revengeWarn?.sampleSize).toContain("N=2");
    expect(revengeWarn?.neutralDescription).toContain("within 20 minutes");
    expect(revengeWarn?.tradeIds).toEqual(["t3", "t6"]);
  });

  it("supports configurable warning thresholds", () => {
    // With 5 minutes cooldown threshold, re-entries at 10-15 mins should not trigger
    const strictWarnings = generateBehavioralWarnings(mockTrades, { rapidReentryMinutes: 5 });
    const rapidWarn = strictWarnings.find((w) => w.type === "rapid_reentry" || w.type === "revenge_trading");
    expect(rapidWarn).toBeUndefined();
  });

  it("computes streak performance (after win vs after loss)", () => {
    const res = computeBehavioralAnalytics(mockTrades);

    expect(res.streakAnalysis.afterWin.tradesCount).toBe(2); // t2 (after t1), t5 (after t4)
    expect(res.streakAnalysis.afterLoss.tradesCount).toBe(3); // t3 (after t2), t4 (after t3), t6 (after t5)
    expect(res.streakAnalysis.afterLoss.winRate).toBe(33); // 1 win (t4) out of 3
  });

  it("evaluates risk consistency metrics", () => {
    const res = computeBehavioralAnalytics(mockTrades);

    expect(res.riskConsistency.medianRiskCents).toBe(30000);
    expect(res.riskConsistency.rating).toBeDefined();
    expect(res.riskConsistency.coefficientOfVariationPct).toBeGreaterThan(0);
  });

  it("aggregates mistake tags by total financial cost", () => {
    const res = computeBehavioralAnalytics(mockTrades);

    expect(res.mistakeTags.length).toBeGreaterThan(0);
    // Moved stop caused -$750 loss
    const movedStop = res.mistakeTags.find((t) => t.tag === "moved_stop");
    expect(movedStop).toBeDefined();
    expect(movedStop?.totalPnlCents).toBe(-75000);
    expect(movedStop?.occurrences).toBe(1);
  });
});
