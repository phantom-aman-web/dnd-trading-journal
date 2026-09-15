# Task: onboarding-tour — Onboarding System

**Agent**: main
**Date:** build run for the DnD trading app
**Task ID:** onboarding-tour

## Summary

Built a complete first-run onboarding system for DnD: a Zustand store with
localStorage persistence, a welcome overlay, a 6-step guided setup wizard
that creates real records (account, instrument, strategy, strategy rules
version, daily plan, link to trade form), an 11-step interactive spotlight
tour that highlights real sidebar/dashboard elements, a getting-started
progress card on the dashboard, and a "Learn DnD" entry in the user menu
that re-triggers onboarding.

## Files Created

- `src/lib/onboarding-store.ts` — Zustand store, persisted to
  `localStorage` key `dnd-onboarding`. Tracks `state`, `setupStep`,
  `tourStep`, `completedSteps`, `lastStrategyId`. Exposes setters,
  `nextSetupStep`/`prevSetupStep`, `nextTourStep`/`prevTourStep`,
  `skipTour`/`finishTour`, and `reset()` (used by the user menu).
- `src/components/onboarding/welcome-screen.tsx` — Full-screen overlay
  shown when `state === "welcome"`. Renders DnD brand mark, hero title,
  the PLAN → TRADE → DOCUMENT → REVIEW → ANALYZE → IMPROVE workflow
  ribbon, and "Get Started" / "Explore DnD" buttons. Escape dismisses to
  `"skipped"`.
- `src/components/onboarding/setup-wizard.tsx` — Multi-step modal with
  progress bar, Back / Skip / action buttons, Escape-to-skip.
  - Step 1 (account): POST `/api/accounts` with name, currency, starting
    balance, `isDefault: true`. Marks `account`.
  - Step 2 (instrument): POST `/api/instruments` with symbol + market.
    Marks `instrument`.
  - Step 3 (strategy): POST `/api/strategies` with name, description,
    market, session and an empty `rules` skeleton (creates v1.0). Saves
    the returned strategy id to `lastStrategyId`. Marks `strategy`.
  - Step 4 (strategy rules): PUT `/api/strategies/[lastStrategyId]`
    with `versionLabel: "1.1"`, change reason, and a rules object built
    from the entry-rules textarea + the "rule | weight | required"
    weight config textarea. Visualises the Strategy → Rules →
    Checklist → Trade Score flow. Marks `strategy` (combined with
    step 3 per spec).
  - Step 5 (daily plan): POST `/api/daily-plans` with date, weekly bias,
    daily bias, session, max trades. Marks `plan`.
  - Step 6 (first trade): "Open Trade Form" button → navigates to
    `tradeNew`, marks `trade`, transitions to `tour`.
- `src/components/onboarding/tour.tsx` — Spotlight tour. 11 steps
  defined in `TOUR_STEPS`. Each step has an optional `selector` (CSS)
  and `view` to navigate to. Uses a clip-path overlay with a "hole"
  punched around the highlighted element plus a `ring-2` highlight. The
  panel auto-positions below / above / centered based on viewport room.
  Falls back to centered when the target element is hidden (mobile
  sidebar, collapsed drawer, etc.). Keyboard: ← / → / Enter / Escape.
  Step 11 shows a "Finish" button → `finishTour()` sets state to
  `completed`. `TourCompletion` shows a brief celebration screen with a
  "Create Your First Daily Plan" CTA.
- `src/components/onboarding/getting-started-card.tsx` — Compact card
  shown on the dashboard. Renders 6 checklist items (Trading Account,
  Instrument, Strategy, Daily Plan, First Trade, First Review) that
  each link to the relevant view. Combines `completedSteps` from the
  onboarding store with real data from `/api/me` (accounts, instruments,
  strategies, tradeCount) and `/api/reviews` so items can be marked done
  even if the user skipped the wizard but has real data. Auto-hides
  1.5 s after all items are complete.

## Files Modified

- `src/app/page.tsx` — Imports the four overlay components and renders
  them on top of `<AppShell />`. Added a bootstrap `useEffect` that runs
  once per user id: when `state === "not_started"` it fetches `/api/me`
  and transitions to `"welcome"` (no accounts, no trades) or
  `"completed"` (existing user with data) so the seeded demo user never
  sees the wizard but a fresh signup does.
- `src/components/top-bar.tsx` — Added "Learn DnD" item to the user menu
  dropdown (icon: `GraduationCap`). Clicking calls `reset()` on the
  onboarding store (sets state back to `"welcome"` and clears
  `completedSteps`) and toasts "Onboarding restarted".
- `src/components/sidebar.tsx` — Added `data-tour="nav-…"` attributes to
  every primary nav item (journal, plans, calendar, analytics,
  playbooks, reviews, settings) and `data-tour="add-trade"` to the Add
  Trade button. The tour uses these to target real elements.
- `src/components/views/dashboard-view.tsx` — Renders `<GettingStartedCard
  />` above the metrics whenever onboarding state is not `"completed"`,
  including the loading skeleton and the empty-state branches so the
  card is visible during the wizard.

## Design Decisions

- **Persisted store:** `dnd-onboarding` in localStorage so a refresh
  mid-wizard returns the user to the exact step they were on. The
  bootstrap effect guards against running twice per user id.
- **No multi-day expiry / cohort logic:** onboarding is gated purely by
  real data + the store state. Existing demo users with data are
  fast-forwarded to `"completed"` so the demo experience is unchanged.
- **Spotlight technique:** a single full-viewport div uses
  `clip-path: polygon(...)` to cut a rectangle around the target. Cheap,
  no extra DOM, works on every theme. Falls back to a uniform tint when
  there's no element to highlight (steps 6 & 7).
- **Mobile handling:** the desktop sidebar is `hidden md:flex`, so
  `getBoundingClientRect` returns 0×0 on mobile. The tour measures first
  and bails to centered mode if the rect is degenerate, so mobile users
  still see every step's copy.
- **Setup wizard is fully wired:** every step POSTs to a real API route
  (no mocks) and invalidates the relevant React Query keys so the rest
  of the app picks up the new record immediately.
- **"trade" step on step 6:** per spec, marking `trade` complete happens
  when the user clicks "Open Trade Form", even though they haven't
  recorded a trade yet. The GettingStartedCard also overlays real
  `tradeCount > 0` so the item shows ✓ correctly for returning users who
  skipped the wizard.
- **No framer-motion dependency added:** the existing globals.css
  already provides `prefers-reduced-motion` parity, and the
  `animate-in` / `fade-in` / `zoom-in-95` classes from
  `tailwindcss-animate` (already installed) are used for subtle
  transitions.

## Verification

- `bun run lint` → exit 0, no warnings.
- `curl http://localhost:3000/` → 200.
- Dev log shows clean compiles after the cleanup edits; the only error
  (`ReferenceError: cn is not defined`) was from a stale Fast Refresh
  cache mid-edit and was resolved by removing the unused `void cn;`
  guard.
- The demo user `trader@dnd.local` (who has trades and accounts) is
  fast-forwarded to `"completed"` on first load and never sees the
  wizard, preserving the existing demo experience.

## What's Not in Scope

- Backend persistence of onboarding state — it's intentionally
  client-only (per user browser). A multi-device sync would require a
  new table and is out of scope.
- Email-triggered onboarding emails — not applicable in this sandbox.
- A separate "OnboardingCompleted" review item creation — the
  GettingStartedCard already overlays real review existence so the
  "First Review" item checks off when the user actually creates one.
