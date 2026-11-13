import { describe, expect, test } from "bun:test";
import {
  evaluatePropChallenge,
  getTradingCycleKey,
  type PropChallengeConfig,
  type TradeForChallenge,
} from "./prop-firm-engine";

describe("Prop Firm Challenge Engine", () => {
  const baseConfig: PropChallengeConfig = {
    startingBalanceCents: 10_000_000, // $100,000.00
    profitTargetCents: 1_000_000,     // $10,000.00 (10%)
    dailyLossLimitCents: 500_000,     // $5,000.00 (5%)
    maxDrawdownCents: 1_000_000,      // $10,000.00 (10%)
    drawdownType: "static",
    minTradingDays: 4,
    resetTimezone: "America/New_York",
    resetHour: 17, // 5:00 PM NY
    startDate: "2026-01-01T00:00:00Z",
  };

  test("PROP-1: Trading cycle grouping across 17:00 NY reset", () => {
    // 2026-01-05 16:30 NY (21:30 UTC) is before 17:00 -> cycle of 2026-01-04
    const d1 = new Date("2026-01-05T21:30:00Z");
    const cycle1 = getTradingCycleKey(d1, "America/New_York", 17);

    // 2026-01-05 17:15 NY (22:15 UTC) is after 17:00 -> cycle of 2026-01-05
    const d2 = new Date("2026-01-05T22:15:00Z");
    const cycle2 = getTradingCycleKey(d2, "America/New_York", 17);

    expect(cycle1).not.toBe(cycle2);
  });

  test("PROP-2: Static drawdown calculation and breach", () => {
    const trades: TradeForChallenge[] = [
      {
        id: "t1",
        netPnlCents: -600_000, // -$6,000
        entryTime: "2026-01-02T10:00:00Z",
        exitTime: "2026-01-02T12:00:00Z",
        status: "closed",
      },
      {
        id: "t2",
        netPnlCents: -500_000, // -$5,000 -> Total loss = -$11,000 > $10,000 limit
        entryTime: "2026-01-03T10:00:00Z",
        exitTime: "2026-01-03T12:00:00Z",
        status: "closed",
      },
    ];

    const metrics = evaluatePropChallenge(baseConfig, trades, new Date("2026-01-04T12:00:00Z"));
    expect(metrics.currentDrawdownCents).toBe(1_100_000);
    expect(metrics.drawdownBreached).toBe(true);
    expect(metrics.status).toBe("breached");
  });

  test("PROP-3: Trailing drawdown tracks high-water mark", () => {
    const trailingConfig: PropChallengeConfig = {
      ...baseConfig,
      drawdownType: "trailing",
      maxDrawdownCents: 500_000, // $5,000 trailing drawdown
    };

    // Account grows by $8,000 to $108,000 (HWM), then loses $6,000 to $102,000.
    // Static DD would be $0 (still above $100k starting balance).
    // Trailing DD is $108k - $102k = $6,000 -> breaches $5,000 trailing limit!
    const trades: TradeForChallenge[] = [
      {
        id: "t1",
        netPnlCents: 800_000, // +$8,000
        entryTime: "2026-01-02T10:00:00Z",
        exitTime: "2026-01-02T12:00:00Z",
        status: "closed",
      },
      {
        id: "t2",
        netPnlCents: -600_000, // -$6,000
        entryTime: "2026-01-03T10:00:00Z",
        exitTime: "2026-01-03T12:00:00Z",
        status: "closed",
      },
    ];

    const metrics = evaluatePropChallenge(trailingConfig, trades, new Date("2026-01-04T12:00:00Z"));
    expect(metrics.highWaterMarkCents).toBe(10_800_000);
    expect(metrics.currentBalanceCents).toBe(10_200_000);
    expect(metrics.currentDrawdownCents).toBe(600_000);
    expect(metrics.drawdownBreached).toBe(true);
    expect(metrics.status).toBe("breached");
  });

  test("PROP-4: Passed challenge when profit target hit and min trading days met", () => {
    const trades: TradeForChallenge[] = [
      { id: "t1", netPnlCents: 250_000, entryTime: "2026-01-02T12:00:00Z", exitTime: "2026-01-02T14:00:00Z", status: "closed" },
      { id: "t2", netPnlCents: 250_000, entryTime: "2026-01-03T12:00:00Z", exitTime: "2026-01-03T14:00:00Z", status: "closed" },
      { id: "t3", netPnlCents: 250_000, entryTime: "2026-01-04T12:00:00Z", exitTime: "2026-01-04T14:00:00Z", status: "closed" },
      { id: "t4", netPnlCents: 300_000, entryTime: "2026-01-05T12:00:00Z", exitTime: "2026-01-05T14:00:00Z", status: "closed" },
    ];

    const metrics = evaluatePropChallenge(baseConfig, trades, new Date("2026-01-06T12:00:00Z"));
    expect(metrics.netProfitCents).toBe(1_050_000); // > $10,000 target
    expect(metrics.profitTargetReached).toBe(true);
    expect(metrics.tradingDaysCount).toBe(4);
    expect(metrics.minDaysMet).toBe(true);
    expect(metrics.status).toBe("passed");
  });

  test("PROP-5: Approaching limit warning when > 75% limit consumed", () => {
    const trades: TradeForChallenge[] = [
      {
        id: "t1",
        netPnlCents: -400_000, // -$4,000 loss today out of $5,000 daily limit (80% used)
        entryTime: "2026-01-02T12:00:00Z",
        exitTime: "2026-01-02T14:00:00Z",
        status: "closed",
      },
    ];

    const metrics = evaluatePropChallenge(baseConfig, trades, new Date("2026-01-02T15:00:00Z"));
    expect(metrics.todayLossCents).toBe(400_000);
    expect(metrics.dailyLossUsedPct).toBe(80);
    expect(metrics.status).toBe("approaching_limit");
  });
});

