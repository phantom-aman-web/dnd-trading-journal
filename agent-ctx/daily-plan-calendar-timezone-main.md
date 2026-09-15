# Task ID: daily-plan-calendar-timezone
## Agent: main

### Summary
Implemented three UI features for the DnD trading app:
1. **Daily Plans UI** (Issue 2) — New "Daily Plans" view with list, create/edit dialog, and detail panel.
2. **Calendar Day Detail Enhancement** (Issue 3) — Summary metrics card + strategy names + daily plan link in the day popup.
3. **Timezone Selector** (Issue 4) — Searchable IANA timezone dropdown replacing the free-text input in Settings.

### Files Touched

**Modified:**
- `src/lib/nav-store.ts` — Added `"plans"` to the `ViewKey` union.
- `src/components/sidebar.tsx` — Added "Daily Plans" nav item with `ClipboardList` icon.
- `src/components/mobile-nav.tsx` — Replaced "More" (Menu/Settings) with "Plans" (ClipboardList).
- `src/components/app-shell.tsx` — Imported `PlansView` and added view switching.
- `src/app/page.tsx` — Added `"plans"` to `APP_VIEWS` for optimistic AppShell rendering.
- `src/components/command-palette.tsx` — Added `ClipboardList` import + "Open Daily Plans" command.
- `src/components/views/calendar-view.tsx` — Rewrote day-detail dialog with summary + strategy names + plan link, widened to `max-w-2xl`.
- `src/components/views/settings-view.tsx` — Replaced timezone `<Input>` with `<TimezoneSelect>`.

**Created:**
- `src/components/views/plans-view.tsx` — New view: list grouped by month, detail panel, create/edit dialog with all 15 DailyPlan fields.
- `src/components/common/timezone-select.tsx` — Popover + cmdk combobox for searchable IANA timezone selection.
- `src/lib/timezones.ts` — `getIanaTimezones()` (uses `Intl.supportedValuesOf('timeZone')` with 60+ timezone fallback) + `formatTimezoneLabel()`.
- `src/app/api/daily-plans/[id]/route.ts` — New GET + DELETE endpoints (DELETE unlinks trades via `onDelete: SetNull`).

### Implementation Notes

**Issue 2 — Daily Plans UI:**
- Layout: `grid lg:grid-cols-3` with list (left) + detail (right), mirroring the Playbooks view pattern.
- List groups plans by "Month Year" sticky headers, sorted newest-first.
- Each list row shows date, session badge, bull/bear bias badges, instruments + setup conditions preview.
- Detail panel renders all fields: biases, instruments, PWH/PWL/PDH/PDL grid, liquidity targets, HTF levels JSON (pretty-printed), setup conditions, invalidation, notes, max trades, max risk %.
- Create/Edit dialog uses `key={editingPlan?.id ?? "new"}` to remount the form whenever the target changes (so `useEffect` re-syncs the form state to the new plan).
- Both create and edit POST to `/api/daily-plans` (the API upserts by `userId_date`).
- Empty state uses the shared `EmptyState` component with a CTA button.
- Deep-linking: `useNav().params.id` (set by the calendar "View Plan" button) auto-selects a plan in the list.

**Issue 3 — Calendar Day Detail:**
- The dialog now has three sections:
  1. **Daily plan banner** (only when a plan exists for that day) — fetched via `GET /api/daily-plans?date=YYYY-MM-DD`. Shows bias + instruments, with a "View Plan" button that navigates to `plans` view with `{ id: plan.id }`.
  2. **Summary grid** — 4-column grid of metric cells: Trades (with W/L sub), Total P&L (with trend icon), Avg R, Win Rate, Best Trade (with Trophy icon), Worst Trade, A+ Trades (with Target icon), Rule Violations (with AlertTriangle icon), Primary Session.
  3. **Trades list** — Scrollable (`max-h-[40vh]`), each row shows direction badge, instrument, setup grade badge, **strategy name** (from `t.strategy?.name`), P&L, R. Clicking navigates to trade detail.
- Dialog widened from `max-w-lg` to `max-w-2xl` with `max-h-[90vh] overflow-y-auto`.
- Summary uses server-side aggregated metrics from the calendar API (`winRate`, `bestTradeCents`, `bestTradeR`, `worstTradeCents`, `ruleViolations`, `primarySession`, `aplusCount`) when available, falling back to computing from the trades list if the calendar query is still in flight.
- Verified the trades API already returns `strategy: { id, name }` and `strategyVersion: { id, versionLabel }` — no backend change needed for strategy names.

**Issue 4 — Timezone Selector:**
- Created `src/lib/timezones.ts` with `getIanaTimezones()` that uses `Intl.supportedValuesOf('timeZone')` (418 timezones in modern Node/browsers) and falls back to a curated list of 60+ timezones covering all major regions.
- `formatTimezoneLabel(tz)` produces "City (IANA/Identifier)" — e.g. "New York (America/New_York)", "Addis Ababa (Africa/Addis_Ababa)", "UTC (UTC)".
- `TimezoneSelect` is a Popover + cmdk combobox: trigger button shows the current label, content opens a search input + scrollable list. Selecting an item calls `onChange(tz)` with the raw IANA identifier.
- In `settings-view.tsx`, replaced `<Input value={timezone} onChange={...} />` with `<TimezoneSelect value={timezone} onChange={setTimezone} />`.
- The selected value persists via the existing `PATCH /api/settings` API and affects calendar/analytics as before (no backend change).

### Verification
- `bun run lint` — PASS (zero errors, zero warnings)
- `bun run tsc --noEmit` — Only pre-existing errors in files I didn't touch (e.g. `parseJson` returning `{}` in API routes — a pre-existing codebase pattern). My new files (plans-view, calendar-view, timezone-select, timezones.ts, daily-plans/[id]/route.ts) have zero TS errors.
- API smoke tests via curl (signed in as `trader@dnd.local`):
  - `GET /api/daily-plans` → returns 8 seeded plans, sorted desc by date
  - `POST /api/daily-plans` → created a test plan successfully
  - `DELETE /api/daily-plans/[id]` → returned `{"ok":true}` (new endpoint)
  - `GET /api/daily-plans/[id]` → returned plan (new endpoint)
  - `GET /api/daily-plans?date=YYYY-MM-DD` → returns single plan (existing endpoint, used by calendar day detail)
  - `GET /api/calendar?year=2026&month=9` → returns days with all expected summary metrics (`winRate`, `bestTradeCents`, `bestTradeR`, `worstTradeCents`, `ruleViolations`, `primarySession`, `aplusCount`)
  - `GET /api/trades?limit=2` → returns items with `strategy.name` populated (used in calendar day-detail trade rows)
- Dev server log shows all routes returning 200, no runtime errors after the changes.
