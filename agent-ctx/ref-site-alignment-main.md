# Ref-Site Alignment — Work Record

**Task ID**: `ref-site-alignment`
**Agent**: main (Z.ai Code)
**Status**: Complete

## Summary

Brought DnD into alignment with the reference trading-journal site by:
1. Removing the Reviews feature from all UI surfaces (kept the Prisma
   model, API routes, and `reviews-view.tsx` orphaned — per task rules).
2. Adding `consistencyRate`, `dailyLossLimitPct`, `maxDrawdownPct` to
   `TradingAccount`, plus a unified `AccountDialog` for create/edit.
3. Adding `normalRiskMaxPct`, `warningRiskMaxPct`, `criticalRiskMaxPct`
   to `UserSettings`, plus a "Risk Threshold Banners" card in
   Settings → Trading.
4. Rewriting `playbooks-view.tsx` as "Setups & Checklists" — strategies
   render as cards with checklist counts; create/edit dialog takes
   Name, Market, Description, and a checklist of
   `{title, required, description}` items stored as a flat array in the
   strategy's `rules` JSON.

## Key Decisions

- **Setup wizard step count**: The task asked to drop `TOTAL_SETUP_STEPS`
  from 6 to 5 by removing a "review" step. The wizard didn't actually
  have a review step — STEP_META had 6 entries (account, instrument,
  strategy, strategy-rules, plan, trade). I removed the StrategyRulesStep
  (the rule-refinement step that no longer fits the simplified Setups
  model) so STEP_META now has 5 entries and `TOTAL_SETUP_STEPS = 5`.
- **`defaultRiskPct` schema**: Task asked for
  `defaultRiskPct Float @default(1)`. The existing field is
  `defaultRiskPct String @default("0.5")` (a decimal ratio like "0.005").
  Renaming would have broken the trade-form risk calc. Kept the existing
  string field and added only the three new threshold fields.
- **`landing-view.tsx`**: Task 1 item 10 asked for review references to
  be removed, but the IMPORTANT RULES said "Do NOT change the landing
  page (it was just redesigned)". Followed the IMPORTANT RULES; the
  marketing copy still mentions "Review System" as a capability. This is
  a documented deviation that can be cleaned up in a separate copy edit.
- **Backward compatibility**: `extractChecklist(rulesJson)` in the new
  `playbooks-view.tsx` reads both the new flat-array format and the old
  category-based format, so existing demo strategies render in the new
  Setups view without a data migration.

## Verification

- `bun run lint` → exit 0, no warnings.
- `bun run db:push` → schema changes applied cleanly.
- Dev server (`bun run dev`) compiles cleanly. `dev.log` shows only
  "✓ Compiled in Xms" lines.

## Files Touched

See the worklog entry in `/home/z/my-project/worklog.md` (section
"Ref-Site Alignment (Task ID: ref-site-alignment)") for the full file
list and per-file change descriptions.
