# DnD — UI/UX Design & Architecture Specification

## 1. Visual Identity & Design System
DnD preserves its professional financial software identity with a clean, high-density, institutional aesthetic:

- **Typography:** `GeistSans` for modern, crisp UI readability; `GeistMono` for tabular numbers, currency displays, prices, and timestamps.
- **Three Core Themes:**
  1. **Nordic Clean (Default):** Soft light neutral background (`#F4F5F7`), crisp borders (`#E2E8F0`), high-contrast dark text (`#0F172A`).
  2. **Sleek Terminal:** High-contrast dark theme (`#090D16`), deep navy cards (`#0F172A`), muted cyan accents.
  3. **Institutional Blue:** Dark cyan/slate background (`#0A111C`), steel card surfaces (`#111C2E`), cold institutional blues.
- **Visual Invariants:**
  - Standard border radius: `rounded-lg` (8px) for containers/cards, `rounded-md` (6px) for inputs/buttons.
  - Directional badges: Forest green for Long (`bg-emerald-500/10 text-emerald-500 border-emerald-500/20`), Crimson red for Short (`bg-rose-500/10 text-rose-500 border-rose-500/20`).
  - No decorative fluff or generic cards. Every surface must serve an explicit informational purpose.

---

## 2. Page-Specific Information Architecture

| Screen | Primary Purpose | Primary Action | Secondary Information |
| :--- | :--- | :--- | :--- |
| **Dashboard** | High-level performance diagnosis & health check | Date & account range filtering, drill-down to trades | Equity curve, strategy/instrument rankings, recent activity |
| **Trades Log** | Central trade ledger, auditing, filtering, quick editing | Filter by setup/instrument, search historical trades | Status badges, P&L, realized R, execution adherence |
| **New Trade** | Focused 5-step recording & fast execution logging | Quick Entry or Advanced 5-stage workflow | Setup checklist grade preview, position size calculator |
| **Trade Detail** | Chronological post-trade audit & evidence inspection | Edit, Duplicate, Close, View executions | Vector-annotated screenshots, execution ledger, review reflections |
| **Calendar** | Performance timeline & trading rhythm evaluation | Inspect specific trading day | Daily P&L, daily R, best/worst trade of the day |
| **Analytics** | Deep statistical investigation into edge and leaks | Dimension breakdown (instrument, session, strategy) | Expectancy, R distribution, behavioral impact correlation |
| **Setups** | Strategy playbook and checklist criteria management | Create/edit checklist rules and weights | Win rate by setup grade, historical versions |
| **Accounts** | Capital allocation, risk limits, cash flows | Set daily loss limits, record deposits/withdrawals | Balance, drawdown from peak, win rate |
| **Settings** | Global user preferences | Change theme, timezone, risk defaults | Storage credentials, account deletion, data clearance |

---

## 3. Interaction & Form Principles
- **Contextual Inputs:** Quantity steps, pip/tick labels, and price decimal precision automatically adjust to the selected instrument (e.g. 5 decimals for EURUSD, 2 for XAUUSD, 0 for NQ/ES).
- **Fast Keyboard Navigation:** Tab progression through essential form fields; Enter to trigger primary actions; Esc to close modals.
- **Autosave with Visual Feedback:** Non-blocking background save with clear status indicator (`Saved 2m ago`, `Saving...`).
- **Responsive Adaptability:** Tables transition to compact trade cards on mobile screens (< 768px) rather than truncating critical numbers.

