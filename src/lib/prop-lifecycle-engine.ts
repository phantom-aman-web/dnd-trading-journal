/**
 * AlphaPips — Prop Firm Account Lifecycle, Compliance & Failure Diagnosis Engine
 *
 * Implements comprehensive multi-model prop firm tracking:
 * - One-step, two-step, multi-step, instant funded, direct funded, custom models
 * - Flexible phase management (evaluation vs funded, sequences, transitions)
 * - Versioned rules with status (passed, violated, at_risk, unknown, unverified, not_applicable)
 * - Complete failure diagnosis (exact threshold, actual value, amount exceeded, contributing trades, firm timezone)
 * - Undisclosed firm rejections & dispute investigation workflows
 * - Payout eligibility, profit splits, request history, net profit retention
 * - Aggregated comparison analytics across firms, models, and sizes
 */

import { getTradingCycleKey, type ConsistencyAction } from "./prop-firm-engine";

// ---------------------------------------------------------------------------
// Model & Lifecycle Types
// ---------------------------------------------------------------------------

export type PropAccountModel =
  | "one_step"
  | "two_step"
  | "multi_step"
  | "instant_funded"
  | "direct_funded"
  | "custom";

export type PropLifecycleStatus =
  | "in_progress"
  | "passed"
  | "failed"
  | "breached"
  | "awaiting_verification"
  | "awaiting_activation"
  | "funded"
  | "suspended"
  | "terminated";

export type PropPhaseType = "evaluation" | "funded";

export type RuleCategory =
  | "target"
  | "drawdown"
  | "daily_loss"
  | "trading_behavior"
  | "risk_management"
  | "holding"
  | "consistency"
  | "payout"
  | "custom";

export type RuleStatus =
  | "passed"
  | "violated"
  | "at_risk"
  | "unknown"
  | "unverified"
  | "not_applicable";

export type RuleSeverity = "hard_breach" | "soft_breach" | "warning" | "dispute";

// ---------------------------------------------------------------------------
// Rule Definitions & Configurations
// ---------------------------------------------------------------------------

export interface PropRuleConfig {
  threshold?: number | string | boolean | null;
  unit?: string;
  windowMinutes?: number;
  maxLot?: number;
  maxRiskPct?: number;
  inactivityDays?: number;
  drawdownBasis?: "balance" | "equity";
  drawdownType?: "static" | "trailing";
  customText?: string;
  consistencyAction?: ConsistencyAction;
  minProfitPerDayCents?: number;
  waitingPeriodDays?: number;
}

export interface PropRuleDefinition {
  id: string;
  ruleKey: string;
  category: RuleCategory;
  name: string;
  description: string;
  ruleSource: "firm_contract" | "challenge_terms" | "manual_custom" | "firm_dispute";
  config: PropRuleConfig;
  calculationMethod: string;
  status: RuleStatus;
  lastEvaluatedAt: string;
  statusExplanation?: string;
}

// ---------------------------------------------------------------------------
// Phase & Violation Data Structures
// ---------------------------------------------------------------------------

export interface PropPhaseSnapshot {
  phaseId: string;
  phaseName: string;
  sequence: number;
  completedAt: string;
  startingBalanceCents: number;
  finalBalanceCents: number;
  finalEquityCents: number;
  netProfitCents: number;
  tradeCount: number;
  winRate: number;
  profitFactor: number | string | null;
  tradingDaysCount?: number;
  status: PropLifecycleStatus;
  rulesPassedCount: number;
  rulesTotalCount: number;
  rules?: PropRuleDefinition[];
  calculationMethods?: {
    drawdownType: "static" | "trailing";
    drawdownBasis: "balance" | "equity";
  };
  resetConfig?: {
    timezone: string;
    resetHour: number;
  };
  ruleSourceVersion?: string;
}

export interface PropPhaseConfig {
  id: string;
  sequence: number;
  name: string;
  phaseType: PropPhaseType;
  status: PropLifecycleStatus;
  startingBalanceCents: number;
  profitTargetCents: number | null;
  profitTargetPct?: number | null;
  dailyLossLimitCents: number | null;
  dailyLossLimitPct?: number | null;
  maxDrawdownCents: number | null;
  maxDrawdownPct?: number | null;
  drawdownType: "static" | "trailing";
  drawdownBasis: "balance" | "equity";
  minTradingDays: number | null;
  maxTradingDays: number | null;
  startDate: string;
  endDate?: string | null;
  completedAt?: string | null;
  rules: PropRuleDefinition[];
  snapshot?: PropPhaseSnapshot;
  tradingAccountId?: string;
  fundedAccountName?: string;
  activationDate?: string;
  payoutsReceivedCents?: number;
  fundedStatus?: "active" | "passed" | "closed" | "suspended" | "breached";
}

export interface PropViolationRecord {
  id: string;
  ruleId: string;
  ruleKey: string;
  ruleName: string;
  category: RuleCategory;
  severity: RuleSeverity;
  occurredAt: string;
  firmTimezone: string;
  requiredThreshold: string;
  actualValue: string;
  amountExceeded: string;
  relevantBalanceCents: number;
  contributingTradeIds: string[];
  calculationExplanation: string;
  ruleConfigSnapshot: PropRuleConfig;
  firmRejectionReason?: string;
  manualNotes?: string;
  isUserVerified: boolean;
  supportingEvidence?: Array<{ name: string; url?: string; note?: string }>;
}

export interface PropPayoutRecord {
  id: string;
  requestedAt: string;
  amountCents: number;
  netTraderPayoutCents: number;
  firmSplitCents: number;
  status: "requested" | "approved" | "rejected" | "paid";
  processedAt?: string | null;
  notes?: string;
  rejectionReason?: string;
  transactionRef?: string;
}

export interface PropLifecycleEvent {
  id: string;
  timestamp: string;
  type:
    | "created"
    | "activated"
    | "phase_started"
    | "trade_milestone"
    | "warning"
    | "violation"
    | "phase_passed"
    | "phase_transition"
    | "funded_activated"
    | "payout_eligible"
    | "payout_requested"
    | "payout_approved"
    | "payout_paid"
    | "suspended"
    | "terminated"
    | "firm_rejection";
  title: string;
  description: string;
  metadata?: any;
}

// ---------------------------------------------------------------------------
// Complete Metadata Schema
// ---------------------------------------------------------------------------

export interface PropLifecycleMetadata {
  __format: "alphapips_prop_lifecycle_v2";
  userNotes: string;
  accountModel: PropAccountModel;
  customPhaseCount?: number;
  accountCostCents?: number; // fee paid to firm
  currentPhaseId: string;
  phases: PropPhaseConfig[];
  violations: PropViolationRecord[];
  payoutConfig: {
    profitSplitPct: number;
    minPayoutCents: number;
    waitingPeriodDays: number;
    minProfitableDays: number;
    withdrawalLimitCents?: number | null;
  };
  payouts: PropPayoutRecord[];
  events: PropLifecycleEvent[];
  isFirmDispute: boolean;
  firmRejectionDetails?: {
    date: string;
    firmCommunication: string;
    undisclosedRuleName?: string;
    userVerified: boolean;
    documents?: string[];
  };
}

// ---------------------------------------------------------------------------
// Trade Interface for Lifecycle Engine
// ---------------------------------------------------------------------------

export interface TradeForLifecycle {
  id: string;
  netPnlCents: number;
  entryTime: string | Date | null;
  exitTime: string | Date | null;
  status: string; // "open" | "closed" | "win" | "loss" | "breakeven" | "planned"
  isDraft?: boolean;
  positionSize?: string | number | null;
  plannedRiskAmountCents?: number | null;
  plannedRiskPct?: string | number | null;
  newsEvent?: string | null;
  instrumentSymbol?: string | null;
  tagsJson?: string | null;
  notes?: string | null;
}

