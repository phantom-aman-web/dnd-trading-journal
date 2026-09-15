const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const INSTRUMENTS = ["EURUSD", "GBPUSD", "XAUUSD", "US30", "NAS100", "BTCUSD", "ETHUSD"];
const SESSIONS = ["asia", "london", "ny_am", "ny_pm", "custom"];
const TAGS = [["#fomo"], ["#patient"], ["#tilt", "#revenge"], ["#A+"], ["#bored"], ["#textbook", "#A+"]];
const FLAGS = [["chased_entry"], ["moved_stop"], ["exited_early"], [], [], [], ["forced_trade"]];
const BEHAVIOR_TAGS = [{ "Focus": "High", "Sleep": "Good" }, { "Focus": "Low", "Sleep": "Poor" }, { "Stress": "High" }];
const DIRECTIONS = ["long", "short"];
const OUTCOMES = [
  { status: "win", rr: 2.5, prob: 0.4 },
  { status: "loss", rr: -1.0, prob: 0.35 },
  { status: "breakeven", rr: 0, prob: 0.1 },
  { status: "partial_win", rr: 1.2, prob: 0.1 },
  { status: "partial_loss", rr: -0.5, prob: 0.05 },
];

function getRandomOutcome() {
  const r = Math.random();
  let acc = 0;
  for (const o of OUTCOMES) {
    acc += o.prob;
    if (r <= acc) return o;
  }
  return OUTCOMES[0];
}

async function main() {
  const email = "trader@dnd.local";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found");

  // Create accounts
  const accounts = await Promise.all([
    prisma.tradingAccount.create({ data: { userId: user.id, name: "Main Margin", currentBalanceCents: 10000000, startingBalanceCents: 10000000, currency: "USD" } }),
    prisma.tradingAccount.create({ data: { userId: user.id, name: "Prop Firm A", currentBalanceCents: 5000000, startingBalanceCents: 5000000, currency: "USD" } }),
    prisma.tradingAccount.create({ data: { userId: user.id, name: "Crypto Spot", currentBalanceCents: 2000000, startingBalanceCents: 2000000, currency: "USD" } }),
  ]);

  // Create Strategies
  const strategies = await Promise.all([
    prisma.strategy.create({
      data: {
        userId: user.id, name: "Breakout", description: "Break of structure", status: "active",
        versions: { create: [{ versionLabel: "v1", rulesJson: "[]", effectiveDate: new Date() }] }
      },
      include: { versions: true }
    }),
    prisma.strategy.create({
      data: {
        userId: user.id, name: "Mean Reversion", description: "Fade the extremes", status: "active",
        versions: { create: [{ versionLabel: "v1", rulesJson: "[]", effectiveDate: new Date() }] }
      },
      include: { versions: true }
    }),
    prisma.strategy.create({
      data: {
        userId: user.id, name: "Trend Continuation", description: "Pullback to EMA", status: "active",
        versions: { create: [{ versionLabel: "v1", rulesJson: "[]", effectiveDate: new Date() }] }
      },
      include: { versions: true }
    }),
  ]);

  // Generate 60 trades over the last 30 days
  const now = new Date();
  const tradesData = [];
  
  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    date.setHours(8 + Math.floor(Math.random() * 8));

    const exitDate = new Date(date.getTime() + (Math.random() * 120 + 15) * 60 * 1000);
    
    const account = accounts[Math.floor(Math.random() * accounts.length)];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    const instrument = INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)];
    const session = SESSIONS[Math.floor(Math.random() * SESSIONS.length)];
    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    
    const outcome = getRandomOutcome();
    
    // Risk amount: 1% of starting balance
    const riskCents = Math.floor(account.startingBalanceCents * 0.01);
    const grossPnlCents = Math.floor(riskCents * outcome.rr);
    const netPnlCents = grossPnlCents - Math.floor(Math.random() * 500); // minus random fees
    
    // Adherence
    let planAdherence = null;
    let setupGrade = null;
    if (Math.random() > 0.3) {
       planAdherence = { adherencePct: Math.random() > 0.8 ? 100 : (Math.random() > 0.5 ? 80 : 40) };
       setupGrade = planAdherence.adherencePct === 100 ? "A+" : "B";
    }

    tradesData.push({
      userId: user.id,
      accountId: account.id,
      instrumentSymbol: instrument,
      direction,
      status: outcome.status,
      session,
      strategyId: strategy.id,
      strategyVersionId: strategy.versions[0].id,
      setupGrade,
      tagsJson: JSON.stringify(TAGS[Math.floor(Math.random() * TAGS.length)]),
      behaviorFlagsJson: JSON.stringify(FLAGS[Math.floor(Math.random() * FLAGS.length)]),
      psychBeforeJson: JSON.stringify(BEHAVIOR_TAGS[Math.floor(Math.random() * BEHAVIOR_TAGS.length)]),
      plannedRiskAmountCents: riskCents,
      plannedRR: "3.0",
      grossPnlCents,
      netPnlCents,
      actualR: String(outcome.rr),
      entryTime: date,
      exitTime: exitDate,
      planAdherenceJson: planAdherence ? JSON.stringify(planAdherence) : null,
      isDraft: false,
    });
  }

  const result = await prisma.trade.createMany({ data: tradesData });
  console.log("Successfully seeded " + result.count + " trades over the last 30 days.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
