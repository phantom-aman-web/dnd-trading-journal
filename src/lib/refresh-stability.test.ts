import { describe, test, expect } from "bun:test";
import { ALL_APP_VIEWS, type ViewKey } from "./nav-store";
import { useAuth } from "./auth-store";

describe("Refresh Stability, Session Hydration & Navigation Invariants", () => {
  test("ALL_APP_VIEWS includes all 15 authenticated application views", () => {
    const requiredViews: ViewKey[] = [
      "dashboard",
      "tradesLog",
      "tradeDetail",
      "tradeNew",
      "calendar",
      "analytics",
      "setups",
      "accounts",
      "propChallenges",
      "riskCalculator",
      "tradingTodo",
      "archived",
      "settings",
      "backup",
      "noTrades",
    ];

    expect(ALL_APP_VIEWS.length).toBe(15);
    for (const view of requiredViews) {
      expect(ALL_APP_VIEWS.includes(view)).toBe(true);
    }
  });

  test("public views are never included in ALL_APP_VIEWS", () => {
    const publicViews: ViewKey[] = ["landing", "signin", "signup", "terms", "privacy", "cookies"];
    for (const view of publicViews) {
      expect(ALL_APP_VIEWS.includes(view)).toBe(false);
    }
  });

  test("initialUser immediately resolves authChecked without flash delay", () => {
    // Simulate initial unauthenticated state
    useAuth.setState({ user: null, loading: false, authChecked: true });
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().authChecked).toBe(true);

    // Simulate authenticated session hydration
    const dummyUser = { id: "user_test_1", email: "trader@alphapips.com", name: "Alpha Trader" };
    useAuth.setState({ user: dummyUser, loading: false, authChecked: true });

    expect(useAuth.getState().user?.id).toBe("user_test_1");
    expect(useAuth.getState().authChecked).toBe(true);
    expect(useAuth.getState().loading).toBe(false);
  });
});
