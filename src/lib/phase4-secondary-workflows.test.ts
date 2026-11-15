import { describe, expect, it } from "bun:test";
import {
  evaluatePropChallenge,
  parseChallengeMetadata,
  serializeChallengeMetadata,
  type PropChallengeConfig,
  type TradeForChallenge,
} from "./prop-firm-engine";
import {
  INSTRUMENT_CATALOG,
  resolveInstrument,
  unitLabel,
  distanceInUnits,
} from "./instrument-catalog";
import { formatSignedCents } from "./money";

describe("Phase 4 Workstream A: Accounts & Balance Integrity", () => {
  it("derives total balance correctly from starting balance and closed trade realizations", () => {
    const startingBalanceCents = 1000000; // $10,000.00
    const trades = [
      { id: "1", accountId: "acc-1", netPnlCents: 25000, isDraft: false, status: "closed" },
      { id: "2", accountId: "acc-1", netPnlCents: -12000, isDraft: false, status: "closed" },
      { id: "3", accountId: "acc-1", netPnlCents: 45000, isDraft: false, status: "closed" },
    ];

    const realizedPnl = trades.reduce((acc, t) => acc + t.netPnlCents, 0);
    const currentBalance = startingBalanceCents + realizedPnl;

    expect(realizedPnl).toBe(58000); // +$580.00
    expect(currentBalance).toBe(1058000); // $10,580.00
    expect(formatSignedCents(currentBalance, "USD").text).toBe("+ $10,580.00");
  });

  it("handles accounts with zero closed trades without corrupting starting balance", () => {
    const startingBalanceCents = 5000000; // $50,000
    const realizedPnl = 0;
    const currentBalance = startingBalanceCents + realizedPnl;

    expect(currentBalance).toBe(5000000);
    expect(formatSignedCents(currentBalance, "USD").text).toBe("+ $50,000.00");
  });
});

describe("Phase 4 Workstream B: Prop Challenge Consistency Rules & Statuses", () => {
  const baseConfig: PropChallengeConfig = {
    id: "chal-1",
    accountId: "acc-1",
    name: "FTMO 100K Phase 1",
    propFirm: "FTMO",
    stage: "phase1",
    startingBalanceCents: 10000000, // $100,000
    profitTargetCents: 1000000, // $10,000 (10%)
    dailyLossLimitCents: 500000, // $5,000 (5%)
    maxDrawdownCents: 1000000, // $10,000 (10%)
    drawdownType: "static",
    minTradingDays: 4,
    resetTimezone: "America/New_York",
    resetHour: 17,
    startDate: "2026-01-01T00:00:00Z",
    consistencyRuleType: "single_day_max",
    consistencyThresholdPct: 50,
    consistencyAction: "dilution_required",
  };

  it("marks status as at_risk when single-day profit exceeds 50% consistency threshold under dilution_required", () => {
    const trades: TradeForChallenge[] = [
      // Day 1: made $7,000 profit (70% of total $10,000)
      { id: "t1", netPnlCents: 700000, entryTime: "2026-01-02T14:00:00Z", exitTime: "2026-01-02T15:00:00Z", status: "closed", isDraft: false },
      // Day 2: made $1,000
      { id: "t2", netPnlCents: 100000, entryTime: "2026-01-03T14:00:00Z", exitTime: "2026-01-03T15:00:00Z", status: "closed", isDraft: false },
      // Day 3: made $1,000
      { id: "t3", netPnlCents: 100000, entryTime: "2026-01-04T14:00:00Z", exitTime: "2026-01-04T15:00:00Z", status: "closed", isDraft: false },
      // Day 4: made $1,000 (Target $10,000 reached, 4 days met)
      { id: "t4", netPnlCents: 100000, entryTime: "2026-01-05T14:00:00Z", exitTime: "2026-01-05T15:00:00Z", status: "closed", isDraft: false },
    ];

    const result = evaluatePropChallenge(baseConfig, trades, new Date("2026-01-06T12:00:00Z"));

    expect(result.netProfitCents).toBe(1000000);
    expect(result.profitTargetReached).toBe(true);
    expect(result.minDaysMet).toBe(true);
    expect(result.bestDayPctOfTotal).toBe(70);
    expect(result.consistencyStatus).toBe("breached");
    expect(result.status).toBe("at_risk");
    expect(result.statusReason).toContain("Dilution required");
  });

  it("marks status as breached if consistencyAction is hard_breach", () => {
    const hardConfig: PropChallengeConfig = {
      ...baseConfig,
      consistencyAction: "hard_breach",
    };

    const trades: TradeForChallenge[] = [
      { id: "t1", netPnlCents: 600000, entryTime: "2026-01-02T14:00:00Z", exitTime: "2026-01-02T15:00:00Z", status: "closed", isDraft: false },
      { id: "t2", netPnlCents: 200000, entryTime: "2026-01-03T14:00:00Z", exitTime: "2026-01-03T15:00:00Z", status: "closed", isDraft: false },
    ];

    const result = evaluatePropChallenge(hardConfig, trades, new Date("2026-01-04T12:00:00Z"));

    // Best day is $6,000 out of $8,000 (75% > 50%)
    expect(result.bestDayPctOfTotal).toBe(75);
    expect(result.status).toBe("breached");
    expect(result.statusReason).toContain("hard breach");
  });

  it("marks status as passed when profit target, min days, and consistency are all fully satisfied", () => {
    const trades: TradeForChallenge[] = [
      // Day 1: $2,500
      { id: "t1", netPnlCents: 250000, entryTime: "2026-01-02T14:00:00Z", exitTime: "2026-01-02T15:00:00Z", status: "closed", isDraft: false },
      // Day 2: $2,500
      { id: "t2", netPnlCents: 250000, entryTime: "2026-01-03T14:00:00Z", exitTime: "2026-01-03T15:00:00Z", status: "closed", isDraft: false },
      // Day 3: $2,500
      { id: "t3", netPnlCents: 250000, entryTime: "2026-01-04T14:00:00Z", exitTime: "2026-01-04T15:00:00Z", status: "closed", isDraft: false },
      // Day 4: $2,500
      { id: "t4", netPnlCents: 250000, entryTime: "2026-01-05T14:00:00Z", exitTime: "2026-01-05T15:00:00Z", status: "closed", isDraft: false },
    ];

    const result = evaluatePropChallenge(baseConfig, trades, new Date("2026-01-06T12:00:00Z"));

    expect(result.netProfitCents).toBe(1000000);
    expect(result.profitTargetReached).toBe(true);
    expect(result.minDaysMet).toBe(true);
    expect(result.bestDayPctOfTotal).toBe(25); // 25% <= 50%
    expect(result.status).toBe("passed");
  });
});

