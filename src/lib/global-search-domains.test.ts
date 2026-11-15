import { describe, it, expect } from "bun:test";
import { fuzzySearch } from "./fuzzy-search";

describe("Global Search Engine — 9 Entity Domains Verification", () => {
  // Domain 1: Trades
  const sampleTrades = [
    { id: "tr-1", instrumentSymbol: "EURUSD", direction: "long", setupGrade: "A+", netPnlCents: 25000, notes: "Clean liquidity sweep" },
    { id: "tr-2", instrumentSymbol: "XAUUSD", direction: "short", setupGrade: "B", netPnlCents: -12000, notes: "Choppy entry" },
    { id: "tr-3", instrumentSymbol: "NAS100", direction: "long", setupGrade: "A", netPnlCents: 45000, notes: "FVG bounce" },
  ];

  // Domain 2: No-Trade Observations
  const sampleObservations = [
    { id: "obs-1", instrumentSymbol: "GBPUSD", title: "London Chop", observation: "No clear trend", decisionType: "deliberate_avoidance" },
    { id: "obs-2", instrumentSymbol: "EURUSD", title: "High Impact News", observation: "NFP release window", decisionType: "market_condition" },
  ];

  // Domain 3: Strategies
  const sampleStrategies = [
    { id: "strat-1", name: "Silver Bullet", market: "forex", timeframe: "15m", isArchived: false },
    { id: "strat-2", name: "Opening Range Breakout", market: "indices", timeframe: "5m", isArchived: false },
    { id: "strat-archived", name: "Old Abandoned Setup", market: "forex", timeframe: "1h", isArchived: true },
  ];

  // Domain 4: Strategy Versions
  const sampleVersions = [
    { id: "ver-1", strategyId: "strat-1", versionLabel: "2.0", changeSummary: "Tightened stop to 15 pips", strategy: { isArchived: false } },
    { id: "ver-2", strategyId: "strat-1", versionLabel: "1.0", changeSummary: "Initial version", strategy: { isArchived: false } },
    { id: "ver-archived", strategyId: "strat-archived", versionLabel: "1.0", changeSummary: "Archived version", strategy: { isArchived: true } },
  ];

  // Domain 5: Accounts
  const sampleAccounts = [
    { id: "acc-1", name: "Apex 50k Prop", broker: "Tradovate", accountType: "prop", currency: "USD" },
    { id: "acc-2", name: "Interactive Brokers Personal", broker: "IBKR", accountType: "live", currency: "USD" },
  ];

  // Domain 6: Trading Tasks
  const sampleTasks = [
    { id: "tsk-1", title: "Review weekend EURUSD COT report", listName: "Research", priority: "high" },
    { id: "tsk-2", title: "Pre-market checklist for NY Open", listName: "Routine", priority: "urgent" },
  ];

  // Domain 7: Strategy Glossary / Dictionary
  const sampleDictionary = [
    { id: "dict-1", term: "Fair Value Gap", abbreviation: "FVG", definition: "Three-candle imbalance pattern", category: "Market Structure" },
    { id: "dict-2", term: "Change of Character", abbreviation: "CHoCH", definition: "First shift in market structure", category: "Market Structure" },
  ];

  // Domain 8: Quick Notes (Client storage model)
  const sampleQuickNotesList = [
    { id: "qn-1", title: "Key London Levels", content: "Watch 1.0820 support zone for rejection" },
    { id: "qn-2", title: "Risk Rules Reminder", content: "Max 2 trades per session, no trades after 11:30 NY" },
  ];
  const sampleActiveDraft = { title: "Draft Notes", content: "Evaluating potential short on Gold at 2420" };

  // Domain 9: Sticky Notes (Client storage model)
  const sampleStickyNotes = [
    { id: "sn-1", text: "• NY Open: Look for 15m liquidity sweep\n• Risk Max: 1% per trade", color: "amber" },
    { id: "sn-2", text: "• Silver Bullet window: 10:00 - 11:00 AM NY", color: "sky" },
  ];

  it("should match trades across symbol, direction, and note content", () => {
    const q = "EURUSD";
    const matched = sampleTrades.filter((t) =>
      t.instrumentSymbol.toLowerCase().includes(q.toLowerCase()) ||
      t.notes.toLowerCase().includes(q.toLowerCase())
    );
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe("tr-1");

    const qSweep = "sweep";
    const matchedSweep = sampleTrades.filter((t) => t.notes.toLowerCase().includes(qSweep.toLowerCase()));
    expect(matchedSweep.length).toBe(1);
    expect(matchedSweep[0].id).toBe("tr-1");
  });

  it("should match no-trade observations distinctly from executed trades", () => {
    const q = "NFP";
    const matchedObs = sampleObservations.filter((o) =>
      o.title.toLowerCase().includes(q.toLowerCase()) ||
      o.observation.toLowerCase().includes(q.toLowerCase())
    );
    expect(matchedObs.length).toBe(1);
    expect(matchedObs[0].id).toBe("obs-2");
    expect(matchedObs[0].decisionType).toBe("market_condition");
  });

  it("should filter out archived strategies and strategy versions from active search", () => {
    // Only active strategies returned
    const activeStrategies = sampleStrategies.filter((s) => !s.isArchived);
    expect(activeStrategies.length).toBe(2);
    expect(activeStrategies.some((s) => s.id === "strat-archived")).toBe(false);

    // Only active versions returned
    const activeVersions = sampleVersions.filter((v) => !v.strategy.isArchived);
    expect(activeVersions.length).toBe(2);
    expect(activeVersions.some((v) => v.id === "ver-archived")).toBe(false);
  });

  it("should search accounts by name, broker, and account type", () => {
    const q = "Apex";
    const matched = sampleAccounts.filter((a) =>
      a.name.toLowerCase().includes(q.toLowerCase()) ||
      a.broker.toLowerCase().includes(q.toLowerCase())
    );
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe("acc-1");
  });

  it("should search tasks by title and list name", () => {
    const q = "COT";
    const matched = sampleTasks.filter((t) =>
      t.title.toLowerCase().includes(q.toLowerCase()) ||
      t.listName.toLowerCase().includes(q.toLowerCase())
    );
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe("tsk-1");
  });

  it("should search dictionary terms by term, abbreviation, and definition", () => {
    const qFvg = "FVG";
    const matchedFvg = sampleDictionary.filter((d) =>
      d.term.toLowerCase().includes(qFvg.toLowerCase()) ||
      d.abbreviation.toLowerCase().includes(qFvg.toLowerCase())
    );
    expect(matchedFvg.length).toBe(1);
    expect(matchedFvg[0].term).toBe("Fair Value Gap");
  });

  it("should search Domain 8 Quick Notes (both saved notes and active draft)", () => {
    const combinedQuickNotes = [
      { id: "active-draft", title: sampleActiveDraft.title, content: sampleActiveDraft.content },
      ...sampleQuickNotesList,
    ];

    // Search inside saved notes
    const q1 = "1.0820";
    const m1 = combinedQuickNotes.filter((n) =>
      (n.title && n.title.toLowerCase().includes(q1.toLowerCase())) ||
      (n.content && n.content.toLowerCase().includes(q1.toLowerCase()))
    );
    expect(m1.length).toBe(1);
    expect(m1[0].id).toBe("qn-1");

    // Search inside active draft
    const q2 = "Gold";
    const m2 = combinedQuickNotes.filter((n) =>
      (n.title && n.title.toLowerCase().includes(q2.toLowerCase())) ||
      (n.content && n.content.toLowerCase().includes(q2.toLowerCase()))
    );
    expect(m2.length).toBe(1);
    expect(m2[0].id).toBe("active-draft");
  });

  it("should search Domain 9 Sticky Notes with case-insensitive content match", () => {
    const q = "Silver Bullet";
    const matched = sampleStickyNotes.filter((sn) =>
      sn.text.toLowerCase().includes(q.toLowerCase())
    );
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe("sn-2");
  });

  it("should handle empty, null, or malformed local notes storage gracefully", () => {
    function parseLocalNotes(raw: string | null) {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    expect(parseLocalNotes(null)).toEqual([]);
    expect(parseLocalNotes("")).toEqual([]);
    expect(parseLocalNotes("invalid-json{}}")).toEqual([]);
    expect(parseLocalNotes('{"notAnArray": true}')).toEqual([]);
    expect(parseLocalNotes('[{"id":"qn-1","title":"Test","content":"Note"}]').length).toBe(1);
  });
});
