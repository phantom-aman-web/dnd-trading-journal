# Task `instruments` — Centralized instrument/symbol system

**Agent:** main
**Task ID:** `instruments`
**Date:** 2025-01

## Summary

Created a centralized, statically-typed instrument catalog so the trade form,
command palette, and any client surface can resolve an instrument's full
metadata (pipSize, tickSize, contractSize, pricePrecision, pointValueCents,
market, category) without an API roundtrip. Wired it into the trade form via a
searchable Popover+Command selector, normalized the symbol on submit (client
and server), and added `data-tour` hooks to every sidebar nav button for the
onboarding tour driver.

## Files changed

### 1. `src/lib/instrument-catalog.ts` *(new)*

Static catalog + helpers. Pure module, no React, no DB.

**Exports:**
- `InstrumentMarket` (union type for market values)
- `InstrumentDef` (the interface from the task spec, verbatim)
- `INSTRUMENT_CATALOG: InstrumentDef[]` — 30 instruments across 5 markets:
  - Forex Majors (7): EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD
  - Forex Minors (6): EURGBP, EURJPY, GBPJPY, AUDJPY, EURAUD, GBPAUD
  - Metals (2): XAUUSD, XAGUSD
  - Indices (5): NAS100, US30, SPX500, GER40, UK100
  - Futures (5): NQ, ES, YM, CL, GC
  - Crypto (2): BTCUSD, ETHUSD
- `normalizeSymbol(symbol)` — trim + uppercase, never throws
- `findInstrument(symbol)` — `InstrumentDef | null` (uses normalizeSymbol)
- `makeCustomInstrument(symbol)` — synthetic `custom` def for unknown symbols
- `resolveInstrument(symbol)` — `findInstrument` with custom fallback (never null)
- `unitLabel(market)` — `"pips" | "ticks" | "points"` by market
- `distanceInUnits(distance, pipSize)` — convert a price delta to pips/ticks/points

**Convention for `pointValueCents`** matches `computePointValueCents` in
`src/lib/calculations.ts`: `max(100, round(contractSize × tickSize × 100))`.
This keeps the catalog consistent with what the API derives from the DB-backed
`Instrument` model, so a catalog fallback produces the same P&L math as a
DB-stored instrument with the same spec.

### 2. `src/components/common/instrument-selector.tsx` *(new)*

Searchable, categorized instrument picker. Built on shadcn/ui `Popover` +
`Command` (cmdk), mirroring the pattern in `TimezoneSelect`.

**Features:**
- Search input filters by symbol OR displayName (case-insensitive) — cmdk
  native filter, item `value` is `"symbol displayName"` so both fields match.
- Results grouped two-level: market → category (`Forex · Major Pairs`,
  `Metals · Metals`, `Indices · US Indices`, etc.). Markets sorted in a
  stable, sensible order (forex, gold, indices, futures, crypto, stocks).
- Keyboard nav (ArrowUp/Down + Enter) handled natively by cmdk.
- Shows current selection in the trigger button: `"EURUSD — Euro / US Dollar"`
  for known instruments, or just the uppercase symbol for custom values.
- Custom-symbol fallback: if the query is a plausible ticker (alphanumeric +
  `. - /`) that doesn't match a catalog entry, a `"Use 'XYZ' as custom
  instrument"` option appears at the top of the list.
- `onChange` always called with the UPPERCASE, trimmed symbol.
- Props: `value`, `onChange`, `placeholder`, `className`, `disabled`, `id`.

### 3. `src/components/views/trade-form-view.tsx` *(modified)*

- **Imports** added: `InstrumentSelector`, `findInstrument`, `normalizeSymbol`,
  `resolveInstrument`, `unitLabel`, `distanceInUnits`, `InstrumentDef` type.
- **`fmtPrice`** upgraded to accept a `precision` param (default 5, preserving
  the historical forex behaviour). All call sites updated to pass
  `pricePrecision` derived from the selected instrument — so gold shows 2dp,
  indices 1dp, YM 0dp, etc.
- **`selectedInstrument` memo** added (uses `resolveInstrument`). Always yields
  a usable `InstrumentDef` (custom fallback for unknown symbols).
- **Symbol input** (Step 1, Trade Basics) replaced: the old free-text `<Input>`
  + `<datalist>` is now `<InstrumentSelector>`. Below it, a metadata preview
  row shows: market badge, displayName, contractSize, pipSize, pricePrecision
  (or an italic "Custom instrument" note for unknown symbols).
