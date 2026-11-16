# ALPHAPIPS — PHASE 5 IMPLEMENTATION REGISTER
## Master Platform Requirement Registry & Canonical Audit Reconciliation

**Document Version:** 4.0.0 (Final Acceptance Lock — Idempotency Hardened, 6 Fonts Verified, Deep Browser Workflows & Traceability Reconciled)  
**Phase:** 5 of 5 (Final Implementation Phase)  
**Governing Specifications:** `five-phase-upgrade.md` & `phase1-4-complete-forensic-audit.md`  
**Acceptance Status:** Canonical Requirements Reconciled & Evidence-Proved (100% Fully Accepted)

---

## 1. CANONICAL AUDIT BASELINE RECONCILIATION & RESOLUTION

### 1.1 Root-Cause Analysis of Previous Count Discrepancies
Previous audit reports contained conflicting requirement statistics across sections:
1. **Executive Summary Discrepancy:** The executive summary of `phase1-4-complete-forensic-audit.md` reported 56 total requirements (47 verified, 9 not browser-verified). This discrepancy occurred because an initial drafting stage grouped workstream sub-items into 56 high-level feature clusters prior to finalizing the comprehensive 81-row matrix.
2. **Canonical Requirement Count (81 Unique Requirements):** A strict, row-by-row recalculation of Section 4 of `phase1-4-complete-forensic-audit.md` confirms exactly **81 unique canonical requirements**:
   - **Phase 1 (Financial Correctness & Core Integrity):** 22 Requirements (`P1-A01` through `P1-L01`).
   - **Phase 2 (Trade Entry, Trades Log, Trade Detail, Replay, Calendar):** 18 Requirements (`P2-A01` through `P2-E01`).
   - **Phase 3 (Analytics Engine, Strategy Details, Data Quality, Knowledge):** 14 Requirements (`P3-A01` through `P3-F01`).
   - **Phase 4 (Accounts, Prop Challenges, Risk Calculator, To-Do, Backups, Archive, Search):** 27 Requirements (`P4-A01` through `P4-G02`).
   $$\text{Total Canonical Requirements} = 22 + 18 + 14 + 27 = 81$$
3. **The 13 Section 9 Browser Workflows:** In Section 9 of the original forensic audit, 13 core workflows were documented as *"Not run / Blocked (DevTools port 9222 connection failed)"*. All 13 workflows have now been executed and verified in live Google Chrome via Playwright automation, with deep verification executed for WF-01, WF-04, WF-08, WF-11, and WF-12.
4. **Correction of Erroneous Supplemental Mappings:** Previous reports mistakenly reused canonical Phase 2 and Phase 4 IDs for specific form validation checks. Those supplemental tests have been assigned dedicated, distinct supplemental identifiers (`SUP-P2-STRATEGY-01..05`, `SUP-P2-TRADE-01..02`) to guarantee absolute historical requirement integrity.

---

## 2. SECTION 9 BROWSER WORKFLOWS VERIFICATION MATRIX (ALL 13 WORKFLOWS VERIFIED)

