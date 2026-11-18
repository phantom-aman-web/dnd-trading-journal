# ALPHAPIPS — ROUTE, PAGE & VIEW CATALOG
**Authoritative Architectural Specification & Interface Inventory**

---

## 1. ARCHITECTURAL OVERVIEW & ROUTING MECHANISM

AlphaPips utilizes a hybrid Next.js 16 App Router single-page application (SPA) architecture designed for instantaneous desktop and mobile navigation without full-page server round-trips.

- **Primary Entry Point:** `src/app/page.tsx` renders inside `src/app/layout.tsx`.
- **Global Application Shell:** `src/components/app-shell.tsx` mounts persistent navigation chrome (Sidebar, TopBar, GlobalBreadcrumbs, MobileNav, MobileDrawer) alongside global layers (FloatingWidgetsLayer, NoTradeDialog, CommandPalette, KeyboardShortcutsDialog).
- **Navigation State Store:** `src/lib/nav-store.ts` (`useNav`) manages the active view (`view: ViewKey`), contextual parameters (`params: Record<string, string>`), active account filter (`selectedAccountId: string`), collapsed sidebar state, and scroll positions (`scrollPositions: Record<string, number>`) with localStorage persistence under key `dnd-nav`.
- **View Caching & Keep-Alive:** `src/components/app-shell.tsx` maintains a `visitedViews: Set<ViewKey>` state. Visited views remain mounted in the DOM with the utility class `hidden` when inactive, completely preserving client-side component state, scroll position, filter selections, and unsaved form field inputs.
- **Optimistic Auth Mounting:** If `localStorage` indicates an authenticated view and no sign-out flag is present, `AppShell` renders immediately during background session verification to prevent layout flashing.

---

## 2. COMPLETE VIEW IDENTIFIER INVENTORY (`ViewKey`)

| ViewKey | Scope | Primary Component Path | Route/Param Triggers |
| :--- | :--- | :--- | :--- |
| `landing` | Public | `src/components/views/landing-view.tsx` | Default unauthenticated view (`/`) |
| `signin` | Public | `src/components/views/auth-view.tsx` | Query param `mode=signin` or unauthenticated CTA |
| `signup` | Public | `src/components/views/auth-view.tsx` | Query param `mode=signup` or unauthenticated CTA |
| `terms` | Public/Auth | `src/components/public/legal-doc-viewer.tsx` | Overlay modal (`view: "terms"`) |
| `privacy` | Public/Auth | `src/components/public/legal-doc-viewer.tsx` | Overlay modal (`view: "privacy"`) |
| `cookies` | Public/Auth | `src/components/public/legal-doc-viewer.tsx` | Overlay modal (`view: "cookies"`) |
| `dashboard` | Authenticated | `src/components/views/dashboard-view.tsx` | Default authenticated view |
| `tradesLog` | Authenticated | `src/components/views/trades-log-view.tsx` | Sidebar, TopBar, Breadcrumbs (`view: "tradesLog"`) |
| `tradeDetail` | Authenticated | `src/components/views/trade-detail-view.tsx` | Trade row click (`view: "tradeDetail"`, `params.id`) |
| `tradeNew` | Authenticated | `src/components/views/trade-form-view.tsx` | "New Trade" button (`view: "tradeNew"`) |
| `calendar` | Authenticated | `src/components/views/calendar-view.tsx` | Sidebar, MobileNav (`view: "calendar"`) |
| `analytics` | Authenticated | `src/components/views/analytics-view.tsx` | Sidebar, Dashboard KPI deep links (`view: "analytics"`) |
| `setups` | Authenticated | `src/components/views/playbooks-view.tsx` | Sidebar (`view: "setups"`) |
| `accounts` | Authenticated | `src/components/views/accounts-view.tsx` | Sidebar, TopBar account management (`view: "accounts"`) |
| `propChallenges` | Authenticated | `src/components/views/prop-challenges-view.tsx` | Sidebar (`view: "propChallenges"`, `params.challengeId`) |
| `riskCalculator` | Authenticated | `src/components/views/risk-calculator-view.tsx` | Sidebar, Workspace panel (`view: "riskCalculator"`) |
| `tradingTodo` | Authenticated | `src/components/views/trading-todo-view.tsx` | Sidebar (`view: "tradingTodo"`) |
| `settings` | Authenticated | `src/components/views/settings-view.tsx` | Sidebar, Profile dropdown (`view: "settings"`) |
| `backup` | Authenticated | `src/components/views/backup-view.tsx` | Sidebar, Profile dropdown (`view: "backup"`) |
| `archived` | Authenticated | `src/components/views/archived-view.tsx` | Sidebar Manage group (`view: "archived"`) |
| `noTrades` | Authenticated | `src/components/views/no-trades-view.tsx` | *Deprecated standalone page* (integrated into Trades Log) |

