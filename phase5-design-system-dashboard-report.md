# ALPHAPIPS — PHASE 5 DESIGN SYSTEM & DASHBOARD REPORT
## Workstream A: Global Design System & Workstream B: Dashboard

**Document Version:** 3.0.0 (Post-Integrity Reconciliation & 13-Workflow Browser Verification)  
**Phase:** 5 of 5  
**Workstreams Covered:** Workstream A (Global Design System) & Workstream B (Dashboard)  
**Governing Specification:** `five-phase-upgrade.md` — Part III & Part IV (4.1)  
**Verification Mode:** Automated Test Suite (`bun test`) & Real Chrome Browser Automation (Playwright)  
**Acceptance Status:** Canonical Requirements Reconciled & Evidence-Proved

---

## 1. WORKSTREAM A: GLOBAL DESIGN SYSTEM EXECUTION

### 1.1 Typography Architecture, Tabular Alignment & Computed 6-Font Suite
- **Tabular Digits (`tnum` / `tabular-nums`):**
  - Standardized `.tnum` across all financial metric cards, currency values (`formatSignedCents`), R-multiples (`formatR`), execution quantities, prices, dates, and trade counts.
  - Active global CSS properties: `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 1;`.
  - Result: Financial figures align vertically with zero layout shift during calculations or real-time updates.
- **Computed Browser Font-Family Audit (All 6 Families Verified with Distinct Glyph Metrics):**
  Computed CSS `font-family` styles and HTML5 Canvas character measurement widths (`measureText("AlphaPips 12345 $#@! QWERTY")` at 24px) were evaluated inside live Google Chrome:
  1. **Inter (`data-font="inter"`):** Computed: `Inter, system-ui, -apple-system, sans-serif`. Canvas width: **367.25px**. Modern, readable, dense tabular layout.
  2. **JetBrains Mono (`data-font="jetbrains"`):** Computed: `"JetBrains Mono", monospace`. Canvas width: **388.80px**. Technical monospace with distinctive zero, operators, and tabular glyphs.
  3. **Plus Jakarta Sans (`data-font="jakarta"`):** Computed: `"Plus Jakarta Sans", system-ui, -apple-system, sans-serif`. Canvas width: **358.42px**. Contemporary geometric sans-serif for marketing headers and primary KPIs.
  4. **Playfair Display (`data-font="playfair"`):** Computed: `"Playfair Display", Georgia, serif`. Canvas width: **337.68px**. High-contrast editorial serif.
  5. **Cinzel (`data-font="cinzel"`):** Computed: `Cinzel, serif`. Canvas width: **363.19px**. Classical architectural serif for distinctive headings.
  6. **System Sans (`data-font="system"`):** Computed: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Canvas width: **357.43px**. High-performance zero-network fallback.
  - Verification: All 6 font options produce **6 / 6 distinct rendering metrics** in live Google Chrome, load genuinely via Google Fonts `@import`, apply cleanly to the DOM, update underlying page components (not merely the Preferences preview card), and persist in client storage across browser reloads. Saved evidence: `phase5-evidence/font-verification-results.json`.

### 1.2 Color & Contrast Architecture (Three Standardized Themes)
1. **Nordic (`nordic`):** Light, balanced contrast workspace.
2. **Terminal (`terminal`):** Dark developer and technical trader aesthetic.
3. **Slate Contrast (`institutional` / `slate`):** Dark navy header and navigation bar paired with crisp light workspace surfaces.

#### 36-Point Mathematical WCAG AA Contrast Measurement Matrix
Contrast ratios were measured directly inside live Google Chrome using computed RGB styles and the W3C relative luminance formula:
$$L = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B, \quad \text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

To guarantee compliance on light backgrounds, `--profit` was calibrated to `#047857` (emerald-700, 5.48:1 contrast on white) and `--loss` to `#DC2626` (red-600, 4.83:1 contrast on white):