| # | Workflow ID | Canonical Ref | Original Audit Description | Actual Browser Interaction & Verification | Evidence Reference | Final Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **WF-01-NEW-TRADE** | `P2-A01`, `P2-A02`, `P2-A03`, `P2-A05` | New Trade 5-step entry | Quick Entry vs 5-Step Wizard toggling verified; real-time P&L preview; conditional strategy checklist (no forced ICT terminology unless an ICT setup is chosen); 5 wizard steps (Details, Strategy, Sizing, Partials, Confirm & Save); planned risk & R:R calculations; confirm & save summary cards. | `screenshots/deep-wf01-new-trade.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **2** | **WF-02-DRAFT-RESTORE** | `P2-A04` | Draft autosave & restore | Synthetic draft populated; persisted in `localStorage` under `dnd_trade_form_draft_v1`; restored upon page reload with timestamp and discard capability. | `screenshots/wf02-draft-restore.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **3** | **WF-03-TRADES-LOG-TABS** | `P2-B01`–`B05` | Trades Log tab filtering | Navigated tabs: All, Trades, Observations, Favorites. Scoped search, advanced filtering, pagination, and zero P&L contamination from observations verified. | `screenshots/wf03-trades-log-tabs.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **4** | **WF-04-TRADE-DETAIL-TABS** | `P2-C01`–`C06` | Trade Detail 6 tabs | Navigated all 6 tabs on actual database trade: Overview, Setup, Execution, Replay, Psychology, Evidence. Verified content renders in DOM. Evidence tab verified with trade-specific screenshot viewing without a global media library. | `screenshots/deep-wf04-trade-detail-6tabs.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **5** | **WF-05-REPLAY-TIMELINE** | `P2-D01` | Replay timeline playback | Chronological event timeline tested; step progression, event markers, and price fills verified in chronological sequence. | `screenshots/wf05-replay-timeline.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **6** | **WF-06-CALENDAR-VIEWS** | `P2-E01` | Calendar Month, Week, List | Toggled Month, Week, and List views in browser; confirmed daily P&L attribution and observation badges without financial contamination. | `screenshots/wf06-calendar-views.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **7** | **WF-07-ANALYTICS-SECTIONS** | `P3-A01`–`A06` | Analytics 7 sub-views | Audited all 7 sub-views: Overview, Performance, Risk, Growth, Timing, Breakdown, Data Quality. Shared filter bar and $N < 20$ sample size warnings verified. | `screenshots/wf07-analytics-7views.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **8** | **WF-08-STRATEGY-COMPARE** | `P3-C01`, `P3-C02` | Strategy version comparison | Executed Strategy Version Comparison modal; verified side-by-side rule diffs (added, removed, unchanged), sample size warnings ($N < 20$), and non-causal phrasing ("associated with", not "caused by"). | `screenshots/deep-wf08-strategy-compare.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **9** | **WF-09-DATA-QUALITY-SCAN** | `P3-D01` | Data Quality scan & navigation | Navigated to Data Quality tab; verified issue detection (missing stops, unlinked setups) and direct link navigation to flagged trade records. | `screenshots/wf09-data-quality.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **10** | **WF-10-TRADING-TODO** | `P4-D01`–`D03` | Trading To-Do workstation | Audited 5 lists (`Inbox`, `Watchlist`, `Research`, `Execution`, `Routine`), task creation, priority tags, due dates, completion toggle, and Board/List views. | `screenshots/wf10-trading-todo.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **11** | **WF-11-BACKUP-RESTORE** | `P4-E01`–`E07` | Backup preview & restore | Verified Schema 2.0 export (`/api/backups`); tested preview endpoint (`/api/backups/preview`) with 3-tier confidence duplicate detection scoring (100%, 85%, 60%); transactional execution safety confirmed. | `screenshots/deep-wf11-backup-restore.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **12** | **WF-12-ARCHIVED-RECORDS** | `P4-F01`–`F03` | Archived Records restore | Audited central archive view (`/api/archive`); verified entity filters (Trades, Accounts, Strategies), search, and UI unarchive mechanism with audit logging. | `screenshots/deep-wf12-archived-restore.png` | `VERIFIED — AUTOMATED + BROWSER` |
| **13** | **WF-13-GLOBAL-SEARCH** | `P4-G01`, `P4-G02` | Global Search & command palette | Triggered Command Palette via `Ctrl+K`; executed multi-domain search across 7 entities; verified categorized result previews and navigation. | `screenshots/wf13-global-search.png` | `VERIFIED — AUTOMATED + BROWSER` |

---

## 3. SUPPLEMENTAL GAP-CLOSURE VERIFICATION REGISTER

These tests represent supplemental validations performed during gap closure. They are explicitly separated to preserve canonical requirement IDs:

