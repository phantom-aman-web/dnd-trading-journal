import { describe, expect, test } from "bun:test";

interface FilterState {
  accountId?: string;
  setupId?: string;
  direction?: string;
  outcome?: string;
  search?: string;
}

function sanitizePresetFilters(
  rawJson: string,
  availableAccountIds: string[],
  availableStrategyIds: string[]
): FilterState {
  try {
    const raw = JSON.parse(rawJson) as FilterState;
    return {
      accountId:
        raw.accountId && raw.accountId !== "all" && availableAccountIds.length > 0
          ? availableAccountIds.includes(raw.accountId)
            ? raw.accountId
            : "all"
          : raw.accountId || "all",
      setupId:
        raw.setupId && raw.setupId !== "all" && availableStrategyIds.length > 0
          ? availableStrategyIds.includes(raw.setupId)
            ? raw.setupId
            : "all"
          : raw.setupId || "all",
      direction: raw.direction || "all",
      outcome: raw.outcome || "all",
      search: raw.search || "",
    };
  } catch {
    return {
      accountId: "all",
      setupId: "all",
      direction: "all",
      outcome: "all",
      search: "",
    };
  }
}

describe("Saved Filter Presets Sanitization & Persistence", () => {
  test("PRESET-1: Valid filters restore correctly", () => {
    const raw = JSON.stringify({
      accountId: "acc-1",
      setupId: "strat-1",
      direction: "long",
      outcome: "win",
      search: "XAUUSD",
    });

    const sanitized = sanitizePresetFilters(raw, ["acc-1", "acc-2"], ["strat-1", "strat-2"]);
    expect(sanitized.accountId).toBe("acc-1");
    expect(sanitized.setupId).toBe("strat-1");
    expect(sanitized.direction).toBe("long");
    expect(sanitized.outcome).toBe("win");
    expect(sanitized.search).toBe("XAUUSD");
  });

  test("PRESET-2: Stale/deleted account reference falls back to 'all'", () => {
    const raw = JSON.stringify({
      accountId: "deleted-account-999",
      setupId: "strat-1",
      direction: "short",
      outcome: "loss",
    });

    const sanitized = sanitizePresetFilters(raw, ["acc-1", "acc-2"], ["strat-1"]);
    expect(sanitized.accountId).toBe("all");
    expect(sanitized.setupId).toBe("strat-1");
    expect(sanitized.direction).toBe("short");
    expect(sanitized.outcome).toBe("loss");
  });

  test("PRESET-3: Stale/deleted strategy reference falls back to 'all'", () => {
    const raw = JSON.stringify({
      accountId: "acc-1",
      setupId: "deleted-strat-xyz",
      direction: "all",
      outcome: "win",
    });

    const sanitized = sanitizePresetFilters(raw, ["acc-1"], ["active-strat-1"]);
    expect(sanitized.accountId).toBe("acc-1");
    expect(sanitized.setupId).toBe("all");
  });

  test("PRESET-4: Corrupt or invalid JSON falls back safely without throwing", () => {
    const raw = "{ invalid json string ";
    const sanitized = sanitizePresetFilters(raw, ["acc-1"], ["strat-1"]);
    expect(sanitized.accountId).toBe("all");
    expect(sanitized.setupId).toBe("all");
    expect(sanitized.direction).toBe("all");
    expect(sanitized.outcome).toBe("all");
    expect(sanitized.search).toBe("");
  });
});

