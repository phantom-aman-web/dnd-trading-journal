const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { buildEquityCurve } = require('./src/lib/financial-engine.ts'); // Wait, bun can run TS directly but require might fail if not transpiled.
// I'll just write the query manually here.

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "trader@dnd.local" } });
  const accounts = await prisma.tradingAccount.findMany({ where: { userId: user.id } });
  const startingBalance = accounts.reduce((s, a) => s + a.startingBalanceCents, 0);
  console.log("Total Starting Balance:", startingBalance);
  
  const trades = await prisma.trade.findMany({ where: { userId: user.id, isArchived: false } });
  
  const sorted = trades
    .filter((t) => (t.status === "win" || t.status === "loss" || t.status === "breakeven") || (t.exitTime || t.entryTime))
    .sort((a, b) => {
      const ad = a.exitTime ? new Date(a.exitTime).getTime() : (a.entryTime ? new Date(a.entryTime).getTime() : 0);
      const bd = b.exitTime ? new Date(b.exitTime).getTime() : (b.entryTime ? new Date(b.entryTime).getTime() : 0);
      return ad - bd;
    });

  let cumulative = startingBalance;
  for (const t of sorted) {
    cumulative += t.netPnlCents;
    const d = new Date(t.exitTime || t.entryTime);
    console.log(`- Trade ${t.id} on ${d.toISOString()}: P&L ${t.netPnlCents}, Cumul: ${cumulative}`);
  }
}

main().finally(() => prisma.$disconnect());
