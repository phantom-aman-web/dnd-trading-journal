const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.tradingAccount.findMany();
  console.log(accounts.map(a => a.name));
  const trades = await prisma.trade.count();
  console.log('Trades total:', trades);
}

main().finally(() => prisma.$disconnect());
