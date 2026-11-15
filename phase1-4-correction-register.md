# ALPHAPIPS — PHASE 1–4 CORRECTION REGISTER & WORK BREAKDOWN
## Comprehensive Requirement Inventory, Defect Root Causes & Correction Blueprint

**Governing Specification:** `five-phase-upgrade.md` (Parts I through VIII)  
**Baseline Document:** `phase1-4-audit-reconciliation.md`  
**Mode:** Master Implementation Authorized — Phases 1, 2, 3, and 4 Only  
**Execution Order:** Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Integration & Full Regression  
**Date:** 2026-11-15T12:35:00+03:00

---

# 1. EXECUTIVE SUMMARY & CORRECTION SCOPE

Following the forensic audit and reconciliation, the AlphaPips application has been confirmed to contain **81 unique roadmap requirements** across Phases 1 through 4. While the core mathematical engine and primary architectures are established (40 Verified, 35 Implemented — Not Browser Verified), **6 confirmed functional and evidence defects (F-01 through F-06)** must be corrected to achieve full compliance before Phase 5 can be considered:

1. **Defect F-01 (P1-K01 Branding):** Residual legacy branding in `src/components/strategies/strategy-detail-view.tsx:298`, `playbooks-view.tsx:608`, `financial-engine.ts:1608`, `legal-versions.ts`, and file export headers.
2. **Defect F-02 (P4-C02 Market-Specific Risk Calculator):** Generic fallback sizing for Cash Indices (`NAS100`, `US30`, `SPX500`) and Silver CFD (`XAGUSD`); lack of broker lot step increments, maximum quantities, and quote-to-account currency conversion.
3. **Defect F-03 (P4-D03 Trading To-Do):** Board (Kanban) view mode is completely missing from `trading-todo-view.tsx` (only List view exists); user-defined custom list creation is missing.
4. **Defect F-04 (P4-E04 Backup / Restore Mid-Restore Failure Recovery):** Lack of automated integration tests verifying mid-restore transaction rollback and snapshot availability.
5. **Defect F-05 (P4-E06 Broker CSV Import Parsing & Precision):** `parseInt` truncation of fractional dollar commissions/swaps; lack of European decimal comma normalization; unhandled broker timezone offsets; lack of real broker fixture parsing tests.
6. **Defect F-06 (P4-G01 Global Search 9 Domains):** Global Search only searches 7 database domains; Quick Notes and Sticky Notes reside in browser `localStorage` and are excluded from search; archived strategy versions lack `isArchived: false` filter.

---

# 2. COMPLETE REQUIREMENT-BY-REQUIREMENT CORRECTION REGISTER

The following register tracks every single requirement across Phases 1 through 4, detailing its roadmap reference, current implementation, defect, required correction, dependencies, tests required, and target status.

### Phase 1: Financial Correctness, Data Integrity & Core Validation (22 Requirements)

