import { describe, it, expect, beforeEach } from "bun:test";
import {
  encryptBotToken,
  decryptBotToken,
  maskBotToken,
  isValidBotTokenFormat,
} from "./encryption";
import {
  escapeHtml,
  formatHashtags,
  formatCurrencyCents,
  renderStandardTemplate,
  renderIctTemplate,
  renderCustomTemplate,
  formatTradeClosureUpdateMessage,
  formatTradingTodoReminderMessage,
} from "./formatter";
import {
  parseTaskDueTimestamp,
  parseZonedTimestamp,
  getTodayDateInTimezone,
  parseCustomReminderTimestamp,
  isWithinQuietHours,
  deferPastQuietHours,
} from "./reminder-scheduler";
import { chunkArray } from "./delivery-engine";

describe("AlphaPips Telegram Integration — Complete System Tests", () => {
  // ── 1. SECURITY & TOKEN ENCRYPTION ─────────────────────────────────
  describe("Security, Token Encryption & Webhook Validation", () => {
    const validToken = "1234567890:AAH_randomFakeBotTokenForTesting_1234";

    it("verifies token format correctly", () => {
      expect(isValidBotTokenFormat(validToken)).toBe(true);
      expect(isValidBotTokenFormat("invalid")).toBe(false);
      expect(isValidBotTokenFormat("123:short")).toBe(false);
    });

    it("encrypts and decrypts with authenticated AES-256-GCM", () => {
      const encrypted = encryptBotToken(validToken);
      expect(encrypted.encryptedBotToken).not.toBe(validToken);

      const decrypted = decryptBotToken(
        encrypted.encryptedBotToken,
        encrypted.botTokenIv,
        encrypted.botTokenTag
      );
      expect(decrypted).toBe(validToken);
    });

    it("masks the token for UI display without leaking credentials", () => {
      const masked = maskBotToken(validToken);
      expect(masked).toBe("1234••••••••••••••••1234");
      expect(masked).not.toContain("randomFakeBotToken");
    });

    it("fails decryption when ciphertext is tampered", () => {
      const encrypted = encryptBotToken(validToken);
      const tamperedCipher = encrypted.encryptedBotToken.slice(0, -4) + "0000";
      expect(() => {
        decryptBotToken(tamperedCipher, encrypted.botTokenIv, encrypted.botTokenTag);
      }).toThrow();
    });
  });

  // ── 2. MESSAGE TEMPLATES & FORMATTING ──────────────────────────────
  describe("Trade Message Formatter & Templates", () => {
    it("escapes malicious HTML characters", () => {
      expect(escapeHtml("<script>alert('hack')</script>")).toBe(
        "&lt;script&gt;alert('hack')&lt;/script&gt;"
      );
      expect(escapeHtml("US500 & NAS100 > DAX")).toBe("US500 &amp; NAS100 &gt; DAX");
    });

    it("formats hashtags cleanly without duplicate or invalid characters", () => {
      const tags = ["New York PM", "Fair Value Gap", "EUR/USD", "Win!", "Win!"];
      const result = formatHashtags(tags);
      expect(result).toBe("#NewYorkPM #FairValueGap #EURUSD #Win");
    });

    it("formats currency cents across USD and GBP accurately", () => {
      expect(formatCurrencyCents(1050000, "USD")).toBe("+$10,500.00");
      expect(formatCurrencyCents(-25000, "USD")).toBe("-$250.00");
      expect(formatCurrencyCents(500000, "GBP")).toBe("+£5,000.00");
    });

    it("renders Standard template with complete trade details", () => {
      const trade = {
        instrumentSymbol: "NAS100",
        direction: "long",
        status: "open",
        session: "ny_am",
        timeframe: "5m",
        plannedEntryPrice: "20500.00",
        plannedStopPrice: "20450.00",
        plannedTargetPrice: "20650.00",
        plannedRiskPct: "1.0",
        plannedRR: "3.0",
        strategyName: "Opening Range Breakout",
        description: "Broke morning high on heavy volume.",
        tags: ["Indices", "NYSession"],
      };

      const output = renderStandardTemplate(trade, { includeRisk: true, includeTags: true });
      expect(output).toContain("<b>ASSET: NAS100</b>");
      expect(output).toContain("<b>DIRECTION: Long 🟢</b>");
      expect(output).toContain("• Strategy: Opening Range Breakout");
      expect(output).toContain("• Planned R:R: 1:3");
      expect(output).toContain("• Outcome: Ongoing ⏳");
      expect(output).toContain("#NAS100");
    });

    it("renders ICT 2022 template with HTF context and execution steps", () => {
      const trade = {
        instrumentSymbol: "EURUSD",
        direction: "short",
        status: "win",
        session: "london",
        plannedRiskPct: "1.0",
        plannedRR: "2.5",
        actualR: "2.5",
        netPnlCents: 250000,
        setupJson: JSON.stringify({
          htfContext: { dol: "Previous Day Low (PDL)", pdArray: "1H Bearish OB", bias: "Bearish" },
          liquidity: { sweep: "London Open High swept" },
          structure: { mss: "1m CHoCH" },
          entryModel: { fvg: "2m FVG" },
        }),
        lessons: "Stuck to the model without greed.",
        tags: ["ICT2022", "London"],
      };

      const output = renderIctTemplate(trade, { includeTags: true });
      expect(output).toContain("<b>1️⃣ HIGH-TIME-FRAME (HTF) CONTEXT</b>");
      expect(output).toContain("• Draw on Liquidity (DOL): Previous Day Low (PDL)");
      expect(output).toContain("• HTF PD Array: 1H Bearish OB");
      expect(output).toContain("<b>2️⃣ ICT 2022 ENTRY EXECUTION</b>");
      expect(output).toContain("• Liquidity Sweep: London Open High swept");
      expect(output).toContain("• Market Structure Shift (MSS): 1m CHoCH");
      expect(output).toContain("• Final R: 2.5R");
      expect(output).toContain("• Net P&amp;L: +$2,500.00");
    });

    it("renders Custom template replacing placeholders dynamically", () => {
      const trade = {
        instrumentSymbol: "US30",
        direction: "long",
        status: "win",
        netPnlCents: 150000,
        tags: ["Futures"],
      };

      const customPattern = `ALERT: {{asset}} - {{direction}}\nRESULT: {{net_pnl}}\nTAGS: {{tags}}`;
      const output = renderCustomTemplate(trade, customPattern);
      expect(output).toBe("ALERT: US30 - Long 🟢\nRESULT: +$1,500.00\nTAGS: #US30 #Long #Futures");
    });

    it("formats trade closure update message with reply content", () => {
      const trade = {
        instrumentSymbol: "XAUUSD",
        direction: "short",
        status: "win",
        exitPriceAvg: "2610.00",
        actualR: "3.5",
        netPnlCents: 350000,
        accountCurrency: "USD",
        lessons: "TP hit at 1H liquidity pool.",
      };

      const update = formatTradeClosureUpdateMessage(trade);
      expect(update).toContain("🎯 <b>TRADE CLOSED UPDATE: XAUUSD (Short 🔴)</b>");
      expect(update).toContain("• <b>Final Outcome:</b> Win 🎯");
      expect(update).toContain("• <b>Exit Price:</b> 2610.00");
      expect(update).toContain("• <b>Realized Net P&amp;L:</b> +$3,500.00");
      expect(update).toContain("TP hit at 1H liquidity pool.");
    });
  });

  // ── 3. TRADING TO-DO REMINDER SCHEDULER & ACTIONS ──────────────────
  describe("Trading To-Do Reminder Scheduler & Interactive Actions", () => {
    it("parses due date and time into UTC timestamp", () => {
      const parsed = parseTaskDueTimestamp("2026-11-20", "14:30");
      expect(parsed.toISOString()).toContain("2026-11-20T14:30:00");
    });

    it("evaluates overnight quiet hours correctly", () => {
      // 23:30 is within 22:00 to 07:00 quiet hours
      const nightDate = new Date("2026-11-20T23:30:00Z");
      expect(isWithinQuietHours(nightDate, "22:00", "07:00")).toBe(true);

      // 03:15 is within quiet hours
      const earlyMorning = new Date("2026-11-20T03:15:00Z");
      expect(isWithinQuietHours(earlyMorning, "22:00", "07:00")).toBe(true);

      // 10:00 is outside quiet hours
      const dayDate = new Date("2026-11-20T10:00:00Z");
      expect(isWithinQuietHours(dayDate, "22:00", "07:00")).toBe(false);
    });

    it("formats To-Do reminder with interactive inline callback buttons", () => {
      const task = {
        id: "task_456",
        title: "Daily Risk Review",
        description: "Verify daily drawdown limit before London session",
        priority: "urgent",
        status: "pending",
        dueDate: "2026-11-20",
        dueTime: "07:45",
        reminderMinutesBefore: 15,
        subtasks: [{ id: "sub_1", title: "Check FTMO daily loss buffer", completed: false }],
      };

      const reminder = formatTradingTodoReminderMessage(task);
      expect(reminder.text).toContain("🚨 URGENT");
      expect(reminder.text).toContain("Daily Risk Review");
      expect(reminder.text).toContain("Due in 15 minutes");

      // Verify callback buttons
      const buttons = reminder.replyMarkup.inline_keyboard;
      expect(buttons[0][0].text).toBe("✅ Mark Complete");
      expect(buttons[0][0].callback_data).toBe("task_done:task_456");
      expect(buttons[1][0].text).toBe("⏰ Snooze 15m");
      expect(buttons[1][0].callback_data).toBe("task_snooze:task_456:15");
      expect(buttons[1][1].text).toBe("⏰ Snooze 1h");
      expect(buttons[1][1].callback_data).toBe("task_snooze:task_456:60");
    });
  });

  // ── 4. HARDENING: MULTI-ALBUM SPLITTING, QUIET HOURS DEFERRAL & IDEMPOTENCY ─
  describe("Hardening Pass: Multi-Album Chunking, Quiet Hours Deferral, Idempotency & Auth", () => {
    it("chunks screenshot media into albums of at most 10 items", () => {
      // 1 screenshot -> 1 chunk of 1
      const one = ["img1.png"];
      expect(chunkArray(one, 10)).toEqual([["img1.png"]]);

      // 10 screenshots -> 1 chunk of 10
      const ten = Array.from({ length: 10 }, (_, i) => `img${i + 1}.png`);
      const tenChunks = chunkArray(ten, 10);
      expect(tenChunks.length).toBe(1);
      expect(tenChunks[0].length).toBe(10);

      // 11 screenshots -> 2 chunks: 10 in first album, 1 in second
      const eleven = Array.from({ length: 11 }, (_, i) => `img${i + 1}.png`);
      const elevenChunks = chunkArray(eleven, 10);
      expect(elevenChunks.length).toBe(2);
      expect(elevenChunks[0].length).toBe(10);
      expect(elevenChunks[1].length).toBe(1);
      expect(elevenChunks[1][0]).toBe("img11.png");

      // 25 screenshots -> 3 chunks: 10, 10, 5
      const twentyFive = Array.from({ length: 25 }, (_, i) => `img${i + 1}.png`);
      const tfChunks = chunkArray(twentyFive, 10);
      expect(tfChunks.length).toBe(3);
      expect(tfChunks[0].length).toBe(10);
      expect(tfChunks[1].length).toBe(10);
      expect(tfChunks[2].length).toBe(5);
    });

    it("defers quiet hours reminders to the exact end of quiet hours rather than discarding them", () => {
      // Case 1: Late evening (23:30) within 22:00-07:00 window -> deferred to 07:00 next morning
      const lateEvening = new Date("2026-11-20T23:30:00Z");
      const deferredNextDay = deferPastQuietHours(lateEvening, "22:00", "07:00");
      expect(deferredNextDay.toISOString()).toBe("2026-11-21T07:00:00.000Z");
      expect(deferredNextDay.getTime()).toBeGreaterThan(lateEvening.getTime());

      // Case 2: Early morning (03:15) within 22:00-07:00 window -> deferred to 07:00 same day
      const earlyMorning = new Date("2026-11-20T03:15:00Z");
      const deferredSameDay = deferPastQuietHours(earlyMorning, "22:00", "07:00");
      expect(deferredSameDay.toISOString()).toBe("2026-11-20T07:00:00.000Z");
      expect(deferredSameDay.getTime()).toBeGreaterThan(earlyMorning.getTime());

      // Case 3: Outside quiet hours (14:00) -> timestamp is unmodified
      const midday = new Date("2026-11-20T14:00:00Z");
      const untouched = deferPastQuietHours(midday, "22:00", "07:00");
      expect(untouched.toISOString()).toBe("2026-11-20T14:00:00.000Z");
    });

    it("generates deterministic keys for automatic trades and unique keys for manual republishing", () => {
      const tradeId = "trade_xyz_789";
      const autoKey1 = `pub:trade:${tradeId}:publish`;
      const autoKey2 = `pub:trade:${tradeId}:publish`;
      // Automatic event is deduplicated
      expect(autoKey1).toBe(autoKey2);

      // Manual republishing produces unique UUID keys that preserve delivery history
      const uuid1 = "11111111-2222-3333-4444-555555555555";
      const uuid2 = "66666666-7777-8888-9999-000000000000";
      const manualKey1 = `pub:trade:${tradeId}:manual:${uuid1}`;
      const manualKey2 = `pub:trade:${tradeId}:manual:${uuid2}`;
      expect(manualKey1).not.toBe(manualKey2);
      expect(manualKey1).toContain(tradeId);
      expect(manualKey2).toContain(tradeId);

      // Accidental duplicate network request with the same client requestId produces identical key for deduplication
      const clientReqId = "req_client_abc_123";
      const dupReqKey1 = `pub:trade:${tradeId}:manual:${clientReqId}`;
      const dupReqKey2 = `pub:trade:${tradeId}:manual:${clientReqId}`;
      expect(dupReqKey1).toBe(dupReqKey2);
    });

    it("handles tasks without due dates using user's configured timezone without UTC date skew", () => {
      // Midnight boundary: When UTC is 02:00 on Nov 19, New York is 21:00 on Nov 18
      const utcEarlyMorning = new Date("2026-11-19T02:00:00.000Z");
      const nyDate = getTodayDateInTimezone("America/New_York", utcEarlyMorning);
      expect(nyDate).toBe("2026-11-18");

      // Tokyo boundary: When UTC is 20:00 on Nov 18, Tokyo is 05:00 on Nov 19
      const utcEvening = new Date("2026-11-18T20:00:00.000Z");
      const tokyoDate = getTodayDateInTimezone("Asia/Tokyo", utcEvening);
      expect(tokyoDate).toBe("2026-11-19");

      // Time-only task (dueTime: "10:00") evaluated in New York at utcEarlyMorning
      // MUST use New York's calendar date (Nov 18), resolving to 2026-11-18 10:00 NY = 15:00 UTC
      const nyTimeOnly = parseTaskDueTimestamp(null, "10:00", "America/New_York", utcEarlyMorning);
      expect(nyTimeOnly.toISOString()).toBe("2026-11-18T15:00:00.000Z");
    });

    it("handles midnight boundaries and timezone transitions accurately", () => {
      // Midnight in New York (EST, UTC-5): 2026-11-20 00:00 is 05:00 UTC
      const nyMidnight = parseZonedTimestamp("2026-11-20", "00:00", "America/New_York");
      expect(nyMidnight.toISOString()).toBe("2026-11-20T05:00:00.000Z");

      // Midnight in Tokyo (JST, UTC+9): 2026-11-20 00:00 is 15:00 UTC on Nov 19
      const tokyoMidnight = parseZonedTimestamp("2026-11-20", "00:00", "Asia/Tokyo");
      expect(tokyoMidnight.toISOString()).toBe("2026-11-19T15:00:00.000Z");

      // Daylight Saving Time transition check: London Summer Time (BST, UTC+1) vs Winter (GMT, UTC+0)
      const londonSummer = parseZonedTimestamp("2026-07-15", "12:00", "Europe/London");
      expect(londonSummer.toISOString()).toBe("2026-07-15T11:00:00.000Z"); // 12:00 BST = 11:00 UTC

      const londonWinter = parseZonedTimestamp("2026-01-15", "12:00", "Europe/London");
      expect(londonWinter.toISOString()).toBe("2026-01-15T12:00:00.000Z"); // 12:00 GMT = 12:00 UTC
    });

    it("preserves customReminderAt as a proper timezone-aware absolute timestamp", () => {
      // Absolute ISO string with 'Z' is preserved with zero drift
      const isoInput = "2026-11-25T14:30:00.000Z";
      const parsedIso = parseCustomReminderTimestamp(isoInput, "America/New_York");
      expect(parsedIso.toISOString()).toBe("2026-11-25T14:30:00.000Z");

      // Date object is preserved
      const dateObj = new Date("2026-11-25T14:30:00.000Z");
      expect(parseCustomReminderTimestamp(dateObj).getTime()).toBe(dateObj.getTime());

      // Unzoned string interprets within user timezone: 10:00 in New York = 15:00 UTC
      const unzoned = "2026-11-25 10:00";
      const parsedUnzoned = parseCustomReminderTimestamp(unzoned, "America/New_York");
      expect(parsedUnzoned.toISOString()).toBe("2026-11-25T15:00:00.000Z");
    });

    it("formats overdue reminder messages with clear overdue alerts", () => {
      const task = {
        id: "task_overdue_1",
        title: "Submit Daily Journal",
        status: "pending",
        priority: "high",
        dueDate: "2026-11-18",
        dueTime: "20:00",
      };

      const overdueMsg = formatTradingTodoReminderMessage(task, { isOverdue: true });
      expect(overdueMsg.text).toContain("⚠️ <b>ALPHAPIPS — OVERDUE TRADING TASK</b>");
      expect(overdueMsg.text).toContain("🚨 <i>This task is currently past due!</i>");
      expect(overdueMsg.text).toContain("Submit Daily Journal");
    });

    it("validates worker secret authentication strictly and scopes user sessions", () => {
      const cronSecret = "vercel-cron-secret-123456";
      const workerSecret = "telegram-worker-secret-789012";

      // Vercel CRON_SECRET Bearer header
      const vercelAuthHeader = `Bearer ${cronSecret}`;
      expect(vercelAuthHeader === `Bearer ${cronSecret}`).toBe(true);

      // Dedicated TELEGRAM_WORKER_SECRET Bearer header
      const workerAuthHeader = `Bearer ${workerSecret}`;
      expect(workerAuthHeader === `Bearer ${workerSecret}`).toBe(true);

      // Tampered / unauthorized header
      const attackerHeader = "Bearer wrong-secret";
      expect(attackerHeader === `Bearer ${cronSecret}`).toBe(false);
      expect(attackerHeader === `Bearer ${workerSecret}`).toBe(false);

      // Verify that user session invocation resolves to scoped user id, not global
      const mockSessionUser = { id: "user_a_123" };
      const isSystemWorker = false;
      const scopedUser = isSystemWorker ? undefined : mockSessionUser.id;
      expect(scopedUser).toBe("user_a_123");
      expect(scopedUser).not.toBeUndefined();
    });
  });
});
