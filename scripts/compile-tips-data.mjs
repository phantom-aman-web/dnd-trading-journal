// scripts/compile-tips-data.mjs
import fs from "fs";
import path from "path";

import { psychologyTips } from "./tips-data/psychology.mjs";
import { riskTips } from "./tips-data/risk.mjs";
import { ictTips } from "./tips-data/ict.mjs";
import { marketStructureTips } from "./tips-data/market-structure.mjs";
import { executionTips } from "./tips-data/execution.mjs";
import { journalingTips } from "./tips-data/journaling.mjs";
import { backtestingTips } from "./tips-data/backtesting.mjs";
import { sessionsTips } from "./tips-data/sessions.mjs";
import { performanceTips } from "./tips-data/performance.mjs";

const categoriesMap = [
  { prefix: "psych", category: "Trading Psychology & Discipline", tips: psychologyTips },
  { prefix: "risk", category: "Risk Management", tips: riskTips },
  { prefix: "ict", category: "ICT Concepts", tips: ictTips },
  { prefix: "mkt", category: "Market Structure & Price Action", tips: marketStructureTips },
  { prefix: "exec", category: "Strategy Execution", tips: executionTips },
  { prefix: "journ", category: "Trading Journaling", tips: journalingTips },
  { prefix: "backtest", category: "Backtesting & Strategy Development", tips: backtestingTips },
  { prefix: "sess", category: "Trading Sessions & Market Conditions", tips: sessionsTips },
  { prefix: "perf", category: "Performance & Continuous Improvement", tips: performanceTips },
];

console.log("Verifying tip counts...");
let total = 0;
const allTips = [];

for (const group of categoriesMap) {
  console.log(`- ${group.category}: ${group.tips.length} tips`);
  if (group.tips.length < 50) {
    throw new Error(`Category "${group.category}" has fewer than 50 tips (${group.tips.length})!`);
  }
  group.tips.forEach((t, i) => {
    allTips.push({
      id: `${group.prefix}-${i + 1}`,
      category: group.category,
      title: t.title,
      tip: t.tip,
      whyItMatters: t.whyItMatters,
      practicalAction: t.practicalAction,
      principle: t.principle,
    });
  });
  total += group.tips.length;
}

console.log(`TOTAL TIPS: ${total} across 9 categories!`);

