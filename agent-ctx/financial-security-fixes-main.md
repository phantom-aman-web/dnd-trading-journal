# Work Record — financial-security-fixes

**Agent:** main
**Task ID:** financial-security-fixes
**Date:** 2026-09-06

## Context

Previous agent work is tracked in `/home/z/my-project/worklog.md`. Most relevant prior work:
- `aplus-integration` — added `let fills: { kind: string; ... }[]` declaration in `src/app/api/trades/[id]/route.ts` (uncommitted). Caused a pre-existing TS2322 that I cleaned up while doing Fix 1.
- `aplus-scoring` — added `src/lib/checklist-evaluation.ts` pure domain module.

## Task

Apply 8 financial/security fixes to the existing codebase without redesigning UI/UX:

1. Instrument-aware financial calculations (3 API routes that hardcoded `pointValueCents: 100`)
2. Remove fallback secrets in `auth.ts` and `storage.ts` (warn instead of throw)
3. Constant-time HMAC comparison in `storage.ts verifyFileToken`
4. Mass-assignment allowlist in `daily-plans/route.ts` POST
5. Remove integer truncation (`| 0`) in `calculations.ts` and `money.ts`
6. Pass `startingBalanceCents` to `buildEquityCurve` in dashboard
7. Fix psych-tag parsing (`psychBeforeJson` is an object, not a bare array)
8. Resolve strategy names in `analytics/route.ts` strategy dimension

## Changes Made

### `src/lib/calculations.ts`
- Added `computePointValueCents(contractSize, tickSize, pipSize)` pure helper. Returns `Math.round(Number(contractSize) * Number(tickSize || pipSize) * 100)` for non-trivial contracts; falls back to `100` for crypto/stocks (when the formula rounds to ≤1 cent) to preserve the 1:1-with-price semantics.
- Clarified `TradeCalcInput.pointValueCents` JSDoc — field was already optional with default 100.
- Added `safeParsePsychTags(json)` helper. Parses JSON; if object with `moodTags` array → returns it (filtered to strings); if bare array → returns it (legacy compat); otherwise `[]`. Never throws.
- Replaced `s + (t.netPnlCents | 0)` with `s + t.netPnlCents` in `computeAggregateMetrics` (the `| 0` truncates above 2^31 cents ≈ $21M).

### `src/lib/money.ts`
- `addCents`: `return a + b;` (was `(a | 0) + (b | 0)`)
- `subCents`: `return a - b;`
- `negCents`: `return -a;`
- `signCents`: dropped the `a | 0` coercion.

### `src/lib/auth.ts`
- Extracted the hardcoded fallback into `SESSION_DEFAULT_SECRET` constant.
- Kept the fallback (dev environment depends on it) but added a module-load `console.error` warning when `SESSION_SECRET === SESSION_DEFAULT_SECRET` and `NODE_ENV !== "test"`. Throwing was avoided per the task's "safer than throwing" guidance.

### `src/lib/storage.ts`
- Same treatment for `STORAGE_SECRET` via `SIGNED_URL_DEFAULT_SECRET` constant + `console.error` warning.
- Replaced `if (sig !== expected) return null;` in `verifyFileToken` with a length pre-check + `crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))`. The pre-check is required because `timingSafeEqual` throws on length mismatch. `crypto` was already imported.

### `src/app/api/trades/route.ts` (POST)
- Imported `computePointValueCents` from `@/lib/calculations`.
- Replaced `pointValueCents: 100` with `computePointValueCents(instrument?.contractSize ?? "1", instrument?.tickSize ?? null, instrument?.pipSize ?? null)`.

### `src/app/api/trades/[id]/route.ts` (PATCH)
- Imported `computePointValueCents` and `ExecutionFill` from `@/lib/calculations`.
- Replaced `pointValueCents: 100` with `computePointValueCents(...)` call.
- Re-typed `let fills: { kind: string; price: string; quantity: string }[]` (added by aplus-integration, pre-existing TS2322) to `let fills: ExecutionFill[]` and added explicit `ExecutionFill` return-type annotations on the two `.map` callbacks. This removes 4 TS errors.

### `src/app/api/imports/[id]/route.ts` (confirm action)
- Imported `computePointValueCents`.
- Replaced `pointValueCents: 100` with `computePointValueCents(instr.contractSize, instr.tickSize, instr.pipSize)`.

