/**
 * DnD — Centralized instrument/symbol catalog.
 *
 * FINANCIAL SEMANTICS (authoritative per spec §5-9):
 *
 * pointValueCents = monetary value (in cents) of a 1.0 price move per 1.0 quantity.
 *   This is the FULL POINT value, NOT the tick value.
 *   Formula: grossPnlCents = priceDiff × quantity × pointValueCents
 *
 * tickSize = minimum price increment (smallest tick).
 * tickValueCents = derived: monetary value of one tick = tickSize × pointValueCents.
 *
 * contractSize = underlying units per 1.0 lot (for display/reference only,
 *   NOT multiplied again in P&L — pointValueCents already encodes the full economics).
 *
 * Examples:
 *   NQ:     $20 per full index point per contract → pointValueCents = 2000
 *   ES:     $50 per full index point per contract → pointValueCents = 5000
 *   EURUSD: $100,000 per 1.0 move per lot → pointValueCents = 10,000,000
 *   XAUUSD: $100 per $1 move per contract (100oz) → pointValueCents = 10,000
 *   GC:     $100 per $1 move per contract (100oz) → pointValueCents = 10,000
 *   CL:     $1,000 per $1 move per contract (1000 bbl) → pointValueCents = 100,000
 *
 * P&L VERIFICATION:
 *   NQ LONG entry=20000 exit=20080 qty=2:
 *     diff=80, gross = 80 × 2 × 2000 = 320,000 cents = $3,200 ✓
 *   ES SHORT entry=5000 exit=4990 qty=1:
 *     diff=10, gross = 10 × 1 × 5000 = 50,000 cents = $500 ✓
 *   EURUSD LONG entry=1.1000 exit=1.1080 qty=1:
 *     diff=0.0080, gross = 0.0080 × 1 × 10,000,000 = 80,000 cents = $800 ✓
 *   XAUUSD SHORT entry=2000 exit=1990 qty=1:
 *     diff=10, gross = 10 × 1 × 10,000 = 100,000 cents = $1,000 ✓
 */

export type InstrumentMarket =
  | "forex"
  | "gold"
  | "indices"
  | "futures"
  | "crypto"
  | "stocks"
  | "custom";