| Req ID | Roadmap Reference | Implementation Path | Current Status | Identified Defect | Required Correction | Dependencies | Tests Required | Target Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **P1-A01** | Part II §1.1, Part VIII Phase 1 Workstream A | `src/lib/checklist-adherence.ts` | VERIFIED | None | Preserve decoupled adherence calculation. | Financial Engine | `checklist-adherence.test.ts` | VERIFIED |
| **P1-A02** | Part II §1.1, Part VIII Phase 1 Workstream A | `src/lib/checklist-adherence.ts:77` | VERIFIED | None | Preserve adherence formula (completed / total required). | Financial Engine | `checklist-adherence.test.ts` | VERIFIED |
| **P1-A03** | Part II §1.1, Part VIII Phase 1 Workstream A | `src/lib/checklist-adherence.ts:87` | VERIFIED | None | Preserve missing response flagging and sample disclosures. | Financial Engine | `checklist-adherence.test.ts` | VERIFIED |
| **P1-B01** | Part II §1.2, Part VIII Phase 1 Workstream B | `src/components/views/analytics-view.tsx:1131` | VERIFIED | None | Preserve association/correlation language for rule violations. | Analytics View | `phase1-hardening.test.ts` | VERIFIED |
| **P1-B02** | Part II §1.2, Part VIII Phase 1 Workstream B | `analytics-view.tsx`, `metric-definitions.ts` | VERIFIED | None | Preserve elimination of causal language in UI/tooltips. | Analytics View | Static string analysis | VERIFIED |
| **P1-C01** | Part II §1.3, Part VIII Phase 1 Workstream C | `src/app/api/analytics/route.ts:303` | VERIFIED | None | Preserve realized net P&L aggregation for hourly/weekdays. | Financial Engine | `financial-engine.test.ts` | VERIFIED |
| **P1-C02** | Part II §1.3, Part VIII Phase 1 Workstream C | `src/app/api/analytics/route.ts:308` | VERIFIED | None | Preserve user timezone conversion for hourly buckets. | Timezone Clock | `phase1-hardening.test.ts` | VERIFIED |
| **P1-D01** | Part II §1.4, Part VIII Phase 1 Workstream D | `api/dashboard/route.ts`, `api/analytics/route.ts` | VERIFIED | None | Preserve identical half-open interval `[start, end)` scoping. | Dashboard & Analytics APIs | `phase1-hardening.test.ts` | VERIFIED |
| **P1-D02** | Part II §1.4, Part VIII Phase 1 Workstream D | `src/components/analytics/shared-filter-bar.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve active filter pills and drill-down controls. | Shared Filter Bar | Visual UI inspection | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P1-E01** | Part II §1.5, Part VIII Phase 1 Workstream E | `src/lib/financial-engine.ts:846` | VERIFIED | None | Preserve historical closed-trade balance drawdown calculation. | Financial Engine | `financial-engine.test.ts` | VERIFIED |
| **P1-E02** | Part II §1.5, Part VIII Phase 1 Workstream E | `src/lib/drawdown-analytics-engine.ts:80` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve transparent notice when drawdown cannot be computed. | Drawdown Tab | Component inspection | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P1-E03** | Part II §1.5, Part VIII Phase 1 Workstream E | `src/lib/financial-engine.ts:878` | VERIFIED | None | Preserve peak-to-trough recovery tracking. | Financial Engine | `financial-engine.test.ts` | VERIFIED |
| **P1-F01** | Part II §1.6, Part VIII Phase 1 Workstream F | `financial-engine.ts`, `trade-form-view.tsx` | VERIFIED | None | Preserve decimal vs percentage consistency in planned risk. | Trade Form | `financial-engine.test.ts` | VERIFIED |
| **P1-F02** | Part II §1.6, Part VIII Phase 1 Workstream F | `src/lib/instrument-catalog.ts:85` | VERIFIED | None | Preserve canonical point values across instruments. | Instrument Catalog | `instrument-catalog.test.ts` | VERIFIED |
| **P1-G01** | Part II §1.7, Part VIII Phase 1 Workstream G | `src/components/views/trade-form-view.tsx:3705` | VERIFIED | None | Preserve Step 5 Confirm & Save financial summary consistency. | Trade Form | `financial-engine.test.ts` | VERIFIED |
| **P1-H01** | Part II §1.8, Part VIII Phase 1 Workstream H | `prisma/schema.prisma`, `api/trades/route.ts` | VERIFIED | None | Preserve authoritative foreign keys for accounts/strategies. | Prisma Schema | `phase1-hardening.test.ts` | VERIFIED |
| **P1-H02** | Part II §1.8, Part VIII Phase 1 Workstream H | `src/app/api/trades/[id]/route.ts` | VERIFIED | None | Preserve soft archiving and relational integrity on edits. | Trade Routes | `phase1-hardening.test.ts` | VERIFIED |
| **P1-I01** | Part II §1.9, Part VIII Phase 1 Workstream I | `src/lib/prop-firm-engine.ts:240` | VERIFIED | None | Preserve single-day profit concentration rule evaluation. | Prop Firm Engine | `prop-firm-engine.test.ts` | VERIFIED |
| **P1-I02** | Part II §1.9, Part VIII Phase 1 Workstream I | `src/lib/prop-firm-engine.ts:98` | VERIFIED | None | Preserve 17:00 NY daily loss cutoff reset. | Prop Firm Engine | `prop-firm-engine.test.ts` | VERIFIED |
| **P1-J01** | Part II §1.10, Part VIII Phase 1 Workstream J | `src/lib/timezone-clock.ts` | VERIFIED | None | Preserve separation of user, NY, and session clocks. | Timezone Utilities | `timezone-clock.test.ts` | VERIFIED |
| **P1-K01** | Part II §1.11, Part VIII Phase 1 Workstream K | `strategy-detail-view.tsx:298`, `playbooks-view.tsx:608`, `legal-versions.ts` | PARTIALLY IMPLEMENTED | **Defect F-01:** Legacy "DnD" branding in strategy detail, playbooks, financial engine, legal documents, and export file names. | Replace all user-visible and document occurrences of "DnD" with "AlphaPips"; confirm "Slate Contrast" theme label. | UI views & legal documents | Code search & test assertion | **VERIFIED** |
| **P1-L01** | Part II §1.12, Part VIII Phase 1 Workstream L | `accounts-view.tsx`, `financial-engine.ts` | VERIFIED | None | Preserve transparent disclosure of settled balance vs live equity. | Accounts View | `phase1-hardening.test.ts` | VERIFIED |

---

### Phase 2: Journal Workflow, New Trade & Trade Detail (18 Requirements)

| Req ID | Roadmap Reference | Implementation Path | Current Status | Identified Defect | Required Correction | Dependencies | Tests Required | Target Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **P2-A01** | Part IV §4.1, Part VIII Phase 2 Workstream A | `src/components/views/trade-form-view.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve 5-step wizard structure with Quick Entry mode. | Trade Form | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-A02** | Part IV §4.1, Part VIII Phase 2 Workstream A | `src/components/views/trade-form-view.tsx:550` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve conditional field rendering based on asset class. | Trade Form | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-A03** | Part IV §4.1, Part VIII Phase 2 Workstream A | `src/components/views/trade-form-view.tsx:320` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve Step 1 Account & Strategy pre-selection. | Trade Form | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-A04** | Part IV §4.1, Part VIII Phase 2 Workstream A | `src/components/views/trade-form-view.tsx:180` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve draft autosave and restoration prompt with discard modal. | Trade Form | `phase2-workflow.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-A05** | Part IV §4.1, Part VIII Phase 2 Workstream A | `src/components/views/trade-form-view.tsx:1850` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve strategy checklist execution and response recording. | Checklist Engine | `phase2-workflow.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-B01** | Part IV §4.2, Part VIII Phase 2 Workstream B | `src/components/views/trades-log-view.tsx:80` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve 4-tab architecture (All Entries, Executed Trades, No-Trades, Favorites). | Trades Log | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-B02** | Part IV §4.2, Part VIII Phase 2 Workstream B | `src/components/views/trades-log-view.tsx:140` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve scoped multi-field search (symbol, notes, grade). | Trades Log | `trades-pagination-search.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-B03** | Part IV §4.2, Part VIII Phase 2 Workstream B | `src/components/views/trades-log-view.tsx:210` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve multi-dimensional advanced filter drawer. | Trades Log | `trades-filtering.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-B04** | Part IV §4.2, Part VIII Phase 2 Workstream B | `src/components/views/trades-log-view.tsx:310` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve saved filter presets creation and recall. | Trades Log | `filter-presets.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-B05** | Part IV §4.2, Part VIII Phase 2 Workstream B | `src/app/api/trades/route.ts:40` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve server-side cursor pagination and sorting. | Trades API | `trades-pagination-search.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-C01** | Part IV §4.3, Part VIII Phase 2 Workstream C | `src/components/views/trade-detail-view.tsx:65` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve 6-tab unified architecture (Overview, Setup, Execution, Replay, Psychology, Evidence). | Trade Detail | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-C02** | Part IV §4.3, Part VIII Phase 2 Workstream C | `src/components/views/trade-detail-view.tsx:210` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve immutable strategy snapshot & checklist evaluation view. | Trade Detail | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-C03** | Part IV §4.3, Part VIII Phase 2 Workstream C | `src/components/views/trade-detail-view.tsx:320` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve executions, fills breakdown, and financial summary. | Trade Detail | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-C04** | Part IV §4.3, Part VIII Phase 2 Workstream C | `src/components/views/trade-detail-view.tsx:430` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve psychology tab emotional state & discipline score. | Trade Detail | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-C05** | Part IV §4.3, Part VIII Phase 2 Workstream C | `src/components/views/trade-detail-view.tsx:510` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve trade-specific screenshot upload and gallery. | Trade Detail | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-C06** | Part IV §4.3, Part VIII Phase 2 Workstream C | `src/components/common/image-annotator.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve HTML5 Canvas image annotator (arrows, boxes, text). | Annotator Component | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-D01** | Part IV §4.3, Part VIII Phase 2 Workstream D | `src/components/trade/trade-replay.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve execution timeline and step-by-step playback in Replay tab. | Replay Component | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P2-E01** | Part IV §4.4, Part VIII Phase 2 Workstream E | `src/components/views/calendar-view.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve Month/Week/List views, daily P&L and R, and observation badges. | Calendar View | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |

---

### Phase 3: Analytics, Strategy Intelligence & Historical Performance (14 Requirements)

| Req ID | Roadmap Reference | Implementation Path | Current Status | Identified Defect | Required Correction | Dependencies | Tests Required | Target Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **P3-A01** | Part IV §4.5, Part VIII Phase 3 Workstream A | `src/components/views/analytics-view.tsx:68` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve 7 core analytical sub-views. | Analytics View | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P3-A02** | Part IV §4.5, Part VIII Phase 3 Workstream A | `src/components/analytics/shared-filter-bar.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve shared filter bar with date/account/setup filters. | Shared Filter Bar | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P3-A03** | Part IV §4.5, Part VIII Phase 3 Workstream A | `src/components/analytics/metric-definitions-modal.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve documented metric definitions modal with formulas. | Metric Definitions | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P3-A04** | Part IV §4.5, Part VIII Phase 3 Workstream A | `analytics-view.tsx`, `strategy-comparison.test.ts` | VERIFIED | None | Preserve sample-size warning badges (N < 20). | Analytics View | `strategy-comparison.test.ts` | VERIFIED |
| **P3-A05** | Part IV §4.5, Part VIII Phase 3 Workstream A | `src/app/api/analytics/route.ts:160` | VERIFIED | None | Preserve By Instrument metrics (win rate, PF, exp, avg R). | Analytics API | `financial-engine.test.ts` | VERIFIED |
| **P3-A06** | Part IV §4.5, Part VIII Phase 3 Workstream A | `src/lib/duration-analytics.ts` | VERIFIED | None | Preserve Time in Trade holding duration analytics and buckets. | Duration Engine | `duration-analytics.test.ts` | VERIFIED |
| **P3-B01** | Part IV §4.6, Part VIII Phase 3 Workstream B | `src/components/strategies/strategy-detail-view.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve Strategy Detail 4 sections layout. | Strategy View | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P3-B02** | Part IV §4.6, Part VIII Phase 3 Workstream B | `src/lib/strategy-management.ts` | VERIFIED | None | Preserve immutable strategy version snapshots. | Strategy Engine | `strategy-management.test.ts` | VERIFIED |
| **P3-B03** | Part IV §4.6, Part VIII Phase 3 Workstream B | `src/lib/strategy-management.ts` | VERIFIED | None | Preserve historical trade attribution to original version. | Strategy Engine | `strategy-management.test.ts` | VERIFIED |
| **P3-C01** | Part IV §4.6, Part VIII Phase 3 Workstream C | `src/app/api/strategies/[id]/compare/route.ts` | VERIFIED | None | Preserve side-by-side strategy version comparison modal. | Strategy Routes | `strategy-comparison.test.ts` | VERIFIED |
| **P3-C02** | Part IV §4.6, Part VIII Phase 3 Workstream C | `src/lib/strategy-comparison.ts` | VERIFIED | None | Preserve rule diffing and long/short direction subsets. | Strategy Engine | `strategy-comparison.test.ts` | VERIFIED |
| **P3-D01** | Part IV §4.5, Part VIII Phase 3 Workstream D | `src/lib/data-quality-engine.ts` | VERIFIED | None | Preserve Data Quality issue detection & 1-click navigate links. | Data Quality Engine | `phase3-analytics.test.ts` | VERIFIED |
| **P3-E01** | Part IV §4.5, Part VIII Phase 3 Workstream E | `src/lib/drawdown-analytics-engine.ts` | VERIFIED | None | Preserve underwater equity curve & peak-to-trough analysis. | Drawdown Engine | `phase3-analytics.test.ts` | VERIFIED |
| **P3-F01** | Part VII §7.6, Part VIII Phase 3 Workstream F | `src/components/views/playbooks-view.tsx` | VERIFIED | None | Preserve Strategy Dictionary integration with playbooks. | Dictionary Models | `phase3-analytics.test.ts` | VERIFIED |

