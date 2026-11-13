import { describe, expect, test } from "bun:test";

interface ChecklistItem {
  title: string;
  required?: boolean;
}

function diffRules(v1Rules: ChecklistItem[], v2Rules: ChecklistItem[]) {
  const v1Map = new Map(v1Rules.map((r) => [r.title.toLowerCase(), r]));
  const v2Map = new Map(v2Rules.map((r) => [r.title.toLowerCase(), r]));

  const added = v2Rules.filter((r) => !v1Map.has(r.title.toLowerCase()));
  const removed = v1Rules.filter((r) => !v2Map.has(r.title.toLowerCase()));
  const unchanged = v2Rules.filter((r) => v1Map.has(r.title.toLowerCase()));

  return { added, removed, unchanged };
}

describe("Strategy Version Comparison Engine", () => {
  test("STRAT-1: Detects added, removed, and unchanged rules", () => {
    const v1 = [
      { title: "Liquidity Sweep on 15m", required: true },
      { title: "Fair Value Gap Tap", required: true },
      { title: "Risk max 1% per trade", required: true },
    ];

    const v2 = [
      { title: "Liquidity Sweep on 15m", required: true },
      { title: "Risk max 1% per trade", required: true },
      { title: "Session Filter: London & NY only", required: true }, // Added
      // "Fair Value Gap Tap" removed
    ];

    const diff = diffRules(v1, v2);

    expect(diff.added.length).toBe(1);
    expect(diff.added[0].title).toBe("Session Filter: London & NY only");

    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0].title).toBe("Fair Value Gap Tap");

    expect(diff.unchanged.length).toBe(2);
  });

  test("STRAT-2: Sample size warning flag triggered when N < 20", () => {
    const isLowSample = (tradesCount: number) => tradesCount < 20;

    expect(isLowSample(0)).toBe(true);
    expect(isLowSample(12)).toBe(true);
    expect(isLowSample(19)).toBe(true);
    expect(isLowSample(20)).toBe(false);
    expect(isLowSample(55)).toBe(false);
  });

  test("STRAT-3: Metric deltas calculation", () => {
    const v1 = {
      trades: 15,
      netPnlCents: 50000,
      winRatePct: 50.0,
      profitFactor: 1.5,
      avgR: 1.2,
    };

    const v2 = {
      trades: 25,
      netPnlCents: 120000,
      winRatePct: 64.0,
      profitFactor: 2.1,
      avgR: 1.8,
    };

    const deltas = {
      trades: v2.trades - v1.trades,
      netPnlCents: v2.netPnlCents - v1.netPnlCents,
      winRatePct: +(v2.winRatePct - v1.winRatePct).toFixed(1),
      profitFactor: +(v2.profitFactor - v1.profitFactor).toFixed(2),
      avgR: +(v2.avgR - v1.avgR).toFixed(2),
    };

    expect(deltas.trades).toBe(10);
    expect(deltas.netPnlCents).toBe(70000);
    expect(deltas.winRatePct).toBe(14.0);
    expect(deltas.profitFactor).toBe(0.6);
    expect(deltas.avgR).toBe(0.6);
  });
});

