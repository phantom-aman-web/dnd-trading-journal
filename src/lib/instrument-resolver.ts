/**
 * DnD — Server-side instrument resolver.
 *
 * Single authoritative path for resolving instrument metadata on the server.
 *
 * Resolution order (per spec section 2A — server-side authority):
 *   1. If a DB `Instrument` row exists for the (userId, normalizedSymbol)
 *      pair, use it (user overrides / custom instruments).
 *   2. Otherwise, if the symbol exists in the static catalog
 *      (`INSTRUMENT_CATALOG`), use the catalog entry.
 *   3. Otherwise, return a synthetic custom def with sensible defaults.
 *
 * The server NEVER trusts client-provided financial metadata
 * (contractSize, tickSize, pipSize, pointValueCents). Those values are
 * always resolved from the DB or catalog.
 */

import { db } from "./db";
import {
  INSTRUMENT_CATALOG,
  findInstrument,
  makeCustomInstrument,
  normalizeSymbol,
  type InstrumentDef,
  type InstrumentMarket,
} from "./instrument-catalog";

export interface ResolvedInstrument {
  /** The resolved `InstrumentDef` (catalog or custom). */
  def: InstrumentDef;
  /** The DB `Instrument` row's `id` if one exists (for FK linking). */
  instrumentId: string | null;
  /** Where the metadata came from. */
  source: "db" | "catalog" | "custom";
}

/**
 * Resolve an instrument for server-side financial calculations.
 *
 * @param symbol Raw symbol from the client (will be normalized).
 * @param userId The session user's id (for DB lookup).
 * @returns A `ResolvedInstrument` with the authoritative metadata.
 */
export async function resolveInstrumentForServer(
  symbol: string | null | undefined,
  userId: string,
): Promise<ResolvedInstrument> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return {
      def: makeCustomInstrument(""),
      instrumentId: null,
      source: "custom",
    };
  }

  // 1. Check the DB for a user-owned Instrument row (overrides catalog).
  const dbInstr = await db.instrument.findFirst({
    where: { userId, symbol: normalized },
  });
  if (dbInstr) {
    return {
      def: {
        symbol: dbInstr.symbol,
        displayName: dbInstr.name ?? dbInstr.symbol,
        market: (dbInstr.market as InstrumentMarket) ?? "custom",
        category: "Custom",
        pricePrecision: dbInstr.pricePrecision,
        pipSize: dbInstr.pipSize,
        tickSize: dbInstr.tickSize,
        contractSize: dbInstr.contractSize,
        // Derive pointValueCents from the DB row's contractSize + tickSize/pipSize
        // using the same formula as `computePointValueCents` in calculations.ts.
        pointValueCents: computePointValueFromDb(
          dbInstr.contractSize,
          dbInstr.tickSize,
          dbInstr.pipSize,
        ),
      },
      instrumentId: dbInstr.id,
      source: "db",
    };
  }

  // 2. Check the static catalog.
  const catalogDef = findInstrument(normalized);
  if (catalogDef) {
    return {
      def: catalogDef,
      instrumentId: null, // No DB row; the catalog is the authority.
      source: "catalog",
    };
  }

  // 3. Synthetic custom instrument.
  return {
    def: makeCustomInstrument(normalized),
    instrumentId: null,
    source: "custom",
  };
}

/**
 * Compute pointValueCents from a DB Instrument row's decimal-string fields.
 *
 * pointValueCents = monetary value (in cents) of a 1.0 price move per 1.0 quantity.
 * This is the FULL POINT value, computed as contractSize × 100.
 *
 * For DB instruments that don't have a catalog entry, this provides a
 * reasonable default. Catalog instruments use their hardcoded pointValueCents.
 */
function computePointValueFromDb(
  contractSizeStr: string | null,
  tickSizeStr: string | null,
  pipSizeStr: string | null,
): number {
  const cs = Number(contractSizeStr ?? "1");
  if (!Number.isFinite(cs) || cs <= 0) return 100;
  // pointValueCents = contractSize × 100 (cents per dollar of contract size)
  // NQ: 20 × 100 = 2000 ($20/point)
  // ES: 50 × 100 = 5000 ($50/point)
  // EURUSD: 100000 × 100 = 10,000,000 ($100,000/1.0)
  // Gold: 100 × 100 = 10,000 ($100/$1)
  // Crypto: 1 × 100 = 100 ($1/$1)
  const cents = Math.round(cs * 100);
  if (!Number.isFinite(cents) || cents <= 0) return 100;
  return cents;
}

/**
 * Synchronous catalog-only resolver. Used when we don't have a userId
 * (e.g. import preview) or want to avoid a DB roundtrip. Does NOT check
 * the DB for user overrides.
 */
export function resolveInstrumentFromCatalog(symbol: string | null | undefined): InstrumentDef {
  const found = findInstrument(symbol);
  if (found) return found;
  return makeCustomInstrument(normalizeSymbol(symbol));
}

/** Re-export for convenience. */
export { INSTRUMENT_CATALOG, normalizeSymbol };
