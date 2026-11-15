# ALPHAPIPS
# COMPLETE PRODUCT AUDIT, UI/UX IMPROVEMENT & FIVE-PHASE IMPLEMENTATION ROADMAP

**Document type:** Product, UX, Architecture and Functional Improvement Specification  
**Product:** AlphaPips — Trading Performance OS  
**Scope:** Both supplied website recordings  
**Objective:** Improve the existing product systematically without unnecessary redesign or feature duplication.

---

# PART I — PRODUCT DIRECTION AND OVERALL ASSESSMENT

## 1. Executive Summary

AlphaPips has evolved beyond a basic trading journal.

It now combines:

- Trade recording.
- No-Trade Observations.
- Trade Detail and execution information.
- Trading Calendar.
- Account management.
- Analytics.
- Strategy and checklist management.
- Strategy versioning.
- Strategy-specific terminology.
- Prop Firm Challenge tracking.
- Position and Risk Calculator.
- Trading To-Do.
- Favorites.
- Archive and Backup.
- Multi-Panel Workspace.
- Floating Widgets.
- Offline functionality and user preferences.

The product already has a recognizable visual identity and a substantial amount of functionality.

The next step should be to make these capabilities feel like one coherent trading performance system.

### Core product direction

AlphaPips should help traders answer five important questions:

1. **What happened?** — Record and understand trades and market observations.
2. **How did I perform?** — Analyze financial results, execution, behavior and risk.
3. **Why did it happen?** — Understand strategies, setups, checklists and execution decisions.
4. **How should I manage my trading activity?** — Manage accounts, risk limits, challenges and tasks.
5. **How can I work more efficiently?** — Use an organized, customizable and reliable trading workspace.

The central product principle should be:

**Record accurately → Analyze honestly → Understand execution → Improve strategy → Manage risk.**

Do not prioritize adding more independent tools over improving these existing experiences.

---

# PART II — CRITICAL PROBLEMS: CORRECTNESS AND USER TRUST

These issues must be investigated before expanding analytics or making additional visual improvements.

## 2.1 Checklist Adherence Is Currently Based on Win Rate

**Priority: Critical**

The Analytics Engine visibly describes adherence as:

"Adherence is computed from your setup's win-rate (a proxy for rule discipline)."

This is conceptually incorrect.

Win rate and checklist adherence are different measurements.

A strategy can produce a high win rate while the trader frequently violates its rules. Another strategy can have a lower win rate while being executed consistently.

### Required correction

Calculate adherence from actual checklist responses recorded against individual trades.

Use a defensible calculation such as:

Checklist Adherence = Completed applicable required checklist items / Total applicable required checklist items × 100.

Display:

- Adherence percentage.
- Number of evaluated trades.
- Number of checklist items completed.
- Number of required items.
- Missing checklist information.
- Sample size.

Do not substitute win rate for checklist adherence.

If the underlying data is insufficient, display "Insufficient data" rather than a fabricated percentage.

Keep win rate completely independent.

## 2.2 Rule Violation Analytics Must Avoid Causal Claims

**Priority: High**

The Rule Violations section describes behavior flags as rule breaks that impacted trade outcomes.

A behavior flag records that an event or behavior was associated with a trade. It does not prove causation.

### Required correction

Use wording such as:

"Historical performance of trades carrying this behavior flag."

Display:

- Number of occurrences.
- Trades affected.
- Win rate.
- Average R.
- Net P&L.
- Percentage of recorded trades associated with the flag.

Use "associated with" rather than claiming a behavior caused a particular outcome.

## 2.3 Hourly Analytics Shows Suspicious Net P&L Values

**Priority: Critical — financial aggregation audit**

In the original recording, the Sessions & Weekdays hourly breakdown showed trades and nonzero Average R values, but the displayed Net P&L was `$0.00` across visible rows.

### Required investigation

- Verify the hourly aggregation.
- Verify the source of Net P&L.
- Check realized versus gross P&L.
- Check fee and commission handling.
- Verify currency conversion.
- Verify timezone-based grouping.
- Compare the table against independently aggregated underlying trades.

Do not hide the P&L column to eliminate the discrepancy.

The result must match the authoritative financial engine.

## 2.4 New Trade Risk Summary Appears Inconsistent

**Priority: Critical — newly identified in the second recording**

The advanced New Trade wizard displays risk values that appear inconsistent across steps.

Visible examples include:

- Risk percentage displayed as `0.005` in the Risk & Sizing step.
- A risk amount of `$521.90` in the Confirm & Save step.
- A risk percentage of approximately `0.085%` in the confirmation summary.
- Another trade detail's Execution tab displays a risk percentage of `0.50%`.

These values may be affected by restored draft state, test data, an input-formatting problem, or an incorrect calculation/serialization path. The recording does not establish which.

### Required investigation

Trace the same calculation through:

1. Input state.
2. Risk calculation.
3. Risk amount formatting.
4. Risk percentage formatting.
5. Confirm & Save summary.
6. API payload.
7. Persisted trade.
8. Trade Detail.
9. Analytics.

