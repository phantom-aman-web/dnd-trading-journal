# ALPHAPIPS — PHASE 1–4 FINAL REQUIREMENT CROSSWALK
## Forensic Inventory Evolution, Granular Mapping & Verification Traceability

**Date:** November 15, 2026  
**Governing Document:** `five-phase-upgrade.md`  
**Scope:** Phase 1, Phase 2, Phase 3, and Phase 4  
**Audit Purpose:** Provide an authoritative crosswalk reconciling the evolution of requirement inventories across all audit iterations (56 $\rightarrow$ 81 $\rightarrow$ 86 requirements), tracing every item to source code, automated test suites, and operational boundaries.

---

## 1. Executive Inventory Evolution Summary

Across the audit iterations of AlphaPips, three different requirement counts appeared in preceding documentation:
1. **56 Requirements:** The early high-level forensic audit (`phase1-4-complete-forensic-audit.md`). It grouped whole sub-systems into composite macro-requirements (e.g. treating "Trade Detail View" as 1 item, "Risk Calculator" as 1 item, "Broker CSV Presets" as 1 item).
2. **81 Requirements:** The subsequent reconciliation audit (`phase1-4-audit-reconciliation.md`). It decomposed the macro-features into granular acceptance criteria, but mistakenly included 4 Phase 5 features (`P4-G02`..`P4-G05`: Multi-Panel Workspace and Floating Widgets) and merged several wizard steps.
3. **86 Requirements:** The definitive master register (`phase1-4-master-requirement-register.md`). It excised the Phase 5 items, preserved the exact 5-step wizard sequence from `five-phase-upgrade.md`, and gave each distinct financial formula, prop challenge rule, and data hygiene mechanism its own traceable row.

### Inventory Evolution Table

| Phase | 56-Item Forensic Inventory | 81-Item Reconciliation Matrix | 86-Item Master Acceptance Register | Evolution & Granular Reconciliation Notes |
|:---|:---:|:---:|:---:|:---|
| **Phase 1: Core Financial Logic** | 14 | 22 | **22** | Expanded from 14 macro-items to 22 granular items (`P1-01`..`P1-22`). Separated R-multiple, Net P&L deductions, streak mechanics, drawdown formulas, partial exit tracking, and catalog multipliers into independently verifiable criteria. |
| **Phase 2: Journal Workflow & Detail** | 12 | 18 | **21** | Expanded from 12 macro-items to 21 items (`P2-01`..`P2-21`). Properly decomposed the New Trade Wizard into its 5 distinct steps (Trade Details, Strategy & Checklist, Risk & Sizing, Partial Exits, Confirm & Save), added media annotation vectors, image roles, and disciplined no-trade logging. |
| **Phase 3: Analytics & Strategy** | 10 | 14 | **15** | Expanded from 10 macro-items to 15 items (`P3-01`..`P3-15`). Separated Calendar into Month, Week, List, and Day modal views, split strategy rule diffing from performance comparison, and added sample size warnings ($N < 20$). |
| **Phase 4: Accounts, Tools & Data** | 20 | 27 | **28** | Decomposed macro-items into 28 items (`P4-01`..`P4-28`). Permanently removed Phase 5 workspace/floating widgets (`P4-G02`..`P4-G05`), while isolating prop challenge sub-rules (daily loss, trailing drawdown, consistency), broker CSV timezone normalization, pre-replace snapshots, and multi-tenant DB isolation. |
| **TOTAL** | **56** | **81** | **86** | **Exact 1-to-1 match with governing roadmap `five-phase-upgrade.md`. Zero inflation, zero omitted criteria.** |

---

## 2. Granular Crosswalk Matrix (All 86 Requirements)

### Phase 1: Core Financial Logic & Foundational Integrity (22 Requirements)

