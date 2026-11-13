import { describe, expect, test } from "bun:test";
import {
  computeTimeInTradeAnalytics,
  formatDurationHuman,
  type TradeForDuration,
} from "./duration-analytics";

describe("Time-in-Trade Analytics Engine", () => {
  test("DUR-1: Excludes open and draft positions from closed duration statistics", () => {
    const trades: TradeForDuration[] = [
      {
        id: "closed-1",
        netPnlCents: 10000,
        status: "win",
        entryTime: "2026-01-01T10:00:00Z",
        exitTime: "2026-01-01T10:30:00Z", // 30 min
      },
      {
        id: "open-1",
        netPnlCents: 0,
        status: "open",
        entryTime: "2026-01-01T10:00:00Z",
        exitTime: null, // open
      },
      {
        id: "draft-1",
        netPnlCents: 0,
        status: "closed",
        isDraft: true,
        entryTime: "2026-01-01T10:00:00Z",
        exitTime: "2026-01-01T12:00:00Z",
      },
    ];

    const result = computeTimeInTradeAnalytics(trades);
    expect(result.totalClosedAnalyzed).toBe(1);
    expect(result.openExcludedCount).toBe(1);
    expect(result.avgMinutes).toBe(30);
    expect(result.medianMinutes).toBe(30);
  });

  test("DUR-2: Calculates average and median duration accurately", () => {
    const trades: TradeForDuration[] = [
      { id: "t1", netPnlCents: 5000, status: "win", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-01T10:10:00Z" }, // 10 min
      { id: "t2", netPnlCents: 5000, status: "win", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-01T10:20:00Z" }, // 20 min
      { id: "t3", netPnlCents: -5000, status: "loss", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-01T11:00:00Z" }, // 60 min
    ];

    const result = computeTimeInTradeAnalytics(trades);
    expect(result.totalClosedAnalyzed).toBe(3);
    expect(result.shortestMinutes).toBe(10);
    expect(result.longestMinutes).toBe(60);
    expect(result.avgMinutes).toBe(30); // (10 + 20 + 60) / 3 = 30
    expect(result.medianMinutes).toBe(20);
    expect(result.winAvgMinutes).toBe(15); // (10 + 20) / 2 = 15
    expect(result.lossAvgMinutes).toBe(60);
    expect(result.winLossDurationRatio).toBe(0.25);
  });

  test("DUR-3: Distributes trades into correct duration buckets", () => {
    const trades: TradeForDuration[] = [
      { id: "scalp", netPnlCents: 2000, status: "win", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-01T10:03:00Z" }, // 3 min (< 5m)
      { id: "intraday", netPnlCents: 4000, status: "win", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-01T10:45:00Z" }, // 45 min (5m-1h)
      { id: "session", netPnlCents: -1000, status: "loss", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-01T12:00:00Z" }, // 120 min (1h-4h)
      { id: "day", netPnlCents: 8000, status: "win", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-01T18:00:00Z" }, // 480 min (4h-1d)
      { id: "swing", netPnlCents: 15000, status: "win", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-03T10:00:00Z" }, // 2 days (1d-1w)
      { id: "position", netPnlCents: 25000, status: "win", entryTime: "2026-01-01T10:00:00Z", exitTime: "2026-01-15T10:00:00Z" }, // 14 days (> 1w)
    ];

    const result = computeTimeInTradeAnalytics(trades);
    const bucketMap = new Map(result.buckets.map((b) => [b.bucketKey, b.tradesCount]));

    expect(bucketMap.get("under_5m")).toBe(1);
    expect(bucketMap.get("5m_to_1h")).toBe(1);
    expect(bucketMap.get("1h_to_4h")).toBe(1);
    expect(bucketMap.get("4h_to_1d")).toBe(1);
    expect(bucketMap.get("1d_to_1w")).toBe(1);
    expect(bucketMap.get("over_1w")).toBe(1);
  });

  test("DUR-4: Formats duration human strings correctly", () => {
    expect(formatDurationHuman(null)).toBe("—");
    expect(formatDurationHuman(0.5)).toBe("< 1 min");
    expect(formatDurationHuman(25)).toBe("25m");
    expect(formatDurationHuman(90)).toBe("1h 30m");
    expect(formatDurationHuman(120)).toBe("2h");
    expect(formatDurationHuman(1500)).toBe("1d 1h");
    expect(formatDurationHuman(2880)).toBe("2d");
  });

  test("DUR-5: Handles empty trades and malformed input gracefully", () => {
    const emptyResult = computeTimeInTradeAnalytics([]);
    expect(emptyResult.totalClosedAnalyzed).toBe(0);
    expect(Array.isArray(emptyResult.buckets)).toBe(true);
    expect(emptyResult.buckets.length).toBe(6);
    expect(emptyResult.avgMinutes).toBeNull();
  });
});

