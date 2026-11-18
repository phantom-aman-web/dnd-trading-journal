/**
 * AlphaPips — Telegram Message Formatter & Template Engine
 * Generates structured, deterministic HTML messages for Telegram Bot API.
 * Escapes user inputs to prevent HTML injection and produces valid Telegram entities.
 */

export interface FormatterTradeInput {
  instrumentSymbol: string;
  direction: string; // long | short
  status: string; // open | win | loss | breakeven | cancelled | partial_win | partial_loss
  market?: string | null;
  session?: string | null;
  timeframe?: string | null;
  entryPriceAvg?: string | number | null;
  exitPriceAvg?: string | number | null;
  plannedEntryPrice?: string | number | null;
  plannedStopPrice?: string | number | null;
  plannedTargetPrice?: string | number | null;
  plannedRiskPct?: string | number | null;
  plannedRiskAmountCents?: number | null;
  plannedRR?: string | number | null;
  actualR?: string | number | null;
  netPnlCents?: number | null;
  grossPnlCents?: number | null;
  feesCents?: number | null;
  positionSize?: string | number | null;
  accountName?: string | null;
  accountCurrency?: string | null;
  strategyName?: string | null;
  setupGrade?: string | null;
  setupScore?: string | null;
  notes?: string | null;
  lessons?: string | null;
  description?: string | null;
  tags?: string[] | null;
  setupJson?: string | null;
  thesisJson?: string | null;
}

export interface FormatterTaskInput {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  priority: string; // low | medium | high | urgent
  status: string; // pending | in_progress | completed
  dueDate?: string | null;
  dueTime?: string | null;
  listName?: string;
  subtasks?: Array<{ id: string; title: string; completed: boolean }> | null;
  reminderMinutesBefore?: number;
}

export interface TemplateConfigOptions {
  includeScreenshots?: boolean;
  includeTags?: boolean;
  includeDescription?: boolean;
  includeRisk?: boolean;
  includePerformance?: boolean;
  includeAccountName?: boolean;
  templateType?: "standard" | "ict2022" | "custom";
  customTemplateJson?: string | null;
}

/**
 * Escapes characters that have special meaning in Telegram HTML parse mode.
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Normalizes an array of tag strings into valid Telegram hashtags.
 * e.g., "Liquidity Sweep" -> "#LiquiditySweep", "EUR/USD" -> "#EURUSD"
 */
