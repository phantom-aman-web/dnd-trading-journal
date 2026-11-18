import { describe, it, expect } from "bun:test";
import {
  escapeHtml,
  formatHashtags,
  formatCurrencyCents,
  renderStandardTemplate,
  renderIctTemplate,
  renderCustomTemplate,
  formatTradePublicationMessage,
  formatTradeClosureUpdateMessage,
  formatTradingTodoReminderMessage,
} from "./formatter";

describe("Telegram Message Formatter & Templates", () => {
  it("properly escapes HTML special characters to prevent injection", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;"
    );
    expect(escapeHtml("EUR & USD > GBP")).toBe("EUR &amp; USD &gt; GBP");
    expect(escapeHtml(null)).toBe("");
  });

  it("normalizes tags into valid Telegram hashtags", () => {
    const tags = ["Liquidity Sweep", "New York AM", "ICT 2022", "EUR/USD", "Win!"];
    const hashtags = formatHashtags(tags);
    expect(hashtags).toContain("#LiquiditySweep");
    expect(hashtags).toContain("#NewYorkAM");
    expect(hashtags).toContain("#ICT2022");
    expect(hashtags).toContain("#EURUSD");
    expect(hashtags).toContain("#Win");
  });

  it("formats currency cents cleanly across currencies", () => {
    expect(formatCurrencyCents(917000, "USD")).toBe("+$9,170.00");
    expect(formatCurrencyCents(-123016, "GBP")).toBe("-£1,230.16");
    expect(formatCurrencyCents(0, "USD")).toBe("$0.00");
    expect(formatCurrencyCents(null)).toBe("N/A");
  });

  it("renders the Standard Template correctly with real trade data", () => {
    const trade = {
      instrumentSymbol: "XAUUSD",
      direction: "short",
      status: "open",
      session: "london",
      timeframe: "15m",
      plannedEntryPrice: "2650.50",
      plannedStopPrice: "2658.00",
      plannedTargetPrice: "2625.00",
      plannedRiskPct: "1.0",
      plannedRR: "3.2",
      strategyName: "Silver Bullet",
      description: "Clean liquidity sweep into 15m order block.",
      tags: ["London", "SilverBullet"],
    };

    const rendered = renderStandardTemplate(trade);
    expect(rendered).toContain("<b>ASSET: XAUUSD</b>");
    expect(rendered).toContain("<b>DIRECTION: Short 🔴</b>");
    expect(rendered).toContain("• Strategy: Silver Bullet");
    expect(rendered).toContain("• Planned R:R: 1:3.2");
    expect(rendered).toContain("• Outcome: Ongoing ⏳");
    expect(rendered).toContain("#XAUUSD");
  });

  it("renders the ICT 2022 Template correctly", () => {
    const trade = {
      instrumentSymbol: "EURUSD",
      direction: "long",
      status: "win",
      session: "ny_am",
      plannedRiskPct: "1.0",
      plannedRR: "3.0",
      actualR: "3.1",
      netPnlCents: 310000,
      setupJson: JSON.stringify({
        htfContext: { dol: "1H QM level", pdArray: "PDH", bias: "Bullish" },
        liquidity: { sweep: "Asian Low swept" },
        structure: { mss: "5min CHoCH" },
        entryModel: { fvg: "5min FVG" },
      }),
      lessons: "Followed the model with discipline.",
      tags: ["ICT2022", "London"],
    };

    const rendered = renderIctTemplate(trade);
    expect(rendered).toContain("<b>1️⃣ HIGH-TIME-FRAME (HTF) CONTEXT</b>");
    expect(rendered).toContain("• Draw on Liquidity (DOL): 1H QM level");
    expect(rendered).toContain("<b>2️⃣ ICT 2022 ENTRY EXECUTION</b>");
    expect(rendered).toContain("• Liquidity Sweep: Asian Low swept");
    expect(rendered).toContain("• Market Structure Shift (MSS): 5min CHoCH");
    expect(rendered).toContain("• Entry FVG / IFVG: 5min FVG");
    expect(rendered).toContain("• Outcome: Win 🎯");
    expect(rendered).toContain("• Final R: 3.1R");
    expect(rendered).toContain("• Net P&amp;L: +$3,100.00");
  });

  it("renders custom template with placeholder substitutions safely", () => {
    const trade = {
      instrumentSymbol: "BTCUSD",
      direction: "long",
      status: "win",
      session: "asia",
      netPnlCents: 540000,
      accountCurrency: "USD",
      tags: ["Crypto"],
    };

    const pattern = `🚀 Trade Signal: {{asset}} {{direction}}
P&L: {{net_pnl}}
Tags: {{tags}}`;

    const rendered = renderCustomTemplate(trade, pattern);
    expect(rendered).toContain("🚀 Trade Signal: BTCUSD Long 🟢");
    expect(rendered).toContain("P&L: +$5,400.00");
    expect(rendered).toContain("Tags: #BTCUSD #Long #Crypto");
  });

  it("formats trade closure update message with correct reply content", () => {
    const trade = {
      instrumentSymbol: "XAUUSD",
      direction: "short",
      status: "win",
      exitPriceAvg: "2625.10",
      actualR: "3.2",
      netPnlCents: 320000,
      accountCurrency: "USD",
      lessons: "Target reached smoothly during NY session.",
    };

    const update = formatTradeClosureUpdateMessage(trade);
    expect(update).toContain("🎯 <b>TRADE CLOSED UPDATE: XAUUSD (Short 🔴)</b>");
    expect(update).toContain("• <b>Final Outcome:</b> Win 🎯");
    expect(update).toContain("• <b>Exit Price:</b> 2625.10");
    expect(update).toContain("• <b>Realized Net P&amp;L:</b> +$3,200.00");
    expect(update).toContain("Target reached smoothly");
  });

  it("formats Trading To-Do reminder with details and inline buttons", () => {
    const task = {
      id: "task_123",
      title: "Pre-Market Preparation",
      description: "Review DXY and 10Y Yields",
      priority: "high",
      status: "pending",
      dueDate: "2026-11-19",
      dueTime: "08:30",
      listName: "Routine",
      subtasks: [
        { id: "sub_1", title: "Check Economic Calendar", completed: true },
        { id: "sub_2", title: "Mark Daily High/Low", completed: false },
      ],
      reminderMinutesBefore: 15,
    };

    const reminder = formatTradingTodoReminderMessage(task);
    expect(reminder.text).toContain("🔔 <b>ALPHAPIPS — TRADING REMINDER</b>");
    expect(reminder.text).toContain("📌 <b>Pre-Market Preparation</b>");
    expect(reminder.text).toContain("Due in 15 minutes");
    expect(reminder.text).toContain("☑️ Check Economic Calendar");
    expect(reminder.text).toContain("⬜ Mark Daily High/Low");

    // Check inline keyboard buttons
    expect(reminder.replyMarkup.inline_keyboard[0][0].callback_data).toBe("task_done:task_123");
    expect(reminder.replyMarkup.inline_keyboard[1][0].callback_data).toBe(
      "task_snooze:task_123:15"
    );
    expect(reminder.replyMarkup.inline_keyboard[1][1].callback_data).toBe(
      "task_snooze:task_123:60"
    );
  });
});
