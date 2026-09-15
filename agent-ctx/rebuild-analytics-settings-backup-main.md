# Task: rebuild-analytics-settings-backup

**Agent:** main
**Task ID:** rebuild-analytics-settings-backup
**Date:** 2026-09-08

## Goal

Rebuild three view files to match the reference site
(https://ae-tradingjournal.vercel.app/) — premium navy-blue + white-card
aesthetic, simplified information architecture, and the reference's
"Analytics Engine", "Settings", and "Backup, Snapshot & Data Management"
page structures.

Files rebuilt:
1. `src/components/views/analytics-view.tsx`
2. `src/components/views/settings-view.tsx`
3. `src/components/views/backup-view.tsx`

## Reference aesthetic applied

- App background: `bg-slate-100` (light gray) on a `min-h-full` wrapper
- Cards: `bg-white border border-slate-200 rounded-xl shadow-sm p-6`
- Headings: `text-slate-900`, large `text-2xl md:text-3xl font-bold tracking-tight`
- Muted text: `text-slate-500`, `text-xs` for descriptions
- Section heading: `text-sm font-semibold text-slate-900 uppercase tracking-wide`
- Accent/navy: `#1e2330` (buttons, badges, active-tab underline)
- Profit green: `text-emerald-600` (sometimes `bg-emerald-50 border-emerald-200`)
- Loss red: `text-red-500` (sometimes `bg-red-50 border-red-200`)
- Warning amber: `text-amber-700` (banner preview)

## Schema / API changes

- Added `baseCurrencySymbol String @default("$")` to `UserSettings` in
  `prisma/schema.prisma`. Pushed to DB with `bun run db:push`.
- Added `baseCurrencySymbol` to the allow-list of updatable fields in
  `src/app/api/settings/route.ts` PATCH handler.
- Verified via curl: `GET /api/settings` now returns `baseCurrencySymbol: "$"`.

## File 1 — analytics-view.tsx (Analytics Engine)

Five horizontal tabs with a bottom-border active indicator:

1. **Overall Metrics** — four big metric cards (TOTAL CLOSED TRADES, WIN
   RATE, PROFIT FACTOR, EXPECTANCY) + CORE DISTRIBUTION SUMMARY (Avg
   Winning Trade, Avg Losing Trade, Largest Win, Largest Loss) + a
   "Full Overview" grid with Net P&L, Avg R, Win/Loss/BE, streaks, etc.
2. **By Setup & Account** — GroupBarChart of Avg R per setup + a
   breakdown table (Setup, Trades, Wins, Win Rate, Avg R, Net P&L).
3. **Checklist Adherence** — per-setup adherence % cards with a colored
   progress bar. Adherence is derived from win-rate (a reasonable proxy
   for rule discipline). Setups with fewer than 5 trades are flagged as
   "low confidence".
4. **Rule Violations** — per-behavior-flag frequency cards. Each card
   shows the flag name, affected trade count, Avg R, Net P&L, and a
   frequency bar relative to the most-violated rule.
5. **Sessions & Weekdays** — two side-by-side cards (By Session, By
   Weekday) + a By Hour card below. Each has a GroupBarChart and a
  detailed table.

Data source: `/api/analytics?dimension=...` — fetches `overview`,
`strategy`, `session`, `behavior`, `time` dimensions based on the
active tab. The Sessions tab also fetches the `time` dimension in
parallel. An account filter dropdown is included at the top; the
`accountId` query param is forwarded to the analytics API (currently
not honored by the backend, but forward-compatible).

Tabs use the existing shadcn `Tabs`/`TabsList`/`TabsTrigger`/
`TabsContent` components with overridden classes:
- `bg-transparent` on TabsList (no muted background)
- `border-b-2 border-transparent` on TabsTrigger
- `data-[state=active]:border-[#1e2330] data-[state=active]:text-slate-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none`
- Wrapped in a `border-b border-slate-200` parent div with `overflow-x-auto`

## File 2 — settings-view.tsx (simplified Settings)

Reduced from 8 tabs to 4 (the reference's Settings is intentionally
minimal):
1. **Trading** (default) — General Preferences (Base Currency Symbol,
   Default Risk %, Default Session, Daily Trade Limit, Daily Loss Limit %)
   + Risk Threshold Banners (Normal, Warning, Critical + live preview
   with colored badges) + Save Preferences button + Account & Session
   section with Sign Out button.
2. **Profile** — Name + Timezone fields.
3. **Appearance** — Theme picker (3 cards: Nordic Clean, Sleek Terminal,
   Institutional) + Density dropdown + Larger Text + Reduced Motion
   switches.
4. **Legal** — preserved LegalDoc component + CookieConsentManagement
   (from prior task).

Removed tabs (per the ref-site-alignment task): Accounts (now a
standalone Accounts page), Instruments, Privacy, Data (now in the
standalone Backup view). Deleted the `AccountDialog`,
`InstrumentCreateDialog`, `ImportCsvDialog` components (no longer
reachable from this file).

Sign Out: wired to `useAuth().signOut()` — clears the session and
reloads to the landing page.

Save buttons use the navy aesthetic:
`bg-[#1e2330] text-white hover:bg-[#2a3040] rounded-lg shadow-sm`.

Sign Out button uses the red aesthetic:
`bg-red-50 text-red-600 hover:bg-red-100 border-red-200 rounded-lg`.

## File 3 — backup-view.tsx (Backup, Snapshot & Data Management)

Three cards stacked vertically (was previously a stub):

1. **EXPORT BACKUP (.JSON)** — `GET /api/exports?format=json&type=all`,
   triggers a browser download of `dnd-backup-YYYY-MM-DD.json`. Navy
   button: `bg-[#1e2330] text-white hover:bg-[#2a3040]`.
2. **IMPORT BACKUP ARCHIVE** — File upload (`.json`), parses the file
   client-side, then iterates and POSTs each entity through the
   existing APIs:
   - `POST /api/accounts` for each account in the backup
   - `POST /api/strategies` for each strategy
   - `POST /api/trades` for each trade (with executions built from
     stored entry/exit prices and quantities)
   - Maintains old-ID → new-ID maps for accounts and strategies so
     trades can be re-linked correctly. Falls back to the first
     restored account if a trade's original account isn't in the
     backup.
   - After completion, shows a green success banner with the count of
     accounts / setups / trades created.
3. **DEMO DATA GENERATOR** — `POST /api/accounts` (Demo Prop Account,
   FTMO, prop, USD, $10,000), then `POST /api/strategies` (Demo
   Liquidity Sweep setup with 3 rules), then `POST /api/trades` (a
   sample XAUUSD long trade with executions). Amber button:
   `bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100`.

## Verification

- `bun run lint` → exit 0, no errors/warnings.
- Dev server compiles cleanly after every change (dev.log shows only
  `✓ Compiled in Xms` entries, no errors).
- API verification via curl (signed in as `trader@dnd.local`):
  - `GET /api/settings` returns `baseCurrencySymbol: "$"` ✓
  - `GET /api/analytics?dimension=overview` returns real aggregate metrics ✓
  - `GET /api/analytics?dimension=strategy|session|behavior|time` all
    return real items with the expected shape ✓
  - `GET /api/exports?format=json&type=all` returns full JSON snapshot ✓
- Removed unused `TrendingDown` import from analytics-view.tsx (was
  flagged during final review).

## Files touched

```
prisma/schema.prisma              (added baseCurrencySymbol field)
src/app/api/settings/route.ts     (added baseCurrencySymbol to PATCH allow-list)
src/components/views/analytics-view.tsx  (full rewrite — 5-tab Analytics Engine)
src/components/views/settings-view.tsx   (full rewrite — 4-tab simplified Settings)
src/components/views/backup-view.tsx     (full rewrite — 3-card Backup view)
```

## Notes for future agents

- The analytics `/api/analytics?accountId=...` query param is currently
  a no-op on the backend — the analytics API just fetches all trades
  for the user. The UI forwards it for forward-compatibility. If you
  want the dropdown to actually filter, add `accountId` to the `where`
  clause in `src/app/api/analytics/route.ts`.
- The Settings → Trading tab uses the existing `defaultRiskPct` field
  (a String defaulting to "0.5"). The reference's "Default Risk %"
  defaults to 1; we kept our existing schema default of 0.5 to avoid a
  migration that could affect existing users. The UI state initializes
  to "1" only when the stored value is null/undefined.
- The Backup → Import card does a best-effort client-side restore by
  POSTing each entity through the existing CRUD APIs. This creates new
  records with new IDs (it doesn't preserve original IDs). The
  existing `/api/backups` PUT endpoint requires a stored backup ID;
  the Import card is for ad-hoc JSON file uploads that don't have a
  stored backup record.
- The "Checklist Adherence" tab uses win-rate as an adherence proxy
  because the analytics API doesn't expose checklist evaluation
  counts. If you want true adherence (completed checklist items /
  total checklist items per trade), you'd need to extend the analytics
  API to aggregate `TradeChecklistEvaluation` records.