export function isSyntheticSampleTrade(t: { tagsJson?: string | null; notes?: string | null }): boolean {
  if (t.tagsJson) {
    try {
      const tags = typeof t.tagsJson === "string" ? JSON.parse(t.tagsJson) : t.tagsJson;
      if (Array.isArray(tags)) {
        if (tags.includes("synthetic_sample") || tags.includes("apex_repair_isolation")) return true;
      }
    } catch {
      if (t.tagsJson.includes("synthetic_sample") || t.tagsJson.includes("apex_repair_isolation")) return true;
    }
  }
  if (t.notes && (t.notes.includes("SYNTHETIC_SAMPLE") || t.notes.includes("apex_repair_isolation"))) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Default Phase & Rule Builders
// ---------------------------------------------------------------------------

export function generateDefaultRulesForPhase(
  phaseType: PropPhaseType,
  phaseStartingBalanceCents: number,
  overrides?: {
    profitTargetCents?: number | null;
    dailyLossLimitCents?: number | null;
    dailyLossLimitPct?: number | null;
    maxDrawdownCents?: number | null;
    maxDrawdownPct?: number | null;
    drawdownType?: "static" | "trailing";
    drawdownBasis?: "balance" | "equity";
    minTradingDays?: number | null;
    maxTradingDays?: number | null;
    consistencyThresholdPct?: number | null;
    consistencyAction?: ConsistencyAction;
    newsTradingAllowed?: boolean;
    weekendHoldingAllowed?: boolean;
    overnightHoldingAllowed?: boolean;
    maxLot?: number;
    maxRiskPct?: number;
    inactivityDays?: number;
  }
): PropRuleDefinition[] {
  const isFunded = phaseType === "funded";
  const nowStr = new Date().toISOString();

  const rules: PropRuleDefinition[] = [];

  // 1. Profit Target (Evaluation phases only)
  if (!isFunded || (overrides?.profitTargetCents && overrides.profitTargetCents > 0)) {
    const targetCents = overrides?.profitTargetCents ?? Math.round(phaseStartingBalanceCents * 0.1);
    rules.push({
      id: `rule_target_${Date.now()}_1`,
      ruleKey: "profit_target",
      category: "target",
      name: "Profit Target",
      description: `Reach target net profit of $${(targetCents / 100).toLocaleString()}`,
      ruleSource: "challenge_terms",
      config: {
        threshold: targetCents,
        unit: "cents",
      },
      calculationMethod: "Real-time realized + unrealized net P&L accumulation",
      status: "at_risk",
      lastEvaluatedAt: nowStr,
    });
  }

  // 2. Daily Loss Limit
  const dailyLossCents = overrides?.dailyLossLimitCents
    ?? (overrides?.dailyLossLimitPct ? Math.round(phaseStartingBalanceCents * (overrides.dailyLossLimitPct / 100)) : Math.round(phaseStartingBalanceCents * 0.05));
  rules.push({
    id: `rule_daily_loss_${Date.now()}_2`,
    ruleKey: "daily_loss",
    category: "daily_loss",
    name: "Daily Loss Limit",
    description: `Maximum allowable loss of $${(dailyLossCents / 100).toLocaleString()} in any single trading day cycle`,
    ruleSource: "firm_contract",
    config: {
      threshold: dailyLossCents,
      unit: "cents",
      drawdownBasis: overrides?.drawdownBasis ?? "balance",
    },
    calculationMethod: "Trading cycle reset (firm timezone hour). Cumulative day loss compared against threshold.",
    status: "passed",
    lastEvaluatedAt: nowStr,
  });

  // 3. Maximum Drawdown
  const maxDrawdownCents = overrides?.maxDrawdownCents
    ?? (overrides?.maxDrawdownPct ? Math.round(phaseStartingBalanceCents * (overrides.maxDrawdownPct / 100)) : Math.round(phaseStartingBalanceCents * 0.1));
  const ddType = overrides?.drawdownType ?? "static";
  rules.push({
    id: `rule_drawdown_${Date.now()}_3`,
    ruleKey: "max_drawdown",
    category: "drawdown",
    name: ddType === "trailing" ? "Maximum Trailing Drawdown" : "Maximum Overall Drawdown",
    description: `Maximum allowable drawdown of $${(maxDrawdownCents / 100).toLocaleString()} (${ddType})`,
    ruleSource: "firm_contract",
    config: {
      threshold: maxDrawdownCents,
      unit: "cents",
      drawdownType: ddType,
      drawdownBasis: overrides?.drawdownBasis ?? "balance",
    },
    calculationMethod: ddType === "trailing"
      ? "Calculated from peak high-water mark to lowest equity/balance"
      : "Calculated from initial starting balance",
    status: "passed",
    lastEvaluatedAt: nowStr,
  });

  // 4. Minimum Trading Days
  if (!isFunded && (overrides?.minTradingDays ?? 4) > 0) {
    const minDays = overrides?.minTradingDays ?? 4;
    rules.push({
      id: `rule_min_days_${Date.now()}_4`,
      ruleKey: "min_trading_days",
      category: "trading_behavior",
      name: "Minimum Trading Days",
      description: `Execute trades across at least ${minDays} distinct trading cycles`,
      ruleSource: "challenge_terms",
      config: {
        threshold: minDays,
        unit: "days",
      },
      calculationMethod: "Count of unique trading cycles with closed or active trades",
      status: "at_risk",
      lastEvaluatedAt: nowStr,
    });
  }

  // 5. Maximum Trading Days / Time Limit
  if (overrides?.maxTradingDays && overrides.maxTradingDays > 0) {
    rules.push({
      id: `rule_max_days_${Date.now()}_5`,
      ruleKey: "max_trading_days",
      category: "trading_behavior",
      name: "Maximum Trading Days",
      description: `Complete the phase within ${overrides.maxTradingDays} days`,
      ruleSource: "challenge_terms",
      config: {
        threshold: overrides.maxTradingDays,
        unit: "days",
      },
      calculationMethod: "Calendar days elapsed since phase start date",
      status: "passed",
      lastEvaluatedAt: nowStr,
    });
  }

  // 6. Consistency Rule
  if (overrides?.consistencyThresholdPct && overrides.consistencyThresholdPct > 0) {
    const cAction = overrides.consistencyAction ?? "dilution_required";
    rules.push({
      id: `rule_consistency_${Date.now()}_6`,
      ruleKey: "consistency",
      category: "consistency",
      name: "Profit Consistency Rule",
      description: `No single trading day may generate more than ${overrides.consistencyThresholdPct}% of total net profit`,
      ruleSource: "firm_contract",
      config: {
        threshold: overrides.consistencyThresholdPct,
        unit: "percentage",
        consistencyAction: cAction,
      },
      calculationMethod: "Highest day profit divided by total accumulated net profit",
      status: "passed",
      lastEvaluatedAt: nowStr,
    });
  }

  // 7. News Trading Restrictions
  rules.push({
    id: `rule_news_${Date.now()}_7`,
    ruleKey: "news_trading",
    category: "trading_behavior",
    name: "News Trading Restriction",
    description: overrides?.newsTradingAllowed ? "News trading permitted without restriction" : "No opening or closing trades ±2 minutes around high-impact news",
    ruleSource: "firm_contract",
    config: {
      threshold: overrides?.newsTradingAllowed ?? true,
      windowMinutes: 2,
    },
    calculationMethod: "Execution timestamps compared against high-impact economic releases",
    status: overrides?.newsTradingAllowed ? "not_applicable" : "passed",
    lastEvaluatedAt: nowStr,
  });

  // 8. Weekend Holding
  rules.push({
    id: `rule_weekend_${Date.now()}_8`,
    ruleKey: "weekend_holding",
    category: "holding",
    name: "Weekend Holding",
    description: overrides?.weekendHoldingAllowed ? "Weekend holding allowed" : "All positions must be closed before Friday market close",
    ruleSource: "firm_contract",
    config: {
      threshold: overrides?.weekendHoldingAllowed ?? true,
    },
    calculationMethod: "Open position state evaluated between Friday 17:00 NY and Sunday 17:00 NY",
    status: overrides?.weekendHoldingAllowed ? "not_applicable" : "passed",
    lastEvaluatedAt: nowStr,
  });

  // 9. Overnight Holding
  rules.push({
    id: `rule_overnight_${Date.now()}_9`,
    ruleKey: "overnight_holding",
    category: "holding",
    name: "Overnight Holding",
    description: overrides?.overnightHoldingAllowed ? "Overnight holding allowed" : "All positions must be closed before daily market reset",
    ruleSource: "firm_contract",
    config: {
      threshold: overrides?.overnightHoldingAllowed ?? true,
    },
    calculationMethod: "Open position state evaluated at daily cycle reset hour",
    status: overrides?.overnightHoldingAllowed ? "not_applicable" : "passed",
    lastEvaluatedAt: nowStr,
  });

  // 10. Maximum Lot Size / Position Size
  if (overrides?.maxLot && overrides.maxLot > 0) {
    rules.push({
      id: `rule_max_lot_${Date.now()}_10`,
      ruleKey: "max_lot_size",
      category: "risk_management",
      name: "Maximum Position Size",
      description: `Total open volume cannot exceed ${overrides.maxLot} lots`,
      ruleSource: "firm_contract",
      config: {
        threshold: overrides.maxLot,
        unit: "lots",
      },
      calculationMethod: "Aggregate open position lot size sum",
      status: "passed",
      lastEvaluatedAt: nowStr,
    });
  }

  // 11. Maximum Risk Per Trade
  if (overrides?.maxRiskPct && overrides.maxRiskPct > 0) {
    rules.push({
      id: `rule_risk_per_trade_${Date.now()}_11`,
      ruleKey: "risk_per_trade",
      category: "risk_management",
      name: "Maximum Risk Per Trade",
      description: `Maximum stop-loss risk cannot exceed ${overrides.maxRiskPct}% of starting balance`,
      ruleSource: "firm_contract",
      config: {
        threshold: overrides.maxRiskPct,
        unit: "percentage",
      },
      calculationMethod: "Planned stop-loss monetary distance divided by initial balance",
      status: "passed",
      lastEvaluatedAt: nowStr,
    });
  }

  // 12. Inactivity Restriction
  const inactivityDays = overrides?.inactivityDays ?? 30;
  rules.push({
    id: `rule_inactivity_${Date.now()}_12`,
    ruleKey: "inactivity_limit",
    category: "trading_behavior",
    name: "Account Inactivity Limit",
    description: `Account expires if no trade is placed for ${inactivityDays} consecutive days`,
    ruleSource: "firm_contract",
    config: {
      threshold: inactivityDays,
      unit: "days",
    },
    calculationMethod: "Calendar days between most recent trade exit/entry and current date",
    status: "passed",
    lastEvaluatedAt: nowStr,
  });

  // 13. Copy Trading Verification
  rules.push({
    id: `rule_copy_trading_${Date.now()}_13`,
    ruleKey: "copy_trading",
    category: "trading_behavior",
    name: "Third-Party Copy Trading Check",
    description: "Account must be independently traded without unapproved signal mirroring",
    ruleSource: "firm_contract",
    config: {
      threshold: "independent",
    },
    calculationMethod: "External firm audit — broker trade execution cluster verification",
    status: "unverified", // CANNOT verify copy trading locally — must NEVER label passed!
    lastEvaluatedAt: nowStr,
    statusExplanation: "Copy trading compliance is audited externally by the prop firm. Not established by local data.",
  });

  // 14. Payout Eligibility Conditions (Funded Phase Only)
  if (isFunded) {
    rules.push({
      id: `rule_payout_${Date.now()}_14`,
      ruleKey: "payout_conditions",
      category: "payout",
      name: "Payout Eligibility",
      description: "Minimum 14 days active with positive net profit and no active rule breaches",
      ruleSource: "firm_contract",
      config: {
        minProfitPerDayCents: 10000,
        waitingPeriodDays: 14,
      },
      calculationMethod: "Funded account tenure, net profit buffer, and compliance status",
      status: "at_risk",
      lastEvaluatedAt: nowStr,
    });
  }

  return rules;
}

export function generateDefaultPhasesForModel(
  model: PropAccountModel,
  baseConfig: {
    startingBalanceCents: number;
    profitTargetCents?: number | null;
    dailyLossLimitCents?: number | null;
    dailyLossLimitPct?: number | null;
    maxDrawdownCents?: number | null;
    maxDrawdownPct?: number | null;
    drawdownType?: "static" | "trailing";
    drawdownBasis?: "balance" | "equity";
    minTradingDays?: number | null;
    maxTradingDays?: number | null;
    consistencyThresholdPct?: number | null;
    consistencyAction?: ConsistencyAction;
    startDate: string;
    customPhaseCount?: number;
  }
): PropPhaseConfig[] {
  const balance = baseConfig.startingBalanceCents;
  const start = baseConfig.startDate;

  if (model === "instant_funded" || model === "direct_funded") {
    // Single funded phase immediately
    return [
      {
        id: "phase_funded_1",
        sequence: 1,
        name: "Funded Stage",
        phaseType: "funded",
        status: "in_progress",
        startingBalanceCents: balance,
        profitTargetCents: null,
        dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.05),
        dailyLossLimitPct: baseConfig.dailyLossLimitPct ?? 5,
        maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.1),
        maxDrawdownPct: baseConfig.maxDrawdownPct ?? 10,
        drawdownType: baseConfig.drawdownType ?? "static",
        drawdownBasis: baseConfig.drawdownBasis ?? "balance",
        minTradingDays: null,
        maxTradingDays: null,
        startDate: start,
        rules: generateDefaultRulesForPhase("funded", balance, {
          ...baseConfig,
          profitTargetCents: null,
        }),
      },
    ];
  }

  if (model === "one_step") {
    // 1 evaluation phase -> funded
    return [
      {
        id: "phase_eval_1",
        sequence: 1,
        name: "Evaluation Phase",
        phaseType: "evaluation",
        status: "in_progress",
        startingBalanceCents: balance,
        profitTargetCents: baseConfig.profitTargetCents ?? Math.round(balance * 0.1),
        profitTargetPct: 10,
        dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.04),
        dailyLossLimitPct: baseConfig.dailyLossLimitPct ?? 4,
        maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.06),
        maxDrawdownPct: baseConfig.maxDrawdownPct ?? 6,
        drawdownType: baseConfig.drawdownType ?? "trailing",
        drawdownBasis: baseConfig.drawdownBasis ?? "balance",
        minTradingDays: baseConfig.minTradingDays ?? 3,
        maxTradingDays: baseConfig.maxTradingDays ?? null,
        startDate: start,
        rules: generateDefaultRulesForPhase("evaluation", balance, baseConfig),
      },
      {
        id: "phase_funded_2",
        sequence: 2,
        name: "Funded Stage",
        phaseType: "funded",
        status: "awaiting_activation",
        startingBalanceCents: balance,
        profitTargetCents: null,
        dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.04),
        dailyLossLimitPct: 4,
        maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.06),
        maxDrawdownPct: 6,
        drawdownType: baseConfig.drawdownType ?? "trailing",
        drawdownBasis: baseConfig.drawdownBasis ?? "balance",
        minTradingDays: null,
        maxTradingDays: null,
        startDate: start,
        rules: generateDefaultRulesForPhase("funded", balance, {
          ...baseConfig,
          profitTargetCents: null,
        }),
      },
    ];
  }

  if (model === "multi_step") {
    const phaseCount = Math.max(3, baseConfig.customPhaseCount || 3);
    const phases: PropPhaseConfig[] = [];
    for (let i = 1; i <= phaseCount; i++) {
      const isLast = i === phaseCount;
      const targetPct = i === 1 ? 8 : i === 2 ? 5 : isLast ? null : 5;
      phases.push({
        id: `phase_step_${i}`,
        sequence: i,
        name: isLast ? "Funded Stage" : `Phase ${i}: Step ${i}`,
        phaseType: isLast ? "funded" : "evaluation",
        status: i === 1 ? "in_progress" : "awaiting_activation",
        startingBalanceCents: balance,
        profitTargetCents: targetPct ? Math.round(balance * (targetPct / 100)) : null,
        profitTargetPct: targetPct,
        dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.05),
        dailyLossLimitPct: baseConfig.dailyLossLimitPct ?? 5,
        maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.1),
        maxDrawdownPct: baseConfig.maxDrawdownPct ?? 10,
        drawdownType: baseConfig.drawdownType ?? "static",
        drawdownBasis: baseConfig.drawdownBasis ?? "balance",
        minTradingDays: isLast ? null : (baseConfig.minTradingDays ?? 4),
        maxTradingDays: isLast ? null : (baseConfig.maxTradingDays ?? null),
        startDate: start,
        rules: generateDefaultRulesForPhase(isLast ? "funded" : "evaluation", balance, {
          ...baseConfig,
          profitTargetCents: targetPct ? Math.round(balance * (targetPct / 100)) : null,
        }),
      });
    }
    return phases;
  }

  if (model === "custom") {
    const phaseCount = Math.max(1, baseConfig.customPhaseCount || 1);
    const phases: PropPhaseConfig[] = [];
    for (let i = 1; i <= phaseCount; i++) {
      phases.push({
        id: `phase_custom_${i}`,
        sequence: i,
        name: phaseCount === 1 ? "Custom Evaluation Phase" : `Custom Phase ${i}`,
        phaseType: "evaluation",
        status: i === 1 ? "in_progress" : "awaiting_activation",
        startingBalanceCents: balance,
        profitTargetCents: baseConfig.profitTargetCents ?? Math.round(balance * 0.1),
        profitTargetPct: baseConfig.profitTargetCents ? Math.round((baseConfig.profitTargetCents / balance) * 100) : 10,
        dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.05),
        dailyLossLimitPct: baseConfig.dailyLossLimitPct ?? 5,
        maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.1),
        maxDrawdownPct: baseConfig.maxDrawdownPct ?? 10,
        drawdownType: baseConfig.drawdownType ?? "static",
        drawdownBasis: baseConfig.drawdownBasis ?? "balance",
        minTradingDays: baseConfig.minTradingDays ?? 4,
        maxTradingDays: baseConfig.maxTradingDays ?? null,
        startDate: start,
        rules: generateDefaultRulesForPhase("evaluation", balance, baseConfig),
      });
    }
    phases.push({
      id: `phase_funded_${phaseCount + 1}`,
      sequence: phaseCount + 1,
      name: "Funded Stage",
      phaseType: "funded",
      status: "awaiting_activation",
      startingBalanceCents: balance,
      profitTargetCents: null,
      dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.05),
      dailyLossLimitPct: baseConfig.dailyLossLimitPct ?? 5,
      maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.1),
      maxDrawdownPct: baseConfig.maxDrawdownPct ?? 10,
      drawdownType: baseConfig.drawdownType ?? "static",
      drawdownBasis: baseConfig.drawdownBasis ?? "balance",
      minTradingDays: null,
      maxTradingDays: null,
      startDate: start,
      rules: generateDefaultRulesForPhase("funded", balance, {
        ...baseConfig,
        profitTargetCents: null,
      }),
    });
    return phases;
  }

  // Default: two_step (FTMO standard)
  return [
    {
      id: "phase_1",
      sequence: 1,
      name: "Phase 1: Student",
      phaseType: "evaluation",
      status: "in_progress",
      startingBalanceCents: balance,
      profitTargetCents: baseConfig.profitTargetCents ?? Math.round(balance * 0.1),
      profitTargetPct: 10,
      dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.05),
      dailyLossLimitPct: baseConfig.dailyLossLimitPct ?? 5,
      maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.1),
      maxDrawdownPct: baseConfig.maxDrawdownPct ?? 10,
      drawdownType: baseConfig.drawdownType ?? "static",
      drawdownBasis: baseConfig.drawdownBasis ?? "balance",
      minTradingDays: baseConfig.minTradingDays ?? 4,
      maxTradingDays: baseConfig.maxTradingDays ?? null,
      startDate: start,
      rules: generateDefaultRulesForPhase("evaluation", balance, baseConfig),
    },
    {
      id: "phase_2",
      sequence: 2,
      name: "Phase 2: Practitioner",
      phaseType: "evaluation",
      status: "awaiting_activation",
      startingBalanceCents: balance,
      profitTargetCents: Math.round(balance * 0.05),
      profitTargetPct: 5,
      dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.05),
      dailyLossLimitPct: baseConfig.dailyLossLimitPct ?? 5,
      maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.1),
      maxDrawdownPct: baseConfig.maxDrawdownPct ?? 10,
      drawdownType: baseConfig.drawdownType ?? "static",
      drawdownBasis: baseConfig.drawdownBasis ?? "balance",
      minTradingDays: baseConfig.minTradingDays ?? 4,
      maxTradingDays: baseConfig.maxTradingDays ?? null,
      startDate: start,
      rules: generateDefaultRulesForPhase("evaluation", balance, {
        ...baseConfig,
        profitTargetCents: Math.round(balance * 0.05),
      }),
    },
    {
      id: "phase_funded_3",
      sequence: 3,
      name: "Funded Stage",
      phaseType: "funded",
      status: "awaiting_activation",
      startingBalanceCents: balance,
      profitTargetCents: null,
      dailyLossLimitCents: baseConfig.dailyLossLimitCents ?? Math.round(balance * 0.05),
      dailyLossLimitPct: baseConfig.dailyLossLimitPct ?? 5,
      maxDrawdownCents: baseConfig.maxDrawdownCents ?? Math.round(balance * 0.1),
      maxDrawdownPct: baseConfig.maxDrawdownPct ?? 10,
      drawdownType: baseConfig.drawdownType ?? "static",
      drawdownBasis: baseConfig.drawdownBasis ?? "balance",
      minTradingDays: null,
      maxTradingDays: null,
      startDate: start,
      rules: generateDefaultRulesForPhase("funded", balance, {
        ...baseConfig,
        profitTargetCents: null,
      }),
    },
  ];
}

