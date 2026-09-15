# DnD — COMPREHENSIVE PROJECT ANALYSIS (HANDOFF REPORT)

> Generated: September 15, 2026
> Purpose: Complete technical analysis for handoff to another AI agent
> Project: DnD — Trading Performance OS
> Location: `/home/z/my-project/`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Directory Structure](#2-directory-structure)
3. [Configuration Files](#3-configuration-files)
4. [Database](#4-database)
5. [Financial Engine (THE CORE)](#5-financial-engine-the-core)
6. [API Routes](#6-api-routes)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Financial Calculation Flow](#8-financial-calculation-flow)
9. [Known Issues + Recent Fixes](#9-known-issues--recent-fixes)
10. [How to Run](#10-how-to-run)
11. [Testing](#11-testing)
12. [Security + Auth](#12-security--auth)
13. [Domain Specification](#13-domain-specification)
14. [Audit Findings + Recommended Next Actions](#14-audit-findings--recommended-next-actions)

---

## 1. Project Overview

**DnD** is a private, single-tenant trading-performance platform ("Trading Performance OS"). Target user: a discretionary trader who wants to journal every trade with strict financial math, ICT-style setup checklists, multi-account support, and analytics across instrument/session/strategy dimensions.

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.1.1 (App Router, `output: "standalone"`) |
| Language | TypeScript 5 (strict, target ES2020) |
| Runtime | Bun (test runner + production server via `bun .next/standalone/server.js`) |
| Database | PostgreSQL on Neon (serverless) |
| ORM | Prisma 6.11.1 (`prisma-client-js` generator, schema pushed via `db push`) |
| Styling | Tailwind CSS 4 + `tailwindcss-animate` + `tw-animate-css` |
| UI library | shadcn/ui (48 components) + Radix primitives + lucide-react icons |
| Auth | bcryptjs (12-round hash) + `jose` (HS256 JWT in `httpOnly` cookie, 30-day maxAge) |
| State (client) | Zustand 5.0.6 (persisted to localStorage) — `nav-store.ts`, `auth-store.ts`, `onboarding-store.ts`, `consent-store.ts` |
| State (server) | TanStack Query 5.82 (`@tanstack/react-query`) |
| Charts | Recharts 2.15 |
| Forms | react-hook-form 7.60 + zod 4.0 |
| Other | `@dnd-kit/*` (drag-drop), `@mdxeditor/editor`, `embla-carousel-react`, `framer-motion`, `react-markdown`, `react-syntax-highlighter`, `next-themes`, `sonner`, `vaul`, `sharp` (image), `uuid` |

### Key Versions

- Next.js: `^16.1.1`
- React: `^19.0.0`
- Prisma: `^6.11.1`
- @prisma/client: `^6.11.1`
- Bun: 1.3.14 (runtime)
- Node: v24.19.0
- zod: `^4.0.2`
- eslint-config-next: `^16.1.1`

### Spec Source

`upload/DnD.md` (original 11-phase brief) → evolved to `DnD_FINAL_DOMAIN_SPECIFICATION_v3.md` (2839 lines, 25 sections, AUTHORITATIVE).

---

## 2. Directory Structure

### Top-Level

| Path | Purpose |
|---|---|
| `/src` | All application source (168 `.ts`/`.tsx` files) |
| `/prisma` | `schema.prisma` only — **NO `migrations/` directory** (schema is `db push`-ed, not migrated) |
| `/public` | Static assets (`logo.svg`, `robots.txt`) |
| `/scripts` | `ensure-neon-env.mjs` (env guard) |
| `/.zscripts` | Sandbox runner scripts (`dev.sh`, `build.sh`, `start.sh`, `database-runtime-build.sh`) |
| `/tests` | `database-runtime-build.sh`, `python-runtime-*.sh` (sandbox runtime scripts) |
| `/storage` | User media uploads (filesystem-backed, namespaced by userId) |
| `/db` | Legacy SQLite artifact (`db/custom.db` — DO NOT USE, Neon is authoritative) |
| `/agent-ctx` | 17 task-context markdown files for prior agent runs |
| `/upload` | Reference spec + user-pasted screenshots |
| `/download/dnd-handoff` | Reference backend + frontend snapshot + product spec docs |
| `/examples/websocket` | Example websocket server.ts + frontend.tsx |

### Key Subdirectories Under `/src`

| Path | Files | Purpose |
|---|---|---|
| `/src/app` | `layout.tsx`, `page.tsx`, `globals.css` + `api/` | Root layout, single-page SPA, global styles |
| `/src/app/api` | 40 `route.ts` files across 26 dirs | All REST endpoints |
| `/src/lib` | 30 files | Engine, calculations, auth, db, storage, audit, decimal, money, instrument catalog, etc. |
| `/src/components` | 71 files | All React components |
| `/src/components/views` | 16 views | All major UI screens |
| `/src/components/ui` | 48 files | shadcn/ui primitives |
| `/src/components/charts` | 4 chart components | Equity curve, daily P&L, R-distribution, group bar |
| `/src/components/trade` | 3 files | close-trade-modal, execute-trade-modal, image-viewer |
| `/src/components/common` | 8 files | instrument-selector, file-upload, image-annotator, metric-card, trade-table, etc. |
| `/src/components/onboarding` | 4 files | welcome-screen, setup-wizard, tour, getting-started-card |
| `/src/components/public` | 4 files | cookie-consent, legal-doc-viewer, public-header, public-footer |
| `/src/hooks` | 2 files | `use-mobile.ts`, `use-toast.ts` |

### File Counts

- 40 API route handlers across 26 directories
- 16 view components (total 12,276 lines; largest: `trade-form-view.tsx` at 2926, `settings-view.tsx` at 1271)
- 48 shadcn/ui components
- 30 lib modules (~78K lines of TS including tests)
- 60 + 12 = 72 total golden tests in two suites

---

## 3. Configuration Files

### `package.json` Scripts

```jsonc
{
  "scripts": {
    "predev":     "node scripts/ensure-neon-env.mjs",  // env guard before dev
    "dev":        "next dev -p 3000",
    "prebuild":   "node scripts/ensure-neon-env.mjs",  // env guard before build
    "build":      "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/",
    "start":      "NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log",
    "lint":       "eslint .",
    "postinstall":"prisma generate",                    // deploy fix
    "db:push":    "prisma db push --accept-data-loss",
    "db:generate":"prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:reset":   "prisma migrate reset",
    "test":       "bun test src/lib/financial-engine.test.ts",
    "test:financial": "bun test src/lib/financial-engine.test.ts"
  }
}
```

### `next.config.ts`

```ts
const nextConfig: NextConfig = {
  output: "standalone",                    // produces .next/standalone/server.js
  typescript: { ignoreBuildErrors: true }, // ⚠️ build does NOT type-check
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.chatglm.cn"],
  // Security headers: X-Content-Type-Options, X-Frame-Options: DENY,
  // Referrer-Policy, Permissions-Policy, HSTS, CSP
};
```

### `tsconfig.json`

- `target: "ES2020"` (for BigInt support)
- `strict: true`, `noImplicitAny: false`, `skipLibCheck: true`, `noEmit: true`
- `paths: { "@/*": ["./src/*"] }`
- **Excludes**: `node_modules`, `download`, `examples`, `skills`, `mini-services`, `src/lib/financial-engine.test.ts`, `src/lib/population.test.ts` (test files excluded from build)

### `neon.ts`

```ts
import { defineConfig } from "@neon/config/v1";
export default defineConfig({
  auth: true,
  preview: {
    buckets: { uploads: { access: "private" } },
  },
});
```

### `.env` (3 vars — committed to git intentionally)

```
DATABASE_URL=postgresql://neondb_owner:...@ep-mute-boat-a55680am-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET=dev-session-secret-for-dnd-sandbox-only-32chars
STORAGE_SECRET=dev-storage-secret-for-dnd-sandbox-only-32chars
```

### `Caddyfile`

Reverse proxy on `:81`:
- If `XTransformPort=*` query → proxy to `localhost:{port}` (sandbox preview iframe)
- Otherwise → `reverse_proxy localhost:3000` (Next.js dev/standalone)

### `.zscripts/` (Sandbox Runner Scripts)

- `dev.sh` — runs `bun install` → `bun run db:push` → `bun run dev` in background
- `build.sh` — builds Next.js + mini-services for deploy artifact
- `start.sh` — production orchestrator with graceful shutdown
- `database-runtime-build.sh` — copies legacy SQLite to build (OLD pattern; Neon is authoritative now)

### `scripts/ensure-neon-env.mjs`

**Permanent fix for recurring `.env` reversion.** The Z.ai sandbox platform writes `.env` with SQLite URL at container start. This script:
1. Runs as `predev` + `prebuild` hook
2. Checks if `DATABASE_URL` starts with `postgresql://`
3. If NOT, restores the authoritative Neon config
4. Verifies the write succeeded

---

## 4. Database

### Prisma Schema (`prisma/schema.prisma`, 682 lines)

**Datasource:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Migration state:** NO `prisma/migrations/` directory. Schema is applied via `bun run db:push` (additive, non-destructive).

### All 25 Models

#### `User` (L17-44)
Fields: `id @cuid`, `email @unique`, `name String?`, `passwordHash`, `createdAt`, `updatedAt`.
Relations: accounts, instruments, trades, strategies, checklists, tags, dailyPlans, reviews, actionItems, goals, imports, backups, auditEvents, notifications, notificationPrefs, settings, legalAcceptances, media, deviceSessions.

#### `TradingAccount` (L50-70)
Fields: `id`, `userId`, `name`, `broker?`, `accountType @default("live")` (live|demo|prop|funded|backtest|personal|other), `currency @default("USD")`, `startingBalanceCents @default(100000)` ($1000), `currentBalanceCents @default(100000)`, `consistencyRate Float?`, `dailyLossLimitPct Float?`, `maxDrawdownPct Float?`, `isDefault @default(false)`, timestamps.

#### `Instrument` (L72-90)
Fields: `id`, `userId`, `symbol`, `name?`, `market` (forex|gold|indices|futures|crypto|stocks|custom), `pipSize @default("0.0001")`, `tickSize @default("0.0001")`, `contractSize @default("1")`, `pricePrecision @default(5)`, `currency @default("USD")`, `createdAt`.
**NOTE: NO `pointValueCents` column.** Derived at runtime via `computePointValueFromDb = contractSize × 100`.

#### `Strategy` (L96-118) + `StrategyVersion` (L120-140)
Strategy: `id`, `userId`, `name`, `description?`, `purpose?`, `instruments?` (comma-separated), `market?`, `timeframe?`, `session?`, `status @default("active")`, `checklistConfigId?`, timestamps.
StrategyVersion: `id`, `strategyId`, `versionLabel`, `changeReason?`, `changeSummary?`, `expectedImpact?`, `rulesJson String` (JSON: `{ entry, stop, target, management, invalidation }`), `checklistJson?`, `effectiveDate`, `status @default("active")`, `createdAt`. Unique: `@@unique([strategyId, versionLabel])`.

#### `Trade` (L200-289) — THE CENTRAL MODEL

Key fields (35+ total):

| Category | Fields |
|----------|--------|
| Identity | `id`, `userId`, `accountId`, `instrumentId?`, `instrumentSymbol`, `market?`, `direction` (long\|short) |
| **Status** | `status @default("open")`: open\|win\|loss\|breakeven\|partial_win\|partial_loss\|cancelled — **DERIVED from P&L + exit quantity** |
| Context | `session?`, `newsEvent @default("none")`, `strategyId?`, `strategyVersionId?`, `dailyPlanId?`, `checklistVersionId?` |
| Setup | `setupGrade?` (A+\|A\|B\|C\|Invalid), `setupScore?` (0..1), `tagsJson @default("[]")` |
| Planned | `plannedEntryPrice?`, `plannedStopPrice?`, `plannedTargetPrice?`, **`plannedRiskAmountCents Int?`**, `plannedRiskPct?`, **`plannedRR String?`** |
| Actual (caches) | `entryPriceAvg?`, `exitPriceAvg?`, `positionSize?`, `feesCents`, `commissionCents`, `swapCents`, `slippageCents`, `grossPnlCents`, `netPnlCents`, `actualR String?` |
| Times | `entryTime?`, `exitTime?`, `tradingTimezone @default("UTC")`, `createdAt`, `updatedAt` |
| JSON blobs | `setupJson?`, `thesisJson?`, `notes?`, `lessons?`, `planAdherenceJson?`, `psychBeforeJson?`, `psychAfterJson?`, `behaviorFlagsJson @default("[]")` |
| Draft/archive | `isDraft @default(false)`, `isArchived @default(false)`, `draftJson?` |

**Indexes**: `@@index([userId])`, `@@index([accountId])`, `@@index([instrumentId])`, `@@index([strategyId])`, `@@index([dailyPlanId])`, `@@index([session])`, `@@index([status])`, `@@index([entryTime])`.

#### `TradeExecution` (L291-305) — AUTHORITATIVE P&L SOURCE

Fields: `id`, `tradeId`, `kind` (entry\|exit), `seq @default(0)`, `price String` (decimal), `quantity String` (decimal), `timestamp DateTime`, `notes?`, `createdAt`.

**The execution ledger is the SOLE authority for P&L.** Trade fields like `grossPnlCents`, `netPnlCents`, `entryPriceAvg` are CACHES that can be atomically rebuilt.

#### `TradeTarget` (L307-318)

Fields: `id`, `tradeId`, `label String` (TP1, TP2, ...), `price String`, `quantityPct String` (decimal 0..1) — **HARDCODED to "0" in current handlers (known issue)**.

#### `TradeMedia` (L324-353)

Fields: `id`, `userId`, `tradeId String?` (NULLABLE for orphan uploads), `strategyId?`, `reviewId?`, `kind` (image\|video), `stage?` (before_entry\|setup\|entry\|during_trade\|exit\|review), `filename`, `storedPath`, `mimeType`, `sizeBytes`, `width?`, `height?`, `durationMs?`, `thumbnailPath?`, `caption?`, `timeframe?`, `tagsJson @default("[]")`, `uploadStatus @default("ready")`, `createdAt`.

#### `TradeChecklistEvaluation` (L371-391) — IMMUTABLE SNAPSHOT

Fields: `id`, `tradeId`, `checklistVersionId?`, `strategyVersionId?`, `rawAnswersJson String`, `weightedScore String` (0..1), `finalGrade String` (A+\|A\|B\|C\|Invalid), `evaluatedAt`.

Preserves exact answers + score + grade at trade-creation time so later strategy/checklist edits never change old trades.

#### Other Models

`MediaAnnotation`, `ChecklistConfig` + `ChecklistVersion`, `StrategyExperiment`, `Tag` (@@unique [userId, name]), `DailyPlan` (@@unique [userId, date]), `Review` + `ReviewTradeLink`, `ActionItem`, `Goal`, `Notification` + `NotificationPreferences`, `AuditEvent`, `Import` + `ImportRow`, `Backup`, `UserSettings` (extensive: timezone, theme, density, defaultRiskPct, risk thresholds, preferredInstruments, privacyModeEnabled, etc.), `LegalAcceptance`, `DeviceSession`, `AnalyticsCache`.

### Database Connection — `src/lib/db.ts`

**Runtime guard (NO SQLite fallback):**
```ts
if (!DATABASE_URL) throw new Error("FATAL: DATABASE_URL is not set...");
if (!DATABASE_URL.startsWith("postgresql://") && !DATABASE_URL.startsWith("postgres://"))
  throw new Error("FATAL: DATABASE_URL must be PostgreSQL. No SQLite fallback.");
```

PrismaClient config: `log: ["error"]` in production, `["error", "warn"]` in dev. Cached on `globalThis` to avoid connection exhaustion in dev HMR.

### Neon Connectivity

- **Provider**: postgresql
- **Host**: ep-mute-boat-a55680am-pooler.us-east-2.aws.neon.tech
- **Database**: neondb
- **SSL**: require
- **Verified**: `db.user.count()` returns 5 (real users)

---

## 5. Financial Engine (THE CORE)

### `src/lib/financial-engine.ts` (1247 lines) — AUTHORITATIVE ENGINE

Built per `DnD_FINAL_DOMAIN_SPECIFICATION_v3.md` §1-§29.

#### `InstrumentEconomics` Interface (14 fields)

```ts
export interface InstrumentEconomics {
  symbol: string;
  assetClass: "forex" | "gold" | "indices" | "futures" | "crypto" | "stocks" | "custom";
  baseCurrency: string | null;       // ISO 4217 (forex base), null for non-forex
  quoteCurrency: string;             // ISO 4217 (settlement)
  quantityUnit: "lots" | "contracts" | "shares" | "units" | "ounces";
  quantityScale: number;             // 0 for contracts, 2 for lots
  quantityStep: string;              // "0.01" for lots, "1" for contracts
  minimumQuantity: string;
  contractSize: string;              // INFORMATIONAL ONLY (never in formulas)
  priceIncrement: string;            // = tickSize (alias)
  tickSize: string;
  pointValueCents: number;           // AUTHORITATIVE: cents per 1.0 price move per 1.0 quantity
  pipSize: string | null;            // forex only
  currencyConversionRequired: boolean;
}
```

#### Core Functions

1. **`calculateTradeMetrics(input: FinancialCalcInput): FinancialCalcResult`** — ONE canonical P&L path
   - Formula: `grossPnl = directionalMove × realizedQuantity × pointValueCents`
   - LONG: `move = exitPrice - entryPrice`; SHORT: `move = entryPrice - exitPrice`
   - Partial exits: each exit independently calculated against avg entry, then summed
   - Uses BigInt for money with banker's rounding
   - Returns 22 fields including: entryPriceAvg, exitPriceAvg, entryQuantity, exitQuantity, remainingQuantity, matchedQuantity, stopDistance, targetDistance, plannedRR, riskPerUnitCents, plannedRiskAmountCents, grossPnlNativeCents, totalCostsCents, netPnlNativeCents, convertedGrossPnlCents, convertedNetPnlCents, actualR, status, outcome

2. **`calculatePositionSize(input: PositionSizeInput): PositionSizeResult`** — Universal formula
   - `riskBudget = balance × riskPct`
   - `riskPerUnit = stopDistance × pointValueCents`
   - `rawQuantity = riskBudget / riskPerUnit`
   - `roundedQuantity = floor(rawQuantity / quantityStep) × quantityStep` (never rounds up)
   - Validations: negative risk → ERROR, >100% → ERROR, 0% → returns 0 (no div by zero)

3. **`computeAggregateMetrics(trades, startingBalanceCents)`** — Single authoritative aggregation
   - **Populations**: closedTrades = WIN+LOSS+BREAKEVEN; partialTrades = PARTIAL_*; mutually exclusive
   - **winRate** = wins / (wins + losses) — breakevens EXCLUDED from numerator AND denominator
   - **profitFactor**: null when both 0; "Infinity" when grossLoss=0; else grossProfit/|grossLoss|
   - **expectancyR** = avg of actualR for closed trades with valid R
   - **maxDrawdown**: computed only when startingBalanceCents != null (single account). Walks ordered-by-exitTime trades, tracks peak, computes max(peak-equity). Null for all-accounts aggregate.
   - **Streaks**: BE resets both win and loss streaks
   - **largestWin/largestLoss**: null (not 0) when no wins/losses

4. **`buildDebugView(input, result)`** — exposes all calculation intermediates (spec §35)

### 60 Golden Tests (`financial-engine.test.ts`)

| Group | Tests | Coverage |
|-------|-------|----------|
| Gold (XAUUSD) | G01-G10 | Risk/profit/RR for lot sizes, position sizing, short, win/loss, fees |
| Gold Futures (GC/MGC) | G11-G14 | Point values, loss, multi-contract |
| Index Futures (NQ/MNQ/ES/MES) | G15-G20 | P&L, sizing (insufficient budget, micro contracts) |
| Forex (EURUSD/USDJPY) | G21-G28 | P&L, pip values, position sizing, JPY currency conversion |
| Position Sizing | G29-G35 | Exact risk, quantity step, whole-contract, 0%, negative, >100% |
| Partial Exits | G36-G40 | Multiple partials, partial loss+win, partial remains, 3 partials, partial BE |
| Fees | G41-G43 | Fees only, slippage, all costs |
| R Tests | G44-G47 | +1R, -1R, +2R, fees change actual R |
| Analytics | G48-G57 | 3 trades, profit factor 6, expectancy, win rate, equity, drawdown, exit-time ordering, partial excluded, dashboard consistency |
| Immutability | G58-G60 | Edit preservation, execution immutability, historical snapshot |

### 12 Population Tests (`population.test.ts`)

| Test | Scenario | Expected |
|------|----------|----------|
| POP-1 | 9 trades (one per status) | closedTrades=3, wins=1, losses=1 |
| POP-2 | WIN+LOSS+WIN+BE+PARTIAL | closedTrades=4, winRate=50%, profitFactor=6 |
| POP-3 | Single winning trade +$100 at +10R | All metrics correct, profitFactor=null |
| POP-4 | Partial position remains | closedTrades=0 |
| POP-5 | Fees reduce net P&L | net=$96 (not gross $100) |
| POP-6 | Cross-screen consistency | Same trade → same metrics |
| POP-7 | Engine immutability | Inputs not mutated |
| POP-8 | Streak W W L W | maxWinStreak=2 |
| POP-9 | Streak L L BE L | BE resets, maxLossStreak=2 |
| POP-10 | Max drawdown $50 | peak/trough sequence |
| POP-11 | Exit-time ordering | Trade B exits before A |
| POP-12 | No starting balance | Drawdown from P&L series |

### Legacy Engine (`calculations.ts`, 939 lines)

Still used by dashboard/analytics/reviews/imports. **Key differences from new engine:**
- Win rate INCLUDES breakevens in denominator (`wins / closed.length` where closed = win+loss+breakeven)
- No `startingBalanceCents` parameter (drawdown from P&L series only, equity starts at 0)
- `calculateTradePnl()` uses matchedQty × priceDiff (NOT per-exit summation)
- `calculatePositionSize()` and `calculatePlanAdherence()` are **DEAD CODE** (never called)

### Instrument Catalog (`instrument-catalog.ts`)

27 instruments with their `pointValueCents`:

| Symbol | Market | pointValueCents | contractSize |
|--------|--------|-----------------|--------------|
| EURUSD | forex | 10,000,000 ($100k/lot) | 100000 |
| GBPUSD | forex | 10,000,000 | 100000 |
| USDJPY | forex | 10,000,000 (JPY approx) | 100000 |
| XAUUSD | gold | 10,000 ($100/lot/$1) | 100 |
| XAGUSD | gold | 500,000 ($5k/lot) | 5000 |
| NAS100 | indices | 100 ($1/point) | 1 |
| NQ | futures | 2,000 ($20/point) | 20 |
| ES | futures | 5,000 ($50/point) | 50 |
| YM | futures | 500 ($5/point) | 5 |
| GC | futures | 10,000 ($100/$1) | 100 |
| CL | futures | 100,000 ($1000/$1) | 1000 |
| BTCUSD | crypto | 100 ($1/$1) | 1 |

**CRITICAL**: `contractSize` is INFORMATIONAL ONLY. `pointValueCents` is the AUTHORITATIVE multiplier. Formula: `grossPnl = priceDiff × quantity × pointValueCents`. NO `contractSize` multiplication.

### Instrument Bridge (`instrument-bridge.ts`)

`toInstrumentEconomics(def, accountCurrency)` — converts legacy `InstrumentDef` to spec-compliant `InstrumentEconomics`:
- quantityUnit: "lots" for forex/gold/crypto, "contracts" for futures/indices
- quantityScale: 2 for lots, 0 for contracts
- quoteCurrency: USD default, "JPY" for JPY pairs

---

## 6. API Routes

All 40 routes under `src/app/api/`. **Every protected endpoint calls `requireUser()`**. User isolation via `userId: user.id` on EVERY Prisma `where` clause.

### Auth Routes

**`POST /api/auth?mode=signup`** — Creates User (bcrypt 12 rounds), UserSettings, NotificationPreferences, LegalAcceptance. Rate-limited 5/min/IP. Sets `dnd_session` httpOnly cookie.

**`POST /api/auth?mode=signin`** — Verifies password. Rate-limited 10/min/IP. Same cookie flow.

**`DELETE /api/auth`** — Clears session cookie.

**`GET /api/auth`** — Returns current session user or 401.

### Trade Routes

**`POST /api/trades`** — Authoritative trade creation:
1. Auth + account ownership check
2. Instrument resolution via `resolveInstrumentForServer()` (DB → catalog → custom)
3. **Engine invocation**: `calculateTradeMetrics()` from `financial-engine.ts`
4. Status derivation: engine-derived when exit execution exists; user's `data.status` when no exit
5. Checklist anti-cheat: server-authoritative evaluation
6. Persists Trade + TradeExecution[] + TradeTarget[] + TradeChecklistEvaluation

**`GET /api/trades`** — List with filters (accountId, instrumentId, strategyId, session, status, direction, setupGrade, tag, search, fromDate, toDate, includeArchived). Cursor pagination.

**`GET /api/trades/[id]`** — Full trade with 8 includes (executions, targets, account, instrument, strategy, checklistEvaluations, media, reviewLinks). Inlines signed media URLs.

**`PATCH /api/trades/[id]`** — Mass-assignment protection (24-field allowlist). When executions change:
- Replaces execution ledger
- Calls `calculateTradeMetrics()` from new engine
- **CLOSED-POPULATION-FIX**: engine-derived status is AUTHORITATIVE when exit fill exists; `body.status` IGNORED
- Re-persists all cached financial fields

**`POST /api/trades/[id]/duplicate`** — Copies trade, sets status="open", isDraft=true. Known issue: copies exit executions verbatim.

### Dashboard + Analytics

**`GET /api/dashboard`** — Returns aggregate metrics + equity curve + daily P&L + R distribution + group breakdowns.
- **Filters by exitTime** (spec v3 §18.8) with **half-open interval [start, end)** (spec v3 §18.4)
- 6 presets: today, thisWeek, thisMonth, thisQuarter, thisYear, all
- Uses legacy `computeAggregateMetrics()` from calculations.ts
- Builds equityCurve, dailyPnl, rDistribution, byInstrument, bySession, byStrategy, byBehavior, aplusVsNonAplus, insights

**`GET /api/analytics?dimension=`** — 7 dimensions:
- `overview`: aggregate metrics
- `instrument`: group by instrumentSymbol
- `session`: group by session (with label mapping)
- `strategy`: group by strategyId (resolves names)
- `setupGrade`: group by A+/A/B/C/Invalid
- `behavior`: per-flag aggregate
- `time`: weekday + hour in user's timezone

### Other Key Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/accounts` | GET, POST | Account CRUD |
| `/api/accounts/[id]` | PATCH, DELETE | Update/delete (refuses if has trades) |
| `/api/strategies` | GET, POST | Strategy + initial version creation |
| `/api/strategies/[id]` | GET, PATCH, PUT, DELETE | PUT creates new version |
| `/api/checklists` | GET, POST | Checklist config + version |
| `/api/media` | GET, POST | Multipart upload (PNG/JPEG/WebP/GIF/MP4/WebM/MOV) |
| `/api/media/[id]` | GET, PATCH, DELETE, PUT | PATCH includes tradeId (BUG-EVID-1 fix); PUT sets annotations |
| `/api/media/file` | GET (public) | Signed URL file serving (HMAC-SHA256, 15min TTL) |
| `/api/settings` | GET, PATCH | 21-field allowlist |
| `/api/me` | GET | User + accounts + instruments + strategies + tradeCount |
| `/api/daily-plans` | GET, POST | Daily plan CRUD (@@unique [userId, date]) |
| `/api/reviews` | GET, POST | Review with auto-computed metrics snapshot |
| `/api/calendar` | GET | Monthly per-day aggregation |
| `/api/exports` | GET | CSV or JSON export |
| `/api/backups` | GET, POST, PUT | Backup list, create, restore (merge/replace) |
| `/api/clear-data` | DELETE | Permanently delete ALL user data (destructive) |
| `/api/delete-account` | DELETE | Permanently delete account (irreversible) |
| `/api/legal/[doc]` | GET (public), POST (auth) | Legal doc content + acceptance recording |
| `/api/audit` | GET | Audit event log |
| `/api/imports` | GET, POST | CSV import |
| `/api/imports/[id]` | PATCH | Map fields → confirm import |
| `/api/tags` | GET, POST, PATCH, DELETE | Tag CRUD |
| `/api/instruments` | GET, POST | Custom instrument CRUD |
| `/api/goals` | GET, POST | Goal tracking |
| `/api/action-items` | GET, POST, PATCH, DELETE | Action item CRUD |
| `/api/notifications` | GET, POST, PATCH, DELETE | Notification system |

---

## 7. Frontend Architecture

### Single-Page Application

`src/app/page.tsx` (142 lines) is the ONLY user-visible route. All other "pages" are views toggled via Zustand `useNav` store.

**Render logic:**
1. `useAuth().fetchUser()` on mount (8s timeout)
2. Cmd/Ctrl+K toggles command palette
3. If authenticated and view is landing/signin/signup → redirect to dashboard
4. First-time check: if no accounts and no trades → onboarding welcome
5. Optimistic render: if persisted nav view is an app view AND user just signed in, render `<AppShell />` immediately

### Root Layout (`src/app/layout.tsx`)

- Metadata: title "DnD — Trading Performance OS", icon `/logo.svg`
- **Theme-flash prevention**: Inline script reads `localStorage.getItem('dnd-theme')` and applies `data-theme` + `dark` class BEFORE first paint
- Providers: `<ThemeProvider>` → `<QueryProvider>` → `{children}` + `<Toaster />` + `<SonnerToaster />`

### State Management

**Zustand** (client UI state, persisted to localStorage):
- `nav-store.ts` — `view: ViewKey` (16 values), `params`, `scrollPositions`, `sidebarCollapsed`, `commandOpen`. Persisted as `dnd-nav`.
- `auth-store.ts` — `user`, `loading`, `authChecked`. `fetchUser()` with 8s AbortController.
- `onboarding-store.ts` — onboarding state (not_started|welcome|setup|tour|completed)
- `consent-store.ts` — cookie consent

**TanStack Query** (server state): All views use `useQuery` / `useMutation` / `useQueryClient`.

### Key Views

| View | Lines | Purpose |
|------|-------|---------|
| `dashboard-view.tsx` | 817 | Aggregate metrics, equity curve, daily P&L, R distribution, recent trades, breakdowns |
| `trade-form-view.tsx` | 2926 | 5-step wizard (Trade Info, Setup Checklist, Risk & Sizing, Partial Exits, Review & Save) |
| `trade-detail-view.tsx` | 820 | Trade detail with evidence, checklist, executions, plan adherence |
| `trades-log-view.tsx` | 510 | Trades table with filters |
| `analytics-view.tsx` | 953 | 5-tab analytics (Overall, By Setup, Checklist, Rule Violations, Sessions) |
| `calendar-view.tsx` | 679 | Monthly calendar with per-day P&L |
| `accounts-view.tsx` | 772 | Account CRUD + per-account stats |
| `settings-view.tsx` | 1271 | Profile, Appearance, Display, Defaults, Risk, Notifications, Privacy, Data |
| `playbooks-view.tsx` | 581 | Strategies CRUD + versions + checklists |
| `plans-view.tsx` | 748 | Daily plans CRUD |
| `reviews-view.tsx` | 319 | Reviews list + create |
| `backup-view.tsx` | 536 | Backup/restore/clear-data/delete-account |
| `auth-view.tsx` | 316 | Sign in / sign up |
| `landing-view.tsx` | 212 | Public landing page |

### Trade Form 5-Step Wizard

1. **Trade Info** — account, strategy, symbol, direction, status, date/time, session, timeframe, news, thesis, evidence uploads
2. **Setup Checklist** — items from strategy's rulesJson, live adherence %
3. **Risk & Sizing** — planned entry/stop/target, lot size, risk %, auto-calculated stop distance, R:R, risk amount, planned profit, **Plan Adherence & Exit** (Followed Plan → exit=target auto-set; Deviated → manual entry/stop/exit)
4. **Partial Exits** — add/remove named TP levels
5. **Review & Save** — summary cards + Save as Draft / Save Trade

### UI Library

48 shadcn/ui components: accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip.

---

## 8. Financial Calculation Flow

### Complete Flow: User → DB → Dashboard

```
1. User fills 5-step form
   ├─ Trade Info (account, symbol, direction, status, date/time)
   ├─ Setup Checklist (answers)
   ├─ Risk & Sizing (entry, stop, target, lotSize, riskPct, Plan Adherence & Exit)
   ├─ Partial Exits (TP levels)
   └─ Review & Save

2. submit() builds payload:
   ├─ Entry execution: { kind: "entry", price: actualEntry||plannedEntry, quantity: actualLot||lotSize }
   ├─ Exit execution (when status=closed): { kind: "exit", price: followedPlan?target:actualExit }
   ├─ waitForUploads() — polls for in-flight media uploads (30s timeout)
   └─ POST /api/trades (or PATCH /api/trades/[id])

3. POST /api/trades:
   ├─ requireUser() — auth
   ├─ resolveInstrumentForServer() — DB → catalog → custom
   ├─ toInstrumentEconomics() — convert to spec-compliant model
   ├─ calculateTradeMetrics() — THE AUTHORITATIVE ENGINE
   │   ├─ grossPnl = priceDiff × qty × pointValueCents
   │   ├─ netPnl = grossPnl - (fees + commission + swap + slippage)
   │   ├─ actualR = netPnl / plannedRisk
   │   ├─ plannedRR = targetDistance / stopDistance
   │   └─ outcome = deriveStatusAndOutcome(entryQty, exitQty, remainingQty, netPnl)
   ├─ Status derivation: engine AUTHORITATIVE when exit exists
   ├─ Checklist anti-cheat: server evaluates, overrides client values
   └─ db.trade.create() + executions + targets + checklistEvaluation

4. GET /api/dashboard:
   ├─ loadTrades(userId, from, to, accountId)
   │   └─ WHERE { userId, isArchived: false, exitTime: { gte: from, lt: endExclusive } }
   ├─ Map to TradeMetricRow[]
   ├─ computeAggregateMetrics(trades) — legacy calculations.ts
   │   ├─ closed = trades.filter(status IN win, loss, breakeven)
   │   ├─ wins = closed.filter(netPnl > 0)
   │   ├─ losses = closed.filter(netPnl < 0)
   │   ├─ winRate = wins / closed.length
   │   ├─ profitFactor = grossProfit / |grossLoss|
   │   ├─ maxDrawdown = max(peak - equity) ordered by exitTime
   │   └─ streaks with BE reset
   ├─ buildEquityCurve(trades, startingBalance)
   ├─ buildDailyPnl(trades)
   ├─ buildRDistribution(trades)
   └─ groupBy breakdowns (instrument, session, strategy, behavior)

5. Frontend display:
   ├─ DashboardView reads dash.aggregate.totalTrades, .closedTrades, .wins, .totalPnlCents
   ├─ AnalyticsView reads aggregate per dimension
   ├─ TradeDetailView reads trade.netPnlCents, .actualR, .plannedRR
   └─ CalendarView reads per-day pnlCents
```

---

## 9. Known Issues + Recent Fixes

### Financial Engine Rebuild (FINANCIAL-ENGINE task)

Built `src/lib/financial-engine.ts` (1247 lines) as the SINGLE authoritative engine. 60 golden tests (G01-G60) cover gold, forex, indices, futures, position sizing, partial exits, fees, R, analytics, immutability. Wired into POST + PATCH `/api/trades`. Fixed XAUUSD 100× preview bug.

### Closed-Trade Population Bug (CLOSED-POPULATION-FIX)

**Root cause**: Trade persisted with `status: "closed"` (form dropdown value) instead of engine-derived `"win"`. Dashboard's filter `status IN (win, loss, breakeven)` excluded it → 0 closed trades, $0 P&L.

**Fix**:
1. Data migration: `status` corrected from `"closed"` → `"win"`
2. PATCH handler: engine-derived status AUTHORITATIVE when exit exists
3. Dashboard/Analytics: switched from `entryTime` to `exitTime` filtering
4. Switched from `lte 23:59:59.999` to half-open `[start, end)` intervals
5. `largestWin`/`largestLoss` now null (not 0) when no wins/losses
6. Added 12 population tests

### XAUUSD 100× Preview Bug

**Pre-fix**: `instrumentRiskDollars = stopDistance × lotNum × contractSizeNum × (pointValueCents/100)` — double-counted contractSize. For XAUUSD lot=0.01, stopDistance=$1: gave $100 instead of $1.

**Post-fix**: `instrumentRiskCents = stopDistance × lotNum × pointValueCents`. For XAUUSD lot=0.01: `1 × 0.01 × 10000 = 100 cents = $1`. ✓

### Evidence Upload tradeId Bug (CALC-EVID-FIX)

PATCH `/api/media/[id]` allowlist omitted `tradeId`. Form's submit() PATCHes media with `{ tradeId, caption, timeframe }` but `tradeId` was silently dropped → media orphaned.

**Fix**: Added `tradeId` to allowlist with ownership validation. Added `waitForUploads()` helper (30s timeout). Reattached existing orphan media.

### .env Reversion / Neon Env Guard (AUTH-FIX + permanent fix)

**Root cause**: Z.ai sandbox platform writes `.env` with SQLite URL at container start.

**Fix**:
1. `scripts/ensure-neon-env.mjs` — runs as `predev` + `prebuild` hook, restores Neon config
2. `src/lib/db.ts` — throws FATAL if DATABASE_URL missing or not postgresql://
3. `.zscripts/dev.sh` — runs env guard before `db:push`, makes `db:push` non-fatal

### Deploy Fix (postinstall: prisma generate)

Added `"postinstall": "prisma generate"` to package.json. Without this, deploy-time `bun install` didn't generate the Prisma client → build failed with `Cannot find module '.prisma/client/default'`.

---

## 10. How to Run

| Command | What it does |
|---------|-------------|
| `bun run dev` | predev (env guard) → `next dev -p 3000` |
| `bun run build` | prebuild (env guard) → `next build` + cp static/public to standalone |
| `bun run start` | `NODE_ENV=production bun .next/standalone/server.js` |
| `bun run lint` | `eslint .` |
| `bun run test` | `bun test src/lib/financial-engine.test.ts` (60 tests) |
| `bun test src/lib/` | Runs all tests (60 financial + 12 population = 72 total) |
| `bun run db:push` | `prisma db push --accept-data-loss` (additive, non-destructive) |
| `bun run db:generate` | `prisma generate` |

**Demo user**: `trader@dnd.local` / `dnd12345`

**Production build**: `bun run build` produces `.next/standalone/server.js` (standalone output mode).

**Deploy artifact**: `.zscripts/build.sh` creates a tar.gz with Next.js standalone + Caddyfile + start.sh.

---

## 11. Testing

- **Framework**: `bun:test` (Bun's built-in test runner)
- **Test files** (excluded from tsconfig build):
  - `src/lib/financial-engine.test.ts` (1285 lines, 60 tests G01-G60)
  - `src/lib/population.test.ts` (239 lines, 12 tests POP-1 to POP-12)
- **Total**: 72 tests, all PASS, ~90ms total runtime
- **Coverage**: Gold (XAUUSD), Gold Futures (GC/MGC), Index Futures (NQ/MNQ/ES/MES), Forex (EURUSD/USDJPY with conversion), Position Sizing (7 boundary tests), Partial Exits (5 tests), Fees (3 tests), R Tests (4 tests), Analytics (10 tests), Immutability (3 tests), Populations (12 tests)

---

## 12. Security + Auth

### Password Hashing
- `bcryptjs` with 12 rounds
- `hashPassword(password)` → `bcrypt.hash(password, 12)`
- `verifyPassword(password, hash)` → `bcrypt.compare(password, hash)`

### JWT Session Cookie
- `jose` library (HS256)
- Cookie: `dnd_session`, httpOnly, secure in prod, sameSite: lax, path: /, 30-day maxAge
- Payload: `{ sub: userId, email, iat, exp }`
- Secret: `SESSION_SECRET` (≥32 chars; dev fallback with console.error warning)

### Rate Limiting
- In-memory `Map<string, { count, resetAt }>`
- Signup: 5/min/IP, Signin: 10/min/IP
- Resets on server restart (not suitable for multi-instance)

### Security Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; etc.

### User Isolation (RLS Simulation)
- `requireUser()` called by every protected route
- EVERY Prisma `where` clause includes `userId: user.id`
- PATCH operations use explicit field allowlists (no mass-assignment)
- FK fields validated for ownership before writing

### Signed Media URLs
- Files served via `/api/media/file?token=...` (no direct filesystem access)
- Token = base64url(payload).signature, HMAC-SHA256 with STORAGE_SECRET
- 15-minute TTL
- `crypto.timingSafeEqual` for constant-time comparison
- Path traversal prevention (strips `..` and leading `/`)

### MIME Allowlist
- Images: PNG, JPEG, WebP, GIF (max 20 MB)
- Videos: MP4, WebM, QuickTime/MOV (max 500 MB)

### Audit Trail
- `audit(action, entity, entityId?, diff?)` — best-effort (never throws)
- Tracks: trade CRUD, account/strategy/checklist ops, media uploads, imports, backups, settings, user ops

---

## 13. Domain Specification

### `DnD_FINAL_DOMAIN_SPECIFICATION_v3.md` (2839 lines, 25 sections)

**Status**: AUTHORITATIVE — supersedes v1 and v2.

**25 sections:**

1. **Instrument Economics** — Canonical structure (14 fields). `pointValue` per quantity unit. `contractSize` informational only.
2. **Currency Model** — Approach B (reject if conversion unavailable). Native P&L always preserved. JPY scale 0.
3. **Quantity Model** — quantityUnit, quantityScale, quantityStep, minimumQuantity. Floors to step.
4. **Financial Formulas** — `grossPnl = priceDiff × qty × pointValue`. Single canonical formula. NO contractSize.
5. **Risk / Position Sizing** — `riskBudget = balance × riskPct`; `rawQuantity = riskBudget / riskPerUnit`; floor to step.
6. **Execution Ledger** — Atomic recalc. Execution ledger is SOLE authority; persisted fields are caches.
7. **Partial Exits** — Each exit independently calculated, then summed. Per-surface population invariant.
8. **Status Lifecycle** — 6 outcomes (WIN, LOSS, BREAKEVEN, PARTIAL_WIN, PARTIAL_LOSS, PARTIAL_BREAKEVEN). DERIVED, never user input.
9. **Checklist** — `rawWeightedScore` preserved. Required-rule cap on `finalGrade` only via `MIN_GRADE(normalGrade, C)`.
10. **Persistence Contract** — All money BIGINT. All decimals NUMERIC with explicit scale.
11. **PATCH Semantics** — Distinguish omitted/null/empty/value. Collections: replace/append/update/delete.
12. **Historical Snapshots** — FinancialSnapshot preserves full instrument economics + conversion metadata. Frozen at close.
13. **Analytics Source of Truth** — Single pipeline: FinancialEngine → TradeMetrics → AnalyticsEngine → UI.
14. **Analytics Populations** — closedTrades = WIN+LOSS+BREAKEVEN; partialTrades = PARTIAL_*.
15. **Analytics Metrics** — winRate (excludes breakevens), profitFactor (Infinity/0/null), drawdown (single account only).
16. **Analytics Dimensions** — overview/instrument/session/strategy/setupGrade/behavior/time.
17. **Multi-Account Behavior** — All-accounts: maxDrawdown, equityCurve = NULL.
18. **Time Model** — UTC stored. Half-open [start, end). IANA TZ. EXIT time for realized performance.
19. **Precision Model** — BIGINT for money. Real decimal library. JS Number only at presentation boundary.
20. **API Requirements** — Idempotency for POST, optimistic concurrency for PATCH.
21. **Database Model** — All money BIGINT. FKs + CHECK constraints.
22. **Golden Financial Dataset** — 16 test cases T1-T16.
23. **Golden Analytics Dataset** — 60+ trades with manual computation.
24. **Checklist Analytics Tests** — 12 boundary tests.
25. **Self-Consistency Validation** — 15 contradiction categories audited, all resolved.

### Key Invariants

1. **NO SQLite fallback** — db.ts throws FATAL if DATABASE_URL not postgresql://
2. **ONE financial engine** — `financial-engine.ts` is authoritative
3. **closedTrades = WIN + LOSS + BREAKEVEN** — status is DERIVED, never user input
4. **pointValue per quantity unit** — contractSize is INFORMATIONAL ONLY
5. **Native P&L always preserved** — converted P&L null when unavailable
6. **Half-open date intervals** — [start, end), never 23:59:59.999
7. **EXIT time for realized performance** — dashboard/analytics filter by exitTime
8. **rawWeightedScore NEVER falsified** — required-rule cap on finalGrade only
9. **Engine is pure** — same inputs → same outputs, no mutation
10. **Historical snapshot** — engine receives instrument as input, respects snapshot

---

## 14. Audit Findings + Recommended Next Actions

### Known Issues (from FINANCIAL-AUDIT)

1. **6 calculation sites need consolidation** — new engine (`financial-engine.ts`) + legacy (`calculations.ts`) + client-side previews. Dashboard/analytics/reviews/imports still use legacy engine.
2. **3 different win-rate formulas**:
   - Dashboard: `wins / closed.length` (includes breakevens in denominator)
   - Calendar: `wins / trades` (ALL trades including open)
   - New engine: `wins / (wins + losses)` (excludes breakevens) ← spec-compliant
3. **`quantityPct` hardcoded to "0"** in POST/PATCH — form has no quantity input for partial exits
4. **`decimal.ts` is NOT string-based** — uses `Number()` + `toFixed(10)` despite docstring
5. **`computePointValueCents` duplicated** in 3 places (calculations.ts, instrument-resolver.ts, instrument-catalog.ts)
6. **`seed.ts` hardcodes pointValueCents=100** for ALL demo trades — wrong P&L for forex/metals
7. **Duplicate trade copies executions** — would re-derive status="win" on next PATCH
8. **`calculatePositionSize()` and `calculatePlanAdherence()` are DEAD CODE** — declared but never called
9. **Client-side financial aggregation** in accounts-view.tsx (forbidden per spec §13.1)
10. **close-trade-modal `estimatedPnl`/`estimatedR`** — wrong formula, missing pointValue
11. **trade-detail-view costs display** omits `slippageCents` from the sum
12. **No migrations directory** — schema is `db push`-ed (no rollback support)

### Recommended Next Actions (for taking-over AI)

1. **Consolidate engines** — migrate dashboard/analytics/reviews/imports from legacy `calculations.ts` to new `financial-engine.ts`
2. **Wire up `calculatePositionSize`** — currently dead code; form bypasses it entirely
3. **Wire up `calculatePlanAdherence`** — currently dead code
4. **Fix `quantityPct` hardcoded to "0"** — add quantity input to Partial Exits step
5. **Replace `decimal.ts`** with true arbitrary-precision (decimal.js or BigInt fixed-point)
6. **Unify the 3 win-rate formulas** — use new engine's formula everywhere
7. **Eliminate client-side financial aggregation** — accounts-view, close-trade-modal, dashboard breakdowns
8. **Add v3-spec missing schema columns** — nativePnlCurrency, nativeGrossPnlMinor, convertedGrossPnlMinor, conversionRate, conversionDirection, pnlAvailability, entryQuantity/exitQuantity/remainingQuantity, outcome (separate from status), closedAt, version (optimistic concurrency)
9. **Move costs from Trade to TradeExecution** per spec §10.1.3
10. **Fix trade-detail costs display** — add slippageCents to the sum
11. **Fix `seed.ts` hardcoded pointValueCents** — use actual catalog values
12. **Fix duplicate-trade executions copy** — null out exit executions for the duplicate
13. **Add migrations directory** — switch from `db push` to `prisma migrate` for production
14. **Move rate limiter to Redis** — current in-memory resets on restart

---

## Quick Reference

| What | Where |
|------|-------|
| Authoritative financial engine | `src/lib/financial-engine.ts` |
| Legacy engine (still used by dashboard/analytics) | `src/lib/calculations.ts` |
| Instrument catalog | `src/lib/instrument-catalog.ts` |
| Instrument bridge (legacy → spec) | `src/lib/instrument-bridge.ts` |
| Server instrument resolver | `src/lib/instrument-resolver.ts` |
| Database client + guard | `src/lib/db.ts` |
| Auth (bcrypt + JWT) | `src/lib/auth.ts` |
| API helpers (ok/bad/parseJson/rateLimit) | `src/lib/api.ts` |
| Storage (signed URLs) | `src/lib/storage.ts` |
| Decimal utilities | `src/lib/decimal.ts` |
| Money formatting | `src/lib/money.ts` |
| Checklist evaluation | `src/lib/checklist-evaluation.ts` |
| Audit trail | `src/lib/audit.ts` |
| News events (hardcoded) | `src/lib/news-events.ts` |
| Legal doc versions | `src/lib/legal-versions.ts` |
| Timezone helpers | `src/lib/timezones.ts` |
| Timeframe list | `src/lib/timeframes.ts` |
| Fuzzy search | `src/lib/fuzzy-search.ts` |
| Env guard (predev/prebuild) | `scripts/ensure-neon-env.mjs` |
| Domain spec v3 | `DnD_FINAL_DOMAIN_SPECIFICATION_v3.md` |
| Golden tests (60) | `src/lib/financial-engine.test.ts` |
| Population tests (12) | `src/lib/population.test.ts` |
| Build log | `worklog.md` (3944 lines) |

---

**End of comprehensive analysis.** This report provides everything another AI needs to understand and take over the DnD project.
