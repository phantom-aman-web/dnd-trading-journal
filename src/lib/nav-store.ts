"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ViewKey =
  | "landing"
  | "signin"
  | "signup"
  | "dashboard"
  | "calendar"
  | "accounts"
  | "setups"
  | "tradeNew"
  | "tradesLog"
  | "tradeDetail"
  | "analytics"
  | "settings"
  | "backup"
  | "terms"
  | "privacy"
  | "cookies";

interface NavState {
  view: ViewKey;
  params: Record<string, string>;
  scrollPositions: Record<string, number>;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  tradeFormOpen: boolean;
  navigate: (view: ViewKey, params?: Record<string, string>) => void;
  setParams: (params: Record<string, string>) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setTradeFormOpen: (open: boolean) => void;
  saveScroll: (view: ViewKey, scrollY: number) => void;
  getScroll: (view: ViewKey) => number;
  clearScroll: (view: ViewKey) => void;
}

export const useNav = create<NavState>()(
  persist(
    (set, get) => ({
      view: "dashboard",
      params: {},
      scrollPositions: {},
      sidebarCollapsed: false,
      commandOpen: false,
      tradeFormOpen: false,
      navigate: (view, params = {}) => set({ view, params }),
      setParams: (params) => set((s) => ({ params: { ...s.params, ...params } })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setTradeFormOpen: (open) => set({ tradeFormOpen: open }),
      saveScroll: (view, scrollY) =>
        set((s) => ({ scrollPositions: { ...s.scrollPositions, [view]: scrollY } })),
      getScroll: (view) => get().scrollPositions[view] ?? 0,
      clearScroll: (view) =>
        set((s) => {
          const next = { ...s.scrollPositions };
          delete next[view];
          return { scrollPositions: next };
        }),
    }),
    {
      name: "dnd-nav",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        view: s.view,
        params: s.params,
        sidebarCollapsed: s.sidebarCollapsed,
        scrollPositions: s.scrollPositions,
      }),
    },
  ),
);
