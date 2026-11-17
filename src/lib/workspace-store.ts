"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ViewKey } from "@/lib/nav-store";

export type WorkspaceLayoutType = "2-col" | "2-row" | "3-col" | "4-grid";

export interface WorkspacePanel {
  id: string;
  view: ViewKey;
  title: string;
  recordId?: string;
  sizePct: number; // Percentage width/height in panel layout
}

export const SUPPORTED_PANEL_VIEWS: { key: ViewKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tradesLog", label: "Trades Log" },
  { key: "tradeDetail", label: "Trade Detail" },
  { key: "calendar", label: "Trading Calendar" },
  { key: "analytics", label: "Analytics Engine" },
  { key: "accounts", label: "Accounts" },
  { key: "propChallenges", label: "Prop Challenges" },
  { key: "riskCalculator", label: "Risk Calculator" },
  { key: "setups", label: "Setups & Checklists" },
  { key: "tradingTodo", label: "Trading To-Do" },
  { key: "settings", label: "Preferences" },
  { key: "archived", label: "Archived Records" },
  { key: "backup", label: "Backup / Restore" },
];

export const DEFAULT_PANELS: WorkspacePanel[] = [
  { id: "panel-1", view: "tradesLog", title: "Trades Log", sizePct: 50 },
  { id: "panel-2", view: "tradeDetail", title: "Trade Detail", sizePct: 50 },
];

interface WorkspaceState {
  isActive: boolean;
  layout: WorkspaceLayoutType;
  panels: WorkspacePanel[];
  linkedTradeId: string | null;
  linkedNoTradeId: string | null;
  setIsActive: (active: boolean) => void;
  toggleWorkspace: () => void;
  setLayout: (layout: WorkspaceLayoutType) => void;
  setPanelView: (panelId: string, view: ViewKey, recordId?: string) => void;
  setLinkedTrade: (tradeId: string) => void;
  setLinkedNoTrade: (noTradeId: string) => void;
  addPanel: (view?: ViewKey) => void;
  removePanel: (panelId: string) => void;
  updatePanelSize: (panelId: string, sizePct: number) => void;
  resetWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      isActive: false,
      layout: "2-col",
      panels: DEFAULT_PANELS,
      linkedTradeId: null,
      linkedNoTradeId: null,

      setIsActive: (active) => set({ isActive: active }),

      toggleWorkspace: () => set((s) => ({ isActive: !s.isActive })),

      setLayout: (layout) => {
        const panels = get().panels;
        let targetCount = 2;
        if (layout === "2-col" || layout === "2-row") targetCount = 2;
        if (layout === "3-col") targetCount = 3;
        if (layout === "4-grid") targetCount = 4;

        let updated = [...panels];
        while (updated.length < targetCount) {
          const id = `panel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${updated.length + 1}`;
          const nextView = SUPPORTED_PANEL_VIEWS[updated.length % SUPPORTED_PANEL_VIEWS.length];
          updated.push({
            id,
            view: nextView.key,
            title: nextView.label,
            sizePct: Math.round(100 / targetCount),
          });
        }
        if (updated.length > targetCount) {
          updated = updated.slice(0, targetCount);
        }

        const evenSize = Math.round(100 / updated.length);
        updated = updated.map((p) => ({ ...p, sizePct: evenSize }));

        set({ layout, panels: updated });
      },

      setPanelView: (panelId, view, recordId) => {
        const label = SUPPORTED_PANEL_VIEWS.find((v) => v.key === view)?.label || view;
        set((s) => ({
          panels: s.panels.map((p) =>
            p.id === panelId ? { ...p, view, title: label, recordId: recordId ?? p.recordId } : p
          ),
        }));
      },

      setLinkedTrade: (tradeId) => {
        set((s) => ({
          linkedTradeId: tradeId,
          panels: s.panels.map((p) =>
            p.view === "tradeDetail" ? { ...p, recordId: tradeId } : p
          ),
        }));
      },

      setLinkedNoTrade: (noTradeId) => {
        set((s) => ({
          linkedNoTradeId: noTradeId,
          panels: s.panels.map((p) =>
            p.view === ("noTrades" as ViewKey) ? { ...p, recordId: noTradeId } : p
          ),
        }));
      },

      addPanel: (view = "tradesLog") => {
        const panels = get().panels;
        if (panels.length >= 4) return;
        const label = SUPPORTED_PANEL_VIEWS.find((v) => v.key === view)?.label || view;
        const newPanel: WorkspacePanel = {
          id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          view,
          title: label,
          sizePct: Math.round(100 / (panels.length + 1)),
        };
        const newCount = panels.length + 1;
        const adjustedPanels = [...panels, newPanel].map((p) => ({
          ...p,
          sizePct: Math.round(100 / newCount),
        }));
        set({ panels: adjustedPanels });
      },

      removePanel: (panelId) => {
        const panels = get().panels;
        if (panels.length <= 1) return; // Keep at least one panel
        const filtered = panels.filter((p) => p.id !== panelId);
        const adjusted = filtered.map((p) => ({
          ...p,
          sizePct: Math.round(100 / filtered.length),
        }));
        set({ panels: adjusted });
      },

      updatePanelSize: (panelId, sizePct) => {
        set((s) => ({
          panels: s.panels.map((p) => (p.id === panelId ? { ...p, sizePct } : p)),
        }));
      },

      resetWorkspace: () => {
        set({
          layout: "2-col",
          panels: DEFAULT_PANELS,
          linkedTradeId: null,
          linkedNoTradeId: null,
        });
      },
    }),
    {
      name: "alphapips-workspace-layout",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Test & development instrumentation — strictly gated to non-production environments
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as any).__workspaceStore = useWorkspaceStore;
  (window as any).__WORKSPACE_STORE__ = useWorkspaceStore;
}
