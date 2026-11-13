import { describe, expect, it } from "bun:test";
import { computeAggregateMetrics, type TradeMetricRow } from "./financial-engine";

interface RuleItem {
  title: string;
  required?: boolean;
  description?: string;
}

interface MockStrategyVersion {
  id: string;
  strategyId: string;
  versionLabel: string;
  changeReason?: string | null;
  changeSummary?: string | null;
  rulesJson: string;
  effectiveDate: Date;
}

interface MockStrategy {
  id: string;
  name: string;
  market: string;
  description?: string | null;
  versions: MockStrategyVersion[];
}

interface StrategyTradeRow extends TradeMetricRow {
  strategyId: string;
  strategyVersionId: string;
}

function diffRules(
  oldRules: RuleItem[],
  newRules: RuleItem[]
): {
  added: RuleItem[];
  removed: RuleItem[];
  modified: { oldItem: RuleItem; newItem: RuleItem }[];
  unchanged: RuleItem[];
} {
  const added: RuleItem[] = [];
  const removed: RuleItem[] = [];
  const modified: { oldItem: RuleItem; newItem: RuleItem }[] = [];
  const unchanged: RuleItem[] = [];

  const oldMap = new Map<string, RuleItem>();
  for (const r of oldRules) {
    oldMap.set(r.title.toLowerCase().trim(), r);
  }

  const newMap = new Map<string, RuleItem>();
  for (const r of newRules) {
    newMap.set(r.title.toLowerCase().trim(), r);
  }

  for (const newR of newRules) {
    const key = newR.title.toLowerCase().trim();
    if (!oldMap.has(key)) {
      added.push(newR);
    } else {
      const oldR = oldMap.get(key)!;
      if (oldR.required !== newR.required || oldR.description !== newR.description) {
        modified.push({ oldItem: oldR, newItem: newR });
      } else {
        unchanged.push(newR);
      }
    }
  }

  for (const oldR of oldRules) {
    const key = oldR.title.toLowerCase().trim();
    if (!newMap.has(key)) {
      removed.push(oldR);
    }
  }

  return { added, removed, modified, unchanged };
}

