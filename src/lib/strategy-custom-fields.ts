/**
 * DnD — Dynamic Strategy Custom Fields
 * Allows trading strategies to define flexible, version-aware trade information fields
 * (e.g. ICT, Supply & Demand, Trend Following, SMC, Order Flow, Price Action).
 */

export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "decimal"
  | "boolean"
  | "select"
  | "multiselect"
  | "tags"
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

/**
 * Validates a single custom field value based on its type definition and constraints.
 */
export function validateCustomFieldValue(
  field: StrategyCustomField,
  val: any
): { valid: boolean; error?: string } {
  if (field.required) {
    if (
      val === undefined ||
      val === null ||
      val === "" ||
      (Array.isArray(val) && val.length === 0)
    ) {
      return { valid: false, error: `${field.name} is required.` };
    }
  }

  if (val === undefined || val === null || val === "") {
    return { valid: true };
  }

  switch (field.type) {
    case "number": {
      const num = Number(val);
      if (isNaN(num)) {
        return { valid: false, error: `${field.name} must be a valid number.` };
      }
      return { valid: true };
    }
    case "decimal": {
      const dec = parseFloat(String(val).replace(/,/g, "."));
      if (isNaN(dec)) {
        return { valid: false, error: `${field.name} must be a valid decimal number.` };
      }
      return { valid: true };
    }
    case "boolean": {
      if (typeof val !== "boolean") {
        return { valid: false, error: `${field.name} must be true or false.` };
      }
      return { valid: true };
    }
    case "select": {
      if (field.options && field.options.length > 0 && !field.options.includes(String(val))) {
        return { valid: false, error: `${field.name} must be one of the configured options.` };
      }
      return { valid: true };
    }
    case "multiselect":
    case "tags": {
      if (!Array.isArray(val)) {
        return { valid: false, error: `${field.name} must be an array of values.` };
      }
      return { valid: true };
    }
    case "date": {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        return { valid: false, error: `${field.name} must be a valid date.` };
      }
      return { valid: true };
    }
    case "text":
    case "textarea": {
      if (typeof val !== "string" && typeof val !== "number") {
        return { valid: false, error: `${field.name} must be text.` };
      }
      return { valid: true };
    }
    default:
      return { valid: true };
  }
}

/**
 * Extracts and merges active strategy fields with any historical custom field values
 * preserved in trade records, ensuring renamed or disabled fields are never lost.
 */
export function extractAllCustomFieldsForDisplay(
  activeFields: StrategyCustomField[],
  storedRecord?: Record<string, any> | null
): Array<{ id: string; name: string; type: CustomFieldType; value: any; isHistorical?: boolean }> {
  const result: Array<{ id: string; name: string; type: CustomFieldType; value: any; isHistorical?: boolean }> = [];
  const handledIds = new Set<string>();

  // 1. Process active strategy fields
  for (const f of activeFields) {
    handledIds.add(f.id);
    const val = storedRecord?.[f.id];
    if (val !== undefined && val !== null && val !== "") {
      result.push({
        id: f.id,
        name: f.name,
        type: f.type,
        value: val,
        isHistorical: false,
      });
    }
  }

  // 2. Discover any historical custom fields saved on this trade that no longer exist in the active strategy definition
  if (storedRecord && typeof storedRecord === "object") {
    for (const [key, val] of Object.entries(storedRecord)) {
      if (!handledIds.has(key) && val !== undefined && val !== null && val !== "") {
        result.push({
          id: key,
          name: key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
          type: Array.isArray(val) ? "tags" : typeof val === "boolean" ? "boolean" : "text",
          value: val,
          isHistorical: true,
        });
      }
    }
  }

  return result;
}

/**
 * Validates a map of custom field values against a strategy's field definitions.
 */
export function validateStrategyCustomFields(
  fields: StrategyCustomField[],
  values: Record<string, any>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.enabled === false) continue;
    const res = validateCustomFieldValue(field, values?.[field.id]);
    if (!res.valid && res.error) {
      errors[field.id] = res.error;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

