const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "trader@dnd.local" } });
  const trades = await prisma.trade.findMany({ where: { userId: user.id } });
  console.log('Trades for user:', user.id);
  let cumulative = 1000000;
  for (const t of trades) {
    cumulative += t.netPnlCents;
    console.log(`- ${t.instrumentSymbol} ${t.entryTime}: PNL=${t.netPnlCents} -> Cumul=${cumulative}`);
  }
}

main().finally(() => prisma.$disconnect());