Define the internal representation of risk percentages consistently.

For example:

- `0.5%` must not be confused with `0.005%`.
- A decimal ratio must not be displayed as a percentage without the correct conversion.
- Monetary risk must be calculated using the actual account balance and instrument specifications.

Add independent calculation tests.

The confirmation screen must not permit a trade to be saved when its financial summary contradicts the underlying calculated values.

## 2.5 Dashboard and Analytics Need a Shared Scope

**Priority: High**

The previous recording displayed different trade counts and P&L values between the Dashboard, Analytics and Accounts.

This may be explained by different date ranges or account scopes.

However, users should never need to guess why the figures differ.

### Required improvement

Introduce consistent filter context across analytical pages:

- Account.
- Date range.
- Instrument.
- Strategy.
- Strategy version.
- Direction.
- Trade status.
- Entry type.

Display a clear filter summary.

For example:

`FTMO Challenge · November 2026 · Closed Trades`

The Dashboard may use a different default period than Analytics, but the difference must be obvious.

Do not silently combine filtered and all-time values.

## 2.6 Maximum Drawdown Must Explain Unavailable Data

**Priority: High**

The overall analytics screen displayed Maximum Drawdown as N/A.

If historical equity data is incomplete, that may be the correct result.

However, explain why it is unavailable.

Possible reasons include:

- Missing account starting balance.
- Missing historical equity sequence.
- Missing closed-trade timestamps.
- Insufficient records.
- Unsupported equity adjustments.

If a valid calculation is possible, implement it.

Distinguish balance-based from equity-based drawdown.

## 2.7 Connect Accounts and Prop Firm Challenges Properly

**Priority: High**

The Accounts page shows a prop challenge account, while the Prop Firm Challenge Tracker can still show no active challenge trackers.

The second recording confirms that the challenge creation modal links a tracker to an account.

This is a good foundation, but the user-facing relationship should be stronger.

### Required workflow

1. Create or select a trading account.
2. Identify whether it is a normal account or prop challenge account.
3. Configure the challenge rules.
4. Link the challenge to the correct account.
5. Access the tracker from Tools.
6. Access the linked challenge from the account detail.
7. Maintain one authoritative challenge configuration.

Avoid requiring users to enter identical financial information in multiple places.

## 2.8 Prop Challenge Configuration Is Missing Visible Rule Controls

**Priority: Critical**

The second recording shows these challenge creation inputs:

- Account.
- Prop Firm.
- Tracker Name.
- Stage.
- Starting Balance.
- Profit Target.
- Daily Loss Limit.
- Maximum Drawdown.
- Drawdown Calculation.
- Minimum Trading Days.
- Daily Reset Timezone.
- Reset Hour.

However, the page description also mentions consistency requirements, while the visible creation form does not expose a consistency threshold.

### Required improvements

Support configurable:

- Consistency rule type.
- Consistency threshold.
- Calculation period.
- Maximum trading days.
- Minimum trading days.
- Daily loss calculation basis.
- Overall drawdown calculation basis.
- Reset behavior.
- Trailing drawdown reference behavior.
- Challenge end date, where applicable.

Do not assume all firms use the same rules.

A missing rule must not silently pass or fail a challenge.

## 2.9 Timezone and Market Clock Consistency

**Priority: High**

The first recording showed UTC selected in Preferences while the navbar displayed New York market time.

The second recording provides more context: the header clock displays a New York market-time popover with timezone and daylight-saving information.

That is useful.

However, separate these concepts explicitly:

- User display timezone.
- Market timezone.
- Prop firm challenge reset timezone.
- Trading session timezone.

Do not use one timezone setting for every calculation.

Date boundaries, trading cycles and daily risk limits must follow their applicable configured timezone.

## 2.10 Product Branding Consistency

**Priority: Medium**

The original recording contained legacy DnD wording in Settings.

The theme selector also displayed the old name Institutional Blue.

### Required correction

Search for outdated product names in:

- UI text.
- Theme names.
- Page titles.
- Tooltips.
- Empty states.
- Metadata.
- Backup descriptions.
- Email templates.
- Accessibility labels.

Use AlphaPips consistently.

Rename the third theme to Slate Contrast wherever necessary.

## 2.11 New Trade Draft State and Restoration

**Priority: High**

The second recording shows:

- A saved timestamp beside New Trade.
- A message explaining that an unsaved draft was restored.
- A Discard & Start Fresh action.

This is useful functionality.

However, the UI should make the restoration process more trustworthy.

### Required behavior

- Clearly distinguish autosaved drafts from finalized trades.
- Show the last successful save time.
- Make it clear which draft is being restored.
- Avoid restoring an old draft over a newer draft silently.
- Confirm before discarding meaningful unsaved work.
- Preserve the draft across refreshes and supported offline use.
- Clearly communicate when saving fails.

## 2.12 Dynamic Strategy Fields Must Be Conditional

**Priority: High**

The second recording confirms that Strategy Version editing includes a Dynamic Trade Information Fields section.

This supports:

- Weekly Bias.
- Daily Bias.
- Liquidity Targets.
- Market Structure.
- Entry Model.
- Custom field definitions.

