/**
 * DnD — Seed script.
 * Creates a demo user with realistic trades, accounts, instruments, strategies,
 * checklists, daily plans, action items, tags, and notifications.
 * Per spec section 123: clearly identified as demo data.
 *
 * Run with: bun run src/lib/seed.ts
 */

import bcrypt from "bcryptjs";
import { db } from "./db";
import { calculateTradeMetrics } from "./financial-engine";
import {
  evaluateChecklist,
  parseChecklistItems,
  parseGradingThresholds,
  serializeAnswers,
  type ChecklistItem,
  type ChecklistAnswer,
} from "./checklist-evaluation";

const DEMO_EMAIL = "trader@dnd.local";
const DEMO_PASSWORD = "dnd12345";

const INSTRUMENTS = [
  { symbol: "XAUUSD", market: "gold", pipSize: "0.01", tickSize: "0.01", contractSize: "100", pricePrecision: 2, currency: "USD" },
  { symbol: "EURUSD", market: "forex", pipSize: "0.0001", tickSize: "0.00001", contractSize: "100000", pricePrecision: 5, currency: "USD" },
  { symbol: "GBPUSD", market: "forex", pipSize: "0.0001", tickSize: "0.00001", contractSize: "100000", pricePrecision: 5, currency: "USD" },
  { symbol: "NQ", market: "indices", pipSize: "0.25", tickSize: "0.25", contractSize: "20", pricePrecision: 2, currency: "USD" },
  { symbol: "ES", market: "indices", pipSize: "0.25", tickSize: "0.25", contractSize: "50", pricePrecision: 2, currency: "USD" },
  { symbol: "BTCUSD", market: "crypto", pipSize: "0.01", tickSize: "0.01", contractSize: "1", pricePrecision: 2, currency: "USD" },
];

interface TradeSeed {
  daysAgo: number;
  hour: number;
  minute: number;
  symbol: string;
  direction: "long" | "short";
  session: string;
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
  exitPrice: string;
  qty: string;
  feesCents: number;
  commissionCents: number;
  swapCents: number;
  strategyName: string;
  grade: string;
  setupScore: string;
  behaviorFlags: string[];
  psychBefore: string[];
  psychAfter: string[];
  confidence: number;
  thesis: string;
  lessons?: string;
  tags: string[];
}