// ---------------------------------------------------------------------------
// Metadata Serialization & Deserialization
// ---------------------------------------------------------------------------

export function parsePropLifecycleMetadata(
  rawNotes: string | null | undefined,
  accountConsistencyRate?: number | null | any,
  challengeDefaults?: {
    startingBalanceCents?: number;
    propFirm?: string;
    stage?: string;
    status?: string;
    profitTargetCents?: number | null;
    dailyLossLimitCents?: number | null;
    dailyLossLimitPct?: number | null;
    maxDrawdownCents?: number | null;
    maxDrawdownPct?: number | null;
    drawdownType?: string;
    minTradingDays?: number | null;
    maxTradingDays?: number | null;
    startDate?: string | Date;
    accountModel?: PropAccountModel;
  }
): PropLifecycleMetadata {
  let rateNum: number | null = null;
  let defaults = challengeDefaults;
  if (accountConsistencyRate && typeof accountConsistencyRate === "object") {
    defaults = accountConsistencyRate;
  } else if (typeof accountConsistencyRate === "number") {
    rateNum = accountConsistencyRate;
  }

  const normRate = rateNum != null
    ? (rateNum > 1 ? Math.round(rateNum) : Math.round(rateNum * 100))
    : null;

  const balance = defaults?.startingBalanceCents ?? 10000000;
  const startStr = defaults?.startDate ? new Date(defaults.startDate).toISOString() : new Date().toISOString();

  // Baseline default metadata
  const fallbackModel: PropAccountModel =
    defaults?.accountModel || (defaults?.stage === "funded" ? "instant_funded" : "two_step");

  const defaultPhases = generateDefaultPhasesForModel(fallbackModel, {
    startingBalanceCents: balance,
    profitTargetCents: defaults?.profitTargetCents,
    dailyLossLimitCents: defaults?.dailyLossLimitCents,
    dailyLossLimitPct: defaults?.dailyLossLimitPct,
    maxDrawdownCents: defaults?.maxDrawdownCents,
    maxDrawdownPct: defaults?.maxDrawdownPct,
    drawdownType: defaults?.drawdownType === "trailing" ? "trailing" : "static",
    minTradingDays: defaults?.minTradingDays,
    maxTradingDays: defaults?.maxTradingDays,
    consistencyThresholdPct: normRate,
    startDate: startStr,
  });

  const baseMeta: PropLifecycleMetadata = {
    __format: "alphapips_prop_lifecycle_v2",
    userNotes: "",
    accountModel: fallbackModel,
    accountCostCents: 54000, // standard default $540
    currentPhaseId: defaultPhases[0]?.id || "phase_1",
    phases: defaultPhases,
    violations: [],
    payoutConfig: {
      profitSplitPct: 80,
      minPayoutCents: 10000, // $100
      waitingPeriodDays: 14,
      minProfitableDays: 5,
    },
    payouts: [],
    events: [
      {
        id: `event_init_${Date.now()}`,
        timestamp: startStr,
        type: "created",
        title: "Challenge Created",
        description: `Configured as ${fallbackModel.replace("_", " ")} challenge with ${challengeDefaults?.propFirm ?? "Prop Firm"}.`,
      },
    ],
    isFirmDispute: false,
  };

  if (!rawNotes || typeof rawNotes !== "string") {
    return baseMeta;
  }

  const trimmed = rawNotes.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return { ...baseMeta, userNotes: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) {
      return baseMeta;
    }

    // 1. If already v2 format
    if (parsed.__format === "alphapips_prop_lifecycle_v2") {
      return {
        __format: "alphapips_prop_lifecycle_v2",
        userNotes: typeof parsed.userNotes === "string" ? parsed.userNotes : "",
        accountModel: parsed.accountModel || fallbackModel,
        customPhaseCount: parsed.customPhaseCount,
        accountCostCents: typeof parsed.accountCostCents === "number" ? parsed.accountCostCents : 54000,
        currentPhaseId: parsed.currentPhaseId || defaultPhases[0]?.id || "phase_1",
        phases: Array.isArray(parsed.phases) && parsed.phases.length > 0 ? parsed.phases : defaultPhases,
        violations: Array.isArray(parsed.violations) ? parsed.violations : [],
        payoutConfig: {
          profitSplitPct: parsed.payoutConfig?.profitSplitPct ?? 80,
          minPayoutCents: parsed.payoutConfig?.minPayoutCents ?? 10000,
          waitingPeriodDays: parsed.payoutConfig?.waitingPeriodDays ?? 14,
          minProfitableDays: parsed.payoutConfig?.minProfitableDays ?? 5,
          withdrawalLimitCents: parsed.payoutConfig?.withdrawalLimitCents ?? null,
        },
        payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
        events: Array.isArray(parsed.events) ? parsed.events : baseMeta.events,
        isFirmDispute: Boolean(parsed.isFirmDispute),
        firmRejectionDetails: parsed.firmRejectionDetails,
      };
    }

    // 2. If legacy v1 format
    if (parsed.__format === "alphapips_challenge_meta_v1" || parsed.consistencyRuleType !== undefined) {
      const v1Consistency = parsed.consistencyThresholdPct ?? normRate;
      const v1Action: ConsistencyAction = parsed.consistencyAction || "dilution_required";
      const v1Phases = generateDefaultPhasesForModel(fallbackModel, {
        startingBalanceCents: balance,
        profitTargetCents: challengeDefaults?.profitTargetCents,
        dailyLossLimitCents: challengeDefaults?.dailyLossLimitCents,
        dailyLossLimitPct: challengeDefaults?.dailyLossLimitPct,
        maxDrawdownCents: challengeDefaults?.maxDrawdownCents,
        maxDrawdownPct: challengeDefaults?.maxDrawdownPct,
        drawdownType: challengeDefaults?.drawdownType === "trailing" ? "trailing" : "static",
        minTradingDays: challengeDefaults?.minTradingDays,
        consistencyThresholdPct: v1Consistency,
        consistencyAction: v1Action,
        startDate: startStr,
      });

      return {
        ...baseMeta,
        userNotes: typeof parsed.userNotes === "string" ? parsed.userNotes : "",
        phases: v1Phases,
        currentPhaseId: v1Phases[0]?.id || "phase_1",
      };
    }

    // Fallback object
    return {
      ...baseMeta,
      userNotes: typeof parsed.userNotes === "string" ? parsed.userNotes : JSON.stringify(parsed),
    };
  } catch {
    return { ...baseMeta, userNotes: trimmed };
  }
}