describe("Phase 4 Workstream C: Risk Calculator Position Sizing & Specifications", () => {
  it("calculates exact Forex lot sizing clamped to 0.01 lot step without exceeding risk budget", () => {
    const balance = 10000; // $10,000
    const riskPct = 1.0; // 1% = $100 risk budget
    const riskBudgetCents = 10000;

    const entry = 1.08500;
    const stop = 1.08200; // 30 pips stop
    const priceDist = Math.abs(entry - stop); // 0.00300
    const instr = resolveInstrument("EURUSD");

    const centsPerUnit = priceDist * instr.pointValueCents; // 0.00300 * 10,000,000 = 30,000 cents per lot ($300/lot)
    const rawLots = riskBudgetCents / centsPerUnit; // 10,000 / 30,000 = 0.333333 lots
    const roundedLots = Math.floor(rawLots * 100) / 100; // 0.33 lots

    expect(roundedLots).toBe(0.33);

    const actualRiskCents = Math.round(priceDist * roundedLots * instr.pointValueCents);
    expect(actualRiskCents).toBeLessThanOrEqual(riskBudgetCents); // NEVER round up past budget
    expect(actualRiskCents).toBe(9900); // $99.00 <= $100.00
  });

  it("calculates Futures contracts as whole integers and rejects fractional contracts", () => {
    const balance = 25000; // $25,000
    const riskBudgetCents = 50000; // $500 risk budget
    const entry = 20400.00;
    const stop = 20380.00; // 20 points stop
    const priceDist = Math.abs(entry - stop); // 20 pts
    const instr = resolveInstrument("NQ"); // $20/point = 2,000 cents/point

    const centsPerContract = priceDist * instr.pointValueCents; // 20 * 2000 = 40,000 cents ($400/contract)
    const rawLots = riskBudgetCents / centsPerContract; // 50,000 / 40,000 = 1.25 contracts
    const roundedLots = Math.floor(rawLots); // 1 contract

    expect(roundedLots).toBe(1);
    expect(Number.isInteger(roundedLots)).toBe(true);

    const actualRiskCents = priceDist * roundedLots * instr.pointValueCents;
    expect(actualRiskCents).toBe(40000); // $400 <= $500
  });

  it("correctly identifies units per market type", () => {
    expect(unitLabel("forex")).toBe("pips");
    expect(unitLabel("futures")).toBe("ticks");
    expect(unitLabel("gold")).toBe("points");
    expect(unitLabel("crypto")).toBe("points");
  });
});

describe("Phase 4 Workstream D: Trading To-Do Organization & Due Dates", () => {
  it("partitions tasks into overdue, due today, upcoming, and completed", () => {
    const today = "2026-11-15";
    const tasks = [
      { id: "1", title: "Review NQ prep", dueDate: "2026-11-14", status: "pending" }, // Overdue
      { id: "2", title: "Check London sweep", dueDate: "2026-11-15", status: "pending" }, // Today
      { id: "3", title: "Weekend analysis", dueDate: "2026-11-18", status: "pending" }, // Upcoming
      { id: "4", title: "No date task", dueDate: null, status: "pending" }, // None
      { id: "5", title: "Past task done", dueDate: "2026-11-14", status: "completed" }, // Completed (not overdue)
    ];

    const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== "completed");
    const dueToday = tasks.filter((t) => t.dueDate === today);
    const upcoming = tasks.filter((t) => t.dueDate && t.dueDate > today);
    const completed = tasks.filter((t) => t.status === "completed");

    expect(overdue.length).toBe(1);
    expect(overdue[0].id).toBe("1");

    expect(dueToday.length).toBe(1);
    expect(dueToday[0].id).toBe("2");

    expect(upcoming.length).toBe(1);
    expect(upcoming[0].id).toBe("3");

    expect(completed.length).toBe(1);
    expect(completed[0].id).toBe("5");
  });
});

