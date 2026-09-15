import { Decimal, dToNumber, dDiv, dAbs, dIsZero, dSub, dCmp, dNormalize } from "./decimal";
/**
 * DnD — Authoritative Financial Engine
 *
 * SPEC COMPLIANCE (per "STRICT FINANCIAL ENGINE & ANALYTICS SPECIFICATION"):
 *
 * §1  ONE authoritative engine. Frontend MUST NOT independently calculate
 *     authoritative P&L, risk, position size, R, R:R, win rate, etc.
 *
 * §2  Units never mixed. Price, Quantity, Money, Currency, Ratio, Percentage,
 *     Points, Ticks, Pips, Lots are distinct.
 *
 * §3  Authoritative instrument model with all required fields.
 *
 * §8  Lots vs quantity: representation B chosen (quantity in lots/contracts,
 *     pointValueCents = monetary value per 1.0 price move per 1.0 quantity
 *     unit). Spec §10 explicitly allows this representation.
 *
 * §9  NO double multiplication. P&L = priceDiff × quantity × pointValueCents
 *     only. contractSize is NEVER multiplied in formulas.
 *
 * §10 Universal P&L with ONE canonical path.
 *
 * §17 Partial exits: every execution immutable. Each exit independently
 *     calculated against avg entry, summed.
 *
 * §29 Precision: BigInt for money (minor units), explicit-decimal for prices.
 *
 * Representation decision (LOCKED):
 *   quantity        = lots (forex/gold CFD) OR contracts (futures) — stored as decimal string
 *   pointValueCents = cents per 1.0 price move per 1.0 quantity unit
 *   contractSize    = informational only (underlying units per lot — NEVER in formulas)
 *
 * XAUUSD verification (spec §32 screenshot test):
 *   lot=0.01, contractSize=100, stopDistance=$1, pointValueCents=10000 ($100/lot)
 *   risk = stopDistance × quantity × pointValueCents
 *        = 1 × 0.01 × 10000 = 100 cents = $1 ✓
 *
 * NQ verification (spec §15):
 *   entry=20000, exit=20010, qty=1, pointValueCents=2000 ($20/point/contract)
 *   pnl = (20010-20000) × 1 × 2000 = 20000 cents = $200 ✓
 */

// ---------------------------------------------------------------------------
// §3 AUTHORITATIVE INSTRUMENT MODEL
// ---------------------------------------------------------------------------

export type AssetClass =
  | "forex"
  | "gold"
  | "indices"
  | "futures"
  | "crypto"
  | "stocks"
  | "custom";

export type QuantityUnit = "lots" | "contracts" | "shares" | "units" | "ounces";

export interface InstrumentEconomics {
  symbol: string;
  assetClass: AssetClass;
  baseCurrency: string | null; // ISO 4217 (forex base), null for non-forex
  quoteCurrency: string; // ISO 4217 (settlement / counter currency)
  quantityUnit: QuantityUnit;
  quantityScale: number; // decimal places of quantity (0 for contracts, 2 for lots)
  quantityStep: string; // minimum quantity increment ("0.01" for lots, "1" for contracts)
  minimumQuantity: string; // minimum tradable quantity
  contractSize: string; // underlying units per 1 lot/contract (INFORMATIONAL ONLY)
  priceIncrement: string; // = tickSize (alias for clarity)
  tickSize: string;
  pointValueCents: number; // AUTHORITATIVE: cents per 1.0 price move per 1.0 quantity unit
  pipSize: string | null; // forex only
  currencyConversionRequired: boolean; // true if quoteCurrency ≠ accountCurrency
}

// ---------------------------------------------------------------------------
// §7, §10, §17 CALCULATION INPUTS / OUTPUTS
// ---------------------------------------------------------------------------

export type Direction = "long" | "short";

export interface ExecutionFill {
  kind: "entry" | "exit";
  price: string; // decimal string
  quantity: string; // decimal string (in quantity units: lots/contracts)
  timestamp?: string;
}

export interface FinancialCalcInput {
  instrument: InstrumentEconomics;
  accountCurrency: string;
  direction: "long" | "short";
  plannedEntryPrice: string | null;
  plannedStopPrice: string | null;
  plannedTargetPrice: string | null;
  fills: ExecutionFill[];
  feesCents: number;
  commissionCents: number;
  swapCents: number;
  slippageCents: number;
  // Currency conversion (applied to convert native P&L → account currency)
  conversionRate?: number | null;
  conversionDirection?: "IDENTITY" | "MULTIPLY" | "DIVIDE" | null;
}

export type TradeStatus =
  | "draft"
  | "planned"
  | "open"
  | "partial"
  | "closed";

export type TradeOutcome =
  | "open"
  | "win"
  | "loss"
  | "breakeven"
  | "partial_win"
  | "partial_loss"
  | "partial_breakeven";

export interface FinancialCalcResult {
  // Averages (VWAP)
  entryPriceAvg: string | null;
  exitPriceAvg: string | null;
  // Quantities (§19)
  entryQuantity: string; // Σ entry fills
  exitQuantity: string; // Σ exit fills
  remainingQuantity: string; // entry - exit
  matchedQuantity: string; // min(entry, exit) = realized portion
  // Distances
  stopDistance: string | null; // |entry - stop|
  targetDistance: string | null; // |target - entry|
  // §13 Planned R:R
  plannedRR: string | null; // targetDistance / stopDistance
  // §11 Risk
  riskPerUnitCents: number | null; // stopDistance × pointValueCents
  plannedRiskAmountCents: number | null; // riskPerUnit × entryQuantity (planned qty = entry qty)
  // Reward
  rewardPerUnitCents: number | null;
  plannedRewardAmountCents: number | null;
  // §10, §15 P&L (native = quote currency)
  grossPnlNativeCents: number; // Σ (directionalMove × exitQty × pointValue) per exit
  totalCostsCents: number; // fees + commission + swap + slippage
  netPnlNativeCents: number; // gross - costs
  // §28 Currency conversion
  nativeCurrency: string;
  convertedGrossPnlCents: number | null;
  convertedNetPnlCents: number | null;
  convertedRiskAmountCents: number | null;
  pnlAvailability: "AVAILABLE" | "UNAVAILABLE";
  // §14 Actual R
  actualR: string | null; // netPnl / plannedRisk
  // §20 Outcome
  status: TradeStatus;
  outcome: TradeOutcome;
}

// ---------------------------------------------------------------------------
// §7 POSITION SIZING
// ---------------------------------------------------------------------------

export interface PositionSizeInput {
  instrument: InstrumentEconomics;
  accountBalanceCents: number;
  accountCurrency: string;
  riskPct: string; // decimal (0.05 = 5%)
  entryPrice: string;
  stopPrice: string;
}

export interface PositionSizeResult {
  riskBudgetCents: number; // balance × riskPct
  stopDistance: string; // |entry - stop|
  riskPerUnitCents: number; // stopDistance × pointValueCents
  rawQuantity: string; // riskBudget / riskPerUnit
  quantityStep: string;
  roundedQuantity: string; // floor(raw / step) × step
  actualRiskCents: number; // roundedQuantity × riskPerUnit
  riskUtilizationPct: string; // actualRisk / balance (decimal)
  minimumTradableExceedsBudget: boolean;
  validationError: string | null;
}

// ---------------------------------------------------------------------------
// INTERNAL HELPERS — BigInt money arithmetic (§29 precision)
// ---------------------------------------------------------------------------

/** Convert a decimal price/qty string to a scaled BigInt integer. */
function toScaledBigInt(value: string | number | null | undefined, scale: number): bigint {
  if (value == null || value === "") return 0n;
  const s = typeof value === "number" ? String(value) : String(value).trim();
  if (s === "" || s === "-") return 0n;
  const neg = s.startsWith("-");
  const clean = neg ? s.slice(1) : s;
  const [intPart, fracPart = ""] = clean.split(".");
  const frac = (fracPart + "0".repeat(scale)).slice(0, scale);
  const combined = intPart + frac;
  const n = BigInt(combined || "0");
  return neg ? -n : n;
}

