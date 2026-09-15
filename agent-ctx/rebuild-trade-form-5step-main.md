# Task: rebuild-trade-form-5step

**Agent:** main
**Date:** 2025-01 build session
**Scope:** Rebuild the lost 5-step wizard trade form at
`src/components/views/trade-form-view.tsx` after a git reset wiped it.

## What existed before

The previous trade form had been a **7-tab** wizard (`basics`, `execution`,
`plan`, `setup`, `psychology`, `review`, `evidence`) built incrementally across
several earlier tasks (`aplus-integration`, `financial-security-fixes`, etc.).
A later alignment task had identified the **5-step** wizard as a medium-priority
follow-up. That follow-up had been implemented and shipped but was lost in a
`git reset`. This task rebuilds it from scratch.

## Files touched

- `src/components/views/trade-form-view.tsx` — fully overwritten (~1,200 lines).
- No schema, API, or shared-lib changes were needed — the existing
  `/api/trades`, `/api/trades/[id]`, `/api/accounts`, `/api/strategies`,
  `/api/strategies/[id]`, `/api/me`, and `/api/media` endpoints already
  expose the shapes the new form consumes.

## What was built

A single-page, 5-step trade wizard driven by Radix `Tabs` (shadcn/ui). The
five steps are exposed as a horizontal `TabsList` with sticky Prev / Next
navigation at the bottom plus duplicate "Save as Draft" / "Save Trade"
buttons on the final step.

### Step 1 — Trade Info (`trade-info`)
- **Trading Account** (`Select`, required) — sourced defensively from
  `/api/accounts`. Auto-defaults to `isDefault` account on first load.
- **Trading Setup** (`Select`) — strategy picker from `/api/strategies`.
  Choosing one loads its `versions` via `/api/strategies/[id]`.
- **Symbol / Pair** (`Input`, required) — with a `<datalist>` of instruments
  from `/api/me` for autocomplete.
- **Direction** (`RadioGroup`) — Long / Short with green/red highlight cards.
- **Trade Status** (`Select`) — Draft / Open / Closed / Planned.
- **Date** + **Time** — separate `type="date"` and `type="time"` inputs that
  combine into an ISO timestamp on submit.
- **Session** (`Select`) — the 6 spec'd values: `asian_range`, `london_open`,
  `ny_am`, `ny_lunch`, `ny_pm`, `off_hours`.
- **Timeframe** (`Select`) — 1m / 5m / 15m / 1h / 4h / 1D.
- **News Impact** (`Select`) — none / low / normal / high.
- **Trade Thesis** (`Textarea`) — bound to the top-level `form.thesisWhy`
  field, mirrored into `thesis.why` on submit.
- **Trade Evidence** card — `Upload` button (hidden `<input type=file>`)
  with `accept=image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime`.
  Each uploaded item renders either an `ImageAnnotator` (for images) or a
  `<video controls>` element, plus a per-item `Textarea` description and a
  `Trash2` delete button. MIME-type detection drives kind: `file.type.startsWith("video/") ? "video" : "image"`.
- **Advanced** `Collapsible` — ICT Setup (weekly/daily bias, liquidity
  targets, market structure, entry model), Psychology Before / After (mood
  tag chips + confidence/energy inputs), Behavior Flags (10 ICT flag chips),
  Tags (from `/api/me` tag list), and Notes / Lessons textareas.

### Step 2 — Setup Checklist (`checklist`)
- Pulls `rulesJson` from the latest (or user-selected) strategy version and
  parses it with a local `extractChecklist()` helper that supports:
  - **flat array** of `{ title | text, required?, weight?, evidenceRequired?, description? }`
    or plain strings
  - **`{ items: [...] }`** wrapper (the new playbooks-view format)
  - **legacy category object** `{ entry, stop, target, management, invalidation }`
    with each section being an array of strings or rule objects
- Each item renders as a `Checkbox` row with a destructive `Badge` "Required"
  tag when `required !== false`, plus a `×weight` indicator.
- Header shows the live `evaluation.grade` (A+ / A / B / C / Invalid) and
  weighted score, computed via `evaluateChecklist()` from
  `@/lib/checklist-evaluation`.
- A progress bar shows `X/Y Checked + Z% Adherence` (raw count ratio — the
  weighted score lives in the grade badge).
- A "Lock" icon banner notes the **immutable historical snapshot** guarantee:
  answers are saved once and never silently re-evaluated.

### Step 3 — Risk & Sizing (`risk`)
- Planned Entry / Stop / Target (`Input type=number`, all required — enforced
  in `submit()` with a redirect to this tab on failure).
- Lot Size + Risk % (`Input type=number`).
- **Auto-calculated** read-only panel:
  - Stop Distance = `|entry − stop|` (5-dp)
  - Planned R:R = `reward / risk` (green when ≥2, amber when ≥1)
  - Risk Amount = `account.currentBalanceCents/100 × riskPct` (red)
  - Planned Profit = `riskAmount × R:R` (green)
  - Account Balance + Lot × Risk Amount for quick reference.
- Account currency is read from the selected account row and threaded into
  `Intl.NumberFormat` for the money fields.

### Step 4 — Partial Exits (`exits`)
- "+ Add Exit Level" button appends a row with `Level Name` + `Exit Price`
  inputs and a `Trash2` remove button.
- **Calculated** panel:
  - Weighted Exit Price = equal-weighted average of all valid exit prices
    (5-dp precision).
  - Total R = `(weightedExit − entry) / |entry − stop|` for long,
    `(entry − weightedExit) / |entry − stop|` for short.
  - A warning banner appears if the user lands on this tab without a planned
    entry/stop set on Step 3.