---

## 3. PAGE-BY-PAGE DETAILED SPECIFICATION

### 3.1 Public Landing View (`landing`)
- **File:** `src/components/views/landing-view.tsx`
- **Purpose:** Public presentation, product positioning, and conversion funnel for unauthenticated visitors.
- **Visual Structure:**
  - Header: `PublicHeader` with brand logo, smooth-scroll navigation links (`#platform`, `#analytics`, `#prop-firm`, `#pricing`, `#faq`), and CTA buttons (`Sign In`, `Get Started Free`).
  - Hero Section: Atmospheric deep navy (`#070B18`) background, cyan/blue radial glows, headline ("The Professional Operating System for Serious Traders"), CTA group, and dynamic floating financial cards (Live P&L badge, Drawdown monitor pill, Win-rate dial).
  - Feature Sections:
    1. Interactive Platform Tour: Multi-tab preview of Trades Log, Analytics, Prop Intelligence, and Risk Calculator.
    2. Five Core Questions Framework: Visual cards answering "What happened?", "How did I perform?", "Why did it happen?", "How should I manage activity?", and "How can I work efficiently?".
    3. Prop Firm Challenge Showcase: Visual compliance tracker demonstration with static/trailing drawdown meters and 17:00 NY reset badge.
    4. Financial Engine Breakdown: Universal execution model and multi-asset pip/tick calculation showcase.
    5. Sample Data Disclaimers: Prominent legal disclaimers distinguishing demo performance from actual investment returns.
  - Footer: `PublicFooter` with legal links (`Terms`, `Privacy`, `Cookies`), platform status, and copyright.
- **Responsive Behavior:** Navigation collapses into mobile hamburger menu; floating cards stack vertically below 1024px; typography scales down cleanly.

### 3.2 Authentication View (`signin` / `signup`)
- **File:** `src/components/views/auth-view.tsx`
- **Purpose:** Secure user credentials handling, account registration, session creation, and legal agreement locking.
- **Visual Structure:**
  - Centered card container with tab toggle between "Sign In" and "Create Account".
  - Sign In Form: Email input, password input with show/hide eye toggle, remember session, primary CTA button, and server error banner.
  - Sign Up Form: Full Name, Email, Password (minimum 8 characters), mandatory Terms of Service acceptance checkbox, mandatory Privacy Policy acknowledgment checkbox, and version-pinned submit CTA.
  - Legal Document Modal: Clicking "Terms of Service" or "Privacy Policy" triggers `LegalDocViewer` modal directly on top of the form, preventing user navigation loss.
- **State & Communication:** Submits via `POST /api/auth?mode=signin` or `POST /api/auth?mode=signup`. On success, sets HTTP-only JWT cookie `dnd_session` and updates `useAuth` store.