---

### Phase 4: Accounts, Tools, Secondary Workflows & Data Management (27 Requirements)

| Req ID | Roadmap Reference | Implementation Path | Current Status | Identified Defect | Required Correction | Dependencies | Tests Required | Target Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **P4-A01** | Part IV §4.7, Part VIII Phase 4 Workstream A | `src/components/views/accounts-view.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve account overview cards & multi-account summary. | Accounts View | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-A02** | Part IV §4.7, Part VIII Phase 4 Workstream A | `src/components/views/accounts-view.tsx:120` | VERIFIED | None | Preserve settled balance vs live equity disclaimers. | Accounts View | `phase4-secondary-workflows.test.ts` | VERIFIED |
| **P4-A03** | Part IV §4.7, Part VIII Phase 4 Workstream A | `src/app/api/analytics/route.ts:98` | VERIFIED | None | Preserve multi-currency handling (suppress pooled drawdown). | Analytics API | `phase1-hardening.test.ts` | VERIFIED |
| **P4-A04** | Part IV §4.7, Part VIII Phase 4 Workstream A | `src/app/api/accounts/[id]/route.ts` | VERIFIED | None | Preserve soft archiving of accounts and historical retention. | Accounts API | `phase4-secondary-workflows.test.ts` | VERIFIED |
| **P4-B01** | Part IV §4.8, Part VIII Phase 4 Workstream B | `src/lib/prop-firm-engine.ts:310` | VERIFIED | None | Preserve real-time remaining buffer calculations and clamping. | Prop Firm Engine | `backup-safety.test.ts` | VERIFIED |
| **P4-B02** | Part IV §4.8, Part VIII Phase 4 Workstream B | `src/lib/prop-firm-engine.ts:210` | VERIFIED | None | Preserve static vs trailing drawdown modes. | Prop Firm Engine | `prop-firm-engine.test.ts` | VERIFIED |
| **P4-B03** | Part IV §4.8, Part VIII Phase 4 Workstream B | `src/lib/prop-firm-engine.ts:240` | VERIFIED | None | Preserve consistency rate and single-day profit limits. | Prop Firm Engine | `prop-firm-engine.test.ts` | VERIFIED |
| **P4-B04** | Part IV §4.8, Part VIII Phase 4 Workstream B | `src/components/accounts/prop-challenges-section.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve prop challenge progress cards UI. | Challenge Cards | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-C01** | Part IV §4.9, Part VIII Phase 4 Workstream C | `src/components/views/risk-calculator-view.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve 2-column layout with live parameters & outcomes. | Risk Calculator | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-C02** | Part IV §4.9, Part VIII Phase 4 Workstream C | `src/components/views/risk-calculator-view.tsx:142` | PARTIALLY IMPLEMENTED | **Defect F-02:** Cash Indices and Silver CFD fall into generic `else` branch (`0.01 lot`); lacks broker lot steps, min/max quantities, and quote-to-account currency conversion. | Add dedicated sizing branches for Cash Indices and Silver CFD with canonical broker unit steps; add currency conversion support; include spread/commission disclosures. | Instrument Catalog, Risk View | Unit tests in `risk-calculator.test.ts` | **VERIFIED** |
| **P4-C03** | Part IV §4.9, Part VIII Phase 4 Workstream C | `src/components/views/risk-calculator-view.tsx:153` | VERIFIED | None | Preserve risk variance & round-down transparency pill. | Risk Calculator | `financial-engine.test.ts` | VERIFIED |
| **P4-C04** | Part IV §4.9, Part VIII Phase 4 Workstream C | `src/components/views/risk-calculator-view.tsx:210` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve 1-click sizing transfer to New Trade form; ensure indices and currency transfer safely. | Risk Calculator | `phase4-secondary-workflows.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-D01** | Part IV §4.10, Part VIII Phase 4 Workstream D | `src/components/views/trading-todo-view.tsx:82` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve independent task workstation with 5 default lists. | Trading To-Do | `phase4-secondary-workflows.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-D02** | Part IV §4.10, Part VIII Phase 4 Workstream D | `src/components/views/trading-todo-view.tsx:110` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve quick task add, priority, due date, instrument/strategy links. | Trading To-Do | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-D03** | Part IV §4.10, Part VIII Phase 4 Workstream D | `src/components/views/trading-todo-view.tsx` | PARTIALLY IMPLEMENTED | **Defect F-03:** Board (Kanban) view mode is completely missing; custom list creation UI is missing. | Implement Board (Kanban) view toggle with status columns (`Pending`, `In Progress`, `Completed`, `Cancelled`) and column move actions; add custom list creation dialog. | Trading To-Do View, `/api/tasks` | Unit tests in `trading-todo.test.ts` | **VERIFIED** |
| **P4-E01** | Part VII §7.4, Part VIII Phase 4 Workstream E | `src/app/api/backups/route.ts:45` | VERIFIED | None | Preserve Schema 2.0 full archive export (12 entities). | Backup Route | `backup-safety.test.ts` | VERIFIED |
| **P4-E02** | Part VII §7.4, Part VIII Phase 4 Workstream E | `src/app/api/backups/preview/route.ts` | VERIFIED | None | Preserve Pre-restore Archive Preview route. | Backup Preview | `backup-safety.test.ts` | VERIFIED |
| **P4-E03** | Part VII §7.4, Part VIII Phase 4 Workstream E | `src/app/api/backups/preview/route.ts:90` | VERIFIED | None | Preserve 3-tier confidence duplicate detection (100%, 85%, 60%). | Backup Preview | `backup-safety.test.ts` | VERIFIED |
| **P4-E04** | Part VII §7.4, Part VIII Phase 4 Workstream E | `src/app/api/backups/route.ts:224` | PARTIALLY IMPLEMENTED | **Defect F-04:** Zero automated tests verify simulated mid-restore failure recovery or rollback behavior. | Author automated test simulating mid-restore exception to prove atomic rollback, snapshot availability, and retry safety. | Backup Safety Test | New tests in `backup-safety.test.ts` | **VERIFIED** |
| **P4-E05** | Part VII §7.4, Part VIII Phase 4 Workstream E | `src/app/api/backups/route.ts:178` | VERIFIED | None | Preserve pre-replace automatic safety snapshot creation outside transaction. | Backup Route | `backup-safety.test.ts` | VERIFIED |
| **P4-E06** | Part VII §7.5, Part VIII Phase 4 Workstream E | `src/lib/broker-csv-presets.ts`, `src/app/api/imports/[id]/route.ts` | PARTIALLY IMPLEMENTED | **Defect F-05:** Only header matching tested; `parseInt` truncates fractional commissions/swaps; timezone offsets uncompensated; decimal commas unhandled; lacks row parsing tests. | Fix commission/swap parsing to float cents; add European decimal comma normalization; add timezone compensation; author comprehensive CSV row parsing tests with broker fixtures. | Import Route, Broker Presets | New tests in `broker-csv-mappings.test.ts` | **VERIFIED** |
| **P4-E07** | Part VII §7.5, Part VIII Phase 4 Workstream E | `src/app/api/imports/[id]/route.ts:115` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve transactional CSV Import execution with `db.$transaction`. | Import Route | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-F01** | Part VII §7.4, Part VIII Phase 4 Workstream F | `src/components/views/archived-view.tsx` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve dedicated Central Archived Records view. | Archived View | `phase4-secondary-workflows.test.ts` | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-F02** | Part VII §7.4, Part VIII Phase 4 Workstream F | `src/app/api/archive/route.ts:74` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve single & batch unarchive with audit logging. | Archive Route | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |
| **P4-F03** | Part VII §7.4, Part VIII Phase 4 Workstream F | `analytics`, `dashboard`, `tradesLog` | VERIFIED | None | Preserve exclusion of archived records from active calculations. | All Active Queries | `phase4-secondary-workflows.test.ts` | VERIFIED |
| **P4-G01** | Part VII §7.7, Part VIII Phase 4 Workstream G | `src/app/api/search/route.ts`, `src/components/command-palette.tsx` | PARTIALLY IMPLEMENTED | **Defect F-06:** Global Search only covers 7 database domains; Quick Notes and Sticky Notes in `localStorage` are excluded; archived strategy versions lack `isArchived: false` filter. | Integrate client-side searching of `localStorage` Quick Notes and Sticky Notes into Command Palette; add `strategy.isArchived: false` filter to server route. | Search Route, Command Palette | New tests in `global-search.test.ts` | **VERIFIED** |
| **P4-G02** | Part VII §7.7, Part VIII Phase 4 Workstream G | `src/components/command-palette.tsx:260` | IMPLEMENTED — NOT BROWSER VERIFIED | None | Preserve Command Palette navigation, keyboard shortcuts (`Cmd+K`), and version badges. | Command Palette | Compilation & Unit tests | IMPLEMENTED — NOT BROWSER VERIFIED |

---

# 3. VERIFICATION SUMMARY & PHASE 5 GATE

- **Total Requirements Audited:** 81
- **Requirements Requiring Corrections:** 6 (`P1-K01`, `P4-C02`, `P4-D03`, `P4-E04`, `P4-E06`, `P4-G01`)
- **Prohibited Workstreams:** Phase 5 is STRICTLY DEFERRED until all Phase 1–4 corrections are implemented and verified.