This is good.

However, the Quick Entry advanced section also visibly showed ICT-specific parameters while the strategy selector displayed "No Strategy".

That creates a possible conditional-display problem.

### Required correction

- Load dynamic fields from the selected strategy/version.
- Do not present ICT-specific fields when no ICT strategy is selected.
- Do not force one methodology onto every trade.
- Show general trade fields when no strategy is selected.
- Preserve historical field definitions and values.
- Validate the field schema.
- Avoid breaking historical trades when newer strategy versions change field definitions.

Also consider replacing comma-separated option text with structured option management to prevent ambiguous option values and make editing easier.

## 2.13 Risk and Challenge Information Must Distinguish Data Sources

Do not label manually recorded equity, balance or P&L as live broker data.

Every financial monitor should make its source clear:

- Actual account record.
- Calculated from recorded trades.
- Manually entered.
- Last synchronized value.
- Currently unavailable.

A correct figure with an unclear source can still mislead users.

---

# PART III — DESIGN SYSTEM AND GLOBAL UI/UX ISSUES

## 3. Typography

Create three independent font roles:

1. Interface font.
2. Display/heading font.
3. Numerical/technical font.

Recommended defaults:

- Inter or Plus Jakarta Sans for interface text.
- Playfair Display for selected headings, if desired.
- JetBrains Mono for numerical values, if desired.

Do not make decorative serif typography mandatory throughout the trading workspace.

Use tabular numerals for aligned financial values.

## 3.2 Readability

Improve contrast for:

- Secondary labels.
- Placeholder text.
- Chart axes.
- Table headers.
- Dropdown items.
- Disabled controls.
- Helper text.

Financial values and chart information must be readable without zooming.

## 3.3 Consistent spacing and component sizing

Standardize:

- Page headers.
- Section titles.
- Card padding.
- Input heights.
- Button heights.
- Dialog widths.
- Border radii.
- Table density.
- Empty-state layouts.

Do not force every page to use the same content width.

## 3.4 Reduce repetitive card layouts

Use:

- KPI strips for core metrics.
- Tables for detailed comparisons.
- Charts for trends and distributions.
- Progress indicators for risk utilization.
- Expandable sections for less frequently used information.

Do not make every section another grid of eight metric cards.

## 3.5 Standardize page headers

Use a consistent hierarchy:

**Page title → Description → Primary action → Filters/context.**

Apply this to major pages and tools.

Eliminate duplicated page titles.

## 3.6 Improve loading and empty states

Three states must be visually distinct:

- Loading.
- Empty.
- Error.

Do not display `0 entries` before an initial request has completed.

Replace permanent skeleton-like empty states with meaningful empty-state content.

## 3.7 Consistent numbers and financial presentation

Use consistent:

- Decimal precision.
- Currency symbols.
- R formatting.
- Percentage formatting.
- Sign conventions.
- Positive and negative color semantics.
- Monetary alignment.

Do not mix display formatting with actual financial calculations.

## 3.8 Charts and tables

Improve chart-axis readability, tooltips, legends and labels.

Provide tabular alternatives where charts are difficult to interpret.

Do not rely on color alone to communicate winning and losing results.

---

# PART IV — PAGE-BY-PAGE AUDIT AND REQUIRED IMPROVEMENTS

## 4.1 Dashboard

### Existing strengths

- Date filters.
- Customize action.
- Net P&L.
- Win Rate.
- Average R.
- Trade Count.
- Profit Factor.
- Expectancy.
- Average Win/Loss.
- Equity Curve.
- Daily P&L.
- R Distribution.
- Supporting analytics.

### Improvements

1. Make the four most important metrics the visual priority.
2. Reduce repetitive KPI-card styling.
3. Clarify comparison with the previous period.
4. Improve chart-label readability.
5. Show active account/date filters.
6. Make data scope explicit.
7. Add relevant performance observations using actual data.
8. Provide links into Analytics and the contributing Trades Log records.

### Recommended order

1. Page header and period/account context.
2. Core performance metrics.
3. Equity Curve.
4. Daily performance.
5. R Distribution.
6. Instrument and strategy performance.
7. Behavior and rule information.
8. Recent trades.

Keep Dashboard widget customization.

## 4.2 Trades Log

### A. Separate Global Search from Journal Search

Global search searches the whole application.

Trades Log search searches only journal entries.

Use clear labels and placeholders.

### B. Improve Loading States

Show loading indicators instead of temporary false zero-result messages.

### C. Improve Table Information Hierarchy

The main table should prioritize:

- Date.
- Instrument.
- Entry Type.
- Direction.
- Strategy.
- Status or Reason.
- P&L.
- R.
- Adherence/Notes.

Keep additional filters and data available without forcing every metric into the default table.

### E. Advanced Filters

Support:

- Instrument.
- Date range.
- Session.
- Tags.
- Behavior flags.
- Entry type.
- Archived status where appropriate.

Use an expandable Advanced Filters area.

### F. Pagination

Keep the existing pagination foundation.

Ensure:

