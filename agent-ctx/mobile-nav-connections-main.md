# Task: mobile-nav-connections

## Scope

Five connected UX improvements to the DnD trading application:

1. **Mobile navigation** — Replace the 5th bottom-bar item ("Plans") with a "More" button that opens a bottom sheet containing the remaining sidebar items grouped by the same hierarchy as the desktop sidebar (UNDERSTAND / BUILD / TRADE / SYSTEM).
2. **Calendar day-detail** — Add a "Create Plan" button when no daily plan exists for the selected day, and an "Add Trade for This Day" button at the bottom of the trades list.
3. **Daily Plans detail** — Add a "Create Trade From Plan" button that navigates to the trade form with the plan ID pre-selected.
4. **URL param handling** — Trade form pre-fills `entryTime` (at market open 09:00) from `params.date` and `form.dailyPlanId` from `params.dailyPlanId`. Plans view opens the create dialog with the date pre-filled from `params.date`.
5. **Trade detail** — Add a "View Daily Plan" button when the trade has a `dailyPlanId`.

## Files Modified

- `src/components/mobile-nav.tsx` — Rewrote: 4 fixed bottom-bar items + "More" button opening a Radix `Sheet` (side="bottom") with grouped nav.
- `src/components/views/calendar-view.tsx` — Three-state daily-plan banner (exists / null / loading) + "Create Plan" CTA; "Add Trade for This Day" button in trades list and in empty state.
- `src/components/views/plans-view.tsx` — "Create Trade From Plan" button in `PlanDetail`; new `initialDate` state + effect to open the create dialog with a pre-filled date from `params.date`; `PlanFormDialog` accepts an optional `initialDate` prop.
- `src/components/views/trade-form-view.tsx` — New effect (after draft-restore) that pre-fills `form.entryTime` (`${params.date}T09:00`) and `form.dailyPlanId` from `params`; only for new trades.
- `src/components/views/trade-detail-view.tsx` — "View Daily Plan" outline button in the Actions row, visible only when `trade.dailyPlanId` is truthy.

## Verification

- `bun run lint` — PASS (zero errors, zero warnings).
- Dev server (`bun run dev`) — recompiled cleanly multiple times during edits; no compile or runtime errors in `dev.log`.
- All deep-link targets verified to consume their params via `useNav().params` and apply them through React effects, preserving the existing draft-restore + edit-load flows.

## Notes

- Mobile bottom bar kept at exactly 5 slots: Home, Journal, Add (center FAB), Calendar, More.
- The "More" sheet mirrors the desktop sidebar grouping (UNDERSTAND / BUILD / TRADE / SYSTEM) so the user sees the same hierarchy regardless of viewport.
- The "More" tab highlights when the active view is one of the items inside the sheet.
- `dayPlan === null` (explicit) distinguishes "no plan exists" from `dayPlan === undefined` (still loading) so the Create Plan CTA only renders after the plan-check query has resolved.
- The trade form's new param effect runs *after* the draft-restore effect on mount, so explicit deep-link values (date/dailyPlanId) override any restored draft entries.
- The trade form effect guards on `editingId` so deep-link params never override values loaded from an existing trade being edited.
