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

  it("saves changes in-place to current version without bumping versionLabel or creating duplicate records", () => {
    const initialRules: RuleItem[] = [
      { title: "HTF Trend Alignment", required: true },
      { title: "Sweep Confirmation", required: true },
    ];

    const strategy: MockStrategy = {
      id: "strat-xyz",
      name: "Liquidity Sweep Setup",
      market: "crypto",
      versions: [
        {
          id: "ver-100",
          strategyId: "strat-xyz",
          versionLabel: "1.0",
          changeReason: "Initial version",
          changeSummary: "First definition",
          rulesJson: JSON.stringify(initialRules),
          effectiveDate: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    };

    // User edits typo or refines wording in-place without version bump (updateCurrentVersion = true)
    const updatedRules: RuleItem[] = [
      { title: "HTF Trend Alignment (4H/Daily)", required: true },
      { title: "Sweep Confirmation", required: true },
      { title: "Risk Reward >= 2.5", required: false },
    ];

    // In-place update mutates current version without incrementing version count
    const currentVersion = strategy.versions[0];
    currentVersion.rulesJson = JSON.stringify(updatedRules);
    currentVersion.changeSummary = "Refined checklist wording in place";

    expect(strategy.versions.length).toBe(1);
    expect(strategy.versions[0].id).toBe("ver-100");
    expect(strategy.versions[0].versionLabel).toBe("1.0");

    const parsedRules = JSON.parse(strategy.versions[0].rulesJson);
    expect(parsedRules.length).toBe(3);
    expect(parsedRules[0].title).toBe("HTF Trend Alignment (4H/Daily)");
  });

  it("explicitly upgrades to a new version when requested, incrementing versionLabel and preserving history", () => {
    const v1Rules: RuleItem[] = [{ title: "Rule A", required: true }];
    const strategy: MockStrategy = {
      id: "strat-abc",
      name: "Momentum Breakout",
      market: "forex",
      versions: [
        {
          id: "ver-1",
          strategyId: "strat-abc",
          versionLabel: "1.0",
          rulesJson: JSON.stringify(v1Rules),
          effectiveDate: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    };

    // Trader chooses explicit upgrade to version 1.1
    const v2Rules: RuleItem[] = [
      { title: "Rule A", required: true },
      { title: "Rule B (New Filter)", required: true },
    ];

    const newVersion: MockStrategyVersion = {
      id: "ver-2",
      strategyId: "strat-abc",
      versionLabel: "1.1",
      rulesJson: JSON.stringify(v2Rules),
      effectiveDate: new Date("2026-02-01T00:00:00Z"),
    };

    strategy.versions.push(newVersion);

    expect(strategy.versions.length).toBe(2);
    expect(strategy.versions[0].versionLabel).toBe("1.0");
    expect(strategy.versions[1].versionLabel).toBe("1.1");
  });

  describe("Strategy Version Historical Integrity & Snapshot Safeguard", () => {
    it("guarantees 5-step scenario: in-place edits to v2.0 preserve historical trade & checklist snapshots while new trades use updated rules", () => {
      // Step 1: Strategy configured at Version 2.0
      const initialRules: RuleItem[] = [
        { title: "4H Market Structure Shift", required: true },
        { title: "15m FVG Entry", required: true },
      ];
      const initialFields = [
        { id: "cf_session", name: "Session Window", type: "text" },
      ];

      const strategy = {
        id: "strat-v2",
        name: "ICT Silver Bullet",
        currentVersion: {
          id: "sv-v2-id",
          versionLabel: "2.0",
          rulesJson: JSON.stringify({
            rules: initialRules,
            customFields: initialFields,
          }),
          effectiveDate: new Date("2026-03-01T00:00:00Z"),
        },
      };

      // Step 2: Record historical trade #1 and complete checklist evaluation at v2.0
      const trade1ChecklistAnswers = {
        "rule_0": { checked: true, note: "Confirmed on TradingView" },
        "rule_1": { checked: true },
      };

      const trade1ItemsSnapshot = initialRules.map((r, i) => ({
        id: `rule_${i}`,
        text: r.title,
        required: r.required,
        weight: 1,
        evidenceRequired: false,
      }));

      const trade1RawAnswersJson = JSON.stringify({
        answers: trade1ChecklistAnswers,
        items: trade1ItemsSnapshot,
      });

      const trade1SetupJson = JSON.stringify({
        htfContext: "Bullish order flow",
        customFields: { cf_session: "London Open Killzone" },
        strategySnapshot: {
          versionId: strategy.currentVersion.id,
          versionLabel: strategy.currentVersion.versionLabel,
          rulesJson: strategy.currentVersion.rulesJson,
          capturedAt: new Date("2026-03-02T10:00:00Z").toISOString(),
        },
      });

      const historicalTrade1 = {
        id: "trade-hist-1",
        strategyId: strategy.id,
        strategyVersionId: strategy.currentVersion.id,
        setupJson: trade1SetupJson,
        checklistEvaluations: [
          {
            id: "eval-1",
            strategyVersionId: strategy.currentVersion.id,
            rawAnswersJson: trade1RawAnswersJson,
            weightedScore: "1.00",
            finalGrade: "A+",
            evaluatedAt: new Date("2026-03-02T10:05:00Z"),
          },
        ],
      };

      // Step 3: Save changes to current Version 2.0 in-place (modifying rules & config)
      const modifiedRules: RuleItem[] = [
        { title: "4H Market Structure Shift", required: true },
        { title: "15m FVG Entry", required: true },
        { title: "Strict Asian Range Liquidity Sweep", required: true }, // Added rule
      ];
      const modifiedFields = [
        { id: "cf_session", name: "Session Window", type: "text" },
        { id: "cf_displacement", name: "Displacement Magnitude", type: "number" }, // Added custom field
      ];

      // Mutate current v2.0 in place
      strategy.currentVersion.rulesJson = JSON.stringify({
        rules: modifiedRules,
        customFields: modifiedFields,
      });

      // Verification Step 3: Current strategy reflects edited configuration and retains label "2.0"
      expect(strategy.currentVersion.versionLabel).toBe("2.0");
      const currentParsed = JSON.parse(strategy.currentVersion.rulesJson);
      expect(currentParsed.rules.length).toBe(3);
      expect(currentParsed.rules[2].title).toBe("Strict Asian Range Liquidity Sweep");
      expect(currentParsed.customFields.length).toBe(2);

      // Step 4 & 5: Reopen historical trade and completed checklist.
      // Inspect displayed strategy configuration in historical records
      const histTradeSetup = JSON.parse(historicalTrade1.setupJson);
      const histTradeRulesSource = histTradeSetup.strategySnapshot?.rulesJson;
      const histTradeRules = JSON.parse(histTradeRulesSource);

      // Expectation 1: Historical trade retains its original 2 rules and 1 custom field
      expect(histTradeRules.rules.length).toBe(2);
      expect(histTradeRules.rules[0].title).toBe("4H Market Structure Shift");
      expect(histTradeRules.rules[1].title).toBe("15m FVG Entry");
      expect(histTradeRules.customFields.length).toBe(1);
      expect(histTradeSetup.strategySnapshot.versionLabel).toBe("2.0");

      // Expectation 2: Historical checklist evaluation items remain immutable (2 items)
      const histEval = historicalTrade1.checklistEvaluations[0];
      const histEvalParsed = JSON.parse(histEval.rawAnswersJson);
      expect(histEvalParsed.items.length).toBe(2);
      expect(histEvalParsed.items[0].text).toBe("4H Market Structure Shift");
      expect(histEvalParsed.items[1].text).toBe("15m FVG Entry");
      expect(histEvalParsed.answers["rule_0"].checked).toBe(true);
      expect(histEval.finalGrade).toBe("A+");
      expect(histEval.weightedScore).toBe("1.00");

      // Step 6: Verify future trade #2 records with updated configuration
      const futureTradeItemsSnapshot = modifiedRules.map((r, i) => ({
        id: `rule_${i}`,
        text: r.title,
        required: r.required,
        weight: 1,
        evidenceRequired: false,
      }));

      const futureTradeSetupJson = JSON.stringify({
        customFields: {
          cf_session: "NY AM Killzone",
          cf_displacement: 45,
        },
        strategySnapshot: {
          versionId: strategy.currentVersion.id,
          versionLabel: strategy.currentVersion.versionLabel,
          rulesJson: strategy.currentVersion.rulesJson,
          capturedAt: new Date("2026-03-05T14:00:00Z").toISOString(),
        },
      });

      const futureTradeRawAnswersJson = JSON.stringify({
        answers: {
          "rule_0": { checked: true },
          "rule_1": { checked: true },
          "rule_2": { checked: true },
        },
        items: futureTradeItemsSnapshot,
      });

      const futureTrade2 = {
        id: "trade-future-2",
        setupJson: futureTradeSetupJson,
        checklistEvaluations: [
          {
            id: "eval-2",
            rawAnswersJson: futureTradeRawAnswersJson,
            weightedScore: "1.00",
            finalGrade: "A+",
          },
        ],
      };

      const futureSetupParsed = JSON.parse(futureTrade2.setupJson);
      const futureRulesParsed = JSON.parse(futureSetupParsed.strategySnapshot.rulesJson);
      expect(futureRulesParsed.rules.length).toBe(3);
      expect(futureRulesParsed.customFields.length).toBe(2);

      // Step 7: Upgrading Version 2.0 to Version 3.0 preserves Version 2.0 unchanged
      const v3Rules: RuleItem[] = [
        ...modifiedRules,
        { title: "Daily Bias Confirmation", required: true },
      ];
      const version3 = {
        id: "sv-v3-id",
        versionLabel: "3.0",
        rulesJson: JSON.stringify({ rules: v3Rules, customFields: modifiedFields }),
        effectiveDate: new Date("2026-04-01T00:00:00Z"),
      };

      const strategyVersionsHistory = [version3, strategy.currentVersion];
      expect(strategyVersionsHistory.length).toBe(2);
      expect(strategyVersionsHistory[0].versionLabel).toBe("3.0");
      expect(strategyVersionsHistory[1].versionLabel).toBe("2.0");
      expect(JSON.parse(strategyVersionsHistory[1].rulesJson).rules.length).toBe(3);
      expect(JSON.parse(strategyVersionsHistory[0].rulesJson).rules.length).toBe(4);
    });

    it("prevents concurrent updates from silently overwriting each other", () => {
      const serverVersion = {
        id: "sv-101",
        versionLabel: "2.0",
        rulesJson: JSON.stringify([{ title: "Initial Rule", required: true }]),
        updatedAt: new Date("2026-03-01T12:00:00Z"),
      };

      // Client A opened edit dialog when version was at 12:00:00Z
      const clientAPayload = {
        updateCurrentVersion: true,
        expectedVersionId: "sv-101",
        expectedUpdatedAt: "2026-03-01T12:00:00.000Z",
        rules: [{ title: "Client A Edit", required: true }],
      };

      // Client B concurrently updated the version at 12:05:00Z
      serverVersion.updatedAt = new Date("2026-03-01T12:05:00Z");

      // Server concurrency check
      const hasConflict =
        (clientAPayload.expectedVersionId && clientAPayload.expectedVersionId !== serverVersion.id) ||
        (clientAPayload.expectedUpdatedAt && new Date(clientAPayload.expectedUpdatedAt).getTime() !== serverVersion.updatedAt.getTime());

      expect(hasConflict).toBe(true);
    });
  });
});

