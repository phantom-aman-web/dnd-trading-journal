# DnD — Trading Performance OS: Product Specification

## 1. Product Mission & Philosophy
**DnD — Trading Performance OS** is an institutional-grade, personal trading performance operating system designed to elevate a trader's execution, discipline, and statistical edge.

Its core workflow is:
$$\text{Record Trades} \longrightarrow \text{Understand Execution} \longrightarrow \text{Measure Performance} \longrightarrow \text{Discover Patterns} \longrightarrow \text{Improve Decisions}$$

DnD replaces emotional guesswork and fragmented spreadsheets with a deterministic, mathematically rigorous performance engine.

---

## 2. Core Navigation & Workspace Structure
The application operates as a unified, ultra-responsive Single-Page Application (SPA) with a persistent New York Market Clock, global account synchronization, and clear navigation hierarchy:

1. **Dashboard** — Executive performance overview, key metrics, equity curves, instrument/strategy rankings, discipline, recent activity.
2. **Trades Log** — Complete trade management center, comprehensive filtering, server-side search, sorting, draft management, and quick actions.
3. **Trading Calendar** — Chronological performance calendar, daily P&L, daily R, trade counts, and focused day-detail inspector.
4. **Analytics** — Investigative analytical engine with deep drill-down across setups, instruments, directions, sessions, holding duration, and behavioral impact.
5. **Setups & Checklists** — Strategy creation, rule weights, checklist execution standards, and historical versioning.
6. **Accounts** — Multi-account portfolio management, risk limits, broker configurations, cash-flow ledger, and equity monitoring.
7. **Settings** — User preferences, theme selection (Nordic Clean, Sleek Terminal, Institutional Blue), risk defaults, timezone configuration.
8. **Backup & Import** — Complete broker CSV import workflow (column mapping, duplicate detection, reconciliation) and transaction-safe JSON backup/restore.

### Excluded Modules (Strictly Non-User-Facing)
Per product specification, the following modules must **NOT** be exposed in the UI or navigation:
- Daily Plans
- Standalone daily reviews
- Standalone weekly reviews
- Standalone monthly reviews
- Separate Action Items management
- Global Screenshot / Media Library

*Note:* All screenshots, chart attachments, vector annotations, personal notes, lessons, and psychological reflections remain strictly scoped to individual trade records.

---

## 3. Supported Markets & Contract Types
DnD natively supports five primary asset classes with deterministic economics:

| Asset Class | Contract / Instrument Types | Multiplier / Economics Convention |
| :--- | :--- | :--- |
| **Forex** | Spot FX, Broker-Traded FX | Pip-based calculations (`100,000` standard lots, `10,000` mini, `1,000` micro). Dynamic quote-to-account currency conversion. |
| **Gold** | Spot Gold (XAUUSD), Gold CFDs, COMEX Gold Futures (GC, MGC) | Spot: `100` oz/lot ($1/pt per 0.01 lot). Futures: GC ($100/pt), MGC ($10/pt). |
| **Silver** | Spot Silver (XAGUSD), Silver CFDs, COMEX Silver Futures (SI, SIL) | Spot: `5,000` oz/lot. Futures: SI ($50/pt), SIL ($10/pt). |
| **Indices** | Cash CFDs (US100, US500, US30), CME Futures (NQ, MNQ, ES, MES, YM, MYM) | CFD: Broker-defined point values. Futures: NQ ($20/pt), MNQ ($2/pt), ES ($50/pt), MES ($5/pt). |
| **Cryptocurrency** | Crypto Spot, Linear USDT/USDC Perpetuals, Inverse Coin-Margined Perpetuals | Linear: 1 contract = 1 base coin (or fraction). Fees & funding deducted natively. |

---

## 4. Financial Authority & Calculation Invariants
1. **Single Source of Truth:** `src/lib/financial-engine.ts` is the authoritative calculation core. Previews in client modals must reconcile with server output.
2. **Integer Math:** All currency calculations are computed in integer cents using arbitrary precision (`decimal.js`) and banker's rounding (Half-Even) to prevent floating-point drift.
3. **Authoritative Formula:**
   $$\text{Gross P\&L (cents)} = \text{directionalMove} \times \text{exitQty} \times \text{pointValueCents}$$
4. **Derived Status:** Trade status (`win`, `loss`, `breakeven`, `partial_*`, `open`) is server-derived from execution fills.
5. **Breakeven Handling:** Win rate strictly excludes breakeven trades from both numerator and denominator:
   $$\text{Win Rate} = \frac{\text{Wins}}{\text{Wins} + \text{Losses}}$$

---

## 5. User Roles & Security
- Strict user-level data isolation via Prisma queries (`where: { userId: user.id }`).
- Private trade media stored in Supabase Storage with 15-minute expiring signed URLs.
- Anti-tamper immutable setup snapshots (`TradeChecklistEvaluation`) locked upon execution.