// 60 realistic trades over the past ~60 days
function generateTrades(): TradeSeed[] {
  const out: TradeSeed[] = [];
  const symbols = INSTRUMENTS;
  const strategies = [
    { name: "London Sweep", grade: "A+", score: "0.92", flags: [] },
    { name: "London Sweep", grade: "A", score: "0.78", flags: [] },
    { name: "NY AM Reversal", grade: "A+", score: "0.95", flags: [] },
    { name: "NY AM Reversal", grade: "B", score: "0.62", flags: ["entered_early"] },
    { name: "Asia Range Break", grade: "C", score: "0.45", flags: ["chased_price"] },
    { name: "Asia Range Break", grade: "Invalid", score: "0.30", flags: ["broke_rules", "revenge_trade"] },
    { name: "FVG Retest", grade: "A", score: "0.80", flags: [] },
    { name: "Liquidity Sweep", grade: "A+", score: "0.91", flags: [] },
    { name: "MSS Confirmation", grade: "B", score: "0.58", flags: ["moved_stop"] },
  ];
  const sessions = ["asia", "london", "ny_am", "ny_pm"];
  const psychBeforeSets = [
    ["calm", "focused"],
    ["confident", "focused"],
    ["impatient", "distracted"],
    ["fomo", "excited"],
    ["hesitant", "fearful"],
  ];
  const psychAfterSets = [
    ["satisfied", "calm"],
    ["frustrated", "disappointed"],
    ["regret"],
    ["relief"],
    ["overconfident"],
    ["calm"],
  ];

  // Seed pseudo-random with a fixed seed for reproducibility
  let seed = 1234;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Generate 70 trades over ~70 days
  for (let i = 0; i < 70; i++) {
    const daysAgo = Math.floor(rand() * 70);
    const hour = sessions[Math.floor(rand() * sessions.length)] === "asia" ? 2
      : sessions[Math.floor(rand() * sessions.length)] === "london" ? 8
      : sessions[Math.floor(rand() * sessions.length)] === "ny_am" ? 13
      : 17;
    const minute = Math.floor(rand() * 60);
    const instr = symbols[Math.floor(rand() * symbols.length)];
    const strat = strategies[Math.floor(rand() * strategies.length)];
    const direction = rand() > 0.45 ? "long" : "short";
    const session = sessions[Math.floor(rand() * sessions.length)];

    // Build realistic prices per instrument
    let basePrice: number;
    switch (instr.symbol) {
      case "XAUUSD": basePrice = 2000 + rand() * 100; break;
      case "EURUSD": basePrice = 1.05 + rand() * 0.1; break;
      case "GBPUSD": basePrice = 1.2 + rand() * 0.1; break;
      case "NQ": basePrice = 15000 + rand() * 1000; break;
      case "ES": basePrice = 4500 + rand() * 200; break;
      case "BTCUSD": basePrice = 60000 + rand() * 10000; break;
      default: basePrice = 100;
    }
    const entry = basePrice.toFixed(instr.pricePrecision);
    const stopDist = basePrice * (0.002 + rand() * 0.005);
    const targetDist = stopDist * (1.5 + rand() * 2);
    const stop = direction === "long"
      ? (basePrice - stopDist).toFixed(instr.pricePrecision)
      : (basePrice + stopDist).toFixed(instr.pricePrecision);
    const target = direction === "long"
      ? (basePrice + targetDist).toFixed(instr.pricePrecision)
      : (basePrice - targetDist).toFixed(instr.pricePrecision);

    // Win/loss outcome weighted by setup grade
    let isWin: boolean;
    if (strat.grade === "A+") isWin = rand() > 0.3;
    else if (strat.grade === "A") isWin = rand() > 0.45;
    else if (strat.grade === "B") isWin = rand() > 0.6;
    else if (strat.grade === "C") isWin = rand() > 0.7;
    else isWin = rand() > 0.85;

    const rMultiple = isWin ? 0.5 + rand() * 2.5 : -(0.5 + rand() * 0.6);
    const exit = direction === "long"
      ? (basePrice + rMultiple * stopDist).toFixed(instr.pricePrecision)
      : (basePrice - rMultiple * stopDist).toFixed(instr.pricePrecision);

    const qty = instr.market === "forex" ? (rand() > 0.5 ? "0.5" : "0.2")
      : instr.market === "crypto" ? "0.1"
      : "1";

    const psychB = psychBeforeSets[Math.floor(rand() * psychBeforeSets.length)];
    const psychA = isWin
      ? psychAfterSets[0]
      : psychAfterSets[1 + Math.floor(rand() * (psychAfterSets.length - 1))];

    const confidence = 2 + Math.floor(rand() * 4);
    const tags: string[] = [];
    if (strat.grade === "A+") tags.push("high-conviction");
    if (strat.flags.includes("entered_early")) tags.push("early");
    if (strat.flags.includes("revenge_trade")) tags.push("revenge");
    if (session === "ny_am") tags.push("ny-session");

    out.push({
      daysAgo,
      hour,
      minute,
      symbol: instr.symbol,
      direction,
      session,
      entryPrice: entry,
      stopPrice: stop,
      targetPrice: target,
      exitPrice: exit,
      qty,
      feesCents: Math.round((rand() * 4 + 1) * 100),
      commissionCents: Math.round((rand() * 6 + 2) * 100),
      swapCents: Math.round(rand() * 100),
      strategyName: strat.name,
      grade: strat.grade,
      setupScore: strat.score,
      behaviorFlags: strat.flags,
      psychBefore: psychB,
      psychAfter: psychA,
      confidence,
      thesis: isWin
        ? "Clear liquidity sweep followed by displacement and MSS confirmation. Entry inside the FVG with defined risk to recent swing low."
        : "Setup appeared valid but market structure did not confirm; displacement stalled at first mitigation. Lesson recorded.",
      lessons: !isWin ? "Need to wait for explicit MSS confirmation before committing to entry." : undefined,
      tags,
    });
  }
  // sort oldest first
  return out.sort((a, b) => b.daysAgo - a.daysAgo);
}

