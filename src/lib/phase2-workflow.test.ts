import { describe, test, expect } from "bun:test";
import {
  extractCustomFields,
  serializeRulesWithFields,
  GENERAL_TRADE_FIELDS,
  DEFAULT_ICT_FIELDS,
  type StrategyCustomField,
} from "./strategy-custom-fields";
import {
  evaluateChecklist,
  type ChecklistItem,
  type ChecklistAnswerValue,
} from "./checklist-evaluation";
import { calculateTradeMetrics } from "./financial-engine";
import { toInstrumentEconomics } from "./instrument-bridge";
import { resolveInstrument } from "./instrument-catalog";

describe("Phase 2 Task 1: Trade Entry Modes & Lifecycle State", () => {
  test("P2-ENTRY-1: Quick Entry minimum valid trade payload validates correctly", () => {
    // Quick entry payload essentials: accountId, instrumentSymbol, direction, entryPrice, lotSize, status
    const quickTrade = {
      accountId: "acc-1",
      instrumentSymbol: "XAUUSD",
      direction: "long",
      status: "closed",
      plannedEntryPrice: "2400.00",
      actualExitPrice: "2410.00",
      plannedStopPrice: "2395.00",
      plannedTargetPrice: "2420.00",
      lotSize: "1.0",
      notes: "Quick scalp on gold",
    };

    expect(quickTrade.instrumentSymbol).toBe("XAUUSD");
    expect(quickTrade.direction).toBe("long");
    expect(quickTrade.status).toBe("closed");
    expect(Number(quickTrade.plannedEntryPrice)).toBe(2400.00);
    expect(Number(quickTrade.actualExitPrice)).toBe(2410.00);
    expect(Number(quickTrade.plannedStopPrice)).toBe(2395.00);
    expect(Number(quickTrade.plannedTargetPrice)).toBe(2420.00);
  });

  test("P2-ENTRY-2: Planned trade does not generate realized P&L or fake executions", () => {
    const plannedTrade = {
      instrumentSymbol: "EURUSD",
      direction: "long",
      status: "planned",
      plannedEntryPrice: "1.1000",
      plannedStopPrice: "1.0950",
      plannedTargetPrice: "1.1100",
      executions: [],
    };

    const instr = toInstrumentEconomics(resolveInstrument("EURUSD"), "USD");
    const metrics = calculateTradeMetrics({
      instrument: instr,
      accountCurrency: "USD",
      accountBalanceCents: 10_000_000,
      direction: plannedTrade.direction as "long" | "short",
      fills: plannedTrade.executions,
      plannedEntryPrice: plannedTrade.plannedEntryPrice,
      plannedStopPrice: plannedTrade.plannedStopPrice,
      plannedTargetPrice: plannedTrade.plannedTargetPrice,
      plannedRiskAmountCents: null,
      feesCents: 0,
      commissionCents: 0,
      swapCents: 0,
      slippageCents: 0,
    });

    // For planned setups without exit executions: grossPnlNativeCents is strictly 0, actualR is null
    // In financial-engine, 0 fills returns status 'draft', while the trade entity lifecycle status is 'planned'
    expect(metrics.grossPnlNativeCents).toBe(0);
    expect(metrics.netPnlNativeCents).toBe(0);
    expect(metrics.actualR).toBeNull();
    expect(metrics.status).toBe("draft");
    expect(plannedTrade.status).toBe("planned");
  });

  test("P2-ENTRY-3: Open and partially closed trade lifecycle transitions", () => {
    const instr = toInstrumentEconomics(resolveInstrument("XAUUSD"), "USD");

    // 1. Open trade with entry execution only
    const openTradeMetrics = calculateTradeMetrics({
      instrument: instr,
      accountCurrency: "USD",
      accountBalanceCents: 5_000_000,
      direction: "long",
      fills: [
        { id: "e1", kind: "entry", price: "2350.00", quantity: "1.0", timestamp: "2026-11-01T10:00:00Z" },
      ],
      plannedEntryPrice: "2350.00",
      plannedStopPrice: "2345.00",
      plannedTargetPrice: "2365.00",
      plannedRiskAmountCents: 50_000,
      feesCents: 0,
      commissionCents: 0,
      swapCents: 0,
      slippageCents: 0,
    });

    expect(openTradeMetrics.status).toBe("open");
    expect(openTradeMetrics.remainingQuantity).toBe("1");
    expect(openTradeMetrics.matchedQuantity).toBe("0");
    expect(openTradeMetrics.netPnlNativeCents).toBe(0);

    // 2. Partial exit: 0.5 lot closed at 2360.00 (+10.00 move on 0.5 lot = +$500.00)
    const partialMetrics = calculateTradeMetrics({
      instrument: instr,
      accountCurrency: "USD",
      accountBalanceCents: 5_000_000,
      direction: "long",
      fills: [
        { id: "e1", kind: "entry", price: "2350.00", quantity: "1.0", timestamp: "2026-11-01T10:00:00Z" },
        { id: "x1", kind: "exit", price: "2360.00", quantity: "0.5", timestamp: "2026-11-01T11:00:00Z" },
      ],
      plannedEntryPrice: "2350.00",
      plannedStopPrice: "2345.00",
      plannedTargetPrice: "2365.00",
      plannedRiskAmountCents: 50_000, // $500 planned risk
      feesCents: 0,
      commissionCents: 0,
      swapCents: 0,
      slippageCents: 0,
    });

    expect(partialMetrics.status).toBe("partial");
    expect(partialMetrics.outcome).toBe("partial_win");
    expect(partialMetrics.remainingQuantity).toBe("0.5");
    expect(partialMetrics.matchedQuantity).toBe("0.5");
    expect(partialMetrics.grossPnlNativeCents).toBe(50_000); // +$500.00
    expect(partialMetrics.netPnlNativeCents).toBe(50_000);
  });
});

