import { db } from "../src/lib/db";
import { evaluatePropLifecycle, parsePropLifecycleMetadata } from "../src/lib/prop-lifecycle-engine";

async function main() {
  const challenges = await db.propChallenge.findMany({
    include: {
      account: {
        include: {
          trades: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${challenges.length} Prop Challenge records.`);

  for (const c of challenges) {
    console.log("--------------------------------------------------");
    console.log(`Challenge ID: ${c.id}`);
    console.log(`Firm: ${c.propFirm} | Name: ${c.name}`);
    console.log(`Account: ${c.account?.name} (${c.account?.id}) | Type: ${c.account?.accountType}`);
    console.log(`Starting Balance: $${(c.account?.startingBalanceCents / 100).toFixed(2)}`);
    console.log(`Current Balance: $${(c.account?.currentBalanceCents / 100).toFixed(2)}`);
    console.log(`Trade Count: ${c.account?.trades.length}`);

    const realizedTrades = c.account.trades.filter((t: any) => t.status !== "open" && t.exitTime !== null);
    const openTrades = c.account.trades.filter((t: any) => t.status === "open" || t.exitTime === null);
    const realizedPnL = realizedTrades.reduce((acc: number, t: any) => acc + (t.netPnlCents || 0), 0);
    const openPnL = openTrades.reduce((acc: number, t: any) => acc + (t.netPnlCents || 0), 0);

    console.log(`Realized Trades: ${realizedTrades.length} | Realized PnL: $${(realizedPnL / 100).toFixed(2)}`);
    console.log(`Open Trades: ${openTrades.length} | Floating PnL: $${(openPnL / 100).toFixed(2)}`);

    // Parse lifecycle metadata with graceful fallback
    const lifecycleMeta = parsePropLifecycleMetadata(c.notes, {
      startingBalanceCents: c.account.startingBalanceCents,
      profitTargetCents: c.profitTargetCents,
      dailyLossLimitCents: c.dailyLossLimitCents,
      maxDrawdownCents: c.maxDrawdownCents,
      maxTradingDays: c.maxTradingDays,
      startDate: c.startDate.toISOString(),
      accountModel: "two_step",
    });

    // Run lifecycle evaluation
    const evaluation = evaluatePropLifecycle(
      {
        id: c.id,
        propFirm: c.propFirm || "Prop Firm",
        resetTimezone: c.resetTimezone || "America/New_York",
        resetHour: c.resetHour ?? 17,
        startDate: c.startDate,
        endDate: c.endDate,
      },
      lifecycleMeta,
      c.account.trades
    );

    console.log(`Lifecycle Status: ${evaluation.status}`);
    console.log(`Active Phase: ${evaluation.activePhase.name} (sequence ${evaluation.activePhase.sequence})`);
    console.log(`Evaluation Balance: $${(evaluation.currentBalanceCents / 100).toFixed(2)}`);
    console.log(`Evaluation Equity: $${(evaluation.currentEquityCents / 100).toFixed(2)}`);
    console.log(`High-Water Mark: $${(evaluation.highWaterMarkCents / 100).toFixed(2)}`);
    console.log(`Today Loss Measured: $${(evaluation.todayLossCents / 100).toFixed(2)}`);
    console.log(`Current Drawdown Measured: $${(evaluation.currentDrawdownCents / 100).toFixed(2)}`);
    console.log(`Profit Target Progress: ${evaluation.profitTargetProgressPct !== null ? evaluation.profitTargetProgressPct.toFixed(1) + '%' : 'N/A'}`);
    console.log(`Rules evaluated: ${evaluation.rules.length}`);
    console.log(`Violations: ${evaluation.violations.length}`);
    console.log(`Warnings: ${evaluation.warnings.length}`);
    console.log(`Challenge StartDate: ${c.startDate.toISOString()}`);
    console.log(`ActivePhase StartDate: ${evaluation.activePhase.startDate}`);
    if (c.account.trades.length > 0) {
      const t0 = c.account.trades[0];
      const timeVal = t0.entryTime || t0.exitTime;
      if (timeVal) {
        console.log(`First Trade Time: ${new Date(timeVal).toISOString()}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