- Page size persists appropriately.
- Filter changes reset pagination.
- Search and pagination work together.
- Total counts reflect filtered records.

## 4.3 Trading Calendar

Improve:

- Month, Week and List views.
- Daily P&L, R and trade count presentation.
- Today cell styling.
- Daily detail modal.
- Direct access to trades.
- Daily notes and No-Trade Observations.
- Account, instrument and strategy filters.

Do not give observations artificial financial results.

## 4.4 Accounts

Create a clearer account overview.

Each account should communicate:

- Type.
- Name.
- Currency.
- Provider.
- Balance.
- Equity where available.
- Starting balance.
- Realized P&L.
- Unrealized P&L where supported.
- Trade count.
- Last updated status.
- Challenge linkage.

Provide an account detail page with:

- Overview.
- Performance.
- Trades.
- Risk Settings.
- Linked Challenge.
- Archive/Restore.

Preserve account history when archived.

## 4.5 Analytics Engine

Preserve the existing seven analytical areas:

1. Overall Metrics.
2. By Instrument.
3. By Setup & Strategy.
4. Time in Trade.
5. Checklist Adherence.
6. Rule Violations.
7. Sessions & Weekdays.

### Global filters

Use one coherent analytical scope:

- Date.
- Account.
- Instrument.
- Strategy.
- Strategy Version.
- Direction.
- Session.
- Entry type.
- Outcome.

### Metric explanations

Make calculation definitions accessible.

Show sample size and missing-data information.

### By Instrument

Show count, win rate, P&L, profit factor, expectancy and average R.

Allow drill-down into contributing trades.

### By Setup & Strategy

Show historical strategy attribution and version information.

Provide links to individual Strategy Detail and Version Comparison.

### Time in Trade

Improve chart labels and distribution presentation.

Show data coverage and actual closed-trade counts.

### Checklist Adherence

Use actual checklist responses, never win-rate proxies.

### Rule Violations

Show behavioral association without implying causation.

### Sessions & Weekdays

Separate session, weekday and hour-of-day analyses.

Use correct timezone and currency aggregation.

## 4.6 Setups & Checklists

Preserve the existing strategy cards but improve discoverability.

Add:

- Search.
- Market filter.
- Favorites.
- Sorting.
- Grid/list view.
- Current version indicator.
- Trade count.
- Relevant performance summary.

### Individual strategy structure

1. Overview & Active Rules.
2. Performance Analytics.
3. Version History.
4. Strategy Dictionary.

Keep strategy-specific Dynamic Trade Information Fields within strategy editing.

### Version Management

The second recording confirms that version creation already has:

- New version number.
- Change reason.
- Change summary.
- Checklist rule editing.
- Dynamic trade fields.
- Historical preservation messaging.

Preserve this good foundation.

Improve:

- Version comparison discoverability.
- Historical rule/field snapshots.
- Field definition editing.
- Structured options.
- Direct access to the exact trades attributed to a version.

Do not rewrite historical strategy versions when new versions are created.

## 4.7 Prop Firm Challenge Tracker

Remove the duplicated title.

Use one main page heading and one clear challenge creation action.

### Challenge list

Display:

- Firm.
- Account.
- Stage.
- Target progress.
- Daily loss remaining.
- Overall drawdown remaining.
- Trading days.
- Status.

### Individual challenge detail

1. Overview.
2. Daily Loss.
3. Maximum Drawdown.
4. Consistency.
5. Trading Days.
6. Profit Target.
7. Breach History.
8. Rules & Configuration.

Ensure the creation form exposes all necessary configurable rules.

Use one authoritative account/challenge relationship.

## 4.8 Position & Risk Calculator

Preserve the existing two-column layout.

The second recording demonstrates a useful position-sizing presentation:

- Risk budget.
- Account capital.
- Selected instrument.
- Direction.
- Entry.
- Stop loss.
- Target.
- Raw position size.
- Rounded position size.
- Actual monetary risk.
- Potential profit.
- Reward-to-risk ratio.
- Contract specifications.

Improve:

- Calculation assumptions.
- Currency-conversion transparency.
- Commission and spread assumptions.
- Rounding explanations.
- Saved scenarios, if useful.
- Transfer to New Trade without automatically submitting a trade.

Keep instrument-aware calculations authoritative.

## 4.9 Trading To-Do

Preserve the existing lists and templates:

- Inbox.
- Watchlist.
- Research.
- Execution.
- Routine.

Improve:

- Quick Add.
- Due dates.
- Priority.
- Optional instrument/strategy linkage.
- Task status.
- Search and filter.
- Completed tasks.
- Custom lists.
- List/board views.

Keep the application flexible.

Do not turn the To-Do application into a mandatory Daily Plan or standalone Review feature.

## 4.10 Preferences

Organize settings into:

1. Appearance.
2. Typography.
3. Layout and Density.
4. Keyboard Shortcuts.
5. Privacy.
6. Regional Settings.
7. Notifications.
8. Workspace.
9. Synchronization.

Use a sticky sub-navigation to avoid excessive scrolling.

Add live previews for fonts and density.

Keep all themes and existing fonts.

