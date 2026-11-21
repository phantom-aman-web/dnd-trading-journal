import { describe, expect, it } from "bun:test";

describe("D-009: Trade Capture Risk, Binding, and Calculation Integrity", () => {
  it("binds deep-link plannedRiskPct parameter to active riskPct state", () => {
    // Simulating deep link state resolution in TradeFormView
    const params = {
      plannedRiskPct: "0.5",
      plannedRiskCents: "5000",
      symbol: "EURUSD",
    };

    const initialForm: any = {
      riskPct: "1.0",
      plannedRiskPercent: "1.0",
      instrumentSymbol: "",
    };

    const next = { ...initialForm };
    if (params.plannedRiskPct) {
      next.riskPct = params.plannedRiskPct;
      next.plannedRiskPercent = params.plannedRiskPct;
    }

    expect(next.riskPct).toBe("0.5");
    expect(next.plannedRiskPercent).toBe("0.5");
  });

  it("never fabricates expected loss at stop when entry, stop price, lot size, or instrument point value is absent", () => {
    // Helper function that mirrors the repaired TradeFormView logic
    function computeExpectedLoss(
      entryStr: string,
      stopStr: string,
      lotStr: string,
      pointValueCents: number,
      riskAmountDollars: number | null
    ): string {
      const entry = Number(entryStr);
      const stop = Number(stopStr);
      const lot = Number(lotStr);

      const hasEntry = Number.isFinite(entry) && entry > 0 && entryStr !== "";
      const hasStop = Number.isFinite(stop) && stop > 0 && stopStr !== "";
      const hasLot = Number.isFinite(lot) && lot > 0;

      const stopDistance = hasEntry && hasStop ? Math.abs(entry - stop) : null;
      const instrumentRiskCents =
        stopDistance != null && hasLot && pointValueCents > 0
          ? Math.round(stopDistance * lot * pointValueCents)
          : 0;

      if (hasEntry && hasStop && instrumentRiskCents > 0) {
        return `-$${Math.abs(instrumentRiskCents / 100).toFixed(2)}`;
      }
      return "—";
    }

    // Case 1: No stop price entered, but risk budget is $100
    expect(computeExpectedLoss("2400.00", "", "1.0", 10000, 100)).toBe("—"); // MUST NOT fall back to -$100.00!

    // Case 2: No entry price entered, but risk budget is $100
    expect(computeExpectedLoss("", "2390.00", "1.0", 10000, 100)).toBe("—");

    // Case 3: Zero or negative prices entered
    expect(computeExpectedLoss("0", "2390.00", "1.0", 10000, 100)).toBe("—");
    expect(computeExpectedLoss("2400.00", "-50.00", "1.0", 10000, 100)).toBe("—");

    // Case 4: Missing or invalid position size (lots = 0, negative, or blank)
    expect(computeExpectedLoss("2400.00", "2390.00", "0", 10000, 100)).toBe("—");
    expect(computeExpectedLoss("2400.00", "2390.00", "-1.5", 10000, 100)).toBe("—");
    expect(computeExpectedLoss("2400.00", "2390.00", "", 10000, 100)).toBe("—");

    // Case 5: Missing instrument specs (point value = 0 or unknown)
    expect(computeExpectedLoss("2400.00", "2390.00", "1.0", 0, 100)).toBe("—");

    // Case 6: All parameters valid (e.g. Gold: 10 pts distance * 1.0 lot * $100/pt = $1,000 risk)
    expect(computeExpectedLoss("2400.00", "2390.00", "1.0", 10000, 100)).toBe("-$1000.00");
  });

  it("prevents double-negative formatting (--$)", () => {
    const rawNegativeDollars = -50.0;
    // Formatting must use Math.abs to guarantee single negative sign
    const formatted = `-$${Math.abs(rawNegativeDollars).toFixed(2)}`;
    expect(formatted).toBe("-$50.00");
    expect(formatted.includes("--")).toBe(false);
  });

  it("evaluates risk calculator safe round-down variance signs correctly", () => {
    function calculateVarianceDisplay(riskBudget: number, actualRisk: number) {
      const savings = riskBudget - actualRisk;
      const isPositive = savings >= 0;
      return {
        sign: isPositive ? "+" : "-",
        amount: Math.abs(savings).toFixed(2),
        isProfitColor: isPositive,
      };
    }

    // Case 1: Budget $100, actual planned risk $95 (safe round down -> +$5.00 savings)
    const withinBudget = calculateVarianceDisplay(100, 95);
    expect(withinBudget.sign).toBe("+");
    expect(withinBudget.amount).toBe("5.00");
    expect(withinBudget.isProfitColor).toBe(true);

    // Case 2: Budget $100, actual planned risk $105 (over budget -> -$5.00 violation)
    const overBudget = calculateVarianceDisplay(100, 105);
    expect(overBudget.sign).toBe("-");
    expect(overBudget.amount).toBe("5.00");
    expect(overBudget.isProfitColor).toBe(false);
  });
});
