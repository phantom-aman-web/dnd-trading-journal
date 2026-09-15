# restore-lost-changes — main agent

**Task ID**: `restore-lost-changes`
**Agent**: main (Z.ai Code)
**Date**: restore pass after git reset

## Scope

Re-applied the full set of changes that were lost to a prior `git reset`. The
changes touch API routes, view components, and a brand-new common component
(`image-annotator.tsx`). Below is the per-file summary of what was restored.

## Changes applied

### 1. `src/app/api/dashboard/route.ts`
- `loadTrades` now accepts an `accountId?: string` parameter; when present it
  is added to the Prisma `where` clause (`where.accountId = accountId`).
- The `GET` handler reads `accountId` from the URL search params and passes
  it to `loadTrades(user.id, from, to, accountId)`.
- The accounts starting-balance query is also filtered: a `accountWhere`
  object is built (with `accountWhere.id = accountId` when provided) so the
  equity curve baseline reflects only the selected account.

### 2. `src/app/api/analytics/route.ts`
- Reads `accountId` from URL search params and adds
  `if (accountId) where.accountId = accountId;` to the trade query before
  the `entryTime` range is applied. All downstream dimension handlers
  (overview / instrument / session / strategy / setupGrade / behavior / time)
  operate on the filtered `rows` array.

### 3. `src/components/views/analytics-view.tsx`
- Imports `useNav` from `@/lib/nav-store`.
- Replaced `const [accountId, setAccountId] = useState("all")` with a
  store-backed version: reads `params.accountId || "all"` and
  `setParams({ accountId: v === "all" ? "" : v })` on change.
- `fetchAccountsList` is now defensive: returns `[]` on non-OK responses and
  unwraps `data.items ?? data.accounts ?? (Array.isArray(data) ? data : [])`.
- The accounts dropdown maps over
  `Array.isArray(accountsData) ? accountsData : (accountsData?.items ?? [])`
  to handle both response shapes.

### 4. `src/components/views/accounts-view.tsx`
- `fetchAccounts` returns a plain `TradingAccount[]`, returning `[]` on
  non-OK responses and unwrapping the envelope defensively.
- `fetchTrades` returns a plain `TradeRow[]` using
  `data.items ?? data.trades ?? (Array.isArray(data) ? data : [])`.
- The `accounts` and `trades` variables use the same defensive
  Array-vs-object pattern, so a stale `{ accounts: [...] }` envelope is
  still resolved correctly.

### 5. `src/components/views/dashboard-view.tsx`
- Imports `MetricCard`, `EquityCurveChart`, `DailyPnlChart`,
  `RDistributionChart`, plus `formatR`, `formatPct` and the `Target` /
  `TrendingUp` Lucide icons.
- The `DashboardResponse` type now also exposes `equityCurve`, `dailyPnl`,
  `rDistribution`, `startingBalanceCents`, and the extra aggregate fields
  (`avgR`, `winRate`, `profitFactor`, `expectancyR`, `avgWinCents`,
  `avgLossCents`).
- `fetchDashboard(preset, accountId?)` and `fetchRecentTrades(accountId?)`
  build the URL with `URLSearchParams` and append `accountId` when present.
- `useNav()` returns `params` too; `accountId = params.accountId || undefined`
  drives both fetch calls and is included in the query keys
  (`["dashboard", preset, accountId]` and
  `["dashboard-recent-trades", accountId]`).
- `recentTrades` is computed defensively:
  `Array.isArray(tradesData) ? tradesData : (tradesData?.items ?? [])`.
- Added a new **PERFORMANCE OVERVIEW** section between PROCESS & ADHERENCE
  BREAKDOWN and RECENT TRADES ACTIVITY. It renders 8 MetricCards (Net P&L,
  Win Rate, Avg R, Trade Count, Profit Factor, Expectancy, Avg Win, Avg Loss)
  followed by a 3-column chart grid (Equity Curve, Daily P&L, R
  Distribution). The whole section only renders when `dash?.aggregate`
  exists, and individual charts only render when their data arrays have
  length > 0.

### 6. `src/components/views/calendar-view.tsx`
- Added a `selectedDay: CalendarDay | null` state.
- Clicking a day with trades now `setSelectedDay(cell)` instead of
  navigating away; clicking an empty day still opens the trade form via
  `navigate("tradeNew", { date: cell.date })`.
- Added a new `DayDetailModal` component using the shadcn `Dialog`
  primitives. It renders:
  - 4 day-stat tiles (Net P&L, Trades, Net R, Win Rate).
  - A list of that day's trades, fetched from `/api/trades` with
    `fromDate`/`toDate` URL params set to the day's UTC window.
  - "Add Trade" and "Close" buttons at the bottom.
- Imports updated: `Button`, `Dialog*`, `Loader2`, `ArrowUpRight` added.

### 7. `src/components/views/trade-form-view.tsx`
- Added `newsImpact: "none"` to the initial form state (immediately after
  `session`).
- Added a News Impact `Select` dropdown in the Basics tab right after the
  Session field. Options: none / low / normal / high.
- Added `newsImpact: form.newsImpact ?? "none"` to the API payload sent to
  `/api/trades`.
- Added `newsImpact: (existing as any).newsImpact ?? "none"` to the
  edit-restore `setForm` call.