export function serializePropLifecycleMetadata(meta: PropLifecycleMetadata): string {
  return JSON.stringify({
    __format: "alphapips_prop_lifecycle_v2",
    userNotes: meta.userNotes,
    accountModel: meta.accountModel,
    customPhaseCount: meta.customPhaseCount,
    accountCostCents: meta.accountCostCents,
    currentPhaseId: meta.currentPhaseId,
    phases: meta.phases,
    violations: meta.violations,
    payoutConfig: meta.payoutConfig,
    payouts: meta.payouts,
    events: meta.events,
    isFirmDispute: meta.isFirmDispute,
    firmRejectionDetails: meta.firmRejectionDetails,
  });
}

// ---------------------------------------------------------------------------
// Evaluator & Diagnostics Engine
// ---------------------------------------------------------------------------

export interface PropLifecycleEvaluationResult {
  activePhase: PropPhaseConfig;
  allPhases: PropPhaseConfig[];
  status: PropLifecycleStatus;
  statusReason: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
  currentEquityCents: number;
  netProfitCents: number;
  profitTargetProgressPct: number | null;
  profitTargetReached: boolean;
  remainingProfitTargetCents: number | null;

  // Loss & Drawdown
  todayLossCents: number;
  dailyLossLimitCents: number | null;
  remainingDailyLossCents: number | null;
  dailyLossBreached: boolean;
  dailyLossUsedPct: number | null;
  cycleResetTime: string;

  highWaterMarkCents: number;
  currentDrawdownCents: number;
  maxDrawdownLimitCents: number | null;
  remainingDrawdownCents: number | null;
  drawdownBreached: boolean;
  drawdownUsedPct: number | null;

  // Trading days & consistency
  tradingDaysCount: number;
  minDaysMet: boolean;
  daysRemaining: number | null;
  bestDayProfitCents: number;
  bestDayPctOfTotal: number | null;
  consistencyBreached: boolean;

  // Executions
  tradeCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  profitFactor: number | string | null;

  // Rules & Violations
  rules: PropRuleDefinition[];
  violations: PropViolationRecord[];
  warnings: Array<{ type: string; title: string; message: string; remainingAllowance?: string }>;

  // Payouts & Disputes
  isFirmDispute: boolean;
  firmRejectionDetails?: PropLifecycleMetadata["firmRejectionDetails"];
  payoutEligibility: {
    eligible: boolean;
    reason: string;
    availableProfitCents: number;
    traderShareCents: number;
    firmShareCents: number;
  };

  // Timeline events updated
  events: PropLifecycleEvent[];
}

export function ensurePhaseSnapshot(
  phase: PropPhaseConfig,
  allTrades: TradeForLifecycle[],
  nextPhaseStartDate?: string | null,
  timezone = "America/New_York",
  resetHour = 17
): PropPhaseSnapshot {
  const pStartMs = new Date(phase.startDate).getTime();
  const pEndMs = nextPhaseStartDate
    ? new Date(nextPhaseStartDate).getTime()
    : phase.completedAt
    ? new Date(phase.completedAt).getTime()
    : Infinity;

  const phaseTrades = allTrades.filter((t) => {
    if (t.isDraft || t.status === "planned" || isSyntheticSampleTrade(t)) return false;
    const time = t.exitTime ? new Date(t.exitTime).getTime() : t.entryTime ? new Date(t.entryTime).getTime() : 0;
    if (phase.sequence > 1 && time < pStartMs) return false;
    if (time > pEndMs) return false;
    return true;
  });

  let balanceCents = phase.startingBalanceCents;
  let grossWin = 0;
  let grossLoss = 0;
  let winCount = 0;
  const cycleKeys = new Set<string>();

  for (const t of phaseTrades) {
    if (t.status !== "open" && t.exitTime) {
      balanceCents += t.netPnlCents;
    }
    const time = t.exitTime ? new Date(t.exitTime) : new Date(t.entryTime || 0);
    cycleKeys.add(getTradingCycleKey(time, timezone, resetHour));
    if (t.netPnlCents > 0 || t.status === "win") {
      winCount++;
      grossWin += t.netPnlCents;
    } else if (t.netPnlCents < 0 || t.status === "loss") {
      grossLoss += Math.abs(t.netPnlCents);
    }
  }

  const netProfitCents = balanceCents - phase.startingBalanceCents;
  const tradeCount = phaseTrades.length;
  const winRate = tradeCount > 0 ? Math.round((winCount / tradeCount) * 100) : 0;
  const profitFactor = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? "Infinity" : null;

  return {
    phaseId: phase.id,
    phaseName: phase.name,
    sequence: phase.sequence,
    completedAt: phase.completedAt || nextPhaseStartDate || new Date().toISOString(),
    startingBalanceCents: phase.startingBalanceCents,
    finalBalanceCents: balanceCents,
    finalEquityCents: balanceCents,
    netProfitCents,
    tradeCount,
    winRate,
    profitFactor,
    tradingDaysCount: cycleKeys.size,
    status: "passed",
    rulesPassedCount: phase.rules?.filter((r) => r.status === "passed").length || phase.rules?.length || 0,
    rulesTotalCount: phase.rules?.length || 0,
    rules: phase.rules,
    calculationMethods: {
      drawdownType: phase.drawdownType || "static",
      drawdownBasis: phase.drawdownBasis || "balance",
    },
    resetConfig: {
      timezone,
      resetHour,
    },
  };
}

/**
 * Authoritatively filter trades belonging to a specific challenge phase (D-019).
 * Strictly isolates active phase trades from prior and future phase executions.
 */
export function filterTradesForPhase<T extends { exitTime?: string | Date | null; entryTime?: string | Date | null; isDraft?: boolean; status?: string; tagsJson?: string | null; notes?: string | null }>(
  trades: T[],
  phase: PropPhaseConfig | null | undefined,
  allPhases: PropPhaseConfig[] = [],
  challengeStartDate?: string | Date
): T[] {
  if (!phase) return trades;
  const isFirstPhase = phase.sequence === 1 || allPhases.findIndex((p) => p.id === phase.id) === 0;
  const phaseStartMs = isFirstPhase ? 0 : new Date(phase.startDate || challengeStartDate || 0).getTime();
  const phaseEndMs = phase.endDate ? new Date(phase.endDate).getTime() : null;

  return trades.filter((t) => {
    if (t.isDraft || t.status === "planned" || isSyntheticSampleTrade(t)) return false;
    const tradeTime = t.exitTime ? new Date(t.exitTime).getTime() : t.entryTime ? new Date(t.entryTime).getTime() : 0;
    if (tradeTime < phaseStartMs) return false;
    if (phaseEndMs && tradeTime > phaseEndMs) return false;
    return true;
  });
}

/**
 * Determine which phase a trade executed in across the challenge's phase history (D-019).
 */
export function getPhaseForTrade(
  trade: { exitTime?: string | Date | null; entryTime?: string | Date | null },
  allPhases: PropPhaseConfig[],
  challengeStartDate?: string | Date
): PropPhaseConfig | null {
  const tradeTime = trade.exitTime ? new Date(trade.exitTime).getTime() : trade.entryTime ? new Date(trade.entryTime).getTime() : 0;
  if (!tradeTime || !allPhases.length) return null;

  const sorted = [...allPhases].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  for (let i = 0; i < sorted.length; i++) {
    const phase = sorted[i];
    const isFirst = i === 0 || phase.sequence === 1;
    const startMs = isFirst ? 0 : new Date(phase.startDate || challengeStartDate || 0).getTime();
    const endMs = phase.endDate ? new Date(phase.endDate).getTime() : null;
    if (tradeTime >= startMs && (!endMs || tradeTime <= endMs)) {
      return phase;
    }
  }
  return sorted[sorted.length - 1] ?? null;
}