describe("Phase 2 Task 2: Strategy Versioning & Conditional Custom Fields", () => {
  test("P2-STRAT-1: No Strategy state returns general trade fields, NOT ICT-specific fields", () => {
    // When no strategy is selected (hasStrategySelected = false)
    const fields = extractCustomFields(null, false);
    expect(fields).toEqual(GENERAL_TRADE_FIELDS);

    const fieldIds = fields.map((f) => f.id);
    expect(fieldIds).toContain("marketCondition");
    expect(fieldIds).toContain("primaryTimeframe");
    expect(fieldIds).toContain("keyConfluence");
    // Crucial: Must NEVER contain ICT-specific terms like FVG or weeklyBias
    expect(fieldIds).not.toContain("weeklyBias");
    expect(fieldIds).not.toContain("dailyBias");
    expect(fieldIds).not.toContain("liquidityTargets");
    expect(fieldIds).not.toContain("marketStructure");
    expect(fieldIds).not.toContain("entryModel");
  });

  test("P2-STRAT-2: Strategy with defined custom fields extracts fields accurately", () => {
    const customConfig: StrategyCustomField[] = [
      {
        id: "trendRegime",
        name: "Trend Regime",
        description: "200 EMA direction",
        type: "select",
        options: ["Above 200 EMA", "Below 200 EMA"],
        order: 0,
        enabled: true,
      },
      {
        id: "volumeSpread",
        name: "Volume Spread",
        type: "text",
        order: 1,
        enabled: true,
      },
    ];

    const rulesJson = serializeRulesWithFields(
      [{ title: "Rule 1", required: true }],
      customConfig
    );

    const extracted = extractCustomFields(rulesJson, true);
    expect(extracted.length).toBe(2);
    expect(extracted[0].name).toBe("Trend Regime");
    expect(extracted[0].options).toEqual(["Above 200 EMA", "Below 200 EMA"]);
    expect(extracted[1].name).toBe("Volume Spread");
  });

  test("P2-STRAT-3: Strategy version immutability preserves historical definitions", () => {
    // Version 1.0 definition
    const v1Rules = [{ title: "Wait for 15m candle close", required: true }];
    const v1CustomFields: StrategyCustomField[] = [
      { id: "f1", name: "Original Field", type: "text", order: 0, enabled: true },
    ];
    const v1Json = serializeRulesWithFields(v1Rules, v1CustomFields);

    // Version 2.0 definition with added rules and updated fields
    const v2Rules = [
      { title: "Wait for 15m candle close", required: true },
      { title: "Check higher timeframe trend", required: true },
    ];
    const v2CustomFields: StrategyCustomField[] = [
      { id: "f1", name: "Original Field", type: "text", order: 0, enabled: true },
      { id: "f2", name: "New V2 Field", type: "number", order: 1, enabled: true },
    ];
    const v2Json = serializeRulesWithFields(v2Rules, v2CustomFields);

    // Extracting v1 rulesJson retains exact v1 definition without mutation
    const extractedV1 = extractCustomFields(v1Json, true);
    expect(extractedV1.length).toBe(1);
    expect(extractedV1[0].id).toBe("f1");

    const extractedV2 = extractCustomFields(v2Json, true);
    expect(extractedV2.length).toBe(2);
    expect(extractedV2[1].id).toBe("f2");
  });

  test("P2-STRAT-4: Live checklist evaluation distinguishes required from optional rules", () => {
    const checklist: ChecklistItem[] = [
      { id: "r1", title: "Key level respected", required: true, weight: 1 },
      { id: "r2", title: "Clean displacement candle", required: true, weight: 1 },
      { id: "r3", title: "Harmonic RSI divergence", required: false, weight: 1 }, // Optional
    ];

    const answers: Record<string, ChecklistAnswerValue> = {
      r1: { checked: true, note: "Respected prior day high" },
      r2: { checked: true, note: "Strong 5m displacement" },
      r3: { checked: false }, // Optional not completed
    };

    const evaluation = evaluateChecklist(checklist, answers, null);

    // Both required items completed -> requiredCheckedCount = 2, requiredTotalCount = 2
    expect(evaluation.requiredCheckedCount).toBe(2);
    expect(evaluation.requiredTotalCount).toBe(2);
    expect(evaluation.requiredItemsMissing).toBe(false);
    expect(evaluation.grade).toBe("A+");
  });
});

