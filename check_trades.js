const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst();
  const trades = await prisma.trade.findMany({ where: { userId: u.id, isArchived: false } });
  
  console.log('User:', u.email, 'Total valid trades:', trades.length);
  const withoutExitTime = trades.filter(t => !t.exitTime).length;
  console.log('Trades without exit time:', withoutExitTime);
}

main().finally(() => prisma.$disconnect());