export function evaluatePropLifecycle(
  challenge: {
    id: string;
    propFirm: string;
    resetTimezone?: string;
    resetHour?: number;
    startDate: string | Date;
    endDate?: string | Date | null;
  },
  meta: PropLifecycleMetadata,
  trades: TradeForLifecycle[],
  now = new Date()
): PropLifecycleEvaluationResult {
  const timezone = challenge.resetTimezone || "America/New_York";
  const resetHour = challenge.resetHour ?? 17;

  // Resolve current active phase
  let activePhase = meta?.phases?.find((p) => p.id === meta?.currentPhaseId) || meta?.phases?.[0];
  if (!activePhase) {
    const defaultPhases = generateDefaultPhasesForModel(meta?.accountModel || "two_step", {
      startingBalanceCents: 10000000,
      startDate: new Date(challenge.startDate).toISOString(),
    });
    activePhase = defaultPhases[0];
    if (meta && !meta.phases) {
      meta.phases = defaultPhases;
      meta.currentPhaseId = activePhase.id;
    }
  }

  const isFirstPhase = activePhase.sequence === 1 || meta?.phases?.findIndex((p) => p.id === activePhase.id) === 0;
  const phaseStartMs = isFirstPhase ? 0 : new Date(activePhase.startDate || challenge.startDate).getTime();
  const phaseEndMs = activePhase.endDate ? new Date(activePhase.endDate).getTime() : null;

  // Filter valid executed trades for this phase (strictly excluding drafts, planned)
  const validTrades = trades
    .filter((t) => !t.isDraft && t.status !== "planned" && !isSyntheticSampleTrade(t))
    .filter((t) => {
      const tradeTime = t.exitTime ? new Date(t.exitTime).getTime() : t.entryTime ? new Date(t.entryTime).getTime() : 0;
      if (tradeTime < phaseStartMs) return false;
      if (phaseEndMs && tradeTime > phaseEndMs) return false;
      return true;
    })
    .sort((a, b) => {
      const timeA = a.exitTime ? new Date(a.exitTime).getTime() : new Date(a.entryTime || 0).getTime();
      const timeB = b.exitTime ? new Date(b.exitTime).getTime() : new Date(b.entryTime || 0).getTime();
      return timeA - timeB;
    });

  // Calculate Starting Balance, Equity, Balances
  const startingBalanceCents = activePhase.startingBalanceCents;
  let currentBalanceCents = startingBalanceCents;
  let highWaterMarkCents = startingBalanceCents;
  let lowestBalanceCents = startingBalanceCents;

  const dailyPnlMap = new Map<string, { pnlCents: number; trades: TradeForLifecycle[] }>();
  const tradingDayKeys = new Set<string>();

  let grossWinCents = 0;
  let grossLossCents = 0;
  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;

  for (const trade of validTrades) {
    const isClosed = trade.status !== "open" && trade.exitTime !== null;
    const timestamp = trade.exitTime ? new Date(trade.exitTime) : new Date(trade.entryTime || 0);
    const cycleKey = getTradingCycleKey(timestamp, timezone, resetHour);
    tradingDayKeys.add(cycleKey);

    const prev = dailyPnlMap.get(cycleKey) || { pnlCents: 0, trades: [] };
    prev.pnlCents += trade.netPnlCents;
    prev.trades.push(trade);
    dailyPnlMap.set(cycleKey, prev);

    if (isClosed) {
      currentBalanceCents += trade.netPnlCents;
    }
    if (currentBalanceCents > highWaterMarkCents) {
      highWaterMarkCents = currentBalanceCents;
    }
    if (currentBalanceCents < lowestBalanceCents) {
      lowestBalanceCents = currentBalanceCents;
    }

    if (trade.netPnlCents > 0 || trade.status === "win") {
      winCount++;
      grossWinCents += Math.max(0, trade.netPnlCents);
    } else if (trade.netPnlCents < 0 || trade.status === "loss") {
      lossCount++;
      grossLossCents += Math.abs(trade.netPnlCents);
    } else {
      breakevenCount++;
    }
  }

  // Current equity includes open trades floating P&L
  const openTrades = validTrades.filter((t) => t.status === "open" || !t.exitTime);
  let openFloatingPnlCents = 0;
  for (const ot of openTrades) {
    openFloatingPnlCents += ot.netPnlCents || 0;
  }
  const currentEquityCents = currentBalanceCents + openFloatingPnlCents;

  const netProfitCents = currentBalanceCents - startingBalanceCents;
  const tradeCount = validTrades.length;
  const winRate = tradeCount > 0 ? Math.round((winCount / tradeCount) * 1000) / 10 : 0;
  const profitFactor = grossLossCents > 0
    ? Math.round((grossWinCents / grossLossCents) * 100) / 100
    : grossWinCents > 0
    ? "Infinity"
    : null;

  // Daily Loss Metrics
  const currentCycleKey = getTradingCycleKey(now, timezone, resetHour);
  const todayEntry = dailyPnlMap.get(currentCycleKey);
  const todayPnlCents = todayEntry ? todayEntry.pnlCents : 0;
  const todayLossCents = todayPnlCents < 0 ? Math.abs(todayPnlCents) : 0;

  const dailyLossLimitCents = activePhase.dailyLossLimitCents
    ?? (activePhase.dailyLossLimitPct ? Math.round(startingBalanceCents * (activePhase.dailyLossLimitPct / 100)) : null);

  let dailyLossUsedPct: number | null = null;
  let dailyLossBreached = false;
  if (dailyLossLimitCents && dailyLossLimitCents > 0) {
    dailyLossUsedPct = Math.round((todayLossCents / dailyLossLimitCents) * 100);
    dailyLossBreached = todayLossCents >= dailyLossLimitCents;
  }

  // Drawdown Metrics
  const drawdownBasis = activePhase.drawdownBasis || "balance";
  const effectiveRefBalance = drawdownBasis === "equity" ? currentEquityCents : currentBalanceCents;

  let currentDrawdownCents = 0;
  if (activePhase.drawdownType === "trailing") {
    currentDrawdownCents = Math.max(0, highWaterMarkCents - effectiveRefBalance);
  } else {
    currentDrawdownCents = Math.max(0, startingBalanceCents - effectiveRefBalance);
  }

  const maxDrawdownLimitCents = activePhase.maxDrawdownCents
    ?? (activePhase.maxDrawdownPct ? Math.round(startingBalanceCents * (activePhase.maxDrawdownPct / 100)) : null);

  let drawdownUsedPct: number | null = null;
  let drawdownBreached = false;
  if (maxDrawdownLimitCents && maxDrawdownLimitCents > 0) {
    drawdownUsedPct = Math.round((currentDrawdownCents / maxDrawdownLimitCents) * 100);
    drawdownBreached = currentDrawdownCents >= maxDrawdownLimitCents;
  }

  // Profit Target Metrics
  const profitTargetCents = activePhase.profitTargetCents;
  let profitTargetProgressPct: number | null = null;
  let profitTargetReached = false;
  let remainingProfitTargetCents: number | null = null;
  if (profitTargetCents && profitTargetCents > 0) {
    profitTargetProgressPct = Math.round((netProfitCents / profitTargetCents) * 100);
    profitTargetReached = netProfitCents >= profitTargetCents;
    remainingProfitTargetCents = Math.max(0, profitTargetCents - netProfitCents);
  }

  // Trading Days & Consistency
  const tradingDaysCount = tradingDayKeys.size;
  const minTradingDays = activePhase.minTradingDays ?? null;
  const minDaysMet = minTradingDays ? tradingDaysCount >= minTradingDays : true;
  const maxTradingDays = activePhase.maxTradingDays ?? null;
  const daysRemaining = maxTradingDays ? Math.max(0, maxTradingDays - tradingDaysCount) : null;

  let bestDayProfitCents = 0;
  let bestDayCycleKey = "";
  for (const [key, data] of dailyPnlMap.entries()) {
    if (data.pnlCents > bestDayProfitCents) {
      bestDayProfitCents = data.pnlCents;
      bestDayCycleKey = key;
    }
  }

  // Find consistency rule in activePhase
  const consistencyRule = activePhase.rules.find((r) => r.ruleKey === "consistency");
  let consistencyThresholdPct: number | null = consistencyRule?.config?.threshold != null
    ? Number(consistencyRule.config.threshold)
    : null;

  if (consistencyThresholdPct !== null && !isNaN(consistencyThresholdPct)) {
    // If threshold > 100, normalize: e.g. 8600% -> 86%, 5000% -> 50%
    if (consistencyThresholdPct > 100) {
      consistencyThresholdPct = consistencyThresholdPct <= 10000
        ? Math.round(consistencyThresholdPct / 100)
        : 50;
    }
    consistencyThresholdPct = Math.min(100, Math.max(1, consistencyThresholdPct));
  } else {
    consistencyThresholdPct = null;
  }
  const consistencyAction = consistencyRule?.config?.consistencyAction || "dilution_required";

  let bestDayPctOfTotal: number | null = null;
  if (netProfitCents > 0 && bestDayProfitCents > 0) {
    bestDayPctOfTotal = Math.min(100, Math.max(0, Math.round((bestDayProfitCents / netProfitCents) * 100)));
  }

  let consistencyBreached = false;
  if (consistencyThresholdPct && bestDayPctOfTotal !== null) {
    if (bestDayPctOfTotal > consistencyThresholdPct) {
      consistencyBreached = true;
    }
  }

  // -------------------------------------------------------------------------
  // Dynamic Rule Evaluation & Failure Diagnosis
  // -------------------------------------------------------------------------
  const evaluatedRules: PropRuleDefinition[] = [];
  const dynamicViolations: PropViolationRecord[] = [...(meta?.violations || [])];
  const warnings: Array<{ type: string; title: string; message: string; remainingAllowance?: string }> = [];

  const nowIso = now.toISOString();

  for (const r of activePhase.rules) {
    const updatedRule: PropRuleDefinition = { ...r, lastEvaluatedAt: nowIso };

    if (r.ruleKey === "profit_target") {
      if (profitTargetReached) {
        updatedRule.status = "passed";
        updatedRule.statusExplanation = `Target of $${((profitTargetCents || 0) / 100).toLocaleString()} reached (+${profitTargetProgressPct}%).`;
      } else {
        updatedRule.status = "at_risk";
        updatedRule.statusExplanation = `Progress: $${(netProfitCents / 100).toLocaleString()} / $${((profitTargetCents || 0) / 100).toLocaleString()} (${profitTargetProgressPct}%). Remaining: $${(((remainingProfitTargetCents || 0)) / 100).toLocaleString()}.`;
      }
    } else if (r.ruleKey === "daily_loss") {
      if (dailyLossBreached) {
        updatedRule.status = "violated";
        updatedRule.statusExplanation = `Daily loss limit of $${((dailyLossLimitCents || 0) / 100).toFixed(2)} was exceeded by $${(((todayLossCents - (dailyLossLimitCents || 0))) / 100).toFixed(2)}.`;

        // Check if already recorded
        const exists = dynamicViolations.some((v) => v.ruleKey === "daily_loss" && v.occurredAt.startsWith(currentCycleKey));
        if (!exists) {
          dynamicViolations.push({
            id: `violation_daily_loss_${Date.now()}`,
            ruleId: r.id,
            ruleKey: "daily_loss",
            ruleName: "Daily Loss Limit",
            category: "daily_loss",
            severity: "hard_breach",
            occurredAt: nowIso,
            firmTimezone: timezone,
            requiredThreshold: `≤ $${((dailyLossLimitCents || 0) / 100).toFixed(2)}`,
            actualValue: `$${(todayLossCents / 100).toFixed(2)}`,
            amountExceeded: `$${(((todayLossCents - (dailyLossLimitCents || 0))) / 100).toFixed(2)}`,
            relevantBalanceCents: currentBalanceCents,
            contributingTradeIds: todayEntry ? todayEntry.trades.map((t) => t.id) : [],
            calculationExplanation: `Trading cycle ${currentCycleKey} closed with a total loss of $${(todayLossCents / 100).toFixed(2)}, which exceeds the allowable $${((dailyLossLimitCents || 0) / 100).toFixed(2)} maximum daily limit.`,
            ruleConfigSnapshot: r.config,
            isUserVerified: true,
          });
        }
      } else {
        updatedRule.status = "passed";
        if (dailyLossUsedPct !== null && dailyLossUsedPct >= 75) {
          warnings.push({
            type: "daily_loss",
            title: "Approaching Daily Loss Limit",
            message: `Consumed ${dailyLossUsedPct}% of allowable daily loss buffer ($${(todayLossCents / 100).toFixed(2)} / $${((dailyLossLimitCents || 0) / 100).toFixed(2)}).`,
            remainingAllowance: `$${(((dailyLossLimitCents || 0) - todayLossCents) / 100).toFixed(2)} remaining`,
          });
        }
      }
    } else if (r.ruleKey === "max_drawdown") {
      if (drawdownBreached) {
        updatedRule.status = "violated";
        updatedRule.statusExplanation = `Maximum ${activePhase.drawdownType} drawdown of $${((maxDrawdownLimitCents || 0) / 100).toFixed(2)} was exceeded by $${(((currentDrawdownCents - (maxDrawdownLimitCents || 0))) / 100).toFixed(2)}.`;

        const exists = dynamicViolations.some((v) => v.ruleKey === "max_drawdown");
        if (!exists) {
          dynamicViolations.push({
            id: `violation_drawdown_${Date.now()}`,
            ruleId: r.id,
            ruleKey: "max_drawdown",
            ruleName: r.name,
            category: "drawdown",
            severity: "hard_breach",
            occurredAt: nowIso,
            firmTimezone: timezone,
            requiredThreshold: `≤ $${((maxDrawdownLimitCents || 0) / 100).toFixed(2)}`,
            actualValue: `$${(currentDrawdownCents / 100).toFixed(2)}`,
            amountExceeded: `$${(((currentDrawdownCents - (maxDrawdownLimitCents || 0))) / 100).toFixed(2)}`,
            relevantBalanceCents: effectiveRefBalance,
            contributingTradeIds: validTrades.slice(-5).map((t) => t.id),
            calculationExplanation: `Account experienced a ${activePhase.drawdownType} drawdown of $${(currentDrawdownCents / 100).toFixed(2)} relative to ${activePhase.drawdownType === "trailing" ? "peak high-water mark ($" + (highWaterMarkCents / 100).toFixed(2) + ")" : "starting balance"}, exceeding the $${((maxDrawdownLimitCents || 0) / 100).toFixed(2)} limit.`,
            ruleConfigSnapshot: r.config,
            isUserVerified: true,
          });
        }
      } else {
        updatedRule.status = "passed";
        if (drawdownUsedPct !== null && drawdownUsedPct >= 75) {
          warnings.push({
            type: "drawdown",
            title: "Approaching Maximum Drawdown",
            message: `Consumed ${drawdownUsedPct}% of maximum allowable drawdown ($${(currentDrawdownCents / 100).toFixed(2)} / $${((maxDrawdownLimitCents || 0) / 100).toFixed(2)}).`,
            remainingAllowance: `$${(((maxDrawdownLimitCents || 0) - currentDrawdownCents) / 100).toFixed(2)} buffer remaining`,
          });
        }
      }
    } else if (r.ruleKey === "consistency") {
      if (consistencyBreached) {
        if (consistencyAction === "hard_breach") {
          updatedRule.status = "violated";
          updatedRule.statusExplanation = `Single day profit reached ${bestDayPctOfTotal}% of total profit, violating the strict ${consistencyThresholdPct}% limit.`;

          const exists = dynamicViolations.some((v) => v.ruleKey === "consistency");
          if (!exists) {
            dynamicViolations.push({
              id: `violation_consistency_${Date.now()}`,
              ruleId: r.id,
              ruleKey: "consistency",
              ruleName: "Profit Consistency Rule",
              category: "consistency",
              severity: "hard_breach",
              occurredAt: nowIso,
              firmTimezone: timezone,
              requiredThreshold: `≤ ${consistencyThresholdPct}% of total profit`,
              actualValue: `${bestDayPctOfTotal}%`,
              amountExceeded: `${(bestDayPctOfTotal || 0) - (consistencyThresholdPct || 0)}% excess concentration`,
              relevantBalanceCents: currentBalanceCents,
              contributingTradeIds: dailyPnlMap.get(bestDayCycleKey)?.trades.map((t) => t.id) || [],
              calculationExplanation: `Single trading cycle (${bestDayCycleKey}) yielded $${(bestDayProfitCents / 100).toFixed(2)} (${bestDayPctOfTotal}% of total profit), violating the hard consistency cap of ${consistencyThresholdPct}%.`,
              ruleConfigSnapshot: r.config,
              isUserVerified: true,
            });
          }
        } else {
          updatedRule.status = "at_risk";
          updatedRule.statusExplanation = `Best day ($${(bestDayProfitCents / 100).toFixed(2)}) is ${bestDayPctOfTotal}% of total (threshold: ${consistencyThresholdPct}%). Dilution required: execute additional profitable trading days to dilute single-day concentration.`;
          warnings.push({
            type: "consistency",
            title: "Consistency Rule Concentration Alert",
            message: `Single day accounts for ${bestDayPctOfTotal}% of total profit (limit ${consistencyThresholdPct}%). Additional trading days required to satisfy consistency before passing.`,
          });
        }
      } else {
        updatedRule.status = "passed";
        if (consistencyThresholdPct && bestDayPctOfTotal !== null && bestDayPctOfTotal >= consistencyThresholdPct * 0.85) {
          warnings.push({
            type: "consistency",
            title: "Approaching Consistency Threshold",
            message: `Best trading day profit concentration is at ${bestDayPctOfTotal}% (threshold: ${consistencyThresholdPct}%).`,
          });
        }
      }
    } else if (r.ruleKey === "min_trading_days") {
      const minDays = Number(r.config.threshold) || 4;
      if (tradingDaysCount >= minDays) {
        updatedRule.status = "passed";
        updatedRule.statusExplanation = `Fulfilled: ${tradingDaysCount} of ${minDays} minimum trading days completed.`;
      } else {
        updatedRule.status = "at_risk";
        updatedRule.statusExplanation = `In progress: ${tradingDaysCount} / ${minDays} trading days logged. Need ${minDays - tradingDaysCount} more trading day(s).`;
        warnings.push({
          type: "min_days",
          title: "Minimum Trading Days Remaining",
          message: `${minDays - tradingDaysCount} more trading day(s) required to fulfill phase evaluation requirements.`,
        });
      }
    } else if (r.ruleKey === "max_trading_days") {
      const maxDays = Number(r.config.threshold);
      if (maxDays && tradingDaysCount > maxDays && !profitTargetReached) {
        updatedRule.status = "violated";
        updatedRule.statusExplanation = `Exceeded maximum allowable ${maxDays} trading days limit without reaching profit target.`;
      } else {
        updatedRule.status = "passed";
        if (daysRemaining !== null && daysRemaining <= 3 && !profitTargetReached) {
          warnings.push({
            type: "deadline",
            title: "Phase Deadline Approaching",
            message: `Only ${daysRemaining} day(s) remaining to achieve the profit target.`,
          });
        }
      }
    } else if (r.ruleKey === "weekend_holding") {
      if (r.config.threshold === false) {
        // Check for trades held over weekend (Friday 17:00 NY to Sunday 17:00 NY)
        let weekendHeldTrade: TradeForLifecycle | null = null;
        for (const t of validTrades) {
          const entry = t.entryTime ? new Date(t.entryTime) : null;
          const exit = t.exitTime ? new Date(t.exitTime) : null;
          if (entry) {
            const entryDay = entry.getUTCDay();
            if (entryDay === 5 || entryDay === 6 || entryDay === 0) {
              if (!exit || exit.getTime() - entry.getTime() > 48 * 3600 * 1000) {
                weekendHeldTrade = t;
                break;
              }
            }
          }
        }
        if (weekendHeldTrade) {
          updatedRule.status = "violated";
          updatedRule.statusExplanation = `Trade ${weekendHeldTrade.id} was held over the weekend in violation of prop firm terms.`;
        } else {
          updatedRule.status = "passed";
        }
      } else {
        updatedRule.status = "not_applicable";
      }
    } else if (r.ruleKey === "copy_trading") {
      // Third-party copy trading cannot be proven locally
      updatedRule.status = "unverified";
      updatedRule.statusExplanation = "Audited externally by prop firm trade clustering algorithms. Cannot be confirmed passed from local records.";
    } else {
      // Default preservation
      updatedRule.status = r.status || "passed";
    }

    evaluatedRules.push(updatedRule);
  }

  // -------------------------------------------------------------------------
  // Overall Status Determination
  // -------------------------------------------------------------------------
  let overallStatus: PropLifecycleStatus = activePhase.status;
  let statusReason = "All active phase parameters within normal boundaries.";

  const hasHardBreach = dynamicViolations.some((v) => v.severity === "hard_breach");
  const isTerminated = activePhase.status === "terminated" || activePhase.status === "suspended";

  if (isTerminated) {
    overallStatus = activePhase.status;
    statusReason = `Account has been ${activePhase.status} by firm administration.`;
  } else if (meta.isFirmDispute) {
    overallStatus = "failed";
    statusReason = meta.firmRejectionDetails?.undisclosedRuleName
      ? `Firm rejection: ${meta.firmRejectionDetails.undisclosedRuleName} — ${meta.firmRejectionDetails.firmCommunication || "no violation established by currently configured rules."}`
      : "Firm rejection — no violation established by currently configured rules.";
  } else if (hasHardBreach || dailyLossBreached || drawdownBreached) {
    overallStatus = "breached";
    statusReason = dailyLossBreached
      ? `Daily loss limit of $${((dailyLossLimitCents || 0) / 100).toFixed(2)} was breached.`
      : drawdownBreached
      ? `Maximum ${activePhase.drawdownType} drawdown limit of $${((maxDrawdownLimitCents || 0) / 100).toFixed(2)} was breached.`
      : "Account rule violation detected.";
  } else if (activePhase.phaseType === "funded") {
    overallStatus = "funded";
    statusReason = "Active funded account in good standing.";
  } else if (profitTargetReached && minDaysMet) {
    if (consistencyBreached && consistencyAction !== "warning") {
      overallStatus = "in_progress";
      statusReason = `Profit target reached, but consistency dilution is required (${bestDayPctOfTotal}% vs ${consistencyThresholdPct}% limit). Trade additional days to dilute.`;
    } else {
      overallStatus = "passed";
      statusReason = "Phase criteria fulfilled: profit target reached and minimum trading days satisfied.";
    }
  } else {
    overallStatus = "in_progress";
    statusReason = `Phase in progress. ${tradeCount} trades logged, $${(netProfitCents / 100).toFixed(2)} net P&L.`;
  }

  // -------------------------------------------------------------------------
  // Payout Eligibility
  // -------------------------------------------------------------------------
  const isFunded = activePhase.phaseType === "funded";
  const profitableDaysCount = Array.from(dailyPnlMap.values()).filter((d) => d.pnlCents >= (meta?.payoutConfig?.minPayoutCents || 10000)).length;
  const netTraderAccumulatedProfitCents = Math.max(0, netProfitCents);

  let payoutEligible = false;
  let payoutReason = "Only funded accounts are eligible for profit split payouts.";
  let traderShareCents = 0;
  let firmShareCents = 0;

  if (isFunded) {
    const splitPct = meta?.payoutConfig?.profitSplitPct || 80;
    traderShareCents = Math.round(netTraderAccumulatedProfitCents * (splitPct / 100));
    firmShareCents = netTraderAccumulatedProfitCents - traderShareCents;

    if (hasHardBreach || overallStatus === "breached" || overallStatus === "failed") {
      payoutEligible = false;
      payoutReason = "Account has active rule breaches; payouts suspended.";
    } else if (netTraderAccumulatedProfitCents < meta.payoutConfig.minPayoutCents) {
      payoutEligible = false;
      payoutReason = `Accumulated profit ($${(netTraderAccumulatedProfitCents / 100).toFixed(2)}) is below the minimum payout requirement of $${(meta.payoutConfig.minPayoutCents / 100).toFixed(2)}.`;
    } else if (profitableDaysCount < meta.payoutConfig.minProfitableDays) {
      payoutEligible = false;
      payoutReason = `Requires at least ${meta.payoutConfig.minProfitableDays} profitable trading days (currently ${profitableDaysCount}).`;
    } else {
      payoutEligible = true;
      payoutReason = `Eligible for profit withdrawal. Available trader share: $${(traderShareCents / 100).toFixed(2)} (${splitPct}% split).`;
      warnings.push({
        type: "payout_eligible",
        title: "Payout Available",
        message: `Account is eligible for a profit split payout of $${(traderShareCents / 100).toFixed(2)}.`,
      });
    }
  }

  // Update active phase rules and status in memory, and ensure completed phases have valid historical snapshots
  const updatedAllPhases = meta.phases.map((p, idx) => {
    if (p.id === activePhase.id) {
      return {
        ...p,
        status: overallStatus,
        rules: evaluatedRules,
      };
    }
    if ((p.status === "passed" || p.completedAt) && !p.snapshot) {
      const nextPhase = meta.phases[idx + 1];
      const snapshot = ensurePhaseSnapshot(p, trades, nextPhase?.startDate, timezone, resetHour);
      return {
        ...p,
        snapshot,
      };
    }
    return p;
  });

  return {
    activePhase: { ...activePhase, status: overallStatus, rules: evaluatedRules },
    allPhases: updatedAllPhases,
    status: overallStatus,
    statusReason,
    startingBalanceCents,
    currentBalanceCents,
    currentEquityCents,
    netProfitCents,
    profitTargetProgressPct,
    profitTargetReached,
    remainingProfitTargetCents,
    todayLossCents,
    dailyLossLimitCents,
    remainingDailyLossCents: dailyLossLimitCents ? Math.max(0, dailyLossLimitCents - todayLossCents) : null,
    dailyLossBreached,
    dailyLossUsedPct,
    cycleResetTime: `${String(resetHour).padStart(2, "0")}:00 ${timezone}`,
    highWaterMarkCents,
    currentDrawdownCents,
    maxDrawdownLimitCents,
    remainingDrawdownCents: maxDrawdownLimitCents ? Math.max(0, maxDrawdownLimitCents - currentDrawdownCents) : null,
    drawdownBreached,
    drawdownUsedPct,
    tradingDaysCount,
    minDaysMet,
    daysRemaining,
    bestDayProfitCents,
    bestDayPctOfTotal,
    consistencyBreached,
    tradeCount,
    winCount,
    lossCount,
    breakevenCount,
    winRate,
    profitFactor,
    rules: evaluatedRules,
    violations: dynamicViolations,
    warnings,
    isFirmDispute: meta.isFirmDispute,
    firmRejectionDetails: meta.firmRejectionDetails,
    payoutEligibility: {
      eligible: payoutEligible,
      reason: payoutReason,
      availableProfitCents: netTraderAccumulatedProfitCents,
      traderShareCents,
      firmShareCents,
    },
    events: meta.events,
  };
}

