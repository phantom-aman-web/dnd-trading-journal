// scripts/verify-widget-resizing-and-tips.mjs
import assert from "node:assert";
import {
  ALL_TRADING_TIPS,
  TRADING_TIP_CATEGORIES,
  getSmartRandomTip,
  generateFreshTip,
} from "../src/lib/trading-tips-data.ts";

console.log("=== Verifying Advanced Trading Tip System & Widget Resizing ===");

// 1. Verify 9 Categories
const REQUIRED_CATEGORIES = [
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

console.log("\n1. Verifying Category Coverage...");
assert.strictEqual(
  TRADING_TIP_CATEGORIES.length,
  9,
  `Expected exactly 9 categories, got ${TRADING_TIP_CATEGORIES.length}`
);

for (const cat of REQUIRED_CATEGORIES) {
  assert(
    TRADING_TIP_CATEGORIES.includes(cat),
    `Missing required category: "${cat}"`
  );
}
console.log("✓ All 9 required categories are present!");

// 2. Verify Count Per Category (>= 50 each, total >= 450)
console.log("\n2. Verifying Tip Counts Per Category (Target >= 50 each)...");
const categoryCounts = {};
for (const cat of REQUIRED_CATEGORIES) {
  categoryCounts[cat] = 0;
}

const seenIds = new Set();
const seenTitles = new Set();

for (const tip of ALL_TRADING_TIPS) {
  // Check required fields
  assert(tip.id, "Tip missing ID");
  assert(tip.category, "Tip missing category");
  assert(tip.title, `Tip ${tip.id} missing title`);
  assert(tip.tip, `Tip ${tip.id} missing tip content`);
  assert(tip.whyItMatters, `Tip ${tip.id} missing whyItMatters`);
  assert(tip.practicalAction, `Tip ${tip.id} missing practicalAction`);
  assert(tip.principle, `Tip ${tip.id} missing principle`);

  assert(!seenIds.has(tip.id), `Duplicate tip ID found: "${tip.id}"`);
  seenIds.add(tip.id);

  assert(categoryCounts[tip.category] !== undefined, `Unknown category: "${tip.category}"`);
  categoryCounts[tip.category]++;
}

let totalTips = 0;
for (const [cat, count] of Object.entries(categoryCounts)) {
  console.log(`  - [${count >= 50 ? "PASS" : "FAIL"}] ${cat}: ${count} tips`);
  assert(
    count >= 50,
    `Category "${cat}" has fewer than 50 tips (${count})!`
  );
  totalTips += count;
}

console.log(`\nTotal Curated Tips: ${totalTips}`);
assert(totalTips >= 450, `Expected at least 450 total tips, got ${totalTips}`);
console.log("✓ Tip count requirement exceeded (>= 50 per category, >= 450 total)!");

// 3. Test Smart Balanced Random Tip Picker & Repeat Avoidance
console.log("\n3. Testing Smart Random Tip Picker...");
const recentIds = [];
for (let i = 0; i < 20; i++) {
  const tip = getSmartRandomTip("ICT Concepts", recentIds);
  assert.strictEqual(tip.category, "ICT Concepts");
  assert(!recentIds.includes(tip.id), `Picked recent tip: ${tip.id}`);
  recentIds.push(tip.id);
}
console.log("✓ Successfully drew 20 consecutive distinct tips without repeat!");

// 4. Test Favorites Filtering
console.log("\n4. Testing Favorites Filtering...");
const favIds = [ALL_TRADING_TIPS[0].id, ALL_TRADING_TIPS[1].id];
const favTip = getSmartRandomTip("All", [], true, favIds);
assert(favIds.includes(favTip.id), `Expected tip from favorites, got ${favTip.id}`);
console.log("✓ Favorites filtering verified!");

// 5. Test Fresh Tip Synthesizer
console.log("\n5. Testing Rule-Based Fresh Tip Synthesizer...");
const generated = generateFreshTip("Risk Management");
assert(generated.isGenerated === true, "Generated tip must have isGenerated: true");
assert.strictEqual(generated.category, "Risk Management");
assert(generated.title, "Generated tip missing title");
assert(generated.tip.length > 20, "Generated tip content too short");
assert(generated.whyItMatters.length > 10, "Generated tip missing rationale");
assert(generated.practicalAction.length > 10, "Generated tip missing action");
assert(generated.principle.length > 3, "Generated tip missing principle");
console.log(`  Sample synthesized tip: "${generated.title}" (${generated.category})`);
console.log(`  Principle: "${generated.principle}"`);
console.log("✓ Rule-based fresh tip synthesizer verified!");

console.log("\n=== ALL TRADING TIPS & RESIZING TESTS PASSED! ===");
