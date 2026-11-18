# ALPHAPIPS — TEST COVERAGE & SYSTEM ISSUES REGISTER
**Authoritative Quality Assurance Matrix, Automated Test Inventory, Gaps & Architectural Register**

---

## 1. QUALITY ASSURANCE ARCHITECTURE & TEST RUNNER

AlphaPips utilizes the **Bun test runner** (`bun test`) for rapid, TypeScript-native execution of unit, integration, mathematical, and security isolation suites.

### Testing Infrastructure Overview:
- **Test Runner:** Bun v1.4.0 (`bun test`).
- **Assertion Framework:** Standard `expect()` matchers.
- **Test Suite Location:** Co-located in `src/lib/*.test.ts`.
- **Database Test Isolation:** Tests use synthetic identifiers (e.g. `SYNTH-TRADE-001`, `SYNTH-USER-001`), in-memory data structures, or transaction rollbacks (`$executeRawUnsafe`) to guarantee zero data mutation of development or production databases.
- **Total Test Suites Identified:** 23 dedicated test files in `src/lib/`.
- **Primary Financial Verification:** `src/lib/financial-engine.test.ts` contains 60 rigorous mathematical proof scenarios executing in ~215ms.

---

## 2. FEATURE-TO-TEST MAPPING INVENTORY

| Feature / Domain | Primary Test Suite File | Test Scenario Count | Key Assertions & Verifications |
| :--- | :--- | :--- | :--- |
| **Financial Engine & P&L** | `src/lib/financial-engine.test.ts` | 60 | Forex, Gold, Futures, Indices, Crypto P&L formulas; stop distance; risk/reward; point values; partial exits; fees/commission/swap/slippage deductions; BigInt minor unit precision; banker's rounding; equity curve; maximum drawdown. |
| **Prop Firm Rules & Resets** | `src/lib/prop-firm-engine.test.ts` | 8 | 17:00 NY cycle grouping; DST transitions (EDT vs EST); static vs trailing drawdown; high-water mark tracking; approaching limit warnings; single-day consistency dilution vs hard breach. |
| **Prop Lifecycle Progression** | `src/lib/prop-lifecycle.test.ts` | 20 | 1-step, 2-step, multi-step, instant funded lifecycle progression; phase transition snapshots; manual firm rejection & dispute tracking; payout eligibility & profit splits; synthetic trade isolation. |
| **Checklist Adherence Engine** | `src/lib/checklist-adherence.test.ts` | 5 | True adherence calculation decoupled from win rate; required vs optional rule weighting; missing checklist responses handling; multi-version rule isolation. |
| **Trade Idempotency** | `src/lib/trade-idempotency.test.ts` | 8 | PostgreSQL atomic reservation (`INSERT ... ON CONFLICT DO NOTHING`); SHA-256 payload hashing; race-condition concurrency lock; 409 conflict on mismatched payload; delayed replay survival (>30s). |
| **Multi-User Data Isolation** | `src/lib/multi-user-isolation.test.ts` | 6 | Cross-user query boundary verification; prevents User A from reading, editing, or deleting User B's accounts, trades, strategies, or backups. |
| **Multi-Panel Workspace & Widgets** | `src/lib/phase5-workspace-widgets.test.ts` | 10 | 2-panel default (50/50 split); strict exclusion of standalone noTrades; inclusion of riskCalculator; panel bounds (1–4); exactly 7 approved widgets; widget size constraints; snap-to-edge; privacy masking. |
| **Instrument Catalog & Sizing** | `src/lib/instrument-catalog.test.ts` | 12 | 50+ symbol definitions; correct point values, tick sizes, contract sizes; position sizing for Forex, Gold, Futures, and Crypto. |
| **Duration & Holding Analytics** | `src/lib/duration-analytics.test.ts` | 6 | Holding duration bucketing (scalp, day, swing, multi-day); trade duration distribution; profit vs duration correlation. |
| **Filter Presets Engine** | `src/lib/filter-presets.test.ts` | 5 | Preset creation, JSON serialization, pinned preset behavior, active filter resolution. |
| **Global Fuzzy Search** | `src/lib/global-search-domains.test.ts` | 6 | Cross-domain search across trades, accounts, strategies, tasks, and strategy dictionary entries. |
| **Backup Safety & Deduplication** | `src/lib/backup-safety.test.ts` | 7 | Schema 2.0 archive export; pre-restore inspection report; duplicate detection scoring (100%, 85%, 60%, 0%); transactional safety. |
| **Broker CSV Import Mappings** | `src/lib/broker-csv-mappings.test.ts` | 8 | Column header normalization; date/time parsing across broker formats; fee extraction; execution matching. |
| **Strategy Management & Diffing** | `src/lib/strategy-management.test.ts`<br>`src/lib/strategy-comparison.test.ts` | 14 | In-place version editing vs version upgrade; historical trade snapshot preservation; rule diffing (added/removed/modified); sample size guardrails (`N < 20`). |
| **Trades Pagination & Filtering** | `src/lib/trades-filtering.test.ts`<br>`src/lib/trades-pagination-search.test.ts` | 12 | Server-side cursor and offset pagination; compound multi-criteria filtering; outcome filtering; text search indexing. |
| **Population Segregation** | `src/lib/population.test.ts` | 6 | Strict exclusion of draft trades, planned trades, synthetic sample trades, and no-trade observations from official metrics. |
| **Phase 1 Hardening** | `src/lib/phase1-hardening.test.ts` | 10 | Security audit, RLS emulation checks, input sanitation, session handling. |
| **Phase 2–4 Workflow Suites** | `src/lib/phase2-workflow.test.ts`<br>`src/lib/phase3-analytics.test.ts`<br>`src/lib/phase4-secondary-workflows.test.ts`<br>`src/lib/phase1-4-acceptance-deep.test.ts` | 38 | End-to-end integration workflows: trade logging to analytics; challenge pass to funded activation; backup export to restore. |

