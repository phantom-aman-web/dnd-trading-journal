/**
 * DnD — Dynamic Strategy Custom Fields
 * Allows trading strategies to define flexible, version-aware trade information fields
 * (e.g. ICT, Supply & Demand, Trend Following, SMC, Order Flow, Price Action).
 */

export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "date";

export interface StrategyCustomField {
  id: string;
  name: string;
  description?: string;
  type: CustomFieldType;
  required?: boolean;
  options?: string[]; // Options for select and multiselect
  defaultValue?: any;
  order: number;
  enabled?: boolean;
}

export const DEFAULT_ICT_FIELDS: StrategyCustomField[] = [
  {
    id: "weeklyBias",
    name: "Weekly Bias",
    description: "Higher timeframe weekly bias",
    type: "select",
    options: ["Bullish", "Bearish", "Neutral"],
    order: 0,
    enabled: true,
  },
  {
    id: "dailyBias",
    name: "Daily Bias",
    description: "Daily directional bias",
    type: "select",
    options: ["Bullish", "Bearish", "Neutral"],
    order: 1,
    enabled: true,
  },
  {
    id: "liquidityTargets",
    name: "Liquidity Targets",
    description: "Targeted liquidity pools",
    type: "multiselect",
    options: [
      "PDH",
      "PDL",
      "PWH",
      "PWL",
      "Equal Highs",
      "Equal Lows",
      "Buy-side Liquidity",
      "Sell-side Liquidity",
      "Session Liquidity",
    ],
    order: 2,
    enabled: true,
  },
  {
    id: "marketStructure",
    name: "Market Structure",
    description: "Observed market structure event",
    type: "multiselect",
    options: [
      "BOS",
      "MSS",
      "Displacement",
      "Protected High",
      "Protected Low",
      "Structure Shift",
    ],
    order: 3,
    enabled: true,
  },
  {
    id: "entryModel",
    name: "Entry Model",
    description: "Execution trigger model",
    type: "select",
    options: [
      "Liquidity Sweep",
      "Displacement",
      "FVG",
      "Order Block",
      "Breaker Block",
      "Mitigation Block",
      "SMT Divergence",
      "Retracement",
    ],
    order: 4,
    enabled: true,
  },
];

export const GENERAL_TRADE_FIELDS: StrategyCustomField[] = [
  {
    id: "marketCondition",
    name: "Market Condition",
    description: "Overall market regime (Trending, Range, Volatile)",
    type: "select",
    options: ["Trending Up", "Trending Down", "Consolidation / Range", "High Volatility", "Choppy"],
    order: 0,
    enabled: true,
  },
  {
    id: "primaryTimeframe",
    name: "Primary Timeframe",
    description: "Main chart timeframe used for execution",
    type: "select",
    options: ["1m", "5m", "15m", "1h", "4h", "Daily"],
    order: 1,
    enabled: true,
  },
  {
    id: "keyConfluence",
    name: "Key Confluences",
    description: "Key technical or macro factors supporting this setup",
    type: "text",
    order: 2,
    enabled: true,
  },
];

/**
 * Extracts custom trade fields from a StrategyVersion's rulesJson.
 * If hasStrategySelected is false, returns GENERAL_TRADE_FIELDS to avoid forcing ICT fields.
 * If a strategy is selected, returns the strategy's defined customFields.
 */
export function extractCustomFields(
  rulesJson: string | null | undefined,
  hasStrategySelected = true
): StrategyCustomField[] {
  if (!hasStrategySelected) {
    return GENERAL_TRADE_FIELDS;
  }

  if (!rulesJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(rulesJson);
    if (parsed && typeof parsed === "object") {
      const fields = (parsed as any).customFields;
      if (Array.isArray(fields) && fields.length > 0) {
        return fields
          .filter((f: any) => f && f.name && f.enabled !== false)
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      }
    }
  } catch {}

  return [];
}

/**
 * Serializes rules and custom fields together into the rulesJson payload.
 */
export function serializeRulesWithFields(
  rules: any[],
  customFields?: StrategyCustomField[]
): string {
  return JSON.stringify({
    rules,
    items: rules, // Dual-key for backwards compatibility with all extractChecklist variants
    customFields: customFields ?? [],
  });
}