### 3.3 Dashboard View (`dashboard`)
- **File:** `src/components/views/dashboard-view.tsx`
- **Purpose:** Daily command center providing immediate visibility into core trading KPIs, current equity curve, daily financial performance, and rule adherence.
- **Visual Structure:**
  - Header: Welcome greeting, selected account badge, time preset selector (`Today`, `This Week`, `This Month`, `This Quarter`, `This Year`, `All Time`), and "Customize Layout" button.
  - Primary 5-Metric KPI Strip:
    1. **Net P&L:** Signed dollar amount, percentage return, and profit/loss status coloring.
    2. **Win Rate:** Percentage of winning trades over closed trades (wins + losses), excluding breakevens.
    3. **Profit Factor:** Gross profits divided by gross losses with infinity protection.
    4. **Trade Count:** Total executions and closed trades breakdown.
    5. **Average R:** Realized risk-multiple average.
  - Secondary Metric Row: Expectancy ($ and R), Maximum Drawdown ($ and %), Largest Win, Largest Loss, Win/Loss Streaks.
  - Charting Section:
    - Equity Curve (`EquityCurveChart`): Time-series chart of cumulative account equity with peak-to-trough drawdown shading.
    - Daily P&L (`DailyPnlChart`): Bar chart of daily net realized P&L with win/loss color thresholds.
    - R-Distribution (`RDistributionChart`): Histogram of trade outcomes bucketed by realized R-multiples.
  - Process & Discipline Breakdown:
    - Checklist Adherence rate calculated from actual trade checklist evaluations.
    - Rule violations count and top violated strategy rules list.
  - Recent Trades Activity: Compact tabular ledger of recent trade entries with direction, setup tag, P&L, and quick-action detail links.
  - Favorite Trades Widget: Pinboard of starred trades.
- **Interaction Behavior:** Clicking any KPI card opens Analytics View pre-filtered to the corresponding metric. Clicking a trade row opens `TradeDetailView`.

### 3.4 Trades Log View (`tradesLog`)
- **File:** `src/components/views/trades-log-view.tsx`
- **Purpose:** Primary ledger and journal for executed trades and market restraint observations.
- **Visual Structure:**
  - Header & Toolbar: View title, search input (instrument, strategy, tags, notes), account filter dropdown, strategy filter dropdown, session filter dropdown, direction toggle (Long/Short/All), outcome filter (Win/Loss/BE/Open), setup grade filter, and date-range picker.
  - Saved Filter Presets (`SavedFilterPresets`): One-click pills to save, apply, and manage custom filter configurations.
  - Executed Trades Table:
    - Columns: Date/Time, Account, Instrument Symbol, Direction (Long/Short badge), Status (Open, Win, Loss, BE), Planned Entry/Stop/Target, Realized Net P&L (color-coded, privacy-maskable), Realized R, Setup Grade, Checklist Adherence badge, Tags, and Action menu.
    - Row Interaction: Clicking row navigates to `TradeDetailView` (`params: { id: trade.id }`).
    - Inline Actions: Quick "Close Trade" modal for open trades, "Execute Trade" modal for planned trades, Duplicate trade, Star/Favorite toggle, and Soft-Archive.
    - Pagination Bar: Page number controls, page size selector (10, 25, 50, 100), and total record counter.
  - Integrated No-Trade Observations Tab / Toggle:
    - Tab switch between "Executed Trades" and "No-Trade Observations".
    - Observation Table: Date, Session, Symbol, Identified Setup, Restraint Reason Category (e.g. `no_valid_setup`, `poor_rr`, `news_risk`, `spread_high`), Decision Type (`deliberate_avoidance`, `missed`, `rejected`), Status (`observing`, `invalidated`, `completed`), and View Details button.
    - Exclusions Enforced: Records in the No-Trade tab are strictly isolated from financial totals, trade count, win rate, and drawdown metrics.
- **Responsive Behavior:** On tablet/mobile, secondary table columns collapse; horizontal touch-scroll is enabled; filter sheet opens via mobile filter drawer.