/** Convert a scaled BigInt back to a decimal string. */
function fromScaledBigInt(value: bigint, scale: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const s = abs.toString().padStart(scale + 1, "0");
  const intPart = s.slice(0, -scale) || "0";
  const fracPart = scale > 0 ? s.slice(-scale) : "";
  let result = fracPart ? `${intPart}.${fracPart}` : intPart;
  // strip trailing zeros
  if (fracPart) {
    result = result.replace(/(\.\d*?)0+$/, "$1");
    if (result.endsWith(".")) result = result.slice(0, -1);
  }
  return neg && result !== "0" ? `-${result}` : result;
}

/** Banker's rounding (round-half-to-even) for BigInt division. */
function bankersRound(value: bigint, divisor: bigint): bigint {
  const sign = value < 0n ? -1n : 1n;
  const abs = value < 0n ? -value : value;
  const quotient = abs / divisor;
  const remainder = abs % divisor;
  const halfDivisor = divisor / 2n;
  const isHalf = remainder === halfDivisor && divisor % 2n === 0n;
  let rounded: bigint;
  if (isHalf) {
    // banker's: round to even
    rounded = quotient % 2n === 0n ? quotient : quotient + 1n;
  } else if (remainder * 2n > divisor) {
    rounded = quotient + 1n;
  } else {
    rounded = quotient;
  }
  return sign * rounded;
}

// ---------------------------------------------------------------------------
// §10 P&L CALCULATION — ONE CANONICAL PATH
// ---------------------------------------------------------------------------

/**
 * Calculate trade metrics: P&L, R:R, actual R, outcome, status.
 *
 * Formula (§10):
 *   grossPnl = directionalMove × realizedQuantity × pointValueCents
 *
 * For partial exits (§17-18): each exit is calculated independently against
 * the avg entry price, then summed.
 */
export function calculateTradeMetrics(
  input: FinancialCalcInput,
): FinancialCalcResult {
  const { instrument, direction, fills } = input;

  const entries = fills.filter((f) => f.kind === "entry");
  const exits = fills.filter((f) => f.kind === "exit");

  // VWAP averages
  const entryPriceAvg = vwap(entries);
  const exitPriceAvg = vwap(exits);

  // Quantities
  const entryQty = sumQty(entries);
  const exitQty = sumQty(exits);
  const remainingQty = subDecimal(entryQty, exitQty);
  const matchedQty = minDecimal(entryQty, exitQty);

  // Distances
  const stopDistance = absDistance(
    input.plannedEntryPrice,
    input.plannedStopPrice,
  );
  const targetDistance = absDistance(
    input.plannedEntryPrice,
    input.plannedTargetPrice,
  );

  // §13 Planned R:R = rewardDistance / riskDistance
  const plannedRR =
    stopDistance && targetDistance
      ? divDecimal(targetDistance, stopDistance)
      : null;

  // §11 Risk per unit = stopDistance × pointValueCents
  const riskPerUnitCents =
    stopDistance != null
      ? mulPricePointValueToCents(stopDistance, instrument.pointValueCents)
      : null;

  // §11 Planned risk = riskPerUnit × entryQuantity (the planned qty = what was entered)
  const plannedRiskAmountCents =
    riskPerUnitCents != null && !isZeroDecimal(entryQty)
      ? mulCentsQty(riskPerUnitCents, entryQty)
      : null;

  // Reward per unit = targetDistance × pointValueCents
  const rewardPerUnitCents =
    targetDistance != null
      ? mulPricePointValueToCents(targetDistance, instrument.pointValueCents)
      : null;

  const plannedRewardAmountCents =
    rewardPerUnitCents != null && !isZeroDecimal(entryQty)
      ? mulCentsQty(rewardPerUnitCents, entryQty)
      : null;

  // §10, §17-18 Gross P&L — sum of per-exit calculations against avg entry
  let grossPnlNativeCents = 0;
  if (entryPriceAvg && exitPriceAvg && !isZeroDecimal(exitQty)) {
    // §17: each exit independently calculated. For the avg-cost method,
    // this is equivalent to: (exitAvg - entryAvg) × exitQty × pointValue
    // BUT for true per-execution accuracy we sum each exit's P&L.
    let cumulative = 0n;
    for (const exit of exits) {
      const exitP = toScaledBigInt(exit.price, 10);
      const entryP = toScaledBigInt(entryPriceAvg, 10);
      const exitQ = toScaledBigInt(exit.quantity, 10);
      const pv = BigInt(instrument.pointValueCents);
      // directionalMove = (long) exit - entry; (short) entry - exit
      const move =
        direction === "long" ? exitP - entryP : entryP - exitP;
      // gross = move × exitQty × pointValueCents, scaled properly
      // move has scale 10, exitQty has scale 10, pv has scale 2 (cents)
      // product scale = 10+10+2 = 22; we want cents (scale 2), so divide by 10^20
      const product = move * exitQ * pv;
      const cents = bankersRound(product, BigInt(10) ** 20n);
      cumulative += cents;
    }
    grossPnlNativeCents = Number(cumulative);
  }

  // §15 Costs
  const totalCostsCents =
    (input.feesCents || 0) +
    (input.commissionCents || 0) +
    (input.swapCents || 0) +
    (input.slippageCents || 0);

  // §15 Net = gross - costs
  const netPnlNativeCents = grossPnlNativeCents - totalCostsCents;

  // §28 Currency conversion (native → account)
  const nativeCurrency = instrument.quoteCurrency;
  const conversionRequired =
    nativeCurrency !== input.accountCurrency;
  let convertedGrossPnlCents: number | null;
  let convertedNetPnlCents: number | null;
  let convertedRiskAmountCents: number | null;
  let pnlAvailability: "AVAILABLE" | "UNAVAILABLE";

  if (!conversionRequired) {
    // §2.4 IDENTITY conversion
    convertedGrossPnlCents = grossPnlNativeCents;
    convertedNetPnlCents = netPnlNativeCents;
    convertedRiskAmountCents = plannedRiskAmountCents;
    pnlAvailability = "AVAILABLE";
  } else if (
    input.conversionRate != null &&
    input.conversionDirection != null
  ) {
    const rate = input.conversionRate;
    const dir = input.conversionDirection;
    convertedGrossPnlCents = applyConversion(
      grossPnlNativeCents,
      rate,
      dir,
    );
    convertedNetPnlCents = applyConversion(
      netPnlNativeCents,
      rate,
      dir,
    );
    convertedRiskAmountCents =
      plannedRiskAmountCents != null
        ? applyConversion(plannedRiskAmountCents, rate, dir)
        : null;
    pnlAvailability = "AVAILABLE";
  } else {
    convertedGrossPnlCents = null;
    convertedNetPnlCents = null;
    convertedRiskAmountCents = null;
    pnlAvailability = "UNAVAILABLE";
  }

  // §14 Actual R = netPnl / plannedRisk (both in account currency)
  let actualR: string | null = null;
  if (
    convertedNetPnlCents != null &&
    convertedRiskAmountCents != null &&
    convertedRiskAmountCents > 0
  ) {
    const n = BigInt(convertedNetPnlCents);
    const d = BigInt(convertedRiskAmountCents);
    // ratio = n / d, scaled to 6 decimal places
    const scaled = (n * BigInt(10) ** 6n) / d;
    const sign = scaled < 0n ? "-" : "";
    const abs = scaled < 0n ? -scaled : scaled;
    const s = abs.toString().padStart(7, "0");
    const intPart = s.slice(0, -6) || "0";
    const fracPart = s.slice(-6).replace(/0+$/, "");
    actualR = fracPart
      ? `${sign}${intPart}.${fracPart}`
      : `${sign}${intPart}`;
  }

  // §20 Outcome / Status
  const { status, outcome } = deriveStatusAndOutcome(
    entryQty,
    exitQty,
    remainingQty,
    convertedNetPnlCents,
    pnlAvailability,
  );

  return {
    entryPriceAvg,
    exitPriceAvg,
    entryQuantity: entryQty,
    exitQuantity: exitQty,
    remainingQuantity: remainingQty,
    matchedQuantity: matchedQty,
    stopDistance,
    targetDistance,
    plannedRR,
    riskPerUnitCents,
    plannedRiskAmountCents,
    rewardPerUnitCents,
    plannedRewardAmountCents,
    grossPnlNativeCents,
    totalCostsCents,
    netPnlNativeCents,
    nativeCurrency,
    convertedGrossPnlCents,
    convertedNetPnlCents,
    convertedRiskAmountCents,
    pnlAvailability,
    actualR,
    status,
    outcome,
  };
}

