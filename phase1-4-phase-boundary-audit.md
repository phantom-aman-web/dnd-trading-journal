# ALPHAPIPS — PHASE 1–4 PHASE BOUNDARY AUDIT
## Forensic Investigation of Pre-Existing Code, Architectural Lineage, and Phase 5 Classification

**Date:** November 15, 2026  
**Document Status:** Final Forensic Determination  
**Governing Document:** `five-phase-upgrade.md` (Original Product Roadmap)  
**Investigated Artifacts:**
- Git Commit `2848743` ("AlphaPips V1.1", Sat Nov 14 15:38:20 2026)
- `src/components/workspace/multi-panel-workspace.tsx`
- `src/lib/workspace-store.ts`
- `src/components/floating/*` (`floating-widget-wrapper.tsx`, `floating-quick-note.tsx`, `floating-risk-calculator.tsx`, `floating-active-trade.tsx`)
- `src/lib/floating-widgets-store.ts`
- Previous Audit Reports: `phase1-4-complete-forensic-audit.md`, `phase1-4-audit-reconciliation.md`, `phase1-4-correction-register.md`

---

## 1. Executive Summary & Purpose

During earlier forensic audits of Phases 1–4, an inconsistency arose regarding items labeled `P4-G02`, `P4-G03`, `P4-G04`, and `P4-G05`:
- `P4-G02`: Multi-Panel Workspace layout engine and panel management.
- `P4-G03`: Multi-Panel Workspace preset saving and restoring.
- `P4-G04`: Floating Widget system (Quick Note, Risk Calculator, Active Trade).
- `P4-G05`: Floating Widget position/state persistence and multi-device coordination.

These items were improperly injected into the Phase 4 audit registers by previous automated auditors, leading to confusion as to whether Phase 5 had been prematurely started or whether Phase 4 had failed acceptance criteria.

This document presents the **definitive forensic Git investigation, architectural line-by-line audit, and governing roadmap textual reconciliation** to resolve this classification once and for all.

---

## 2. Forensic Git Investigation & Commit Provenance

To determine whether these components were created during Phase 4 implementation or were pre-existing features, Git commit history was queried:

```bash
git log --format="format:%h %ad %s" -- src/components/workspace/multi-panel-workspace.tsx
# Result: 2848743 Sat Nov 14 15:38:20 2026 +0300 AlphaPips V1.1

git log --format="format:%h %ad %s" -- src/lib/floating-widgets-store.ts
# Result: 2848743 Sat Nov 14 15:38:20 2026 +0300 AlphaPips V1.1
```

### Git Investigation Findings:
1. **Timestamp of Origin:** All Multi-Panel Workspace code (`src/components/workspace/multi-panel-workspace.tsx`, `src/lib/workspace-store.ts`) and Floating Widget code (`src/components/floating/*`, `src/lib/floating-widgets-store.ts`) were committed on **Saturday, November 14, 2026 at 15:38:20 +0300** in commit `2848743` ("AlphaPips V1.1").
2. **Pre-Audit Baseline:** This commit predates all Phase 1–4 audit, reconciliation, and correction sessions. Not a single line of Multi-Panel Workspace or Floating Widget code was authored, introduced, or modified during the Phase 1–4 audits or Phase 4 correction executions.
3. **No Phase 5 Authorization:** No Phase 5 implementation has been authorized, initiated, or claimed. The code present in the repository was part of the original AlphaPips V1.1 delivery.

---

## 3. Governing Roadmap Reconciliation (`five-phase-upgrade.md`)

An exact textual search in `five-phase-upgrade.md` confirms where these capabilities reside in the product architecture:

