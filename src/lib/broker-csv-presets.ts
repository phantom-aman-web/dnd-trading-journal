/**
 * Broker CSV Presets & Mapping Definitions
 * Supports: MetaTrader 4 / 5 (MT4/MT5), cTrader, NinjaTrader, TradeLocker, Interactive Brokers (IBKR)
 */

export interface BrokerPreset {
  id: string;
  name: string;
  description: string;
  expectedHeaders: string[];
  mapping: Record<string, string>; // CSV column name -> DnD field
}

export const BROKER_PRESETS: BrokerPreset[] = [
  {
    id: "mt4_mt5",
    name: "MetaTrader 4 / 5 (MT4/MT5)",
    description: "Standard MetaTrader trade history export (HTML/CSV)",
    expectedHeaders: ["Open Time", "Type", "Size", "Item", "Price", "S / L", "T / P", "Close Time", "Profit"],
    mapping: {
      "Item": "instrumentSymbol",
      "Symbol": "instrumentSymbol",
      "Type": "direction",
      "Size": "quantity",
      "Volume": "quantity",
      "Lots": "quantity",
      "Price": "entryPrice",
      "Open Price": "entryPrice",
      "Open Time": "entryTime",
      "Time": "entryTime",
      "Close Price": "exitPrice",
      "Close Time": "exitTime",
      "S / L": "stopPrice",
      "T / P": "targetPrice",
      "Commission": "feesCents",
      "Swap": "feesCents",
      "Profit": "netPnlCents",
    },
  },
  {
    id: "ctrader",
    name: "cTrader",
    description: "Spotware cTrader statement or CSV deal history export",
    expectedHeaders: ["Position Id", "Entry Time", "Symbol", "Direction", "Volume", "Entry Price", "Closing Time", "Closing Price", "Net USD"],
    mapping: {
      "Symbol": "instrumentSymbol",
      "Direction": "direction",
      "Action": "direction",
      "Volume": "quantity",
      "Lots": "quantity",
      "Entry Price": "entryPrice",
      "Closing Price": "exitPrice",
      "Entry Time": "entryTime",
      "Closing Time": "exitTime",
      "Stop Loss": "stopPrice",
      "Take Profit": "targetPrice",
      "Commission": "feesCents",
      "Swap": "feesCents",
      "Net USD": "netPnlCents",
    },
  },
  {
    id: "ninjatrader",
    name: "NinjaTrader 8",
    description: "NinjaTrader 8 Trade Performance or Grid CSV export",
    expectedHeaders: ["Trade number", "Instrument", "Market pos.", "Qty", "Entry price", "Exit price", "Entry time", "Exit time", "Profit"],
    mapping: {
      "Instrument": "instrumentSymbol",
      "Market pos.": "direction",
      "Qty": "quantity",
      "Entry price": "entryPrice",
      "Exit price": "exitPrice",
      "Entry time": "entryTime",
      "Exit time": "exitTime",
      "Commission": "feesCents",
      "Profit": "netPnlCents",
    },
  },
  {
    id: "tradelocker",
    name: "TradeLocker",
    description: "TradeLocker closed positions and orders CSV export",
    expectedHeaders: ["Order ID", "Symbol", "Side", "Qty", "Filled Price", "Closed Price", "Created At", "Closed At", "Profit"],
    mapping: {
      "Symbol": "instrumentSymbol",
      "Side": "direction",
      "Qty": "quantity",
      "Filled Price": "entryPrice",
      "Closed Price": "exitPrice",
      "Created At": "entryTime",
      "Closed At": "exitTime",
      "Stop Loss": "stopPrice",
      "Take Profit": "targetPrice",
      "Fee": "feesCents",
      "Profit": "netPnlCents",
    },
  },
  {
    id: "ibkr",
    name: "Interactive Brokers (IBKR)",
    description: "Interactive Brokers Activity Statement or Trade Confirmation CSV",
    expectedHeaders: ["Symbol", "Date/Time", "Buy/Sell", "Quantity", "TradePrice", "ClosePrice", "IBCommission", "RealizedP/L"],
    mapping: {
      "Symbol": "instrumentSymbol",
      "Buy/Sell": "direction",
      "Quantity": "quantity",
      "TradePrice": "entryPrice",
      "ClosePrice": "exitPrice",
      "Date/Time": "entryTime",
      "CloseDate/Time": "exitTime",
      "IBCommission": "feesCents",
      "RealizedP/L": "netPnlCents",
    },
  },
];

/**
 * Detects whether uploaded CSV headers match one of the known broker presets.
 */
export function detectBrokerPreset(headers: string[]): BrokerPreset | null {
  const normalizedHeaders = new Set(headers.map((h) => h.toLowerCase().trim()));

  let bestMatch: BrokerPreset | null = null;
  let highestScore = 0;

  for (const preset of BROKER_PRESETS) {
    let matched = 0;
    for (const expected of preset.expectedHeaders) {
      if (normalizedHeaders.has(expected.toLowerCase().trim())) {
        matched++;
      }
    }

    const score = matched / preset.expectedHeaders.length;
    if (score >= 0.5 && score > highestScore) {
      highestScore = score;
      bestMatch = preset;
    }
  }

  return bestMatch;
}

