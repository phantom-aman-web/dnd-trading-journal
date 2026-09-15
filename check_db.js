const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.trade.findMany({ select: { id: true, instrumentSymbol: true, grossPnlCents: true, netPnlCents: true, status: true } });
  console.log(t.slice(-2));
}

main().finally(() => prisma.$disconnect());
