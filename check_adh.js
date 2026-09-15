const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.trade.findUnique({ where: { id: 'cmu2h1hmv000cwhdgjfeml4lf' }, select: { planAdherenceJson: true } });
  console.log(t);
}

main().finally(() => prisma.$disconnect());
