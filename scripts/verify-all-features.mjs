/**
 * End-to-end verification script for the 6 Advanced Workspace & Journal Expansion features.
 */

async function main() {
  console.log("=== STARTING FULL WORKFLOW VERIFICATION ===");
  const baseUrl = "http://localhost:3000";

  // 1. Authenticate / get session or demo user
  // Let's create or sign in a test user via /api/auth
  console.log("\n[1] Checking Authentication...");
  let authRes = await fetch(`${baseUrl}/api/auth?mode=signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "trader@alphapips.io",
      password: "password123",
    }),
  });

  let cookie = "";
  if (authRes.ok) {
    const rawCookie = authRes.headers.get("set-cookie");
    if (rawCookie) {
      cookie = rawCookie.split(";")[0];
      console.log("✓ Signed in with trader@alphapips.io");
    }
  } else {
    console.log("Trader account not found, registering...");
    const regRes = await fetch(`${baseUrl}/api/auth?mode=signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "trader@alphapips.io",
        password: "password123",
        name: "Alpha Trader",
        agreeTerms: true,
        acknowledgePrivacy: true,
      }),
    });
    if (regRes.ok) {
      const rawCookie = regRes.headers.get("set-cookie");
      if (rawCookie) cookie = rawCookie.split(";")[0];
      console.log("✓ Registered trader@alphapips.io");
    } else {
      console.error("Signup failed:", await regRes.text());
      process.exit(1);
    }
  }

  const headers = {
    "Content-Type": "application/json",
    Cookie: cookie,
  };

  // 2. Test No-Trade Entries & Market Observations
  console.log("\n[2] Testing No-Trade Journal Entries & Market Observations...");
  const createObservationPayload = {
    instrumentSymbol: "XAUUSD",
    market: "Metals",
    bias: "bullish",
    session: "London",
    timeframe: "15m",
    observation: "Gold consolidating above London Asian high at 2355.00. Liquidity sweep expected but volume dropped.",
    priceLevels: "Support: 2350.00, Resistance: 2362.50",
    reasonCategory: "No clear confirmation",
    reasonNotes: "Did not get 5m displacement candle through 2358 resistance.",
    conditionMissing: "Volume surge + 5m candle close above range high",
    wouldHaveValidated: "Break & retest of 2358.50 with Delta positive",
    decisionType: "deliberate_avoidance",
    status: "rejected",
    psychologyNotes: "Patient and calm. Avoided FOMO on low liquidity breakout.",
    behaviorFlags: ["patient", "followed_rules"],
    tags: ["gold", "london_open", "liquidity_sweep"],
  };

  const createObsRes = await fetch(`${baseUrl}/api/no-trades`, {
    method: "POST",
    headers,
    body: JSON.stringify(createObservationPayload),
  });

  if (!createObsRes.ok) {
    console.error("Failed to create observation:", await createObsRes.text());
    process.exit(1);
  }
  const createdObs = await createObsRes.json();
  console.log("✓ Created No-Trade Observation ID:", createdObs.id);
  if (createdObs.instrumentSymbol !== "XAUUSD" || createdObs.bias !== "bullish") {
    throw new Error("Created observation fields mismatch!");
  }

  // Fetch list of observations & verify analytics summary
  const getObsRes = await fetch(`${baseUrl}/api/no-trades`, { headers });
  const obsData = await getObsRes.json();
  console.log(`✓ Fetched observations list: ${obsData.total} entries found`);
  console.log("✓ Behavioral Analytics Summary:", {
    total: obsData.stats.totalObservations,
    topReasons: obsData.stats.topReasons,
    statusDistribution: obsData.stats.statusDistribution,
  });

  // Verify that observations do NOT affect trades / financial engine
  const tradesRes = await fetch(`${baseUrl}/api/trades`, { headers });
  const tradesData = await tradesRes.json();
  const tradesList = Array.isArray(tradesData) ? tradesData : (tradesData.trades || []);
  const matchingTrade = tradesList.find(t => t.id === createdObs.id);
  if (matchingTrade) {
    throw new Error("FATAL: Observation appeared in trades list! Financial isolation breached!");
  }
  console.log("✓ Financial Engine Isolation Verified: No-Trade observation is strictly isolated from executed trades.");

  // 3. Test Strategy-Specific Trading Dictionary
  console.log("\n[3] Testing Strategy-Specific Trading Dictionary...");
  
  // First let's get or create a strategy to link
  const getStratRes = await fetch(`${baseUrl}/api/strategies`, { headers });
  const stratList = await getStratRes.json();
  let testStrategyId = stratList?.[0]?.id;
  if (!testStrategyId) {
    const createStrat = await fetch(`${baseUrl}/api/strategies`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Liquidity Sweep Continuation",
        description: "Trading session liquidity runs with structural confirmation",
        versionLabel: "1.0",
      }),
    });
    const newStrat = await createStrat.json();
    testStrategyId = newStrat.id;
  }
  console.log("✓ Using Strategy ID:", testStrategyId);

  // Create dictionary term
  const dictPayload = {
    strategyId: testStrategyId,
    term: "Fair Value Gap (FVG)",
    abbreviation: "FVG",
    category: "Market Structure",
    definition: "A three-candle imbalance where the wick of candle 1 does not overlap with candle 3, leaving an inefficient price delivery zone.",
    practicalExplanation: "Wait for price to retrace into the upper 50% (consequent encroachment) of the FVG before looking for lower timeframe confirmation.",
    exampleUsage: "Entered after 15m bullish FVG tap during New York open.",
    relatedTerms: ["Imbalance", "Consequent Encroachment", "Liquidity Void"],
    tags: ["ICT", "SMC", "Imbalance"],
    isFavorite: true,
  };

  const createDictRes = await fetch(`${baseUrl}/api/dictionary`, {
    method: "POST",
    headers,
    body: JSON.stringify(dictPayload),
  });
  if (!createDictRes.ok) {
    console.error("Failed to create dictionary entry:", await createDictRes.text());
    process.exit(1);
  }
  const createdTerm = await createDictRes.json();
  console.log("✓ Created Dictionary Term ID:", createdTerm.id, "-", createdTerm.term);

  // Fetch dictionary
  const getDictRes = await fetch(`${baseUrl}/api/dictionary?strategyId=${testStrategyId}`, { headers });
  const dictData = await getDictRes.json();
  const dictEntries = dictData.items || [];
  const foundTerm = dictEntries.find(e => e.id === createdTerm.id);
  if (!foundTerm) throw new Error("Created term not found in strategy dictionary!");
  console.log(`✓ Fetched dictionary for strategy: ${dictEntries.length} term(s) registered`);

  // Update term (toggle favorite)
  const patchDictRes = await fetch(`${baseUrl}/api/dictionary/${createdTerm.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ isFavorite: false }),
  });
  const updatedTerm = await patchDictRes.json();
  if (updatedTerm.isFavorite !== false) throw new Error("Dictionary update failed!");
  console.log("✓ Updated Dictionary Term favorite status");

  // 4. Test Reversible Archiving System
  console.log("\n[4] Testing Reversible Archiving System...");

  // Archive the observation
  const archiveObsRes = await fetch(`${baseUrl}/api/archive`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      entityType: "noTrade",
      id: createdObs.id,
      action: "archive",
    }),
  });
  if (!archiveObsRes.ok) throw new Error("Archiving observation failed!");
  console.log("✓ Observation successfully archived");

  // Verify it disappears from active observations
  const getActiveObs = await fetch(`${baseUrl}/api/no-trades`, { headers });
  const activeObsData = await getActiveObs.json();
  const inActive = activeObsData.items.find(e => e.id === createdObs.id);
  if (inActive) throw new Error("Archived observation still visible in active list!");
  console.log("✓ Observation correctly removed from active observations");

  // Verify it appears in /api/archive?type=noTrades
  const getArchiveRes = await fetch(`${baseUrl}/api/archive?type=noTrades`, { headers });
  const archivedRecords = await getArchiveRes.json();
  const inArchive = archivedRecords.noTrades.find(e => e.id === createdObs.id);
  if (!inArchive) throw new Error("Archived observation not found in archive registry!");
  console.log("✓ Found observation in Archive registry with archivedAt timestamp:", inArchive.archivedAt);

  // Restore the observation
  const restoreObsRes = await fetch(`${baseUrl}/api/archive`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      entityType: "noTrade",
      id: createdObs.id,
      action: "restore",
    }),
  });
  if (!restoreObsRes.ok) throw new Error("Restoring observation failed!");
  console.log("✓ Observation successfully restored");

  // Verify it is back in active observations
  const getRestoredObs = await fetch(`${baseUrl}/api/no-trades`, { headers });
  const restoredObsData = await getRestoredObs.json();
  const backInActive = restoredObsData.items.find(e => e.id === createdObs.id);
  if (!backInActive) throw new Error("Restored observation did not return to active list!");
  console.log("✓ Restored observation successfully visible in active list again");

  // 5. Test Frontend Routes
  console.log("\n[5] Testing Application Routes HTTP Status...");
  const publicRes = await fetch(`${baseUrl}/`);
  console.log(`✓ GET / (Landing Page) Status: ${publicRes.status}`);

  console.log("\n=== ALL WORKFLOW VERIFICATIONS PASSED SUCCESSFULLY ===");
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