### 3.5 Trade Detail View (`tradeDetail`)
- **File:** `src/components/views/trade-detail-view.tsx`
- **Purpose:** Comprehensive deep-dive inspection of an individual trade across execution, setup discipline, psychology, and evidence.
- **Visual Structure:**
  - Header: Back button, Instrument & Direction badge, Date/Time, P&L headline, R-multiple badge, and action bar (Edit, Duplicate, Archive, Favorite, Share).
  - Six Structured Inspection Tabs:
    1. **Overview Tab:** Summary cards of trade economics, entry/exit prices, position size, gross P&L, fees/commission/swap/slippage deductions, net P&L, and hold duration.
    2. **Setup Tab:** Selected strategy name and version label, rules checklist with pass/fail evaluation indicators, required vs optional rule weights, and setup grade.
    3. **Execution Tab:** Chronological list of execution fills (entries and partial exits), execution timestamps, prices, and quantities.
    4. **Replay Tab (`TradeReplay`):** Visual trade lifecycle progression showing entry, execution, price excursion, and exit points.
    5. **Psychology Tab:** Pre-trade emotional state, mood tags, confidence rating (1–5), post-trade reflections, discipline adherence, and recorded mistakes.
    6. **Evidence Tab (`ImageViewer`):** High-resolution chart screenshots attached to this specific trade with timeframe tags (e.g. 5m, 15m, 1h) and geometric markup annotations. *Strictly trade-isolated; no global media library.*

### 3.6 Trade Form View (`tradeNew` / Edit Trade)
- **File:** `src/components/views/trade-form-view.tsx`
- **Purpose:** Dual-mode trade logging engine supporting both streamlined entry and a thorough 5-step advanced execution wizard.
- **Modes:**
  - **Quick Entry Mode:** Single compact form for rapid logging during fast-moving markets.
  - **5-Step Wizard Mode:**
    - *Step 1: Trade Info:* Account selection, strategy attribution, symbol picker with auto-suggest (`InstrumentSelector`), direction toggle, session picker, timeframe, news event categorization, thesis notes, and chart screenshot upload with annotation canvas (`ImageAnnotator`).
    - *Step 2: Setup Checklist:* Dynamically extracts checklist items from the chosen StrategyVersion. Displays required rule badges, live adherence score preview, and notes field per rule.
    - *Step 3: Risk & Sizing:* Planned entry price, planned stop loss, planned target price. Real-time calculation of stop distance (pips/ticks), planned risk-to-reward ratio (R:R), position size in lots/contracts, dollar risk amount, and risk percentage warnings (Normal / Warning / Critical).
    - *Step 4: Partial Exits:* Multi-target planning (TP1, TP2, TP3) with percentage-based lot scaling and weighted average target computation.
    - *Step 5: Review & Save:* Complete summary confirmation cards, validation checks, "Save as Draft", and "Log Trade" submission.
- **Integrity Features:** Real-time P&L preview; client idempotency key generation (`crypto.randomUUID()`) sent via `Idempotency-Key` HTTP header.

### 3.7 Trading Calendar View (`calendar`)
- **File:** `src/components/views/calendar-view.tsx`
- **Purpose:** Temporal performance analysis mapping trading days, weekly consistency, and monthly outcomes in the user's localized timezone.
- **Visual Structure:**
  - Header: Month/Year navigation, timezone indicator (e.g. `America/New_York`), View toggle (Month / Week), and monthly performance summary cards (Total Net P&L, Trading Days, Win Days vs Loss Days, Win Rate).
  - Calendar Grid:
    - Day Cells: Calendar date, day net P&L with profit/loss background tint, trade count pill, observation count pill, win/loss mini ratio, and primary trading session tag.
    - Day Cell Click: Triggers contextual navigation to Trades Log filtered to that exact date.
  - Weekly Totals Column: Weekly net P&L and cumulative weekly R-multiple.
- **Date Handling:** Server groups trades using Canada-English ISO date formatting (`en-CA`) inside the user's configured IANA timezone (`UserSettings.timezone`), preventing day-boundary shift errors.

