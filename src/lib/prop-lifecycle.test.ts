import { describe, it, expect } from "bun:test";
import {
  parsePropLifecycleMetadata,
  serializePropLifecycleMetadata,
  generateDefaultPhasesForModel,
  evaluatePropLifecycle,
  transitionToNextPhase,
  recordManualFirmRejection,
  requestPayout,
  calculatePropAggregates,
  simulateHypotheticalScenario,
  type PropAccountModel,
  type TradeForLifecycle,
} from "./prop-lifecycle-engine";

describe("AlphaPips — Prop Firm Account Lifecycle, Compliance & Failure Diagnosis", () => {
  const START_DATE = "2026-10-01T10:00:00Z";

  // -------------------------------------------------------------------------
  // Scenario 1: One-step challenge passes and becomes eligible for funding
  // -------------------------------------------------------------------------
  it("Scenario 1: One-step challenge passes and becomes eligible for funding", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000, // $100k
      profitTargetCents: 1000000, // 10% ($10k)
      minTradingDays: 3,
      startDate: START_DATE,
    });
    meta.accountModel = "one_step";
    meta.phases = generateDefaultPhasesForModel("one_step", {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      minTradingDays: 3,
      startDate: START_DATE,
    });
    meta.currentPhaseId = meta.phases[0].id;

    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 400000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
      { id: "t2", netPnlCents: 350000, entryTime: "2026-10-03T12:00:00Z", exitTime: "2026-10-03T14:00:00Z", status: "win" },
      { id: "t3", netPnlCents: 300000, entryTime: "2026-10-04T12:00:00Z", exitTime: "2026-10-04T14:00:00Z", status: "win" },
    ];

    const result = evaluatePropLifecycle(
      { id: "c1", propFirm: "FundingPips", startDate: START_DATE },
      meta,
      trades,
      new Date("2026-10-05T12:00:00Z")
    );

    expect(result.netProfitCents).toBe(1050000); // $10,500 > $10,000 target
    expect(result.tradingDaysCount).toBe(3);
    expect(result.minDaysMet).toBe(true);
    expect(result.profitTargetReached).toBe(true);
    expect(result.status).toBe("passed");
    expect(result.activePhase.phaseType).toBe("evaluation");

    // Transition to Phase 2 (Funded)
    const { updatedMeta, newPhase } = transitionToNextPhase(meta, true);
    expect(newPhase?.phaseType).toBe("funded");
    expect(updatedMeta.currentPhaseId).toBe(newPhase!.id);
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Two-step challenge passes Phase 1, activates Phase 2, and becomes funded
  // -------------------------------------------------------------------------
  it("Scenario 2: Two-step challenge passes Phase 1, activates Phase 2, and subsequently becomes funded", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000, // Phase 1: 10%
      minTradingDays: 4,
      startDate: START_DATE,
    });
    meta.accountModel = "two_step";
    meta.phases = generateDefaultPhasesForModel("two_step", {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      minTradingDays: 4,
      startDate: START_DATE,
    });
    meta.currentPhaseId = meta.phases[0].id;

    // Phase 1 trades: 4 days, $10,200 profit
    const p1Trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 300000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
      { id: "t2", netPnlCents: 250000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
      { id: "t3", netPnlCents: 250000, entryTime: "2026-10-03T12:00:00Z", exitTime: "2026-10-03T14:00:00Z", status: "win" },
      { id: "t4", netPnlCents: 220000, entryTime: "2026-10-04T12:00:00Z", exitTime: "2026-10-04T14:00:00Z", status: "win" },
    ];

    const p1Eval = evaluatePropLifecycle({ id: "c2", propFirm: "FTMO", startDate: START_DATE }, meta, p1Trades);
    expect(p1Eval.status).toBe("passed");

    // Transition to Phase 2
    const { updatedMeta: metaP2, newPhase: phase2 } = transitionToNextPhase(meta, true);
    expect(phase2?.name).toBe("Phase 2: Practitioner");
    expect(metaP2.currentPhaseId).toBe("phase_2");

    // Phase 2 trades: Target is 5% ($5,000)
    const p2Start = new Date(phase2!.startDate).getTime();
    const p2Trades: TradeForLifecycle[] = [
      ...p1Trades,
      { id: "t5", netPnlCents: 150000, entryTime: new Date(p2Start + 1000).toISOString(), exitTime: new Date(p2Start + 5000).toISOString(), status: "win" },
      { id: "t6", netPnlCents: 150000, entryTime: new Date(p2Start + 86400000).toISOString(), exitTime: new Date(p2Start + 86400000 + 4000).toISOString(), status: "win" },
      { id: "t7", netPnlCents: 120000, entryTime: new Date(p2Start + 2 * 86400000).toISOString(), exitTime: new Date(p2Start + 2 * 86400000 + 4000).toISOString(), status: "win" },
      { id: "t8", netPnlCents: 100000, entryTime: new Date(p2Start + 3 * 86400000).toISOString(), exitTime: new Date(p2Start + 3 * 86400000 + 4000).toISOString(), status: "win" },
    ];

    const p2Eval = evaluatePropLifecycle({ id: "c2", propFirm: "FTMO", startDate: START_DATE }, metaP2, p2Trades);
    expect(p2Eval.netProfitCents).toBe(520000); // Only counts trades within Phase 2!
    expect(p2Eval.profitTargetReached).toBe(true);
    expect(p2Eval.status).toBe("passed");

    // Transition to Funded
    const { updatedMeta: metaFunded, newPhase: phaseFunded } = transitionToNextPhase(metaP2, true);
    expect(phaseFunded?.phaseType).toBe("funded");
    expect(phaseFunded?.name).toBe("Funded Stage");
    expect(metaFunded.currentPhaseId).toBe("phase_funded_3");
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Multi-step challenge progresses through configurable stages
  // -------------------------------------------------------------------------
  it("Scenario 3: Multi-step challenge progresses through configurable stages", () => {
    const multiPhases = generateDefaultPhasesForModel("multi_step", {
      startingBalanceCents: 5000000,
      customPhaseCount: 4,
      startDate: START_DATE,
    });
    expect(multiPhases.length).toBe(4);
    expect(multiPhases[0].name).toBe("Phase 1: Step 1");
    expect(multiPhases[1].name).toBe("Phase 2: Step 2");
    expect(multiPhases[2].name).toBe("Phase 3: Step 3");
    expect(multiPhases[3].name).toBe("Funded Stage");
    expect(multiPhases[3].phaseType).toBe("funded");
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Instant funded account has no evaluation phase
  // -------------------------------------------------------------------------
  it("Scenario 4: Instant funded account has no evaluation phase", () => {
    const instantPhases = generateDefaultPhasesForModel("instant_funded", {
      startingBalanceCents: 10000000,
      startDate: START_DATE,
    });
    expect(instantPhases.length).toBe(1);
    expect(instantPhases[0].phaseType).toBe("funded");
    expect(instantPhases[0].profitTargetCents).toBeNull(); // No profit target to pass
    expect(instantPhases[0].status).toBe("in_progress");

    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      stage: "funded",
      startDate: START_DATE,
    });
    expect(meta.accountModel).toBe("instant_funded");

    const res = evaluatePropLifecycle({ id: "inst", propFirm: "Apex", startDate: START_DATE }, meta, []);
    expect(res.status).toBe("funded");
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Challenge meets profit target but fails consistency
  // -------------------------------------------------------------------------
  it("Scenario 5: Challenge meets profit target but fails consistency", () => {
    const meta = parsePropLifecycleMetadata(null, 50, { // 50% consistency threshold
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      minTradingDays: 3,
      startDate: START_DATE,
    });
    // Set consistency rule to hard_breach
    const rule = meta.phases[0].rules.find((r) => r.ruleKey === "consistency");
    if (rule) {
      rule.config.consistencyAction = "hard_breach";
      rule.config.threshold = 50;
    }

    // Trade 1 on Day 1 generates $8,000 (80% of total $10,000 profit)
    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 800000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
      { id: "t2", netPnlCents: 100000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
      { id: "t3", netPnlCents: 100000, entryTime: "2026-10-03T12:00:00Z", exitTime: "2026-10-03T14:00:00Z", status: "win" },
    ];

    const res = evaluatePropLifecycle({ id: "c5", propFirm: "FundingPips", startDate: START_DATE }, meta, trades);
    expect(res.profitTargetReached).toBe(true);
    expect(res.bestDayPctOfTotal).toBe(80);
    expect(res.consistencyBreached).toBe(true);
    expect(res.status).toBe("breached"); // Hard breach fails challenge
    expect(res.violations.some((v) => v.ruleKey === "consistency")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Challenge meets visible rules but receives an externally recorded firm rejection
  // -------------------------------------------------------------------------
  it("Scenario 6: Challenge meets visible rules but receives an externally recorded firm rejection", () => {
    let meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      minTradingDays: 2,
      startDate: START_DATE,
    });

    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 600000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
      { id: "t2", netPnlCents: 500000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
    ];

    meta = recordManualFirmRejection(meta, {
      firmCommunication: "High-frequency latency arbitrage detected across tick clusters.",
      undisclosedRuleName: "Undisclosed Arbitrage Execution Clause",
      userVerified: true,
      documents: ["ticket_18492.pdf"],
    });

    expect(meta.isFirmDispute).toBe(true);

    const res = evaluatePropLifecycle({ id: "c6", propFirm: "MyForexFunds", startDate: START_DATE }, meta, trades);
    expect(res.status).toBe("failed");
    expect(res.statusReason).toContain("Undisclosed Arbitrage Execution Clause");
  });

  // -------------------------------------------------------------------------
  // Scenario 7: Daily loss breach
  // -------------------------------------------------------------------------
  it("Scenario 7: Daily loss breach", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      dailyLossLimitCents: 500000, // $5,000 max daily loss
      startDate: START_DATE,
    });

    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: -550000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "loss" },
    ];

    const res = evaluatePropLifecycle({ id: "c7", propFirm: "FTMO", startDate: START_DATE }, meta, trades, new Date("2026-10-01T16:00:00Z"));
    expect(res.dailyLossBreached).toBe(true);
    expect(res.status).toBe("breached");
    expect(res.violations.some((v) => v.ruleKey === "daily_loss" && v.amountExceeded === "$500.00")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Static drawdown breach
  // -------------------------------------------------------------------------
  it("Scenario 8: Static drawdown breach", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000, // $100k
      maxDrawdownCents: 1000000, // $10k static max drawdown
      drawdownType: "static",
      startDate: START_DATE,
    });

    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: -600000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "loss" },
      { id: "t2", netPnlCents: -450000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "loss" },
    ];

    const res = evaluatePropLifecycle({ id: "c8", propFirm: "FTMO", startDate: START_DATE }, meta, trades);
    expect(res.drawdownBreached).toBe(true);
    expect(res.currentDrawdownCents).toBe(1050000);
    expect(res.status).toBe("breached");
  });

  // -------------------------------------------------------------------------
  // Scenario 9: Trailing drawdown breach
  // -------------------------------------------------------------------------
  it("Scenario 9: Trailing drawdown breach tracks peak high-water mark", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 5000000, // $50k
      maxDrawdownCents: 250000, // $2,500 trailing drawdown
      drawdownType: "trailing",
      startDate: START_DATE,
    });
    meta.phases[0].drawdownType = "trailing";
    meta.phases[0].maxDrawdownCents = 250000;

    // Trade 1 wins $4,000 -> Account reaches $54,000 (New high-water mark)
    // Trade 2 loses $3,000 -> Account drops to $51,000
    // Trailing drawdown = $54,000 - $51,000 = $3,000 > $2,500 limit -> BREACH!
    // (Even though account is still ABOVE the initial $50,000 starting balance!)
    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 400000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
      { id: "t2", netPnlCents: -300000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "loss" },
    ];

    const res = evaluatePropLifecycle({ id: "c9", propFirm: "Apex", startDate: START_DATE }, meta, trades);
    expect(res.highWaterMarkCents).toBe(5400000);
    expect(res.currentBalanceCents).toBe(5100000);
    expect(res.currentDrawdownCents).toBe(300000); // $3,000 from peak
    expect(res.drawdownBreached).toBe(true);
    expect(res.status).toBe("breached");
  });

  // -------------------------------------------------------------------------
  // Scenario 10: Equity-based breach caused by open positions
  // -------------------------------------------------------------------------
  it("Scenario 10: Equity-based breach caused by open positions", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      maxDrawdownCents: 800000, // $8,000 max equity drawdown
      startDate: START_DATE,
    });
    meta.phases[0].drawdownBasis = "equity";
    meta.phases[0].maxDrawdownCents = 800000;

    // Closed trade was flat ($0), but open trade is floating -$9,000
    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 0, entryTime: "2026-10-01T10:00:00Z", exitTime: "2026-10-01T11:00:00Z", status: "breakeven" },
      { id: "t2", netPnlCents: -900000, entryTime: "2026-10-01T12:00:00Z", exitTime: null, status: "open" },
    ];

    const res = evaluatePropLifecycle({ id: "c10", propFirm: "FundedNext", startDate: START_DATE }, meta, trades);
    expect(res.currentBalanceCents).toBe(10000000);
    expect(res.currentEquityCents).toBe(9100000); // $100k - $9k floating = $91k
    expect(res.currentDrawdownCents).toBe(900000); // $9,000 drawdown based on equity
    expect(res.drawdownBreached).toBe(true);
    expect(res.status).toBe("breached");
  });

  // -------------------------------------------------------------------------
  // Scenario 11: Payout eligibility and payout history
  // -------------------------------------------------------------------------
  it("Scenario 11: Payout eligibility and payout history", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      stage: "funded",
      startDate: START_DATE,
    });
    meta.accountModel = "instant_funded";
    meta.phases = generateDefaultPhasesForModel("instant_funded", {
      startingBalanceCents: 10000000,
      startDate: START_DATE,
    });
    meta.payoutConfig.profitSplitPct = 80;
    meta.payoutConfig.minPayoutCents = 100000; // $1,000
    meta.payoutConfig.minProfitableDays = 2;

    // Trades across 2 days generating $8,000 total net profit
    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 450000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
      { id: "t2", netPnlCents: 350000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
    ];

    const res = evaluatePropLifecycle({ id: "c11", propFirm: "FTMO", startDate: START_DATE }, meta, trades);
    expect(res.payoutEligibility.eligible).toBe(true);
    expect(res.payoutEligibility.availableProfitCents).toBe(800000);
    expect(res.payoutEligibility.traderShareCents).toBe(640000); // 80% of $8k = $6,400
    expect(res.payoutEligibility.firmShareCents).toBe(160000); // 20% of $8k = $1,600

    // Request payout
    const { updatedMeta, payout } = requestPayout(meta, 500000, "First bi-weekly withdrawal");
    expect(payout.amountCents).toBe(500000);
    expect(payout.netTraderPayoutCents).toBe(400000);
    expect(payout.status).toBe("requested");
    expect(updatedMeta.payouts.length).toBe(1);
    expect(updatedMeta.events.some((e) => e.type === "payout_requested")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 12: Trade edits automatically update the appropriate challenge
  // -------------------------------------------------------------------------
  it("Scenario 12: Trade edits automatically update the appropriate challenge", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      dailyLossLimitCents: 500000,
      startDate: START_DATE,
    });

    let trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: -200000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "loss" },
    ];

    let res = evaluatePropLifecycle({ id: "c12", propFirm: "FTMO", startDate: START_DATE }, meta, trades, new Date("2026-10-01T15:00:00Z"));
    expect(res.todayLossCents).toBe(200000);
    expect(res.dailyLossBreached).toBe(false);

    // Edit trade (e.g. commission added or trade loss enlarged)
    trades = [
      { id: "t1", netPnlCents: -520000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "loss" },
    ];

    res = evaluatePropLifecycle({ id: "c12", propFirm: "FTMO", startDate: START_DATE }, meta, trades, new Date("2026-10-01T15:00:00Z"));
    expect(res.todayLossCents).toBe(520000);
    expect(res.dailyLossBreached).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 13: Multiple challenges connected to different accounts never mix data
  // -------------------------------------------------------------------------
  it("Scenario 13: Multiple challenges connected to different accounts never mix their data", () => {
    const metaAccountA = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 5000000,
      startDate: START_DATE,
    });
    const metaAccountB = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 20000000,
      startDate: START_DATE,
    });

    const tradesAccountA: TradeForLifecycle[] = [
      { id: "tradeA1", netPnlCents: 250000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
    ];
    const tradesAccountB: TradeForLifecycle[] = [
      { id: "tradeB1", netPnlCents: -900000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "loss" },
    ];

    const resA = evaluatePropLifecycle({ id: "cA", propFirm: "Apex", startDate: START_DATE }, metaAccountA, tradesAccountA);
    const resB = evaluatePropLifecycle({ id: "cB", propFirm: "FundedNext", startDate: START_DATE }, metaAccountB, tradesAccountB);

    expect(resA.currentBalanceCents).toBe(5250000);
    expect(resA.netProfitCents).toBe(250000);
    expect(resB.currentBalanceCents).toBe(19100000);
    expect(resB.netProfitCents).toBe(-900000);

    // Multi-challenge aggregate statistics
    const aggregates = calculatePropAggregates([
      { id: "cA", propFirm: "Apex", meta: metaAccountA, evalResult: resA },
      { id: "cB", propFirm: "FundedNext", meta: metaAccountB, evalResult: resB },
    ]);

    expect(aggregates.totalChallenges).toBe(2);
    expect(aggregates.byFirm["Apex"].netPnlCents).toBe(250000);
    expect(aggregates.byFirm["FundedNext"].netPnlCents).toBe(-900000);
  });

  // -------------------------------------------------------------------------
  // Scenario 14: Consistency threshold normalization & safe denominator
  // -------------------------------------------------------------------------
  it("Scenario 14: Normalizes extreme consistency thresholds and handles zero/negative profit safely", () => {
    // 1. Threshold of 8600% (raw basis points or scaled percent) auto-normalizes to 86%
    const meta = parsePropLifecycleMetadata(
      JSON.stringify({
        __format: "alphapips_challenge_meta_v1",
        consistencyThresholdPct: 8600,
        consistencyAction: "dilution_required",
      }),
      null,
      { startingBalanceCents: 10000000, startDate: START_DATE }
    );

    const activePhase = meta.phases.find((p) => p.id === meta.currentPhaseId)!;
    const consistencyRule = activePhase.rules.find((r) => r.ruleKey === "consistency");
    expect(consistencyRule).toBeDefined();

    // 2. Evaluate with negative overall net profit — bestDayPctOfTotal must be null, not NaN or exploding
    const losingTrades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 50000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
      { id: "t2", netPnlCents: -150000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "loss" },
    ];

    const evalLosing = evaluatePropLifecycle({ id: "c14", propFirm: "Alpha Capital", startDate: START_DATE }, meta, losingTrades);
    expect(evalLosing.netProfitCents).toBe(-100000);
    expect(evalLosing.bestDayPctOfTotal).toBeNull();
    expect(evalLosing.consistencyBreached).toBe(false);

    // 3. Evaluate with positive profit: bestDay is $500, Day 2 is $500 -> total $1,000 (50% concentration <= 86%)
    const winningTrades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 50000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
      { id: "t2", netPnlCents: 50000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
    ];

    const evalWinning = evaluatePropLifecycle({ id: "c14", propFirm: "Alpha Capital", startDate: START_DATE }, meta, winningTrades);
    expect(evalWinning.netProfitCents).toBe(100000);
    expect(evalWinning.bestDayPctOfTotal).toBe(50);
    expect(evalWinning.consistencyBreached).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Scenario 15: Phase transition policies & permanent snapshot creation
  // -------------------------------------------------------------------------
  it("Scenario 15: Transitions phases with snapshot creation and supports carry_forward vs fresh_baseline", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      accountModel: "two_step",
      startingBalanceCents: 10000000,
      startDate: START_DATE,
    });

    const snapshot = {
      phaseId: "phase_1",
      phaseName: "Phase 1: Student",
      sequence: 1,
      completedAt: new Date().toISOString(),
      startingBalanceCents: 10000000,
      finalBalanceCents: 11000000,
      finalEquityCents: 11000000,
      netProfitCents: 1000000,
      tradeCount: 15,
      winRate: 73.3,
      profitFactor: 2.8,
      status: "passed" as const,
      rulesPassedCount: 6,
      rulesTotalCount: 6,
    };

    // Test fresh baseline transition
    const { updatedMeta: freshMeta, newPhase: freshPhase } = transitionToNextPhase(meta, true, {
      policy: "fresh_baseline",
      currentSnapshot: snapshot,
    });

    expect(freshPhase).toBeDefined();
    expect(freshPhase?.id).toBe("phase_2");
    expect(freshPhase?.startingBalanceCents).toBe(10000000); // fresh $100K baseline

    const phase1Frozen = freshMeta.phases.find((p) => p.id === "phase_1")!;
    expect(phase1Frozen.status).toBe("passed");
    expect(phase1Frozen.snapshot?.netProfitCents).toBe(1000000);
    expect(phase1Frozen.snapshot?.tradeCount).toBe(15);

    // Test carry forward transition
    const { newPhase: carryPhase } = transitionToNextPhase(meta, true, {
      policy: "carry_forward",
      currentSnapshot: snapshot,
    });

    expect(carryPhase?.startingBalanceCents).toBe(11000000); // carries forward $110K
  });

  // -------------------------------------------------------------------------
  // Scenario 16: Rule Simulator accurate hypothetical projections
  // -------------------------------------------------------------------------
  it("Scenario 16: Accurately simulates hypothetical trade scenarios against active compliance limits", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000, // $100K
      profitTargetCents: 1000000,    // $10K
      dailyLossLimitCents: 500000,   // $5K
      maxDrawdownCents: 1000000,     // $10K
      drawdownType: "static",
      startDate: START_DATE,
    });

    const currentTrades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 400000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
    ];

    const currentEval = evaluatePropLifecycle({ id: "c16", propFirm: "FTMO", startDate: START_DATE }, meta, currentTrades, new Date("2026-10-01T15:00:00Z"));

    // Safe hypothetical trade: +$2,000 on same day
    const simSafe = simulateHypotheticalScenario(currentEval, {
      hypotheticalPnlCents: 200000,
    });
    expect(simSafe.isSafe).toBe(true);
    expect(simSafe.projectedBalanceCents).toBe(10600000);
    expect(simSafe.projectedDailyLossBreached).toBe(false);
    expect(simSafe.projectedDrawdownBreached).toBe(false);

    // Catastrophic hypothetical trade: -$6,000 loss today (exceeds $5,000 daily loss limit)
    const simLoss = simulateHypotheticalScenario(currentEval, {
      hypotheticalPnlCents: -600000,
    });
    expect(simLoss.isSafe).toBe(false);
    expect(simLoss.projectedDailyLossBreached).toBe(true);
    expect(simLoss.breachWarnings.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Scenario 17: Portfolio aggregates transparent financial reconciliation
  // -------------------------------------------------------------------------
  it("Scenario 17: Transparently separates realized cash outcome from simulated trading performance", () => {
    const meta1 = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      accountCostCents: 54000, // $540 fee
      startDate: START_DATE,
    });
    meta1.accountCostCents = 54000;

    const trades: TradeForLifecycle[] = [
      { id: "t1", netPnlCents: 1027000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" }, // +$10,270 profit
    ];

    const evalResult = evaluatePropLifecycle({ id: "c17", propFirm: "FTMO", startDate: START_DATE }, meta1, trades);

    const aggregates = calculatePropAggregates([
      { id: "c17", propFirm: "FTMO", meta: meta1, evalResult },
    ]);

    // Fees paid: $540
    expect(aggregates.totalFeesCents).toBe(54000);
    // Payouts received: $0 (evaluation challenge)
    expect(aggregates.totalPayoutsCents).toBe(0);
    // Net cash outcome: -$540
    expect(aggregates.netCashOutcomeCents).toBe(-54000);
    // Simulated trading profit: +$10,270
    expect(aggregates.totalSimulatedTradingProfitCents).toBe(1027000);
  });

  // -------------------------------------------------------------------------
  // Scenario 18: Multi-currency portfolio accounting isolates denominations
  // -------------------------------------------------------------------------
  it("Scenario 18: Multi-currency portfolio accounting isolates denominations without cross-currency contamination", () => {
    // Challenge 1: USD FTMO $100K ($540 fee, +$10,270 profit)
    const metaUSD = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      accountCostCents: 54000,
      startDate: START_DATE,
    });
    metaUSD.accountCostCents = 54000;
    const tradesUSD: TradeForLifecycle[] = [
      { id: "t_usd", netPnlCents: 1027000, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
    ];
    const evalUSD = evaluatePropLifecycle({ id: "c_usd", propFirm: "FTMO", startDate: START_DATE }, metaUSD, tradesUSD);

    // Challenge 2: GBP Alpha Capital £100K (£340 fee, +£26,863.84 profit)
    const metaGBP = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      accountCostCents: 34000,
      startDate: START_DATE,
    });
    metaGBP.accountCostCents = 34000;
    const tradesGBP: TradeForLifecycle[] = [
      { id: "t_gbp", netPnlCents: 2686384, entryTime: "2026-10-01T12:00:00Z", exitTime: "2026-10-01T14:00:00Z", status: "win" },
    ];
    const evalGBP = evaluatePropLifecycle({ id: "c_gbp", propFirm: "Alpha Capital", startDate: START_DATE }, metaGBP, tradesGBP);

    const aggregates = calculatePropAggregates([
      { id: "c_usd", propFirm: "FTMO", currency: "USD", meta: metaUSD, evalResult: evalUSD },
      { id: "c_gbp", propFirm: "Alpha Capital", currency: "GBP", meta: metaGBP, evalResult: evalGBP },
    ]);

    expect(aggregates.isMultiCurrency).toBe(true);
    expect(aggregates.byCurrency["USD"]).toBeDefined();
    expect(aggregates.byCurrency["GBP"]).toBeDefined();

    // Isolated USD numbers
    expect(aggregates.byCurrency["USD"].totalFeesCents).toBe(54000);
    expect(aggregates.byCurrency["USD"].simulatedTradingProfitCents).toBe(1027000);
    expect(aggregates.byCurrency["USD"].netCashOutcomeCents).toBe(-54000);

    // Isolated GBP numbers
    expect(aggregates.byCurrency["GBP"].totalFeesCents).toBe(34000);
    expect(aggregates.byCurrency["GBP"].simulatedTradingProfitCents).toBe(2686384);
    expect(aggregates.byCurrency["GBP"].netCashOutcomeCents).toBe(-34000);

    // Firm currency attribution
    expect(aggregates.byFirm["FTMO"].currency).toBe("USD");
    expect(aggregates.byFirm["Alpha Capital"].currency).toBe("GBP");
  });

  // -------------------------------------------------------------------------
  // Scenario 19: Safely isolates synthetic demo trades from live compliance evaluation
  // -------------------------------------------------------------------------
  it("Scenario 19: Safely isolates synthetic demo trades from live compliance evaluation", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 5000000, // $50k
      profitTargetCents: 300000, // $3k
      startDate: START_DATE,
    });

    const trades: TradeForLifecycle[] = [
      {
        id: "t_synth_1",
        netPnlCents: 150000,
        entryTime: "2026-10-02T12:00:00Z",
        exitTime: "2026-10-02T14:00:00Z",
        status: "win",
        tagsJson: JSON.stringify(["synthetic_sample", "demo", "apex_repair_isolation"]),
        notes: "[AUDIT: SYNTHETIC_SAMPLE_RECORD - Isolated from genuine prop challenge statistics]",
      },
      {
        id: "t_synth_2",
        netPnlCents: 200000,
        entryTime: "2026-10-03T12:00:00Z",
        exitTime: "2026-10-03T14:00:00Z",
        status: "win",
        tagsJson: JSON.stringify(["synthetic_sample"]),
      },
      {
        id: "t_genuine_1",
        netPnlCents: 50000,
        entryTime: "2026-10-04T12:00:00Z",
        exitTime: "2026-10-04T14:00:00Z",
        status: "win",
        tagsJson: JSON.stringify(["ict", "fvg"]),
      },
    ];

    const result = evaluatePropLifecycle(
      { id: "c_apex", propFirm: "Apex Trader Funding", startDate: START_DATE },
      meta,
      trades
    );

    // Only the 1 genuine trade is counted; the 2 synthetic demo trades are isolated
    expect(result.tradeCount).toBe(1);
    expect(result.netProfitCents).toBe(50000); // Only $500 genuine profit, not $4,000
    expect(result.currentBalanceCents).toBe(5050000);
  });

  // -------------------------------------------------------------------------
  // Scenario 20: Supports transitioning to a separate funded account instance
  // -------------------------------------------------------------------------
  it("Scenario 20: Supports transitioning to a separate funded account instance with activation tracking", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      startDate: START_DATE,
    });
    meta.phases = generateDefaultPhasesForModel("two_step", {
      startingBalanceCents: 10000000,
      startDate: START_DATE,
    });
    meta.currentPhaseId = meta.phases[0].id;

    // Transition Phase 1 -> Phase 2
    const step1 = transitionToNextPhase(meta, true, {
      policy: "carry_forward",
    });
    expect(step1.newPhase?.sequence).toBe(2);

    // Transition Phase 2 -> Funded Phase with dedicated separate account ID
    const fundedAccountId = "acc_ftmo_funded_master_9999";
    const activationDate = "2026-11-01T12:00:00Z";
    const step2 = transitionToNextPhase(step1.updatedMeta, true, {
      policy: "fresh_baseline",
      fundedAccountId,
      fundedAccountName: "FTMO Funded Master #9999",
      activationDate,
    });

    expect(step2.newPhase?.phaseType).toBe("funded");
    expect(step2.newPhase?.tradingAccountId).toBe(fundedAccountId);
    expect(step2.newPhase?.fundedAccountName).toBe("FTMO Funded Master #9999");
    expect(step2.newPhase?.activationDate).toBe(activationDate);
    expect(step2.newPhase?.fundedStatus).toBe("active");
  });

  // -------------------------------------------------------------------------
  // Scenario 21: Direct-funded account (zero evaluation phases)
  // -------------------------------------------------------------------------
  it("Scenario 21: Direct-funded account starts immediately in funded stage", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 5000000, // $50k
      accountModel: "direct_funded",
      startDate: START_DATE,
    });
    meta.phases = generateDefaultPhasesForModel("direct_funded", {
      startingBalanceCents: 5000000,
      startDate: START_DATE,
    });
    meta.currentPhaseId = meta.phases[0].id;

    expect(meta.phases.length).toBe(1);
    expect(meta.phases[0].phaseType).toBe("funded");
    expect(meta.phases[0].profitTargetCents).toBeNull(); // No profit target ceiling

    const trades: TradeForLifecycle[] = [
      { id: "df_t1", netPnlCents: 150000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
      { id: "df_t2", netPnlCents: 200000, entryTime: "2026-10-03T12:00:00Z", exitTime: "2026-10-03T14:00:00Z", status: "win" },
    ];

    const res = evaluatePropLifecycle(
      { id: "c_df", propFirm: "Direct Funding Corp", startDate: START_DATE },
      meta,
      trades
    );

    expect(res.status).toBe("funded");
    expect(res.netProfitCents).toBe(350000);
    expect(res.activePhase.phaseType).toBe("funded");
  });

  // -------------------------------------------------------------------------
  // Scenario 22: Phase 1 only configuration does NOT automatically activate next phase
  // -------------------------------------------------------------------------
  it("Scenario 22: Phase 1 only configuration requires explicit verification and does not auto-activate subsequent phases", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000, // $10k
      minTradingDays: 2,
      accountModel: "two_step",
      startDate: START_DATE,
    });

    const trades: TradeForLifecycle[] = [
      { id: "p1_1", netPnlCents: 500000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
      { id: "p1_2", netPnlCents: 600000, entryTime: "2026-10-03T12:00:00Z", exitTime: "2026-10-03T14:00:00Z", status: "win" },
    ];

    const res = evaluatePropLifecycle(
      { id: "c_p1", propFirm: "FTMO", startDate: START_DATE },
      meta,
      trades
    );

    // Target reached + min days met -> passed, BUT active phase remains phase_1 until manually transitioned
    expect(res.status).toBe("passed");
    expect(res.activePhase.id).toBe("phase_1");
    expect(res.allPhases[1].status).toBe("awaiting_activation"); // Phase 2 is NOT active yet
  });

  // -------------------------------------------------------------------------
  // Scenario 23: Custom firm-defined stages
  // -------------------------------------------------------------------------
  it("Scenario 23: Custom firm-defined stage model with custom parameters", () => {
    const phases = generateDefaultPhasesForModel("custom", {
      startingBalanceCents: 20000000, // $200k
      profitTargetCents: 1600000, // 8% target
      dailyLossLimitCents: 1000000, // 5% daily loss
      maxDrawdownCents: 2000000, // 10% max DD
      customPhaseCount: 2,
      startDate: START_DATE,
    });

    expect(phases.length).toBe(3); // 2 custom eval phases + 1 funded stage
    expect(phases[0].name).toBe("Custom Phase 1");
    expect(phases[1].name).toBe("Custom Phase 2");
    expect(phases[2].name).toBe("Funded Stage");
    expect(phases[2].phaseType).toBe("funded");
  });

  // -------------------------------------------------------------------------
  // Scenario 24: Firm rejection without established rule violation displays exact mandatory text
  // -------------------------------------------------------------------------
  it("Scenario 24: Firm rejection without established violation displays exact mandatory text", () => {
    let meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      minTradingDays: 2,
      startDate: START_DATE,
    });

    const trades: TradeForLifecycle[] = [
      { id: "t_pass_1", netPnlCents: 600000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
      { id: "t_pass_2", netPnlCents: 500000, entryTime: "2026-10-03T12:00:00Z", exitTime: "2026-10-03T14:00:00Z", status: "win" },
    ];

    // Firm rejects account with no established rule breach
    meta = recordManualFirmRejection(meta, {
      firmCommunication: "Internal risk management discretionary decline.",
      userVerified: true,
    });

    const res = evaluatePropLifecycle(
      { id: "c_rej", propFirm: "Alpha Pro Firm", startDate: START_DATE },
      meta,
      trades
    );

    expect(res.status).toBe("failed");
    expect(res.statusReason).toBe("Firm rejection — no violation established by currently configured rules.");
  });

  // -------------------------------------------------------------------------
  // Scenario 25: Segregation of No-Trade Observations
  // -------------------------------------------------------------------------
  it("Scenario 25: Segregation of No-Trade Observations from challenge metrics", () => {
    const meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      startDate: START_DATE,
    });

    const realTrades: TradeForLifecycle[] = [
      { id: "real_1", netPnlCents: 300000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
    ];

    const resBefore = evaluatePropLifecycle(
      { id: "c_nt", propFirm: "FTMO", startDate: START_DATE },
      meta,
      realTrades
    );

    // Draft or planned entries (such as planned setups or non-execution observations) must not count
    const tradesWithDrafts: TradeForLifecycle[] = [
      ...realTrades,
      { id: "draft_entry", netPnlCents: 500000, entryTime: "2026-10-02T15:00:00Z", exitTime: "2026-10-02T16:00:00Z", status: "planned", isDraft: true },
      { id: "planned_entry", netPnlCents: -400000, entryTime: "2026-10-03T12:00:00Z", exitTime: null, status: "planned" },
    ];

    const resAfter = evaluatePropLifecycle(
      { id: "c_nt", propFirm: "FTMO", startDate: START_DATE },
      meta,
      tradesWithDrafts
    );

    expect(resAfter.tradeCount).toBe(resBefore.tradeCount);
    expect(resAfter.netProfitCents).toBe(resBefore.netProfitCents);
    expect(resAfter.currentBalanceCents).toBe(resBefore.currentBalanceCents);
    expect(resAfter.winRate).toBe(resBefore.winRate);
  });

  // -------------------------------------------------------------------------
  // Scenario 26: Historical snapshot immutability
  // -------------------------------------------------------------------------
  it("Scenario 26: Completing a phase preserves historical snapshot immutably", () => {
    let meta = parsePropLifecycleMetadata(null, null, {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      minTradingDays: 2,
      startDate: START_DATE,
    });

    const trades: TradeForLifecycle[] = [
      { id: "t_snap_1", netPnlCents: 500000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
      { id: "t_snap_2", netPnlCents: 550000, entryTime: "2026-10-03T12:00:00Z", exitTime: "2026-10-03T14:00:00Z", status: "win" },
    ];

    const evalRes = evaluatePropLifecycle({ id: "c_snap", propFirm: "FTMO", startDate: START_DATE }, meta, trades);

    // Transition with snapshot
    const transition = transitionToNextPhase(meta, true, {
      policy: "carry_forward",
      currentSnapshot: {
        phaseId: "phase_1",
        phaseName: "Phase 1: Student",
        sequence: 1,
        completedAt: "2026-10-03T15:00:00Z",
        startingBalanceCents: 10000000,
        finalBalanceCents: 11050000,
        finalEquityCents: 11050000,
        netProfitCents: 1050000,
        tradeCount: 2,
        winRate: 100,
        profitFactor: 99.99,
        status: "passed",
        rulesPassedCount: 10,
        rulesTotalCount: 10,
      },
    });

    const updatedMeta = transition.updatedMeta;
    const p1 = updatedMeta.phases.find((p) => p.id === "phase_1");
    expect(p1?.snapshot?.netProfitCents).toBe(1050000);
    expect(p1?.snapshot?.finalBalanceCents).toBe(11050000);

    // Mutating active phase does not alter Phase 1's completed snapshot
    const activePhase = updatedMeta.phases.find((p) => p.id === updatedMeta.currentPhaseId);
    if (activePhase) {
      activePhase.profitTargetCents = 2500000;
    }
    expect(p1?.snapshot?.netProfitCents).toBe(1050000);
  });

  // -------------------------------------------------------------------------
  // Scenario 27: Consistency rule dilution required calculation
  // -------------------------------------------------------------------------
  it("Scenario 27: Consistency rule triggers at_risk and dilution requirement", () => {
    const meta = parsePropLifecycleMetadata(null, 50, {
      startingBalanceCents: 10000000,
      profitTargetCents: 1000000,
      minTradingDays: 2,
      startDate: START_DATE,
    });

    // Configure 50% consistency with dilution required
    const p1 = meta.phases[0];
    const cRule = p1.rules.find((r) => r.ruleKey === "consistency");
    if (cRule) {
      cRule.config.threshold = 50;
      cRule.config.consistencyAction = "dilution_required";
    }

    // Day 1 makes $8,000, Day 2 makes $2,000 -> Total $10,000, best day is 80% (exceeds 50%)
    const trades: TradeForLifecycle[] = [
      { id: "t_c1", netPnlCents: 800000, entryTime: "2026-10-02T12:00:00Z", exitTime: "2026-10-02T14:00:00Z", status: "win" },
      { id: "t_c2", netPnlCents: 200000, entryTime: "2026-10-03T12:00:00Z", exitTime: "2026-10-03T14:00:00Z", status: "win" },
    ];

    const res = evaluatePropLifecycle(
      { id: "c_consist", propFirm: "FundedNext", startDate: START_DATE },
      meta,
      trades
    );

    // Target is reached, but consistency dilution is required
    expect(res.profitTargetReached).toBe(true);
    expect(res.consistencyBreached).toBe(true);
    expect(res.bestDayPctOfTotal).toBe(80);
    expect(res.status).toBe("in_progress"); // Blocked from passing until diluted
    expect(res.statusReason).toContain("consistency dilution is required");
  });
});
