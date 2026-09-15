/**
 * DnD — Bridge from the legacy instrument catalog to the authoritative
 * FinancialEngine's InstrumentEconomics model.
 *
 * This adapter lets us adopt the new engine WITHOUT a massive catalog
 * rewrite. The legacy InstrumentDef is converted to InstrumentEconomics
 * at the boundary, then the engine uses the spec-compliant model.
 */

import type { InstrumentDef } from "./instrument-catalog";
import type { InstrumentEconomics } from "./financial-engine";

/**
 * Convert a legacy InstrumentDef to the spec-compliant InstrumentEconomics.
 *
 * Legacy field mapping:
 *   market         → assetClass
 *   contractSize   → contractSize (informational, preserved)
 *   pointValueCents → pointValueCents (AUTHORITATIVE, preserved)
 *   tickSize       → tickSize + priceIncrement (alias)
 *   pipSize        → pipSize (forex only)
 *   pricePrecision → (used for display, not in engine)
 *
 * New fields derived with sensible defaults:
 *   quantityUnit     → 'lots' for forex/gold/crypto, 'contracts' for futures/indices
 *   quantityScale    → 2 for lots, 0 for contracts
 *   quantityStep     → '0.01' for lots, '1' for contracts
 *   minimumQuantity  → '0.01' for lots, '1' for contracts
 *   baseCurrency     → null (forex base currency handled at trade level)
 *   quoteCurrency    → 'USD' (default; production should override per-instrument)
 *   currencyConversionRequired → false (default; override when quote ≠ account)
 */
export function toInstrumentEconomics(
  def: InstrumentDef,
  accountCurrency: string = "USD",
): InstrumentEconomics {
  const isLotBased =
    def.market === "forex" || def.market === "gold" || def.market === "crypto";
  const quantityUnit = isLotBased ? "lots" : "contracts";
  const quantityScale = isLotBased ? 2 : 0;
  const quantityStep = isLotBased ? "0.01" : "1";
  const minimumQuantity = isLotBased ? "0.01" : "1";

  // Derive quote currency from the instrument's economics.
  // For USD-quoted instruments (most of the catalog), quoteCurrency = USD.
  // USDJPY is the exception — quote is JPY.
  let quoteCurrency = "USD";
  if (def.symbol === "USDJPY" || def.symbol === "EURJPY" || def.symbol === "GBPJPY" || def.symbol === "AUDJPY") {
    quoteCurrency = "JPY";
  }

  return {
    symbol: def.symbol,
    assetClass: def.market as InstrumentEconomics["assetClass"],
    baseCurrency: null, // forex base currency is implicit in the pair name
    quoteCurrency,
    quantityUnit,
    quantityScale,
    quantityStep,
    minimumQuantity,
    contractSize: def.contractSize,
    priceIncrement: def.tickSize,
    tickSize: def.tickSize,
    pointValueCents: def.pointValueCents,
    pipSize: def.pipSize ?? null,
    currencyConversionRequired: quoteCurrency !== accountCurrency,
  };
}
