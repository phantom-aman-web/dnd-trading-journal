"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type FloatingWidgetId =
  | "drawdown_monitor"
  | "quick_risk_calculator"
  | "daily_risk_limit"
  | "quick_notes"
  | "focus_timer"
  | "trading_tip"
  | "sticky_notes";

export interface FloatingWidgetConfig {
  id: FloatingWidgetId;
  title: string;
  description: string;
  category: "risk" | "journal" | "productivity" | "education";
  visible: boolean;
  minimized: boolean;
  x: number;
  y: number;
  width: number;
  height?: number;
  isPinned?: boolean;
  customSettings?: Record<string, any>;
}

export const APPROVED_FLOATING_WIDGET_IDS: FloatingWidgetId[] = [
  "drawdown_monitor",
  "quick_risk_calculator",
  "daily_risk_limit",
  "quick_notes",
  "focus_timer",
  "trading_tip",
  "sticky_notes",
];

export interface WidgetSizeConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

export const WIDGET_SIZE_CONSTRAINTS: Record<FloatingWidgetId, WidgetSizeConstraints> = {
  drawdown_monitor: {
    minWidth: 280,
    maxWidth: 520,
    minHeight: 180,
    maxHeight: 450,
    defaultWidth: 320,
    defaultHeight: 220,
  },
  quick_risk_calculator: {
    minWidth: 340,
    maxWidth: 640,
    minHeight: 380,
    maxHeight: 750,
    defaultWidth: 360,
    defaultHeight: 480,
  },
  daily_risk_limit: {
    minWidth: 280,
    maxWidth: 520,
    minHeight: 190,
    maxHeight: 460,
    defaultWidth: 320,
    defaultHeight: 240,
  },
  quick_notes: {
    minWidth: 300,
    maxWidth: 750,
    minHeight: 280,
    maxHeight: 750,
    defaultWidth: 360,
    defaultHeight: 400,
  },
  focus_timer: {
    minWidth: 260,
    maxWidth: 480,
    minHeight: 220,
    maxHeight: 480,
    defaultWidth: 300,
    defaultHeight: 280,
  },
  trading_tip: {
    minWidth: 320,
    maxWidth: 680,
    minHeight: 260,
    maxHeight: 680,
    defaultWidth: 380,
    defaultHeight: 360,
  },
  sticky_notes: {
    minWidth: 240,
    maxWidth: 520,
    minHeight: 200,
    maxHeight: 580,
    defaultWidth: 280,
    defaultHeight: 280,
  },
};

export const INITIAL_FLOATING_WIDGETS: FloatingWidgetConfig[] = [
  {
    id: "drawdown_monitor",
    title: "Drawdown Monitor",
    description: "Monitors overall account & prop challenge maximum drawdown limits and cushion.",
    category: "risk",
    visible: false,
    minimized: false,
    x: 24,
    y: 80,
    width: 320,
    height: 220,
  },
  {
    id: "quick_risk_calculator",
    title: "Quick Risk Calculator",
    description: "Instrument-aware position sizing calculator using live account balance & conservative rounding.",
    category: "risk",
    visible: false,
    minimized: false,
    x: 360,
    y: 80,
    width: 360,
    height: 480,
  },
  {
    id: "daily_risk_limit",
    title: "Daily Risk Limit",
    description: "Tracks today's consumed risk allowance, remaining daily budget, and reset cycle.",
    category: "risk",
    visible: false,
    minimized: false,
    x: 740,
    y: 80,
    width: 320,
    height: 240,
  },
  {
    id: "quick_notes",
    title: "Quick Notes",
    description: "Fast floating notepad connected to journaling, sessions, and market observations.",
    category: "journal",
    visible: false,
    minimized: false,
    x: 24,
    y: 340,
    width: 360,
    height: 400,
  },
  {
    id: "focus_timer",
    title: "Focus Timer",
    description: "Accurate Pomodoro & activity countdown timer for backtesting, chart review, and journaling.",
    category: "productivity",
    visible: false,
    minimized: false,
    x: 400,
    y: 340,
    width: 300,
    height: 280,
  },
  {
    id: "trading_tip",
    title: "Trading Tip",
    description: "Curated practical advice on risk management, discipline, and execution psychology.",
    category: "education",
    visible: false,
    minimized: false,
    x: 720,
    y: 340,
    width: 380,
    height: 360,
  },
  {
    id: "sticky_notes",
    title: "Sticky Notes",
    description: "Tiny persistent personal notes for key price levels, bias reminders, and checklists.",
    category: "journal",
    visible: false,
    minimized: false,
    x: 1080,
    y: 80,
    width: 280,
    height: 280,
  },
];

interface FloatingWidgetsState {
  widgets: FloatingWidgetConfig[];
  managerOpen: boolean;
  toggleManager: () => void;
  setManagerOpen: (open: boolean) => void;
  toggleWidget: (id: FloatingWidgetId) => void;
  setWidgetVisible: (id: FloatingWidgetId, visible: boolean) => void;
  toggleMinimize: (id: FloatingWidgetId) => void;
  togglePin: (id: FloatingWidgetId) => void;
  setPosition: (id: FloatingWidgetId, x: number, y: number) => void;
  setSize: (id: FloatingWidgetId, width: number, height?: number) => void;
  setWidgetSettings: (id: FloatingWidgetId, settings: Record<string, any>) => void;
  bringToFront: (id: FloatingWidgetId) => void;
  resetAll: () => void;
  repositionAll: () => void;
  minimizeAll: () => void;
  restoreAll: () => void;
}