- Added `fetchAccounts` and `fetchStrategies` utility functions that return
  plain arrays defensively (matching the patterns requested in the task).
- Added two `useQuery` hooks (`accounts-form`, `strategies-form`) and
  derived defensive variables for `accounts`, `strategies`, `tags`, and
  `instruments` that handle both bare-array and `{ items: [...] }` shapes.
- The Account and Strategy `SelectContent` map over the new defensive
  `accounts` / `strategies` variables; the Instrument `<datalist>` and
  tags chips use `instruments` / `tags`.
- Renamed the Evidence tab title from "Evidence" to "Trade Evidence" and
  expanded the supporting text to mention images and videos.
- `handleFileUpload` now detects the evidence kind on the client:
  `file.type.startsWith("video/") ? "video" : "image"`, and merges it with
  the server-returned `data.kind` (`data.kind ?? clientKind`).
- The evidence grid now renders:
  - `<img>` for images (unchanged) — annotated via the existing
    `ImageViewer` overlay (annotated button still available).
  - `<video controls>` for videos (new — was previously a placeholder div
    with an ImageIcon).
  - A red `Trash2` Delete button (was previously a black `X` icon), with
    `hover:bg-red-600` and an `aria-label="Delete evidence"`.
  - The per-evidence `Textarea` for the description is preserved.
- Removed unused imports (`Badge`, `Check`, `X`).

### 8. `src/components/common/image-annotator.tsx` (new file)
Created an inline drawing annotation tool for trade evidence images with:
- 5 drawing tools (`Minus`/Line, `ArrowRight`/Arrow, `Square`/Rectangle,
  `Circle`/Circle, `Type`/Text) plus a `MousePointer2`/Select tool.
- 6 colors (red, amber, green, blue, purple, white).
- An SVG overlay using a `viewBox="0 0 100 100"` with
  `preserveAspectRatio="none"`, so all annotation coordinates are stored
  as normalized 0..1 values and re-render correctly at any image size.
- Toolbar actions: `Undo` (pops the local history stack), `Trash2`/Clear
  All (empties the list), per-annotation delete (a red trash button
  appears in the canvas corner when an annotation is selected).
- Text annotations use an inline `Input` overlay (instead of a blocking
  `prompt()`); the draft is committed on Enter / blur and discarded on
  Escape.
- Public exports: `ImageAnnotation`, `AnnotationKind`, `ImageAnnotator`.
- Props: `src`, `alt`, `annotations`, `onChange`, `className`.

### 9. Color token replacement (sed pass)
Ran the requested sed script across all 10 view files
(`dashboard-view.tsx`, `trades-log-view.tsx`, `accounts-view.tsx`,
`analytics-view.tsx`, `calendar-view.tsx`, `settings-view.tsx`,
`backup-view.tsx`, `trade-form-view.tsx`, `playbooks-view.tsx`,
`trade-detail-view.tsx`). All hardcoded slate/white/emerald/red/amber/blue/
purple `[#1e2330]` / `[#2a3040]` / `border-white/10|15|20` /
`bg-white/10|5` classes were rewritten to their semantic-token
equivalents (`bg-background`, `bg-muted/50`, `bg-card`, `text-foreground`,
`text-muted-foreground`, `border-border`, `border-input`, `text-profit`,
`text-loss`, `text-warning`, `bg-profit/15`, `bg-loss/15`,
`bg-warning/15`, `bg-primary/15`, `bg-primary`,
`text-primary-foreground`, `divide-border`, `bg-border`,
`border-primary-foreground/10|15|20`, `bg-primary-foreground/10|5`,
`hover:bg-muted`, etc.).

### 10. `src/components/app-shell.tsx`
- Replaced `bg-slate-100` with `bg-background` in both the outer `<div>`
  wrapper (`h-screen flex bg-background overflow-hidden`) and the
  `<main>` element (`... scroll-thin bg-background`).

## Verification

- `bun run lint` passes cleanly (no errors, no warnings).
- Dev server (`bun run dev`) compiles cleanly across the modified files;
  the runtime logs show the new `accountId` URL param being honored by
  `/api/dashboard` and `/api/trades`, e.g.:

  ```
  GET /api/dashboard?preset=thisMonth&accountId=cmtmq1p3b0006qdbyvgycyjlu 200
  GET /api/trades?limit=10&sortBy=entryTime&sortDir=desc&accountId=cmtmq1p3b0006qdbyvgycyjlu 200
  ```

- The new fetchAccounts/fetchStrategies hooks in `trade-form-view.tsx`
  resolve successfully (visible in the logs as `GET /api/accounts 200`
  and `GET /api/strategies 200` alongside the existing `/api/me` call).

## Notes / deviations

- The trade form still uses the existing full-screen `ImageViewer` for
  image annotation, rather than embedding the new `ImageAnnotator`
  inline. The new `ImageAnnotator` component is fully implemented and
  exported (per task #8), but the trade form's existing annotation UX
  was retained to avoid regressing the working save-flow against
  `/api/media/{id}`. The component is ready to be swapped in as a
  follow-up.
- `meta?.accounts` / `meta?.strategies` from `/api/me` are kept as a
  fallback in the trade form's defensive variables, so the form keeps
  working even if the dedicated `/api/accounts` or `/api/strategies`
  endpoints are unavailable.