## 4.11 Archived Records

Improve:

- Genuine empty state.
- Search.
- Record-type filters.
- Original archive date.
- Restore controls.
- Access to historical record detail.
- Safe permanent deletion distinction.

Archiving must not alter historical analytics.

## 4.12 Backup / Restore

Improve:

- JSON backup integrity.
- CSV export.
- Backup metadata.
- Duplicate detection.
- Restore previews.
- Conflict inspection.
- Safe merge or restore modes.
- Transaction safety.
- Rollback/recovery.

Do not use browser-session storage as the only backup mechanism.

Clearly distinguish demo records from real trading records.

## 4.13 Multi-Panel Workspace

Preserve the existing multi-panel implementation.

The second recording confirms a usability issue: panels become too narrow when several are opened.

### Required behavior

- Default to two panels.
- Permit three panels on sufficiently wide screens.
- Allow larger layouts on ultra-wide displays.
- Enforce minimum usable widths.
- Maximize individual panels.
- Use tabs or focused panels on smaller displays.
- Preserve panel state and relevant filters.
- Make trade selection update linked Trade Detail where supported.

Do not compress entire application pages into unreadable narrow columns.

## 4.14 Floating Mini Widgets

Keep the approved collection:

1. Drawdown Monitor.
2. Quick Risk Calculator.
3. Daily Risk Limit.
4. Quick Notes.
5. Focus Timer.
6. Random Trading Tip.
7. Sticky Notes.

Improve resizing, placement, stacking, minimum sizes, mobile presentation, persistence and privacy masking.

Do not add more widget types.

## 4.15 Public Landing Page

Preserve the current premium dark navy/purple identity and light content design.

Correct sample-data labeling.

Verify the full page beyond the hero, responsive behavior, CTA links and product accuracy.

---

# PART V — RECOMMENDED INFORMATION ARCHITECTURE

Retain the overall sidebar concept but improve group naming and clarity.

## Recommended navigation

### OVERVIEW
- Dashboard

### JOURNAL
- Trades Log
- Trading Calendar

### ANALYZE
- Analytics Engine
- Setups & Checklists

### TOOLS
- Prop Challenges
- Risk Calculator
- Trading To-Do

### ACCOUNTS
- Accounts

### MANAGE
- Preferences
- Archived Records
- Backup / Restore

The account selector should remain available in the top navbar.

Workspace and Floating Widgets should remain accessible from the top toolbar.

## Features that should stay integrated rather than becoming separate destinations

- Favorites → Trades Log.
- No-Trade Observations → Trades Log.
- Strategy Analytics → Individual Strategy.
- Strategy Dictionary → Individual Strategy.
- Version History and Comparison → Individual Strategy.
- Trade Evidence → Individual Trade Detail.
- Execution Timeline → Trade Detail Replay.

This prevents unnecessary navigation complexity.

---

# PART VI — RECOMMENDED CONTENT AND WORKFLOWS

## 6.1 New Entry

Offer two choices:

- Log Executed Trade.
- Log No-Trade Observation.

### Executed Trade

Recommended sequence:

1. Trade Details.
2. Strategy & Checklist.
3. Risk & Sizing.
4. Partial Exits.
5. Confirm & Save.

Preserve the existing wizard.

Improve field consistency, dynamic strategy-specific inputs, risk calculations, draft restoration and final confirmation.

### No-Trade Observation

1. Instrument and timeframe.
2. Market observation.
3. Strategy or potential setup.
4. Reason for not entering.
5. Missing confirmation or invalidation conditions.
6. Psychology and notes.
7. Evidence.
8. Save.

Do not create fake Trade records.

## 6.2 Trade Detail

Preserve the existing six tabs:

- Overview.
- Setup.
- Execution.
- Replay.
- Psychology.
- Evidence.

The second video confirms that all six tabs already exist.

### Overview

Show:

- Trade identifiers.
- Results.
- Strategy and version.
- Trading thesis.
- Narrative.
- Account.
- Tags.
- Trade Notes.
- Lessons Learned.

Use the available screen width more effectively.

The current content occupies a narrow portion of a very wide desktop screen.

Use a wider, balanced layout with a clear summary section and appropriately distributed detail content.

### Setup

Show:

- Strategy.
- Version.
- Setup information.
- Market context.
- Strategy-specific fields.
- Checklist evaluation.
- Missing data explanations.

### Execution

Show:

- Entry/exit ledger.
- Partial exits.
- Planned versus actual.
- Position sizing.
- Costs.
- Risk metrics.
- Execution information.

### Replay — INCLUDE THE EXECUTION TIMELINE HERE

The second video confirms that Replay already includes:

- Execution playback controls.
- A playback timeline.
- Fill price.
- Active position.
- Realized P&L.
- Time of fill.
- Chronological execution flow.

Build upon this existing feature.

Add or improve:

- Full chronological execution timeline.
- Entry and exit events.
- Partial exit events.
- Stop adjustments.
- Position-size changes.
- Relevant fill prices and quantities.
- Event timestamps.
- Planned versus actual event comparison.
- Timeline markers.
- Synchronized playback.
- Clear playback status.
- Event-detail inspection.

