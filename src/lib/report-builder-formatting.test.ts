import { describe, expect, it } from "bun:test";
import { formatWinRate, formatProfitFactor, formatSignedCents } from "./money";
import { computeProcessOutcomeMatrix, type TradeBehaviorRow } from "./behavioral-engine";

describe("D-012 & D-013: Report Builder Formatting and Process-Outcome Integrity", () => {
  it("formats fractional win rate ratio without displaying 0.674416%", () => {
    // Financial engine returns 6-decimal ratio string
    const ratioStr = "0.674416";
    expect(formatWinRate(ratioStr)).toBe("67.4%");

    // Handles already-percentage numbers
    expect(formatWinRate(67.4)).toBe("67.4%");
    expect(formatWinRate("67.4")).toBe("67.4%");

    // Handles 1.0 (100%) and 0.0 (0%)
    expect(formatWinRate(1)).toBe("100.0%");
    expect(formatWinRate(0)).toBe("0.0%");

    // Handles null / empty
    expect(formatWinRate(null)).toBe("—");
    expect(formatWinRate("")).toBe("—");
  });

  it("formats profit factor with 2 decimal places and handles unbounded zero-loss cases honestly", () => {
    // Unrounded decimal string from engine
    const pfStr = "5.627706";
    expect(formatProfitFactor(pfStr)).toBe("5.63");

    // Standard numbers
    expect(formatProfitFactor(2.5)).toBe("2.50");
    expect(formatProfitFactor("2.5")).toBe("2.50");

    // Unbounded cases (zero losses with profit)
    expect(formatProfitFactor("Infinity")).toBe("∞ (0 losses)");
    expect(formatProfitFactor(Infinity)).toBe("∞ (0 losses)");
    expect(formatProfitFactor("unbounded")).toBe("∞ (0 losses)");

    // No trades / zero profit & loss
    expect(formatProfitFactor(null)).toBe("—");
    expect(formatProfitFactor("—")).toBe("—");
    expect(formatProfitFactor("N/A")).toBe("—");
  });

  it("never classifies a $0.00 scratch trade into the Lucky Wins quadrant", () => {
    const trades: TradeBehaviorRow[] = [
      // Trade 1: Process deviated, but net P&L is exactly 0 (scratch / breakeven)
      {
        id: "t1",
        instrumentSymbol: "EURUSD",
        direction: "long",
        status: "closed",
        entryTime: "2026-03-01T10:00:00Z",
        exitTime: "2026-03-01T11:00:00Z",
        netPnlCents: 0,
        actualR: 0,
        session: "london",
        processCompliant: false, // Broke rules
      },
      // Trade 2: Process deviated, real positive win
      {
        id: "t2",
        instrumentSymbol: "GBPUSD",
        direction: "long",
        status: "closed",
        entryTime: "2026-03-01T12:00:00Z",
        exitTime: "2026-03-01T13:00:00Z",
        netPnlCents: 15000, // +$150.00
        actualR: 1.5,
        session: "ny_am",
        processCompliant: false, // Broke rules
      },
      // Trade 3: Process followed, real win
      {
        id: "t3",
        instrumentSymbol: "XAUUSD",
        direction: "long",
        status: "closed",
        entryTime: "2026-03-01T14:00:00Z",
        exitTime: "2026-03-01T15:00:00Z",
        netPnlCents: 20000, // +$200.00
        actualR: 2.0,
        session: "ny_am",
        processCompliant: true, // Followed rules
      },
    ];

    const result = computeProcessOutcomeMatrix(trades);

    // Scratch trade (t1) must NOT be in luckyWin
    expect(result.quadrants.luckyWin.tradesCount).toBe(1);
    expect(result.quadrants.luckyWin.totalPnlCents).toBe(15000);
    expect(result.quadrants.luckyWin.trades[0].id).toBe("t2");

    // Scratch trade should be in breakeven bucket
    expect(result.breakevenTradesCount).toBe(1);

    // Disciplined win has t3
    expect(result.quadrants.disciplinedWin.tradesCount).toBe(1);
    expect(result.quadrants.disciplinedWin.totalPnlCents).toBe(20000);
  });
});