// ---------------------------------------------------------------------------
// §7 POSITION SIZING — universal formula
// ---------------------------------------------------------------------------

/**
 * Universal position-sizing formula (§7):
 *   riskBudget = balance × riskPct
 *   riskPerUnit = stopDistance × pointValueCents
 *   rawQuantity = riskBudget / riskPerUnit
 *   actualQuantity = floor(rawQuantity / quantityStep) × quantityStep
 */
export function calculatePositionSize(
  input: PositionSizeInput,
): PositionSizeResult {
  const { instrument, accountBalanceCents, riskPct, entryPrice, stopPrice } =
    input;

  // §34 Validation: negative or >100% risk
  const riskPctNum = Number(riskPct);
  if (riskPctNum < 0) {
    return {
      riskBudgetCents: 0,
      stopDistance: "0",
      riskPerUnitCents: 0,
      rawQuantity: "0",
      quantityStep: instrument.quantityStep,
      roundedQuantity: "0",
      actualRiskCents: 0,
      riskUtilizationPct: "0",
      minimumTradableExceedsBudget: false,
      validationError: "VALIDATION ERROR: Risk percentage cannot be negative.",
    };
  }
  if (riskPctNum > 1) {
    return {
      riskBudgetCents: 0,
      stopDistance: "0",
      riskPerUnitCents: 0,
      rawQuantity: "0",
      quantityStep: instrument.quantityStep,
      roundedQuantity: "0",
      actualRiskCents: 0,
      riskUtilizationPct: "0",
      minimumTradableExceedsBudget: false,
      validationError:
        "VALIDATION ERROR: Risk percentage cannot exceed 100%.",
    };
  }

  // §7 riskBudget = balance × riskPct
  const riskBudgetCents = Math.round(
    accountBalanceCents * riskPctNum,
  );

  // §33 Handle 0% risk (no division by zero)
  if (riskPctNum === 0 || riskBudgetCents === 0) {
    return {
      riskBudgetCents: 0,
      stopDistance: "0",
      riskPerUnitCents: 0,
      rawQuantity: "0",
      quantityStep: instrument.quantityStep,
      roundedQuantity: "0",
      actualRiskCents: 0,
      riskUtilizationPct: "0",
      minimumTradableExceedsBudget: false,
      validationError: null,
    };
  }

  // stopDistance = |entry - stop|
  const stopDistance = absDistance(entryPrice, stopPrice);
  if (stopDistance == null || stopDistance === "0") {
    return {
      riskBudgetCents,
      stopDistance: "0",
      riskPerUnitCents: 0,
      rawQuantity: "0",
      quantityStep: instrument.quantityStep,
      roundedQuantity: "0",
      actualRiskCents: 0,
      riskUtilizationPct: "0",
      minimumTradableExceedsBudget: false,
      validationError: "VALIDATION ERROR: Stop distance is zero.",
    };
  }

  // §7 riskPerUnit = stopDistance × pointValueCents
  const riskPerUnitCents = mulPricePointValueToCents(
    stopDistance,
    instrument.pointValueCents,
  );
  if (riskPerUnitCents === 0) {
    return {
      riskBudgetCents,
      stopDistance,
      riskPerUnitCents: 0,
      rawQuantity: "0",
      quantityStep: instrument.quantityStep,
      roundedQuantity: "0",
      actualRiskCents: 0,
      riskUtilizationPct: "0",
      minimumTradableExceedsBudget: false,
      validationError: null,
    };
  }

  // §7 rawQuantity = riskBudget / riskPerUnit
  const rawQuantity = divCentsQty(riskBudgetCents, riskPerUnitCents);

  // §30 Quantity step flooring
  const roundedQuantity = floorToStep(rawQuantity, instrument.quantityStep);

  // §31 Minimum quantity check
  const minExceeds = cmpDecimal(roundedQuantity, instrument.minimumQuantity) < 0;

  // actualRisk = roundedQuantity × riskPerUnit
  const actualRiskCents = isZeroDecimal(roundedQuantity)
    ? 0
    : mulCentsQty(riskPerUnitCents, roundedQuantity);

  // riskUtilization = actualRisk / balance
  const riskUtilizationPct =
    accountBalanceCents > 0
      ? fromScaledBigInt(
          bankersRound(
            BigInt(actualRiskCents) * BigInt(10) ** 6n,
            BigInt(accountBalanceCents),
          ),
          6,
        )
      : "0";

  return {
    riskBudgetCents,
    stopDistance,
    riskPerUnitCents,
    rawQuantity,
    quantityStep: instrument.quantityStep,
    roundedQuantity: minExceeds ? "0" : roundedQuantity,
    actualRiskCents,
    riskUtilizationPct,
    minimumTradableExceedsBudget: minExceeds,
    validationError: minExceeds
      ? "WARNING: Minimum tradable quantity exceeds risk budget."
      : null,
  };
}

// ---------------------------------------------------------------------------
// §21-27 ANALYTICS — single authoritative aggregation
// ---------------------------------------------------------------------------

export interface TradeMetricRow {
  id: string;
  netPnlCents: number; // converted to account currency
  grossPnlCents: number;
  actualR: string | null;
  status: string;
  outcome: TradeOutcome;
  exitTime: string | null;
  entryTime: string | null;
  instrumentSymbol: string;
  direction: string;
  setupGrade?: string | null;
  session?: string | null;
  strategyId?: string | null;
  strategyVersionId?: string | null;
  behaviorFlags?: string[];
  psychTags?: string[];
  ruleCompliant?: boolean;
}

export interface AggregateMetrics {
  // Counts
  totalTrades: number;
  closedTrades: number;
  partialTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  partialWins: number;
  partialLosses: number;
  partialBreakevens: number;
  // §22 Win rate (closed only, breakeven excluded from numerator)
  winRate: string | null; // wins / (wins + losses), breakeven excluded
  breakevenRate: string | null;
  // §23-24 P&L
  netPnlCents: number;
  grossPnlCents: number;
  grossProfitCents: number;
  grossLossCents: number; // negative
  // §23 Profit factor
  profitFactor: string | null;
  // §24 Expectancy
  expectancyCents: number | null;
  expectancyR: string | null;
  avgWinCents: number | null;
  avgLossCents: number | null;
  avgR: string | null;
  largestWinCents: number | null;
  largestLossCents: number | null;
  // §14 R metrics
  totalR: string | null;
  // §25-26 Drawdown (single account only; null for all-accounts)
  maxDrawdownCents: number | null;
  currentDrawdownCents: number | null;
  drawdownPct: string | null;
  // Streaks (§14)
  currentWinStreak: number;
  currentLossStreak: number;
  maxWinStreak: number;
  maxLossStreak: number;
  // Equity
  equityCents: number | null;
  // Unavailable
  unavailablePnlCount: number;
}

/**
 * Compute aggregate metrics from a list of trade metric rows.
 * Population: closedTrades = WIN+LOSS+BREAKEVEN; partialTrades = PARTIAL_*.
 * Drawdown requires startingBalanceCents (null for all-accounts aggregate).
 */
