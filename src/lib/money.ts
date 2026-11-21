/**
 * DnD — Money utilities.
 * Per spec section 7: currency amounts stored as integer minor units (cents).
 * Prices/quantities/ratios stored as decimal strings (see decimal.ts).
 */

import { Decimal, dNormalize, dToNumber } from "./decimal";

export type Cents = number; // integer minor units

/** Convert a dollar/amount float to cents (integer minor units). */
export function toCents(amount: number | string | null | undefined): Cents {
  if (amount == null || amount === "") return 0;
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Convert cents to a display string like "1,234.56". */
export function formatCents(cents: Cents | null | undefined, currency = "USD", dp = 2): string {
  const c = cents ?? 0;
  const value = c / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(value);
  } catch {
    return (value).toFixed(dp);
  }
}

/** Convert cents to a plain numeric string "1234.56" (no symbol). */
export function centsToNumberString(cents: Cents | null | undefined, dp = 2): string {
  const c = cents ?? 0;
  return (c / 100).toFixed(dp);
}

/** Add cents. Inputs are integer minor units (per spec §7); plain
 * addition is safe — no `| 0` coercion, which would truncate above 2^31.
 */
export function addCents(a: Cents, b: Cents): Cents {
  return a + b;
}

/** Subtract cents. Plain arithmetic preserves values above the 32-bit range. */
export function subCents(a: Cents, b: Cents): Cents {
  return a - b;
}

/** Negate. */
export function negCents(a: Cents): Cents {
  return -a;
}

/** Sign of cents: -1, 0, 1 */
export function signCents(a: Cents): -1 | 0 | 1 {
  if (a < 0) return -1;
  if (a > 0) return 1;
  return 0;
}

/** Format a cents amount with sign and profit/loss label, never relying on color alone. */
export function formatSignedCents(cents: Cents | null | undefined, currency = "USD"): { text: string; sign: -1 | 0 | 1 } {
  const c = cents ?? 0;
  const sign = signCents(c);
  const abs = Math.abs(c);
  const formatted = formatCents(abs, currency);
  if (sign < 0) return { text: `- ${formatted}`, sign };
  if (sign > 0) return { text: `+ ${formatted}`, sign };
  return { text: formatted, sign };
}

/** Format a percentage from a decimal string (0.0125 -> "1.25%") */
export function formatPct(decimal: Decimal | number | null | undefined, dp = 2): string {
  const n = dToNumber(decimal);
  if (!Number.isFinite(n)) return "N/A";
  return `${(n * 100).toFixed(dp)}%`;
}

/**
 * Format a Win Rate value safely whether provided as a ratio (0.674416) or percentage (67.4).
 * Defensively prevents displaying 0.674416% (D-012).
 */
export function formatWinRate(wr: Decimal | number | string | null | undefined, dp = 1): string {
  if (wr == null || wr === "") return "—";
  const n = typeof wr === "string" ? parseFloat(wr) : Number(wr);
  if (!Number.isFinite(n)) return "—";
  // If <= 1.0 (and > 0), it is a decimal ratio (e.g. 0.674416 -> 67.4%)
  const pct = n <= 1.0 && n > 0 ? n * 100 : n;
  return `${pct.toFixed(dp)}%`;
}

/**
 * Format Profit Factor with concise precision (default 2 decimals).
 * Gracefully handles zero-loss unbounded cases ("∞ (0 losses)") per D-013.
 */
export function formatProfitFactor(pf: number | string | null | undefined, dp = 2): string {
  if (pf == null || pf === "" || pf === "—" || pf === "N/A") return "—";
  if (pf === "Infinity" || pf === "unbounded" || pf === Infinity) return "∞ (0 losses)";
  const n = typeof pf === "string" ? parseFloat(pf) : Number(pf);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(dp);
}

/** Format an R multiple. Returns "N/A" when undefined. */
export function formatR(r: Decimal | number | null | undefined, dp = 2): string {
  if (r == null) return "N/A";
  const n = dToNumber(r);
  if (!Number.isFinite(n)) return "N/A";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(dp)}R`;
}

/** Format a price decimal with given precision */
export function formatPrice(price: Decimal | number | null | undefined, precision = 5): string {
  const n = dToNumber(price);
  if (!Number.isFinite(n)) return "N/A";
  return n.toFixed(precision);
}

/** Currency symbols map for common account currencies */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
  CHF: "Fr",
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code + " ";
}