/**
 * Applies a broker preset to CSV headers, falling back to heuristic matching for any unmapped columns.
 */
export function getPresetMapping(presetId: string, headers: string[]): Record<string, string> {
  const preset = BROKER_PRESETS.find((p) => p.id === presetId);
  if (!preset) return {};

  const result: Record<string, string> = {};
  for (const h of headers) {
    const trimmed = h.trim();
    // Direct or case-insensitive match
    for (const [csvCol, dndField] of Object.entries(preset.mapping)) {
      if (csvCol.toLowerCase() === trimmed.toLowerCase()) {
        result[trimmed] = dndField;
        break;
      }
    }
  }

  return result;
}

/**
 * Normalizes numbers from broker CSVs handling European commas, currency symbols, and accounting parentheses.
 * e.g. "1,0850" -> "1.0850", "1.250,50" -> "1250.50", "(3.50)" -> "-3.50", "-$3,50" -> "-3.50"
 */
export function normalizeCsvDecimal(val: unknown): string {
  if (val == null) return "";
  let s = String(val).trim();
  if (!s) return "";

  // Handle accounting parentheses: "(3.50)" -> "-3.50"
  const isParenNegative = /^\((.*)\)$/.test(s);
  if (isParenNegative) {
    s = "-" + s.replace(/^\(|\)$/g, "").trim();
  }

  // Remove currency symbols and non-numeric characters except minus, plus, period, comma
  s = s.replace(/[^0-9.,+-]/g, "");
  if (!s) return "";

  // Handle mixed dots and commas
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // European format: "1.250,50"
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Standard US format: "1,250.50"
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // Only commas: "1,0850" or "-3,50"
    s = s.replace(",", ".");
  }

  return s;
}

/**
 * Converts broker CSV monetary values (in base currency, e.g. USD) to integer cents.
 * Handles fractional amounts, currency symbols, negative values, and European commas.
 * e.g. "-3.50" -> -350, "-3,50" -> -350, "($3.50)" -> -350, "15.25" -> 1525
 */
export function parseCsvMoneyCents(val: unknown): number {
  if (val == null) return 0;
  const normalized = normalizeCsvDecimal(val);
  if (!normalized) return 0;
  const num = parseFloat(normalized);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Robust date/time parser for broker CSV exports with explicit broker timezone offset support.
 * Handles ISO, YYYY.MM.DD HH:mm:ss, DD.MM.YYYY HH:mm:ss, MM/DD/YYYY, and DD/MM/YYYY.
 *
 * @param val The raw date string from CSV
 * @param brokerUtcOffsetHours Optional broker server UTC offset in hours (e.g. +2 for MT4/MT5 EET, +3 for EEST, 0 for UTC, -5 for EST)
 */
export function parseCsvDateTime(val: unknown, brokerUtcOffsetHours?: number): Date | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;

  // Format timezone offset string if provided and timestamp doesn't already contain timezone
  const hasExistingTimezone = /Z|[+-]\d{2}:?\d{2}$/i.test(s);
  const offsetStr =
    !hasExistingTimezone && typeof brokerUtcOffsetHours === "number" && !isNaN(brokerUtcOffsetHours)
      ? `${brokerUtcOffsetHours >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(brokerUtcOffsetHours))).padStart(2, "0")}:${String(
          Math.round((Math.abs(brokerUtcOffsetHours) - Math.floor(Math.abs(brokerUtcOffsetHours))) * 60)
        ).padStart(2, "0")}`
      : "";

  // Try direct standard Date parse first if ISO with existing timezone
  if (hasExistingTimezone) {
    const direct = new Date(s);
    if (!isNaN(direct.getTime())) return direct;
  }

  // Handle YYYY.MM.DD or YYYY-MM-DD HH:mm(:ss)?
  const ymdMatch = s.match(/^(\d{4})[.-](\d{2})[.-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ymdMatch) {
    const [, y, m, d, hh = "00", mm = "00", ss = "00"] = ymdMatch;
    const isoString = `${y}-${m}-${d}T${hh}:${mm}:${ss}${offsetStr || "Z"}`;
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) return date;
  }

  // Handle DD.MM.YYYY HH:mm(:ss)? (common European MT4/MT5 format)
  const dmyDotMatch = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmyDotMatch) {
    const [, d, m, y, hh = "00", mm = "00", ss = "00"] = dmyDotMatch;
    const isoString = `${y}-${m}-${d}T${hh}:${mm}:${ss}${offsetStr || "Z"}`;
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) return date;
  }

  // Handle DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (slashMatch) {
    const [, p1, p2, y, hh = "00", mm = "00", ss = "00"] = slashMatch;
    const num1 = parseInt(p1, 10);
    const num2 = parseInt(p2, 10);
    // If num1 > 12, it must be DD/MM/YYYY
    const [finalMonth, finalDay] = num1 > 12 ? [num2, num1] : [num1, num2];
    const isoString = `${y}-${String(finalMonth).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}T${hh}:${mm}:${ss}${offsetStr || "Z"}`;
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback to direct parse if valid
  const direct = new Date(s);
  if (!isNaN(direct.getTime())) {
    return direct;
  }

  return null;
}

