import { describe, expect, it } from "bun:test";
import {
  computeChecklistAdherence,
  evaluateTradeAdherence,
  type TradeChecklistRecord,
} from "./checklist-adherence";
import { ChecklistItem } from "./checklist-evaluation";

describe("Checklist Adherence Engine (Decoupled from Win Rate)", () => {
  const sampleItems: ChecklistItem[] = [
    { id: "rule_0", text: "HTF Key Level Reached", required: true, weight: 1, evidenceRequired: false },
    { id: "rule_1", text: "Liquidity Sweep Confirmed", required: true, weight: 1, evidenceRequired: false },
    { id: "rule_2", text: "Market Structure Shift (MSS)", required: true, weight: 1, evidenceRequired: false },
    { id: "rule_3", text: "FVG Retracement Entry", required: true, weight: 1, evidenceRequired: false },
    { id: "rule_4", text: "Optimal Trade Entry (OTE) 62%", required: false, weight: 0.5, evidenceRequired: false }, // Optional
  ];

  it("ADHERENCE-1: Fully completed required checklist items produces 100% adherence", () => {
    const answers = JSON.stringify({
      rule_0: { checked: true },
      rule_1: { checked: true },
      rule_2: { checked: true },
      rule_3: { checked: true },
      rule_4: { checked: false }, // optional unchecked
    });

    const res = evaluateTradeAdherence(sampleItems, answers);
    expect(res.hasRecordedAnswers).toBe(true);
    expect(res.requiredTotal).toBe(4);
    expect(res.requiredCompleted).toBe(4);
    expect(res.optionalTotal).toBe(1);
    expect(res.optionalCompleted).toBe(0);

    const trades: TradeChecklistRecord[] = [
      {
        id: "t1",
        strategyId: "strat1",
        strategyVersionId: "v1",
        rulesJson: JSON.stringify(sampleItems),
        rawAnswersJson: answers,
        outcome: "loss", // LOSING trade with 100% discipline!
      },
    ];

    const summary = computeChecklistAdherence(trades);
    expect(summary.totalEvaluatedTrades).toBe(1);
    expect(summary.totalCompletedRequiredItems).toBe(4);
    expect(summary.totalApplicableRequiredItems).toBe(4);
    expect(summary.overallAdherencePct).toBe(100);

    const strat = summary.strategies[0];
    expect(strat.adherencePct).toBe(100);
    expect(strat.winRate).toBe(0); // Win rate is 0% while adherence is 100%!
  });

  it("ADHERENCE-2: Optional items do not inflate or penalize required adherence", () => {
    // Check 2 out of 4 required items, but check the optional item
    const answers = JSON.stringify({
      rule_0: { checked: true },
      rule_1: { checked: true },
      rule_2: { checked: false },
      rule_3: { checked: false },
      rule_4: { checked: true }, // optional checked
    });

    const res = evaluateTradeAdherence(sampleItems, answers);
    expect(res.requiredTotal).toBe(4);
    expect(res.requiredCompleted).toBe(2);
    expect(res.optionalTotal).toBe(1);
    expect(res.optionalCompleted).toBe(1);

    const trades: TradeChecklistRecord[] = [
      {
        id: "t1",
        strategyId: "strat1",
        strategyVersionId: "v1",
        rulesJson: JSON.stringify(sampleItems),
        rawAnswersJson: answers,
        outcome: "win",
      },
    ];

    const summary = computeChecklistAdherence(trades);
    const strat = summary.strategies[0];
    // 2/4 = 50%
    expect(strat.adherencePct).toBe(50);
  });

  it("ADHERENCE-3: Decoupling verification — Win rate and adherence are independent", () => {
    // 3 trades: all wins (100% win rate), but only 1 out of 4 required rules followed (25% adherence)
    const sloppyAnswers = JSON.stringify({
      rule_0: { checked: true },
      rule_1: { checked: false },
      rule_2: { checked: false },
      rule_3: { checked: false },
    });

    const trades: TradeChecklistRecord[] = [
      {
        id: "t1",
        strategyId: "strat1",
        strategyVersionId: "v1",
        rulesJson: JSON.stringify(sampleItems),
        rawAnswersJson: sloppyAnswers,
        outcome: "win",
      },
      {
        id: "t2",
        strategyId: "strat1",
        strategyVersionId: "v1",
        rulesJson: JSON.stringify(sampleItems),
        rawAnswersJson: sloppyAnswers,
        outcome: "win",
      },
      {
        id: "t3",
        strategyId: "strat1",
        strategyVersionId: "v1",
        rulesJson: JSON.stringify(sampleItems),
        rawAnswersJson: sloppyAnswers,
        outcome: "win",
      },
    ];

    const summary = computeChecklistAdherence(trades);
    const strat = summary.strategies[0];
    expect(strat.winRate).toBe(1); // 100% win rate
    expect(strat.adherencePct).toBe(25); // 25% adherence (3 / 12 items)
    expect(strat.completedRequiredItems).toBe(3);
    expect(strat.totalRequiredItems).toBe(12);
  });

  it("ADHERENCE-4: Missing checklist responses are flagged as missing data and not counted as completed", () => {
    const trades: TradeChecklistRecord[] = [
      {
        id: "t1",
        strategyId: "strat1",
        strategyVersionId: "v1",
        rulesJson: JSON.stringify(sampleItems),
        rawAnswersJson: null, // missing responses
        outcome: "win",
      },
      {
        id: "t2",
        strategyId: "strat1",
        strategyVersionId: "v1",
        rulesJson: JSON.stringify(sampleItems),
        rawAnswersJson: "{}", // empty object
        outcome: "loss",
      },
    ];

    const summary = computeChecklistAdherence(trades);
    expect(summary.totalTrades).toBe(2);
    expect(summary.totalEvaluatedTrades).toBe(0);
    expect(summary.totalMissingDataTrades).toBe(2);
    expect(summary.overallAdherencePct).toBeNull(); // Insufficient data

    const strat = summary.strategies[0];
    expect(strat.missingDataTrades).toBe(2);
    expect(strat.evaluatedTrades).toBe(0);
    expect(strat.adherencePct).toBeNull();
  });

  it("ADHERENCE-5: Different strategy versions retain independent checklist rules and evaluations", () => {
    const v1Rules = [
      { id: "rule_0", text: "V1 Rule A", required: true, weight: 1, evidenceRequired: false },
      { id: "rule_1", text: "V1 Rule B", required: true, weight: 1, evidenceRequired: false },
    ];
    const v2Rules = [
      { id: "rule_0", text: "V2 Rule A", required: true, weight: 1, evidenceRequired: false },
      { id: "rule_1", text: "V2 Rule B", required: true, weight: 1, evidenceRequired: false },
      { id: "rule_2", text: "V2 Rule C", required: true, weight: 1, evidenceRequired: false },
    ];

    const trades: TradeChecklistRecord[] = [
      {
        id: "t1",
        strategyId: "strat_momentum",
        strategyVersionId: "v1_id",
        strategyVersionLabel: "1.0",
        rulesJson: JSON.stringify(v1Rules),
        rawAnswersJson: JSON.stringify({ rule_0: { checked: true }, rule_1: { checked: true } }), // 2/2 = 100%
        outcome: "win",
      },
      {
        id: "t2",
        strategyId: "strat_momentum",
        strategyVersionId: "v2_id",
        strategyVersionLabel: "2.0",
        rulesJson: JSON.stringify(v2Rules),
        rawAnswersJson: JSON.stringify({ rule_0: { checked: true }, rule_1: { checked: true }, rule_2: { checked: false } }), // 2/3 = 66.7%
        outcome: "loss",
      },
    ];

    const summary = computeChecklistAdherence(trades);
    const strat = summary.strategies[0];
    expect(strat.totalTrades).toBe(2);
    expect(strat.evaluatedTrades).toBe(2);
    expect(strat.completedRequiredItems).toBe(4);
    expect(strat.totalRequiredItems).toBe(5);
    expect(strat.adherencePct).toBe(80); // (2 + 2) / (2 + 3) = 4/5 = 80%

    // Check version cohorts
    const v1 = strat.versions.find((v) => v.versionLabel === "1.0");
    const v2 = strat.versions.find((v) => v.versionLabel === "2.0");
    expect(v1?.adherencePct).toBe(100);
    expect(v2?.adherencePct).toBe(66.7);
  });
});