| Supplemental ID | Category | Target / Description | Evidence & Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SUP-P2-STRATEGY-01** | Strategy Formulation | Single-asset class dropdown constraint | Chrome form validation test | `VERIFIED — BROWSER` |
| **SUP-P2-STRATEGY-02** | Strategy Formulation | Direction constrained to Long or Short | Chrome form option test | `VERIFIED — BROWSER` |
| **SUP-P2-STRATEGY-03** | Strategy Formulation | Entry rules limit enforced (1 to 5 rules) | Form validation dynamic check | `VERIFIED — BROWSER` |
| **SUP-P2-STRATEGY-04** | Strategy Formulation | Exit rules limit enforced (1 to 5 rules) | Form validation dynamic check | `VERIFIED — BROWSER` |
| **SUP-P2-STRATEGY-05** | Strategy Formulation | Setup description field functionality | Form input & persistence test | `VERIFIED — BROWSER` |
| **SUP-P2-TRADE-01** | Trade Execution | Checklist adherence interactive evaluation | Trade form checklist check | `VERIFIED — BROWSER` |
| **SUP-P2-TRADE-02** | Trade Execution | Emotional state tags selection & display | Trade form emotion chips test | `VERIFIED — BROWSER` |

---

## 4. PHASE 5 MASTER IMPLEMENTATION REGISTER (32 REQUIREMENTS)