export const useFloatingWidgetsStore = create<FloatingWidgetsState>()(
  persist(
    (set, get) => ({
      widgets: INITIAL_FLOATING_WIDGETS,
      managerOpen: false,

      toggleManager: () => set((s) => ({ managerOpen: !s.managerOpen })),
      setManagerOpen: (open) => set({ managerOpen: open }),

      toggleWidget: (id) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, visible: !w.visible } : w
          ),
        })),

      setWidgetVisible: (id, visible) =>
        set((s) => ({
          widgets: s.widgets.map((w) => (w.id === id ? { ...w, visible } : w)),
        })),

      toggleMinimize: (id) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, minimized: !w.minimized } : w
          ),
        })),

      togglePin: (id) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, isPinned: !w.isPinned } : w
          ),
        })),

      setPosition: (id, x, y) =>
        set((s) => ({
          widgets: s.widgets.map((w) => (w.id === id ? { ...w, x, y } : w)),
        })),

      setSize: (id, width, height) =>
        set((s) => ({
          widgets: s.widgets.map((w) => {
            if (w.id !== id) return w;
            const constraints = WIDGET_SIZE_CONSTRAINTS[id];
            const clampedWidth = constraints
              ? Math.max(constraints.minWidth, Math.min(constraints.maxWidth, width))
              : width;
            const clampedHeight =
              constraints && typeof height === "number"
                ? Math.max(constraints.minHeight, Math.min(constraints.maxHeight, height))
                : height;
            return { ...w, width: clampedWidth, height: clampedHeight };
          }),
        })),

      setWidgetSettings: (id, settings) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id
              ? { ...w, customSettings: { ...(w.customSettings || {}), ...settings } }
              : w
          ),
        })),

      bringToFront: (id) => {
        const list = [...get().widgets];
        const idx = list.findIndex((w) => w.id === id);
        if (idx !== -1) {
          const [item] = list.splice(idx, 1);
          list.push(item);
          set({ widgets: list });
        }
      },

      resetAll: () => set({ widgets: INITIAL_FLOATING_WIDGETS }),

      repositionAll: () => {
        set({
          widgets: INITIAL_FLOATING_WIDGETS.map((init) => {
            const existing = get().widgets.find((w) => w.id === init.id);
            return existing
              ? {
                  ...existing,
                  x: init.x,
                  y: init.y,
                  width: init.width,
                  height: init.height,
                  minimized: false,
                }
              : init;
          }),
        });
      },

      minimizeAll: () =>
        set((s) => ({
          widgets: s.widgets.map((w) => ({ ...w, minimized: true })),
        })),

      restoreAll: () =>
        set((s) => ({
          widgets: s.widgets.map((w) => ({ ...w, minimized: false })),
        })),
    }),
    {
      name: "alphapips-floating-widgets",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState: any) => {
        if (!persistedState || !Array.isArray(persistedState.widgets)) {
          return { widgets: INITIAL_FLOATING_WIDGETS, managerOpen: false };
        }
        // Clean out obsolete widget IDs and merge approved 7 widgets
        const existingMap = new Map<string, any>();
        for (const w of persistedState.widgets) {
          if (w && w.id) {
            // Map old daily_drawdown to drawdown_monitor
            const mappedId = w.id === "daily_drawdown" ? "drawdown_monitor" : w.id;
            if (APPROVED_FLOATING_WIDGET_IDS.includes(mappedId as FloatingWidgetId)) {
              existingMap.set(mappedId, { ...w, id: mappedId });
            }
          }
        }

        const mergedWidgets = INITIAL_FLOATING_WIDGETS.map((initial) => {
          const existing = existingMap.get(initial.id);
          if (existing) {
            const constraints = WIDGET_SIZE_CONSTRAINTS[initial.id];
            const rawWidth = typeof existing.width === "number" ? existing.width : initial.width;
            const clampedWidth = constraints
              ? Math.max(constraints.minWidth, Math.min(constraints.maxWidth, rawWidth))
              : rawWidth;

            const rawHeight = typeof existing.height === "number" ? existing.height : initial.height;
            const clampedHeight = constraints && typeof rawHeight === "number"
              ? Math.max(constraints.minHeight, Math.min(constraints.maxHeight, rawHeight))
              : initial.height;

            return {
              ...initial,
              visible: typeof existing.visible === "boolean" ? existing.visible : initial.visible,
              minimized: typeof existing.minimized === "boolean" ? existing.minimized : initial.minimized,
              x: typeof existing.x === "number" ? existing.x : initial.x,
              y: typeof existing.y === "number" ? existing.y : initial.y,
              width: clampedWidth,
              height: clampedHeight,
              isPinned: existing.isPinned,
              customSettings: existing.customSettings,
            };
          }
          return initial;
        });

        return {
          widgets: mergedWidgets,
          managerOpen: false,
        };
      },
    }
  )
);
