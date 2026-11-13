import { describe, expect, test } from "bun:test";

interface MockTrade {
  id: string;
  instrumentSymbol: string;
  direction: "long" | "short";
  status: string;
  netPnlCents: number;
  accountId: string;
  accountName?: string;
  notes?: string;
  lessons?: string;
  tags?: string[];
  behaviorFlags?: string[];
  strategyId?: string | null;
  strategyName?: string | null;
}

function searchTrades(trades: MockTrade[], query: string): MockTrade[] {
  const q = query.trim().toLowerCase();
  if (!q) return trades;

  return trades.filter((t) => {
    // Symbol
    if (t.instrumentSymbol.toLowerCase().includes(q)) return true;
    // ID
    if (t.id.toLowerCase() === q) return true;
    // Notes
    if (t.notes?.toLowerCase().includes(q)) return true;
    // Lessons
    if (t.lessons?.toLowerCase().includes(q)) return true;
    // Account name
    if (t.accountName?.toLowerCase().includes(q)) return true;
    // Strategy / Setup name
    if (t.strategyName?.toLowerCase().includes(q)) return true;
    // Tags
    if (t.tags?.some((tag) => tag.toLowerCase().includes(q))) return true;
    // Behavior flags
    if (t.behaviorFlags?.some((f) => f.toLowerCase().includes(q))) return true;
    // Direction
    if (q === "long" && t.direction === "long") return true;
    if (q === "short" && t.direction === "short") return true;
    // Outcome keywords
    if (q === "win" && t.netPnlCents > 0 && t.status !== "open" && t.status !== "planned") return true;
    if (q === "loss" && t.netPnlCents < 0 && t.status !== "open" && t.status !== "planned") return true;
    if ((q === "breakeven" || q === "be") && t.netPnlCents === 0 && t.status !== "open" && t.status !== "planned") return true;
    if (q === "open" && t.status === "open") return true;

    return false;
  });
}

function paginateTrades<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const validPage = Math.min(Math.max(1, page), totalPages);
  const skip = (validPage - 1) * pageSize;
  const slice = items.slice(skip, skip + pageSize);

  return {
    items: slice,
    total,
    page: validPage,
    pageSize,
    totalPages,
  };
}

describe("Trades Log Pagination & Multi-field Search Engine", () => {
  const mockTrades: MockTrade[] = [
    {
      id: "tr-1",
      instrumentSymbol: "XAUUSD",
      direction: "long",
      status: "closed",
      netPnlCents: 15000,
      accountId: "acc-1",
      accountName: "FTMO Funded 100k",
      notes: "Clean London sweep of Asian high",
      tags: ["London", "Sweep", "A+"],
      strategyName: "Silver Bullet",
    },
    {
      id: "tr-2",
      instrumentSymbol: "EURUSD",
      direction: "short",
      status: "closed",
      netPnlCents: -5000,
      accountId: "acc-2",
      accountName: "Personal Live IC",
      notes: "Late entry after FOMC spike",
      lessons: "Never chase the candle",
      behaviorFlags: ["entered_early", "revenge_trading"],
      tags: ["FOMC", "News"],
      strategyName: "Judas Entry",
    },
    {
      id: "tr-3",
      instrumentSymbol: "NQ",
      direction: "long",
      status: "closed",
      netPnlCents: 0,
      accountId: "acc-1",
      accountName: "FTMO Funded 100k",
      notes: "Moved stop to BE ahead of CPI",
      strategyName: "Opening Range Breakout",
    },
    {
      id: "tr-4",
      instrumentSymbol: "BTCUSD",
      direction: "long",
      status: "open",
      netPnlCents: 0,
      accountId: "acc-3",
      accountName: "Crypto Apex",
      notes: "Weekend consolidation accumulation",
      tags: ["Crypto", "Position"],
    },
    {
      id: "tr-5",
      instrumentSymbol: "USDJPY",
      direction: "short",
      status: "closed",
      netPnlCents: 22000,
      accountId: "acc-2",
      accountName: "Personal Live IC",
      notes: "Intervention dump follow-through",
      strategyName: "Silver Bullet",
      tags: ["Intervention"],
    },
  ];

  test("SEARCH-1: Multi-field search finds trades by note content, tags, or lessons", () => {
    const noteMatch = searchTrades(mockTrades, "Asian high");
    expect(noteMatch.length).toBe(1);
    expect(noteMatch[0].id).toBe("tr-1");

    const tagMatch = searchTrades(mockTrades, "FOMC");
    expect(tagMatch.length).toBe(1);
    expect(tagMatch[0].id).toBe("tr-2");

    const lessonMatch = searchTrades(mockTrades, "chase");
    expect(lessonMatch.length).toBe(1);
    expect(lessonMatch[0].id).toBe("tr-2");
  });

  test("SEARCH-2: Relational search finds trades by account name or strategy name", () => {
    const accountMatch = searchTrades(mockTrades, "FTMO Funded");
    expect(accountMatch.length).toBe(2);

    const stratMatch = searchTrades(mockTrades, "Silver Bullet");
    expect(stratMatch.length).toBe(2);
  });

  test("SEARCH-3: Outcome and direction keyword search matches correctly", () => {
    const wins = searchTrades(mockTrades, "win");
    expect(wins.length).toBe(2); // tr-1, tr-5

    const losses = searchTrades(mockTrades, "loss");
    expect(losses.length).toBe(1); // tr-2

    const be = searchTrades(mockTrades, "breakeven");
    expect(be.length).toBe(1); // tr-3

    const shorts = searchTrades(mockTrades, "short");
    expect(shorts.length).toBe(2); // tr-2, tr-5
  });

  test("PAGINATE-1: Divides trades into correct page sizes and calculates totalPages", () => {
    const p1 = paginateTrades(mockTrades, 1, 2);
    expect(p1.items.length).toBe(2);
    expect(p1.total).toBe(5);
    expect(p1.totalPages).toBe(3);
    expect(p1.items[0].id).toBe("tr-1");
    expect(p1.items[1].id).toBe("tr-2");

    const p2 = paginateTrades(mockTrades, 2, 2);
    expect(p2.items.length).toBe(2);
    expect(p2.items[0].id).toBe("tr-3");
    expect(p2.items[1].id).toBe("tr-4");

    const p3 = paginateTrades(mockTrades, 3, 2);
    expect(p3.items.length).toBe(1);
    expect(p3.items[0].id).toBe("tr-5");
  });

  test("PAGINATE-2: Out-of-bounds page numbers clamp safely to valid range", () => {
    const over = paginateTrades(mockTrades, 99, 2);
    expect(over.page).toBe(3);
    expect(over.items.length).toBe(1);

    const under = paginateTrades(mockTrades, -5, 2);
    expect(under.page).toBe(1);
    expect(under.items.length).toBe(2);
  });
});