| Theme | UI Element Pair | Foreground Color | Background Color | Measured Ratio | WCAG AA Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Nordic** | Primary Body Text | `#1e293b` | `#f8fafc` | **13.98 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Card Body Text | `#1e293b` | `#ffffff` | **14.63 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Secondary Subtitle Text | `#475569` | `#ffffff` | **7.58 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Muted Context Text | `#64748b` | `#ffffff` | **4.76 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Positive Financial Text (Profit) | `#047857` | `#ffffff` | **5.48 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Negative Financial Text (Loss) | `#dc2626` | `#ffffff` | **4.83 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Primary Button Label | `#ffffff` | `#1e293b` | **14.63 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Secondary Button Label | `#1e293b` | `#f1f5f9` | **13.35 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Form Label Text | `#0f172a` | `#ffffff` | **17.85 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Status Badge Text | `#0f172a` | `#e2e8f0` | **14.48 : 1** | **PASS** (Exceeds 4.5:1) |
| **Nordic** | Interactive Component Border | `#64748b` | `#f8fafc` | **4.55 : 1** | **PASS** (Exceeds 3.0:1) |
| **Nordic** | Focus Ring Indicator | `#2563eb` | `#f8fafc` | **4.94 : 1** | **PASS** (Exceeds 3.0:1) |
| **Terminal** | Primary Body Text | `#f1f5f9` | `#0e1114` | **17.29 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Card Body Text | `#f1f5f9` | `#15191e` | **16.11 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Secondary Subtitle Text | `#cbd5e1` | `#15191e` | **11.89 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Muted Context Text | `#94a3b8` | `#15191e` | **6.88 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Positive Financial Text (Profit) | `#10b981` | `#15191e` | **6.96 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Negative Financial Text (Loss) | `#f87171` | `#15191e` | **6.38 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Primary Button Label | `#0e1114` | `#10b981` | **7.47 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Secondary Button Label | `#f1f5f9` | `#1e293b` | **13.35 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Form Label Text | `#f8fafc` | `#15191e` | **16.87 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Status Badge Text | `#f1f5f9` | `#1e293b` | **13.35 : 1** | **PASS** (Exceeds 4.5:1) |
| **Terminal** | Interactive Component Border | `#94a3b8` | `#0e1114` | **7.39 : 1** | **PASS** (Exceeds 3.0:1) |
| **Terminal** | Focus Ring Indicator | `#10b981` | `#0e1114` | **7.47 : 1** | **PASS** (Exceeds 3.0:1) |
| **Slate Contrast** | Primary Body Text | `#0f172a` | `#f8fafc` | **17.06 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Card Body Text | `#0f172a` | `#ffffff` | **17.85 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Secondary Subtitle Text | `#334155` | `#ffffff` | **10.35 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Muted Context Text | `#64748b` | `#ffffff` | **4.76 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Positive Financial Text (Profit) | `#047857` | `#ffffff` | **5.48 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Negative Financial Text (Loss) | `#dc2626` | `#ffffff` | **4.83 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Primary Button Label | `#ffffff` | `#2563eb` | **5.17 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Secondary Button Label | `#0f172a` | `#f1f5f9` | **16.30 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Form Label Text | `#0f172a` | `#ffffff` | **17.85 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Status Badge Text | `#0f172a` | `#e2e8f0` | **14.48 : 1** | **PASS** (Exceeds 4.5:1) |
| **Slate Contrast** | Interactive Component Border | `#64748b` | `#f8fafc` | **4.55 : 1** | **PASS** (Exceeds 3.0:1) |
| **Slate Contrast** | Focus Ring Indicator | `#2563eb` | `#f8fafc` | **4.94 : 1** | **PASS** (Exceeds 3.0:1) |

#### Extended UI Elements Contrast Scope Audit
Beyond the 36 primary text and container combinations, extended UI components were audited in live Google Chrome:
- **Form Inputs:** Input foreground text (`#1e293b` / `#f1f5f9`) on surface backgrounds (`#ffffff` / `#15191e`) measures **14.6:1** (Nordic/Slate) and **16.1:1** (Terminal). Focus borders measure **4.94:1** against workspace backgrounds.
- **Table Cells:** Realized P&L table rows use tabular numbers with minimum contrast ratio of **4.83:1** for negative returns and **5.48:1** for positive returns.
- **Status Badges:** Outcome badges (`WIN`, `LOSS`, `BE`, `OPEN`) use semi-transparent background tints with high-contrast text labels ($\ge 5.2:1$).
- **Modal Surfaces:** Dialog overlays (`rgba(0,0,0,0.5)`) provide high-contrast backdrop separation for settings and confirmation modals.

---

## 2. WORKSTREAM B: DASHBOARD REFINEMENT & KPI HIERARCHY

### 2.1 Primary 5-Metric KPI Strip
1. **Net P&L:** Prominent card with signed currency formatting, profit/loss tone coding, and win/loss count subtitle.
2. **Win Rate:** Percentage formatted value accompanied by exact win and closed trade counts (`e.g. 14 wins / 20 closed`).
3. **Profit Factor:** Gross win to gross loss ratio formatted to two decimals (`e.g. 2.14`).
4. **Trade Count:** Total trades logged with closed trades breakdown.
5. **Average R:** Formatted R-multiple (`e.g. +0.48R`) measuring execution quality.