export function computeAggregateMetrics(
  trades: TradeMetricRow[],
  startingBalanceCents: number | null,
): AggregateMetrics {
  // §21 Populations
  const closed = trades.filter((t) =>
    ["win", "loss", "breakeven"].includes(t.outcome),
  );
  const partial = trades.filter((t) =>
    ["partial_win", "partial_loss", "partial_breakeven"].includes(t.outcome),
  );
  const open = trades.filter((t) => t.outcome === "open");

  const wins = closed.filter((t) => t.outcome === "win");
  const losses = closed.filter((t) => t.outcome === "loss");
  const breakevens = closed.filter((t) => t.outcome === "breakeven");
  const partialWins = partial.filter((t) => t.outcome === "partial_win");
  const partialLosses = partial.filter((t) => t.outcome === "partial_loss");
  const partialBes = partial.filter((t) => t.outcome === "partial_breakeven");

  // Financial aggregation uses closed + partial (realized P&L)
  const realized = [...closed, ...partial];
  const available = realized.filter(
    (t) => t.netPnlCents != null && Number.isFinite(t.netPnlCents),
  );
  const unavailable = realized.filter(
    (t) => t.netPnlCents == null || !Number.isFinite(t.netPnlCents),
  );

  // §22 Win rate = wins / (wins + losses) — breakeven excluded
  const winRate =
    wins.length + losses.length > 0
      ? fromScaledBigInt(
          bankersRound(
            BigInt(wins.length) * BigInt(10) ** 6n,
            BigInt(wins.length + losses.length),
          ),
          6,
        )
      : null;

  const breakevenRate =
    closed.length > 0
      ? fromScaledBigInt(
          bankersRound(
            BigInt(breakevens.length) * BigInt(10) ** 6n,
            BigInt(closed.length),
          ),
          6,
        )
      : null;

  // §23 P&L
  const netPnlCents = available.reduce((s, t) => s + t.netPnlCents, 0);
  const grossPnlCents = available.reduce(
    (s, t) => s + t.grossPnlCents,
    0,
  );
  const grossProfitCents = available
    .filter((t) => t.netPnlCents > 0)
    .reduce((s, t) => s + t.netPnlCents, 0);
  const grossLossCents = available
    .filter((t) => t.netPnlCents < 0)
    .reduce((s, t) => s + t.netPnlCents, 0);

  // §23 Profit factor = grossProfit / |grossLoss|
  let profitFactor: string | null = null;
  if (grossProfitCents === 0 && grossLossCents === 0) {
    profitFactor = null;
  } else if (grossLossCents === 0) {
    profitFactor = "Infinity";
  } else {
    profitFactor = fromScaledBigInt(
      bankersRound(
        BigInt(Math.abs(grossProfitCents)) * BigInt(10) ** 6n,
        BigInt(Math.abs(grossLossCents)),
      ),
      6,
    );
  }

  // §24 Expectancy = Σ netPnl / closedCount
  const closedAvailable = available.filter((t) =>
    ["win", "loss", "breakeven"].includes(t.outcome),
  );
  const expectancyCents =
    closedAvailable.length > 0
      ? Math.round(
          closedAvailable.reduce((s, t) => s + t.netPnlCents, 0) /
            closedAvailable.length,
        )
      : null;

  // §24 Expectancy R
  const rValues = closedAvailable
    .map((t) => t.actualR)
    .filter((r): r is string => r != null && r !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const expectancyR =
    rValues.length > 0
      ? fromScaledBigInt(
          bankersRound(
            BigInt(Math.round(rValues.reduce((s, n) => s + n, 0) * 1e6)),
            BigInt(rValues.length),
          ),
          6,
        )
      : null;

  // Avg win / loss
  const avgWinCents =
    wins.length > 0
      ? Math.round(
          wins.reduce((s, t) => s + t.netPnlCents, 0) / wins.length,
        )
      : null;
  const avgLossCents =
    losses.length > 0
      ? Math.round(
          losses.reduce((s, t) => s + t.netPnlCents, 0) / losses.length,
        )
      : null;

  // Avg R
  const avgR =
    rValues.length > 0
      ? fromScaledBigInt(
          bankersRound(
            BigInt(
              Math.round(
                (rValues.reduce((s, n) => s + n, 0) / rValues.length) * 1e6,
              ),
            ),
            BigInt(1),
          ),
          6,
        )
      : null;

  // Largest win / loss
  const largestWinCents =
    wins.length > 0
      ? Math.max(...wins.map((t) => t.netPnlCents))
      : null;
  const largestLossCents =
    losses.length > 0
      ? Math.min(...losses.map((t) => t.netPnlCents))
      : null;

  // Total R
  const totalR =
    rValues.length > 0
      ? fromScaledBigInt(
          BigInt(Math.round(rValues.reduce((s, n) => s + n, 0) * 1e6)),
          6,
        )
      : null;

  // §25-26 Equity curve + drawdown (single account only)
  let maxDrawdownCents: number | null = null;
  let currentDrawdownCents: number | null = null;
  let drawdownPct: string | null = null;
  let equityCents: number | null = null;

  if (startingBalanceCents != null) {
    // Order by exitTime ASC
    const ordered = [...available]
      .filter((t) => t.exitTime)
      .sort(
        (a, b) =>
          new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime(),
      );

    let equity = startingBalanceCents;
    let peak = startingBalanceCents;
    let maxDD = 0;
    for (const t of ordered) {
      equity += t.netPnlCents;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDD) maxDD = dd;
    }
    maxDrawdownCents = maxDD;
    currentDrawdownCents = peak - equity;
    drawdownPct =
      peak > 0
        ? fromScaledBigInt(
            bankersRound(
              BigInt(currentDrawdownCents) * BigInt(10) ** 6n,
              BigInt(peak),
            ),
            6,
          )
        : null;
    equityCents = equity;
  }

  // §14 Streaks — closed trades ordered by exitTime ASC
  const closedOrdered = [...closed]
    .filter((t) => t.exitTime)
    .sort(
      (a, b) =>
        new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime(),
    );

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  // Walk backwards from most recent
  for (let i = closedOrdered.length - 1; i >= 0; i--) {
    const t = closedOrdered[i];
    if (t.outcome === "win") {
      currentWinStreak++;
    } else {
      break;
    }
  }
  for (let i = closedOrdered.length - 1; i >= 0; i--) {
    const t = closedOrdered[i];
    if (t.outcome === "loss") {
      currentLossStreak++;
    } else {
      break;
    }
  }

  // Max streaks
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let runWin = 0;
  let runLoss = 0;
  for (const t of closedOrdered) {
    if (t.outcome === "win") {
      runWin++;
      runLoss = 0;
      if (runWin > maxWinStreak) maxWinStreak = runWin;
    } else if (t.outcome === "loss") {
      runLoss++;
      runWin = 0;
      if (runLoss > maxLossStreak) maxLossStreak = runLoss;
    } else {
      // breakeven resets both
      runWin = 0;
      runLoss = 0;
    }
  }

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    partialTrades: partial.length,
    openTrades: open.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    partialWins: partialWins.length,
    partialLosses: partialLosses.length,
    partialBreakevens: partialBes.length,
    winRate,
    breakevenRate,
    netPnlCents,
    grossPnlCents,
    grossProfitCents,
    grossLossCents,
    profitFactor,
    expectancyCents,
    expectancyR,
    avgWinCents,
    avgLossCents,
    avgR,
    largestWinCents,
    largestLossCents,
    totalR,
    maxDrawdownCents,
    currentDrawdownCents,
    drawdownPct,
    currentWinStreak,
    currentLossStreak,
    maxWinStreak,
    maxLossStreak,
    equityCents,
    unavailablePnlCount: unavailable.length,
  };
}

// ---------------------------------------------------------------------------
// INTERNAL: decimal arithmetic helpers (string-based, no float drift)
// ---------------------------------------------------------------------------

function vwap(fills: ExecutionFill[]): string | null {
  if (fills.length === 0) return null;
  let pq = 0;
  let q = 0;
  for (const f of fills) {
    const p = Number(f.price);
    const qt = Number(f.quantity);
    if (!Number.isFinite(p) || !Number.isFinite(qt)) continue;
    pq += p * qt;
    q += qt;
  }
  if (q === 0) return null;
  return normalizeDecimal(+(pq / q).toFixed(10));
}

