"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";

export type WidgetSize = "half" | "full";

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  description: string;
  visible: boolean;
  size: WidgetSize;
  order: number;
}

export const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: "metrics_summary",
    title: "Core Performance Metrics",
    description: "Net P&L, Win Rate, Total Trades, and Profit Factor cards",
    visible: true,
    size: "full",
    order: 0,
  },
  {
    id: "equity_curve",
    title: "Account Equity Progression",
    description: "Interactive spline equity and R progression chart",
    visible: true,
    size: "full",
    order: 1,
  },
  {
    id: "daily_pnl",
    title: "Daily P&L Distribution",
    description: "Daily gains, losses, and day-by-day outcome breakdown",
    visible: true,
    size: "half",
    order: 2,
  },
  {
    id: "r_distribution",
    title: "R-Multiple Distribution",
    description: "Histogram of trades distributed across R-multiples",
    visible: true,
    size: "half",
    order: 3,
  },
  {
    id: "process_adherence",
    title: "Process & Rule Adherence",
    description: "Rule compliance percentage, discipline and violations",
    visible: true,
    size: "half",
    order: 4,
  },
  {
    id: "long_vs_short",
    title: "Long vs Short Breakdown",
    description: "Comparative performance metrics between Long and Short bias",
    visible: true,
    size: "half",
    order: 5,
  },
  {
    id: "favorite_trades",
    title: "Favorite Trades Spotlight",
    description: "Quick access to your bookmarked and starred high-value trades",
    visible: true,
    size: "full",
    order: 6,
  },
  {
    id: "recent_trades",
    title: "Recent Trades Feed",
    description: "Latest executions with side, R-return, and status",
    visible: true,
    size: "full",
    order: 7,
  },
];

interface DashboardLayoutState {
  widgets: DashboardWidgetConfig[];
  editMode: boolean;
  setEditMode: (active: boolean) => void;
  toggleVisibility: (widgetId: string) => void;
  setSize: (widgetId: string, size: WidgetSize) => void;
  moveWidget: (widgetId: string, direction: "up" | "down") => void;
  reorderWidgets: (newOrderedIds: string[]) => void;
  resetToDefault: () => void;
  getSortedWidgets: () => DashboardWidgetConfig[];
}

export const useDashboardLayout = create<DashboardLayoutState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      editMode: false,

      setEditMode: (active) => set({ editMode: active }),

      toggleVisibility: (widgetId) => {
        set((state) => {
          const updated = state.widgets.map((w) =>
            w.id === widgetId ? { ...w, visible: !w.visible } : w
          );
          return { widgets: updated };
        });
      },

      setSize: (widgetId, size) => {
        set((state) => {
          const updated = state.widgets.map((w) =>
            w.id === widgetId ? { ...w, size } : w
          );
          return { widgets: updated };
        });
      },

      moveWidget: (widgetId, direction) => {
        const sorted = get().getSortedWidgets();
        const index = sorted.findIndex((w) => w.id === widgetId);
        if (index === -1) return;

        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= sorted.length) return;

        const itemA = sorted[index];
        const itemB = sorted[targetIndex];

        const updated = get().widgets.map((w) => {
          if (w.id === itemA.id) return { ...w, order: targetIndex };
          if (w.id === itemB.id) return { ...w, order: index };
          return w;
        });

        set({ widgets: updated });
      },

      reorderWidgets: (newOrderedIds) => {
        set((state) => {
          const idToOrder = new Map(newOrderedIds.map((id, index) => [id, index]));
          const updated = state.widgets.map((w) => ({
            ...w,
            order: idToOrder.has(w.id) ? (idToOrder.get(w.id) as number) : w.order,
          }));
          return { widgets: updated };
        });
      },

      resetToDefault: () => {
        set({ widgets: DEFAULTWIDGETSCopy() });
        toast.success("Dashboard layout reset to default.");
      },

      getSortedWidgets: () => {
        return [...get().widgets].sort((a, b) => a.order - b.order);
      },
    }),
    {
      name: "alphapips-dashboard-layout",
      storage: createJSONStorage(() => localStorage),
      // Merge with default widgets if new widgets were added to the codebase
      merge: (persistedState: unknown, currentState: DashboardLayoutState) => {
        const p = persistedState as { widgets?: Partial<DashboardWidgetConfig>[] } | null;
        if (!p || !Array.isArray(p.widgets)) {
          return currentState;
        }
        const persistedMap = new Map<string, Partial<DashboardWidgetConfig>>(
          p.widgets
            .filter((w): w is Partial<DashboardWidgetConfig> & { id: string } => !!w && typeof w.id === "string")
            .map((w) => [w.id, w])
        );
        const mergedWidgets = DEFAULT_WIDGETS.map((defaultW) => {
          const saved = persistedMap.get(defaultW.id);
          if (!saved) return defaultW;
          return {
            ...defaultW,
            visible: typeof saved.visible === "boolean" ? saved.visible : defaultW.visible,
            size: saved.size === "half" || saved.size === "full" ? saved.size : defaultW.size,
            order: typeof saved.order === "number" ? saved.order : defaultW.order,
          };
        });
        return {
          ...currentState,
          widgets: mergedWidgets,
        };
      },
    }
  )
);

function DEFAULTWIDGETSCopy(): DashboardWidgetConfig[] {
  return DEFAULT_WIDGETS.map((w) => ({ ...w }));
}