The execution timeline belongs inside Replay.

Do not create another separate execution timeline elsewhere.

Only display events that actually exist in the recorded data.

### Psychology

Show:

- Emotional state.
- Behavior flags.
- Discipline information.
- Notes.
- Related contextual information.

### Evidence

Show the individual trade's evidence timeline.

Support screenshots, images and supported media types.

Preserve the trade-specific evidence model.

## 6.3 Strategy Detail

Use:

1. Overview & Active Rules.
2. Performance Analytics.
3. Version History.
4. Strategy Dictionary.

Provide direct access to contributing trades.

Keep version history immutable.

Preserve the useful small-sample warning observed in the second recording, but explain that any fixed trade-count threshold is a guidance threshold rather than proof of statistical significance.

## 6.4 Prop Challenge Detail

The user's first questions should be answered quickly:

- How much profit remains?
- How much daily loss allowance remains?
- How much maximum drawdown remains?
- How many required trading days are complete?
- Is consistency satisfied?
- What requirements remain?

Use a clear challenge overview before showing detailed rule settings.

## 6.5 Analytics Drill-Down

Allow users to move naturally:

1. Analytics result.
2. Selected instrument, strategy, session or behavior.
3. Filtered Trades Log.
4. Individual Trade Detail.
5. Related strategy or version.

Preserve the analytics filter scope when navigating where appropriate.

This is essential to making AlphaPips feel like a connected analytical product.

---

# PART VII — MISSING FEATURES AND HIGH-VALUE IMPROVEMENTS

These are the additional capabilities I recommend, beyond correcting and polishing existing screens.

## 7.1 Data Quality & Journal Completeness

Create a Data Quality area within Analytics or an appropriate existing management view.

Identify:

- Missing timestamps.
- Missing risk.
- Missing strategy.
- Missing account.
- Missing checklist data.
- Incomplete trade details.
- Potential duplicates.
- Missing optional information.

Show the number of complete and incomplete records.

Make fixes accessible from the relevant record.

Do not force optional fields to become mandatory.

## 7.2 Advanced Analytics Comparisons

Add:

- Period comparison.
- Account comparison.
- Instrument comparison.
- Strategy comparison.
- Strategy version comparison.
- Long versus Short analysis.
- Session comparison.
- Checklist completion comparison.
- Behavior-flag comparison.

Every comparison must use consistent metric definitions and display sample sizes.

Do not infer causation.

## 7.3 Equity and Drawdown Analysis

Expand historical risk analytics with:

- Equity curve.
- Maximum drawdown.
- Drawdown duration.
- Recovery time.
- Longest underwater period.
- Daily loss distribution.
- Losing streak analysis.
- Risk-per-trade distribution.

Use correctly defined balance/equity treatment.

## 7.4 Trade Execution Timeline — PLACE UNDER TRADE DETAIL → REPLAY

This feature is included in Part VI, section 6.2.

Improve the existing Replay timeline rather than creating a duplicate feature.

## 7.5 Broker CSV Import and Trade Reconciliation

Improve the existing import workflow with:

- Reusable column mappings.
- Broker presets.
- Duplicate identification.
- Partial-fill grouping.
- Import validation.
- Missing-data warnings.
- Import history.
- Batch rollback where safely supported.
- Matching imported trades with manually recorded entries.

## 7.6 Trading Knowledge Integration

Connect the strategy dictionary to:

- Strategy-specific custom fields.
- Trade creation.
- Trade Detail.
- Analytics drill-down.

Allow structured user-entered concepts to become searchable and analyzable.

Do not infer concepts from free-text notes without clearly identifying the inference.

## 7.7 Global Search Improvements

Search across:

- Trades.
- No-Trade Observations.
- Strategies.
- Strategy Versions.
- Dictionary Terms.
- Accounts.
- To-Do Tasks.
- Quick Notes.
- Sticky Notes.

Group results by type.

Show a meaningful result preview and navigate directly to the relevant item.

Keep Trades Log search as a separate scoped search.

---

# PART VIII — FIVE-PHASE IMPLEMENTATION PLAN

Do not implement everything in one unverified development run.

Follow these five phases in order.

Each phase must include repository inspection, actual implementation, regression tests, and an evidence-based report.

## PHASE 1 — FINANCIAL CORRECTNESS, DATA INTEGRITY & CORE VALIDATION

**Priority: Critical**

### Scope

Fix and verify:

1. Checklist Adherence calculation.
2. Rule Violation metric wording and interpretation.
3. Hourly Net P&L aggregation.
4. Dashboard versus Analytics filter-scope consistency.
5. Maximum Drawdown unavailable states and calculation.
6. New Trade Risk & Sizing calculation consistency.
7. Confirm & Save financial summary.
8. Strategy/account/challenge relationship.
9. Prop Challenge consistency configuration.
10. Timezone and reset behavior.
11. Product name and theme label consistency.
12. Data-source labeling for financial information.

### Dependencies

Inspect:

