import { describe, it, expect } from "bun:test";
import {
  validateCustomFieldValue,
  extractAllCustomFieldsForDisplay,
  StrategyCustomField,
} from "./strategy-custom-fields";

describe("Custom Strategy Fields — Validation & Historical Preservation (Feature 8)", () => {
  it("validates all supported field types correctly (including textarea and date)", () => {
    // 1. Textarea / Long Text
    const textareaField: StrategyCustomField = {
      id: "macroContext",
      name: "Macro Context",
      type: "textarea",
      required: true,
      order: 0,
    };
    expect(validateCustomFieldValue(textareaField, "").valid).toBe(false);
    expect(validateCustomFieldValue(textareaField, "Detailed Fed commentary notes").valid).toBe(true);

    // 2. Date Field
    const dateField: StrategyCustomField = {
      id: "invalidationDate",
      name: "Invalidation Date",
      type: "date",
      required: true,
      order: 1,
    };
    expect(validateCustomFieldValue(dateField, "").valid).toBe(false);
    expect(validateCustomFieldValue(dateField, "not-a-date").valid).toBe(false);
    expect(validateCustomFieldValue(dateField, "2026-11-20").valid).toBe(true);

    // 3. Decimal Field (European comma & standard dot)
    const decimalField: StrategyCustomField = {
      id: "orderBlockLevel",
      name: "Order Block Level",
      type: "decimal",
      order: 2,
    };
    expect(validateCustomFieldValue(decimalField, "1.08500").valid).toBe(true);
    expect(validateCustomFieldValue(decimalField, "1,08500").valid).toBe(true);
    expect(validateCustomFieldValue(decimalField, "invalid_number").valid).toBe(false);

    // 4. Boolean Field
    const boolField: StrategyCustomField = {
      id: "fvgFilled",
      name: "FVG Filled",
      type: "boolean",
      order: 3,
    };
    expect(validateCustomFieldValue(boolField, true).valid).toBe(true);
    expect(validateCustomFieldValue(boolField, false).valid).toBe(true);
    expect(validateCustomFieldValue(boolField, "yes").valid).toBe(false);

    // 5. Select Field with Options
    const selectField: StrategyCustomField = {
      id: "sessionSweep",
      name: "Session Sweep",
      type: "select",
      options: ["Asian High", "Asian Low", "London High"],
      order: 4,
    };
    expect(validateCustomFieldValue(selectField, "Asian High").valid).toBe(true);
    expect(validateCustomFieldValue(selectField, "NY High").valid).toBe(false);

    // 6. Multiselect / Tags Field
    const tagsField: StrategyCustomField = {
      id: "liquidityPools",
      name: "Liquidity Pools",
      type: "tags",
      order: 5,
    };
    expect(validateCustomFieldValue(tagsField, ["PDH", "PWH"]).valid).toBe(true);
    expect(validateCustomFieldValue(tagsField, "PDH").valid).toBe(false);
  });

  it("preserves historical custom field values when strategy definitions change", () => {
    // Current strategy version fields (only 1 field remains active)
    const activeStrategyFields: StrategyCustomField[] = [
      {
        id: "dailyBias",
        name: "Daily Bias",
        type: "select",
        options: ["Bullish", "Bearish"],
        order: 0,
      },
    ];

    // Older trade saved with historical fields that were later renamed or deleted in v2
    const tradeRecordedCustomFields = {
      dailyBias: "Bullish",
      legacyEntryTrigger: "Silver Bullet FVG", // Old field no longer in v2
      invalidationPips: "15.5", // Old field no longer in v2
    };

    const displayList = extractAllCustomFieldsForDisplay(activeStrategyFields, tradeRecordedCustomFields);

    // Should include the active field
    const biasItem = displayList.find((i) => i.id === "dailyBias");
    expect(biasItem).toBeDefined();
    expect(biasItem?.value).toBe("Bullish");
    expect(biasItem?.isHistorical).toBe(false);

    // Should seamlessly preserve and include historical fields with isHistorical: true
    const legacyTrigger = displayList.find((i) => i.id === "legacyEntryTrigger");
    expect(legacyTrigger).toBeDefined();
    expect(legacyTrigger?.value).toBe("Silver Bullet FVG");
    expect(legacyTrigger?.isHistorical).toBe(true);

    const legacyPips = displayList.find((i) => i.id === "invalidationPips");
    expect(legacyPips).toBeDefined();
    expect(legacyPips?.value).toBe("15.5");
    expect(legacyPips?.isHistorical).toBe(true);
  });
});
