# Task: rebuild-trades-accounts

**Agent**: main
**Task ID**: `rebuild-trades-accounts`
**Scope**: Rebuild the two stub view components to match the reference site
(https://ae-tradingjournal.vercel.app/) aesthetic.

## Files touched

- `src/components/views/trades-log-view.tsx` — fully rewritten (was a stub).
- `src/components/views/accounts-view.tsx` — fully rewritten (was a stub).

No schema, API, or shared-lib changes were needed — the existing
`/api/trades`, `/api/accounts`, `/api/accounts/[id]`, and `/api/strategies`
endpoints already return the data shapes these views consume.

## Trades Log view (`trades-log-view.tsx`)

Premium navy-blue + white-card aesthetic matching the reference:

- **App background** `bg-slate-100` is provided by `AppShell` (the `<main>`
  wrapper already uses `bg-slate-100`). The view adds white cards
  (`bg-white border border-slate-200 rounded-xl shadow-sm`) on top.
- **Heading**: "Trades Log" + subtitle + "Log Trade" button
  (`navigate("tradeNew")`).
- **Filter bar** (white card):
  - Free-text search (symbol or setup name).
  - Account filter (All Accounts / each account from `/api/accounts`).
  - Setup filter (All Setups / each strategy from `/api/strategies`).
  - Direction filter (All / Long / Short).
  - Outcome filter (All / Win / Loss / Breakeven).
  - Filter dropdowns use `h-9 border-slate-300 rounded-lg` Select triggers.
  - "Showing X of Y trades" count row with a "Clear filters" link.
- **Trade table** (white card):
  - Columns: Date · Symbol · Direction · Setup · Status · P&L · R Multiple ·
    Adherence · (chevron).
  - Date formatted `MMM D, YYYY`.
  - Direction badge: Long = `bg-emerald-100 text-emerald-700`,
    Short = `bg-red-100 text-red-700`.
  - Status badge: Draft = `bg-slate-100 text-slate-600`,
    Open = `bg-amber-100 text-amber-700`, Closed = `bg-slate-100 text-slate-600`.
  - P&L: `tabular-nums font-semibold`, green `text-emerald-600` / red
    `text-red-500` / slate for zero.
  - R Multiple: `formatR` colored green/red/slate.
  - Adherence %: derived from `planAdherenceJson.ruleCompliance`
    (percentage of `true` values); colored emerald ≥80, amber ≥50, red <50.
  - Row click → `navigate("tradeDetail", { id: trade.id })`.
  - `hover:bg-slate-50 cursor-pointer border-b border-slate-100` rows.
- **Empty state**: "No trades found matching criteria" (or "No trades logged
  yet" when the system is empty) with a "Log Trade" CTA.

Data fetching uses `useQuery` from `@tanstack/react-query`. Trades are fetched
with `limit=200` and filtered client-side so the "Showing X of Y" count stays
meaningful (Y = total fetched, X = visible after filters). The setup and
outcome filters require client-side logic (outcome isn't a clean DB status
column because of partial wins/losses), so all four filters are applied in a
single `useMemo`.

## Accounts view (`accounts-view.tsx`)

Standalone page (already routed via `app-shell.tsx` at `view === "accounts"`).
Not a settings tab.

- **Heading**: "Accounts" + "+ Add Account" button.
- **Aggregate summary**: four stat cards (Total Balance, Total P&L colored
  green/red, Total Trades, Win Rate) shown above the grid when accounts exist.
- **Account cards grid** (`sm:grid-cols-2 lg:grid-cols-3 gap-4`), each card
  `bg-white rounded-xl border border-slate-200 p-5 shadow-sm`:
  - Account type badge (`inline-flex items-center px-2 py-0.5 rounded
    text-[10px] font-semibold uppercase tracking-wide`) with the exact
    per-type colors from the task spec:
    - Personal: `bg-blue-100 text-blue-700`
    - Prop Firm: `bg-purple-100 text-purple-700`
    - Funded: `bg-emerald-100 text-emerald-700`
    - Demo: `bg-slate-100 text-slate-600`
    - Backtest: `bg-amber-100 text-amber-700`
    - Other: `bg-slate-100 text-slate-600`
  - "Default" badge (`bg-slate-900 text-white`) when `isDefault`.
  - Account name (bold) + broker (or italic "No broker").
  - Balance: `text-2xl font-bold text-slate-900 tabular-nums`
    (`formatSignedCents`).
  - P&L: `text-sm font-semibold tabular-nums` green/red
    (`currentBalanceCents - startingBalanceCents`).
  - Stats row: Trades count, Win Rate, Consistency % (from
    `account.consistencyRate`).
  - Optional risk-limit footer (Daily loss limit %, Max DD %) when set.
  - Edit (pencil) and Delete (trash) ghost buttons in the card header.
- **Performance Detail** section below the grid: a per-account table
  (Account · Balance · Starting · P&L · Trades · Win Rate · Consistency).
- **Add/Edit dialog** (`AccountDialog`, controlled, triggerless):
  - Account Name * (required)
  - Broker or Firm (optional)
  - Account Type dropdown: Personal, Prop Firm, Funded, Demo, Backtest, Other
    (matches the task spec exactly — no "Live" option, unlike the older
    Settings-tab dialog which keeps `live`).
  - Currency dropdown: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD.
  - Initial Balance * (required, number, defaults to 10000).
  - Consistency Rate %, Daily Loss Limit %, Max Drawdown % (optional numbers).
  - Default-account checkbox (using `@/components/ui/checkbox`).
  - Save → POST `/api/accounts` (create) or PATCH `/api/accounts/[id]` (edit),
    then invalidates `["accounts"]` and `["trades"]` query keys (the latter
    so the Trades Log's per-account stats refresh).

Delete button blocks deletion when the account has linked trades (the API
also enforces this, but the UI pre-empts the round-trip with a clear toast).
On success it invalidates the accounts query.

## Per-account stats computation

The Accounts view fetches both `/api/accounts` and `/api/trades?limit=200`,
then groups trades by `accountId` into a `Map<accountId, {count, wins,
losses, pnlCents}>`. Win/loss counts only consider closed trades
(`!isDraft && status !== "open"`). Win rate = `wins / (wins + losses)`.

## Verification

- `bun run lint` → exit 0, no warnings.
- Dev server (`bun run dev` on port 3000) — compiles cleanly. The stale
  `module-not-found` trace at the top of `dev.log` refers to `backup-view`
  which now exists; the most recent compiles are all `✓ Compiled in Xms`
  with no errors.
- Both views are already routed in `src/components/app-shell.tsx`
  (`view === "tradesLog"` and `view === "accounts"`), and both view keys are
  registered in `src/lib/nav-store.ts` (`ViewKey` union) and
  `src/app/page.tsx` (`APP_VIEWS` array).

## Notes for future agents

- The older `AccountDialog` in `src/components/views/settings-view.tsx`
  still includes `live` as an account-type option and uses the shadcn
  `Switch` for the default toggle. The new `accounts-view.tsx` dialog uses
  the task-spec's six-type vocab (Personal/Prop/Funded/Demo/Backtest/Other)
  and a `Checkbox` for the default toggle. Both dialogs POST/PATCH the same
  `/api/accounts` endpoint, so the two views stay consistent.
- The Trades Log view fetches up to 200 trades. If a user exceeds that, the
  "Showing X of Y" count will cap at 200. Pagination can be added later
  using the `nextCursor` field the API already returns.
- `planAdherenceJson.ruleCompliance` is the only adherence shape in the
  codebase today (written by `trade-form-view.tsx` and the trade POST
  route). The `adherencePct` helper degrades to `null` (renders "—") for
  trades that have no rule-compliance data, so legacy trades don't break.
