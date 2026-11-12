import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError } from "@/lib/api";
import { invalidateCache } from "@/lib/server-cache";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  try {
    // 1. Create a primary high-tier Prop Account
    // If the user has accounts, set others isDefault=false
    await db.tradingAccount.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });

    const account = await db.tradingAccount.create({
      data: {
        userId: user.id,
        name: "FTMO $100k Prop Challenge",
        broker: "FTMO",
        accountType: "prop",
        currency: "USD",
        startingBalanceCents: 10_000_000, // $100,000.00
        currentBalanceCents: 10_438_000, // $104,380.00 (+4.38% profit)
        consistencyRate: 88,
        dailyLossLimitPct: 5,
        maxDrawdownPct: 10,
        isDefault: true,
      },
    });

    // 2. Create 4 Distinct Trading Models (Strategies + v1.0 Versions)
    const strategyConfigs = [
      {
        name: "ICT Silver Bullet",
        market: "gold",
        purpose: "High probability session reversal and continuation model targeting opposing liquidity pools.",
        description: "15m liquidity sweep followed by 5m displacement and fair value gap entry during New York AM / London sessions.",
        instruments: "XAUUSD, EURUSD",
        timeframe: "5m - 15m",
        session: "ny_am",
        rules: [
          { title: "Higher timeframe liquidity taken", required: true, description: "Sweep of prior day high/low or Asian session high/low." },
          { title: "Market structure shift (MSS) with displacement", required: true, description: "Strong energetic break with fair value gap creation." },
          { title: "Entry at 5m Fair Value Gap", required: true, description: "Limit order placed inside the discount/premium FVG." },
          { title: "Stop placed beyond swing point", required: true, description: "Protected structural invalidation level." },
          { title: "Target opposing liquidity pool", required: false, description: "Unmitigated old high/low or equal highs/lows." },
        ],
      },
      {
        name: "London Judas Swing",
        market: "forex",
        purpose: "Capture the primary daily trend expansion during London session after trapping breakout traders.",
        description: "False breakout of Asian range boundaries between 02:00 - 04:00 NY time to trap retail breakout traders.",
        instruments: "EURUSD, GBPUSD",
        timeframe: "15m",
        session: "london",
        rules: [
          { title: "Clear Asian range consolidation", required: true, description: "Tight Asian range established between 00:00 - 06:00 UTC." },
          { title: "Judas swing extension", required: true, description: "Fake push 10-25 pips beyond Asian high or low." },
          { title: "Rapid rejection back inside range", required: true, description: "Failure to hold beyond the extreme; impulse back inside." },
          { title: "Minimum 2:1 RR target", required: false, description: "Target Asian range opposite boundary or daily target." },
        ],
      },
      {
        name: "Nasdaq Momentum Continuation",
        market: "indices",
        purpose: "Ride high-beta index momentum during peak NY morning volume.",
        description: "Trend continuation following 9:30 AM NY Open opening range breakout and retest of order block.",
        instruments: "NQ, ES",
        timeframe: "5m",
        session: "ny_am",
        rules: [
          { title: "Opening 15m range high/low formed", required: true, description: "Wait for initial 15-minute price discovery window." },
          { title: "Displacement break of opening range", required: true, description: "High volume breakout candle closing outside opening range." },
          { title: "Retest of opening range order block", required: true, description: "Clean mitigation of breaker or order block." },
          { title: "Target next key psychological level", required: false, description: "Major round number or prior day extreme." },
        ],
      },
      {
        name: "Crypto Mean Reversion",
        market: "crypto",
        purpose: "Exploit liquidity over-extensions and aggressive liquidation cascades.",
        description: "Extreme statistical deviation from 20-period VWAP/Bollinger bands on BTC with volume exhaustion.",
        instruments: "BTCUSD, SOLUSD",
        timeframe: "15m - 1h",
        session: "ny_pm",
        rules: [
          { title: "Price extended > 2.5 standard deviations", required: true, description: "Statistical extreme on 15m/1h bands." },
          { title: "Volume exhaustion wick", required: true, description: "Long rejection tail with declining follow-through volume." },
          { title: "RSI divergence confirmed", required: false, description: "Momentum divergence against price extreme." },
          { title: "Target VWAP / 20 EMA mean", required: true, description: "Exit completely at mean reversion equilibrium." },
        ],
      },
    ];

    const createdStrategies: Array<{ id: string; name: string; versionId: string }> = [];

    for (const sc of strategyConfigs) {
      const s = await db.strategy.create({
        data: {
          userId: user.id,
          name: sc.name,
          market: sc.market,
          purpose: sc.purpose,
          description: sc.description,
          instruments: sc.instruments,
          timeframe: sc.timeframe,
          session: sc.session,
          versions: {
            create: {
              versionLabel: "1.0",
              changeReason: "Initial baseline version",
              changeSummary: "Standard playbook rules for institutional execution.",
              rulesJson: JSON.stringify(sc.rules),
              effectiveDate: new Date(),
            },
          },
        },
        include: { versions: true },
      });

      createdStrategies.push({ id: s.id, name: s.name, versionId: s.versions[0].id });
    }

    // Map helpers
    const silverBullet = createdStrategies[0];
    const judasSwing = createdStrategies[1];
    const nqMomentum = createdStrategies[2];
    const cryptoMean = createdStrategies[3];

    // 3. Generate 17 Realistic Trades (10 Wins, 5 Losses, 2 Breakevens)
    // Spread across the past 14 days
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    interface DemoTradeDef {
      daysAgo: number;
      hour: number;
      symbol: string;
      market: string;
      direction: "long" | "short";
      session: string;
      strategy: typeof silverBullet;
      status: "win" | "loss" | "breakeven";
      setupGrade: string;
      setupScore: string;
      entryPrice: string;
      stopPrice: string;
      targetPrice: string;
      exitPrice: string;
      quantity: string;
      netPnlCents: number;
      actualR: string;
      plannedRR: string;
      riskCents: number;
      behaviorFlags: string[];
      notes: string;
      thesis: string;
    }

    const tradeBlueprints: DemoTradeDef[] = [
      // Day 14 (Winner)
      {
        daysAgo: 14,
        hour: 9,
        symbol: "XAUUSD",
        market: "gold",
        direction: "long",
        session: "london",
        strategy: silverBullet,
        status: "win",
        setupGrade: "A+",
        setupScore: "0.95",
        entryPrice: "2350.50",
        stopPrice: "2346.50",
        targetPrice: "2359.00",
        exitPrice: "2359.00",
        quantity: "1.0",
        netPnlCents: 85000, // +$850.00
        actualR: "2.13",
        plannedRR: "2.13",
        riskCents: 40000, // $400 risk
        behaviorFlags: [],
        notes: "Flawless Silver Bullet sweep of Asia low, energetic 5m displacement and clean FVG retest.",
        thesis: "Asian low swept during London Open. Clean displacement candle printed leaving 5m FVG.",
      },
      // Day 13 (Winner)
      {
        daysAgo: 13,
        hour: 14,
        symbol: "NQ",
        market: "indices",
        direction: "long",
        session: "ny_am",
        strategy: nqMomentum,
        status: "win",
        setupGrade: "A+",
        setupScore: "0.92",
        entryPrice: "19850.00",
        stopPrice: "19830.00",
        targetPrice: "19920.00",
        exitPrice: "19920.00",
        quantity: "1",
        netPnlCents: 140000, // +$1,400.00 (70 pts * $20)
        actualR: "3.50",
        plannedRR: "3.50",
        riskCents: 40000,
        behaviorFlags: [],
        notes: "Opening range breakout with massive volume. Retested top of opening range order block perfectly.",
        thesis: "Bullish 4H bias. 15m opening range broke high, retested breaker with decreasing volume.",
      },
      // Day 12 (Loss)
      {
        daysAgo: 12,
        hour: 10,
        symbol: "EURUSD",
        market: "forex",
        direction: "short",
        session: "london",
        strategy: judasSwing,
        status: "loss",
        setupGrade: "B",
        setupScore: "0.65",
        entryPrice: "1.08500",
        stopPrice: "1.08850",
        targetPrice: "1.07800",
        exitPrice: "1.08860",
        quantity: "1.0",
        netPnlCents: -36000, // -$360.00 (-36 pips)
        actualR: "-1.03",
        plannedRR: "2.00",
        riskCents: 35000,
        behaviorFlags: ["entered_early"],
        notes: "Jumped in before 15m candle close confirmed the Judas fakeout. Momentum continued higher.",
        thesis: "Expected sweep of Asian high, but UK CPI release pushed strong continuous trend.",
      },
      // Day 11 (Winner)
      {
        daysAgo: 11,
        hour: 15,
        symbol: "BTCUSD",
        market: "crypto",
        direction: "long",
        session: "ny_pm",
        strategy: cryptoMean,
        status: "win",
        setupGrade: "A",
        setupScore: "0.85",
        entryPrice: "64200.00",
        stopPrice: "63700.00",
        targetPrice: "65300.00",
        exitPrice: "65300.00",
        quantity: "1.0",
        netPnlCents: 110000, // +$1,100.00
        actualR: "2.20",
        plannedRR: "2.20",
        riskCents: 50000,
        behaviorFlags: [],
        notes: "Violent 4% wick down liquidated late longs. Bought the climax into 4H VWAP mean.",
        thesis: "2.8 standard deviations below 1H VWAP with massive buy volume absorption.",
      },
      // Day 10 (Winner)
      {
        daysAgo: 10,
        hour: 9,
        symbol: "GBPUSD",
        market: "forex",
        direction: "long",
        session: "london",
        strategy: judasSwing,
        status: "win",
        setupGrade: "A+",
        setupScore: "0.94",
        entryPrice: "1.27200",
        stopPrice: "1.26900",
        targetPrice: "1.27950",
        exitPrice: "1.27950",
        quantity: "1.0",
        netPnlCents: 75000, // +$750.00 (75 pips)
        actualR: "2.50",
        plannedRR: "2.50",
        riskCents: 30000,
        behaviorFlags: [],
        notes: "Classic Judas swing lower during London open, wicked into demand and exploded higher.",
        thesis: "Sweep of Asian low by 18 pips followed by immediate bullish displacement candle.",
      },
      // Day 9 (Loss)
      {
        daysAgo: 9,
        hour: 14,
        symbol: "NQ",
        market: "indices",
        direction: "long",
        session: "ny_am",
        strategy: nqMomentum,
        status: "loss",
        setupGrade: "C",
        setupScore: "0.48",
        entryPrice: "20100.00",
        stopPrice: "20075.00",
        targetPrice: "20175.00",
        exitPrice: "20074.00",
        quantity: "1",
        netPnlCents: -52000, // -$520.00 (26 pts * $20)
        actualR: "-1.04",
        plannedRR: "3.00",
        riskCents: 50000,
        behaviorFlags: ["chased_price", "fomo"],
        notes: "Chased price at the highs without waiting for pullback to order block. Instantly flushed.",
        thesis: "Felt FOMO after missing initial move, bought top of range without proper risk model.",
      },
      // Day 8 (Winner)
      {
        daysAgo: 8,
        hour: 13,
        symbol: "XAUUSD",
        market: "gold",
        direction: "short",
        session: "ny_am",
        strategy: silverBullet,
        status: "win",
        setupGrade: "A",
        setupScore: "0.88",
        entryPrice: "2380.00",
        stopPrice: "2384.00",
        targetPrice: "2370.50",
        exitPrice: "2370.50",
        quantity: "1.0",
        netPnlCents: 95000, // +$950.00
        actualR: "2.38",
        plannedRR: "2.38",
        riskCents: 40000,
        behaviorFlags: [],
        notes: "US PPI spike took out early London highs, sharp rejection, sold 5m FVG down to Asia low.",
        thesis: "High timeframe resistance mitigated, clean MSS printed on 5m right at 10:00 AM NY time.",
      },
      // Day 7 (Breakeven)
      {
        daysAgo: 7,
        hour: 9,
        symbol: "XAUUSD",
        market: "gold",
        direction: "long",
        session: "london",
        strategy: silverBullet,
        status: "breakeven",
        setupGrade: "A",
        setupScore: "0.82",
        entryPrice: "2365.00",
        stopPrice: "2361.00",
        targetPrice: "2375.00",
        exitPrice: "2365.00",
        quantity: "1.0",
        netPnlCents: 0,
        actualR: "0.00",
        plannedRR: "2.50",
        riskCents: 40000,
        behaviorFlags: [],
        notes: "Hit +1.4R, moved stop loss to breakeven according to management rules. Price came back and tapped entry.",
        thesis: "Tested discount level, partial momentum slowed down ahead of NY open.",
      },
      // Day 6 (Winner)
      {
        daysAgo: 6,
        hour: 14,
        symbol: "ES",
        market: "indices",
        direction: "long",
        session: "ny_am",
        strategy: nqMomentum,
        status: "win",
        setupGrade: "A",
        setupScore: "0.86",
        entryPrice: "5500.00",
        stopPrice: "5492.00",
        targetPrice: "5516.00",
        exitPrice: "5516.00",
        quantity: "2",
        netPnlCents: 160000, // +$1,600.00 (16 pts * $50 * 2 contracts)
        actualR: "2.00",
        plannedRR: "2.00",
        riskCents: 80000,
        behaviorFlags: [],
        notes: "S&P 500 order block test held like a rock. Clean 16-point surge right to daily target.",
        thesis: "NYSE tick reading +1000, strong breadth across all sectors.",
      },
      // Day 5 (Loss)
      {
        daysAgo: 5,
        hour: 10,
        symbol: "XAUUSD",
        market: "gold",
        direction: "long",
        session: "ny_am",
        strategy: silverBullet,
        status: "loss",
        setupGrade: "B",
        setupScore: "0.58",
        entryPrice: "2372.00",
        stopPrice: "2368.00",
        targetPrice: "2382.00",
        exitPrice: "2367.80",
        quantity: "1.0",
        netPnlCents: -42000, // -$420.00
        actualR: "-1.05",
        plannedRR: "2.50",
        riskCents: 40000,
        behaviorFlags: ["entered_early"],
        notes: "Anticipated market structure shift before candle closed. Trend continued lower and stopped me out.",
        thesis: "Believed support would hold, but institutional selling overwhelmed bids.",
      },
      // Day 4 (Winner)
      {
        daysAgo: 4,
        hour: 10,
        symbol: "EURUSD",
        market: "forex",
        direction: "short",
        session: "london",
        strategy: judasSwing,
        status: "win",
        setupGrade: "A+",
        setupScore: "0.96",
        entryPrice: "1.09100",
        stopPrice: "1.09350",
        targetPrice: "1.08450",
        exitPrice: "1.08450",
        quantity: "1.0",
        netPnlCents: 65000, // +$650.00 (65 pips)
        actualR: "2.60",
        plannedRR: "2.60",
        riskCents: 25000,
        behaviorFlags: [],
        notes: "Picture perfect Judas swing at European Central Bank rate decision, swift drop to target.",
        thesis: "Sweep of 4H equal highs right at 08:00 London time.",
      },
      // Day 3 (Winner)
      {
        daysAgo: 3,
        hour: 15,
        symbol: "BTCUSD",
        market: "crypto",
        direction: "short",
        session: "ny_pm",
        strategy: cryptoMean,
        status: "win",
        setupGrade: "A",
        setupScore: "0.84",
        entryPrice: "67800.00",
        stopPrice: "68400.00",
        targetPrice: "66500.00",
        exitPrice: "66500.00",
        quantity: "1.0",
        netPnlCents: 130000, // +$1,300.00
        actualR: "2.17",
        plannedRR: "2.17",
        riskCents: 60000,
        behaviorFlags: [],
        notes: "Funding rates reached +0.08%, extreme top deviation on 1H bands. Scalped clean mean reversion.",
        thesis: "Open interest spiked at resistance while CVD showed aggressive retail market buying absorption.",
      },
      // Day 3 (Breakeven)
      {
        daysAgo: 3,
        hour: 16,
        symbol: "NQ",
        market: "indices",
        direction: "short",
        session: "ny_pm",
        strategy: nqMomentum,
        status: "breakeven",
        setupGrade: "A",
        setupScore: "0.80",
        entryPrice: "20250.00",
        stopPrice: "20275.00",
        targetPrice: "20180.00",
        exitPrice: "20250.00",
        quantity: "1",
        netPnlCents: 0,
        actualR: "0.00",
        plannedRR: "2.80",
        riskCents: 50000,
        behaviorFlags: [],
        notes: "Moved stop to entry after 1.5R favorable excursion. Market rallied back into close.",
        thesis: "Afternoon continuation model, market ran out of steam before 4 PM close.",
      },
      // Day 2 (Loss)
      {
        daysAgo: 2,
        hour: 8,
        symbol: "GBPUSD",
        market: "forex",
        direction: "short",
        session: "london",
        strategy: judasSwing,
        status: "loss",
        setupGrade: "B",
        setupScore: "0.62",
        entryPrice: "1.28100",
        stopPrice: "1.28400",
        targetPrice: "1.27400",
        exitPrice: "1.28410",
        quantity: "1.0",
        netPnlCents: -31000, // -$310.00
        actualR: "-1.03",
        plannedRR: "2.33",
        riskCents: 30000,
        behaviorFlags: ["moved_stop"],
        notes: "Hesitated and adjusted stop by 5 pips. Respecting original stop is mandatory.",
        thesis: "False move up did not reject cleanly, continued trending into European morning.",
      },
      // Day 2 (Winner)
      {
        daysAgo: 2,
        hour: 14,
        symbol: "XAUUSD",
        market: "gold",
        direction: "long",
        session: "ny_am",
        strategy: silverBullet,
        status: "win",
        setupGrade: "A+",
        setupScore: "0.98",
        entryPrice: "2390.00",
        stopPrice: "2385.00",
        targetPrice: "2405.00",
        exitPrice: "2405.00",
        quantity: "1.0",
        netPnlCents: 150000, // +$1,500.00
        actualR: "3.00",
        plannedRR: "3.00",
        riskCents: 50000,
        behaviorFlags: [],
        notes: "Trade of the week. Swept 2388 liquidity pool, expanded +$15 straight into 2405 target.",
        thesis: "DXY broke down below key 104.00 support, Gold initiated massive institutional expansion.",
      },
      // Day 1 (Winner)
      {
        daysAgo: 1,
        hour: 15,
        symbol: "NQ",
        market: "indices",
        direction: "short",
        session: "ny_am",
        strategy: nqMomentum,
        status: "win",
        setupGrade: "A+",
        setupScore: "0.91",
        entryPrice: "20320.00",
        stopPrice: "20345.00",
        targetPrice: "20240.00",
        exitPrice: "20240.00",
        quantity: "1",
        netPnlCents: 160000, // +$1,600.00 (80 pts * $20)
        actualR: "3.20",
        plannedRR: "3.20",
        riskCents: 50000,
        behaviorFlags: [],
        notes: "Heavy tech earnings gap down and retest. Textbook short breakdown.",
        thesis: "Daily trend turned bearish, 15m order block rejected on first touch.",
      },
      // Day 1 (Loss)
      {
        daysAgo: 1,
        hour: 19,
        symbol: "BTCUSD",
        market: "crypto",
        direction: "long",
        session: "ny_pm",
        strategy: cryptoMean,
        status: "loss",
        setupGrade: "Invalid",
        setupScore: "0.35",
        entryPrice: "65100.00",
        stopPrice: "64700.00",
        targetPrice: "66000.00",
        exitPrice: "64680.00",
        quantity: "1.0",
        netPnlCents: -42000, // -$420.00
        actualR: "-1.05",
        plannedRR: "2.25",
        riskCents: 40000,
        behaviorFlags: ["broke_rules", "revenge_trading"],
        notes: "Took trade out of boredom and frustration late in the day. Broke rules, immediate stop-out.",
        thesis: "No valid edge. Attempted to force trade without technical setup confirmation.",
      },
      // Today (Winner)
      {
        daysAgo: 0,
        hour: 10,
        symbol: "EURUSD",
        market: "forex",
        direction: "long",
        session: "london",
        strategy: judasSwing,
        status: "win",
        setupGrade: "A+",
        setupScore: "0.93",
        entryPrice: "1.08200",
        stopPrice: "1.07950",
        targetPrice: "1.08800",
        exitPrice: "1.08800",
        quantity: "1.0",
        netPnlCents: 60000, // +$600.00 (60 pips)
        actualR: "2.40",
        plannedRR: "2.40",
        riskCents: 25000,
        behaviorFlags: [],
        notes: "Fresh London session sweep of Tokyo low. Disciplined entry, full take profit hit.",
        thesis: "German GDP data beat estimates, immediate bullish structure shift on 5m chart.",
      },
    ];

    let createdTradeCount = 0;
    let winsCount = 0;
    let lossesCount = 0;
    let besCount = 0;

    const tradesToInsert: any[] = [];
    const executionsToInsert: any[] = [];

    for (const b of tradeBlueprints) {
      const tradeId = "t_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      const entryDate = new Date(now - b.daysAgo * dayMs);
      entryDate.setUTCHours(b.hour, Math.floor(Math.random() * 45), 0, 0);

      // Exit 45 mins to 2 hours later
      const exitDate = new Date(entryDate.getTime() + (45 + Math.floor(Math.random() * 75)) * 60 * 1000);

      const isWin = b.status === "win";
      const isLoss = b.status === "loss";
      if (isWin) winsCount++;
      else if (isLoss) lossesCount++;
      else besCount++;

      tradesToInsert.push({
        id: tradeId,
        userId: user.id,
        accountId: account.id,
        instrumentSymbol: b.symbol,
        market: b.market,
        direction: b.direction,
        status: b.status,
        session: b.session,
        strategyId: b.strategy.id,
        strategyVersionId: b.strategy.versionId,
        setupGrade: b.setupGrade,
        setupScore: b.setupScore,
        tagsJson: JSON.stringify(["demo", b.strategy.name.toLowerCase().replace(/\s+/g, "-")]),
        plannedEntryPrice: b.entryPrice,
        plannedStopPrice: b.stopPrice,
        plannedTargetPrice: b.targetPrice,
        plannedRiskAmountCents: b.riskCents,
        plannedRiskPct: "0.005",
        plannedRR: b.plannedRR,
        entryPriceAvg: b.entryPrice,
        exitPriceAvg: b.exitPrice,
        positionSize: b.quantity,
        feesCents: 150,
        commissionCents: 350,
        swapCents: 0,
        slippageCents: 0,
        grossPnlCents: b.netPnlCents + 500,
        netPnlCents: b.netPnlCents,
        actualR: b.actualR,
        entryTime: entryDate,
        exitTime: exitDate,
        tradingTimezone: "UTC",
        notes: b.notes,
        thesisJson: JSON.stringify({
          why: b.thesis,
          narrative: `${b.strategy.name} setup execution on ${b.symbol} during ${b.session.toUpperCase()} session.`,
        }),
        lessons: isLoss
          ? "Patience is non-negotiable. Only enter when all checklist rules are green."
          : "Executions align with statistical edge when discipline is maintained.",
        behaviorFlagsJson: JSON.stringify(b.behaviorFlags),
        psychBeforeJson: JSON.stringify({
          confidence: isWin ? 5 : 3,
          energy: 4,
          moodTags: isWin ? ["focused", "calm"] : ["hesitant", "fatigued"],
        }),
        psychAfterJson: JSON.stringify({
          confidence: isWin ? 5 : 2,
          energy: isWin ? 4 : 2,
          moodTags: isWin ? ["satisfied", "disciplined"] : ["frustrated", "regret"],
        }),
      });

      executionsToInsert.push(
        {
          id: "ex_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
          tradeId: tradeId,
          kind: "entry",
          seq: 0,
          price: b.entryPrice,
          quantity: b.quantity,
          timestamp: entryDate,
          notes: "Initial market order fill",
        },
        {
          id: "ex_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
          tradeId: tradeId,
          kind: "exit",
          seq: 1,
          price: b.exitPrice,
          quantity: b.quantity,
          timestamp: exitDate,
          notes: isWin ? "Take profit target reached" : isLoss ? "Stop loss hit" : "Breakeven exit",
        },
      );
    }

    await db.trade.createMany({ data: tradesToInsert });
    await db.tradeExecution.createMany({ data: executionsToInsert });

    createdTradeCount = tradesToInsert.length;

    // Invalidate all caches for this user
    invalidateCache(`dashboard:${user.id}`);
    invalidateCache(`analytics:${user.id}`);
    invalidateCache(`trades:${user.id}`);
    invalidateCache(`accounts:${user.id}`);
    invalidateCache(`strategies:${user.id}`);
    invalidateCache(`calendar:${user.id}`);
    invalidateCache(`me:${user.id}`);

    await audit("demo_data.generated", "user", user.id, {
      tradesCount: createdTradeCount,
      account: account.name,
      strategiesCount: createdStrategies.length,
    });

    return ok({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        balance: account.currentBalanceCents,
      },
      summary: {
        accounts: 1,
        strategies: createdStrategies.length,
        trades: createdTradeCount,
      },
      strategiesCount: createdStrategies.length,
      tradesCount: createdTradeCount,
      wins: winsCount,
      losses: lossesCount,
      breakevens: besCount,
    });
  } catch (err: any) {
    console.error("Failed to generate demo data:", err);
    return bad(`Failed to generate demo data: ${err?.message ?? "Internal error"}`);
  }
}

