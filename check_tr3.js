const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.trade.findFirst({ where: { setupJson: { not: null } } });
  console.log('setupJson:', t?.setupJson);
  console.log('psychBefore:', t?.psychBeforeJson);
}

main().finally(() => prisma.$disconnect());
