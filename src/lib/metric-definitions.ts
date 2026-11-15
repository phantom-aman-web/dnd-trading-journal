/**
 * AlphaPips — Authoritative Metric Definitions
 *
 * Source of truth for analytical metrics across the application
 * (Analytics, Dashboard, Strategy Detail, and Performance Reports).
 *
 * Governing Specification: five-phase-upgrade.md § C1.3
 */

export interface MetricDefinition {
  id: string;
  name: string;
  shortLabel: string;
  category: "financial" | "risk" | "compliance" | "temporal";
  formula: string;
  description: string;
  includedRecords: string;
  excludedRecords: string;
  currencyTreatment: string;
  timezoneTreatment: string;
  missingDataBehavior: string;
  sampleSizeGuidance: string;
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  totalTrades: {
    id: "totalTrades",
    name: "Executed Trade Count",
    shortLabel: "Trades",
    category: "financial",
    formula: "Count of all executed trade records within the filter window",
    description: "The total number of closed and partial positions with recorded real execution fills.",
    includedRecords: "Closed positions (win, loss, breakeven) and partially closed positions with realized exits.",
    excludedRecords: "Planned trades with 0 fills, draft setups, and No-Trade observations.",
    currencyTreatment: "Dimensionless integer count.",
    timezoneTreatment: "Grouped by trade exit timestamp in the user's active display timezone.",
    missingDataBehavior: "Records without valid timestamps are excluded from time-bounded ranges.",
    sampleSizeGuidance: "N < 20 trades triggers small sample size warning flags.",
  },

  winRate: {
    id: "winRate",
    name: "Win Rate",
    shortLabel: "Win %",
    category: "financial",
    formula: "Winning Trades / (Winning Trades + Losing Trades)",
    description: "The percentage of decisive closed trades that generated positive net realized profit.",
    includedRecords: "Decisive closed trades (net P&L > 0 or net P&L < 0).",
    excludedRecords: "Breakeven trades (net P&L === 0), open positions, planned setups, No-Trade observations.",
    currencyTreatment: "Dimensionless percentage (0.0% to 100.0%).",
    timezoneTreatment: "Attributed to exit date.",
    missingDataBehavior: "If total decisive trades is 0, Win Rate displays as unavailable ('—') rather than 0%.",
    sampleSizeGuidance: "Requires at least 20 trades for statistical confidence.",
  },

  netPnl: {
    id: "netPnl",
    name: "Net Realized P&L",
    shortLabel: "Net P&L",
    category: "financial",
    formula: "Gross Realized P&L - (Fees + Commissions + Swap + Slippage)",
    description: "Total monetary profit or loss realized across closed and partially closed positions after all trading frictions.",
    includedRecords: "All realized exits (closed and partial trades).",
    excludedRecords: "Unrealized paper P&L of open positions, planned trades, No-Trade observations.",
    currencyTreatment: "Converted to account currency using explicit conversion rate at exit or reported in native currency when conversion is identity.",
    timezoneTreatment: "Attributed to trade exit time in user display timezone.",
    missingDataBehavior: "Unavailable conversion rates flag the metric as UNAVAILABLE instead of assuming 1:1.",
    sampleSizeGuidance: "Exact historical sum.",
  },

  grossPnl: {
    id: "grossPnl",
    name: "Gross Realized P&L",
    shortLabel: "Gross P&L",
    category: "financial",
    formula: "Σ ((Exit Price - Entry Price) × Exit Quantity × Point Value Cents × Direction Sign)",
    description: "Raw market price move profit or loss prior to deduction of fees, commissions, swap, and slippage.",
    includedRecords: "All matched entry-exit execution fills.",
    excludedRecords: "Open fills without corresponding exit fills, planned trades.",
    currencyTreatment: "Native instrument quote currency converted to account currency.",
    timezoneTreatment: "Attributed to exit fill timestamp.",
    missingDataBehavior: "Missing point values prevent calculation and flag unavailable.",
    sampleSizeGuidance: "Exact historical sum.",
  },

  profitFactor: {
    id: "profitFactor",
    name: "Profit Factor",
    shortLabel: "Profit Factor",
    category: "financial",
    formula: "Gross Profits / Gross Losses",
    description: "The ratio of gross winning dollars to gross losing dollars.",
    includedRecords: "All closed trades with non-zero gross P&L.",
    excludedRecords: "Breakeven trades, open positions, planned trades.",
    currencyTreatment: "Dimensionless ratio.",
    timezoneTreatment: "Attributed to exit time.",
    missingDataBehavior: "If gross losses are 0: displays '—' (or Infinity if gross profit > 0).",
    sampleSizeGuidance: "Values above 1.5 indicate positive edge with adequate sample size (N ≥ 20).",
  },

  expectancy: {
    id: "expectancy",
    name: "Expectancy (Average Return per Trade)",
    shortLabel: "Expectancy",
    category: "financial",
    formula: "(Win Rate × Average Win) - (Loss Rate × Average Loss)",
    description: "The expected average monetary or R gain per trade over a large statistical sample.",
    includedRecords: "All closed trades with realized net P&L and risk values.",
    excludedRecords: "Open positions, planned trades, observations.",
    currencyTreatment: "Reported in account currency or in R-multiples.",
    timezoneTreatment: "Attributed to exit time.",
    missingDataBehavior: "Displays '—' when decisive trade count is 0.",
    sampleSizeGuidance: "Highly sensitive to outliers when N < 30.",
  },