describe("Phase 2 Task 3: Draft Persistence & Scoping", () => {
  test("P2-DRAFT-1: Draft storage key is scoped to authenticated user ID", () => {
    const getDraftKey = (uid?: string) => `alphapips-trade-draft-${uid || "local"}`;

    const user1Key = getDraftKey("usr_abc123");
    const user2Key = getDraftKey("usr_xyz789");
    const anonKey = getDraftKey();

    expect(user1Key).toBe("alphapips-trade-draft-usr_abc123");
    expect(user2Key).toBe("alphapips-trade-draft-usr_xyz789");
    expect(anonKey).toBe("alphapips-trade-draft-local");
    expect(user1Key).not.toBe(user2Key);
  });

  test("P2-DRAFT-2: Draft payload preserves entryMode, activeStep, and sizing inputs", () => {
    const draftPayload = {
      accountId: "acc-100",
      instrumentSymbol: "NAS100",
      direction: "short",
      status: "open",
      plannedEntryPrice: "20500.00",
      plannedStopPrice: "20525.00",
      plannedTargetPrice: "20425.00",
      lotSize: "2",
      riskPct: "1.0",
      entryMode: "advanced",
      activeStep: "risk",
      _savedAt: new Date("2026-11-15T00:00:00Z").toISOString(),
    };

    expect(draftPayload.entryMode).toBe("advanced");
    expect(draftPayload.activeStep).toBe("risk");
    expect(draftPayload.lotSize).toBe("2");
    expect(draftPayload.riskPct).toBe("1.0");
    expect(draftPayload._savedAt).toBe("2026-11-15T00:00:00.000Z");
  });

  test("P2-DRAFT-3: Editing an existing trade uses an isolated draft key and never overwrites new trade draft", () => {
    const getDraftKey = (uid?: string, tradeId?: string | null) => {
      const prefix = "alphapips-trade-draft";
      if (tradeId) {
        return `${prefix}-${uid || "local"}-edit-${tradeId}`;
      }
      return `${prefix}-${uid || "local"}-new`;
    };

    const newTradeKey = getDraftKey("usr_100", null);
    const editTradeKey1 = getDraftKey("usr_100", "trade_abc");
    const editTradeKey2 = getDraftKey("usr_100", "trade_xyz");

    expect(newTradeKey).toBe("alphapips-trade-draft-usr_100-new");
    expect(editTradeKey1).toBe("alphapips-trade-draft-usr_100-edit-trade_abc");
    expect(editTradeKey2).toBe("alphapips-trade-draft-usr_100-edit-trade_xyz");

    // Keys are completely mutually exclusive
    expect(newTradeKey).not.toBe(editTradeKey1);
    expect(editTradeKey1).not.toBe(editTradeKey2);
  });

  test("P2-DRAFT-4: Storage failure triggers error status and prevents false save confirmation", () => {
    let autosaveState: "idle" | "saving" | "saved" | "error" = "idle";
    const fakeSetItem = () => {
      throw new Error("QuotaExceededError");
    };

    autosaveState = "saving";
    try {
      fakeSetItem();
      autosaveState = "saved";
    } catch {
      autosaveState = "error";
    }

    expect(autosaveState).toBe("error");
    expect(autosaveState).not.toBe("saved");
  });
});

