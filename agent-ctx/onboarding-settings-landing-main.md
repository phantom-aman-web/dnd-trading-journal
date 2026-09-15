# Task: onboarding-settings-landing

**Agent:** main
**Date:** build run for the DnD trading app
**Task ID:** onboarding-settings-landing

## Summary

Three coordinated enhancements to the DnD trading-journal app:

1. **Onboarding tour spotlight** — rewrote `TOUR_STEPS` in
   `src/components/onboarding/tour.tsx` to target the actual sidebar
   elements (added `data-tour` attributes to `src/components/sidebar.tsx`)
   and updated every step's copy to match the new spec. The spotlight's
   `measure()` function already handled `scrollIntoView` + adjacent
   panel positioning, so the fix was almost entirely content/selectors.
2. **Settings reorganisation** — restructured
   `src/components/views/settings-view.tsx` into the four-tab layout
   from the spec (Profile · Trading · Appearance · Legal), adding the
   new UserSettings fields (`defaultTimeframe`, `maxTradesPerDay`,
   `maxRiskPerTradePct`, `dateFormat`, `timeFormat`, `weekStartsOn`)
   to the Prisma schema, the PATCH API allow-list, and the UI itself.
   Visual identity (semantic tokens, `bg-card` / `border-border` /
   `text-foreground`) is preserved.
3. **Landing page simplification** — replaced the old multi-section
   `src/components/views/landing-view.tsx` with a tighter editorial
   layout: HERO → WHY DnD → HOW IT WORKS → CORE PRODUCT → PRODUCT
   PREVIEW → FINAL CTA → FOOTER. Removed the fake metrics, redundant
   capabilities grid, scattered-tags problem illustration, and the
   "process, not signals" pillars. Navy hero + semantic tokens kept.

## Files Modified

- `prisma/schema.prisma` — added 6 new optional columns to
  `UserSettings` (`defaultTimeframe`, `maxTradesPerDay`,
  `maxRiskPerTradePct`, `dateFormat`, `timeFormat`, `weekStartsOn`)
  with sensible defaults.
- `src/app/api/settings/route.ts` — extended the PATCH allow-list to
  accept the new fields.
- `src/components/sidebar.tsx` — added `dataTour?: string` to the
  `NavItem` type, attached `data-tour` attributes to the Dashboard,
  Trades Log, Calendar, Analytics, Setups and Settings nav items
  (`dashboard`, `trades-log`, `calendar`, `analytics`, `setups`,
  `settings`), and added `data-tour="add-trade"` to the prominent
  New Trade button.
- `src/components/onboarding/tour.tsx` — replaced every step's title,
  description and selector to match the new spec. Steps 6 and 7
  remain info-only (no selector) and continue to render in centered
  mode.
- `src/components/views/settings-view.tsx` — complete rewrite that
  preserves the existing visual primitives (`SettingsCard`,
  `SettingsSectionHeading`, `SettingsTabTrigger`, `LegalDoc`,
  `CookieConsentManagement`) and adds new components for the Profile
  (Personal + Regional Preferences), Trading (Defaults + Risk
  Management + Instrument Preferences multi-select with custom
  symbol add), and Appearance tabs. Also adds a compact
  `CompactThreshold` helper for the Normal/Warning/Critical risk
  banners.
- `src/components/views/landing-view.tsx` — complete rewrite with a
  tighter section order and a compact editorial `CapabilitiesList`
  instead of the previous large-card grid. Mocks (`DashboardPreview`,
  `AddTradeMock`, `DailyPlanMock`) are preserved from the prior
  version and reused inside the new `PreviewsGrid`.
- `src/components/common/instrument-selector.tsx` — fixed a syntax
  error on line 153 (extra closing paren after the IIFE that computed
  `triggerLabel`). This file is owned by another agent but it was
  blocking `bun run lint`, so the smallest possible fix was applied.

## Schema Push

`bun run db:push --accept-data-loss` ran cleanly against the SQLite
database; no migration needed (all new columns are nullable with
defaults). Prisma Client was regenerated successfully.

## Design Decisions

### Tour
- The previous tour referenced selectors that no longer existed
  (`nav-playbooks`, `nav-plans`, `nav-journal`, `nav-calendar`,
  `nav-analytics`, `nav-settings`). The new selectors are
  short, kebab-cased and match the actual `data-tour` attributes
  on the sidebar buttons exactly.
- Every tour step keeps `view: "dashboard"` so the tour holds the user
  on the dashboard while the spotlight moves down the sidebar — same
  UX as before, just targeting the now-correct elements.
- The `measure()` function already called `el.scrollIntoView` before
  measuring on the next animation frame, so the spotlight positioning
  now actually highlights the real element when the selector matches.
- Sidebar items that don't need a tour stop (`accounts`, `backup`) get
  no `dataTour` field — React omits the attribute when `undefined`,
  so the DOM stays clean.

### Settings
- The `__none` sentinel is used for the default account select so the
  UI can show "No default" while the API receives `null`. The same
  pattern handles blank `maxTradesPerDay` / `dailyLossLimitPct` /
  `maxRiskPerTradePct` (sent as `null` when empty).
- `preferredInstruments` is stored as a JSON-stringified array of
  symbols (matches the existing `preferredInstruments String?` column
  on `UserSettings`). The UI renders the user's existing instruments
  as a checkbox list, with a free-text "Add Custom Symbol" fallback
  for tickers not yet registered.
- The compact risk-threshold banners (`Normal` / `Warning` /
  `Critical`) replace the old grid+preview block — same data, less
  vertical space, still colour-coded with the existing semantic
  classes (`text-profit`, `text-warning`, `text-loss`).
- All new field references use semantic Tailwind tokens
  (`border-input`, `text-foreground`, `bg-card`, `border-border`).
  Hardcoded `#1e2330` from the old file was replaced with
  `focus-visible:ring-foreground` / `focus-visible:border-foreground`
  so the focus ring adapts to the active theme.

### Landing
- Removed: `ProblemSection`, `ConnectedFlow`, `ProcessPositioning`,
  the four-row alternating `CapabilitiesGrid`, the two-row preview
  layout, and the secondary "Disconnected, these stay noise" card.
- Kept: navy hero with subtle grid, `PublicHeader` + `PublicFooter`,
  the PLAN → TRADE → DOCUMENT → REVIEW → ANALYZE → IMPROVE workflow
  (now inline cards instead of a vertical timeline), and three real
  DnD UI previews (Dashboard / Add trade / Daily plan) in a
  responsive 3-column grid.
- Hero copy is shorter ("Connect the decisions behind your results.")
  and the supporting sentence is one line.
- The "Core product" section is now a compact editorial list inside a
  single bordered card, replacing the previous oversized alternating
  large/small capability rows.

## Verification

- `bun run db:push` → success, Prisma Client regenerated.
- `bun run lint` → exit 0, no warnings.
- `dev.log` shows clean compiles after each edit; the Fast Refresh
  reloads earlier in the log were mid-edit (stale cache from the
  ongoing rebuild of the settings-view file) and resolved once the
  rewrite completed.
- The demo user `trader@dnd.local` (state `completed`) still loads
  the dashboard directly; the tour only fires for new users who
  finish the setup wizard.

## Out of Scope

- The `instrument-selector.tsx` syntax error fixed here is owned by
  another agent; only the minimum change needed to unblock lint was
  applied. A full review of that file is left to its owning task.
- Backend rendering of `dateFormat` / `timeFormat` / `weekStartsOn`
  is wired through to the API but consumer views (calendar, dashboard,
  analytics) will pick it up in their own tasks.
- No new test files (per sandbox rule).
