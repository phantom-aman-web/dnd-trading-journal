import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError } from "@/lib/api";
import { invalidateCache } from "@/lib/server-cache";
import { audit } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Account Archetypes
// ---------------------------------------------------------------------------

interface AccountArchetype {
  nameTemplate: string;
  broker: string;
  accountType: "prop" | "funded" | "personal" | "demo";
  currency: string;
  startingBalanceCents: number;
  // Prop challenge specific (if prop or funded)
  hasChallenge: boolean;
  propFirm?: string;
  stage?: "phase1" | "phase2" | "funded";
  profitTargetPct?: number | null;
  dailyLossLimitPct?: number;
  maxDrawdownPct?: number;
  drawdownType?: "static" | "trailing";
  resetHour?: number;
}

const ACCOUNT_ARCHETYPES: AccountArchetype[] = [
  // 1. FundingPips 50K Evaluation
  {
    nameTemplate: "FundingPips $50K 2-Phase Evaluation",
    broker: "FundingPips",
    accountType: "prop",
    currency: "USD",
    startingBalanceCents: 5_000_000, // $50,000
    hasChallenge: true,
    propFirm: "FundingPips",
    stage: "phase1",
    profitTargetPct: 8,
    dailyLossLimitPct: 5,
    maxDrawdownPct: 10,
    drawdownType: "static",
    resetHour: 17,
  },
  // 2. Apex 50K Trailing Combine
  {
    nameTemplate: "Apex 50K Trailing Combine",
    broker: "Apex Trader Funding",
    accountType: "prop",
    currency: "USD",
    startingBalanceCents: 5_000_000, // $50,000
    hasChallenge: true,
    propFirm: "Apex Trader Funding",
    stage: "phase1",
    profitTargetPct: 6,
    dailyLossLimitPct: 4,
    maxDrawdownPct: 5,
    drawdownType: "trailing",
    resetHour: 17,
  },
  // 3. Topstep $150K Futures Combine
  {
    nameTemplate: "Topstep $150K Futures Combine",
    broker: "Topstep",
    accountType: "prop",
    currency: "USD",
    startingBalanceCents: 15_000_000, // $150,000
    hasChallenge: true,
    propFirm: "Topstep",
    stage: "phase1",
    profitTargetPct: 6,
    dailyLossLimitPct: 3,
    maxDrawdownPct: 4.5,
    drawdownType: "trailing",
    resetHour: 17,
  },
  // 4. FTMO $100K Stage 2 Verification
  {
    nameTemplate: "FTMO $100K Stage 2 Verification",
    broker: "FTMO",
    accountType: "prop",
    currency: "USD",
    startingBalanceCents: 10_000_000, // $100,000
    hasChallenge: true,
    propFirm: "FTMO",
    stage: "phase2",
    profitTargetPct: 5,
    dailyLossLimitPct: 5,
    maxDrawdownPct: 10,
    drawdownType: "static",
    resetHour: 0,
  },
  // 5. FundedNext $200K Stellar Challenge
  {
    nameTemplate: "FundedNext $200K Stellar Challenge",
    broker: "FundedNext",
    accountType: "prop",
    currency: "USD",
    startingBalanceCents: 20_000_000, // $200,000
    hasChallenge: true,
    propFirm: "FundedNext",
    stage: "phase1",
    profitTargetPct: 8,
    dailyLossLimitPct: 5,
    maxDrawdownPct: 10,
    drawdownType: "static",
    resetHour: 0,
  },
  // 6. The5ers €60K Hyper Growth
  {
    nameTemplate: "The5ers €60K Hyper Growth",
    broker: "The5ers",
    accountType: "prop",
    currency: "EUR",
    startingBalanceCents: 6_000_000, // €60,000
    hasChallenge: true,
    propFirm: "The5ers",
    stage: "phase1",
    profitTargetPct: 10,
    dailyLossLimitPct: 4,
    maxDrawdownPct: 8,
    drawdownType: "static",
    resetHour: 0,
  },
  // 7. Alpha Capital £100K Pro Qualifier
  {
    nameTemplate: "Alpha Capital £100K Pro Qualifier",
    broker: "Alpha Capital",
    accountType: "prop",
    currency: "GBP",
    startingBalanceCents: 10_000_000, // £100,000
    hasChallenge: true,
    propFirm: "Alpha Capital",
    stage: "phase1",
    profitTargetPct: 8,
    dailyLossLimitPct: 5,
    maxDrawdownPct: 10,
    drawdownType: "static",
    resetHour: 17,
  },
  // 8. Topstep $50K Express Funded Account
  {
    nameTemplate: "Topstep $50K Express Funded",
    broker: "Topstep",
    accountType: "funded",
    currency: "USD",
    startingBalanceCents: 5_000_000, // $50,000
    hasChallenge: true,
    propFirm: "Topstep",
    stage: "funded",
    profitTargetPct: null,
    dailyLossLimitPct: 3,
    maxDrawdownPct: 4,
    drawdownType: "trailing",
    resetHour: 17,
  },
  // 9. FTMO $100K Master Funded Account
  {
    nameTemplate: "FTMO $100K Master Funded",
    broker: "FTMO",
    accountType: "funded",
    currency: "USD",
    startingBalanceCents: 10_000_000, // $100,000
    hasChallenge: true,
    propFirm: "FTMO",
    stage: "funded",
    profitTargetPct: null,
    dailyLossLimitPct: 5,
    maxDrawdownPct: 10,
    drawdownType: "static",
    resetHour: 0,
  },
  // 10. Interactive Brokers Prime Margin (Personal)
  {
    nameTemplate: "Interactive Brokers Prime Margin",
    broker: "Interactive Brokers",
    accountType: "personal",
    currency: "USD",
    startingBalanceCents: 3_500_000, // $35,000
    hasChallenge: false,
    dailyLossLimitPct: 3,
    maxDrawdownPct: 8,
  },
  // 11. Pepperstone Razor Swing Live (Personal)
  {
    nameTemplate: "Pepperstone Razor Swing Live",
    broker: "Pepperstone",
    accountType: "personal",
    currency: "USD",
    startingBalanceCents: 7_500_000, // $75,000
    hasChallenge: false,
    dailyLossLimitPct: 3,
    maxDrawdownPct: 10,
  },
  // 12. OANDA FX Alpha Portfolio (Personal EUR)
  {
    nameTemplate: "OANDA FX Alpha Portfolio",
    broker: "OANDA",
    accountType: "personal",
    currency: "EUR",
    startingBalanceCents: 2_500_000, // €25,000
    hasChallenge: false,
    dailyLossLimitPct: 2.5,
    maxDrawdownPct: 7,
  },
  // 13. TradeStation Micro Futures Direct (Personal)
  {
    nameTemplate: "TradeStation Micro Futures Direct",
    broker: "TradeStation",
    accountType: "personal",
    currency: "USD",
    startingBalanceCents: 5_000_000, // $50,000
    hasChallenge: false,
    dailyLossLimitPct: 3,
    maxDrawdownPct: 8,
  },
];

