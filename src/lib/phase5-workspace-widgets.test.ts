import { describe, it, expect, beforeEach } from "bun:test";
import {
  useWorkspaceStore,
  SUPPORTED_PANEL_VIEWS,
  DEFAULT_PANELS,
} from "./workspace-store";
import {
  useFloatingWidgetsStore,
  APPROVED_FLOATING_WIDGET_IDS,
  WIDGET_SIZE_CONSTRAINTS,
} from "./floating-widgets-store";
import { usePrivacyStore, PRIVACY_MASK } from "./privacy-store";
import { computeAggregateMetrics, type TradeMetricRow } from "./financial-engine";

describe("Phase 5 Workstream D: Multi-Panel Workspace Verification", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().resetWorkspace();
  });

  it("REQ-P5-WS-01: should default to 2-col layout with 2 panels (50/50 split)", () => {
    const state = useWorkspaceStore.getState();
    expect(state.layout).toBe("2-col");
    expect(state.panels.length).toBe(2);
    expect(state.panels[0].view).toBe("tradesLog");
    expect(state.panels[0].sizePct).toBe(50);
    expect(state.panels[1].view).toBe("tradeDetail");
    expect(state.panels[1].sizePct).toBe(50);
  });

  it("REQ-P5-WS-02: should strictly exclude standalone noTrades view and include riskCalculator", () => {
    const viewKeys = SUPPORTED_PANEL_VIEWS.map((v) => v.key);
    expect(viewKeys).toContain("tradesLog");
    expect(viewKeys).toContain("tradeDetail");
    expect(viewKeys).toContain("analytics");
    expect(viewKeys).toContain("riskCalculator");
    expect(viewKeys).toContain("setups");
    expect(viewKeys).toContain("calendar");
    expect(viewKeys).toContain("accounts");
    expect(viewKeys).not.toContain("noTrades" as any);
  });

  it("REQ-P5-WS-01: should handle layout switching and normalize sizes evenly", () => {
    const store = useWorkspaceStore.getState();

    // Switch to 3-col (adaptive for wide screens)
    store.setLayout("3-col");
    let state = useWorkspaceStore.getState();
    expect(state.layout).toBe("3-col");
    expect(state.panels.length).toBe(3);
    state.panels.forEach((p) => {
      expect(p.sizePct).toBe(33);
    });

    // Switch to 4-grid
    store.setLayout("4-grid");
    state = useWorkspaceStore.getState();
    expect(state.layout).toBe("4-grid");
    expect(state.panels.length).toBe(4);
    state.panels.forEach((p) => {
      expect(p.sizePct).toBe(25);
    });

    // Switch back to 2-col
    store.setLayout("2-col");
    state = useWorkspaceStore.getState();
    expect(state.layout).toBe("2-col");
    expect(state.panels.length).toBe(2);
    expect(state.panels[0].sizePct).toBe(50);
    expect(state.panels[1].sizePct).toBe(50);
  });

  it("REQ-P5-WS-05: should synchronize linked trade context to tradeDetail panels", () => {
    const store = useWorkspaceStore.getState();
    store.setLinkedTrade("trade-uuid-1234");
    const state = useWorkspaceStore.getState();
    expect(state.linkedTradeId).toBe("trade-uuid-1234");

    const detailPanel = state.panels.find((p) => p.view === "tradeDetail");
    expect(detailPanel).toBeDefined();
    expect(detailPanel?.recordId).toBe("trade-uuid-1234");
  });

  it("REQ-P5-WS-01: should enforce panel count boundaries between 1 and 4", () => {
    const store = useWorkspaceStore.getState();

    // Add panels up to maximum 4
    store.addPanel("analytics");
    store.addPanel("calendar");
    store.addPanel("accounts"); // 5th panel should be rejected
    let state = useWorkspaceStore.getState();
    expect(state.panels.length).toBe(4);

    // Remove panels down to minimum 1
    store.removePanel(useWorkspaceStore.getState().panels[0].id);
    store.removePanel(useWorkspaceStore.getState().panels[0].id);
    store.removePanel(useWorkspaceStore.getState().panels[0].id);
    state = useWorkspaceStore.getState();
    expect(state.panels.length).toBe(1);

    // Further removal attempt should preserve the last panel
    store.removePanel(state.panels[0].id);
    state = useWorkspaceStore.getState();
    expect(state.panels.length).toBe(1);
  });
});