/**
 * Generate plausible checklist answers for a trade based on its intended
 * grade. The patterns follow the spec's remediation guidance:
 *   - A+ trades:        all 8 items checked
 *   - A trades:         6-7 items checked (one required unchecked)
 *   - B trades:         5 items checked
 *   - C trades:         3-4 items checked
 *   - Invalid trades:   2 items checked
 *
 * The actual evaluated grade/score is computed via `evaluateChecklist`
 * (which applies the required-item cap), so the stored `setupGrade` may
 * differ from the intended grade when a required item is unchecked —
 * that's the realistic behaviour the spec mandates.
 *
 * Items are expected in the order:
 *   [htf(req,2), liq(req,2), disp(req,2), mss(req,1.5),
 *    fvg(opt,1), zone(req,1.5), risk(req,1), session(req,1)]
 */
function generateChecklistAnswers(
  grade: string,
  items: ChecklistItem[],
): ChecklistAnswer {
  const answers: ChecklistAnswer = {};
  // Default everything to unchecked.
  for (const item of items) {
    answers[item.id] = { checked: false };
  }
  if (items.length === 0) return answers;

  // Helper: check the first N items in declared order.
  const checkFirst = (n: number) => {
    for (let i = 0; i < Math.min(n, items.length); i++) {
      answers[items[i].id] = { checked: true };
    }
  };

  switch (grade) {
    case "A+":
      // All items checked.
      checkFirst(items.length);
      break;
    case "A":
      // 6-7 items checked (one required unchecked). Check everything,
      // then uncheck the 4th item (mss — a "minor" required item being
      // missed is a plausible trader slip that turns an A-quality setup
      // into a capped-C).
      checkFirst(items.length);
      if (items[3]) {
        answers[items[3].id] = { checked: false };
      }
      break;
    case "B":
      // 5 items checked.
      checkFirst(5);
      break;
    case "C":
      // 3-4 items checked. Use 4 to leave the score non-trivial.
      checkFirst(4);
      break;
    case "Invalid":
    default:
      // 2 items checked.
      checkFirst(2);
      break;
  }
  return answers;
}

