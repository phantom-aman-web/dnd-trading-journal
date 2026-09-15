# Task ID: aplus-integration

## Agent: main

## Task
Integrate the real A+ checklist scoring system into the trade form and trade API. The checklist evaluation module at `src/lib/checklist-evaluation.ts` was created by a previous agent (task `aplus-scoring`); this task wires it into the UI and the API.

## What was done

### 1. Trade Form (`src/components/views/trade-form-view.tsx`)
- Removed the manual `setupGrade` Select dropdown from the Basics tab.
- Removed `setupGrade` from the initial form state; added `checklistVersionId: ""` and `checklistAnswers: {} as Record<string, ChecklistAnswerValue>`.
- Added imports for `evaluateChecklist`, `parseChecklistItems`, `parseGradingThresholds`, `parseAnswers`, plus `ChecklistItem`, `ChecklistAnswerValue`, `GradingThresholds` types.
- Added `useQuery(["checklists"])` to fetch the user's checklists (with versions).
- Added `useMemo` derivations: `activeChecklist`, `checklistItems`, `checklistThresholds`, and `evaluation` (the live result of `evaluateChecklist`).
- Added a `useEffect` that defaults `form.checklistVersionId` to the first checklist's latest version when the checklists load and no version is set (new-trade case).
- Added `updateChecklistAnswer(itemId, field, value)` helper that immutably updates one answer field.
- Updated the existing-trade loader to restore `form.checklistVersionId` and `form.checklistAnswers` (parsed via `parseAnswers` from the latest `TradeChecklistEvaluation.rawAnswersJson`).
- Added an "A+ Setup Checklist" card in the ICT Setup tab (tab 4), placed ABOVE the existing Strategy Rules Checklist (both coexist):
  - Header: checklist name + version label, with an optional inline `<Select>` to switch versions if multiple checklists exist.
  - Prominent live grade badge (color-coded) + percentage score.
  - Score progress bar (0–100%, colored by grade).
  - Required-items counter ("Required: 3/7 met") with a warning when any required item is unchecked.
  - Each item is a checkbox `<label>` with the item text, "Required" badge (when applicable), "×{weight}" badge, and "Evidence required" hint.
  - For items with `evidenceRequired: true` AND `checked: true`, a `<Textarea>` appears for the evidence note. If the note is empty, the textarea border turns destructive and a hint is shown.
  - Footer explains the scoring formula.
- Empty-state card if no checklist is configured.
- Updated `submit()`:
  - Removed the hardcoded `setupScore: form.setupGrade === "A+" ? "0.92" : ...` mapping.
  - Added `checklistVersionId: form.checklistVersionId || null` and `checklistAnswers: form.checklistVersionId ? form.checklistAnswers : null`.
  - `setupGrade` is now `evaluation.grade` (or `null`).
  - `setupScore` is now `String(evaluation.score)` (or `null`).

### 2. POST /api/trades (`src/app/api/trades/route.ts`)
- Added `checklistAnswers: z.record(z.string(), z.any()).optional().nullable()` to the Zod schema.
- Added imports for `evaluateChecklist`, `parseChecklistItems`, `parseGradingThresholds`, `serializeAnswers`, `ChecklistAnswer`.
- After P&L calculation but before `db.trade.create`, re-fetches the `ChecklistVersion` (verifying user-ownership via the checklist relation), parses items + thresholds, and re-evaluates the answers server-side. The server-computed `result.grade` / `String(result.score)` override whatever the client sent as `setupGrade` / `setupScore` (authoritative source-of-truth, spec §102).
- After `trade.create`, persists a `TradeChecklistEvaluation` row with `tradeId`, `checklistVersionId`, `rawAnswersJson` (via `serializeAnswers` for stable sorted-key JSON), `weightedScore`, `finalGrade`. Non-fatal on failure (audits `trade.checklist_eval_failed`).

### 3. PATCH /api/trades/[id] (`src/app/api/trades/[id]/route.ts`)
- Added the same `evaluateChecklist` / `parseChecklistItems` / `parseGradingThresholds` / `serializeAnswers` imports.
- Broadened the P&L recompute: previously it only fired when `body.executions` was an array. Now it fires when ANY of `body.executions`, `body.feesCents`, `body.commissionCents`, `body.swapCents`, `body.slippageCents`, or `body.direction` is present. When `executions` isn't provided, the trade's existing `TradeExecution` ledger is loaded as the fill source. Status auto-derivation is still gated on `hasExecutions`.
- Added a checklist re-evaluation block: if `body.checklistAnswers` (object) and `body.checklistVersionId` are provided, re-fetches the version (with user-ownership check), re-evaluates, and:
  - Sets `allowed.checklistVersionId`, `allowed.setupGrade`, `allowed.setupScore` from the evaluation result.
  - Upserts the `TradeChecklistEvaluation` row (update if exists for trade+version, else create). Non-fatal on failure (audits `trade.checklist_eval_failed`).

## Verification
- `bun run lint` passes clean (zero errors, zero warnings).
- `bunx tsc --noEmit` shows only pre-existing TS2338/TS2339 errors caused by `parseJson<T = unknown>` returning `{}` (infrastructure-level issue affecting every API route; predates this task). New accesses follow the same pre-existing pattern.
- Dev log shows `GET /api/checklists 200` succeeding and the form compiling cleanly across multiple rebuilds. No runtime errors.

## Constraints honored
- Did NOT remove the strategy rules checklist that already exists in the ICT Setup tab — both coexist.
- Preserved all existing form fields and tabs (7-tab wizard).
- Preserved the existing evidence upload, description, and annotation features.
- Preserved Back/Next navigation with Save buttons only on the final tab.

## Files modified
- `src/components/views/trade-form-view.tsx`
- `src/app/api/trades/route.ts`
- `src/app/api/trades/[id]/route.ts`
