import { describe, expect, test } from "bun:test";

interface MockTrade {
  id: string;
  instrumentSymbol: string;
  direction: "long" | "short";
  status: string;
  netPnlCents: number;
  accountId: string;
  strategyId: string | null;
  strategy?: { id: string; name: string } | null;
  strategyVersion?: { id: string; versionLabel: string; strategyId?: string } | null;
}

interface FilterCriteria {
  accountFilter: string;
  setupFilter: string;
  directionFilter: string;
  outcomeFilter: string;
  search: string;
}

function classifyOutcome(t: MockTrade): string {
  if (t.status === "open" || t.status === "planned") return "open";
  if (t.netPnlCents > 0) return "win";
  if (t.netPnlCents < 0) return "loss";
  return "breakeven";
}

function filterTrades(
  trades: MockTrade[],
  filters: FilterCriteria,
  strategies: { id: string; name: string }[]
): MockTrade[] {
  const selectedStrategy = filters.setupFilter === "all"
    ? null
    : strategies.find((s) => s.id === filters.setupFilter) || null;

  return trades.filter((t) => {
    // 1. Account Filter
    if (filters.accountFilter !== "all" && t.accountId !== filters.accountFilter) {
      return false;
    }

    // 2. Setup Filter (resolves direct strategyId, strategy.id, strategyVersion.strategyId, or matching name)
    if (filters.setupFilter !== "all") {
      const tradeStratId = t.strategyId || t.strategy?.id || t.strategyVersion?.strategyId;
      const matchesId = tradeStratId === filters.setupFilter;
      const matchesName =
        selectedStrategy?.name &&
        t.strategy?.name &&
        t.strategy.name.toLowerCase() === selectedStrategy.name.toLowerCase();

      if (!matchesId && !matchesName) return false;
    }

    // 3. Direction Filter
    if (filters.directionFilter !== "all" && t.direction !== filters.directionFilter) {
      return false;
    }

    // 4. Outcome Filter
    if (filters.outcomeFilter !== "all" && classifyOutcome(t) !== filters.outcomeFilter) {
      return false;
    }

    // 5. Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !t.instrumentSymbol.toLowerCase().includes(q) &&
        !(t.strategy?.name ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }

    return true;
  });
}

describe("Trades Log Filtering Logic (Problem A & Problem B fixes)", () => {
  const mockStrategies = [
    { id: "strat-silver-bullet", name: "ICT Silver Bullet" },
    { id: "strat-judas-swing", name: "London Judas Swing" },
    { id: "strat-crypto", name: "Crypto Mean Reversion" },
  ];

  const mockTrades: MockTrade[] = [
    {
      id: "t1",
      instrumentSymbol: "XAUUSD",
      direction: "long",
      status: "win",
      netPnlCents: 15000,
      accountId: "acc-ftmo-1",
      strategyId: "strat-silver-bullet",
      strategy: { id: "strat-silver-bullet", name: "ICT Silver Bullet" },
    },
    {
      id: "t2",
      instrumentSymbol: "EURUSD",
      direction: "short",
      status: "loss",
      netPnlCents: -5000,
      accountId: "acc-personal",
      strategyId: null, // linked only via version
      strategyVersion: { id: "v1", versionLabel: "1.0", strategyId: "strat-judas-swing" },
      strategy: { id: "strat-judas-swing", name: "London Judas Swing" },
    },
    {
      id: "t3",
      instrumentSymbol: "BTCUSD",
      direction: "long",
      status: "win",
      netPnlCents: 20000,
      accountId: "acc-ftmo-1",
      strategyId: "strat-crypto",
      strategy: { id: "strat-crypto", name: "Crypto Mean Reversion" },
    },
    {
      id: "t4",
      instrumentSymbol: "XAUUSD",
      direction: "short",
      status: "win",
      netPnlCents: 8000,
      accountId: "acc-ftmo-1",
      strategyId: "strat-silver-bullet",
      strategy: { id: "strat-silver-bullet", name: "ICT Silver Bullet" },
    },
  ];

  test("FILTER-1: Filters by setup correctly with direct strategyId", () => {
    const res = filterTrades(
      mockTrades,
      {
        accountFilter: "all",
        setupFilter: "strat-silver-bullet",
        directionFilter: "all",
        outcomeFilter: "all",
        search: "",
      },
      mockStrategies
    );

    expect(res.length).toBe(2);
    expect(res.map((t) => t.id)).toEqual(["t1", "t4"]);
  });

  test("FILTER-2: Filters by setup correctly through strategyVersion parent resolution", () => {
    const res = filterTrades(
      mockTrades,
      {
        accountFilter: "all",
        setupFilter: "strat-judas-swing",
        directionFilter: "all",
        outcomeFilter: "all",
        search: "",
      },
      mockStrategies
    );

    expect(res.length).toBe(1);
    expect(res[0].id).toBe("t2");
  });

  test("FILTER-3: Filters by account correctly", () => {
    const res = filterTrades(
      mockTrades,
      {
        accountFilter: "acc-personal",
        setupFilter: "all",
        directionFilter: "all",
        outcomeFilter: "all",
        search: "",
      },
      mockStrategies
    );

    expect(res.length).toBe(1);
    expect(res[0].id).toBe("t2");
  });

  test("FILTER-4: Combined filter: Setup + Account + Direction", () => {
    const res = filterTrades(
      mockTrades,
      {
        accountFilter: "acc-ftmo-1",
        setupFilter: "strat-silver-bullet",
        directionFilter: "long",
        outcomeFilter: "all",
        search: "",
      },
      mockStrategies
    );

    expect(res.length).toBe(1);
    expect(res[0].id).toBe("t1");
  });

  test("FILTER-5: Clearing setup restores trades allowed by remaining filters", () => {
    const res = filterTrades(
      mockTrades,
      {
        accountFilter: "acc-ftmo-1",
        setupFilter: "all", // cleared
        directionFilter: "all",
        outcomeFilter: "win",
        search: "",
      },
      mockStrategies
    );

    expect(res.length).toBe(3); // t1, t3, t4 are all wins on acc-ftmo-1
  });

  test("FILTER-6: Account extraction handles both bare array and wrapped object", () => {
    const unwrap = (data: any) => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data?.accounts)) return data.accounts;
      return [];
    };

    expect(unwrap([{ id: "a1" }, { id: "a2" }]).length).toBe(2);
    expect(unwrap({ items: [{ id: "a1" }, { id: "a2" }] }).length).toBe(2);
    expect(unwrap({ accounts: [{ id: "a1" }] }).length).toBe(1);
    expect(unwrap(null).length).toBe(0);
  });
});