function sumQty(fills: ExecutionFill[]): string {
  let s = 0;
  for (const f of fills) s += Number(f.quantity);
  return normalizeDecimal(+s.toFixed(10));
}

function normalizeDecimal(v: number | string): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "0";
  let s = String(n);
  if (s.includes(".")) {
    s = s.replace(/(\.\d*?)0+$/, "$1");
    if (s.endsWith(".")) s = s.slice(0, -1);
  }
  return s === "-0" ? "0" : s;
}

function subDecimal(a: string, b: string): string {
  return normalizeDecimal(+(Number(a) - Number(b)).toFixed(10));
}

function minDecimal(a: string, b: string): string {
  return Number(a) <= Number(b) ? a : b;
}

function isZeroDecimal(a: string): boolean {
  return Number(a) === 0;
}

function cmpDecimal(a: string, b: string): number {
  const an = Number(a);
  const bn = Number(b);
  if (an < bn) return -1;
  if (an > bn) return 1;
  return 0;
}

function divDecimal(a: string, b: string): string | null {
  const bn = Number(b);
  if (bn === 0 || !Number.isFinite(bn)) return null;
  return normalizeDecimal(+(Number(a) / bn).toFixed(10));
}

function absDistance(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (a == null || b == null || a === "" || b === "") return null;
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isFinite(an) || !Number.isFinite(bn)) return null;
  const diff = Math.abs(an - bn);
  return normalizeDecimal(+diff.toFixed(10));
}

/**
 * Multiply a price decimal × pointValueCents → cents.
 * price has up to 10 dp, pointValueCents is integer (cents).
 * Result: cents (integer, banker's rounded).
 */
function mulPricePointValueToCents(
  price: string,
  pointValueCents: number,
): number {
  const priceN = Number(price);
  if (!Number.isFinite(priceN)) return 0;
  // price × pointValueCents = cents
  // Use scaled BigInt for precision
  const priceScaled = toScaledBigInt(price, 10);
  const pv = BigInt(pointValueCents);
  const product = priceScaled * pv;
  // scale: price(10) × cents(0) → result scale 10; divide by 10^10 to get cents
  return Number(bankersRound(product, BigInt(10) ** 10n));
}

/**
 * Multiply cents × quantity decimal → cents.
 * cents is integer, quantity has up to 10 dp.
 */
function mulCentsQty(cents: number, quantity: string): number {
  const qtyScaled = toScaledBigInt(quantity, 10);
  const c = BigInt(cents);
  const product = c * qtyScaled;
  return Number(bankersRound(product, BigInt(10) ** 10n));
}

/**
 * Divide cents by cents-per-unit → quantity (decimal string).
 */
function divCentsQty(cents: number, perUnitCents: number): string {
  if (perUnitCents === 0) return "0";
  const c = BigInt(cents);
  const p = BigInt(perUnitCents);
  // scaled to 10 dp: (c × 10^10) / p
  const scaled = (c * BigInt(10) ** 10n) / p;
  return fromScaledBigInt(scaled, 10);
}

/**
 * Floor a decimal quantity to the nearest step.
 * Example: 1.237 with step 0.01 → 1.23 (NOT 1.24).
 */
function floorToStep(quantity: string, step: string): string {
  const qn = Number(quantity);
  const sn = Number(step);
  if (!Number.isFinite(qn) || !Number.isFinite(sn) || sn <= 0) return "0";
  const floored = Math.floor(qn / sn) * sn;
  // Round to step's decimal places to avoid float drift
  const stepDp = (step.split(".")[1] || "").length;
  return normalizeDecimal(+floored.toFixed(stepDp));
}

/**
 * Apply currency conversion to a cents value.
 */
function applyConversion(
  cents: number,
  rate: number,
  direction: "IDENTITY" | "MULTIPLY" | "DIVIDE",
): number {
  if (direction === "IDENTITY") return cents;
  if (direction === "MULTIPLY") {
    return Math.round(cents * rate);
  }
  // DIVIDE
  if (rate === 0) return 0;
  return Math.round(cents / rate);
}

// ---------------------------------------------------------------------------
// §20 STATUS / OUTCOME DERIVATION
// ---------------------------------------------------------------------------

function deriveStatusAndOutcome(
  entryQty: string,
  exitQty: string,
  remainingQty: string,
  convertedNetPnlCents: number | null,
  pnlAvailability: "AVAILABLE" | "UNAVAILABLE",
): { status: TradeStatus; outcome: TradeOutcome } {
  const hasEntry = !isZeroDecimal(entryQty);
  const hasExit = !isZeroDecimal(exitQty);
  const hasRemaining = !isZeroDecimal(remainingQty);

  if (!hasEntry && !hasExit) {
    return { status: "draft", outcome: "open" };
  }
  if (!hasExit) {
    return { status: "open", outcome: "open" };
  }

  // Has exits
  const isPartial = hasRemaining;

  // For UNAVAILABLE P&L, fall back to breakeven classification
  const pnlSign =
    convertedNetPnlCents == null
      ? 0
      : convertedNetPnlCents > 0
        ? 1
        : convertedNetPnlCents < 0
          ? -1
          : 0;

  if (isPartial) {
    const status: TradeStatus = "partial";
    const outcome: TradeOutcome =
      pnlSign > 0
        ? "partial_win"
        : pnlSign < 0
          ? "partial_loss"
          : "partial_breakeven";
    return { status, outcome };
  }

  // Fully closed
  const status: TradeStatus = "closed";
  const outcome: TradeOutcome =
    pnlSign > 0 ? "win" : pnlSign < 0 ? "loss" : "breakeven";
  return { status, outcome };
}

// ---------------------------------------------------------------------------
// §35 DEBUG VIEW — expose all calculation intermediates
// ---------------------------------------------------------------------------

export interface DebugCalculationView {
  // Instrument
  instrumentSymbol: string;
  assetClass: AssetClass;
  quoteCurrency: string;
  accountCurrency: string;
  // Plan
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string | null;
  quantity: string;
  // Instrument economics
  contractSize: string;
  pointValueCents: number;
  tickSize: string;
  tickValueCents: number;
  pipSize: string | null;
  pipValueCents: number | null;
  // Distances
  stopDistance: string | null;
  riskBudgetCents: number | null;
  riskPerUnitCents: number | null;
  plannedRiskCents: number | null;
  rewardDistance: string | null;
  plannedRewardCents: number | null;
  plannedRR: string | null;
  // P&L
  grossPnlCents: number;
  feesCents: number;
  commissionCents: number;
  slippageCents: number;
  swapCents: number;
  totalCostsCents: number;
  netPnlCents: number;
  // R
  initialRiskCents: number | null;
  actualR: string | null;
  // Currency
  nativeCurrency: string;
  conversionRequired: boolean;
  conversionRate: number | null;
  convertedNetPnlCents: number | null;
  pnlAvailability: "AVAILABLE" | "UNAVAILABLE";
}

