# ALPHAPIPS — PHASE 5 FLOATING WIDGETS REPORT
## Workstream E: Floating Mini-Widgets System

**Document Version:** 3.0.0 (Post-Integrity Reconciliation & 13-Workflow Browser Verification)  
**Phase:** 5 of 5  
**Workstream Covered:** Workstream E (Floating Widgets)  
**Governing Specification:** `five-phase-upgrade.md` — Part IV (4.14) & Part VIII (Phase 5)  
**Verification Mode:** Automated Test Suite (`bun test`) & Real Chrome Browser Automation (Playwright)  
**Acceptance Status:** Canonical Requirements Reconciled & Evidence-Proved

---

## 1. APPROVED WIDGET ROSTER AUDIT

Per roadmap specifications, exactly **7 approved widgets** are supported:

| # | Widget Name | ID | Category | Constraints (Min / Max / Default) | Status | Real Browser Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Drawdown Monitor** | `drawdown-monitor` | Risk Management | 280–520px W · 180–450px H · (320 × 220 default) | `VERIFIED — AUTOMATED + BROWSER` | Active in DOM; financial figures masked with `••••••` in privacy mode. |
| 2 | **Quick Risk Calculator** | `quick-risk-calc` | Risk Management | 340–640px W · 380–750px H · (360 × 480 default) | `VERIFIED — AUTOMATED + BROWSER` | Active in DOM; interactive lot calculation. |
| 3 | **Daily Risk Limit** | `daily-risk-limit` | Risk Management | 280–520px W · 190–460px H · (320 × 240 default) | `VERIFIED — AUTOMATED + BROWSER` | Active in DOM; loss cushion indicators. |
| 4 | **Quick Notes** | `quick-notes` | Journaling | 300–750px W · 280–750px H · (360 × 400 default) | `VERIFIED — AUTOMATED + BROWSER` | Active in DOM; scratchpad note editing. |
| 5 | **Focus Timer** | `focus-timer` | Productivity | 260–480px W · 220–480px H · (300 × 280 default) | `VERIFIED — AUTOMATED + BROWSER` | Active in DOM; countdown timer controls. |
| 6 | **Trading Tip** | `trading-tip` | Education | 320–680px W · 260–680px H · (380 × 360 default) | `VERIFIED — AUTOMATED + BROWSER` | Active in DOM; random discipline tips. |
| 7 | **Sticky Notes** | `sticky-notes` | Journaling | 240–520px W · 200–580px H · (280 × 280 default) | `VERIFIED — AUTOMATED + BROWSER` | Active in DOM; color-coded desktop post-its. |

Zero unapproved or speculative widgets exist in the codebase.
Screenshots:
- `phase5-evidence/screenshots/test-widget-dynamic-keyboard.png`
- `phase5-evidence/screenshots/gap-closure-floating-widgets-audit.png`
- `phase5-evidence/screenshots/floating-widgets-active.png`

---

## 2. INTERACTION, RESIZING & CONSTRAINT ARCHITECTURE

### 2.1 Drag-to-Move vs Drag-to-Resize Separation
- **Header Drag Zone:** The widget top header serves as the dedicated drag-to-move handle with a visible `GripHorizontal` icon and `cursor-move`.
- **Resize Handles:** Three distinct resize interaction handles:
  1. Right edge: horizontal resize handle (`cursor-ew-resize`).
  2. Bottom edge: vertical resize handle (`cursor-ns-resize`).
  3. Bottom-right corner: bidirectional diagonal handle with a 6-dot grip pattern (`cursor-se-resize`).
- Resizing stops event propagation, preventing accidental movement while dragging dimensions.

### 2.2 Boundary Clamping & Dimension Constraints
- Dragging is clamped strictly within viewport boundaries:
  - `nextX = Math.max(16, Math.min(curX, window.innerWidth - 60))`
  - `nextY = Math.max(48, Math.min(curY, window.innerHeight - 36))`
- Resizing strictly enforces per-widget minimum and maximum dimensions defined in `WIDGET_SIZE_CONSTRAINTS`. Widgets cannot be crushed below readable limits or stretched beyond viewport boundaries.