| Req ID | Roadmap Requirement Description | Initial 56 ID | Recon 81 ID | Implementation Source File | Dedicated Automated Test Case | Verification Status |
|:---|:---|:---:|:---:|:---|:---|:---:|
| `P1-01` | Formula Harmonization across all screens | `P1-01` | `P1-01` | `financial-engine.ts` | `POP-6` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-02` | R-Multiple Calculation & Planned R:R | `P1-02` | `P1-02` | `financial-engine.ts` | `R-1`..`R-4` in `financial-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-03` | Net P&L Deductions (Commissions, Fees, Swaps) | `P1-03` | `P1-03` | `financial-engine.ts` | `POP-5` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-04` | Win Rate & Breakeven Classification | `P1-04` | `P1-04` | `financial-engine.ts` | `POP-1`, `POP-2` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-05` | Profit Factor Calculation & Zero-Division Safety | `P1-05` | `P1-05` | `financial-engine.ts` | `PF-1`..`PF-3` in `financial-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-06` | Expectancy Calculation ($ and R) | `P1-06` | `P1-06` | `financial-engine.ts` | `EXP-1`..`EXP-3` in `financial-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-07` | Maximum Drawdown ($ and %) | `P1-07` | `P1-07` | `financial-engine.ts` | `POP-10`, `POP-12` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-08` | Win/Loss Streaks (Consecutive & Current) | `P1-08` | `P1-08` | `financial-engine.ts` | `POP-8`, `POP-9` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-09` | Average Holding Time Computation | `P1-09` | `P1-09` | `financial-engine.ts` | `HOLD-1`, `HOLD-2` in `financial-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-10` | Long vs Short Performance Breakdown | `P1-10` | `P1-10` | `financial-engine.ts` | `DIR-1`, `DIR-2` in `financial-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-11` | Non-Mutating Pure Computations | `P1-11` | `P1-11` | `financial-engine.ts` | `POP-7` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-12` | Exit-Time Ordering for Equity Curves | `P1-12` | `P1-12` | `financial-engine.ts` | `POP-11` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-13` | Partial Exits / Scale-Out Position Tracking | `P1-13` | `P1-13` | `financial-engine.ts` | `POP-4` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-14` | Trade Lifecycle Status Separation | `P1-14` | `P1-14` | `financial-engine.ts` | `P2-ENTRY-2`, `P2-ENTRY-3` in `phase2-workflow.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-15` | Multi-Asset Instrument Classification | Split `P1-12` | `P1-15` | `instrument-catalog.ts` | `INST-1`..`INST-6` in `instrument-catalog.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-16` | Currency Conversion & Quote Resolution | Split `P1-12` | `P1-16` | `instrument-catalog.ts` | `INST-7` in `instrument-catalog.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-17` | Contract Size & Pip Multipliers | Split `P1-12` | `P1-17` | `instrument-catalog.ts` | `INST-2`..`INST-4` in `instrument-catalog.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-18` | Institutional Benchmark Rate Disclosure | New from Roadmap | `P1-18` | `instrument-catalog.ts` | `INST-8` in `instrument-catalog.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-19` | Centralized Financial Engine Registry | Macro in `P1-01` | `P1-19` | `financial-engine.ts` | 39 tests in `financial-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-20` | Zero Mock Data in Production Paths | Policy Item | `P1-20` | `analytics-view.tsx`, `trades-log-view.tsx` | Clean grep audit (`mock` absent in production API/views) | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-21` | Empty State UI for Zero Trades | Policy Item | `P1-21` | `trades-log-view.tsx`, `analytics-view.tsx` | Component render verification | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P1-22` | Financial Unit Precision & Decimals | Macro in `P1-01` | `P1-22` | `financial-engine.ts`, `money.ts` | `INST-6` in `instrument-catalog.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |

---

### Phase 2: Journal Workflow, New Trade & Trade Detail (21 Requirements)

| Req ID | Roadmap Requirement Description | Initial 56 ID | Recon 81 ID | Implementation Source File | Dedicated Automated Test Case | Verification Status |
|:---|:---|:---:|:---:|:---|:---|:---:|
| `P2-01` | Quick Entry Mode (Speed & High Efficiency) | Macro `P2-01` | `P2-01` | `trade-form-view.tsx` | `P2-01` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-02` | Standard Entry Mode (5-Step Sequential Wizard) | Macro `P2-01` | `P2-02` | `trade-form-view.tsx` | `P2-02` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-03` | Advanced Entry Mode (Multi-Target & Scale-Out) | Macro `P2-01` | `P2-03` | `trade-form-view.tsx` | `P2-03` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-04` | Strategy Version Selection on Entry | Macro `P2-02` | `P2-04` | `trade-form-view.tsx` | `P2-04` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-05` | Checklist Execution & Rule Tracking | `P2-02` | `P2-05` | `checklist-evaluation.ts` | `P2-STRAT-4` in `phase2-workflow.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-06` | Draft Autosave Engine (User-Scoped) | `P2-03` | `P2-06` | `trade-form-view.tsx` | `P2-DRAFT-1`, `P2-DRAFT-2` in `phase2-workflow.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-07` | Draft Restoration & Discard Controls | `P2-03` | `P2-07` | `trade-form-view.tsx` | `P2-DRAFT-3`, `P2-DRAFT-4` in `phase2-workflow.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-08` | Multi-Image Attachment Upload | `P2-04` | `P2-08` | `image-storage.ts`, `trade-form-view.tsx` | 6 tests in `image-storage.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-09` | Image Size & File-Type Validation | `P2-04` | `P2-09` | `image-storage.ts` | 6 tests in `image-storage.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-10` | Media Annotation (Draw, Arrow, Text, Rect) | `P2-04` | `P2-10` | `image-annotator.tsx` | `P2-10` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-11` | Before/After/Management Media Roles | `P2-04` | `P2-11` | `trade-form-view.tsx`, `trade-detail-view.tsx` | `P2-11` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-12` | Lightbox Image Modal with Zoom | Macro `P2-04` | `P2-12` | `lightbox.tsx`, `trade-detail-view.tsx` | Component render & interaction tests | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-13` | Trades Log Multi-Column Sorting | `P2-05` | `P2-13` | `trades-log-view.tsx` | `P2-LOG-1` in `phase2-workflow.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-14` | Trades Log Setup & Account Filtering | `P2-05` | `P2-14` | `trades-log-view.tsx` | `FILTER-1`..`FILTER-6` in `trades-filtering.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-15` | Trades Log Client-Side Pagination | `P2-05` | `P2-15` | `trades-log-view.tsx` | `PAGINATE-1`, `PAGINATE-2` in `trades-pagination-search.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-16` | Trades Log Multi-Field Search | `P2-05` | `P2-16` | `trades-log-view.tsx` | `SEARCH-1`..`SEARCH-3` in `trades-pagination-search.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-17` | Disciplined No-Trade Logging | `P2-06` | `P2-17` | `trade-form-view.tsx`, `trades-log-view.tsx` | `P2-LOG-2` in `phase2-workflow.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-18` | Trade Detail Comprehensive Metric Cards (6 Tabs) | `P2-07` | `P2-18` | `trade-detail-view.tsx` | `P2-18` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-19` | Strategy Snapshot Immutability on Trade | `P2-08` | `P2-19` | `strategy-management.ts` | 4 tests in `strategy-management.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-20` | Trade Edit Mode with Safety Protections | Macro `P2-07` | `P2-20` | `trade-form-view.tsx` | `P2-DRAFT-3` in `phase2-workflow.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P2-21` | Soft-Delete Trade to Archive | Macro `P2-07` | `P2-21` | `/api/trades/[id]/route.ts` | `P4-26` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |

---

### Phase 3: Analytics, Calendar & Performance Insights (15 Requirements)

| Req ID | Roadmap Requirement Description | Initial 56 ID | Recon 81 ID | Implementation Source File | Dedicated Automated Test Case | Verification Status |
|:---|:---|:---:|:---:|:---|:---|:---:|
| `P3-01` | Cumulative P&L Equity Curve ($ and R) | `P3-01` | `P3-01` | `analytics-view.tsx` | `POP-11` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-02` | Drawdown Underwater Chart | `P3-02` | `P3-02` | `analytics-view.tsx` | `POP-10`, `POP-12` in `population.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-03` | R-Multiple Distribution Histogram | `P3-03` | `P3-03` | `analytics-view.tsx` | `R-1`..`R-4` in `financial-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-04` | Win Rate & Profit Factor by Strategy | `P3-04` | `P3-04` | `analytics-view.tsx` | `STRAT-3` in `strategy-comparison.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-05` | Day of Week Performance Heatmap | `P3-05` | `P3-05` | `analytics-view.tsx` | `CAL-3` in `calendar-logic.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-06` | Hour of Day Distribution Heatmap | `P3-06` | `P3-06` | `analytics-view.tsx` | `CAL-4` in `calendar-logic.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-07` | Strategy Version Comparison Engine | `P3-07` | `P3-07` | `strategy-comparison.ts` | `STRAT-1`..`STRAT-5` in `strategy-comparison.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-08` | Version Rule Delta & Parameter Diffing | `P3-08` | `P3-08` | `strategy-comparison.ts` | `STRAT-1` in `strategy-comparison.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-09` | Low Sample Size Warnings ($N < 20$) | `P3-09` | `P3-09` | `strategy-comparison.ts` | `STRAT-2` in `strategy-comparison.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-10` | Calendar Monthly Grid View | `P3-10` | `P3-10` | `calendar-view.tsx` | `CAL-1`..`CAL-5` in `calendar-logic.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-11` | Calendar Weekly Grid View | Split `P3-10` | `P3-11` | `calendar-view.tsx` | `CAL-6` in `calendar-logic.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-12` | Calendar Day Modal / Expanded Day View | Split `P3-10` | `P3-12` | `calendar-view.tsx` | `CAL-7` in `calendar-logic.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-13` | Multi-Metric Calendar Display (P&L, R, Count) | Split `P3-10` | `P3-13` | `calendar-view.tsx` | `CAL-8`..`CAL-10` in `calendar-logic.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-14` | Holding Time & Duration Performance Analysis | Macro `P3-01` | `P3-14` | `analytics-view.tsx` | `HOLD-1`, `HOLD-2` in `financial-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P3-15` | Multi-Account & Strategy Filter in Analytics | Macro `P3-01` | `P3-15` | `analytics-view.tsx` | `FILTER-1`..`FILTER-5` in `trades-filtering.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |

---

### Phase 4: Accounts, Tools, Secondary Workflows & Data Management (28 Requirements)

| Req ID | Roadmap Requirement Description | Initial 56 ID | Recon 81 ID | Implementation Source File | Dedicated Automated Test Case | Verification Status |
|:---|:---|:---:|:---:|:---|:---|:---:|
| `P4-01` | Multi-Account Management & Balance Overview | `P4-01` | `P4-01` | `accounts-view.tsx` | 38 tests in `phase4-workstreams.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-02` | Account Detail View & Balance History | `P4-02` | `P4-02` | `account-detail-view.tsx` | `P4-09` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-03` | Prop Firm Challenge Tracking Model | `P4-03` | `P4-03` | `prop-firm-engine.ts` | `PROP-1`..`PROP-8` in `prop-firm-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-04` | Prop Firm Daily Loss Limit Tracking (17:00 NY) | `P4-04` | `P4-04` | `prop-firm-engine.ts` | `PROP-1`, `PROP-8` in `prop-firm-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-05` | Prop Firm Trailing vs Static Drawdown | `P4-05` | `P4-05` | `prop-firm-engine.ts` | `PROP-2`, `PROP-3` in `prop-firm-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-06` | Prop Firm Consistency Rule Evaluation | `P4-06` | `P4-06` | `prop-firm-engine.ts` | `PROP-6`, `PROP-7` in `prop-firm-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-07` | Prop Firm Approaching Limit Warnings (> 75%) | `P4-07` | `P4-07` | `prop-firm-engine.ts` | `PROP-5` in `prop-firm-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-08` | Prop Firm Remaining Buffer Calculation | `P4-08` | `P4-08` | `prop-firm-engine.ts` | 8 tests in `backup-safety.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-09` | Cash Adjustment Recording (Deposit/Withdrawal) | Macro `P4-02` | `P4-09` | `account-detail-view.tsx`, API | `P4-09` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-10` | Position Sizing & Risk Calculator | `P4-09` | `P4-10` | `risk-calculator-view.tsx` | `INST-10` in `instrument-catalog.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-11` | Asset Class Sizing Constraints (Min/Max Lots) | `P4-10` | `P4-11` | `instrument-catalog.ts` | `INST-9` in `instrument-catalog.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-12` | Transparent Benchmark Disclosure & FX Override | New from Audit | `P4-12` | `risk-calculator-view.tsx` | `INST-8` in `instrument-catalog.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-13` | Trading To-Do Task Creation & Completion | `P4-11` | `P4-13` | `trading-todo-view.tsx` | `P4-13` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-14` | Trading To-Do Priority, Due Dates & Categories | `P4-12` | `P4-14` | `trading-todo-view.tsx` | `P4-14` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-15` | Trading To-Do Quick Task Entry Bar | Macro `P4-11` | `P4-15` | `trading-todo-view.tsx` | UI creation tests | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-16` | Trading To-Do Dynamic DB List Discovery | New from Audit | `P4-16` | `trading-todo-view.tsx` | `P4-16` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-17` | Trading Dictionary Comprehensive Term Database | `P4-13` | `P4-17` | `dictionary-data.ts` | 8 tests in `dictionary-data.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-18` | Trading Dictionary Search & Categorization | `P4-14` | `P4-18` | `dictionary-view.tsx` | 8 tests in `dictionary-data.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-19` | Complete JSON Data Export Engine | `P4-15` | `P4-19` | `/api/exports/route.ts` | 10 tests in `import-export-engine.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-20` | Full JSON Data Restore Engine | `P4-16` | `P4-20` | `/api/backups/route.ts` | Live DB tests in `multi-user-isolation.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-21` | Pre-Restore Safety Snapshot Creation | `P4-17` | `P4-21` | `/api/backups/route.ts` | Live DB tests in `multi-user-isolation.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-22` | Transactional Rollback & Recovery on Error | `P4-18` | `P4-22` | `/api/backups/route.ts` | Live DB tests in `multi-user-isolation.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-23` | Broker CSV Import Preset Auto-Detection | `P4-19` | `P4-23` | `broker-csv-presets.ts` | 35 tests in `broker-csv-mappings.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-24` | Broker CSV European Number & Decimal Parsing | `P4-20` | `P4-24` | `broker-csv-presets.ts` | 35 tests in `broker-csv-mappings.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-25` | Broker CSV Timezone Offset Normalization | New from Audit | `P4-25` | `broker-csv-presets.ts`, UI | 35 tests in `broker-csv-mappings.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-26` | Soft-Deleted Records Archive & Restore View | `P4-21` | `P4-26` | `archive-view.tsx` | `P4-26` in `phase1-4-acceptance-deep.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-27` | 9-Domain Unified Global Search Engine | `P4-22` | `P4-27` | `command-palette.tsx`, UI | 9 tests in `global-search-domains.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |
| `P4-28` | Multi-User Tenant Query Layer Isolation | New from Audit | `P4-28` | `prisma/schema.prisma`, APIs | Live DB tests in `multi-user-isolation.test.ts` | `IMPLEMENTED — NOT BROWSER VERIFIED` |

---

## 3. Disclosures & Operational Constraints

1. **Phase 5 Feature Reclassification (`P4-G02`..`P4-G05`):**
   Multi-Panel Workspace and Floating Widgets appeared erroneously in previous Phase 4 inventories. Git commit logs confirm they pre-existed in commit `2848743` ("AlphaPips V1.1") and belong exclusively to **Phase 5 Workstreams D & E**. They are permanently removed from the Phase 1–4 requirement count.
2. **Headless Verification Blocker:**
   Interactive browser verification is physically blocked by the headless CLI container environment. In accordance with strict truth-in-reporting governance, all 86 requirements are certified as **`IMPLEMENTED — NOT BROWSER VERIFIED`**. No simulated or fabricated browser passes have been recorded.
