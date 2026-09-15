import { db } from "./src/lib/db";

async function main() {
  // Find ALL trades (not filtered by user) — look at the raw data
  const trades = await db.trade.findMany({
    include: {
      executions: true,
      account: true,
      instrument: true,
      checklistEvaluations: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`=== Found ${trades.length} trades ===\n`);
  for (const t of trades) {
    console.log("--- TRADE ---");
    console.log(`  id:                 ${t.id}`);
    console.log(`  userId:             ${t.userId}`);
    console.log(`  accountId:          ${t.accountId}`);
    console.log(`  account.name:       ${t.account?.name}`);
    console.log(`  account.currency:   ${t.account?.currency}`);
    console.log(`  instrumentSymbol:   ${t.instrumentSymbol}`);
    console.log(`  instrumentId:       ${t.instrumentId ?? "(null)"}`);
    console.log(`  direction:          ${t.direction}`);
    console.log(`  status:             ${t.status}        ← KEY FIELD`);
    console.log(`  isDraft:            ${t.isDraft}`);
    console.log(`  isArchived:         ${t.isArchived}`);
    console.log(`  entryPriceAvg:      ${t.entryPriceAvg}`);
    console.log(`  exitPriceAvg:       ${t.exitPriceAvg}`);
    console.log(`  positionSize:       ${t.positionSize}`);
    console.log(`  plannedEntryPrice:  ${t.plannedEntryPrice}`);
    console.log(`  plannedStopPrice:   ${t.plannedStopPrice}`);
    console.log(`  plannedTargetPrice: ${t.plannedTargetPrice}`);
    console.log(`  plannedRiskAmountCents: ${t.plannedRiskAmountCents}`);
    console.log(`  plannedRR:          ${t.plannedRR}`);
    console.log(`  grossPnlCents:      ${t.grossPnlCents}  (${(t.grossPnlCents/100).toFixed(2)} USD)`);
    console.log(`  netPnlCents:        ${t.netPnlCents}    (${(t.netPnlCents/100).toFixed(2)} USD)`);
    console.log(`  actualR:            ${t.actualR}`);
    console.log(`  feesCents:          ${t.feesCents}`);
    console.log(`  commissionCents:    ${t.commissionCents}`);
    console.log(`  swapCents:          ${t.swapCents}`);
    console.log(`  slippageCents:      ${t.slippageCents}`);
    console.log(`  entryTime:          ${t.entryTime}`);
    console.log(`  exitTime:           ${t.exitTime}`);
    console.log(`  setupGrade:         ${t.setupGrade}`);
    console.log(`  setupScore:         ${t.setupScore}`);
    console.log(`  strategyVersionId:  ${t.strategyVersionId ?? "(null)"}`);
    console.log(`  createdAt:          ${t.createdAt}`);
    console.log(`  updatedAt:          ${t.updatedAt}`);
    console.log(`  executions (${t.executions.length}):`);
    for (const e of t.executions) {
      console.log(`    - kind=${e.kind} price=${e.price} qty=${e.quantity} ts=${e.timestamp}`);
    }
    console.log(`  checklistEvaluations: ${t.checklistEvaluations.length}`);
    console.log("");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