// ---------------------------------------------------------------------------
// Transition Actions
// ---------------------------------------------------------------------------

export function transitionToNextPhase(
  meta: PropLifecycleMetadata,
  confirmed = true,
  options?: {
    policy?: "carry_forward" | "fresh_baseline";
    targetPhaseId?: string;
    currentSnapshot?: PropPhaseSnapshot;
    fundedAccountId?: string;
    fundedAccountName?: string;
    activationDate?: string;
  }
): { updatedMeta: PropLifecycleMetadata; newPhase: PropPhaseConfig | null; message: string } {
  if (!confirmed) {
    return {
      updatedMeta: meta,
      newPhase: null,
      message: "Phase transition cancelled: confirmation required.",
    };
  }

  const currentIdx = meta.phases.findIndex((p) => p.id === meta.currentPhaseId);
  if (currentIdx === -1) {
    return { updatedMeta: meta, newPhase: null, message: "Current phase not found." };
  }

  // Idempotency check: if targetPhaseId is specified and already current
  if (options?.targetPhaseId && meta.currentPhaseId === options.targetPhaseId) {
    const existingActive = meta.phases.find((p) => p.id === options.targetPhaseId) || null;
    return {
      updatedMeta: meta,
      newPhase: existingActive,
      message: "Phase is already active.",
    };
  }

  const nextPhase = options?.targetPhaseId
    ? meta.phases.find((p) => p.id === options.targetPhaseId)
    : meta.phases[currentIdx + 1];

  if (!nextPhase) {
    return {
      updatedMeta: meta,
      newPhase: null,
      message: "No subsequent phase exists in configured account model.",
    };
  }

  const nowIso = new Date().toISOString();
  const policy = options?.policy || "carry_forward";

  // Mark current phase as passed and record completion snapshot
  const updatedPhases = meta.phases.map((p, idx) => {
    if (idx === currentIdx) {
      return {
        ...p,
        status: "passed" as PropLifecycleStatus,
        completedAt: nowIso,
        snapshot: options?.currentSnapshot ?? p.snapshot ?? {
          phaseId: p.id,
          phaseName: p.name,
          sequence: p.sequence,
          completedAt: nowIso,
          startingBalanceCents: p.startingBalanceCents,
          finalBalanceCents: p.startingBalanceCents,
          finalEquityCents: p.startingBalanceCents,
          netProfitCents: 0,
          tradeCount: 0,
          winRate: 0,
          profitFactor: null,
          status: "passed" as PropLifecycleStatus,
          rulesPassedCount: p.rules.filter((r) => r.status === "passed").length,
          rulesTotalCount: p.rules.length,
        },
      };
    }
    if (p.id === nextPhase.id) {
      const adjustedStartBalance = (policy === "carry_forward" && options?.currentSnapshot?.finalBalanceCents)
        ? options.currentSnapshot.finalBalanceCents
        : p.startingBalanceCents;

      return {
        ...p,
        startingBalanceCents: adjustedStartBalance,
        status: (p.phaseType === "funded" ? "funded" : "in_progress") as PropLifecycleStatus,
        startDate: options?.activationDate || nowIso,
        tradingAccountId: options?.fundedAccountId,
        fundedAccountName: options?.fundedAccountName,
        activationDate: options?.activationDate || (p.phaseType === "funded" ? nowIso : undefined),
        fundedStatus: (p.phaseType === "funded" ? "active" : undefined) as PropPhaseConfig["fundedStatus"],
      };
    }
    return p;
  });

  const updatedEvents: PropLifecycleEvent[] = [
    ...(meta.events || []),
    {
      id: `event_trans_${Date.now()}`,
      timestamp: nowIso,
      type: "phase_transition",
      title: `Transitioned to ${nextPhase.name}`,
      description: `Successfully completed ${meta.phases[currentIdx].name} (policy: ${policy}) and activated ${nextPhase.name}.`,
    },
  ];

  const updatedMeta: PropLifecycleMetadata = {
    ...meta,
    currentPhaseId: nextPhase.id,
    phases: updatedPhases,
    events: updatedEvents,
  };

  const activatedPhase = updatedPhases.find((p) => p.id === nextPhase.id) || null;

  return {
    updatedMeta,
    newPhase: activatedPhase,
    message: `Activated ${nextPhase.name} successfully.`,
  };
}

