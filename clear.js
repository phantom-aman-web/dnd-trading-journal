const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.trade.deleteMany({}).then(() => console.log('Cleared DB')).finally(() => prisma.$disconnect());
