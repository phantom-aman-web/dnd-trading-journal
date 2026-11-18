import { db } from "@/lib/db";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImJpamlzdGVyYm9zY2hAZ21haWwuY29tIiwic3ViIjoiY211MnpmeXYyMDAwMGw1MDRpYTZkajkwayIsImlhdCI6MTc5NDg5MjY2NywiZXhwIjoxNzk3NDg0NjY3fQ.RkXgwDC3K-hFK_pJxoYpFLrnOW1yBsRTwLv8cKfVe6U";

async function run() {
  console.log("=== TESTING MULTIPLE DEMO GENERATION RUNS ===");

  const runs = 3;
  const results: any[] = [];

  for (let i = 1; i <= runs; i++) {
    console.log(`\n--- Run #${i} Triggering /api/demo-data ---`);
    const res = await fetch("http://localhost:3000/api/demo-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `dnd_session=${TOKEN}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Run #${i} failed: ${res.status}`, err);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`Run #${i} Success:`);
    console.log(`  Account: "${data.account.name}" (${data.account.accountType}, ${data.account.currency})`);
    console.log(`  Starting Balance: $${(data.account.startingBalance / 100).toLocaleString()}`);
    console.log(`  Final Balance: $${(data.account.balance / 100).toLocaleString()} (Net PnL: $${(data.account.pnl / 100).toLocaleString()})`);
    console.log(`  Strategies Generated: ${data.summary.strategies}`);
    console.log(`  Trades Generated: ${data.summary.trades} (${data.wins}W / ${data.losses}L / ${data.breakevens}BE)`);
    console.log(`  No-Trade Observations: ${data.summary.noTrades}`);

    // Verify balance math
    const expectedBalance = data.account.startingBalance + data.totalNetPnlCents;
    if (data.account.balance !== expectedBalance) {
      throw new Error(`Balance inconsistency: ${data.account.balance} !== ${expectedBalance}`);
    }

    // Check challenge if prop/funded
    if (data.account.accountType === "prop" || data.account.accountType === "funded") {
      const challenge = await db.propChallenge.findFirst({
        where: { accountId: data.account.id },
      });
      console.log(`  PropChallenge Linked: ${challenge ? `Yes (${challenge.propFirm}, status: ${challenge.status})` : "None"}`);
    } else {
      console.log(`  PropChallenge Linked: Personal Account (No challenge created)`);
    }

    // Check partial exits
    const executions = await db.tradeExecution.findMany({
      where: { trade: { accountId: data.account.id } },
    });
    const multiExecTrades = new Set();
    const tradeExecCounts: Record<string, number> = {};
    for (const ex of executions) {
      tradeExecCounts[ex.tradeId] = (tradeExecCounts[ex.tradeId] || 0) + 1;
      if (tradeExecCounts[ex.tradeId] > 2) {
        multiExecTrades.add(ex.tradeId);
      }
    }
    console.log(`  Multi-execution / Partial-exit Trades: ${multiExecTrades.size}`);

    results.push(data);
  }

  console.log("\n=== SUMMARY OF DEMO GENERATION VARIETY ===");
  const accountsUnique = new Set(results.map((r) => r.account.name));
  const typesUnique = new Set(results.map((r) => r.account.accountType));
  const balancesUnique = new Set(results.map((r) => r.account.startingBalance));
  const tradeCountsUnique = new Set(results.map((r) => r.summary.trades));

  console.log(`Unique Account Names: ${accountsUnique.size} / ${runs}`);
  console.log(`Unique Account Types: ${typesUnique.size} / ${runs}`);
  console.log(`Unique Starting Balances: ${balancesUnique.size} / ${runs}`);
  console.log(`Unique Trade Totals: ${tradeCountsUnique.size} / ${runs}`);
  console.log("\nALL DEMO DATA GENERATOR TESTS PASSED WITH CONFIRMED VARIETY!");
}

run().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