### `src/app/api/daily-plans/route.ts` (POST)
- Replaced `update: { ...rest }` / `create: { userId, date, ...rest }` with an explicit field allowlist (15 editable fields). `allowed` object spread into both `update` and `create`. `userId` is now only sourced from `requireUser()`.

### `src/app/api/dashboard/route.ts` (GET)
- Imported `safeParsePsychTags` from `@/lib/calculations`.
- Replaced `psychTags: safeParseArr(t.psychBeforeJson)` with `psychTags: safeParsePsychTags(t.psychBeforeJson)` in `loadTrades`.
- Moved `accounts` / `startingBalance` computation above `buildEquityCurve(trades)` call.
- Changed `buildEquityCurve(trades)` to `buildEquityCurve(trades, startingBalance)` so the first equity-curve point starts from the real account balance, not 0.
- The existing `byStrategy` post-`groupBy` label resolution was already correct — verified, no change needed.

### `src/app/api/analytics/route.ts` (GET)
- Imported `safeParsePsychTags`.
- Replaced `psychTags: safeParseArr(t.psychBeforeJson)` with `psychTags: safeParsePsychTags(t.psychBeforeJson)`.
- Strategy dimension: now fetches `db.strategy.findMany({ where: { userId }, select: { id, name } })`, builds `Map<id, name>`, and uses `(k) => strategyMap.get(k) ?? "Unknown"` as the label function (was `(k) => k` which surfaced raw cuid IDs).

### `/home/z/my-project/.env.example` (new file)
- Documents `DATABASE_URL`, `SESSION_SECRET`, `STORAGE_SECRET` with inline comments explaining each secret's purpose and minimum length.

## Verification

- `bun run lint` → clean (zero errors, zero warnings).
- `bunx tsc --noEmit` → 234 errors (down from 238). All remaining errors are pre-existing:
  - `parseJson<T = unknown>` widening issues (infrastructure-level, predates this task, affects every API route)
  - `examples/websocket/*` missing socket.io modules
  - `skills/*` pre-existing skill issues
  - `src/lib/crypto.ts` Buffer typing
  - `src/components/views/trade-form-view.tsx` `never[]` push from aplus-integration
- Dev log verified:
  - `[security] SESSION_SECRET is using its insecure default value. …` appears when `/api/me` is hit (triggers `auth.ts` module load).
  - `[security] STORAGE_SECRET is using its insecure default value. …` appears when `/api/media/file?token=invalid` is hit (triggers `storage.ts` module load).
  - `/api/media/file?token=invalid` returns 403 cleanly — confirms `timingSafeEqual`-based `verifyFileToken` handles malformed input (length mismatch on the malformed base64url split) without crashing.

## Files Modified

- `src/lib/calculations.ts`
- `src/lib/money.ts`
- `src/lib/auth.ts`
- `src/lib/storage.ts`
- `src/app/api/trades/route.ts`
- `src/app/api/trades/[id]/route.ts`
- `src/app/api/imports/[id]/route.ts`
- `src/app/api/daily-plans/route.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/api/analytics/route.ts`

## Files Created

- `/home/z/my-project/.env.example`
- `/home/z/my-project/agent-ctx/financial-security-fixes-main.md` (this file)

## Notes for Next Agent

- The `computePointValueCents` helper intentionally falls back to `100` for crypto/stocks (when `contractSize * tickSize * 100` rounds to ≤1 cent). This satisfies the task's "For crypto/stocks: pointValueCents = 100 (1:1 with price)" rule while still applying the formula for forex/metals/indices/futures where the derived value is meaningful.
- The `SESSION_SECRET` / `STORAGE_SECRET` warnings use `console.error` (not `throw`) so the dev environment keeps working. The warnings will be loud in the dev log until the operator sets the env vars. To actually enforce secrets in production, a separate hardening pass would need to flip the `console.error` to a `throw` behind a `NODE_ENV === "production"` check.
- The TS2322 fix in `trades/[id]/route.ts` (`ExecutionFill[]` typing) was a side-effect of cleaning up pre-existing errors from the aplus-integration agent's un-committed `let fills` declaration. It's not strictly part of the 8 fixes but leaves the codebase in a cleaner state.
- The remaining 234 TS errors are all pre-existing infrastructure-level issues (`parseJson` widening) or unrelated skill/example files. They should be addressed in a separate dedicated task.