// ---------------------------------------------------------------------------
// Strategy Library
// ---------------------------------------------------------------------------

interface StrategyBlueprint {
  name: string;
  market: string;
  purpose: string;
  description: string;
  instruments: string;
  timeframe: string;
  session: string;
  rules: { title: string; required: boolean; description: string }[];
}

const STRATEGY_LIBRARY: StrategyBlueprint[] = [
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
    name: "Nasdaq Opening Range Breakout",
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
    name: "S&P 500 VWAP Mean Reversion",
    market: "indices",
    purpose: "Exploit statistical exhaustion and return to daily VWAP equilibrium.",
    description: "Reversion trade taken when ES extends > 2 standard deviations from session VWAP into structural demand/supply.",
    instruments: "ES",
    timeframe: "15m",
    session: "ny_pm",
    rules: [
      { title: "Price extended > 2 standard deviations from VWAP", required: true, description: "Clear statistical band extension." },
      { title: "NYSE TICK divergence", required: true, description: "TICK extreme exhaustion (< -800 or > +800)." },
      { title: "Absorption volume candle printed", required: true, description: "High volume wick rejecting new low/high." },
      { title: "Target session VWAP baseline", required: true, description: "Full exit at central VWAP mean." },
    ],
  },
  {
    name: "Crypto Liquidation Reversal",
    market: "crypto",
    purpose: "Exploit aggressive retail liquidation cascades on high-leverage crypto perpetuals.",
    description: "Extreme statistical deviation from 20-period VWAP/Bollinger bands on BTC with volume exhaustion.",
    instruments: "BTCUSD, SOLUSD",
    timeframe: "15m - 1h",
    session: "ny_pm",
    rules: [
      { title: "Price extended > 2.5 standard deviations", required: true, description: "Statistical extreme on 15m/1h bands." },
      { title: "Volume exhaustion wick", required: true, description: "Long rejection tail with declining follow-through volume." },
      { title: "Open Interest drop / CVD divergence", required: false, description: "Cascading stop hunt absorption confirmed." },
      { title: "Target VWAP / 20 EMA mean", required: true, description: "Exit completely at mean reversion equilibrium." },
    ],
  },
  {
    name: "Asian Range Liquidity Sweep",
    market: "forex",
    purpose: "Capitalize on early London session sweep of overnight Asian range highs and lows.",
    description: "Sweep of Asian extremes followed by rapid market structure shift targeting opposite liquidity pools.",
    instruments: "GBPUSD, USDJPY, EURUSD",
    timeframe: "15m",
    session: "london",
    rules: [
      { title: "Defined Asian consolidation range", required: true, description: "Range established prior to London Open." },
      { title: "Clean liquidity sweep into key higher-timeframe zone", required: true, description: "10-20 pip sweep." },
      { title: "5m displacement candle closing inside range", required: true, description: "Energetic reversal confirmation." },
      { title: "Target opposing Asian boundary", required: false, description: "Minimum 2.5R objective." },
    ],
  },
  {
    name: "Daily Bias Fair Value Gap Retest",
    market: "gold",
    purpose: "Align with higher timeframe institutional flow by trading clean FVG retracements.",
    description: "4H trend continuation model executing on 15m Fair Value Gap mitigations during peak volume.",
    instruments: "XAUUSD, EURUSD",
    timeframe: "15m",
    session: "ny_am",
    rules: [
      { title: "4H directional bias clear", required: true, description: "Unbroken 4H market structure." },
      { title: "15m displacement candle creates virgin FVG", required: true, description: "Imbalance gap between candle 1 wick and candle 3 wick." },
      { title: "Clean touch of FVG 50% equilibrium", required: true, description: "Limit order fill at midpoint." },
      { title: "Target 4H swing high/low", required: false, description: "Run into major institutional liquidity." },
    ],
  },
  {
    name: "High-Beta Momentum Trend",
    market: "indices",
    purpose: "Capture multi-leg intraday trend continuation during trending market regimes.",
    description: "Fast EMA pullbacks on NQ during sustained institutional trending sessions.",
    instruments: "NQ",
    timeframe: "5m",
    session: "ny_am",
    rules: [
      { title: "20 EMA stacked above 50 EMA on 15m & 5m", required: true, description: "Clear directional slope." },
      { title: "Pullback to 20 EMA on declining volume", required: true, description: "Corrective retracement." },
      { title: "Engulfing candle continuation signal", required: true, description: "Buyers immediately step back in." },
      { title: "Trail stop under 5m swing lows", required: false, description: "Ride the trend until market structure breaks." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Market Specifications
// ---------------------------------------------------------------------------

interface MarketSpec {
  symbol: string;
  market: string;
  basePrice: number;
  priceDecimals: number;
  contractMultiplier: number; // dollars per 1.0 unit move for 1 lot/contract
  typicalRiskStopPts: number;
}

const MARKET_SPECS: Record<string, MarketSpec> = {
  XAUUSD: {
    symbol: "XAUUSD",
    market: "gold",
    basePrice: 2360.00,
    priceDecimals: 2,
    contractMultiplier: 100, // 100 oz per standard lot -> $1.00 move = $100
    typicalRiskStopPts: 5.0,
  },
  EURUSD: {
    symbol: "EURUSD",
    market: "forex",
    basePrice: 1.08500,
    priceDecimals: 5,
    contractMultiplier: 100000, // 100,000 units -> 0.0001 (1 pip) = $10
    typicalRiskStopPts: 0.0025, // 25 pips
  },
  GBPUSD: {
    symbol: "GBPUSD",
    market: "forex",
    basePrice: 1.27500,
    priceDecimals: 5,
    contractMultiplier: 100000,
    typicalRiskStopPts: 0.0030, // 30 pips
  },
  USDJPY: {
    symbol: "USDJPY",
    market: "forex",
    basePrice: 154.50,
    priceDecimals: 3,
    contractMultiplier: 1000, // $10 approx per pip for standard lot
    typicalRiskStopPts: 0.35, // 35 pips
  },
  NQ: {
    symbol: "NQ",
    market: "indices",
    basePrice: 20100.00,
    priceDecimals: 2,
    contractMultiplier: 20, // $20 per full point
    typicalRiskStopPts: 30.0,
  },
  ES: {
    symbol: "ES",
    market: "indices",
    basePrice: 5520.00,
    priceDecimals: 2,
    contractMultiplier: 50, // $50 per full point
    typicalRiskStopPts: 12.0,
  },
  BTCUSD: {
    symbol: "BTCUSD",
    market: "crypto",
    basePrice: 65400.00,
    priceDecimals: 2,
    contractMultiplier: 1, // $1 per $1 move for 1 BTC
    typicalRiskStopPts: 600.0,
  },
};

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  try {
    // 1. Select a diverse, randomized account archetype
    // We pick randomly from the rich archetype library
    const archetype = ACCOUNT_ARCHETYPES[Math.floor(Math.random() * ACCOUNT_ARCHETYPES.length)];

    // Unset isDefault on prior accounts without modifying or deleting user data
    await db.tradingAccount.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });

    // Create the new demo account
    const account = await db.tradingAccount.create({
      data: {
        userId: user.id,
        name: `${archetype.nameTemplate} #${Math.floor(1000 + Math.random() * 9000)}`,
        broker: archetype.broker,
        accountType: archetype.accountType,
        currency: archetype.currency,
        startingBalanceCents: archetype.startingBalanceCents,
        currentBalanceCents: archetype.startingBalanceCents, // Will be updated dynamically after trades
        consistencyRate: Math.floor(82 + Math.random() * 12),
        dailyLossLimitPct: archetype.dailyLossLimitPct ?? 5,
        maxDrawdownPct: archetype.maxDrawdownPct ?? 10,
        isDefault: true,
      },
    });

    // 2. If prop or funded, create the linked PropChallenge record
    let challenge: any = null;
    if (archetype.hasChallenge && archetype.propFirm) {
      const targetCents = archetype.profitTargetPct
        ? Math.round(archetype.startingBalanceCents * (archetype.profitTargetPct / 100))
        : null;
      const dailyCents = archetype.dailyLossLimitPct
        ? Math.round(archetype.startingBalanceCents * (archetype.dailyLossLimitPct / 100))
        : null;
      const maxDDCents = archetype.maxDrawdownPct
        ? Math.round(archetype.startingBalanceCents * (archetype.maxDrawdownPct / 100))
        : null;

      challenge = await db.propChallenge.create({
        data: {
          userId: user.id,
          accountId: account.id,
          name: `${archetype.propFirm} ${archetype.stage?.toUpperCase()} Tracker`,
          propFirm: archetype.propFirm,
          stage: archetype.stage ?? "phase1",
          status: "active",
          startingBalanceCents: archetype.startingBalanceCents,
          profitTargetCents: targetCents,
          dailyLossLimitCents: dailyCents,
          dailyLossLimitPct: archetype.dailyLossLimitPct ?? 5,
          maxDrawdownCents: maxDDCents,
          maxDrawdownPct: archetype.maxDrawdownPct ?? 10,
          drawdownType: archetype.drawdownType ?? "static",
          trailingHighWaterMarkCents: archetype.startingBalanceCents,
          minTradingDays: 4,
          maxTradingDays: archetype.stage === "funded" ? null : 60,
          resetTimezone: "America/New_York",
          resetHour: archetype.resetHour ?? 17,
        },
      });
    }

    // 3. Select 3 to 4 diverse strategies from the library
    const shuffledStrategies = [...STRATEGY_LIBRARY].sort(() => 0.5 - Math.random());
    const selectedStrategyBlueprints = shuffledStrategies.slice(0, Math.floor(3 + Math.random() * 2)); // 3 or 4
    const createdStrategies: Array<{ id: string; name: string; versionId: string; blueprint: StrategyBlueprint }> = [];

    for (const sc of selectedStrategyBlueprints) {
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
              changeReason: "Baseline institutional trading rules",
              changeSummary: "Standard playbook rules with disciplined risk parameters.",
              rulesJson: JSON.stringify(sc.rules),
              effectiveDate: new Date(),
            },
          },
        },
        include: { versions: true },
      });

      createdStrategies.push({
        id: s.id,
        name: s.name,
        versionId: s.versions[0].id,
        blueprint: sc,
      });
    }

    // 4. Generate randomized, realistic trades across the past 25 to 55 days
    const tradeCount = Math.floor(20 + Math.random() * 12); // 20 to 31 trades
    const daysSpan = Math.floor(30 + Math.random() * 25); // 30 to 54 days back
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Distribute trade dates skipping weekends
    const availableDates: Date[] = [];
    for (let d = daysSpan; d >= 0; d--) {
      const candidate = new Date(now - d * dayMs);
      const dayOfWeek = candidate.getUTCDay(); // 0 is Sun, 6 is Sat
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        availableDates.push(candidate);
      }
    }

    // Available instruments matching created strategies
    const availableSymbols = Object.keys(MARKET_SPECS);

    let totalNetPnlCents = 0;
    let winsCount = 0;
    let lossesCount = 0;
    let besCount = 0;

    const tradesToInsert: any[] = [];
    const executionsToInsert: any[] = [];

    // Realistic target win rate between 56% and 65%
    const targetWinRate = 0.56 + Math.random() * 0.09;
    const targetBeRate = 0.10 + Math.random() * 0.04;

    for (let i = 0; i < tradeCount; i++) {
      const tradeId = "t_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

      // Pick a random strategy from created ones
      const strategy = createdStrategies[Math.floor(Math.random() * createdStrategies.length)];

      // Pick symbol matching strategy or compatible
      const strategySymbols = strategy.blueprint.instruments.split(",").map((s) => s.trim().toUpperCase());
      const validSymbol = strategySymbols.find((s) => MARKET_SPECS[s]) || availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
      const spec = MARKET_SPECS[validSymbol] || MARKET_SPECS.EURUSD;

      // Determine outcome
      const outcomeRand = Math.random();
      let status: "win" | "loss" | "breakeven";
      if (outcomeRand < targetWinRate) {
        status = "win";
        winsCount++;
      } else if (outcomeRand < targetWinRate + targetBeRate) {
        status = "breakeven";
        besCount++;
      } else {
        status = "loss";
        lossesCount++;
      }

      // Pick date
      const dateIndex = Math.floor((i / tradeCount) * (availableDates.length - 1));
      const baseDate = new Date(availableDates[dateIndex] || now);

      // Session and hour
      let hour = 9;
      let session = strategy.blueprint.session;
      if (session === "london") hour = 8 + Math.floor(Math.random() * 3);
      else if (session === "ny_am") hour = 13 + Math.floor(Math.random() * 3);
      else if (session === "ny_pm") hour = 17 + Math.floor(Math.random() * 3);
      else if (session === "asia") hour = 1 + Math.floor(Math.random() * 4);
      else {
        hour = 14;
        session = "ny_am";
      }

      const entryTime = new Date(baseDate);
      entryTime.setUTCHours(hour, Math.floor(Math.random() * 55), Math.floor(Math.random() * 60));
      const durationMins = 30 + Math.floor(Math.random() * 120);
      const exitTime = new Date(entryTime.getTime() + durationMins * 60 * 1000);

      // Direction
      const direction: "long" | "short" = Math.random() > 0.5 ? "long" : "short";

      // Pricing math based on market spec
      const priceVariation = (Math.random() - 0.5) * (spec.basePrice * 0.03);
      const entryPriceNum = Number((spec.basePrice + priceVariation).toFixed(spec.priceDecimals));

      // Risk between 0.5% and 1.2% of starting balance
      const riskCents = Math.round(archetype.startingBalanceCents * (0.005 + Math.random() * 0.006));
      const riskDollars = riskCents / 100;

      // Stop distance in price units
      const stopDistance = Number((spec.typicalRiskStopPts * (0.8 + Math.random() * 0.4)).toFixed(spec.priceDecimals));

      // Position size: riskDollars / (stopDistance * contractMultiplier)
      const rawUnits = riskDollars / (stopDistance * spec.contractMultiplier);
      let positionSize = "1.0";
      if (spec.market === "indices") {
        positionSize = Math.max(1, Math.round(rawUnits)).toString();
      } else if (spec.market === "crypto") {
        positionSize = Math.max(0.1, Number(rawUnits.toFixed(2))).toString();
      } else {
        positionSize = Math.max(0.1, Number(rawUnits.toFixed(2))).toString();
      }

      const stopPriceNum = direction === "long"
        ? Number((entryPriceNum - stopDistance).toFixed(spec.priceDecimals))
        : Number((entryPriceNum + stopDistance).toFixed(spec.priceDecimals));

      let plannedRR = "2.50";
      let actualR = "0.00";
      let netPnlCents = 0;
      let exitPriceNum = entryPriceNum;
      let targetPriceNum = entryPriceNum;
      let hasPartialExit = false;

      const feesCents = 150 + Math.floor(Math.random() * 100);
      const commissionCents = 250 + Math.floor(Math.random() * 200);

      if (status === "win") {
        const rr = Number((1.8 + Math.random() * 2.2).toFixed(2)); // 1.8R to 4.0R
        plannedRR = rr.toFixed(2);
        actualR = rr.toFixed(2);
        netPnlCents = Math.round(riskCents * rr);

        targetPriceNum = direction === "long"
          ? Number((entryPriceNum + stopDistance * rr).toFixed(spec.priceDecimals))
          : Number((entryPriceNum - stopDistance * rr).toFixed(spec.priceDecimals));
        exitPriceNum = targetPriceNum;

        // ~30% of winners have partial exit
        hasPartialExit = Math.random() < 0.35;
      } else if (status === "loss") {
        const plannedRrNum = Number((2.0 + Math.random() * 1.5).toFixed(2));
        plannedRR = plannedRrNum.toFixed(2);

        targetPriceNum = direction === "long"
          ? Number((entryPriceNum + stopDistance * plannedRrNum).toFixed(spec.priceDecimals))
          : Number((entryPriceNum - stopDistance * plannedRrNum).toFixed(spec.priceDecimals));

        const lossR = Number((0.95 + Math.random() * 0.15).toFixed(2)); // -0.95R to -1.1R
        actualR = `-${lossR}`;
        netPnlCents = -Math.round(riskCents * lossR);
        exitPriceNum = stopPriceNum;
      } else {
        // Breakeven
        plannedRR = "2.50";
        actualR = "0.00";
        netPnlCents = 0;
        targetPriceNum = direction === "long"
          ? Number((entryPriceNum + stopDistance * 2.5).toFixed(spec.priceDecimals))
          : Number((entryPriceNum - stopDistance * 2.5).toFixed(spec.priceDecimals));
        exitPriceNum = entryPriceNum;
      }

      totalNetPnlCents += netPnlCents;

      const isWin = status === "win";
      const isLoss = status === "loss";
      const setupGrade = isWin ? (Math.random() > 0.4 ? "A+" : "A") : isLoss ? (Math.random() > 0.5 ? "B" : "C") : "A";
      const setupScore = isWin ? (0.85 + Math.random() * 0.13).toFixed(2) : (0.50 + Math.random() * 0.25).toFixed(2);

      const behaviorFlags: string[] = [];
      if (isLoss && Math.random() < 0.4) behaviorFlags.push("entered_early");
      if (isLoss && Math.random() < 0.2) behaviorFlags.push("chased_price");

      tradesToInsert.push({
        id: tradeId,
        userId: user.id,
        accountId: account.id,
        instrumentSymbol: spec.symbol,
        market: spec.market,
        direction,
        status,
        session,
        strategyId: strategy.id,
        strategyVersionId: strategy.versionId,
        setupGrade,
        setupScore,
        tagsJson: JSON.stringify(["demo", strategy.name.toLowerCase().replace(/\s+/g, "-")]),
        plannedEntryPrice: entryPriceNum.toFixed(spec.priceDecimals),
        plannedStopPrice: stopPriceNum.toFixed(spec.priceDecimals),
        plannedTargetPrice: targetPriceNum.toFixed(spec.priceDecimals),
        plannedRiskAmountCents: riskCents,
        plannedRiskPct: (riskCents / archetype.startingBalanceCents).toFixed(4),
        plannedRR,
        entryPriceAvg: entryPriceNum.toFixed(spec.priceDecimals),
        exitPriceAvg: exitPriceNum.toFixed(spec.priceDecimals),
        positionSize,
        feesCents,
        commissionCents,
        swapCents: 0,
        slippageCents: isLoss ? 50 : 0,
        grossPnlCents: netPnlCents + feesCents + commissionCents,
        netPnlCents,
        actualR,
        entryTime,
        exitTime,
        tradingTimezone: "UTC",
        notes: isWin
          ? `High-quality ${strategy.name} model execution on ${spec.symbol}. All checklist requirements confirmed before entry.`
          : isLoss
          ? `Discipline maintained. Invalidation level breached according to plan on ${spec.symbol}. Stopped out safely.`
          : `Target +1.5R excursion reached, trailed stop loss to breakeven according to trade management rules.`,
        thesisJson: JSON.stringify({
          why: `Institutional ${strategy.name} setup on ${spec.symbol} during ${session.toUpperCase()} session.`,
          narrative: `Identified clean market structure and liquidity imbalance. Order filled at planned entry price.`,
        }),
        lessons: isLoss
          ? "Protecting capital with disciplined stops preserves edge over long-term cycles."
          : "Executions align with statistical expectancy when entry patience is maintained.",
        behaviorFlagsJson: JSON.stringify(behaviorFlags),
        psychBeforeJson: JSON.stringify({
          confidence: isWin ? 5 : 3,
          energy: 4,
          moodTags: isWin ? ["focused", "disciplined"] : ["calm"],
        }),
        psychAfterJson: JSON.stringify({
          confidence: isWin ? 5 : 3,
          energy: isWin ? 4 : 3,
          moodTags: isWin ? ["satisfied", "consistent"] : isLoss ? ["objective"] : ["neutral"],
        }),
      });

      // Trade executions: handle partial exit vs single exit
      if (hasPartialExit) {
        // Multi-execution: Entry -> TP1 (50% scale-out) -> Runner TP2 (50% exit)
        const sizeNum = parseFloat(positionSize) || 1.0;
        const halfSize = (sizeNum / 2).toFixed(spec.market === "indices" ? 0 : 2);
        const midTime = new Date(entryTime.getTime() + (durationMins * 0.5) * 60 * 1000);
        const tp1Price = Number((entryPriceNum + (exitPriceNum - entryPriceNum) * 0.6).toFixed(spec.priceDecimals));

        executionsToInsert.push(
          {
            id: "ex_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
            tradeId,
            kind: "entry",
            seq: 0,
            price: entryPriceNum.toFixed(spec.priceDecimals),
            quantity: positionSize,
            timestamp: entryTime,
            notes: "Initial market order execution",
          },
          {
            id: "ex_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
            tradeId,
            kind: "exit",
            seq: 1,
            price: tp1Price.toFixed(spec.priceDecimals),
            quantity: halfSize,
            timestamp: midTime,
            notes: "Partial exit (50% scale-out at TP1)",
          },
          {
            id: "ex_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
            tradeId,
            kind: "exit",
            seq: 2,
            price: exitPriceNum.toFixed(spec.priceDecimals),
            quantity: halfSize,
            timestamp: exitTime,
            notes: "Runner exit at final take-profit objective",
          },
        );
      } else {
        // Standard single entry and single exit
        executionsToInsert.push(
          {
            id: "ex_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
            tradeId,
            kind: "entry",
            seq: 0,
            price: entryPriceNum.toFixed(spec.priceDecimals),
            quantity: positionSize,
            timestamp: entryTime,
            notes: "Initial market order execution",
          },
          {
            id: "ex_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
            tradeId,
            kind: "exit",
            seq: 1,
            price: exitPriceNum.toFixed(spec.priceDecimals),
            quantity: positionSize,
            timestamp: exitTime,
            notes: isWin ? "Take profit target reached" : isLoss ? "Stop loss invalidation hit" : "Breakeven tap",
          },
        );
      }
    }

    // Insert trades and executions
    await db.trade.createMany({ data: tradesToInsert });
    await db.tradeExecution.createMany({ data: executionsToInsert });

    // Update account balance to strictly reflect total net PnL
    const finalBalanceCents = account.startingBalanceCents + totalNetPnlCents;
    await db.tradingAccount.update({
      where: { id: account.id },
      data: { currentBalanceCents: finalBalanceCents },
    });

    // If challenge exists, update high-water mark, start date, and status
    if (challenge) {
      const isPassed = challenge.profitTargetCents
        ? finalBalanceCents >= challenge.startingBalanceCents + challenge.profitTargetCents
        : false;
      const isBreached = challenge.maxDrawdownCents
        ? finalBalanceCents <= challenge.startingBalanceCents - challenge.maxDrawdownCents
        : false;

      const earliestTrade = tradesToInsert.length > 0
        ? [...tradesToInsert].sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())[0]
        : null;

      await db.propChallenge.update({
        where: { id: challenge.id },
        data: {
          trailingHighWaterMarkCents: Math.max(challenge.startingBalanceCents, finalBalanceCents),
          status: isPassed ? "passed" : isBreached ? "breached" : "active",
          startDate: earliestTrade?.entryTime ?? new Date(),
        },
      });
    }

    // 5. Generate 4 to 6 Realistic No-Trade Observations (NoTradeEntry)
    const observationBlueprints = [
      {
        symbol: "EURUSD",
        market: "forex",
        session: "ny_am",
        timeframe: "15m",
        bias: "bearish",
        title: "FOMC High-Impact News Hazard",
        observation: "High-impact rate statement within 15 minutes. Spreads widening significantly across major pairs.",
        reasonCategory: "news_risk",
        reasonNotes: "Standard risk parameters forbid execution inside the 15-minute high-impact news window.",
        conditionMissing: "Post-news price stability and volatility normalization.",
        wouldHaveValidated: "Wait 20 minutes post-statement for volatility normalization and trade direction confirmation.",
        invalidationReason: "Slippage risk exceeds acceptable safety thresholds.",
      },
      {
        symbol: "XAUUSD",
        market: "gold",
        session: "asia",
        timeframe: "5m",
        bias: "neutral",
        title: "Choppy Low-Volume Asian Range",
        observation: "Gold oscillating inside a tight 3-point range with overlapping candles and no directional conviction.",
        reasonCategory: "unclear_structure",
        reasonNotes: "No clear liquidity pool swept; lack of institutional displacement.",
        conditionMissing: "Energetic sweep of Asian high or low with displacement.",
        wouldHaveValidated: "Clear London session breakout and retest of outer boundary.",
        invalidationReason: "Inside day consolidation with low liquidity.",
      },
      {
        symbol: "NQ",
        market: "indices",
        session: "ny_am",
        timeframe: "5m",
        bias: "bullish",
        title: "Unfavorable Risk-Reward Ratio",
        observation: "Breakout setup observed, but overhead 4H resistance only 18 points away. Required stop was 30 points (0.6R).",
        reasonCategory: "poor_rr",
        reasonNotes: "Model requires minimum 2.0R planned expectancy to execute.",
        conditionMissing: "Deeper retracement into demand zone to achieve 2.5R minimum.",
        wouldHaveValidated: "Pullback to 15m order block allowing tight invalidation.",
        invalidationReason: "Risk-reward profile unfavorable for statistical edge.",
      },
      {
        symbol: "GBPUSD",
        market: "forex",
        session: "london",
        timeframe: "15m",
        bias: "bullish",
        title: "Missing 5m Displacement Confirmation",
        observation: "Asian low swept by 6 pips, but subsequent candle closed as an indecisive doji without displacement.",
        reasonCategory: "confirmation_missing",
        reasonNotes: "Checklist rule #2 requires market structure shift candle with fair value gap.",
        conditionMissing: "Institutional impulse candle closing with displacement.",
        wouldHaveValidated: "Strong body close back inside the Asian range.",
        invalidationReason: "Lack of buying momentum indicated possible continuation lower.",
      },
      {
        symbol: "ES",
        market: "indices",
        session: "ny_pm",
        timeframe: "15m",
        bias: "bullish",
        title: "Daily Profit Target Preserved",
        observation: "Secondary VWAP setup formed at 2:30 PM NY. Day was already +2.4R profitable.",
        reasonCategory: "limit_reached",
        reasonNotes: "Daily trading plan limits active executions to prevent overtrading and fatigue.",
        conditionMissing: "N/A — setup was technically valid, but plan rules dictated halting executions.",
        wouldHaveValidated: "N/A — rule adherence takes priority over taking another setup.",
        invalidationReason: "Mental fatigue and end-of-day chop risk.",
      },
    ];

    const noTradesToInsert: any[] = [];
    for (let j = 0; j < observationBlueprints.length; j++) {
      const ob = observationBlueprints[j];
      const obDate = new Date(now - (j * 7 + 2) * dayMs);
      obDate.setUTCHours(10 + j, 15, 0, 0);

      noTradesToInsert.push({
        id: "nt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
        userId: user.id,
        accountId: account.id,
        instrumentSymbol: ob.symbol,
        market: ob.market,
        session: ob.session,
        timeframe: ob.timeframe,
        bias: ob.bias,
        title: ob.title,
        observation: ob.observation,
        reasonCategory: ob.reasonCategory,
        reasonNotes: ob.reasonNotes,
        conditionMissing: ob.conditionMissing,
        wouldHaveValidated: ob.wouldHaveValidated,
        invalidationReason: ob.invalidationReason,
        decisionType: "deliberate_avoidance",
        status: "rejected",
        psychologyNotes: "Disciplined rule adherence and capital preservation.",
        date: obDate,
        time: `${String(obDate.getUTCHours()).padStart(2, "0")}:15`,
        tagsJson: JSON.stringify(["demo", "observation"]),
      });
    }

    await db.noTradeEntry.createMany({ data: noTradesToInsert });

    // 6. Invalidate caches for this user
    invalidateCache(`dashboard:${user.id}`);
    invalidateCache(`analytics:${user.id}`);
    invalidateCache(`trades:${user.id}`);
    invalidateCache(`accounts:${user.id}`);
    invalidateCache(`strategies:${user.id}`);
    invalidateCache(`calendar:${user.id}`);
    invalidateCache(`no-trades:${user.id}`);
    invalidateCache(`me:${user.id}`);

    await audit("demo_data.generated", "user", user.id, {
      account: account.name,
      accountType: account.accountType,
      currency: account.currency,
      startingBalance: account.startingBalanceCents,
      finalBalance: finalBalanceCents,
      tradesCount: tradesToInsert.length,
      strategiesCount: createdStrategies.length,
      noTradesCount: noTradesToInsert.length,
    });

    return ok({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        accountType: account.accountType,
        currency: account.currency,
        startingBalance: account.startingBalanceCents,
        balance: finalBalanceCents,
        pnl: totalNetPnlCents,
      },
      summary: {
        accounts: 1,
        strategies: createdStrategies.length,
        trades: tradesToInsert.length,
        noTrades: noTradesToInsert.length,
      },
      strategiesCount: createdStrategies.length,
      tradesCount: tradesToInsert.length,
      noTradesCount: noTradesToInsert.length,
      wins: winsCount,
      losses: lossesCount,
      breakevens: besCount,
      totalNetPnlCents,
    });
  } catch (err: any) {
    console.error("Failed to generate demo data:", err);
    return bad(`Failed to generate demo data: ${err?.message ?? "Internal error"}`);
  }
}
