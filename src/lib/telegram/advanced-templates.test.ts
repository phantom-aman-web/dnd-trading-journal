import { describe, it, expect } from "bun:test";
import {
  renderCustomTemplate,
  formatTradePublicationMessage,
  formatTradeClosureUpdateMessage,
  formatTradePartialExitMessage,
  DEFAULT_NEW_TRADE_TEMPLATE,
  DEFAULT_CLOSURE_TEMPLATE,
  DEFAULT_PARTIAL_EXIT_TEMPLATE,
  FormatterTradeInput,
} from "./formatter";

describe("Advanced Telegram Template Engine", () => {
  const completeTrade: FormatterTradeInput = {
    instrumentSymbol: "EURUSD",
    direction: "long",
    market: "Forex",
    status: "win",
    session: "London",
    timeframe: "15m",
    entryPriceAvg: "1.08500",
    exitPriceAvg: "1.09250",
    plannedEntryPrice: "1.08500",
    plannedStopPrice: "1.08200",
    plannedTargetPrice: "1.09250",
    plannedRiskPct: "1.0",
    plannedRiskAmountCents: 50000,
    plannedRR: "2.5",
    actualR: "+2.50",
    netPnlCents: 125000,
    grossPnlCents: 126200,
    feesCents: 1200,
    positionSize: "2.0 Lots",
    pnlPercent: "1.25",
    accountName: "FTMO Funded",
    accountCurrency: "USD",
    strategyName: "Silver Bullet",
    setupGrade: "A+",
    setupScore: "95/100",
    entryTime: "08:15 UTC",
    exitTime: "10:30 UTC",
    duration: "2h 15m",
    notes: "Clean sweep of liquidity into 15m bullish FVG.",
    lessons: "Patience on confirmation candle paid off.",
    description: "London Silver Bullet setup.",
    tags: ["EURUSD", "Forex", "SilverBullet"],
  };

  it("renders all comprehensive placeholders accurately in custom template", () => {
    const template = `Asset: {{asset}}
Direction: {{direction}}
Market: {{market}}
Status: {{status}}
Outcome: {{outcome}}
Session: {{session}}
Timeframe: {{timeframe}}
Strategy: {{strategy}}
Account: {{account}}
Entry: {{entry}}
Exit: {{exit}}
Stop: {{stop_loss}}
Target: {{take_profit}}
Risk%: {{risk_percent}}
RR: {{risk_reward}}
ActualR: {{actual_r}}
Size: {{position_size}}
NetPnL: {{net_pnl}}
GrossPnL: {{gross_pnl}}
Fees: {{fees}}
Grade: {{grade}}
Score: {{score}}
EntryTime: {{entry_time}}
ExitTime: {{exit_time}}
Duration: {{duration}}
Notes: {{notes}}
Lessons: {{lessons}}
Tags: {{tags}}`;

    const rendered = renderCustomTemplate(completeTrade, template);

    expect(rendered).toContain("Asset: EURUSD");
    expect(rendered).toContain("Direction: Long 🟢");
    expect(rendered).toContain("Market: Forex");
    expect(rendered).toContain("Outcome: Win 🎯");
    expect(rendered).toContain("Session: LONDON");
    expect(rendered).toContain("Timeframe: 15m");
    expect(rendered).toContain("Strategy: Silver Bullet");
    expect(rendered).toContain("Account: FTMO Funded");
    expect(rendered).toContain("Entry: 1.08500");
    expect(rendered).toContain("Exit: 1.09250");
    expect(rendered).toContain("Stop: 1.08200");
    expect(rendered).toContain("Target: 1.09250");
    expect(rendered).toContain("Risk%: 1.0%");
    expect(rendered).toContain("RR: 1:2.5");
    expect(rendered).toContain("ActualR: +2.50R");
    expect(rendered).toContain("Size: 2.0 Lots");
    expect(rendered).toContain("NetPnL: +$1,250.00");
    expect(rendered).toContain("GrossPnL: +$1,262.00");
    expect(rendered).toContain("Fees: +$12.00");
    expect(rendered).toContain("Grade: A+");
    expect(rendered).toContain("Score: 95/100");
    expect(rendered).toContain("EntryTime: 08:15 UTC");
    expect(rendered).toContain("ExitTime: 10:30 UTC");
    expect(rendered).toContain("Duration: 2h 15m");
    expect(rendered).toContain("Notes: Clean sweep of liquidity into 15m bullish FVG.");
    expect(rendered).toContain("Lessons: Patience on confirmation candle paid off.");
    expect(rendered).toContain("#EURUSD");
    expect(rendered).toContain("#Forex");
  });

  it("suppresses unpopulated optional lines ending in N/A or empty", () => {
    const sparseTrade: FormatterTradeInput = {
      instrumentSymbol: "GBPUSD",
      direction: "short",
      status: "open",
      plannedEntryPrice: "1.26500",
    };

    const template = `Asset: {{asset}}
Direction: {{direction}}
• Market: {{market}}
• Exit Price: {{exit}}
• Strategy: {{strategy}}
• Actual R: {{actual_r}}
• Net PnL: {{net_pnl}}
• Account: {{account}}
• Notes: {{notes}}`;

    const rendered = renderCustomTemplate(sparseTrade, template);

    expect(rendered).toContain("Asset: GBPUSD");
    expect(rendered).toContain("Direction: Short 🔴");
    // All unpopulated lines must be suppressed cleanly
    expect(rendered).not.toContain("Market: N/A");
    expect(rendered).not.toContain("Exit Price: N/A");
    expect(rendered).not.toContain("Strategy: N/A");
    expect(rendered).not.toContain("Actual R: N/A");
    expect(rendered).not.toContain("Net PnL: N/A");
    expect(rendered).not.toContain("Account: N/A");
    expect(rendered).not.toContain("Notes:");
  });

  it("supports event-specific templates in customTemplateJson", () => {
    const customConfig = JSON.stringify({
      events: {
        newTrade: "NEW TRADE ALERT: {{asset}} {{direction}} @ {{entry}}",
        tradeClosure: "CLOSURE NOTIFICATION: {{asset}} closed with {{outcome}}, P&L {{net_pnl}}",
        partialExit: "PARTIAL SCALED: {{asset}} secured {{actual_r}}, remaining {{position_size}}",
      },
    });

    const openTrade: FormatterTradeInput = {
      instrumentSymbol: "NQ",
      direction: "long",
      status: "open",
      plannedEntryPrice: "19850",
    };

    const closedTrade: FormatterTradeInput = {
      ...openTrade,
      status: "win",
      netPnlCents: 45000,
    };

    const partialTrade: FormatterTradeInput = {
      ...openTrade,
      actualR: "+1.2",
      positionSize: "1 Contract",
    };

    const pubMsg = formatTradePublicationMessage(openTrade, {
      templateType: "custom",
      customTemplateJson: customConfig,
    });
    expect(pubMsg).toBe("NEW TRADE ALERT: NQ Long 🟢 @ 19850");

    const closureMsg = formatTradeClosureUpdateMessage(closedTrade, {
      templateType: "custom",
      customTemplateJson: customConfig,
    });
    expect(closureMsg).toBe("CLOSURE NOTIFICATION: NQ closed with Win 🎯, P&L +$450.00");

    const partialMsg = formatTradePartialExitMessage(partialTrade, {
      templateType: "custom",
      customTemplateJson: customConfig,
    });
    expect(partialMsg).toBe("PARTIAL SCALED: NQ secured +1.2R, remaining 1 Contract");
  });

  it("exports sensible default templates for new trade, closure, and partial exit", () => {
    expect(DEFAULT_NEW_TRADE_TEMPLATE).toContain("{{asset}}");
    expect(DEFAULT_CLOSURE_TEMPLATE).toContain("{{outcome}}");
    expect(DEFAULT_PARTIAL_EXIT_TEMPLATE).toContain("{{position_size}}");
  });
});