---

## 3. IDENTIFIED TESTING GAPS & UNTESTED SURFACES

While domain logic and financial calculations have extensive automated test coverage, the following architectural gaps exist:

1. **Continuous Browser E2E Pipeline (Playwright / Cypress in CI):**
   - *Current State:* Browser workflows (WF-01 to WF-13) were executed and validated manually and via standalone Puppeteer verification scripts (`artifacts/browser-interaction-results/`).
   - *Limitation:* There is no active GitHub Actions or GitLab CI automated browser testing pipeline executing on every push.
2. **Missing `recoveryFactor` Implementation:**
   - *Current State:* Mentioned in legacy product requirements, but grep across `src/` reveals `recoveryFactor` is **not implemented** in `financial-engine.ts` or returned by `/api/analytics`.
   - *Impact:* Analytics tab displays Net P&L and Max Drawdown, but not the explicit Recovery Factor ratio ($\text{Net Profit} / \text{Max Drawdown}$).
3. **Live Broker WebSocket Streaming (MT4 / MT5 / cTrader):**
   - *Current State:* Trade entry is manual or via CSV broker imports.
   - *Limitation:* Real-time automated execution capture via broker WebSockets or FIX protocol is not implemented.
4. **Offline Sync Conflict Resolution on Concurrent Multi-Device Edits:**
   - *Current State:* `src/lib/offline-sync-engine.ts` queues mutations in IndexedDB when offline.
   - *Limitation:* If a user modifies the same trade on desktop and mobile while offline, sync uses last-write-wins without field-level 3-way merge.

---

## 4. SYSTEM-WIDE DEFECT & IMPROVEMENT REGISTER

