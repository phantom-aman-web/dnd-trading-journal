import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'test@example.com';
  let user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    user = await prisma.user.findFirst();
  }
  
  if (!user) {
    console.error("No user found in the database. Please run the app and create a user first.");
    return;
  }
  console.log(`Using user: ${user.email} (${user.id})`);

  let account = await prisma.tradingAccount.findFirst({ where: { userId: user.id } });
  if (!account) {
    account = await prisma.tradingAccount.create({
      data: {
        userId: user.id,
        name: "Test Account",
        accountType: "live",
      }
    });
  }

  let strategy = await prisma.strategy.findFirst({ where: { userId: user.id } });
  if (!strategy) {
    strategy = await prisma.strategy.create({
      data: {
        userId: user.id,
        name: "Test Strategy",
      }
    });
  }

  const symbols = ["EURUSD", "GBPUSD", "XAUUSD", "NQ100"];
  const directions = ["long", "short"];
  const statuses = ["win", "loss", "win", "loss", "win", "breakeven", "partial_win"];
  const sessions = ["london", "ny_am", "ny_pm", "asia"];
  const newsEvents = ["none", "none", "cpi", "nfp"];
  
  const trades: any[] = [];

  for (let i = 0; i < 14; i++) {
    const status = statuses[i % statuses.length];
    const isWin = status === "win" || status === "partial_win";
    const isLoss = status === "loss";
    const r = isWin ? (Math.random() * 2 + 1).toFixed(2) : isLoss ? "-1.00" : "0.00";
    
    // Pnl in cents
    const baseRiskCents = 20000; // $200 risk
    const netPnlCents = status === 'win' ? baseRiskCents * parseFloat(r) 
                      : status === 'loss' ? -baseRiskCents 
                      : status === 'partial_win' ? (baseRiskCents * parseFloat(r)) / 2
                      : 0;

    const entryTime = new Date();
    entryTime.setDate(entryTime.getDate() - (14 - i)); // spread over last 14 days

    trades.push({
      userId: user.id,
      accountId: account.id,
      instrumentSymbol: symbols[i % symbols.length],
      direction: directions[i % directions.length],
      status: status,
      session: sessions[i % sessions.length],
      newsEvent: newsEvents[i % newsEvents.length],
      strategyId: strategy.id,
      setupGrade: ["A+", "A", "B", "C"][i % 4],
      plannedRR: (Math.random() * 2 + 2).toFixed(2),
      actualR: r,
      grossPnlCents: Math.round(netPnlCents + 100), // add some fees
      netPnlCents: Math.round(netPnlCents),
      entryTime: entryTime,
      exitTime: new Date(entryTime.getTime() + 1000 * 60 * 60 * 2), // 2 hours later
    });
  }

  console.log(`Creating 14 trades...`);
  const created = await prisma.trade.createMany({
    data: trades,
  });

  console.log(`Successfully created ${created.count} trades! Navigate to your app's Analytics page to view them.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
