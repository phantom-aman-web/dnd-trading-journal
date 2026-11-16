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
  | "noTrades"
  | "analytics"
  | "propChallenges"
  | "riskCalculator"
  | "tradingTodo"
  | "archived"
  | "settings"
  | "backup"
  | "terms"
  | "privacy"
  | "cookies";

interface NavState {
  view: ViewKey;
  params: Record<string, string>;
  selectedAccountId: string; // Persistent account filter ("" = all accounts)
  scrollPositions: Record<string, number>;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  tradeFormOpen: boolean;
  noTradeFormOpen: boolean;
  navigate: (view: ViewKey, params?: Record<string, string>) => void;
  setParams: (params: Record<string, string>) => void;
  setSelectedAccountId: (accountId: string) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setTradeFormOpen: (open: boolean) => void;
  setNoTradeFormOpen: (open: boolean) => void;
  saveScroll: (view: ViewKey, scrollY: number) => void;
  getScroll: (view: ViewKey) => number;
  clearScroll: (view: ViewKey) => void;
}

export const useNav = create<NavState>()(
  persist(
    (set, get) => ({
      view: "dashboard",
      params: {},
      selectedAccountId: "",
      scrollPositions: {},
      sidebarCollapsed: false,
      commandOpen: false,
      tradeFormOpen: false,
      noTradeFormOpen: false,
      navigate: (view, newParams = {}) =>
        set((s) => ({
          view,
          params: {
            ...(s.selectedAccountId ? { accountId: s.selectedAccountId } : {}),
            ...newParams,
          },
        })),
      setSelectedAccountId: (accountId: string) =>
        set((s) => {
          const cleanId = !accountId || accountId === "all" ? "" : accountId;
          return {
            selectedAccountId: cleanId,
            params: {
              ...s.params,
              accountId: cleanId,
            },
          };
        }),
      setParams: (newParams) =>
        set((s) => ({
          params: { ...s.params, ...newParams },
          ...(newParams.accountId !== undefined
            ? { selectedAccountId: newParams.accountId === "all" ? "" : newParams.accountId }
            : {}),
        })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setTradeFormOpen: (open) => set({ tradeFormOpen: open }),
      setNoTradeFormOpen: (open) => set({ noTradeFormOpen: open }),
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
        selectedAccountId: s.selectedAccountId,
        sidebarCollapsed: s.sidebarCollapsed,
        scrollPositions: s.scrollPositions,
      }),
    },
  ),
);

export const useNavStore = useNav;

if (typeof window !== "undefined") {
  (window as any).__navStore = useNav;
}