export function buildDebugView(
  input: FinancialCalcInput,
  result: FinancialCalcResult,
): DebugCalculationView {
  const { instrument } = input;
  const tickValueCents = Math.round(
    Number(instrument.tickSize) * instrument.pointValueCents,
  );
  const pipValueCents =
    instrument.pipSize != null
      ? Math.round(
          Number(instrument.pipSize) * instrument.pointValueCents,
        )
      : null;
  return {
    instrumentSymbol: instrument.symbol,
    assetClass: instrument.assetClass,
    quoteCurrency: instrument.quoteCurrency,
    accountCurrency: input.accountCurrency,
    entryPrice: input.plannedEntryPrice,
    stopPrice: input.plannedStopPrice,
    targetPrice: input.plannedTargetPrice,
    quantity: result.entryQuantity,
    contractSize: instrument.contractSize,
    pointValueCents: instrument.pointValueCents,
    tickSize: instrument.tickSize,
    tickValueCents,
    pipSize: instrument.pipSize,
    pipValueCents,
    stopDistance: result.stopDistance,
    riskBudgetCents: result.plannedRiskAmountCents,
    riskPerUnitCents: result.riskPerUnitCents,
    plannedRiskCents: result.plannedRiskAmountCents,
    rewardDistance: result.targetDistance,
    plannedRewardCents: result.plannedRewardAmountCents,
    plannedRR: result.plannedRR,
    grossPnlCents: result.grossPnlNativeCents,
    feesCents: input.feesCents,
    commissionCents: input.commissionCents,
    slippageCents: input.slippageCents,
    swapCents: input.swapCents,
    totalCostsCents: result.totalCostsCents,
    netPnlCents: result.netPnlNativeCents,
    initialRiskCents: result.convertedRiskAmountCents,
    actualR: result.actualR,
    nativeCurrency: result.nativeCurrency,
    conversionRequired: instrument.quoteCurrency !== input.accountCurrency,
    conversionRate: input.conversionRate ?? null,
    convertedNetPnlCents: result.convertedNetPnlCents,
    pnlAvailability: result.pnlAvailability,
  };
}


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Cents = number;


export interface TradeCalcInput {
  direction: Direction;
  plannedEntryPrice?: Decimal | null;
  plannedStopPrice?: Decimal | null;
  plannedTargetPrice?: Decimal | null;
  fills: ExecutionFill[];
  feesCents?: Cents;
  commissionCents?: Cents;
  swapCents?: Cents;
  slippageCents?: Cents;
  contractSize?: Decimal; // e.g. 100000 for standard forex lot
  pipSize?: Decimal; // e.g. 0.0001 for forex
  /**
   * Value per 1.0 price unit per 1.0 quantity, in cents.
   * Defaults to 100 (i.e. $1 per 1.0 price move per 1.0 qty) — backward compatible
   * with the original hardcoded behaviour for stocks/crypto where price * qty
   * directly equals the dollar P&L. Callers may override this with an
   * instrument-derived value (see `computePointValueCents` below) so that
   * forex/metals/indices/futures whose "1.0 price move" semantics differ from
   * a 1-share stock are scaled correctly.
   */
  pointValueCents?: Cents;
}

/**
 * Compute the pointValueCents from instrument metadata.
 *
 * pointValueCents = monetary value (in cents) of a 1.0 price move per 1.0 quantity.
 *
 * For futures: this is the dollar-per-point value (e.g. NQ = $20/point = 2000 cents).
 * For forex: this is contractSize × 100 (e.g. 100,000 × $1 = $100,000 = 10,000,000 cents).
 * For stocks/crypto: 100 ($1 per $1 move).
 *
 * The old implementation computed TICK value (tickSize × contractSize × 100)
 * and mislabeled it as pointValueCents. This is now corrected.
 */
export function computePointValueCents(
  contractSize: string | number | null | undefined,
  tickSize: string | number | null | undefined,
  pipSize: string | number | null | undefined,
): Cents {
  const cs = Number(contractSize ?? "1");
  if (!Number.isFinite(cs) || cs <= 0) return 100;

  // For forex (cs = 100000): pointValueCents = cs × 100 = 10,000,000
  // For gold (cs = 100): pointValueCents = cs × 100 = 10,000
  // For futures NQ (cs = 20, $20/point): pointValueCents = cs × 100 = 2000
  // For futures ES (cs = 50, $50/point): pointValueCents = cs × 100 = 5000
  // For crypto/stocks (cs = 1): pointValueCents = 100
  const cents = Math.round(cs * 100);
  if (!Number.isFinite(cents) || cents <= 0) return 100;
  return cents;
}

export interface TradeCalcResult {
  entryPriceAvg: Decimal | null;
  exitPriceAvg: Decimal | null;
  totalQuantity: Decimal | null;
  grossPnlCents: Cents;
  totalCostsCents: Cents;
  netPnlCents: Cents;
  stopDistance: Decimal | null;
  targetDistance: Decimal | null;
  plannedRR: Decimal | null;
  actualR: Decimal | null;
  riskAmountCents: Cents | null;
  rewardAmountCents: Cents | null;
  status: TradeStatus;
}

// ---------------------------------------------------------------------------
// Psychology tag parsing (spec section 22 — psychBeforeJson shape)
// ---------------------------------------------------------------------------

/**
 * Extract mood-tag strings from a `psychBeforeJson` (or `psychAfterJson`)
 * column. The column is stored as a JSON **object** whose `moodTags` field is
 * an array of strings (per spec section 38), but legacy rows may store a
 * bare array — both shapes are supported. Any other shape yields `[]`.
 *
 * Never throws: malformed JSON, null, or unexpected shapes degrade to `[]`.
 */
export function safeParsePsychTags(json: string | null | undefined): string[] {
  if (!json) return [];
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return [];
  }
  if (Array.isArray(v)) {
    // Backward-compat: legacy rows stored a bare array of tags.
    return v.filter((x): x is string => typeof x === "string");
  }
  if (v && typeof v === "object") {
    const tags = (v as { moodTags?: unknown }).moodTags;
    if (Array.isArray(tags)) {
      return tags.filter((x): x is string => typeof x === "string");
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Equity curve (spec section 22)
// ---------------------------------------------------------------------------

export interface EquityPoint {
  date: string; // ISO date
  label: string;
  pnlCents: number;
  cumulativeCents: number;
  tradeId: string;
}

export function buildEquityCurve(trades: TradeMetricRow[], startingBalanceCents: number = 0): EquityPoint[] {
  // Use only closed trades (WIN/LOSS/BREAKEVEN), ordered by EXIT timestamp
  const sorted = [...trades]
    .filter((t) => (t.outcome === "win" || t.outcome === "loss" || t.outcome === "breakeven") && (t.exitTime || t.entryTime))
    .sort((a, b) => {
      const ad = a.exitTime ? new Date(a.exitTime).getTime() : (a.entryTime ? new Date(a.entryTime).getTime() : 0);
      const bd = b.exitTime ? new Date(b.exitTime).getTime() : (b.entryTime ? new Date(b.entryTime).getTime() : 0);
      return ad - bd;
    });

  const points: EquityPoint[] = [];
  let cumulative = startingBalanceCents;
  
  if (sorted.length > 0) {
    // Add the starting point 1 day before the first trade
    const firstDate = new Date(sorted[0].exitTime || sorted[0].entryTime!);
    const startDate = new Date(firstDate.getTime() - 24 * 60 * 60 * 1000);
    points.push({
      date: startDate.toISOString(),
      label: "Start",
      pnlCents: 0,
      cumulativeCents: startingBalanceCents,
      tradeId: "start",
    });
  }

  for (const t of sorted) {
    cumulative += t.netPnlCents;
    const d = new Date(t.exitTime || t.entryTime!);
    points.push({
      date: d.toISOString(),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pnlCents: t.netPnlCents,
      cumulativeCents: cumulative,
      tradeId: t.id,
    });
  }
  
  return points;
}

// ---------------------------------------------------------------------------
// Daily P&L aggregation (spec section 22)
// ---------------------------------------------------------------------------

export interface DailyPnlPoint {
  date: string;
  label: string;
  pnlCents: number;
  tradeCount: number;
}

export function buildDailyPnl(trades: TradeMetricRow[]): DailyPnlPoint[] {
  // Use only closed trades (WIN/LOSS/BREAKEVEN), grouped by EXIT timestamp
  const map = new Map<string, { pnl: number; count: number; ts: number }>();
  for (const t of trades) {
    if (t.outcome !== "win" && t.outcome !== "loss" && t.outcome !== "breakeven") continue;
    const ts = t.exitTime || t.entryTime;
    if (!ts) continue;
    const d = new Date(ts);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key) ?? { pnl: 0, count: 0, ts: d.getTime() };
    entry.pnl += t.netPnlCents;
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([date, e]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pnlCents: e.pnl,
      tradeCount: e.count,
    }));
}