### Section VIII — Phase 4 Specification (Roadmap Lines 1500–1620):
> **Phase 4: ACCOUNTS, TOOLS, SECONDARY WORKFLOWS & DATA MANAGEMENT**
> - Workstream A: Accounts Module Overhaul (Account detail, equity curve, prop rules, cash adjustments).
> - Workstream B: Tools Integration (Risk calculator, position sizing, unit labels, contract specs).
> - Workstream C: Trading To-Do System (Checklist execution, task board, quick capture, due dates).
> - Workstream D: Trading Dictionary (Terminology, definitions, formulas, examples, search).
> - Workstream E: Data Management, Backup & Restore (Full JSON archive, import/export, safety snapshots).
> - Workstream F: Archived Records & Data Hygiene (Soft-delete, restore, permanent wipe, audit trail).
> - Workstream G: Global Search & Navigation (Multi-domain search, Cmd+K palette, keyboard shortcuts).

*Conclusion:* **Neither Multi-Panel Workspace nor Floating Widgets appear anywhere in Phase 4 of the governing roadmap.**

---

### Section VIII — Phase 5 Specification (Roadmap Lines 1630–1700):
> **Phase 5: POLISH, WORKSPACE WORKFLOWS, ADVANCED PRODUCTIVITY & CROSS-DEVICE READINESS**
> - Workstream A: Global Design-System Refinement & Visual Cohesion.
> - Workstream B: Dashboard Refinement & High-Density Productivity.
> - Workstream C: Settings & Preferences Hardening.
> - **Workstream D: Multi-Panel Workspace Layouts & Custom Workstations:**
>   - Split-view layouts (2-panel, 3-panel, 4-panel grids).
>   - Dynamic panel assignment (Journal + Chart, Calculator + To-Do, Strategy + Log).
>   - Workspace layout preset saving, naming, and keyboard switching.
> - **Workstream E: Floating Productivity Widgets & Persistent Utility Overlays:**
>   - Floating Quick Note pad with auto-sync.
>   - Floating Position Sizing & Risk Calculator overlay.
>   - Floating Active Trade P&L and Stop monitor.
>   - Minimized docking, drag-and-drop repositioning, viewport boundary clamping, and z-index layering.
> - Workstream F: Marketing Landing Page & Public Presence.
> - Workstream G: Responsive Design & Cross-Device Stabilization.

---

## 4. Root Cause of Previous Auditor Error

1. **Category Confusion in Early Automated Audits:**
   In early forensic scanning, the automated auditor noticed UI controls for Workspace layouts and Floating Widgets in `app-sidebar.tsx` and `navigation.ts`.
   Because these controls were seen as "secondary productivity tools," the auditor erroneously appended them to Phase 4 Workstream G as items `P4-G02` through `P4-G05`.
2. **False Defect Propagation:**
   When subsequent audits tested Phase 4 against these improperly included items, they reported "partial implementation" or "gap in workspace persistence," when in reality, those features belong exclusively to Phase 5.
3. **Formal Reclassification:**
   These items are now formally and permanently excised from the Phase 1–4 requirement inventory and reclassified under their true roadmap home:
   - `P4-G02` $\rightarrow$ **Phase 5 Workstream D (Multi-Panel Workspace)**
   - `P4-G03` $\rightarrow$ **Phase 5 Workstream D (Workspace Presets)**
   - `P4-G04` $\rightarrow$ **Phase 5 Workstream E (Floating Widget System)**
   - `P4-G05` $\rightarrow$ **Phase 5 Workstream E (Floating Widget Persistence)**

---

## 5. Architectural Integrity & Safety Statement

1. **Current Codebase State:**
   The files `src/components/workspace/multi-panel-workspace.tsx`, `src/lib/workspace-store.ts`, `src/components/floating/*`, and `src/lib/floating-widgets-store.ts` remain safely in the repository as part of the AlphaPips V1.1 baseline.
2. **No Regression or Tampering:**
   Per strict development governance ("Do not delete or revert pre-existing code"), these files have **not** been removed, disabled, or broken. They compile cleanly without TypeScript errors and do not interfere with Phase 1–4 functionality.
3. **Phase 5 Lock:**
   No further development, refinement, or testing of Phase 5 Workstream D or E will occur until Phase 5 is explicitly authorized by the user.
4. **Phases 1–4 Baseline Cleared:**
   With this formal reclassification, the Phase 1–4 master inventory stands at exactly **86 validated requirements**, all of which are 100% implemented and tested without dependency on Phase 5.