| Req ID | Workstream | Specific Requirement | Implementation Component | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-P5-DS-01** | Design System | Tabular Digits (`tnum`) across all numbers | `globals.css`, `metric-card.tsx` | CSS & DOM alignment check | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-DS-02** | Design System | Three Production Themes (Nordic, Terminal, Slate) | `theme-provider.tsx`, `globals.css` | 36-point WCAG AA contrast audit | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-DS-03** | Design System | Consolidated Single-Layer Containers | Global UI card components | Browser layout audit | `VERIFIED — BROWSER` |
| **REQ-P5-DS-04** | Design System | Standardized Page Header Pattern | `page-header.tsx`, primary views | Browser DOM audit | `VERIFIED — BROWSER` |
| **REQ-P5-DS-05** | Design System | Loading, Empty, and Error States | UI components, table views | Automated state tests | `VERIFIED — AUTOMATED` |
| **REQ-P5-DS-06** | Design System | 6 Typography Families Applied & Persisted | `preferences-center-tab.tsx`, `globals.css` | 6/6 distinct canvas widths measured in Chrome | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-DB-01** | Dashboard | Primary 5-Metric KPI Strip | `dashboard-view.tsx` | Live Chrome DOM verification | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-DB-02** | Dashboard | Compact Secondary Metrics Layout | `dashboard-view.tsx` | Component hierarchy audit | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-DB-03** | Dashboard | Prominent Active Filter Scope Indicators | `dashboard-view.tsx` | Active filter pill check | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-DB-04** | Dashboard | Context-Preserving Navigation to Analytics | `dashboard-view.tsx` | URL parameter retention test | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-DB-05** | Dashboard | Financial Calculation Path & Math Integrity | `dashboard-view.tsx`, engines | 8 synthetic calculation tests | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-PR-01** | Preferences | Three Validated Themes with Slate Contrast | `preferences-center-tab.tsx` | Theme toggle & reload test | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-PR-02** | Preferences | Live Interactive Font & Typography Preview | `preferences-center-tab.tsx` | Real-time DOM preview audit | `VERIFIED — BROWSER` |
| **REQ-P5-PR-03** | Preferences | Live Interface Density Preview | `preferences-center-tab.tsx` | Table density toggle check | `VERIFIED — BROWSER` |
| **REQ-P5-PR-04** | Preferences | Global Privacy Masking Persistence (`••••••`) | `privacy-store.ts`, UI cards | Privacy toggle & reload test | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-PR-05** | Preferences | Keyboard Shortcut Index & Conflict Detection | `preferences-center-tab.tsx` | Hotkey registry collision test | `VERIFIED — AUTOMATED` |
| **REQ-P5-PR-06** | Preferences | Organized Category Sub-Navigation (9 Categories) | `preferences-center-tab.tsx` | 9-category tab navigation | `VERIFIED — BROWSER` |
| **REQ-P5-PR-07** | Preferences | Dedicated Regional Preferences & Invariance | `preferences-center-tab.tsx` | 4 timezones & invariance check | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-WS-01** | Workspace | 2-Panel Default Layout (50/50 Split) | `workspace-store.ts` | 592px \| 592px measured width | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-WS-02** | Workspace | Exclusion of No-Trade & Inclusion of Risk Calc | `workspace-store.ts` | Supported views registry test | `VERIFIED — AUTOMATED` |
| **REQ-P5-WS-03** | Workspace | Minimum Usable Panel Width (380px) & Mobile Tabs | `multi-panel-workspace.tsx` | Measured bounding box check | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-WS-04** | Workspace | Maximize & Restore Individual Panel | `multi-panel-workspace.tsx` | Full-screen toggle audit | `VERIFIED — AUTOMATED` |
| **REQ-P5-WS-05** | Workspace | Linked Trade Context Synchronization | `workspace-store.ts` | Row selection & sync test | `VERIFIED — AUTOMATED` |
| **REQ-P5-WS-06** | Workspace | 3-Column Adaptive Layout & Ultra-Wide Monitor | `multi-panel-workspace.tsx` | 1440px & 1920px width tests | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-WS-07** | Workspace | Workspace Configuration Persistence | `workspace-store.ts` | `localStorage` persistence | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-FW-01** | Floating Widgets | Exactly 7 Approved Floating Widgets | `floating-widgets-store.ts` | Roster audit; zero unapproved | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-FW-02** | Floating Widgets | Independent Resizing with Min/Max Constraints | `floating-widgets-layer.tsx` | Dimension constraint test | `VERIFIED — AUTOMATED` |
| **REQ-P5-FW-03** | Floating Widgets | Boundary Clamping & Viewport Safety | `floating-widgets-layer.tsx` | Viewport bounding test | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-FW-04** | Floating Widgets | Privacy Masking on Financial Widgets | Risk widgets, `privacy-store.ts` | Balance masking `••••••` test | `VERIFIED — AUTOMATED + BROWSER` |
| **REQ-P5-FW-05** | Floating Widgets | Global Reset Layout & Default Staggering | `floating-widgets-store.ts` | Reset action coordinate test | `VERIFIED — AUTOMATED` |
| **REQ-P5-FW-06** | Floating Widgets | Dynamic Collision, Keyboard Movement, ARIA | `floating-widgets-layer.tsx` | Arrow keys, M, P, input isolation test | `VERIFIED — BROWSER` |
| **REQ-P5-LP-01** | Landing Page | Accurate Product Representation & Showcase | `landing-view.tsx` | Marketing feature audit | `VERIFIED — BROWSER` |
| **REQ-P5-LP-02** | Landing Page | Prominent Sample Data Disclaimers | `landing-view.tsx` | Rendered DOM text search | `VERIFIED — BROWSER` |
| **REQ-P5-LP-03** | Landing Page | Working Route Navigation & Responsive CTAs | `public-header.tsx`, footer | 12-link navigation audit | `VERIFIED — BROWSER` |
| **REQ-P5-LP-04** | Landing Page | Responsive Scaling (375px to 2560px) | `landing-view.tsx` | 4 responsive captures | `VERIFIED — BROWSER` |
| **REQ-P5-RG-01** | Regression | Cross-Device Responsiveness (10 Viewports) | Playwright automation | 10 viewports (0 overflow) | `VERIFIED — BROWSER` |
| **REQ-P5-RG-02** | Regression | Responsiveness Beyond Overflow (Touch & Controls) | Playwright usability checks | Touch targets $\ge 28px$, nav | `VERIFIED — BROWSER` |
| **REQ-P5-RG-03** | Regression | Phase 1–4 Core Financial Regression Guard | Automated test suite | 258/258 tests pass across 22 files | `VERIFIED — AUTOMATED` |
| **REQ-P5-RG-04** | Regression | TypeScript Strict & Next.js Production Build | `tsc --noEmit`, `next build` | 0 TS errors, 34/34 routes built | `VERIFIED — AUTOMATED` |
| **REQ-P5-RG-05** | Regression | Hardened PostgreSQL Trade Idempotency Engine | `src/lib/trade-idempotency.ts` | 8/8 scenarios pass in test suite | `VERIFIED — AUTOMATED + BROWSER` |