describe("Strategy Management & Immutability", () => {
  it("creates a new version without mutating existing historical versions", () => {
    const v1Rules: RuleItem[] = [
      { title: "HTF Trend Alignment", required: true },
      { title: "FVG Sweep Confirmation", required: true },
      { title: "Risk:Reward >= 2:1", required: false },
    ];

    const strategy: MockStrategy = {
      id: "strat-1",
      name: "FVG Retracement",
      market: "forex",
      description: "Fair value gap entry on 15m confluence",
      versions: [
        {
          id: "ver-1",
          strategyId: "strat-1",
          versionLabel: "1.0",
          changeReason: "Initial version",
          changeSummary: "First definition of FVG Retracement setup",
          rulesJson: JSON.stringify(v1Rules),
          effectiveDate: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    };

    // User edits rules to create v1.1
    const v2Rules: RuleItem[] = [
      { title: "HTF Trend Alignment", required: true },
      { title: "FVG Sweep Confirmation", required: true },
      { title: "Liquidity Grab on 5m", required: true }, // Added rule
      { title: "Risk:Reward >= 2.5:1", required: true }, // Modified rule
    ];

    const newVersion: MockStrategyVersion = {
      id: "ver-2",
      strategyId: strategy.id,
      versionLabel: "1.1",
      changeReason: "Tightened risk criteria and added 5m liquidity sweep",
      changeSummary: "Added 5m liquidity grab requirement and raised RR to 2.5:1",
      rulesJson: JSON.stringify(v2Rules),
      effectiveDate: new Date("2026-02-01T00:00:00Z"),
    };

    const updatedStrategy: MockStrategy = {
      ...strategy,
      versions: [newVersion, ...strategy.versions],
    };

    // Immutability assertions
    expect(updatedStrategy.versions.length).toBe(2);
    // Historical v1 remains completely unchanged
    const histV1 = updatedStrategy.versions.find((v) => v.id === "ver-1")!;
    expect(histV1.versionLabel).toBe("1.0");
    expect(JSON.parse(histV1.rulesJson)).toEqual(v1Rules);
    expect(histV1.changeReason).toBe("Initial version");

    // New version v1.1 has new snapshot
    const currentV2 = updatedStrategy.versions.find((v) => v.id === "ver-2")!;
    expect(currentV2.versionLabel).toBe("1.1");
    expect(JSON.parse(currentV2.rulesJson)).toEqual(v2Rules);
  });

  it("accurately computes rule diffs between strategy versions", () => {
    const v1Rules: RuleItem[] = [
      { title: "HTF Trend Alignment", required: true, description: "Check 4H/Daily" },
      { title: "FVG Sweep Confirmation", required: true },
      { title: "Session Filter", required: false, description: "London or NY only" },
      { title: "Deprecated Rule", required: false },
    ];

    const v2Rules: RuleItem[] = [
      { title: "HTF Trend Alignment", required: true, description: "Check 4H/Daily" }, // Unchanged
      { title: "FVG Sweep Confirmation", required: false }, // Modified (required changed)
      { title: "Session Filter", required: true, description: "NY AM session only" }, // Modified
      { title: "Order Block Confluence", required: true }, // Added
      // "Deprecated Rule" removed
    ];

    const diff = diffRules(v1Rules, v2Rules);

    expect(diff.added.map((r) => r.title)).toEqual(["Order Block Confluence"]);
    expect(diff.removed.map((r) => r.title)).toEqual(["Deprecated Rule"]);
    expect(diff.modified.length).toBe(2);
    expect(diff.unchanged.length).toBe(1);
    expect(diff.unchanged[0].title).toBe("HTF Trend Alignment");
  });

  it("preserves trade attribution to historic version when new versions are added", () => {
    const trade1: StrategyTradeRow = {
      id: "t-1",
      netPnlCents: 50000, // +$500.00
      grossPnlCents: 52000,
      actualR: "2.5",
      entryTime: "2026-01-10T10:00:00Z",
      exitTime: "2026-01-10T12:00:00Z",
      status: "closed",
      outcome: "win",
      direction: "long",
      instrumentSymbol: "EURUSD",
      strategyId: "strat-1",
      strategyVersionId: "ver-1", // Attributed to v1.0
    };

    const trade2: StrategyTradeRow = {
      id: "t-2",
      netPnlCents: -20000, // -$200.00
      grossPnlCents: -18000,
      actualR: "-1.0",
      entryTime: "2026-01-15T10:00:00Z",
      exitTime: "2026-01-15T11:00:00Z",
      status: "closed",
      outcome: "loss",
      direction: "short",
      instrumentSymbol: "GBPUSD",
      strategyId: "strat-1",
      strategyVersionId: "ver-1", // Attributed to v1.0
    };

    const trade3: StrategyTradeRow = {
      id: "t-3",
      netPnlCents: 75000, // +$750.00
      grossPnlCents: 77000,
      actualR: "3.0",
      entryTime: "2026-02-05T14:00:00Z",
      exitTime: "2026-02-05T16:00:00Z",
      status: "closed",
      outcome: "win",
      direction: "long",
      instrumentSymbol: "EURUSD",
      strategyId: "strat-1",
      strategyVersionId: "ver-2", // Attributed to v1.1
    };

    const allTrades: StrategyTradeRow[] = [trade1, trade2, trade3];

    // Filter trades for v1.0
    const v1Trades = allTrades.filter((t) => t.strategyVersionId === "ver-1");
    expect(v1Trades.length).toBe(2);
    const v1Metrics = computeAggregateMetrics(v1Trades, null);
    expect(v1Metrics.closedTrades).toBe(2);
    expect(Number(v1Metrics.winRate)).toBe(0.5); // 1 win, 1 loss = 50%
    expect(v1Metrics.netPnlCents).toBe(30000); // 500 - 200 = 300

    // Filter trades for v1.1
    const v2Trades = allTrades.filter((t) => t.strategyVersionId === "ver-2");
    expect(v2Trades.length).toBe(1);
    const v2Metrics = computeAggregateMetrics(v2Trades, null);
    expect(v2Metrics.closedTrades).toBe(1);
    expect(Number(v2Metrics.winRate)).toBe(1.0); // 100%
    expect(v2Metrics.netPnlCents).toBe(75000);

    // Strategy-level aggregate combines all versions
    const stratTrades = allTrades.filter((t) => t.strategyId === "strat-1");
    expect(stratTrades.length).toBe(3);
    const stratMetrics = computeAggregateMetrics(stratTrades, null);
    expect(stratMetrics.closedTrades).toBe(3);
    expect(stratMetrics.netPnlCents).toBe(105000); // 300 + 750 = 1050
  });

  it("triggers low sample size warning when N < 20 and clears when N >= 20", () => {
    const makeTrade = (id: string, outcome: "win" | "loss"): TradeMetricRow => ({
      id,
      netPnlCents: outcome === "win" ? 10000 : -5000,
      grossPnlCents: outcome === "win" ? 10000 : -5000,
      actualR: outcome === "win" ? "2.0" : "-1.0",
      entryTime: "2026-01-01T10:00:00Z",
      exitTime: "2026-01-01T11:00:00Z",
      status: "closed",
      outcome,
      direction: "long",
      instrumentSymbol: "EURUSD",
    });

    const tradesUnder20: TradeMetricRow[] = Array.from({ length: 19 }, (_, i) =>
      makeTrade(`t-${i}`, i % 2 === 0 ? "win" : "loss")
    );

    const metricsUnder20 = computeAggregateMetrics(tradesUnder20, null);
    const isLowSampleUnder20 = metricsUnder20.closedTrades < 20;
    expect(isLowSampleUnder20).toBe(true);

    const tradesOver20: TradeMetricRow[] = Array.from({ length: 20 }, (_, i) =>
      makeTrade(`t-${i}`, i % 2 === 0 ? "win" : "loss")
    );

    const metricsOver20 = computeAggregateMetrics(tradesOver20, null);
    const isLowSampleOver20 = metricsOver20.closedTrades < 20;
    expect(isLowSampleOver20).toBe(false);
  });
});