async function seed() {
  console.log("Seeding DnD demo data...");

  // Upsert demo user
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_EMAIL, name: "Demo Trader", passwordHash },
  });

  // Settings
  await db.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      timezone: "UTC",
      theme: "nordic",
      defaultRiskPct: "0.5",
    },
  });

  await db.notificationPreferences.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      prefsJson: JSON.stringify({
        trading: { sessionReminder: true, dailyPlan: true, dailyLoss: true },
        journal: { incompleteTrade: true, eodReminder: true, weeklyReview: true },
        system: { importCompleted: true, uploadCompleted: false, syncConflict: true },
        quietHours: { enabled: false, start: "22:00", end: "07:00" },
      }),
    },
  });

  // Accounts
  const accounts = [
    { name: "Primary Live", broker: "IC Markets", type: "live", currency: "USD", balance: 2500000 },
    { name: "Demo Practice", broker: "FTMO", type: "demo", currency: "USD", balance: 1000000 },
  ];
  for (const a of accounts) {
    const existing = await db.tradingAccount.findFirst({ where: { userId: user.id, name: a.name } });
    if (existing) continue;
    await db.tradingAccount.create({
      data: {
        userId: user.id,
        name: a.name,
        broker: a.broker,
        accountType: a.type,
        currency: a.currency,
        startingBalanceCents: a.balance,
        currentBalanceCents: a.balance,
        isDefault: a.name === "Primary Live",
      },
    });
  }

  // Instruments
  for (const i of INSTRUMENTS) {
    await db.instrument.upsert({
      where: { userId_symbol: { userId: user.id, symbol: i.symbol } },
      update: {},
      create: { userId: user.id, ...i },
    });
  }

  // Checklist config + version — create per-strategy checklists
  // Each strategy gets its own checklist with appropriate items
  const checklistDefs = [
    {
      name: "London Sweep A+ Checklist",
      description: "Setup evaluation for London Sweep strategy",
      items: [
        { id: "htf", text: "HTF bias aligned", required: true, weight: 2, evidenceRequired: true },
        { id: "liq", text: "Liquidity taken", required: true, weight: 2, evidenceRequired: true },
        { id: "disp", text: "Displacement confirmed", required: true, weight: 2, evidenceRequired: true },
        { id: "mss", text: "MSS confirmed", required: true, weight: 1.5, evidenceRequired: true },
        { id: "fvg", text: "FVG present", required: false, weight: 1, evidenceRequired: false },
        { id: "zone", text: "Entry inside defined zone", required: true, weight: 1.5, evidenceRequired: true },
        { id: "risk", text: "Risk compliant", required: true, weight: 1, evidenceRequired: false },
        { id: "session", text: "Valid session", required: true, weight: 1, evidenceRequired: false },
      ],
    },
    {
      name: "NY AM A+ Checklist",
      description: "Setup evaluation for NY AM Reversal strategy",
      items: [
        { id: "htf", text: "HTF bias aligned", required: true, weight: 1.5, evidenceRequired: true },
        { id: "liq", text: "Liquidity taken", required: true, weight: 1.5, evidenceRequired: true },
        { id: "mss", text: "MSS/BOS confirmed", required: true, weight: 2, evidenceRequired: true },
        { id: "disp", text: "Displacement", required: true, weight: 1.5, evidenceRequired: true },
        { id: "fvg", text: "FVG present", required: false, weight: 1, evidenceRequired: false },
        { id: "session", text: "Session alignment", required: true, weight: 1, evidenceRequired: false },
        { id: "target", text: "Target liquidity identified", required: true, weight: 1, evidenceRequired: false },
        { id: "risk", text: "Risk rules satisfied", required: true, weight: 0.5, evidenceRequired: false },
      ],
    },
    {
      name: "Generic A+ Checklist",
      description: "General setup evaluation for other strategies",
      items: [
        { id: "htf", text: "HTF bias aligned", required: true, weight: 2, evidenceRequired: true },
        { id: "liq", text: "Liquidity taken", required: true, weight: 2, evidenceRequired: true },
        { id: "disp", text: "Displacement confirmed", required: true, weight: 2, evidenceRequired: true },
        { id: "mss", text: "MSS confirmed", required: true, weight: 1.5, evidenceRequired: true },
        { id: "fvg", text: "FVG present", required: false, weight: 1, evidenceRequired: false },
        { id: "zone", text: "Entry inside defined zone", required: true, weight: 1.5, evidenceRequired: true },
        { id: "risk", text: "Risk compliant", required: true, weight: 1, evidenceRequired: false },
        { id: "session", text: "Valid session", required: true, weight: 1, evidenceRequired: false },
      ],
    },
  ];

  const checklistMap = new Map<string, { id: string; versionId: string; items: ChecklistItem[]; thresholds: any }>();
  for (const def of checklistDefs) {
    const existing = await db.checklistConfig.findFirst({ where: { userId: user.id, name: def.name } });
    let cl: { id: string } | null = existing;
    if (!cl) {
      cl = await db.checklistConfig.create({
        data: { userId: user.id, name: def.name, description: def.description },
      });
      await db.checklistVersion.create({
        data: {
          checklistId: cl.id,
          versionLabel: "1.0",
          itemsJson: JSON.stringify(def.items),
          gradingThresholdsJson: JSON.stringify({ "A+": 0.9, A: 0.75, B: 0.6, C: 0.4 }),
          effectiveDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      });
    }
    const version = await db.checklistVersion.findFirst({
      where: { checklistId: cl.id },
      orderBy: { effectiveDate: "desc" },
    });
    if (version) {
      checklistMap.set(def.name, {
        id: cl.id,
        versionId: version.id,
        items: parseChecklistItems(version.itemsJson),
        thresholds: parseGradingThresholds(version.gradingThresholdsJson),
      });
    }
  }

  // For backward compat, keep a reference to the first checklist
  const checklist = checklistMap.get("Generic A+ Checklist");
  const checklistVersion = checklist ? await db.checklistVersion.findFirst({
    where: { checklistId: checklist.id },
    orderBy: { effectiveDate: "desc" },
  }) : null;
  const checklistItems: ChecklistItem[] = checklist?.items ?? [];
  const checklistThresholds = checklist?.thresholds ?? null;

  // Strategies + versions
  const strategies = [
    { name: "London Sweep", description: "Trade London session liquidity sweeps with displacement confirmation.", checklistName: "London Sweep A+ Checklist" },
    { name: "NY AM Reversal", description: "Reversal entries during New York AM session after MSS.", checklistName: "NY AM A+ Checklist" },
    { name: "Asia Range Break", description: "Breakout trades from Asia session range.", checklistName: "Generic A+ Checklist" },
    { name: "FVG Retest", description: "Fair value gap retest continuation entries.", checklistName: "Generic A+ Checklist" },
    { name: "MSS Confirmation", description: "Strict market structure shift confirmation entries.", checklistName: "Generic A+ Checklist" },
  ];
  for (const s of strategies) {
    const existing = await db.strategy.findFirst({ where: { userId: user.id, name: s.name } });
    let strategy = existing;
    const checklistConfigId = checklistMap.get(s.checklistName)?.id ?? null;
    if (!strategy) {
      strategy = await db.strategy.create({
        data: {
          userId: user.id,
          name: s.name,
          description: s.description,
          market: "mixed",
          timeframe: "5m-1h",
          session: "mixed",
          checklistConfigId,
        },
      });
      await db.strategyVersion.create({
        data: {
          strategyId: strategy.id,
          versionLabel: "1.0",
          changeReason: "Initial version",
          changeSummary: "Baseline ruleset.",
          rulesJson: JSON.stringify({
            entry: ["Wait for liquidity sweep", "Confirm displacement", "Enter inside FVG"],
            stop: ["Beyond sweep wick"],
            target: ["Opposing liquidity"],
            management: ["Move stop to BE after 1R"],
            invalidation: ["No displacement", "MSS fails"],
          }),
          effectiveDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      });
      await db.strategyVersion.create({
        data: {
          strategyId: strategy.id,
          versionLabel: "1.1",
          changeReason: "Tightened entry zone",
          changeSummary: "Require entry inside FVG instead of just near it.",
          rulesJson: JSON.stringify({
            entry: ["Wait for liquidity sweep", "Confirm displacement", "Enter inside FVG (strict)"],
            stop: ["Beyond sweep wick"],
            target: ["Opposing liquidity"],
            management: ["Move stop to BE after 1R"],
            invalidation: ["No displacement", "MSS fails", "Entry outside FVG"],
          }),
          effectiveDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }


  // Tags
  const tagNames = ["high-conviction", "early", "revenge", "ny-session", "london-session", "followed-plan", "reviewed"];
  for (const name of tagNames) {
    await db.tag.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: {},
      create: { userId: user.id, name },
    });
  }

  // Trades. To make the seed reproducible (including
  // TradeChecklistEvaluation records), we always wipe and re-create the
  // demo user's trades. Cascade deletes handle TradeExecution,
  // TradeChecklistEvaluation, TradeMedia, etc. (per prisma schema's
  // onDelete: Cascade on Trade relations).
  const existingTrades = await db.trade.count({ where: { userId: user.id } });
  if (existingTrades > 0) {
    console.log(`Resetting ${existingTrades} existing demo trades (cascade-deletes evaluations, executions, media)...`);
    await db.trade.deleteMany({ where: { userId: user.id } });
  }
  {
    const seeds = generateTrades();
    const account = (await db.tradingAccount.findFirst({ where: { userId: user.id, isDefault: true } }))!;
    for (const s of seeds) {
      const instrument = await db.instrument.findFirst({ where: { userId: user.id, symbol: s.symbol } });
      const strategy = await db.strategy.findFirst({ where: { userId: user.id, name: s.strategyName } });
      const latestVersion = strategy ? await db.strategyVersion.findFirst({
        where: { strategyId: strategy.id },
        orderBy: { effectiveDate: "desc" },
      }) : null;

      const entryTime = new Date(Date.now() - s.daysAgo * 24 * 60 * 60 * 1000);
      entryTime.setUTCHours(s.hour, s.minute, 0, 0);
      const exitTime = new Date(entryTime.getTime() + (1 + Math.floor(Math.random() * 4)) * 60 * 60 * 1000);

      const calc = calculateTradeMetrics({
        direction: s.direction,
        plannedEntryPrice: s.entryPrice,
        plannedStopPrice: s.stopPrice,
        plannedTargetPrice: s.targetPrice,
        fills: [
          { kind: "entry", price: s.entryPrice, quantity: s.qty },
          { kind: "exit", price: s.exitPrice, quantity: s.qty },
        ],
        feesCents: s.feesCents,
        commissionCents: s.commissionCents,
        swapCents: s.swapCents,
        slippageCents: 0,
        instrument: { pointValueCents: 100, pipSize: "0.0001", pricePrecision: 5 } as any, accountCurrency: "USD", // 1.00 per 1.0 price per 1.0 qty
      });

      // Generate plausible A+ checklist answers based on the trade's
      // intended grade, then evaluate them through the same domain module
      // the server uses. Use the strategy-specific checklist if available.
      const stratChecklistName = s.strategyName === "London Sweep" ? "London Sweep A+ Checklist"
        : s.strategyName === "NY AM Reversal" ? "NY AM A+ Checklist"
        : "Generic A+ Checklist";
      const stratChecklist = checklistMap.get(stratChecklistName);
      const stratChecklistItems = stratChecklist?.items ?? checklistItems;
      const stratChecklistThresholds = stratChecklist?.thresholds ?? checklistThresholds;
      const stratChecklistVersionId = stratChecklist?.versionId ?? checklistVersion?.id;

      const answers = generateChecklistAnswers(s.grade, stratChecklistItems);
      const evaluation = evaluateChecklist(
        stratChecklistItems,
        answers,
        stratChecklistThresholds,
      );
      const setupGrade = stratChecklistVersionId ? evaluation.grade : s.grade;
      const setupScore = stratChecklistVersionId ? String(evaluation.score) : s.setupScore;

      const trade = await db.trade.create({
        data: {
          userId: user.id,
          accountId: account.id,
          instrumentId: instrument?.id,
          instrumentSymbol: s.symbol,
          market: instrument?.market,
          direction: s.direction,
          status: calc.status,
          session: s.session,
          strategyId: strategy?.id,
          strategyVersionId: latestVersion?.id,
          // Authoritative grade/score from the strategy-specific A+ checklist evaluation.
          checklistVersionId: stratChecklistVersionId ?? null,
          setupGrade,
          setupScore,
          tagsJson: JSON.stringify(s.tags),
          plannedEntryPrice: s.entryPrice,
          plannedStopPrice: s.stopPrice,
          plannedTargetPrice: s.targetPrice,
          plannedRiskPct: "0.005",
          entryPriceAvg: calc.entryPriceAvg,
          exitPriceAvg: calc.exitPriceAvg,
          positionSize: s.qty,
          feesCents: s.feesCents,
          commissionCents: s.commissionCents,
          swapCents: s.swapCents,
          grossPnlCents: calc.grossPnlNativeCents,
          netPnlCents: calc.netPnlNativeCents,
          actualR: calc.actualR,
          entryTime,
          exitTime,
          tradingTimezone: "UTC",
          setupJson: JSON.stringify({
            htfContext: { weeklyBias: s.direction === "long" ? "bullish" : "bearish", dailyBias: s.direction === "long" ? "bullish" : "bearish" },
            liquidity: ["PDH", "equal highs"],
            structure: ["BOS", "MSS"],
            entryModel: "FVG",
            session: s.session,
          }),
          thesisJson: JSON.stringify({
            why: s.thesis,
            narrative: "Market reached defined liquidity zone and produced the expected reaction.",
            liquidityTarget: "Opposing session high/low",
            confirms: ["Displacement", "MSS"],
            invalidates: ["No displacement", "Stalled structure"],
            target: s.targetPrice,
            earlyExit: "If first mitigation fails to hold",
          }),
          notes: s.thesis,
          lessons: s.lessons,
          psychBeforeJson: JSON.stringify({ moodTags: s.psychBefore, confidence: s.confidence, energy: Math.max(1, s.confidence - 1), impact: "moderate" }),
          psychAfterJson: JSON.stringify({ moodTags: s.psychAfter, confidence: s.confidence, energy: s.confidence, impact: "moderate" }),
          behaviorFlagsJson: JSON.stringify(s.behaviorFlags),
        },
      });

      await db.tradeExecution.createMany({
        data: [
          { tradeId: trade.id, kind: "entry", seq: 0, price: s.entryPrice, quantity: s.qty, timestamp: entryTime },
          { tradeId: trade.id, kind: "exit", seq: 0, price: s.exitPrice, quantity: s.qty, timestamp: exitTime },
        ],
      });

      // Persist the TradeChecklistEvaluation snapshot (spec section 41)
      // — same shape as what POST /api/trades writes when a user submits
      // the A+ Setup Checklist on the trade form. Uses the strategy-specific checklist.
      if (stratChecklistVersionId) {
        await db.tradeChecklistEvaluation.create({
          data: {
            tradeId: trade.id,
            checklistVersionId: stratChecklistVersionId,
            rawAnswersJson: serializeAnswers(answers),
            weightedScore: String(evaluation.score),
            finalGrade: evaluation.grade,
          },
        });
      }
    }
    console.log(`Seeded ${seeds.length} trades (with checklist evaluations).`);
  }

  // Sample daily plans for last 5 days
  for (let d = 0; d < 5; d++) {
    const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    date.setUTCHours(0, 0, 0, 0);
    const existing = await db.dailyPlan.findUnique({ where: { userId_date: { userId: user.id, date } } });
    if (existing) continue;
    await db.dailyPlan.create({
      data: {
        userId: user.id,
        date,
        weeklyBias: d % 2 === 0 ? "bullish" : "bearish",
        dailyBias: d % 2 === 0 ? "bullish" : "bearish",
        instruments: "XAUUSD, EURUSD, NQ",
        pwh: "2008.50",
        pwl: "1995.20",
        pdh: "2010.10",
        pdl: "1992.40",
        session: "ny_am",
        setupConditions: "Wait for liquidity sweep + MSS confirmation",
        invalidation: "Close below 1990 invalidates bullish bias",
        maxTrades: 2,
        maxDailyRiskPct: "0.01",
        notes: "Focus on quality over quantity. Patience is the edge.",
      },
    });
  }

  // Sample action items
  const existingActions = await db.actionItem.count({ where: { userId: user.id } });
  if (existingActions === 0) {
    await db.actionItem.createMany({
      data: [
        { userId: user.id, title: "Wait for MSS confirmation before entry", description: "Multiple trades this week entered before MSS confirmed.", status: "open" },
        { userId: user.id, title: "Limit to 2 trades per session", description: "Overtrading observed in NY AM.", status: "open" },
        { userId: user.id, title: "Journal every trade within 24 hours", description: "Keep entries fresh and accurate.", status: "open" },
      ],
    });
  }

  // Sample notifications
  const existingNotifs = await db.notification.count({ where: { userId: user.id } });
  if (existingNotifs === 0) {
    await db.notification.createMany({
      data: [
        { userId: user.id, category: "journal", title: "Incomplete trade", body: "A trade from yesterday is missing exit details." },
        { userId: user.id, category: "system", title: "Welcome to DnD", body: "Your demo data is ready. Explore the dashboard, journal, and analytics." },
      ],
    });
  }

  // Goals
  const existingGoals = await db.goal.count({ where: { userId: user.id } });
  if (existingGoals === 0) {
    await db.goal.createMany({
      data: [
        { userId: user.id, title: "Journal every trade", kind: "process", target: "100% adherence" },
        { userId: user.id, title: "Max 2 trades per day", kind: "process" },
        { userId: user.id, title: "Maintain A+ only filter", kind: "performance", target: "Avg R > 0.5 over 30 trades" },
      ],
    });
  }

  console.log("Seed complete.");
  console.log(`Demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