  avgR: {
    id: "avgR",
    name: "Average R (Risk Multiple)",
    shortLabel: "Avg R",
    category: "risk",
    formula: "Σ (Net P&L / Initial Planned Risk Budget) / Count of Trades with Risk",
    description: "The average multiple of initial risk achieved across trades.",
    includedRecords: "Trades with non-zero planned risk amount recorded at entry.",
    excludedRecords: "Trades without recorded stop-loss or planned risk, open positions, observations.",
    currencyTreatment: "Dimensionless ratio.",
    timezoneTreatment: "Attributed to exit time.",
    missingDataBehavior: "Trades without risk are omitted from the average; count of unrated trades is documented.",
    sampleSizeGuidance: "Consistent positive Avg R (> 0.3R) indicates sound risk-to-reward discipline.",
  },

  avgHoldTime: {
    id: "avgHoldTime",
    name: "Average Time in Trade",
    shortLabel: "Avg Hold Time",
    category: "temporal",
    formula: "Σ (Exit Time - Entry Time) / Count of Closed Trades with Timestamps",
    description: "The average duration a position was open in the market.",
    includedRecords: "Closed positions with valid entry and exit timestamps.",
    excludedRecords: "Open positions (strictly excluded to prevent downward survival bias), planned setups.",
    currencyTreatment: "Duration in minutes / hours / days.",
    timezoneTreatment: "Difference between UTC timestamps (independent of display timezone).",
    missingDataBehavior: "Trades with missing entry or exit timestamps are excluded from duration metrics.",
    sampleSizeGuidance: "Grouped into Scalp (<15m), Day (15m-4h), Swing (4h-24h), and Position (>24h).",
  },

  checklistAdherence: {
    id: "checklistAdherence",
    name: "Checklist Adherence",
    shortLabel: "Adherence %",
    category: "compliance",
    formula: "(Completed Applicable Required Items / Total Applicable Required Items) × 100",
    description: "Plan compliance metric measuring how strictly required execution rules were followed. Completely decoupled from win rate.",
    includedRecords: "Trades executed under a strategy with configured checklist rules and recorded checklist answers.",
    excludedRecords: "Trades without strategy, optional checklist rules (they do not penalize or inflate), observations.",
    currencyTreatment: "Dimensionless compliance percentage (0% to 100%).",
    timezoneTreatment: "Attributed to trade entry time.",
    missingDataBehavior: "Missing checklist answers are NOT treated as completed; they flag an explicit missing-data state.",
    sampleSizeGuidance: "Requires recorded checklist evaluations; shows evaluated trades count vs total trades.",
  },

  ruleViolationsCorrelation: {
    id: "ruleViolationsCorrelation",
    name: "Behavior Flag Performance Association",
    shortLabel: "Behavior Correlation",
    category: "compliance",
    formula: "Aggregate metrics for trades carrying specific behavior flags (FOMO, Revenge, Moved SL, etc.)",
    description: "Historical statistical association of recorded psychological and behavioral flags with trade performance. Strictly treated as correlation, not proof of causation.",
    includedRecords: "Closed trades tagged with one or more behavior flags.",
    excludedRecords: "Trades without flags.",
    currencyTreatment: "Standard account currency.",
    timezoneTreatment: "Attributed to exit time.",
    missingDataBehavior: "Untagged trades are treated as baseline compliant records.",
    sampleSizeGuidance: "Flag occurrences and percentage of recorded executed trades are explicitly shown.",
  },

  maxDrawdown: {
    id: "maxDrawdown",
    name: "Maximum Drawdown",
    shortLabel: "Max Drawdown",
    category: "risk",
    formula: "Max (Peak Cumulative Balance - Trough Cumulative Balance) / Peak Cumulative Balance × 100",
    description: "The maximum peak-to-trough decline in realized account capital over historical trade sequences.",
    includedRecords: "Realized closed-trade equity/balance series with starting balance.",
    excludedRecords: "Unrealized intra-bar equity swings (unless explicitly captured in high-water mark snapshots).",
    currencyTreatment: "Account currency. Mixed currency accounts without exchange rates display unavailable.",
    timezoneTreatment: "Chronologically ordered by exit timestamp.",
    missingDataBehavior: "If initial account starting balance is unknown, drawdown percentage displays as unavailable.",
    sampleSizeGuidance: "Includes current drawdown and historical maximum.",
  },

  drawdownRecovery: {
    id: "drawdownRecovery",
    name: "Drawdown Recovery & Underwater Period",
    shortLabel: "Recovery Time",
    category: "risk",
    formula: "Duration from peak balance to the point where capital returns to or exceeds the prior peak",
    description: "Measures the duration and number of trades required to recover from capital drawdowns.",
    includedRecords: "Closed trade balance curve.",
    excludedRecords: "Active unrecovered drawdowns (reported as 'Currently in drawdown').",
    currencyTreatment: "Duration in days or trade count.",
    timezoneTreatment: "Exit timestamp timeline.",
    missingDataBehavior: "Unrecovered troughs report duration-to-date.",
    sampleSizeGuidance: "Identifies longest underwater period across historical trading.",
  },
};