// ---------------------------------------------------------------------------
// R distribution (spec section 22)
// ---------------------------------------------------------------------------

export interface RDistributionBucket {
  bucket: string;
  count: number;
  minR: number;
  maxR: number;
}

export function buildRDistribution(trades: TradeMetricRow[]): RDistributionBucket[] {
  const buckets: { min: number; max: number; label: string }[] = [
    { min: -Infinity, max: -2, label: "≤ -2R" },
    { min: -2, max: -1, label: "-2 to -1R" },
    { min: -1, max: 0, label: "-1 to 0R" },
    { min: 0, max: 0.0001, label: "BE" },
    { min: 0.0001, max: 1, label: "0 to +1R" },
    { min: 1, max: 2, label: "+1 to +2R" },
    { min: 2, max: Infinity, label: "≥ +2R" },
  ];
  return buckets.map((b) => {
    const count = trades.filter((t) => {
      if (t.actualR == null) return false;
      const r = dToNumber(t.actualR);
      if (b.min === 0 && b.max === 0.0001) return r === 0;
      if (b.min === -Infinity) return r <= b.max;
      if (b.max === Infinity) return r > b.min;
      return r > b.min && r <= b.max;
    }).length;
    return { bucket: b.label, count, minR: b.min, maxR: b.max };
  });
}

// ---------------------------------------------------------------------------
// Group-by analytics (spec sections 75, 76, 74)
// ---------------------------------------------------------------------------

export interface GroupBreakdown {
  key: string;
  label: string;
  trades: number;
  wins: number;
  winRate: Decimal | null;
  avgR: Decimal | null;
  expectancyR: Decimal | null;
  pnlCents: number;
}

export function groupBy<T extends TradeMetricRow>(
  trades: T[],
  keyFn: (t: T) => string | null | undefined,
  labelFn: (k: string) => string = (k) => k,
): GroupBreakdown[] {
  const groups = new Map<string, T[]>();
  for (const t of trades) {
    const k = keyFn(t);
    if (k == null) continue;
    const arr = groups.get(k) ?? [];
    arr.push(t);
    groups.set(k, arr);
  }
  return [...groups.entries()].map(([key, arr]) => {
    const m = computeAggregateMetrics(arr, null);
    return {
      key,
      label: labelFn(key),
      trades: m.totalTrades,
      wins: m.wins,
      winRate: m.winRate,
      avgR: m.avgR,
      expectancyR: m.expectancyR,
      pnlCents: m.netPnlCents,
    };
  }).sort((a, b) => b.trades - a.trades);
}

// ---------------------------------------------------------------------------
// Sample-size-aware insights (spec sections 23, 24, 137, 138)
// ---------------------------------------------------------------------------

export interface Insight {
  id: string;
  title: string;
  body: string;
  sampleSize: number;
  metric: string;
  bucketLabel: string;
  comparison?: string;
  tradeIds: string[];
  warning?: "low_sample" | "missing_data";
}

export function generateInsights(trades: TradeMetricRow[], minSample = 10): Insight[] {
  const insights: Insight[] = [];
  const closed = trades.filter((t) => t.outcome !== "open" );
  if (closed.length < minSample) {
    if (closed.length > 0) {
      insights.push({
        id: "low-sample",
        title: "Not enough data yet",
        body: `You have ${closed.length} closed trade${closed.length === 1 ? "" : "s"}. DnD starts generating statistical insights once you have at least ${minSample} closed trades, so patterns you see now may not be reliable.`,
        sampleSize: closed.length,
        metric: "samples",
        bucketLabel: "all",
        tradeIds: closed.map((t) => t.id),
        warning: "low_sample",
      });
    }
    return insights;
  }

  // Behavior flag insights
  const allFlags = new Set<string>();
  closed.forEach((t) => t.behaviorFlags?.forEach((f) => allFlags.add(f)));
  for (const flag of allFlags) {
    const withFlag = closed.filter((t) => t.behaviorFlags?.includes(flag));
    const withoutFlag = closed.filter((t) => !t.behaviorFlags?.includes(flag));
    if (withFlag.length < minSample) continue;
    const withR = withFlag.map((t) => t.actualR).filter((r): r is Decimal => r != null);
    const withoutR = withoutFlag.map((t) => t.actualR).filter((r): r is Decimal => r != null);
    if (withR.length === 0) continue;
    const withAvg = withR.reduce((s, r) => s + dToNumber(r), 0) / withR.length;
    const withoutAvg = withoutR.length > 0 ? withoutR.reduce((s, r) => s + dToNumber(r), 0) / withoutR.length : null;
    const flagLabel = humanizeFlag(flag);
    if (withoutAvg != null && Math.abs(withAvg - withoutAvg) > 0.05) {
      const direction = withAvg < withoutAvg ? "lower" : "higher";
      insights.push({
        id: `flag-${flag}`,
        title: `Trades tagged "${flagLabel}"`,
        body: `Trades tagged "${flagLabel}" have historically produced ${direction} average R (${withAvg.toFixed(2)}R across ${withFlag.length} trades) compared to ${withoutAvg.toFixed(2)}R across ${withoutFlag.length} trades without that flag.`,
        sampleSize: withFlag.length,
        metric: "avgR",
        bucketLabel: flagLabel,
        comparison: `vs ${withoutAvg.toFixed(2)}R`,
        tradeIds: withFlag.map((t) => t.id),
      });
    } else {
      insights.push({
        id: `flag-${flag}`,
        title: `Trades tagged "${flagLabel}"`,
        body: `Trades tagged "${flagLabel}" have an average realized R of ${withAvg.toFixed(2)}R across ${withFlag.length} trades.`,
        sampleSize: withFlag.length,
        metric: "avgR",
        bucketLabel: flagLabel,
        tradeIds: withFlag.map((t) => t.id),
      });
    }
  }

  // Session insights
  const sessions = groupBy(closed, (t) => t.session, (k) => sessionLabel(k));
  for (const s of sessions) {
    if (s.trades < minSample) continue;
    if (s.avgR == null) continue;
    insights.push({
      id: `session-${s.key}`,
      title: `${s.label} session`,
      body: `${s.label} trades have produced an average of ${dToNumber(s.avgR).toFixed(2)}R across ${s.trades} trades, with a ${dToNumber(s.winRate).toFixed(1)}% win rate.`,
      sampleSize: s.trades,
      metric: "avgR",
      bucketLabel: s.label,
      tradeIds: closed.filter((t) => t.session === s.key).map((t) => t.id),
    });
  }

  // A+ vs non-A+
  const aplus = closed.filter((t) => t.setupGrade === "A+");
  const nonAplus = closed.filter((t) => t.setupGrade && t.setupGrade !== "A+" && t.setupGrade !== "Invalid");
  if (aplus.length >= minSample && nonAplus.length >= minSample) {
    const aR = aplus.map((t) => t.actualR).filter((r): r is Decimal => r != null);
    const nR = nonAplus.map((t) => t.actualR).filter((r): r is Decimal => r != null);
    if (aR.length > 0 && nR.length > 0) {
      const aAvg = aR.reduce((s, r) => s + dToNumber(r), 0) / aR.length;
      const nAvg = nR.reduce((s, r) => s + dToNumber(r), 0) / nR.length;
      insights.push({
        id: "aplus-vs-non",
        title: "A+ vs non-A+ setups",
        body: `A+ setups have produced ${aAvg.toFixed(2)}R on average across ${aplus.length} trades, compared to ${nAvg.toFixed(2)}R across ${nonAplus.length} non-A+ trades.`,
        sampleSize: aplus.length + nonAplus.length,
        metric: "avgR",
        bucketLabel: "A+ vs non-A+",
        tradeIds: [...aplus, ...nonAplus].map((t) => t.id),
      });
    }
  }

  return insights.sort((a, b) => b.sampleSize - a.sampleSize);
}