- **Submit payload** `market` field now uses `selectedInstrument.market`
  (catalog-derived) instead of looking up `/api/me`'s instrument list.
  `instrumentSymbol` is now `normalizeSymbol(form.instrumentSymbol)` (matches
  the API's server-side normalization).
- **Stop Distance display** (Step 3, Auto-calculated panel) now shows the
  instrument's unit label (`pips` / `points` / `ticks`) next to the heading
  and a sub-line with the count in those units (e.g. `10 pips` for a 0.0010
  stop on EURUSD).
- **Instrument Risk preview** added to the Auto-calculated panel — a new row
  showing the per-instrument dollar risk derived from `pipSize`,
  `contractSize`, and `pointValueCents` via the same formula the server uses:
  `stopDistance × qty × contractSize × (pointValueCents/100)`. A sub-line
  shows the formula breakdown so the user can see where the number came from.
- **Partial Exits** weighted exit price and **Review summary** entry/stop
  displays both now use the instrument's `pricePrecision`.

### 4. `src/app/api/trades/route.ts` *(modified)*

In the `POST` handler, immediately after Zod parse, added:

```ts
const normalizedSymbol = (data.instrumentSymbol || "").trim().toUpperCase();
data.instrumentSymbol = normalizedSymbol;
```

This guarantees a single canonical form in the DB regardless of what the
client sends (defensive — the trade form already normalizes, but legacy
clients or direct API callers may not). The normalized value flows through
the existing `db.trade.create` call and the `audit("trade.created", ...)`
log.

### 5. `src/components/sidebar.tsx` *(modified)*

A previous agent had already added most of the `data-tour` plumbing
(`NavItem.dataTour` field, `data-tour={item.dataTour}` on the button, and
the values for dashboard / trades-log / calendar / analytics / setups /
settings / add-trade). This task completed the missing piece:
- Added `dataTour: "accounts"` to the Accounts nav item (was the only one
  without it).

Final `data-tour` map (all 8 required hooks present):
| View          | `data-tour`    |
|---------------|----------------|
| dashboard     | `dashboard`    |
| tradesLog     | `trades-log`   |
| calendar      | `calendar`     |
| accounts      | `accounts`     |
| analytics     | `analytics`    |
| setups        | `setups`       |
| settings      | `settings`     |
| tradeNew (btn)| `add-trade`    |

## Verification

- `bun run lint` — passes cleanly (exit 0, no warnings).
- `npx tsc --noEmit` — no errors in any of the changed files (pre-existing
  errors elsewhere in the repo are unrelated to this task).
- Dev server compiles cleanly (`✓ Compiled in ...ms`) and serves `GET / 200`.
- The `Fast Refresh had to perform a full reload` warnings in `dev.log`
  appeared transiently during file edits (expected when adding new imports /
  changing hook signatures); subsequent compiles are clean and the page
  renders normally.

## Notes for downstream agents

- The catalog's `pointValueCents` is intentionally consistent with
  `computePointValueCents` (in `src/lib/calculations.ts`), which is what the
  API uses to derive the value from the DB-backed `Instrument` model. This
  means a catalog fallback produces identical P&L math to a stored instrument
  with the same `contractSize` + `tickSize`. **Do not** change the catalog's
  `pointValueCents` to "1.0 price move × 1.0 qty in cents" without also
  updating `calculateTradePnl` — the two conventions are coupled.
- The trade form's `instrumentRiskDollars` is a **client-side preview** and
  intentionally uses the same formula as the server-side
  `calculateTradePnl` (`stopDistance × qty × contractSize ×
  (pointValueCents/100)`) so the user sees the same number that will be
  persisted. The pre-existing risk calc (`riskAmountDollars = balance ×
  riskPct`) is unchanged — it's the user's intended risk, independent of
  instrument.
- `InstrumentSelector` is reusable: props are just `value`, `onChange`,
  `placeholder`. Other views (e.g. analytics filters, accounts) can adopt it
  without modification.
- The `Instrument` Prisma model (in `prisma/schema.prisma`) is unchanged.
  The catalog is a *fallback* for symbols not in the user's DB; when a user
  saves a custom instrument via the trade form, only the symbol + market are
  persisted on the `Trade` row — no `Instrument` record is created. If a
  future task wants to persist custom instruments as `Instrument` rows, the
  catalog's `makeCustomInstrument` helper provides the default spec.
