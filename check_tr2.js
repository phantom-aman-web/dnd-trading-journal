const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const trades = await prisma.trade.findMany({ include: { executions: true } });
  for (const t of trades) {
    console.log(t.userId, t.instrumentSymbol, t.netPnlCents, t.exitTime);
  }
}

main().finally(() => prisma.$disconnect());