function humanizeFlag(flag: string): string {
  return flag
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function sessionLabel(s: string): string {
  const map: Record<string, string> = {
    asia: "Asia",
    london: "London",
    ny_am: "New York AM",
    ny_pm: "New York PM",
    custom: "Custom",
  };
  return map[s] ?? s;
}

// ---------------------------------------------------------------------------
// Plan adherence (spec section 23 — planned vs actual execution)
// ---------------------------------------------------------------------------

/**
 * Result of comparing a trade's planned values against its actual execution.
 *
 * `adherenceScore` is a 0–1 number representing the fraction of binary checks
 * (session match, target hit, risk-within-tolerance, positive R achieved) that
 * passed. Checks that can't be evaluated (e.g. no planned session recorded, no
 * target price, no account balance) are excluded from the denominator — so a
 * trade with only one check evaluated and that check passed scores 1.0, not
 * 0.25. If no checks can be evaluated at all, the score is 0.
 */
export interface PlanAdherenceCheck {
  label: string;
  passed: boolean | null;
  detail?: string;
}

export interface PlanAdherence {
  plannedRR: Decimal | null;
  actualRR: Decimal | null;
  plannedRiskPct: Decimal | null;
  actualRiskPct: Decimal | null;
  sessionMatch: boolean | null;
  targetMatch: boolean | null;
  adherenceScore: number;
  adherencePct: number;
  checks: PlanAdherenceCheck[];
}

/**
 * Trade-shape accepted by `calculatePlanAdherence`. Accepts the loose shape
 * produced by Prisma's `Trade` row (decimal strings + nullable fields) plus an
 * optional `accountBalanceCents` so we can derive `actualRiskPct` from the
 * risk amount vs the account balance.
 */
export interface PlanAdherenceTrade {
  direction?: string | null;
  /** Actual session the trade was taken in (from `Trade.session`). */
  session?: string | null;
  /** Planned session (from `setupJson.session` or a daily plan). */
  plannedSession?: string | null;
  plannedEntryPrice?: Decimal | null;
  plannedStopPrice?: Decimal | null;
  plannedTargetPrice?: Decimal | null;
  plannedRiskPct?: Decimal | null;
  entryPriceAvg?: Decimal | null;
  exitPriceAvg?: Decimal | null;
  /** Pre-computed actual R (decimal string). */
  actualR?: Decimal | null;
  /** Risk amount in cents — typically from `calculateTradePnl.riskAmountCents`. */
  riskAmountCents?: number | null;
  /** Account balance in cents — used to derive `actualRiskPct`. */
  accountBalanceCents?: number | null;
}

/**
 * Compute plan adherence for a single trade. Pure function — no I/O.
 *
 * Binary checks (each 0/1 or null when undeterminable):
 *   - `sessionMatch`: planned session === actual session
 *   - `targetMatch`: |exitPrice - target| / |target| <= 5% (within 5% of target)
 *   - `riskWithinTolerance`: actual risk is within 50% of planned risk
 *     (ratio of actual/planned between 0.5 and 1.5)
 *   - `rrAchieved`: actualR > 0 (the trade was profitable)
 *
 * `adherenceScore` = mean of the non-null checks (or 0 if all null).
 */
export function calculatePlanAdherence(trade: PlanAdherenceTrade): PlanAdherence {
  // Planned R:R = |target - entry| / |entry - stop|
  let plannedRR: Decimal | null = null;
  if (trade.plannedEntryPrice && trade.plannedStopPrice && trade.plannedTargetPrice) {
    const stopDist = dAbs(dSub(trade.plannedEntryPrice, trade.plannedStopPrice));
    const targetDist = dAbs(dSub(trade.plannedTargetPrice, trade.plannedEntryPrice));
    if (!dIsZero(stopDist)) {
      plannedRR = dDiv(targetDist, stopDist);
    }
  }

  // Actual R: already computed server-side — normalize and pass through.
  const actualRR: Decimal | null =
    trade.actualR != null && trade.actualR !== "" ? dNormalize(trade.actualR) : null;

  // Planned risk %
  const plannedRiskPct: Decimal | null =
    trade.plannedRiskPct != null && trade.plannedRiskPct !== ""
      ? dNormalize(trade.plannedRiskPct)
      : null;

  // Actual risk %: riskAmount / accountBalance (if both available and balance > 0)
  let actualRiskPct: Decimal | null = null;
  if (
    trade.riskAmountCents != null &&
    trade.accountBalanceCents != null &&
    trade.accountBalanceCents > 0 &&
    trade.riskAmountCents >= 0
  ) {
    actualRiskPct = dDiv(
      String(trade.riskAmountCents / 100),
      String(trade.accountBalanceCents / 100),
    );
  }

  // Session match — null when either planned or actual session is missing.
  const plannedSession = trade.plannedSession ?? null;
  const actualSession = trade.session ?? null;
  const sessionMatch: boolean | null =
    plannedSession && actualSession ? plannedSession === actualSession : null;

  // Target match — exit price within 5% of planned target.
  let targetMatch: boolean | null = null;
  if (trade.exitPriceAvg && trade.plannedTargetPrice) {
    const exit = dToNumber(trade.exitPriceAvg);
    const target = dToNumber(trade.plannedTargetPrice);
    if (Number.isFinite(exit) && Number.isFinite(target) && target !== 0) {
      const deviation = Math.abs(exit - target) / Math.abs(target);
      targetMatch = deviation <= 0.05;
    }
  }

  // Risk-within-tolerance — actual risk is within 50% of planned risk
  // (i.e. ratio of actual/planned is between 0.5 and 1.5).
  let riskWithinTolerance: boolean | null = null;
  if (plannedRiskPct && actualRiskPct) {
    const planned = dToNumber(plannedRiskPct);
    const actual = dToNumber(actualRiskPct);
    if (planned > 0) {
      const ratio = actual / planned;
      riskWithinTolerance = ratio >= 0.5 && ratio <= 1.5;
    }
  }

  // R:R achieved — actualR > 0 (i.e. the trade was profitable).
  const rrAchieved: boolean | null =
    actualRR != null ? dToNumber(actualRR) > 0 : null;

  const checks: PlanAdherenceCheck[] = [
    {
      label: "Session match",
      passed: sessionMatch,
      detail:
        sessionMatch === null
          ? "No planned session recorded"
          : sessionMatch
            ? "Traded in the planned session"
            : "Traded outside the planned session",
    },
    {
      label: "Target hit",
      passed: targetMatch,
      detail:
        targetMatch === null
          ? "No target or exit price recorded"
          : targetMatch
            ? "Exit price within 5% of planned target"
            : "Exit price deviated more than 5% from target",
    },
    {
      label: "Risk within tolerance",
      passed: riskWithinTolerance,
      detail:
        riskWithinTolerance === null
          ? "Planned or actual risk unavailable"
          : riskWithinTolerance
            ? "Actual risk within 50% of planned risk"
            : "Actual risk outside 50% tolerance of planned risk",
    },
    {
      label: "Positive R achieved",
      passed: rrAchieved,
      detail:
        rrAchieved === null
          ? "No R-multiple computed"
          : rrAchieved
            ? "Trade was profitable (R > 0)"
            : "Trade was not profitable (R ≤ 0)",
    },
  ];

  // Adherence score: average of non-null binary checks. Each check contributes
  // 1 (passed) or 0 (failed); null checks are excluded from the denominator.
  const evaluatedChecks = checks
    .map((c) => c.passed)
    .filter((v): v is boolean => v !== null);
  const adherenceScore =
    evaluatedChecks.length > 0
      ? evaluatedChecks.reduce((sum, v) => sum + (v ? 1 : 0), 0) / evaluatedChecks.length
      : 0;
  const adherencePct = adherenceScore * 100;

  return {
    plannedRR,
    actualRR,
    plannedRiskPct,
    actualRiskPct,
    sessionMatch,
    targetMatch,
    adherenceScore,
    adherencePct,
    checks,
  };
}
