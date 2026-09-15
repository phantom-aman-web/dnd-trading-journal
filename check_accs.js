const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accs = await prisma.tradingAccount.findMany();
  console.log('Accounts:');
  for (const a of accs) {
    console.log(`- ${a.name} (${a.userId}): ${a.startingBalanceCents}`);
  }
}

main().finally(() => prisma.$disconnect());