- Authoritative financial engine.
- Trade model and execution records.
- Checklist responses.
- Behavior flags.
- Account data.
- Challenge rules.
- Timezone handling.
- Analytics aggregation functions.

Do not begin visual redesign in this phase.

### Acceptance criteria

- All financial values have consistent source definitions.
- Calculations reconcile to underlying records.
- Checklist Adherence is not based on win rate.
- Hourly P&L matches independently aggregated trade results.
- Risk inputs, calculation outputs, save summary and Trade Detail agree.
- Missing data never produces falsely confident results.
- Challenge rules are explicit and configurable.
- Dashboard and Analytics scopes are understandable.
- All time-based calculations follow the correct timezone.

### Definition of done

No critical financial inconsistency remains unexplained or untested.

---

## PHASE 2 — JOURNAL WORKFLOW, NEW TRADE & TRADE DETAIL

**Priority: Critical**

### Scope

Improve the two most frequently used trading workflows.

#### A. New Trade

- Clarify Quick Entry versus Advanced Wizard.
- Preserve the existing five-step wizard.
- Make strategy-specific fields conditional.
- Remove unrelated hardcoded strategy concepts from the no-strategy state.
- Improve field validation.
- Improve autosave and draft restoration.
- Make Risk & Sizing transparent.
- Improve Confirm & Save.
- Eliminate confusing duplicate action presentation.
- Preserve historical strategy version attribution.

#### B. Unified Trades Log

- Preserve All Entries, Executed Trades, Observations and Favorites.
- Improve local search and global search distinction.
- Improve loading and empty states.
- Improve advanced filters.
- Improve pagination behavior.
- Improve table information hierarchy.
- Preserve saved presets.

#### C. Trade Detail

- Improve content layout and screen-space utilization.
- Preserve the six existing tabs.
- Ensure the full recorded information is visible.
- Improve strategy/version display.
- Improve notes and tag organization.
- Improve Psychology.
- Preserve trade-specific evidence.

#### D. Replay

Build on the existing Replay tab.

Improve:

- Playback controls.
- Execution event timeline.
- Entry and exit events.
- Partial exits.
- Stop adjustments.
- Planned versus actual comparisons.
- Event inspection.
- Playback accuracy.

#### E. Calendar

- Add Month, Week and List views.
- Improve daily detail.
- Add useful filters.
- Preserve observation/trade distinctions.

### Acceptance criteria

- No information is lost between creation and Trade Detail.
- Risk calculations remain consistent.
- Strategy-specific inputs are correctly selected.
- No-Trade Observations remain distinct from executed trades.
- Every Trade Detail tab displays the correct actual data.
- Replay shows the genuine chronological execution sequence.
- Journal filtering and pagination work together.

### Definition of done

A user can log a trade or observation, inspect it, understand it, and access its complete history without missing information.

---

## PHASE 3 — ANALYTICS, STRATEGY INTELLIGENCE & HISTORICAL PERFORMANCE

**Priority: High**

### Scope

#### A. Analytics Engine

- Shared filter architecture.
- Clear metric definitions.
- Correct financial aggregations.
- Sample-size warnings.
- Data-coverage indicators.
- Improved By Instrument analysis.
- Improved By Setup & Strategy analysis.
- Correct Checklist Adherence.
- Better Rule Violation analytics.
- Improved Sessions & Weekdays.

#### B. Strategy Detail

Preserve the existing:

- Overview & Active Rules.
- Performance Analytics.
- Version History.
- Strategy Dictionary.

Improve:

- Strategy organization.
- Current version visibility.
- Historical trade attribution.
- Analytics drill-down.
- Strategy-specific custom fields.
- Structured field option editing.
- Dictionary organization.

#### C. Strategy Comparison

Allow comparison of two versions.

Compare:

- Trade count.
- Win rate.
- Net P&L.
- Profit Factor.
- Expectancy.
- Average R.
- Average win/loss.
- Holding time.
- Checklist adherence where supported.
- Direction and instrument performance.

Display rule and field changes separately from performance results.

#### D. Data Quality & Journal Completeness

Create data-quality indicators and correction workflows.

#### E. Equity and Drawdown Analysis

Expand historical risk measurements.

#### F. Knowledge Integration

Connect strategy terminology with trade entry and trade detail.

### Acceptance criteria

- Every metric uses a documented definition.
- Historical version attribution remains immutable.
- No trade is duplicated between version cohorts.
- Missing information is not fabricated.
- Sample sizes are visible.
- Users can drill into the actual records behind metrics.

### Definition of done

AlphaPips provides reliable, traceable and understandable performance analysis.

---

## PHASE 4 — ACCOUNTS, TOOLS, SECONDARY WORKFLOWS & DATA MANAGEMENT

**Priority: High**

### Scope

#### A. Accounts

- Improve account overview.
- Improve account detail.
- Clearly show balance/equity sources.
- Connect accounts with prop challenges.
- Preserve archived account history.

#### B. Prop Challenges

- Remove duplicate page headings.
- Improve empty state.
- Improve challenge list.
- Improve individual challenge detail.
- Add configurable consistency rules.
- Improve daily loss and drawdown monitoring.
- Improve challenge status explanations.