export function formatHashtags(tags: string[] | null | undefined): string {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return "";
  const set = new Set<string>();

  for (const tag of tags) {
    if (!tag) continue;
    // Strip non-alphanumeric except underscores, capitalize words
    const clean = tag
      .trim()
      .split(/[\s_\-/]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("")
      .replace(/[^A-Za-z0-9_]/g, "");

    if (clean.length > 0) {
      set.add(`#${clean}`);
    }
  }

  return Array.from(set).join(" ");
}

/**
 * Formats monetary amounts from cents with appropriate currency symbols and signs.
 */
export function formatCurrencyCents(
  cents: number | null | undefined,
  currency = "USD"
): string {
  if (cents === null || cents === undefined) return "N/A";
  const val = cents / 100;
  const sym = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  const sign = val > 0 ? "+" : val < 0 ? "-" : "";
  const abs = Math.abs(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${sym}${abs}`;
}

/**
 * Formats human-readable trade status label.
 */
export function formatTradeOutcome(status: string): string {
  const s = status.toLowerCase();
  if (s === "open") return "Ongoing ⏳";
  if (s === "win" || s === "partial_win") return "Win 🎯";
  if (s === "loss" || s === "partial_loss") return "Loss ❌";
  if (s === "breakeven") return "Breakeven ⚖️";
  if (s === "cancelled") return "Cancelled 🚫";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Standard Trading Template
 */
export function renderStandardTemplate(
  trade: FormatterTradeInput,
  options: TemplateConfigOptions = {}
): string {
  const symbol = escapeHtml(trade.instrumentSymbol.toUpperCase());
  const direction = trade.direction.toLowerCase() === "long" ? "Long 🟢" : "Short 🔴";
  const session = trade.session ? escapeHtml(trade.session.toUpperCase()) : "N/A";

  const lines: string[] = [];
  lines.push(`📊 <b>ASSET: ${symbol}</b>`);
  lines.push(`📈 <b>DIRECTION: ${direction}</b>`);
  if (trade.session) {
    lines.push(`⏰ <b>SESSION: ${session}</b>`);
  }
  lines.push("");

  // Section 1: Trade Information
  lines.push("<b>1. TRADE INFORMATION</b>");
  if (trade.strategyName) {
    lines.push(`• Strategy: ${escapeHtml(trade.strategyName)}`);
  }
  if (trade.timeframe) {
    lines.push(`• Timeframe: ${escapeHtml(trade.timeframe)}`);
  }
  const entry = trade.entryPriceAvg ?? trade.plannedEntryPrice;
  if (entry) {
    lines.push(`• Entry: ${escapeHtml(String(entry))}`);
  }
  if (trade.plannedStopPrice) {
    lines.push(`• Stop Loss: ${escapeHtml(String(trade.plannedStopPrice))}`);
  }
  if (trade.plannedTargetPrice) {
    lines.push(`• Take Profit: ${escapeHtml(String(trade.plannedTargetPrice))}`);
  }
  if (options.includeAccountName && trade.accountName) {
    lines.push(`• Account: ${escapeHtml(trade.accountName)}`);
  }
  lines.push("");

  // Section 2: Risk & Management
  if (options.includeRisk !== false || options.includePerformance !== false) {
    lines.push("<b>2. RISK &amp; MANAGEMENT</b>");
    if (options.includeRisk !== false) {
      if (trade.plannedRiskPct) {
        lines.push(`• Risk: ${escapeHtml(String(trade.plannedRiskPct))}%`);
      }
      if (trade.plannedRR) {
        lines.push(`• Planned R:R: 1:${escapeHtml(String(trade.plannedRR))}`);
      }
    }
    if (options.includePerformance !== false) {
      lines.push(`• Outcome: ${formatTradeOutcome(trade.status)}`);
      if (trade.actualR !== null && trade.actualR !== undefined) {
        lines.push(`• Actual R: ${escapeHtml(String(trade.actualR))}R`);
      }
      if (trade.netPnlCents !== null && trade.netPnlCents !== undefined && trade.status !== "open") {
        lines.push(
          `• Net P&amp;L: ${formatCurrencyCents(trade.netPnlCents, trade.accountCurrency || "USD")}`
        );
      }
    }
    lines.push("");
  }

  // Section 3: Notes & Description
  const hasDesc = options.includeDescription !== false && (trade.description || trade.notes);
  if (hasDesc) {
    lines.push("<b>3. NOTES</b>");
    const noteText = trade.description || trade.notes;
    lines.push(escapeHtml(noteText));
    lines.push("");
  }

  // Hashtags
  if (options.includeTags !== false) {
    const defaultTags = [trade.instrumentSymbol, trade.direction];
    if (trade.session) defaultTags.push(trade.session);
    if (trade.status && trade.status !== "open") defaultTags.push(trade.status);
    const userTags = trade.tags || [];
    const allTags = Array.from(new Set([...defaultTags, ...userTags]));
    const tagsFormatted = formatHashtags(allTags);
    if (tagsFormatted) {
      lines.push(tagsFormatted);
    }
  }

  return lines.join("\n").trim();
}

/**
 * ICT 2022 Template
 */
export function renderIctTemplate(
  trade: FormatterTradeInput,
  options: TemplateConfigOptions = {}
): string {
  const symbol = escapeHtml(trade.instrumentSymbol.toUpperCase());
  const direction = trade.direction.toLowerCase() === "long" ? "Long 🟢" : "Short 🔴";
  const session = trade.session ? escapeHtml(trade.session.toUpperCase()) : "N/A";

  const lines: string[] = [];
  lines.push(`📊 <b>ASSET: ${symbol}</b>`);
  lines.push(`📈 <b>DIRECTION: ${direction}</b>`);
  if (trade.session) {
    lines.push(`⏰ <b>SESSION: ${session}</b>`);
  }
  lines.push("");

  // Parse structured setup/thesis JSON if available
  let setup: any = {};
  let thesis: any = {};
  try {
    if (trade.setupJson) setup = JSON.parse(trade.setupJson);
  } catch {}
  try {
    if (trade.thesisJson) thesis = JSON.parse(trade.thesisJson);
  } catch {}

  // 1. HTF Context
  const dol = setup.htfContext?.dol || thesis.liquidityTarget || setup.dol;
  const pdArray = setup.htfContext?.pdArray || setup.pdArray;
  const htfBias = setup.htfContext?.bias || setup.bias;
  const confluence = setup.htfContext?.confluence || thesis.confirms;

  if (dol || pdArray || htfBias || confluence) {
    lines.push("<b>1️⃣ HIGH-TIME-FRAME (HTF) CONTEXT</b>");
    if (dol) lines.push(`• Draw on Liquidity (DOL): ${escapeHtml(dol)}`);
    if (pdArray) lines.push(`• HTF PD Array: ${escapeHtml(pdArray)}`);
    if (htfBias) lines.push(`• Market Bias: ${escapeHtml(htfBias)}`);
    if (confluence) lines.push(`• Confluence: ${escapeHtml(confluence)}`);
    lines.push("");
  }

  // 2. ICT 2022 Entry Execution
  const sweep = setup.liquidity?.sweep || setup.liquiditySweep || setup.sweep;
  const mss = setup.structure?.mss || setup.mss || setup.marketStructureShift;
  const fvg = setup.entryModel?.fvg || setup.fvg || setup.entryFvg;
  const entryModel = setup.entryModel?.model || setup.model;

  if (sweep || mss || fvg || entryModel) {
    lines.push("<b>2️⃣ ICT 2022 ENTRY EXECUTION</b>");
    if (sweep) lines.push(`• Liquidity Sweep: ${escapeHtml(sweep)}`);
    if (mss) lines.push(`• Market Structure Shift (MSS): ${escapeHtml(mss)}`);
    if (fvg) lines.push(`• Entry FVG / IFVG: ${escapeHtml(fvg)}`);
    if (entryModel) lines.push(`• Model: ${escapeHtml(entryModel)}`);
    lines.push("");
  }

  // 3. Management & Metrics
  lines.push("<b>3️⃣ MANAGEMENT &amp; METRICS</b>");
  if (trade.plannedRR) {
    lines.push(`• Risk / Reward (RR): 1:${escapeHtml(String(trade.plannedRR))}`);
  }
  if (trade.plannedRiskPct) {
    lines.push(`• Risk %: ${escapeHtml(String(trade.plannedRiskPct))}%`);
  }
  lines.push(`• Outcome: ${formatTradeOutcome(trade.status)}`);
  if (trade.actualR !== null && trade.actualR !== undefined) {
    lines.push(`• Final R: ${escapeHtml(String(trade.actualR))}R`);
  }
  if (trade.netPnlCents !== null && trade.netPnlCents !== undefined && trade.status !== "open") {
    lines.push(
      `• Net P&amp;L: ${formatCurrencyCents(trade.netPnlCents, trade.accountCurrency || "USD")}`
    );
  }
  lines.push("");

  // 4. Lesson / Emotional Note
  const lesson = trade.lessons || trade.notes || trade.description;
  if (lesson && options.includeDescription !== false) {
    lines.push("<b>4️⃣ LESSON / EMOTIONAL NOTE</b>");
    lines.push(escapeHtml(lesson));
    lines.push("");
  }

  // Hashtags
  if (options.includeTags !== false) {
    const ictTags = ["ICT2022", trade.instrumentSymbol, trade.direction];
    if (trade.session) ictTags.push(trade.session);
    if (trade.status && trade.status !== "open") ictTags.push(trade.status);
    const userTags = trade.tags || [];
    const allTags = Array.from(new Set([...ictTags, ...userTags]));
    const tagsFormatted = formatHashtags(allTags);
    if (tagsFormatted) {
      lines.push(tagsFormatted);
    }
  }

  return lines.join("\n").trim();
}

/**
 * Custom Template Engine
 * Replaces placeholders safely and suppresses unpopulated rows.
 */
export function renderCustomTemplate(
  trade: FormatterTradeInput,
  templatePattern: string,
  options: TemplateConfigOptions = {}
): string {
  if (!templatePattern || typeof templatePattern !== "string") {
    return renderStandardTemplate(trade, options);
  }

  const symbol = escapeHtml(trade.instrumentSymbol.toUpperCase());
  const direction = trade.direction.toLowerCase() === "long" ? "Long 🟢" : "Short 🔴";
  const session = trade.session ? escapeHtml(trade.session.toUpperCase()) : "N/A";
  const entry = trade.entryPriceAvg ?? trade.plannedEntryPrice ?? "N/A";
  const stopLoss = trade.plannedStopPrice ?? "N/A";
  const takeProfit = trade.plannedTargetPrice ?? "N/A";
  const riskPct = trade.plannedRiskPct ? `${trade.plannedRiskPct}%` : "N/A";
  const riskReward = trade.plannedRR ? `1:${trade.plannedRR}` : "N/A";
  const actualR = trade.actualR ? `${trade.actualR}R` : "N/A";
  const outcome = formatTradeOutcome(trade.status);
  const netPnl =
    trade.netPnlCents !== null && trade.netPnlCents !== undefined
      ? formatCurrencyCents(trade.netPnlCents, trade.accountCurrency || "USD")
      : "N/A";
  const timeframe = trade.timeframe ? escapeHtml(trade.timeframe) : "N/A";
  const strategy = trade.strategyName ? escapeHtml(trade.strategyName) : "N/A";
  const description = escapeHtml(trade.description || trade.notes || "");
  const account = trade.accountName ? escapeHtml(trade.accountName) : "N/A";
  const grade = trade.setupGrade ? escapeHtml(trade.setupGrade) : "N/A";

  const allTags = [trade.instrumentSymbol, trade.direction, ...(trade.tags || [])];
  const tags = formatHashtags(allTags);

  const replacements: Record<string, string> = {
    "{{asset}}": symbol,
    "{{direction}}": direction,
    "{{session}}": session,
    "{{timeframe}}": timeframe,
    "{{strategy}}": strategy,
    "{{entry}}": escapeHtml(String(entry)),
    "{{stop_loss}}": escapeHtml(String(stopLoss)),
    "{{take_profit}}": escapeHtml(String(takeProfit)),
    "{{risk_percent}}": escapeHtml(String(riskPct)),
    "{{risk_reward}}": escapeHtml(String(riskReward)),
    "{{actual_r}}": escapeHtml(String(actualR)),
    "{{outcome}}": outcome,
    "{{net_pnl}}": netPnl,
    "{{description}}": description,
    "{{tags}}": tags,
    "{{account}}": account,
    "{{grade}}": grade,
  };

  let result = templatePattern;
  for (const [placeholder, val] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, val);
  }

  // Remove lines that ended up as "Key: N/A" or empty bullet points if they were optional
  return result
    .split("\n")
    .filter((line) => !line.trim().endsWith(": N/A") && line.trim() !== "•")
    .join("\n")
    .trim();
}

/**
 * Universal Formatter Dispatcher
 */
export function formatTradePublicationMessage(
  trade: FormatterTradeInput,
  options: TemplateConfigOptions = {}
): string {
  const t = options.templateType || "standard";
  if (t === "ict2022") {
    return renderIctTemplate(trade, options);
  }
  if (t === "custom" && options.customTemplateJson) {
    try {
      const parsed = JSON.parse(options.customTemplateJson);
      if (parsed.templateText) {
        return renderCustomTemplate(trade, parsed.templateText, options);
      }
    } catch {}
  }
  return renderStandardTemplate(trade, options);
}

/**
 * Trade Closure Update Message
 * Sent as a reply to the original Telegram publication when an open trade is closed.
 */
export function formatTradeClosureUpdateMessage(
  trade: FormatterTradeInput,
  _options: TemplateConfigOptions = {}
): string {
  const symbol = escapeHtml(trade.instrumentSymbol.toUpperCase());
  const direction = trade.direction.toLowerCase() === "long" ? "Long 🟢" : "Short 🔴";
  const outcome = formatTradeOutcome(trade.status);

  const lines: string[] = [];
  lines.push(`🎯 <b>TRADE CLOSED UPDATE: ${symbol} (${direction})</b>`);
  lines.push("");
  lines.push(`• <b>Final Outcome:</b> ${outcome}`);
  if (trade.exitPriceAvg) {
    lines.push(`• <b>Exit Price:</b> ${escapeHtml(String(trade.exitPriceAvg))}`);
  }
  if (trade.actualR !== null && trade.actualR !== undefined) {
    lines.push(`• <b>Final R:</b> ${escapeHtml(String(trade.actualR))}R`);
  }
  if (trade.netPnlCents !== null && trade.netPnlCents !== undefined) {
    lines.push(
      `• <b>Realized Net P&amp;L:</b> ${formatCurrencyCents(
        trade.netPnlCents,
        trade.accountCurrency || "USD"
      )}`
    );
  }
  if (trade.lessons || trade.notes) {
    lines.push("");
    lines.push("<b>Lessons / Execution Notes:</b>");
    lines.push(escapeHtml(trade.lessons || trade.notes));
  }

  return lines.join("\n").trim();
}

/**
 * Trading To-Do Private Reminder Message Formatter
 */
export function formatTradingTodoReminderMessage(
  task: FormatterTaskInput,
  options: { baseUrl?: string; isOverdue?: boolean } = {}
): { text: string; replyMarkup: any } {
  const priorityEmoji =
    task.priority === "urgent"
      ? "🚨 URGENT"
      : task.priority === "high"
      ? "🔥 HIGH"
      : task.priority === "low"
      ? "🟢 LOW"
      : "⚡ MEDIUM";

  const lines: string[] = [];
  if (options.isOverdue) {
    lines.push("⚠️ <b>ALPHAPIPS — OVERDUE TRADING TASK</b>");
    lines.push("");
    lines.push(`📌 <b>${escapeHtml(task.title)}</b>`);
    lines.push("🚨 <i>This task is currently past due!</i>");
  } else {
    lines.push("🔔 <b>ALPHAPIPS — TRADING REMINDER</b>");
    lines.push("");
    lines.push(`📌 <b>${escapeHtml(task.title)}</b>`);

    if (task.reminderMinutesBefore && task.reminderMinutesBefore > 0) {
      lines.push(`<i>Due in ${task.reminderMinutesBefore} minutes</i>`);
    } else if (task.dueTime) {
      lines.push(`<i>Scheduled for ${escapeHtml(task.dueTime)}</i>`);
    }
  }
  lines.push("");

  lines.push("<b>Task Details</b>");
  lines.push(`• Priority: ${priorityEmoji}`);
  if (task.listName) {
    lines.push(`• List: ${escapeHtml(task.listName)}`);
  }
  if (task.dueDate) {
    lines.push(`• Due Date: ${escapeHtml(task.dueDate)}`);
  }
  if (task.dueTime) {
    lines.push(`• Due Time: ${escapeHtml(task.dueTime)}`);
  }

  if (task.description) {
    lines.push("");
    lines.push("<b>Description:</b>");
    lines.push(escapeHtml(task.description));
  }

  if (task.subtasks && task.subtasks.length > 0) {
    lines.push("");
    lines.push("<b>Checklist:</b>");
    for (const sub of task.subtasks.slice(0, 5)) {
      const mark = sub.completed ? "☑️" : "⬜";
      lines.push(`${mark} ${escapeHtml(sub.title)}`);
    }
    if (task.subtasks.length > 5) {
      lines.push(`<i>...and ${task.subtasks.length - 5} more item(s)</i>`);
    }
  }

  // Interactive inline keyboard
  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "✅ Mark Complete",
          callback_data: `task_done:${task.id}`,
        },
      ],
      [
        {
          text: "⏰ Snooze 15m",
          callback_data: `task_snooze:${task.id}:15`,
        },
        {
          text: "⏰ Snooze 1h",
          callback_data: `task_snooze:${task.id}:60`,
        },
      ],
    ],
  };

  return {
    text: lines.join("\n").trim(),
    replyMarkup,
  };
}
