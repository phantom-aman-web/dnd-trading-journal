# Task: page-headers-help — Page purpose subtitles + contextual help tooltips

**Agent:** main (Task ID `page-headers-help`)
**Scope:** Add concise purpose subtitles under H1 headings on key views,
add contextual help tooltips in the trade-detail view, and refresh the
Playbooks empty-state copy. No UI redesign — text-only additions and
the existing FieldLabel/tooltip pattern reused.

## Context

This task follows onboarding-tour and several prior polish tasks. Prior
agents' work records live in `/home/z/my-project/agent-ctx/` and were
consulted for the existing FieldLabel hint pattern (used as the model for
the new trade-detail tooltips).

## Change 1 — Purpose subtitles under page headers

Added or updated the `text-sm text-muted-foreground` subtitle directly
below each H1.

| View | File | Before | After |
|------|------|--------|-------|
| Journal | `journal-view.tsx` | dynamic "X trades recorded" / "All your trades" | static "What did I trade?" + retained dynamic count as `text-xs` secondary line |
| Analytics | `analytics-view.tsx` | "Performance breakdown by every dimension." | "Find the patterns behind your performance." |
| Playbooks | `playbooks-view.tsx` | (no subtitle, only `<h1>Strategies</h1>`) | Added `<p>` "Build and evolve the rules you trade." |
| Reviews | `reviews-view.tsx` | "Daily, weekly and monthly performance reviews." | "Turn your trading data into lessons and actions." |
| Daily Plans | `plans-view.tsx` | "Pre-market bias, levels & limits." | Kept existing (task permitted) |
| Media Library | `media-view.tsx` | "Screenshots, chart recordings and evidence." | Kept existing (task permitted) |

Implementation notes:
- Journal: kept the dynamic trade count info as a smaller secondary
  `text-xs` line below the new static subtitle so the count info is
  not lost.
- Playbooks: wrapped the existing `<h1>` in a `<div>` so the subtitle
  can sit beneath it while the "New Strategy" `+` button stays aligned
  to the right via `justify-between`.

## Change 2 — Contextual help tooltips

### Verified (already present in `trade-form-view.tsx`)

- **Planned Entry** (Tab 3) — line 805:
  `hint="The price you planned to enter at"` ✓
- **Risk %** (Tab 2) — line 771:
  `hint="Risk as a decimal (e.g. 0.005 = 0.5%)"` ✓
  (minor wording variance — includes "e.g." — conveys the same meaning)
- **Strategy Version** (Trade Form) — line 691:
  `hint="The specific version of the strategy used"` ✓
  (minor wording variance — "specific" vs. "exact" — same meaning)

No edits made to these — verification only.

### Added (new) in `trade-detail-view.tsx`

Extended two existing internal components to accept an optional `hint`
string prop and render a `HelpCircle` icon with a hover/click tooltip,
mirroring the existing `FieldLabel` pattern (`onMouseEnter`/`onMouseLeave`
+ click-toggle, `top-4 z-50 w-48` absolutely-positioned tooltip
popover, identical `border-border bg-popover text-popover-foreground`
styling).

- **`MiniStat`** — added `hint?: string`. Renders the help icon inline
  next to the label row.
- **`SetupSection`** — added `hint?: string`. Renders the help icon
  inline next to the title row. Added `normal-case` class on the
  icon span and tooltip to undo the inherited `uppercase tracking-wide`
  from the title container.

Added the `HelpCircle` import to the lucide-react import block.

Wired the hints at the call sites:

| Field | Hint Text |
|-------|-----------|
| R Multiple (MiniStat in Quick Stats grid) | "Realized result relative to your planned risk" |
| Setup Score (SetupSection in Setup tab) | "Calculated from the weighted rules defined by your strategy" |

The Setup Score hint only renders when `trade.setupScore` is truthy
(because `SetupSection` early-returns `null` when `data` is null).
This is the intended behavior — when there's no score, there's
nothing to explain.

## Change 3 — Smart empty states

| View | Change |
|------|--------|
| Playbooks | Updated `<p>` text from "No strategies yet. Create your first playbook." → "No strategies yet. Create the trading model you want to measure." |
| Plans (no plans) | Kept existing EmptyState (more descriptive than the alternative) |
| Reviews (no reviews) | Kept existing EmptyState (more descriptive than the alternative) |

The Playbooks empty state is a plain `<p>` (not an `EmptyState`), so
only the text was changed — no structural edit.

## Files touched

```
src/components/views/journal-view.tsx          (edited — subtitle)
src/components/views/analytics-view.tsx         (edited — subtitle)
src/components/views/playbooks-view.tsx         (edited — subtitle + empty state)
src/components/views/reviews-view.tsx          (edited — subtitle)
src/components/views/trade-detail-view.tsx      (edited — MiniStat/SetupSection hint prop, HelpCircle import, 2 call sites)
```

No new files created. No dependency changes. No schema changes.

## Verification

- `cd /home/z/my-project && bun run lint` → exit 0, zero warnings, zero errors.
- Dev log shows clean recompiles after each edit (no new runtime errors).
- The trade-form hints for Planned Entry / Risk % / Strategy Version
  were visually inspected in source — all three are present and correct.