### 4.1 Severity Classification:
- **Critical:** Data corruption, financial miscalculation, security vulnerability, cross-user data leakage.
- **High:** Major workflow disruption, broken core navigation, incorrect compliance reporting.
- **Medium:** Usability friction, missing secondary calculations, inconsistent responsive behavior.
- **Low:** Minor aesthetic polish, non-critical accessibility tweaks, documentation discrepancies.

### 4.2 Verified Architectural Register

| Issue ID | Severity | Domain | Module / File Path | Evidence / Description | Status / Root Cause | Recommended Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REG-01** | `Medium` | Financial Calculations | `src/lib/financial-engine.ts` | `recoveryFactor` formula is omitted from `computeAggregateMetrics()`. | Verified implementation gap. Function returns Net P&L and Max Drawdown, but omits the explicit ratio. | Implement `recoveryFactor = maxDrawdownCents > 0 ? (netPnlCents / maxDrawdownCents) : null` in `financial-engine.ts`. |
| **REG-02** | `Low` | Architecture / Cleanup | `src/components/views/no-trades-view.tsx` | `no-trades-view.tsx` exists as a standalone view file despite the strict non-negotiable excluding a standalone No-Trade page. | Verified historical artifact. The view is not linked in sidebar navigation and excluded from Multi-Panel Workspace, but file remains. | Retain file for reference, but ensure it remains completely detached from primary navigation routes. |
| **REG-03** | `Low` | Architecture / Schema | `prisma/schema.prisma` (`DailyPlan`, `Review`, `ReviewTradeLink`) | Legacy models for Daily Plans and Standalone Reviews remain in the Prisma schema. | Documented intention vs schema legacy. Application code does not expose views or endpoints for them. | Keep models in schema to prevent destructive DB migrations, but enforce zero application exposure. |
| **REG-04** | `Medium` | Frontend / Workspace | `src/components/workspace/multi-panel-workspace.tsx` | On screen widths between 1024px and 1299px, selecting a 3-column layout causes panel widths to drop below 380px. | Verified behavior. Toolbar displays an alert pill (`isWidthCrampedFor3Col = true`). | Restrict 3-column layout selector strictly to viewports $\ge 1300\text{px}$; default to 2-column below 1300px. |
| **REG-05** | `Low` | Performance | `src/app/api/trades/route.ts` | List query performs full table count on every paginated request without caching total count. | Inferred scalability bottleneck for user accounts with >10,000 trades. | Implement approximate count caching in `AnalyticsCache` for large datasets. |

---

## 5. STRICT NON-NEGOTIABLES & PRESERVED ARCHITECTURAL DECISIONS

The following architectural constraints and product exclusions have been strictly verified in the codebase and **MUST NOT BE CHANGED** in future development:

1. **NO Standalone Daily Plans:** Traders plan setups directly within strategy playbooks and the Trading To-Do list. No standalone daily planning calendar or forms exist.
2. **NO Standalone Daily, Weekly, or Monthly Review Wizards:** Performance review is integrated directly into the Analytics Engine and Dashboard; no detached subjective journal review wizards exist.
3. **NO Individual Trade-Level Review Features:** The trade logging modal terminates with a transactional "Confirm & Save" summary. No subjective post-trade review wizard is permitted.
4. **NO Global Media Library:** Chart screenshots remain attached strictly to individual trade records. No shared detached media gallery exists.
5. **NO Separate No-Trade Journal Page:** Market restraint observations are logged and viewed strictly inside a dedicated tab within `TradesLogView`. Observations are excluded from financial P&L, trade counts, win rate, and prop compliance calculations.
6. **Preserve the Three Approved Themes:** Nordic, Sleek Terminal, and Slate Contrast must remain the three standardized themes.
7. **Preserve the Three Independent Typography Roles:** Interface, Display, and Financial roles must remain independently configurable.
8. **Retain Exactly Seven Approved Floating Widgets:** Drawdown Monitor, Quick Risk Calculator, Daily Risk Limit, Quick Notes, Focus Timer, Random Trading Tip, and Sticky Notes.