export function recordManualFirmRejection(
  meta: PropLifecycleMetadata,
  details: {
    firmCommunication: string;
    undisclosedRuleName?: string;
    userVerified: boolean;
    date?: string;
    documents?: string[];
  }
): PropLifecycleMetadata {
  const nowIso = details.date || new Date().toISOString();
  const rejectionEvent: PropLifecycleEvent = {
    id: `event_reject_${Date.now()}`,
    timestamp: nowIso,
    type: "firm_rejection",
    title: details.undisclosedRuleName ? `Firm Rejection: ${details.undisclosedRuleName}` : "Firm Rejection Logged",
    description: details.firmCommunication,
  };

  return {
    ...meta,
    isFirmDispute: true,
    firmRejectionDetails: {
      date: nowIso,
      firmCommunication: details.firmCommunication,
      undisclosedRuleName: details.undisclosedRuleName,
      userVerified: details.userVerified,
      documents: details.documents || [],
    },
    events: [...(meta.events || []), rejectionEvent],
  };
}

export function requestPayout(
  meta: PropLifecycleMetadata,
  amountCents: number,
  notes?: string
): { updatedMeta: PropLifecycleMetadata; payout: PropPayoutRecord } {
  const nowIso = new Date().toISOString();
  const splitPct = meta.payoutConfig?.profitSplitPct || 80;
  const netTrader = Math.round(amountCents * (splitPct / 100));
  const firmSplit = amountCents - netTrader;

  const newPayout: PropPayoutRecord = {
    id: `payout_${Date.now()}`,
    requestedAt: nowIso,
    amountCents,
    netTraderPayoutCents: netTrader,
    firmSplitCents: firmSplit,
    status: "requested",
    notes,
  };

  const payoutEvent: PropLifecycleEvent = {
    id: `event_payout_${Date.now()}`,
    timestamp: nowIso,
    type: "payout_requested",
    title: `Payout Requested ($${(netTrader / 100).toFixed(2)})`,
    description: `Trader requested a $${(amountCents / 100).toFixed(2)} withdrawal (${splitPct}% profit split).`,
  };

  return {
    updatedMeta: {
      ...meta,
      payouts: [newPayout, ...(meta.payouts || [])],
      events: [...(meta.events || []), payoutEvent],
    },
    payout: newPayout,
  };
}

// ---------------------------------------------------------------------------
// Aggregated Comparison Analytics
// ---------------------------------------------------------------------------

export interface CurrencyAggregateFinancials {
  currency: string;
  totalFeesCents: number;
  totalPayoutsCents: number;
  totalPendingPayoutsCents: number;
  netCashOutcomeCents: number;
  simulatedTradingProfitCents: number;
  challengeCount: number;
}

export interface PropAggregateStatistics {
  totalChallenges: number;
  activeEvaluations: number;
  passedEvaluations: number;
  failedEvaluations: number;
  fundedAccounts: number;
  passRatePct: number;
  breachRatePct: number;
  totalFeesCents: number;
  totalPayoutsCents: number;
  netProfitabilityCents: number;
  netCashOutcomeCents: number;
  totalSimulatedTradingProfitCents: number;
  totalPendingPayoutsCents: number;
  byFirm: Record<
    string,
    { total: number; passed: number; failed: number; funded: number; netPnlCents: number; currency: string }
  >;
  byModel: Record<string, { total: number; passed: number; funded: number }>;
  byCurrency: Record<string, CurrencyAggregateFinancials>;
  isMultiCurrency: boolean;
  primaryCurrency: string;
  frequentBreachRules: Array<{ ruleKey: string; ruleName: string; count: number }>;
}