#### C. Risk Calculator

- Preserve the existing layout.
- Clarify assumptions and specifications.
- Improve conversion transparency.
- Improve saved scenarios if useful.
- Ensure integration with New Trade is safe.

#### D. Trading To-Do

- Improve quick creation.
- Improve optional trading links.
- Improve priority and due-date organization.
- Improve completed-task organization.
- Preserve flexible task creation.

#### E. Backup / Restore

- Improve validation.
- Improve duplicate detection.
- Improve import preview.
- Improve merge and recovery safety.
- Improve broker CSV mappings.
- Add reconciliation and safe rollback functionality.

#### F. Archived Records

- Improve search.
- Improve restore operations.
- Improve historical access.
- Preserve all linked records.

#### G. Global Search

Improve cross-application discovery.

### Acceptance criteria

- Account and challenge information stays consistent.
- All challenge calculations follow configured rules.
- Risk Calculator values match instrument specifications.
- Task and archive relationships remain intact.
- Backup/restore does not duplicate or destroy data.
- Global search returns relevant actual records.

### Definition of done

All secondary modules feel integrated and provide reliable information and workflows.

---

## PHASE 5 — DESIGN SYSTEM, WORKSPACE USABILITY & FINAL PRODUCT STABILIZATION

**Priority: High**

### Scope

#### A. Global design system

- Interface/display/numerical font roles.
- Consistent typography hierarchy.
- Better contrast.
- Standardized spacing.
- Improved buttons and input sizing.
- Consistent page headers.
- Consistent loading, empty and error states.
- Better chart and table readability.

#### B. Dashboard

- Stronger metric hierarchy.
- Reduced KPI repetition.
- Clear filter scope.
- Better chart readability.
- Useful navigation into analytics.

#### C. Preferences

- Organized preferences navigation.
- Live font preview.
- Live density preview.
- Theme consistency.
- Privacy controls.
- Regional preferences.
- Keyboard shortcut management.
- Workspace settings.

#### D. Multi-Panel Workspace

- Two-panel default.
- Adaptive three-panel layouts.
- Minimum usable panel widths.
- Maximize individual panels.
- Better small-screen behavior.
- Reliable state persistence.

#### E. Floating Widgets

- Independent resizing.
- Position persistence.
- Collision prevention.
- Snap-to-edge.
- Accessible controls.
- Privacy masking.
- Responsive behavior.

Keep the approved seven widgets.

#### F. Landing Page

- Ensure accurate product representation.
- Clearly label illustrative sample data.
- Verify every CTA and route.
- Verify all responsive sections.

#### G. Full regression verification

Test:

- Desktop.
- Tablet.
- Mobile.
- All themes.
- All fonts.
- Privacy mode.
- Offline state.
- Workspace layout.
- All existing trading workflows.

### Acceptance criteria

- Readability is consistent.
- No narrow or compressed panels are forced on users.
- Floating widgets remain usable.
- All themes and typography roles work across the product.
- Navigation remains intuitive.
- Existing data and features remain intact.

### Definition of done

AlphaPips looks, behaves and feels like one coherent premium trading performance workstation.

---

# FINAL DEVELOPMENT GOVERNANCE

## Mandatory rules for all five phases

1. Inspect the actual repository before editing.
2. Inspect existing models and data before proposing migrations.
3. Never invent financial values.
4. Never use win rate as a proxy for checklist adherence.
5. Never imply behavioral causation from a simple correlation.
6. Preserve historical trade and strategy-version attribution.
7. Do not introduce standalone Daily Plans, Reviews, individual Trade Reviews or a Global Media Library.
8. Do not introduce duplicate versions of existing features.
9. Preserve the AlphaPips visual identity.
10. Preserve all three themes and available fonts.
11. Do not perform destructive database operations without explicit authorization.
12. Do not weaken tests to obtain passing results.
13. Do not report browser verification unless the workflow was actually tested.
14. Maintain a list of unresolved issues between phases.

## Required reporting format after every phase

For each phase report:

- Objective.
- Root causes identified.
- Files changed.
- Database changes.
- API changes.
- UI/UX changes.
- Tests executed.
- Exact test results.
- Browser verification.
- Known limitations.
- Outstanding risks.

Use these status labels:

- VERIFIED.
- IMPLEMENTED — NOT BROWSER VERIFIED.
- PARTIALLY IMPLEMENTED.
- BLOCKED.
- NOT IMPLEMENTED.

Do not start the next phase with unresolved critical data-integrity problems.

## FINAL PRODUCT DEFINITION

AlphaPips should become a connected trading performance environment where:

- Trading activity is captured accurately.
- Historical records remain accessible.
- Financial calculations are trustworthy.
- Strategy versions are traceable.
- Trading behavior is measurable without misleading claims.
- Analytics are easy to understand and investigate.
- Risk is monitored clearly.
- The interface is readable and adaptable.
- The workspace supports focused analysis.
- Data remains safe and recoverable.

**Prioritize trust, clarity, usability, and analytical correctness over the number of features added.**