export interface InstrumentDef {
  /** Ticker symbol, uppercase, no whitespace. e.g. "EURUSD". */
  symbol: string;
  /** Human-readable name, e.g. "Euro / US Dollar". */
  displayName: string;
  /** Asset class. */
  market: InstrumentMarket;
  /** Sub-grouping within the market, e.g. "Major Pairs", "Metals". */
  category: string;
  /** Decimal places to use when displaying prices for this instrument. */
  pricePrecision: number;
  /** Decimal string. Size of 1 pip. "0.0001" for forex, "0.01" for gold. */
  pipSize: string;
  /** Decimal string. Minimum price increment (smallest tick). */
  tickSize: string;
  /**
   * Decimal string. Underlying units per 1.0 lot/contract (for display).
   * NOT multiplied in P&L — pointValueCents already encodes full economics.
   * "100000" for a forex standard lot, "100" for gold (100 oz),
   * "20" for NQ futures.
   */
  contractSize: string;
  /**
   * Monetary value (in cents) of a 1.0 price move per 1.0 quantity.
   * This is the FULL POINT value, NOT the tick value.
   *
   * P&L formula: grossPnlCents = priceDiff × quantity × pointValueCents
   *
   * Examples:
   *   NQ: $20/point → 2000 cents/point
   *   ES: $50/point → 5000 cents/point
   *   EURUSD: $100,000/1.0 → 10,000,000 cents
   *   XAUUSD: $100/$1 → 10,000 cents
   */
  pointValueCents: number;
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const INSTRUMENT_CATALOG: InstrumentDef[] = [
  /* ── FOREX Majors ─────────────────────────────────────────────── */
  // pointValueCents = contractSize × 100 (cents per dollar)
  // EURUSD: 100,000 × $1 = $100,000 per 1.0 move = 10,000,000 cents
  {
    symbol: "EURUSD",
    displayName: "Euro / US Dollar",
    market: "forex",
    category: "Major Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000, // $100,000 per 1.0 price move per lot
  },
  {
    symbol: "GBPUSD",
    displayName: "British Pound / US Dollar",
    market: "forex",
    category: "Major Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "USDJPY",
    displayName: "US Dollar / Japanese Yen",
    market: "forex",
    category: "Major Pairs",
    pricePrecision: 3,
    pipSize: "0.01",
    tickSize: "0.001",
    contractSize: "100000",
    // USDJPY: 1.0 price move = 100,000 JPY. At ~150 USD/JPY, ≈ $667.
    // For simplicity in a USD-account system, we use the quote-currency
    // approximation: pointValueCents = 100,000 × 100 = 10,000,000
    // (same as other USD-quoted pairs). This is an approximation —
    // a production system should convert JPY→USD at trade time.
    pointValueCents: 10000000,
  },
  {
    symbol: "USDCHF",
    displayName: "US Dollar / Swiss Franc",
    market: "forex",
    category: "Major Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "AUDUSD",
    displayName: "Australian Dollar / US Dollar",
    market: "forex",
    category: "Major Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "USDCAD",
    displayName: "US Dollar / Canadian Dollar",
    market: "forex",
    category: "Major Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "NZDUSD",
    displayName: "New Zealand Dollar / US Dollar",
    market: "forex",
    category: "Major Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },

  /* ── FOREX Minors / Crosses ───────────────────────────────────── */
  {
    symbol: "EURGBP",
    displayName: "Euro / British Pound",
    market: "forex",
    category: "Minor Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "EURJPY",
    displayName: "Euro / Japanese Yen",
    market: "forex",
    category: "Minor Pairs",
    pricePrecision: 3,
    pipSize: "0.01",
    tickSize: "0.001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "GBPJPY",
    displayName: "British Pound / Japanese Yen",
    market: "forex",
    category: "Minor Pairs",
    pricePrecision: 3,
    pipSize: "0.01",
    tickSize: "0.001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "AUDJPY",
    displayName: "Australian Dollar / Japanese Yen",
    market: "forex",
    category: "Minor Pairs",
    pricePrecision: 3,
    pipSize: "0.01",
    tickSize: "0.001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "EURAUD",
    displayName: "Euro / Australian Dollar",
    market: "forex",
    category: "Minor Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },
  {
    symbol: "GBPAUD",
    displayName: "British Pound / Australian Dollar",
    market: "forex",
    category: "Minor Pairs",
    pricePrecision: 5,
    pipSize: "0.0001",
    tickSize: "0.00001",
    contractSize: "100000",
    pointValueCents: 10000000,
  },

  /* ── Metals ───────────────────────────────────────────────────── */
  // XAUUSD: 100oz contract, $1 move = $100 → pointValueCents = 10,000
  {
    symbol: "XAUUSD",
    displayName: "Gold / US Dollar",
    market: "gold",
    category: "Metals",
    pricePrecision: 2,
    pipSize: "0.01",
    tickSize: "0.01",
    contractSize: "100",
    pointValueCents: 10000, // $100 per $1 move per contract
  },
  {
    symbol: "XAGUSD",
    displayName: "Silver / US Dollar",
    market: "gold",
    category: "Metals",
    pricePrecision: 3,
    pipSize: "0.001",
    tickSize: "0.001",
    contractSize: "5000",
    pointValueCents: 500000, // $5,000 per $1 move per 5000oz contract
  },

  /* ── Indices (CFD-style: $1 per point per contract) ──────────── */
  {
    symbol: "NAS100",
    displayName: "US Tech 100 (NASDAQ)",
    market: "indices",
    category: "US Indices",
    pricePrecision: 1,
    pipSize: "1",
    tickSize: "0.25",
    contractSize: "1",
    pointValueCents: 100, // $1 per point per contract
  },
  {
    symbol: "US30",
    displayName: "Wall Street 30 (Dow Jones)",
    market: "indices",
    category: "US Indices",
    pricePrecision: 1,
    pipSize: "1",
    tickSize: "1",
    contractSize: "1",
    pointValueCents: 100, // $1 per point
  },
  {
    symbol: "SPX500",
    displayName: "US 500 (S&P 500)",
    market: "indices",
    category: "US Indices",
    pricePrecision: 1,
    pipSize: "0.1",
    tickSize: "0.1",
    contractSize: "1",
    pointValueCents: 100, // $1 per point
  },
  {
    symbol: "GER40",
    displayName: "Germany 40 (DAX)",
    market: "indices",
    category: "EU Indices",
    pricePrecision: 1,
    pipSize: "0.1",
    tickSize: "0.1",
    contractSize: "1",
    pointValueCents: 100, // $1 per point
  },
  {
    symbol: "UK100",
    displayName: "UK 100 (FTSE)",
    market: "indices",
    category: "EU Indices",
    pricePrecision: 1,
    pipSize: "0.1",
    tickSize: "0.1",
    contractSize: "1",
    pointValueCents: 100, // $1 per point
  },

  /* ── Futures (CME-style contracts) ─────────────────────────────── */
  // NQ: $20 per full index point per contract
  {
    symbol: "NQ",
    displayName: "E-mini Nasdaq 100 Futures",
    market: "futures",
    category: "Equity Index Futures",
    pricePrecision: 2,
    pipSize: "0.25",
    tickSize: "0.25",
    contractSize: "20",
    pointValueCents: 2000, // $20 per point per contract
  },
  // ES: $50 per full index point per contract
  {
    symbol: "ES",
    displayName: "E-mini S&P 500 Futures",
    market: "futures",
    category: "Equity Index Futures",
    pricePrecision: 2,
    pipSize: "0.25",
    tickSize: "0.25",
    contractSize: "50",
    pointValueCents: 5000, // $50 per point per contract
  },
  // YM: $5 per full index point per contract
  {
    symbol: "YM",
    displayName: "E-mini Dow Futures",
    market: "futures",
    category: "Equity Index Futures",
    pricePrecision: 0,
    pipSize: "1",
    tickSize: "1",
    contractSize: "5",
    pointValueCents: 500, // $5 per point per contract
  },
  // CL: $1,000 per $1 move per contract (1000 barrels)
  {
    symbol: "CL",
    displayName: "Crude Oil Futures",
    market: "futures",
    category: "Energy Futures",
    pricePrecision: 2,
    pipSize: "0.01",
    tickSize: "0.01",
    contractSize: "1000",
    pointValueCents: 100000, // $1,000 per $1 move per contract
  },
  // GC: $100 per $1 move per contract (100 oz)
  {
    symbol: "GC",
    displayName: "Gold Futures (COMEX)",
    market: "futures",
    category: "Metal Futures",
    pricePrecision: 1,
    pipSize: "0.1",
    tickSize: "0.1",
    contractSize: "100",
    pointValueCents: 10000, // $100 per $1 move per contract
  },

  /* ── Crypto ───────────────────────────────────────────────────── */
  // Crypto: 1:1 with price ($1 per $1 move per 1 unit)
  {
    symbol: "BTCUSD",
    displayName: "Bitcoin / US Dollar",
    market: "crypto",
    category: "Crypto",
    pricePrecision: 2,
    pipSize: "0.01",
    tickSize: "0.01",
    contractSize: "1",
    pointValueCents: 100, // $1 per $1 move per 1 BTC
  },
  {
    symbol: "ETHUSD",
    displayName: "Ethereum / US Dollar",
    market: "crypto",
    category: "Crypto",
    pricePrecision: 2,
    pipSize: "0.01",
    tickSize: "0.01",
    contractSize: "1",
    pointValueCents: 100, // $1 per $1 move per 1 ETH
  },
];

/* ------------------------------------------------------------------ */
/* Lookup maps (built once, O(1) access)                              */
/* ------------------------------------------------------------------ */

const CATALOG_BY_SYMBOL: ReadonlyMap<string, InstrumentDef> = new Map(
  INSTRUMENT_CATALOG.map((def) => [def.symbol, def]),
);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function normalizeSymbol(symbol: string | null | undefined): string {
  if (symbol == null) return "";
  return String(symbol).trim().toUpperCase();
}

export function findInstrument(
  symbol: string | null | undefined,
): InstrumentDef | null {
  const key = normalizeSymbol(symbol);
  if (!key) return null;
  return CATALOG_BY_SYMBOL.get(key) ?? null;
}

export function makeCustomInstrument(symbol: string): InstrumentDef {
  const key = normalizeSymbol(symbol);
  return {
    symbol: key,
    displayName: key,
    market: "custom",
    category: "Custom",
    pricePrecision: 2,
    pipSize: "0.01",
    tickSize: "0.01",
    contractSize: "1",
    pointValueCents: 100, // $1 per $1 move (1:1 with price)
  };
}

export function resolveInstrument(symbol: string | null | undefined): InstrumentDef {
  const found = findInstrument(symbol);
  if (found) return found;
  return makeCustomInstrument(normalizeSymbol(symbol));
}

export function unitLabel(market: InstrumentMarket | string | null | undefined): string {
  switch (market) {
    case "forex":
      return "pips";
    case "futures":
      return "ticks";
    case "indices":
    case "gold":
    case "crypto":
    case "stocks":
      return "points";
    default:
      return "points";
  }
}

export function distanceInUnits(
  distance: number | string | null | undefined,
  pipSize: string | null | undefined,
): number {
  if (distance == null || distance === "") return 0;
  const d = typeof distance === "string" ? Number(distance) : distance;
  if (!Number.isFinite(d)) return 0;
  const ps = Number(pipSize ?? "0.01");
  if (!Number.isFinite(ps) || ps <= 0) return 0;
  const units = d / ps;
  return Math.round(units * 10000) / 10000;
}