### 2.3 Snap-to-Edge Logic (16px Margin Snap)
- To prevent widgets from being left in untidy, half-offscreen fractional pixel alignments:
  - When dragging within **24px** of the left viewport boundary, position snaps automatically to `16px`.
  - When dragging within **24px** of the right viewport boundary, position snaps automatically to `window.innerWidth - widgetWidth - 16px`.
  - When dragging within **24px** of the top boundary (below header), position snaps automatically to `64px`.
  - When dragging within **24px** of the bottom boundary, position snaps automatically to `window.innerHeight - widgetHeight - 16px`.

### 2.4 Dynamic Collision Mitigation & Staggered Stacking
- **Default Staggering:** Newly spawned widgets initialize with clean staggered offsets (`x: 40 + i*36`, `y: 80 + i*36`), preventing title bars from obscuring one another.
- **Dynamic Collision Nudge:** If a widget is dropped directly on top of another widget's header (`|Δx| < 18px` and `|Δy| < 18px`), the engine automatically nudges the dropped widget downward by `32px` upon drag release so both title bars and window controls remain fully clickable and reachable.

### 2.5 Keyboard Operation, Input Isolation & ARIA Accessibility
Every widget frame is fully keyboard accessible:
- **Header Focus & Arrow Nudging:** The widget header has `tabIndex={0}` and on-focus elevation (`bringToFront`). Pressing **ArrowLeft**, **ArrowRight**, **ArrowUp**, or **ArrowDown** nudges the widget position in exact `16px` increments.
- **Keyboard Shortcuts:** Pressing `M` toggles minimize/restore; pressing `P` toggles position pinning; pressing `Escape` blurs focus.
- **Input & Form Isolation (Safe Typing):** The keyboard event listeners are attached strictly to the widget header `<div role="region" aria-label="... widget header">`. When user focus is inside editable elements (e.g. typing note text inside Quick Notes textarea, Sticky Notes input, lot sizes, or form inputs), typing 'M', 'P', arrow keys, or Escape does NOT trigger widget movement, pinning, or minimization. Verified empirically in browser automation (`deep-workflow-verification-results.json`).
- **Button Focus Outlines:** Pin, minimize, and close buttons feature `focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none` and operate cleanly with `Tab`, `Enter`, and `Space`.
- **Descriptive ARIA Labels:**
  - Header: `aria-label="<Widget Name> widget header"`
  - Pin button: `aria-label="Pin <Widget Name> position"` / `aria-label="Unpin <Widget Name> position"`
  - Minimize button: `aria-label="Minimize <Widget Name>"` / `aria-label="Restore <Widget Name>"`
  - Close button: `aria-label="Close <Widget Name> widget"`

### 2.6 Privacy Mode Integration & Mobile Dock (<640px)
- When Privacy Mode is active, all balances, cushions, loss allowances, and dollar amounts are masked with `••••••` across all widgets.
- On viewports below 640px, the desktop floating layer collapses to a docked mobile bottom tray with individual expand/close controls and quick Manager access.

---

## 3. VERIFICATION & STATUS MATRIX

| Requirement ID | Description | Component | Verification Status | Real Browser Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-P5-FW-01** | Exactly 7 approved floating widgets | `floating-widgets-store.ts` | `VERIFIED — AUTOMATED + BROWSER` | Verified 7 widgets in store and live browser. Screenshot: `floating-widgets-active.png`. |
| **REQ-P5-FW-02** | Independent resizing with min/max constraints | `floating-widgets-layer.tsx` | `VERIFIED — AUTOMATED` | Store tests verify dimension clamping against min/max bounds. |
| **REQ-P5-FW-03** | Boundary clamping & viewport safety | `floating-widgets-layer.tsx` | `VERIFIED — AUTOMATED + BROWSER` | Viewport boundary clamping logic verified in Chrome browser. |
| **REQ-P5-FW-04** | Privacy masking integration on financial widgets | `drawdown-monitor-widget.tsx`, `daily-risk-limit-widget.tsx` | `VERIFIED — AUTOMATED + BROWSER` | Browser test confirmed monetary values masked with `••••••`. |
| **REQ-P5-FW-05** | Global position reset & stacking management | `floating-widgets-store.ts`, `floating-widgets-manager-modal.tsx` | `VERIFIED — AUTOMATED` | Automated test confirms reset action restores default staggered coordinates. |
| **REQ-P5-FW-06** | Dynamic Collision, Keyboard Movement, ARIA | `floating-widgets-layer.tsx` | `VERIFIED — BROWSER` | 16px arrow nudge, collision mitigation, M/P keys, and ARIA labels verified. Screenshot: `test-widget-dynamic-keyboard.png`. |