describe("Phase 5 Workstream E: Floating Widgets Verification", () => {
  beforeEach(() => {
    useFloatingWidgetsStore.getState().repositionAll();
  });

  it("REQ-P5-FW-01: should support exactly 7 approved floating widgets and zero unapproved widgets", () => {
    const state = useFloatingWidgetsStore.getState();
    expect(state.widgets.length).toBe(7);
    expect(APPROVED_FLOATING_WIDGET_IDS.length).toBe(7);

    const expectedIds = [
      "drawdown_monitor",
      "quick_risk_calculator",
      "daily_risk_limit",
      "quick_notes",
      "focus_timer",
      "trading_tip",
      "sticky_notes",
    ];

    expectedIds.forEach((id) => {
      expect(APPROVED_FLOATING_WIDGET_IDS).toContain(id as any);
      expect(state.widgets.some((w) => w.id === id)).toBe(true);
    });
  });

  it("REQ-P5-FW-02: should define rigorous size constraints for all 7 widgets", () => {
    APPROVED_FLOATING_WIDGET_IDS.forEach((id) => {
      const constraints = WIDGET_SIZE_CONSTRAINTS[id];
      expect(constraints).toBeDefined();
      expect(constraints.minWidth).toBeGreaterThan(0);
      expect(constraints.maxWidth).toBeGreaterThanOrEqual(constraints.minWidth);
      expect(constraints.minHeight).toBeGreaterThan(0);
      expect(constraints.maxHeight).toBeGreaterThanOrEqual(constraints.minHeight);
      expect(constraints.defaultWidth).toBeGreaterThanOrEqual(constraints.minWidth);
      expect(constraints.defaultWidth).toBeLessThanOrEqual(constraints.maxWidth);
      expect(constraints.defaultHeight).toBeGreaterThanOrEqual(constraints.minHeight);
      expect(constraints.defaultHeight).toBeLessThanOrEqual(constraints.maxHeight);
    });
  });

  it("REQ-P5-FW-03: should manage widget visibility, positioning, pinning, and minimization", () => {
    const store = useFloatingWidgetsStore.getState();

    // Toggle visibility
    store.setWidgetVisible("drawdown_monitor", true);
    expect(useFloatingWidgetsStore.getState().widgets.find((w) => w.id === "drawdown_monitor")?.visible).toBe(true);

    // Update position
    store.setPosition("drawdown_monitor", 150, 200);
    expect(useFloatingWidgetsStore.getState().widgets.find((w) => w.id === "drawdown_monitor")?.x).toBe(150);
    expect(useFloatingWidgetsStore.getState().widgets.find((w) => w.id === "drawdown_monitor")?.y).toBe(200);

    // Pin widget
    store.togglePin("drawdown_monitor");
    expect(useFloatingWidgetsStore.getState().widgets.find((w) => w.id === "drawdown_monitor")?.isPinned).toBe(true);

    // Minimize widget
    store.toggleMinimize("drawdown_monitor");
    expect(useFloatingWidgetsStore.getState().widgets.find((w) => w.id === "drawdown_monitor")?.minimized).toBe(true);
  });
});

describe("Phase 5 Workstream C & B: Preferences, Privacy & Dashboard Calculation Reconciliation", () => {
  it("REQ-P5-PR-04: should toggle privacy mask reliably without altering real numerical data", () => {
    const privacy = usePrivacyStore.getState();
    const initial = privacy.isPrivate;

    privacy.togglePrivacy();
    expect(usePrivacyStore.getState().isPrivate).toBe(!initial);

    // Reset back
    privacy.setPrivacy(false);
    expect(usePrivacyStore.getState().isPrivate).toBe(false);
    expect(PRIVACY_MASK).toBe("••••••");
  });

  it("REQ-P5-DB-01: should compute dashboard 5-metric KPI strip accurately from trade records", () => {
    // 3 Winning trades (+1R each, +$100 each), 1 Losing trade (-1R, -$50)
    const mockTrades: TradeMetricRow[] = [
      {
        id: "t1",
        netPnlCents: 10000,
        grossPnlCents: 10000,
        actualR: "1.0",
        outcome: "win",
        direction: "long",
        status: "closed",
        instrumentSymbol: "EURUSD",
        exitTime: "2026-09-01T10:00:00Z",
        entryTime: "2026-09-01T09:00:00Z",
      },
      {
        id: "t2",
        netPnlCents: 10000,
        grossPnlCents: 10000,
        actualR: "1.0",
        outcome: "win",
        direction: "long",
        status: "closed",
        instrumentSymbol: "EURUSD",
        exitTime: "2026-09-02T10:00:00Z",
        entryTime: "2026-09-02T09:00:00Z",
      },
      {
        id: "t3",
        netPnlCents: 10000,
        grossPnlCents: 10000,
        actualR: "1.0",
        outcome: "win",
        direction: "short",
        status: "closed",
        instrumentSymbol: "EURUSD",
        exitTime: "2026-09-03T10:00:00Z",
        entryTime: "2026-09-03T09:00:00Z",
      },
      {
        id: "t4",
        netPnlCents: -5000,
        grossPnlCents: -5000,
        actualR: "-1.0",
        outcome: "loss",
        direction: "short",
        status: "closed",
        instrumentSymbol: "EURUSD",
        exitTime: "2026-09-04T10:00:00Z",
        entryTime: "2026-09-04T09:00:00Z",
      },
    ];

    const metrics = computeAggregateMetrics(mockTrades, 10000000);

    // 1. Net P&L: 100 + 100 + 100 - 50 = $250.00 (25000 cents)
    expect(metrics.netPnlCents).toBe(25000);

    // 2. Win Rate: 3 wins / (3 wins + 1 loss) = 75.0%
    expect(metrics.winRate).toBe("0.75");

    // 3. Profit Factor: $300 win / $50 loss = 6.00
    expect(Number(metrics.profitFactor)).toBeCloseTo(6.0, 1);

    // 4. Trade Count: 4 closed trades
    expect(metrics.totalTrades).toBe(4);
    expect(metrics.closedTrades).toBe(4);

    // 5. Average R: (1.0 + 1.0 + 1.0 - 1.0) / 4 = +0.50R
    expect(Number(metrics.avgR)).toBeCloseTo(0.5, 2);
  });
});