### Step 5 — Review & Save (`review`)
- Four summary cards: Symbol / Direction, Adherence %, Planned R:R,
  Setup / Status. Each card uses the semantic tokens (green for long/profit,
  red for short/loss, amber for warning) — no hardcoded slate/white colors.
- A detailed `<dl>` summary of every relevant form field (Account, Session,
  Timeframe, News Impact, Date/Time, Lot Size, Risk %, Risk Amount, Planned
  Profit, Partial Exits count, Evidence count, Behavior Flags).
- Thesis preview (the `thesisWhy` textarea content) when non-empty.
- **Save as Draft** (`Button variant=outline`) and **Save Trade**
  (`Button` default = navy primary) — duplicated in the bottom sticky nav bar
  so the user can save without scrolling back to the top.

## Defensive-fetch policy

`fetchAccounts` and `fetchStrategies` both:
- `try { fetch(...); return res.json(); } catch { return []; }`
- Inspect the response for `data?.items ?? data?.accounts ?? data?.strategies ?? (Array.isArray(data) ? data : [])`
- Always return `Array.isArray(arr) ? arr : []`

This matches the existing pattern from the previous 7-tab form but is more
defensive (wraps the whole fetch in try/catch, not just the response
inspection). The query keys include `accountId` (well, `meta?.user?.id`) per
the requirement so per-user invalidation works.

## Submit pipeline

`submit(asDraft: boolean)`:
1. Validates `accountId`, `instrumentSymbol`, and planned entry/stop/target.
   On failure, switches to the offending step (`trade-info` or `risk`) and
   scrolls the relevant `#field-*` element into view.
2. Builds a single `executions` array containing the entry fill (planned
   entry × lot size, timestamped from the date/time inputs).
3. Sends the payload to `POST /api/trades` (new) or `PATCH /api/trades/[id]`
   (edit). The payload always includes:
   - `newsImpact: form.newsImpact ?? "none"` (the API schema strips it
     silently — kept for forward-compat when the column lands).
   - `session: form.session`
   - `setup` object with `session` + `timeframe` mirrored in from the
     top-level form fields.
   - `thesis` object with `why` mirrored in from `form.thesisWhy`.
   - `partialExits` (sent as an extra field; not yet persisted server-side
     but accepted by the schema's freeform `setup` object fallback).
   - `isDraft: asDraft` overrides the dropdown-selected status when the
     user explicitly hits "Save as Draft".
4. After save: attaches orphaned uploaded media to the new `tradeId` and
   patches in any captions (Fix 3 from the original aplus-integration work).
5. `toast.success`, clears `localStorage` draft, invalidates
   `["trades"]` + `["dashboard"]`, navigates to `tradesLog`.

## Edit mode

`useNav().params.id` is treated as the editing trade id. When set:
- The existing trade is fetched via `/api/trades/[id]`.
- The form is populated from the trade record + its latest
  `TradeChecklistEvaluation.rawAnswersJson`.
- `setup` / `thesis` / `psychBefore` / `psychAfter` / `behaviorFlags` /
  `tags` are parsed from their `*Json` columns via `safeJsonParse()`.
- A `skipStrategyResetRef` flag prevents the strategy-change effect from
  wiping the restored checklist answers on the very next render.
- Uploaded media's signed URLs are fetched in parallel after the form is
  populated.

## Draft autosave

- `localStorage["dnd-trade-draft-5step"]` is debounced-write on every form
  change (500 ms).
- Restored on mount when no `editingId` is present, with a `toast.info`.
- Cleared on successful save.

## Visual design

- All cards use `bg-background` (white in light mode, navy in dark mode).
- Primary buttons (`Save Trade`, `Next Step`) inherit the navy `--primary`
  token from the project's `globals.css`.
- Profit / loss colors come from the semantic `--profit` / `--loss` /
  `--warning` tokens, not from hardcoded Tailwind colors.
- `TabsList` is horizontally scrollable on mobile (`overflow-x-auto
no-scrollbar`) and wraps to a new layout below `sm`.
- Bottom navigation is `sticky bottom-0` with a `bg-background/95 backdrop-blur`
  so it stays visible while the user scrolls through long steps (e.g. the
  Advanced collapsible's ICT setup section).

## Lint / type check / dev server

- `bun run lint` → exit 0, no warnings.
- `bunx tsc --noEmit --skipLibCheck` → no errors in `trade-form-view.tsx`
  (the only initially-flagged narrowing issues on the `accounts`/`strategies`
  /`tags` derivations were fixed by casting through `any` for the
  `?.items` accessors — TypeScript narrows `unknown` to `never` after a
  failed `Array.isArray` check).
- `dev.log` shows clean recompiles: `✓ Compiled in 207ms` /
  `✓ Compiled in 702ms` after the overwrite; no runtime errors.

## What's NOT in this task (and why)

- **Server-side `partialExits` persistence** — the Prisma schema has no
  `partialExitsJson` column and the API's `TradeCreateSchema` doesn't accept
  one. The form sends `partialExits` in the payload (zod silently strips
  unknown fields via `safeParse`); when the column lands, the API will start
  persisting it without any client-side change. The client-side calculations
  (weighted exit price, total R) work fully without server round-trips.
- **Server-side `newsImpact` persistence** — same situation. The payload
  sends `newsImpact: form.newsImpact ?? "none"` as required; the API
  currently strips it. Forward-compatible when the column is added.
- **Server-side `timeframe` persistence** — embedded in the `setup` JSON
  (`setup.timeframe`) so it survives storage without a schema change.