### 3.8 Analytics View (`analytics`)
- **File:** `src/components/views/analytics-view.tsx`
- **Purpose:** Institutional-grade performance diagnostics, risk evaluation, and discipline attribution.
- **Navigation Structure:** Categorized into 3 functional domains spanning 9 dedicated tabs:
  - **Performance Domain:**
    1. *Overall Metrics (`overall`):* Net P&L, Gross Profit/Loss, Win Rate, Profit Factor, Expectancy ($ and R), Recovery Factor, Sharpe/Sortino indicators, Long vs Short comparison, trade duration distribution.
    2. *By Instrument (`instruments`):* Performance breakdown by asset class (Forex, Gold, Silver, Indices, Crypto) and individual symbols; win rates, profit factors, and volume.
    3. *By Setup & Strategy (`setup`):* Strategy edge comparison, playbook win rates, average R-multiples, and strategy version attribution.
  - **Risk & Execution Domain:**
    4. *Drawdown Analytics (`drawdown`):* Peak-to-trough drawdown depth, underwater curve, drawdown phase durations, recovery time analysis, and maximum drawdown limits.
    5. *Time in Trade (`holdingTime`):* Holding duration analysis bucketed into scalps (<15m), day trades (15m–4h), swing trades (>4h), and overnight holds; correlation between holding time and profitability.
    6. *Sessions & Weekdays (`sessions`):* Performance across Asia, London, New York AM, and New York PM sessions; Monday through Friday heatmaps.
  - **Discipline & Quality Domain:**
    7. *Checklist Adherence (`checklist`):* True adherence score computed from completed required checklist items vs total required items; strictly decoupled from win rate.
    8. *Rule Violations (`violations`):* Non-causal correlation analysis between broken rules and execution outcomes; most frequent mistakes.
    9. *Data Quality (`dataQuality`):* Missing data scanner highlighting trades missing stop losses, exit times, setup tags, or checklist responses; overall data health score.
- **Shared Controls:** `SharedFilterBar` provides unified account, date-range, and market filtering across all tabs; `MetricDefinitionsModal` offers mathematical documentation for every formula.

### 3.9 Accounts Management View (`accounts`)
- **File:** `src/components/views/accounts-view.tsx`
- **Purpose:** Account portfolio administration, capital balances tracking, account type segregation, and risk limits configuration.
- **Visual Structure:**
  - Header: "Add Account" CTA, portfolio aggregate balance banner, active accounts count.
  - Accounts Grid:
    - Account Cards: Account Name, Broker, Account Type badge (`live`, `demo`, `prop`, `funded`, `backtest`, `personal`), Account Currency, Starting Balance, Current Balance, Realized Net Return %, Max Drawdown %, Daily Loss Limit %, Default Account badge, and Archive action.
  - Create / Edit Account Dialog:
    - Fields: Name, Broker, Account Type, Currency (USD, EUR, GBP, JPY, AUD, CAD, CHF), Starting Balance, Current Balance, Daily Loss Limit %, Max Drawdown %, Consistency Rate %, and "Set as Default" checkbox.
- **Data Integrity:** Deleting or archiving accounts soft-preserves associated trade records; default account status updates atomically.