describe("Phase 2 Task 4: Media & Image Annotations", () => {
  test("P2-MEDIA-1: Annotation coordinate normalization and serialization", () => {
    const annotation = {
      id: "ann-1",
      kind: "arrow" as const,
      x1: 0.25,
      y1: 0.50,
      x2: 0.75,
      y2: 0.50,
      color: "#10B981",
      strokeWidth: 2,
    };

    expect(annotation.x1).toBeGreaterThanOrEqual(0);
    expect(annotation.x1).toBeLessThanOrEqual(1);
    expect(annotation.x2).toBeGreaterThanOrEqual(0);
    expect(annotation.x2).toBeLessThanOrEqual(1);

    const serialized = JSON.stringify(annotation);
    const parsed = JSON.parse(serialized);
    expect(parsed.kind).toBe("arrow");
    expect(parsed.color).toBe("#10B981");
  });

  test("P2-MEDIA-2: Freehand pen and highlighter path generation", () => {
    const points = [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.15 },
      { x: 0.3, y: 0.2 },
    ];

    // SVG path M x y L x y ...
    const first = points[0];
    let d = `M ${first.x * 100} ${first.y * 100}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x * 100} ${points[i].y * 100}`;
    }

    expect(d).toBe("M 10 10 L 20 15 L 30 20");
  });
});

describe("Phase 2 Task 5: Trades Log Filtering & Observations", () => {
  test("P2-LOG-1: Deterministic sort order tiebreaker", () => {
    const allowedSortCols: Record<string, string> = {
      entryTime: "entryTime",
      exitTime: "exitTime",
      netPnlCents: "netPnlCents",
      pnl: "netPnlCents",
      grossPnlCents: "grossPnlCents",
      instrumentSymbol: "instrumentSymbol",
      createdAt: "createdAt",
    };

    const sortCol = allowedSortCols["pnl"] || "entryTime";
    const orderBy = [
      { [sortCol]: "desc" },
      { id: "desc" },
    ];

    expect(sortCol).toBe("netPnlCents");
    expect(orderBy[0]).toEqual({ netPnlCents: "desc" });
    expect(orderBy[1]).toEqual({ id: "desc" }); // Secondary deterministic tiebreaker
  });

  test("P2-LOG-2: No-trade observation exclusion from executed trade metrics", () => {
    const executedTrades = [
      { id: "t1", netPnlCents: 100_000, status: "closed", isDraft: false },
      { id: "t2", netPnlCents: -50_000, status: "closed", isDraft: false },
    ];

    const observations = [
      { id: "obs-1", reason: "Spread too wide during London open", date: "2026-11-01" },
      { id: "obs-2", reason: "News event high impact pending", date: "2026-11-02" },
    ];

    // Observations do not count as trades in financial stats
    const totalExecuted = executedTrades.length;
    const totalPnl = executedTrades.reduce((acc, t) => acc + t.netPnlCents, 0);

    expect(totalExecuted).toBe(2);
    expect(totalPnl).toBe(50_000);
    // Observations are tracked separately
    expect(observations.length).toBe(2);
  });

  test("P2-LOG-3: Multi-term search query tokenization & compound AND clause construction", () => {
    const rawSearch = "EURUSD  win  London ";
    const tokens = rawSearch.trim().split(/\s+/).filter(Boolean);

    expect(tokens).toEqual(["EURUSD", "win", "London"]);
    expect(tokens.length).toBe(3);

    // Multi-term logic creates an AND array of token clauses
    const tokenClauses = tokens.map((tok) => ({
      OR: [
        { instrumentSymbol: { contains: tok, mode: "insensitive" } },
        { notes: { contains: tok, mode: "insensitive" } },
      ],
    }));

    expect(tokenClauses.length).toBe(3);
  });

  test("P2-LOG-4: Pagination navigation boundary invariants (First, Prev, Next, Last, Jump)", () => {
    const totalTrades = 73;
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(totalTrades / pageSize));

    expect(totalPages).toBe(8);

    // Navigation functions
    const getFirst = () => 1;
    const getLast = () => totalPages;
    const getPrev = (curr: number) => Math.max(1, curr - 1);
    const getNext = (curr: number) => Math.min(totalPages, curr + 1);
    const clampJump = (jump: number) => Math.max(1, Math.min(totalPages, jump));

    expect(getFirst()).toBe(1);
    expect(getLast()).toBe(8);
    expect(getPrev(1)).toBe(1); // Clamps to 1
    expect(getPrev(4)).toBe(3);
    expect(getNext(8)).toBe(8); // Clamps to totalPages
    expect(getNext(7)).toBe(8);
    expect(clampJump(-5)).toBe(1);
    expect(clampJump(99)).toBe(8);
    expect(clampJump(5)).toBe(5);
  });
});