export function calculatePropAggregates(
  challengesWithEvals: Array<{
    id: string;
    propFirm: string;
    currency?: string;
    meta: PropLifecycleMetadata;
    evalResult: PropLifecycleEvaluationResult;
  }>
): PropAggregateStatistics {
  let totalFeesCents = 0;
  let totalPayoutsCents = 0;
  let totalPendingPayoutsCents = 0;
  let totalSimulatedTradingProfitCents = 0;
  let activeEvals = 0;
  let passedEvals = 0;
  let failedEvals = 0;
  let fundedCount = 0;

  const byFirm: Record<
    string,
    { total: number; passed: number; failed: number; funded: number; netPnlCents: number; currency: string }
  > = {};
  const byModel: Record<string, { total: number; passed: number; funded: number }> = {};
  const breachRuleCounts: Record<string, { name: string; count: number }> = {};
  const byCurrency: Record<string, CurrencyAggregateFinancials> = {};

  for (const c of challengesWithEvals) {
    const { propFirm, meta, evalResult } = c;
    const firmKey = propFirm || "Other";
    const modelKey = meta.accountModel || "two_step";
    const cur = (c.currency || "USD").toUpperCase();

    const feeCents = meta.accountCostCents || 0;
    const pnlCents = evalResult.netProfitCents || 0;

    totalFeesCents += feeCents;
    totalSimulatedTradingProfitCents += pnlCents;

    let challengePayoutsCents = 0;
    let challengePendingPayoutsCents = 0;
    for (const p of meta.payouts) {
      if (p.status === "paid" || p.status === "approved") {
        totalPayoutsCents += p.netTraderPayoutCents;
        challengePayoutsCents += p.netTraderPayoutCents;
      } else if (p.status === "requested") {
        totalPendingPayoutsCents += p.netTraderPayoutCents;
        challengePendingPayoutsCents += p.netTraderPayoutCents;
      }
    }

    if (!byCurrency[cur]) {
      byCurrency[cur] = {
        currency: cur,
        totalFeesCents: 0,
        totalPayoutsCents: 0,
        totalPendingPayoutsCents: 0,
        netCashOutcomeCents: 0,
        simulatedTradingProfitCents: 0,
        challengeCount: 0,
      };
    }
    byCurrency[cur].totalFeesCents += feeCents;
    byCurrency[cur].totalPayoutsCents += challengePayoutsCents;
    byCurrency[cur].totalPendingPayoutsCents += challengePendingPayoutsCents;
    byCurrency[cur].netCashOutcomeCents += (challengePayoutsCents - feeCents);
    byCurrency[cur].simulatedTradingProfitCents += pnlCents;
    byCurrency[cur].challengeCount++;

    if (!byFirm[firmKey]) {
      byFirm[firmKey] = { total: 0, passed: 0, failed: 0, funded: 0, netPnlCents: 0, currency: cur };
    }
    byFirm[firmKey].total++;
    byFirm[firmKey].netPnlCents += pnlCents;
    byFirm[firmKey].currency = cur;

    if (!byModel[modelKey]) {
      byModel[modelKey] = { total: 0, passed: 0, funded: 0 };
    }
    byModel[modelKey].total++;

    if (evalResult.status === "funded") {
      fundedCount++;
      byFirm[firmKey].funded++;
      byModel[modelKey].funded++;
    } else if (evalResult.status === "passed") {
      passedEvals++;
      byFirm[firmKey].passed++;
      byModel[modelKey].passed++;
    } else if (evalResult.status === "breached" || evalResult.status === "failed") {
      failedEvals++;
      byFirm[firmKey].failed++;
    } else {
      activeEvals++;
    }

    for (const v of evalResult.violations) {
      if (!breachRuleCounts[v.ruleKey]) {
        breachRuleCounts[v.ruleKey] = { name: v.ruleName, count: 0 };
      }
      breachRuleCounts[v.ruleKey].count++;
    }
  }

  const completedEvals = passedEvals + failedEvals;
  const passRatePct = completedEvals > 0 ? Math.round((passedEvals / completedEvals) * 1000) / 10 : 0;
  const breachRatePct = completedEvals > 0 ? Math.round((failedEvals / completedEvals) * 1000) / 10 : 0;

  const frequentBreachRules = Object.entries(breachRuleCounts)
    .map(([ruleKey, val]) => ({ ruleKey, ruleName: val.name, count: val.count }))
    .sort((a, b) => b.count - a.count);

  const netCashOutcomeCents = totalPayoutsCents - totalFeesCents;
  const currencies = Object.keys(byCurrency);
  const isMultiCurrency = currencies.length > 1;
  const primaryCurrency = currencies.length === 1 ? currencies[0] : (currencies[0] || "USD");

  return {
    totalChallenges: challengesWithEvals.length,
    activeEvaluations: activeEvals,
    passedEvaluations: passedEvals,
    failedEvaluations: failedEvals,
    fundedAccounts: fundedCount,
    passRatePct,
    breachRatePct,
    totalFeesCents,
    totalPayoutsCents,
    netProfitabilityCents: netCashOutcomeCents,
    netCashOutcomeCents,
    totalSimulatedTradingProfitCents,
    totalPendingPayoutsCents,
    byFirm,
    byModel,
    byCurrency,
    isMultiCurrency,
    primaryCurrency,
    frequentBreachRules,
  };
}

// ---------------------------------------------------------------------------
// Rule Simulation & Hypothetical Risk What-If Calculator
// ---------------------------------------------------------------------------

export interface RuleSimulationInput {
  hypotheticalPnlCents: number; // e.g. -50000 (-$500), +100000 (+$1,000)
  floatingDrawdownCents?: number;
  hypotheticalWithdrawalCents?: number;
  isNewTradingDay?: boolean;
}

export interface RuleSimulationResult {
  projectedBalanceCents: number;
  projectedEquityCents: number;
  projectedNetProfitCents: number;
  projectedDailyLossCents: number;
  projectedDailyLossUsedPct: number | null;
  projectedDailyLossBreached: boolean;
  projectedDrawdownCents: number;
  projectedDrawdownUsedPct: number | null;
  projectedDrawdownBreached: boolean;
  projectedConsistencyPct: number | null;
  projectedConsistencyBreached: boolean;
  projectedProfitTargetProgressPct: number | null;
  projectedProfitTargetReached: boolean;
  isSafe: boolean;
  breachWarnings: string[];
}

export function simulateHypotheticalScenario(
  evalResult: PropLifecycleEvaluationResult,
  input: RuleSimulationInput
): RuleSimulationResult {
  const pnl = input.hypotheticalPnlCents || 0;
  const floating = input.floatingDrawdownCents || 0;
  const withdrawal = input.hypotheticalWithdrawalCents || 0;

  const projectedBalanceCents = evalResult.currentBalanceCents + pnl - withdrawal;
  const projectedEquityCents = projectedBalanceCents - floating;
  const projectedNetProfitCents = projectedBalanceCents - evalResult.startingBalanceCents;

  // Projected Daily Loss
  const currentDayLossCents = evalResult.todayLossCents;
  const projectedDayPnl = input.isNewTradingDay
    ? pnl
    : (currentDayLossCents > 0 ? -currentDayLossCents : 0) + pnl;
  const projectedDailyLossCents = projectedDayPnl < 0 ? Math.abs(projectedDayPnl) : 0;
  const dailyLimit = evalResult.dailyLossLimitCents;
  const projectedDailyLossBreached = dailyLimit ? projectedDailyLossCents >= dailyLimit : false;
  const projectedDailyLossUsedPct = dailyLimit && dailyLimit > 0
    ? Math.round((projectedDailyLossCents / dailyLimit) * 100)
    : null;

  // Projected Drawdown
  const activePhase = evalResult.activePhase;
  const projectedHwm = Math.max(evalResult.highWaterMarkCents, projectedBalanceCents, projectedEquityCents);
  const drawdownBasis = activePhase.drawdownBasis || "balance";
  const refBalance = drawdownBasis === "equity" ? projectedEquityCents : projectedBalanceCents;

  let projectedDrawdownCents = 0;
  if (activePhase.drawdownType === "trailing") {
    projectedDrawdownCents = Math.max(0, projectedHwm - refBalance);
  } else {
    projectedDrawdownCents = Math.max(0, evalResult.startingBalanceCents - refBalance);
  }
  const maxDdLimit = evalResult.maxDrawdownLimitCents;
  const projectedDrawdownBreached = maxDdLimit ? projectedDrawdownCents >= maxDdLimit : false;
  const projectedDrawdownUsedPct = maxDdLimit && maxDdLimit > 0
    ? Math.round((projectedDrawdownCents / maxDdLimit) * 100)
    : null;

  // Projected Consistency
  const consistencyRule = activePhase.rules.find((r) => r.ruleKey === "consistency");
  let thresholdPct = consistencyRule?.config?.threshold != null ? Number(consistencyRule.config.threshold) : null;
  if (thresholdPct !== null && thresholdPct > 100) {
    thresholdPct = thresholdPct <= 10000 ? Math.round(thresholdPct / 100) : 50;
  }
  let projectedConsistencyPct: number | null = null;
  let projectedConsistencyBreached = false;
  if (thresholdPct && projectedNetProfitCents > 0) {
    const projectedBestDay = Math.max(
      evalResult.bestDayProfitCents,
      pnl > 0 ? (input.isNewTradingDay ? pnl : evalResult.bestDayProfitCents + pnl) : 0
    );
    projectedConsistencyPct = Math.min(100, Math.max(0, Math.round((projectedBestDay / projectedNetProfitCents) * 100)));
    projectedConsistencyBreached = projectedConsistencyPct > thresholdPct;
  }

  // Projected Profit Target
  const targetCents = activePhase.profitTargetCents;
  let projectedProfitTargetProgressPct: number | null = null;
  let projectedProfitTargetReached = false;
  if (targetCents && targetCents > 0) {
    projectedProfitTargetProgressPct = Math.round((projectedNetProfitCents / targetCents) * 100);
    projectedProfitTargetReached = projectedNetProfitCents >= targetCents;
  }

  const breachWarnings: string[] = [];
  if (projectedDailyLossBreached) {
    breachWarnings.push(`Daily loss limit of $${((dailyLimit || 0) / 100).toFixed(2)} would be breached (projected loss: $${(projectedDailyLossCents / 100).toFixed(2)}).`);
  }
  if (projectedDrawdownBreached) {
    breachWarnings.push(`Maximum ${activePhase.drawdownType} drawdown of $${((maxDdLimit || 0) / 100).toFixed(2)} would be breached (projected DD: $${(projectedDrawdownCents / 100).toFixed(2)}).`);
  }
  if (projectedConsistencyBreached && thresholdPct) {
    breachWarnings.push(`Consistency threshold of ${thresholdPct}% would be exceeded (${projectedConsistencyPct}% projected concentration).`);
  }

  const isSafe = !projectedDailyLossBreached && !projectedDrawdownBreached && !projectedConsistencyBreached;

  return {
    projectedBalanceCents,
    projectedEquityCents,
    projectedNetProfitCents,
    projectedDailyLossCents,
    projectedDailyLossUsedPct,
    projectedDailyLossBreached,
    projectedDrawdownCents,
    projectedDrawdownUsedPct,
    projectedDrawdownBreached,
    projectedConsistencyPct,
    projectedConsistencyBreached,
    projectedProfitTargetProgressPct,
    projectedProfitTargetReached,
    isSafe,
    breachWarnings,
  };
}