### 3.10 Prop Challenges & Lifecycle View (`propChallenges`)
- **File:** `src/components/views/prop-challenges-view.tsx`
- **Purpose:** Specialized evaluation and funded account intelligence platform tracking firm rules, stage progression, compliance thresholds, failure diagnoses, and payout disbursements.
- **Views & Sub-components:**
  - **Grid Overview (`src/components/accounts/prop-challenges-section.tsx`):**
    - Active evaluation and funded cards displaying Prop Firm name (e.g. FTMO, FundingPips, MFF), Stage badge (`Phase 1`, `Phase 2`, `Funded`), Status badge (`Active`, `Passed`, `Breached`), Target Progress bar, Daily Loss gauge, and Drawdown meter.
  - **Individual Challenge Detail (`src/components/accounts/prop-challenge-detail.tsx`):** Opened when `params.challengeId` is present. Includes 8 dedicated tabs:
    1. *Overview Tab:* Progress toward profit target, remaining profit required, current balance, high-water mark, and days traded.
    2. *Rules & Compliance Tab:* Exhaustive rule matrix with live status badges (`passed`, `violated`, `at_risk`, `unknown`, `unverified`, `not_applicable`).
    3. *Performance Tab:* Challenge-specific equity curve, daily P&L cycle breakdown, and consistency distribution.
    4. *Trade History Tab:* Trade ledger filtered to this specific challenge with direct deep-links to `TradeDetailView`.
    5. *Phase History Tab:* Versioned snapshots of completed phases (Phase 1, Phase 2) retaining historical starting balances, targets, and dates.
    6. *Failures & Breaches Tab:* Forensic failure diagnostic engine detailing exact breach timestamp, rule threshold, actual recorded value, amount exceeded, contributing trade IDs, and firm timezone reset context. Includes undisclosed firm rejection dispute logger.
    7. *Payouts Tab:* Funded account payout eligibility calculator, profit split configuration (e.g. 80/20, 90/10), payout request history, and net cash disbursements ledger.
    8. *Settings Tab:* Rule thresholds editor, trailing vs static drawdown toggle, reset timezone (`America/New_York`), and reset hour (17:00).
  - **Funded Phase Detail Modal (`src/components/accounts/funded-phase-detail-modal.tsx`):** Modal inspecting the transition from evaluation to live funded trading.

### 3.11 Setups & Playbooks View (`setups`)
- **File:** `src/components/views/playbooks-view.tsx` & `src/components/strategies/strategy-detail-view.tsx`
- **Purpose:** Strategy management, version-controlled rules authoring, dynamic checklists definition, strategy terminology dictionary, and version comparison.
- **Visual Structure:**
  - Playbook Grid: Strategy cards showing strategy name, market focus, timeframe, active version label (e.g. `v1.2`), trade count, win rate, and net P&L.
  - Create Strategy Dialog: Name, Description, Target Markets, Timeframe, Trading Session, Initial Rules list, and Custom Strategy Fields.
  - Strategy Detail View (`StrategyDetailView`):
    - Header: Strategy title, version tag, status toggle (Active/Paused/Archived), and action buttons ("Edit Current Version", "Upgrade Version", "Compare Versions").
    - Performance Overview: Authoritative metrics for this strategy across versions.
    - Rules & Checklist Section: Ordered rules with required/optional flags and scoring weights.
    - Strategy Dictionary: Strategy-specific terminology glossary (e.g. ICT concepts, order flow terms, custom indicators).
    - Version History Drawer: Historical version list with changelogs, rationale, and effective dates.
  - Strategy Version Comparison Modal (`StrategyVersionComparisonModal`): Side-by-side rule comparison highlighting added, removed, and modified rules, with low sample size guardrails (`N < 20`) and non-causal performance phrasing.

### 3.12 Risk Calculator View (`riskCalculator`)
- **File:** `src/components/views/risk-calculator-view.tsx`
- **Purpose:** Standalone position sizing and pre-trade risk modeling engine adhering to market-specific financial economics.
- **Visual Structure:**
  - Inputs Section:
    - Account Selector: Pulls current balance and currency.
    - Instrument Selector: Resolves point value, tick size, and contract size.
    - Risk Percentage Slider & Input: 0.1% to 10% with warning banners.
    - Entry Price & Stop Loss Price: Decimal inputs with pip/tick distance derivation.
    - Target Price (Optional): For R:R and profit projection.
  - Sizing Output Panel:
    - Recommended Position Size (Lots for Forex/Gold, Contracts for Futures/Indices, Coins for Crypto).
    - Calculated Dollar Risk Amount.
    - Planned Risk-to-Reward Ratio (e.g. `1 : 2.5`).
    - Risk Limit Status Pill (Normal / Warning / Critical).
    - Minimum Tradable vs Budget validation check.
  - Multi-Target Scale-Out Calculator: TP1, TP2, TP3 partial profit target allocation.
  - Pre-Populate Action: "Send to New Trade" button transitions directly into `tradeNew` with all parameters pre-filled.