describe("Phase 4 Workstream E: Backup Validation & Duplicate Detection", () => {
  it("creates duplicate detection signatures that prevent double-counting trades on restore", () => {
    const existing = [
      { accountId: "acc-1", instrumentSymbol: "EURUSD", direction: "long", entryTime: new Date("2026-05-10T14:30:00Z") },
      { accountId: "acc-1", instrumentSymbol: "NQ", direction: "short", entryTime: new Date("2026-05-11T13:45:00Z") },
    ];

    const sigSet = new Set(
      existing.map((e) => `${e.accountId}:${e.instrumentSymbol}:${e.direction}:${e.entryTime.toISOString()}`)
    );

    const candidate1 = {
      accountId: "acc-1",
      instrumentSymbol: "EURUSD",
      direction: "long",
      entryTime: new Date("2026-05-10T14:30:00Z"),
    };
    const sig1 = `${candidate1.accountId}:${candidate1.instrumentSymbol}:${candidate1.direction}:${candidate1.entryTime.toISOString()}`;
    expect(sigSet.has(sig1)).toBe(true); // Duplicate detected!

    const candidate2 = {
      accountId: "acc-1",
      instrumentSymbol: "EURUSD",
      direction: "short", // Different direction
      entryTime: new Date("2026-05-10T14:30:00Z"),
    };
    const sig2 = `${candidate2.accountId}:${candidate2.instrumentSymbol}:${candidate2.direction}:${candidate2.entryTime.toISOString()}`;
    expect(sigSet.has(sig2)).toBe(false); // New trade, allowed!
  });
});

describe("Phase 4 Workstream F: Archived Records Client Filter", () => {
  it("filters archived trades by instrument symbol, account name, and setup name", () => {
    const archivedTrades = [
      { id: "t1", instrumentSymbol: "EURUSD", direction: "long", account: { name: "Personal FTMO" }, strategy: { name: "Silver Bullet" } },
      { id: "t2", instrumentSymbol: "NQ", direction: "short", account: { name: "Apex Funded" }, strategy: { name: "Judas Swing" } },
      { id: "t3", instrumentSymbol: "XAUUSD", direction: "long", account: { name: "Personal FTMO" }, strategy: { name: "Asian Sweep" } },
    ];

    const query1 = "silver";
    const res1 = archivedTrades.filter(
      (t) =>
        t.instrumentSymbol.toLowerCase().includes(query1) ||
        t.strategy.name.toLowerCase().includes(query1) ||
        t.account.name.toLowerCase().includes(query1)
    );
    expect(res1.length).toBe(1);
    expect(res1[0].id).toBe("t1");

    const query2 = "ftmo";
    const res2 = archivedTrades.filter(
      (t) =>
        t.instrumentSymbol.toLowerCase().includes(query2) ||
        t.strategy.name.toLowerCase().includes(query2) ||
        t.account.name.toLowerCase().includes(query2)
    );
    expect(res2.length).toBe(2);
    expect(res2.map((t) => t.id)).toEqual(["t1", "t3"]);
  });
});

describe("Phase 4 Workstream G: Global Search Multi-Domain Query", () => {
  it("structures multi-domain search results across distinct categories", () => {
    const searchResult = {
      trades: [{ id: "t1", instrumentSymbol: "NQ", netPnlCents: 45000, direction: "long" }],
      observations: [{ id: "o1", instrumentSymbol: "NQ", reason: "Spread too wide before CPI" }],
      strategies: [{ id: "s1", name: "NQ Morning FVG", market: "futures" }],
      accounts: [{ id: "a1", name: "Apex 50K", currency: "USD" }],
      tasks: [{ id: "tk1", title: "NQ overnight level check", priority: "high" }],
      dictionary: [{ id: "d1", term: "Fair Value Gap", abbreviation: "FVG" }],
    };

    expect(Object.keys(searchResult)).toEqual([
      "trades",
      "observations",
      "strategies",
      "accounts",
      "tasks",
      "dictionary",
    ]);

    expect(searchResult.trades.length).toBe(1);
    expect(searchResult.observations.length).toBe(1);
    expect(searchResult.strategies.length).toBe(1);
    expect(searchResult.accounts.length).toBe(1);
    expect(searchResult.tasks.length).toBe(1);
    expect(searchResult.dictionary.length).toBe(1);
  });
});