// Generate code for src/lib/trading-tips-data.ts
const code = `// src/lib/trading-tips-data.ts
// Generated comprehensive 9-category trading education & discipline library
// Total curated tips: ${total} (>= 50 per category)

export type TradingTipCategory =
  | "Trading Psychology & Discipline"
  | "Risk Management"
  | "ICT Concepts"
  | "Market Structure & Price Action"
  | "Strategy Execution"
  | "Trading Journaling"
  | "Backtesting & Strategy Development"
  | "Trading Sessions & Market Conditions"
  | "Performance & Continuous Improvement";

export const TRADING_TIP_CATEGORIES: TradingTipCategory[] = [
  "Trading Psychology & Discipline",
  "Risk Management",
  "ICT Concepts",
  "Market Structure & Price Action",
  "Strategy Execution",
  "Trading Journaling",
  "Backtesting & Strategy Development",
  "Trading Sessions & Market Conditions",
  "Performance & Continuous Improvement",
];

export interface TradingTip {
  id: string;
  category: TradingTipCategory;
  title: string;
  tip: string;
  whyItMatters: string;
  practicalAction: string;
  principle: string;
  isGenerated?: boolean;
}

export const ALL_TRADING_TIPS: TradingTip[] = ${JSON.stringify(allTips, null, 2)};

/**
 * Smart balanced random tip picker that avoids immediate repetition
 */
export function getSmartRandomTip(
  category: TradingTipCategory | "All",
  recentTipIds: string[] = [],
  favoritesOnly: boolean = false,
  favoriteIds: string[] = []
): TradingTip {
  let pool = ALL_TRADING_TIPS;

  if (favoritesOnly) {
    pool = pool.filter((t) => favoriteIds.includes(t.id));
  }

  if (category !== "All") {
    pool = pool.filter((t) => t.category === category);
  }

  if (pool.length === 0) {
    // Fallback if favorites or category is empty
    pool = ALL_TRADING_TIPS;
  }

  // Filter out recently viewed tips if pool is large enough
  const eligiblePool = pool.filter((t) => !recentTipIds.includes(t.id));
  const candidatePool = eligiblePool.length > 0 ? eligiblePool : pool;

  const randomIndex = Math.floor(Math.random() * candidatePool.length);
  return candidatePool[randomIndex];
}

/**
 * Dynamic rule-based trading tip synthesizer
 * Generates fresh, pedagogically sound tips combining setup mechanics,
 * session filters, risk parameters, and psychology anchors.
 */
export function generateFreshTip(categoryChoice?: TradingTipCategory | "All"): TradingTip {
  const chosenCategory: TradingTipCategory =
    !categoryChoice || categoryChoice === "All"
      ? TRADING_TIP_CATEGORIES[Math.floor(Math.random() * TRADING_TIP_CATEGORIES.length)]
      : categoryChoice;

  const catalysts = [
    "During high-impact liquidity sweeps at key HTF arrays,",
    "When observing price consolidation leading into session opens,",
    "In periods of elevated Average True Range expansion,",
    "When navigating complex multi-timeframe structural pullbacks,",
    "After consecutive trading session wins or drawdowns,",
    "When an anticipated setup forms outside your approved killzone,"
  ];

  const mechanisms = [
    "prioritize patience for energetic candle body closes over impulsive wick reactions.",
    "re-verify that your structural invalidation level offers at least a 2.5:1 reward-to-risk ratio.",
    "strictly verify that the setup is backed by institutional Fair Value Gap displacement.",
    "ensure your stop loss distance is calculated using dynamic lot sizing rather than fixed lots.",
    "step away from the terminal for 10 minutes to reset emotional dopamine baseline.",
    "log a deliberate No-Trade observation instead of forcing an ambiguous entry."
  ];

  const rationales = [
    "Algorithmic market makers consistently exploit premature retail breakout orders to engineer liquidity.",
    "Capital preservation under uncertainty is the foundational requirement for long-term compound growth.",
    "High-conviction setups require complete multi-timeframe synchronization to minimize drawdown drag.",
    "Executing without predefined structural invalidation transforms systematic trading into pure gambling.",
    "Maintaining emotional equanimity during drawdowns preserves cognitive decision capital for prime A+ setups."
  ];

  const actions = [
    "Audit your current chart: identify the nearest draw on liquidity before touching order routing buttons.",
    "Set price alerts 5 pips before key PD arrays and minimize your charting platform.",
    "Calculate your exact cash risk in AlphaPips before submitting any market or limit order.",
    "Review your trading journal: ensure this setup matches an approved archetype in your formal playbook.",
    "Check the economic calendar to verify no high-impact data release occurs within your holding window."
  ];

  const principles = [
    "Structural Invalidation Primacy",
    "Patience Over Anticipation",
    "Capital Defense Supremacy",
    "Algorithmic Liquidity Awareness",
    "Probabilistic Process Discipline",
    "Dynamic Risk Calibration"
  ];

  const catalyst = catalysts[Math.floor(Math.random() * catalysts.length)];
  const mechanism = mechanisms[Math.floor(Math.random() * mechanisms.length)];
  const rationale = rationales[Math.floor(Math.random() * rationales.length)];
  const action = actions[Math.floor(Math.random() * actions.length)];
  const principle = principles[Math.floor(Math.random() * principles.length)];

  const titles = [
    "Dynamic Execution Calibration",
    "Algorithmic Market Synchronization",
    "Asymmetric Risk Alignment",
    "Session Liquidity Awareness",
    "Disciplined Execution Guardrail",
    "Process-Centric Invalidation"
  ];

  const title = titles[Math.floor(Math.random() * titles.length)];

  return {
    id: \`gen-\${Date.now()}-\${Math.floor(Math.random() * 10000)}\`,
    category: chosenCategory,
    title,
    tip: \`\${catalyst} \${mechanism}\`,
    whyItMatters: rationale,
    practicalAction: action,
    principle,
    isGenerated: true,
  };
}
`;

fs.writeFileSync("src/lib/trading-tips-data.ts", code);
console.log("Successfully wrote src/lib/trading-tips-data.ts!");
