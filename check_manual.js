const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const trades = await prisma.trade.findMany();
  console.log("Total trades:", trades.length);
  for (const t of trades) {
    console.log(`- ${t.instrumentSymbol} ${t.direction} ${t.status}`);
  }
}

main().finally(() => prisma.$disconnect());
