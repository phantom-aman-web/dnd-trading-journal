const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const defaultAccounts = await prisma.tradingAccount.findMany({ where: { isDefault: true } });
  console.log("Default accounts:", defaultAccounts.map(a => a.name));
}

main().finally(() => prisma.$disconnect());