### 3.13 Trading To-Do View (`tradingTodo`)
- **File:** `src/components/views/trading-todo-view.tsx`
- **Purpose:** Trading workflow task manager, pre-market preparation checklist, and execution routine organizer.
- **Visual Structure:**
  - View Switcher: List View vs Kanban Board View.
  - Categorized Task Lists:
    1. *Inbox:* Unclassified trading tasks and quick reminders.
    2. *Watchlist:* Symbols and setups being monitored for session triggers.
    3. *Research:* Backtesting tasks, macro review, and strategy analysis.
    4. *Execution:* Pre-session checklist and active trade management steps.
    5. *Routine:* Daily and weekly trading habits.
  - Task Item Controls: Checkbox completion, priority badge (`Low`, `Medium`, `High`, `Urgent`), due date/time, pinned status, subtask progress, and linked entities (Symbol, Strategy, Account).
  - Task Creation Modal: Title, category, priority, due date, structured template selection (`General`, `Market Bias`, `Watchlist`, `Potential Setup`), and subtask checklist builder.

### 3.14 Preferences & Settings View (`settings`)
- **File:** `src/components/views/settings-view.tsx` & `src/components/settings/preferences-center-tab.tsx`
- **Purpose:** Comprehensive user configuration center organized into 9 preference categories and 4 high-level administrative tabs.
- **High-Level Administrative Tabs:**
  1. *Profile Tab:* Personal information (name, email), password change form, and danger zone (Account Deletion with two-step confirmation).
  2. *Trading Defaults Tab:* Default account, preferred instruments multi-select, default session, default timeframe, risk thresholds (Normal max %, Warning max %, Critical max %), max trades per day, and daily loss limit %.
  3. *Preferences Center Tab (`PreferencesCenterTab`):* 9 structured categories:
     - `all`: Unified scrollable index of all settings.
     - `appearance`: Approved theme selector (`Nordic`, `Sleek Terminal`, `Slate Contrast`).
     - `typography`: Font family selection (6 families) and 3 independent roles (`Interface`, `Display`, `Financial`).
     - `density`: Interface density selector (`Compact`, `Comfortable`, `Spacious`), font size scale, larger text toggle, and reduced motion.
     - `privacy`: Global privacy mode toggle with balance masking (`••••••`).
     - `regional`: Timezone selector (IANA searchable list), Date format, Time format, Week starts on, and NY market offset.
     - `workspace`: Default multi-panel layout configuration (2-col, 3-col, 2-row, grid) and panel assignments.
     - `shortcuts`: Interactive keyboard shortcuts cheatsheet.
     - `sync`: Offline database status, IndexedDB sync status, cache clearing, and local data reset.
  4. *Legal Tab:* Direct access to Terms of Service, Privacy Policy, Cookie Policy, and Cookie Consent management.

### 3.15 Backup & Export View (`backup`)
- **File:** `src/components/views/backup-view.tsx`
- **Purpose:** Comprehensive data portability, disaster recovery, schema 2.0 JSON archive export, and duplicate-safe restoration.
- **Visual Structure:**
  - Export Section: One-click "Create Complete Backup" button generating an encrypted Schema 2.0 JSON payload encompassing all 12 core user entities.
  - Backup History Ledger: Table of previous backups with timestamp, size in KB, record count breakdown, and download link.
  - Restore & Import Section:
    - File upload dropzone for `.json` archives.
    - Two-Stage Restore Flow: Uploading a file invokes `POST /api/backups/preview`, returning a structural inspection report with duplicate conflict detection (100% exact match, 85% likely duplicate, 60% possible, 0% distinct).
    - Transactional Execution: The user confirms restore options (Overwrite vs Merge vs Skip duplicates); the restore runs within a single atomic database transaction.
  - CSV Trade Importer: Dedicated broker CSV mapping interface supporting major broker export formats.

