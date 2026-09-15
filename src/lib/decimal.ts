/**
 * DnD — Decimal arithmetic utilities.
 * Per spec section 7: never use unsafe JS floating-point for money-critical math.
 * We use decimal.js for arbitrary precision.
 */

import DecimalJs from "decimal.js";

export type Decimal = string;

DecimalJs.set({ precision: 20, rounding: DecimalJs.ROUND_HALF_EVEN });

/** Convert any input to a DecimalJs instance, returning 0 on error. */
function toDecimalJs(v: Decimal | number | null | undefined): DecimalJs {
  if (v == null || v === "") return new DecimalJs(0);
  try {
    const s = typeof v === "number" ? v : String(v).trim();
    if (s === "" || s === "-" || s === ".") return new DecimalJs(0);
    const d = new DecimalJs(s);
    if (d.isNaN() || !d.isFinite()) return new DecimalJs(0);
    return d;
  } catch {
    return new DecimalJs(0);
  }
}

/** Normalize a decimal string, removing trailing zeros and handling signs. */
export function dNormalize(v: Decimal | number | null | undefined): Decimal {
  const d = toDecimalJs(v);
  if (d.isZero()) return "0";
  let s = d.toString();
  if (s.includes(".")) {
    s = s.replace(/(\.\d*?)0+$/, "$1");
    if (s.endsWith(".")) s = s.slice(0, -1);
  }
  return s;
}

/** Parse to a JS number (use only for display rounding, never for money-critical math). */
export function dToNumber(v: Decimal | number | null | undefined): number {
  return toDecimalJs(v).toNumber();
}

/** Convert to fixed-decimal string for display. */
export function dToFixed(v: Decimal | number | null | undefined, dp = 2): string {
  return toDecimalJs(v).toFixed(dp);
}

/** Add: a + b */
export function dAdd(a: Decimal | number | null | undefined, b: Decimal | number | null | undefined): Decimal {
  const an = toDecimalJs(a);
  const bn = toDecimalJs(b);
  return dNormalize(an.plus(bn).toString());
}

/** Subtract: a - b */
export function dSub(a: Decimal | number | null | undefined, b: Decimal | number | null | undefined): Decimal {
  const an = toDecimalJs(a);
  const bn = toDecimalJs(b);
  return dNormalize(an.minus(bn).toString());
}

/** Multiply: a * b */
export function dMul(a: Decimal | number | null | undefined, b: Decimal | number | null | undefined): Decimal {
  const an = toDecimalJs(a);
  const bn = toDecimalJs(b);
  return dNormalize(an.times(bn).toString());
}

/** Divide: a / b. Returns null when b is 0 (never Infinity). */
export function dDiv(a: Decimal | number | null | undefined, b: Decimal | number | null | undefined): Decimal | null {
  const bn = toDecimalJs(b);
  if (bn.isZero()) return null;
  const an = toDecimalJs(a);
  return dNormalize(an.dividedBy(bn).toString());
}

/** Absolute value */
export function dAbs(a: Decimal | number | null | undefined): Decimal {
  return dNormalize(toDecimalJs(a).abs().toString());
}

/** Negate */
export function dNeg(a: Decimal | number | null | undefined): Decimal {
  return dNormalize(toDecimalJs(a).negated().toString());
}

/** Compare: returns -1, 0, 1 */
export function dCmp(a: Decimal | number | null | undefined, b: Decimal | number | null | undefined): -1 | 0 | 1 {
  const an = toDecimalJs(a);
  const bn = toDecimalJs(b);
  return an.comparedTo(bn) as -1 | 0 | 1;
}

/** Is zero */
export function dIsZero(a: Decimal | number | null | undefined): boolean {
  return toDecimalJs(a).isZero();
}

/** Max */
export function dMax(a: Decimal | number | null | undefined, b: Decimal | number | null | undefined): Decimal {
  const an = toDecimalJs(a);
  const bn = toDecimalJs(b);
  return dNormalize(DecimalJs.max(an, bn).toString());
}

/** Min */
export function dMin(a: Decimal | number | null | undefined, b: Decimal | number | null | undefined): Decimal {
  const an = toDecimalJs(a);
  const bn = toDecimalJs(b);
  return dNormalize(DecimalJs.min(an, bn).toString());
}

/** Sum an array of decimals */
export function dSum(values: (Decimal | number | null | undefined)[]): Decimal {
  let acc = new DecimalJs(0);
  for (const v of values) {
    acc = acc.plus(toDecimalJs(v));
  }
  return dNormalize(acc.toString());
}