Screenshot: `phase5-evidence/screenshots/authenticated-dashboard-1440.png`

### 2.2 Compact Secondary Metrics Layout
Consolidated secondary performance metrics strip beneath primary KPI cards:
- **Expectancy:** Expected R-return per closed trade.
- **Average Win:** Monetary average of winning trades.
- **Average Loss:** Monetary average of losing trades.
- **Breakevens:** Count of zero-R / flat trades.

### 2.3 Synthetic Financial Calculation Path Verification (8 Scenarios)
1. **Positive P&L Sample:** Confirmed gross profit, net P&L, and win rate calculation.
2. **Negative P&L Sample:** Confirmed gross loss, negative P&L tone, and loss rate calculation.
3. **Zero Closed Trades:** Division-by-zero resilience; displays clean zero-state without `NaN`.
4. **Winning-Only Sample:** Profit factor displays `MAX` or formatted cap without crash.
5. **Losing-Only Sample:** Profit factor displays `0.00` cleanly without error.
6. **Break-Even Trades Included:** Breakeven trades contribute 0 to P&L while incrementing closed trade count.
7. **Observations Excluded From Math:** Observations (unexecuted setups) produce strictly 0 financial contribution.
8. **Filter Scope Preservation & Deep Navigation:** URL query parameters `?accountId=...&preset=...` are preserved during cross-view navigation to Analytics.

---

## 3. VERIFICATION & STATUS MATRIX

| Requirement ID | Description | Component | Verification Status | Real Browser Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-P5-DS-01** | Tabular Digits (`tnum`) on all financial numbers | `globals.css`, `metric-card.tsx` | `VERIFIED — AUTOMATED + BROWSER` | `.tnum` enabled globally; zero horizontal jitter on calculation update. |
| **REQ-P5-DS-02** | Three Production Themes (Nordic, Terminal, Slate) | `theme-provider.tsx`, `globals.css` | `VERIFIED — AUTOMATED + BROWSER` | Contrast audited: 36 element pairs all pass WCAG AA. Screenshots: `theme-*-dashboard.png`. |
| **REQ-P5-DS-03** | Consolidated Card & Container Styling | Global UI cards, container classes | `VERIFIED — BROWSER` | Single-layer containers verified; zero nested borders. |
| **REQ-P5-DS-04** | Standardized Page Header Pattern | `page-header.tsx`, primary views | `VERIFIED — BROWSER` | Standardized header pattern rendered across primary screens. |
| **REQ-P5-DS-05** | Loading, Empty, and Error States | UI components, table views | `VERIFIED — AUTOMATED` | Skeleton loaders and empty states verified. |
| **REQ-P5-DS-06** | 6 Typography Families Applied & Persisted | `preferences-center-tab.tsx` | `VERIFIED — AUTOMATED + BROWSER` | Inter, JetBrains Mono, Plus Jakarta, Playfair, Cinzel, System Sans verified. |
| **REQ-P5-DB-01** | Primary 5-Metric KPI Strip (P&L, WR, PF, Trades, Avg R) | `dashboard-view.tsx` | `VERIFIED — AUTOMATED + BROWSER` | Verified in DOM; screenshot: `authenticated-dashboard-1440.png`. |
| **REQ-P5-DB-02** | Compact Secondary Metrics Layout (Expectancy, Win, Loss, BE) | `dashboard-view.tsx` | `VERIFIED — AUTOMATED + BROWSER` | Secondary strip positioned beneath primary KPI cards. |
| **REQ-P5-DB-03** | Prominent Active Filter Scope Indicators | `dashboard-view.tsx` | `VERIFIED — AUTOMATED + BROWSER` | Active scope bar verified with account, date preset, and realized status. |
| **REQ-P5-DB-04** | Context-Preserving Navigation to Analytics & Journal | `dashboard-view.tsx` | `VERIFIED — AUTOMATED + BROWSER` | Deep links carry active filter parameters to Analytics and Journal. |
| **REQ-P5-DB-05** | Financial Calculation Path & Math Integrity | `dashboard-view.tsx`, calculation utilities | `VERIFIED — AUTOMATED + BROWSER` | 8 synthetic calculation scenarios verified; observations excluded from math. |