### 3.16 Archived Records View (`archived`)
- **File:** `src/components/views/archived-view.tsx`
- **Purpose:** Safe viewing and restoration of soft-archived trading records, accounts, strategies, and observations.
- **Visual Structure:**
  - Filter Tabs: `All`, `Trades`, `Accounts`, `Strategies`, `No-Trade Observations`.
  - Archived Records Table: Entity Type, Name/Symbol, Archived Date, Original Context, and "Restore" button.
  - Action Safety: Restoring an entity returns it to active views with all relational foreign keys and historical linkages intact. Emits an audit event (`trade.restored`, etc.).

### 3.17 Multi-Panel Institutional Workspace
- **File:** `src/components/workspace/multi-panel-workspace.tsx`
- **Purpose:** High-productivity multi-monitor trading station allowing users to split their view into 2 to 4 simultaneous active panels.
- **Layout Options:**
  - `2-col` (Default, 50/50 split).
  - `3-col` (Adaptive layout for 1440px and 1920px viewports).
  - `2-row` (Horizontal split).
  - `grid` (2x2 four-panel layout).
- **Supported Panel Views:** Dashboard, Trades Log, Trade Detail, Analytics, Risk Calculator, Setups & Checklists, Calendar, Accounts, Prop Challenges, Trading To-Do, Settings, Archived Records, Backup.
- **Strict Exclusions:** Excludes standalone No-Trade page, standalone daily plans, standalone reviews, and global media gallery.
- **Panel Capabilities:** Resizable panel splitters via `@dnd-kit` / `react-resizable-panels`, minimum width protection (380px), panel maximization toggle, linked trade context synchronization, and layout reset.

---

## 4. GLOBAL OVERLAYS, DRAWERS & DIALOGS

1. **Floating Widgets Layer (`src/components/floating/floating-widgets-layer.tsx`):**
   - Renders exactly the 7 approved floating widgets:
     1. *Drawdown Monitor:* Real-time drawdown meter and high-water mark tracker.
     2. *Quick Risk Calculator:* Compact lot sizing and pip calculator.
     3. *Daily Risk Limit:* Daily loss ceiling monitor and reset countdown.
     4. *Quick Notes:* Free-form notepad with auto-save.
     5. *Focus Timer:* Pomodoro and session timer.
     6. *Random Trading Tip:* Curated educational trading psychology flashcards.
     7. *Sticky Notes:* Color-coded movable desktop reminders.
   - Behavior: Drag-and-drop repositioning, snap-to-edge (16px margin), collision mitigation (32px header nudge on overlap), keyboard arrow movement, keyboard isolation when typing in inputs, and mobile dock integration (<640px).
2. **No-Trade Observation Dialog (`src/components/no-trades/no-trade-dialog.tsx`):**
   - Modal accessible via sidebar button or shortcut `O`. Allows logging market observations, missing criteria, and deliberate avoidance decisions.
3. **Command Palette (`src/components/command-palette.tsx`):**
   - Global Cmd+K / Ctrl+K modal for rapid fuzzy navigation across all views, accounts, strategies, recent trades, and action commands.
4. **Keyboard Shortcuts Dialog (`src/components/keyboard-shortcuts-dialog.tsx`):**
   - Accessible via `?` key or top bar. Catalogs global navigation keys (`G D`, `G T`, `G C`, `G A`, `G S`, `G P`, `G R`, `G W`, `G ,`), action keys (`N`, `O`, `Cmd+K`), and widget toggles (`M`, `P`).
5. **Close Trade Modal (`src/components/trade/close-trade-modal.tsx`):**
   - Modal to record exit price, exit timestamp, exit quantity, and fees for open positions.
6. **Execute Trade Modal (`src/components/trade/execute-trade-modal.tsx`):**
   - Modal transitioning planned orders into executed trades upon fill confirmation.
7. **Onboarding Tour & Welcome Flow (`src/components/onboarding/...`):**
   - `WelcomeScreen`, `SetupWizard`, `Tour`, and `TourCompletion` guides new users through initial account setup, theme selection, and feature orientation.
