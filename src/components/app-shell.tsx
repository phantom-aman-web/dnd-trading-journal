"use client";

import { useEffect, useState, useRef } from "react";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { TopBar } from "@/components/top-bar";
import { CommandPalette } from "@/components/command-palette";
import { DashboardView } from "@/components/views/dashboard-view";
import { TradesLogView } from "@/components/views/trades-log-view";
import { TradeDetailView } from "@/components/views/trade-detail-view";
import { TradeFormView } from "@/components/views/trade-form-view";
import { CalendarView } from "@/components/views/calendar-view";
import { AnalyticsView } from "@/components/views/analytics-view";
import { PlaybooksView } from "@/components/views/playbooks-view";
import { AccountsView } from "@/components/views/accounts-view";
import { PropChallengesView } from "@/components/views/prop-challenges-view";
import { RiskCalculatorView } from "@/components/views/risk-calculator-view";
import { TradingTodoView } from "@/components/views/trading-todo-view";
import { SettingsView } from "@/components/views/settings-view";
import { BackupView } from "@/components/views/backup-view";
import { NoTradesView } from "@/components/views/no-trades-view";
import { ArchivedView } from "@/components/views/archived-view";
import { NoTradeDialog } from "@/components/no-trades/no-trade-dialog";
import { MultiPanelWorkspace } from "@/components/workspace/multi-panel-workspace";
import { useWorkspaceStore } from "@/lib/workspace-store";
import dynamic from "next/dynamic";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { useGlobalKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";

const FloatingWidgetsLayer = dynamic(
  () => import("@/components/floating/floating-widgets-layer").then((m) => m.FloatingWidgetsLayer),
  { ssr: false }
);

export function AppShell() {
  const { view, getScroll, saveScroll, noTradeFormOpen, setNoTradeFormOpen } = useNav();
  const { user } = useAuth();
  const { shortcutsOpen, setShortcutsOpen } = useGlobalKeyboardShortcuts();
  const isWorkspaceActive = useWorkspaceStore((s) => s.isActive);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<string | null>(null);

  // Keep-Alive view cache
  const [visitedViews, setVisitedViews] = useState<Set<ViewKey>>(() => new Set([view]));

  useEffect(() => {
    if (user?.id) {
      import("@/lib/offline-sync-engine").then(({ syncEngine }) => {
        syncEngine.init(user.id);
      });
    }
  }, [user?.id]);

  useEffect(() => {
    setVisitedViews((prev) => {
      if (prev.has(view)) return prev;
      const next = new Set(prev);
      next.add(view);
      return next;
    });
  }, [view]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [view]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    return () => {
      saveScroll(view, main.scrollTop);
    };
  }, [view, saveScroll]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const savedScroll = getScroll(view);
    if (savedScroll > 0) {
      restoreRef.current = view;
      let attempts = 0;
      const tryRestore = () => {
        attempts++;
        if (main.scrollHeight >= savedScroll + main.clientHeight * 0.5 || attempts > 10) {
          main.scrollTop = savedScroll;
          restoreRef.current = null;
        } else {
          setTimeout(tryRestore, 100);
        }
      };
      setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(tryRestore);
        });
      }, 50);
    } else {
      main.scrollTop = 0;
    }
  }, [view, getScroll]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    let timeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      if (restoreRef.current) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveScroll(view, main.scrollTop);
      }, 300);
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
      clearTimeout(timeout);
      saveScroll(view, main.scrollTop);
    };
  }, [view, saveScroll]);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <TopBar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 scroll-thin bg-background relative"
        >
          {isWorkspaceActive ? (
            <MultiPanelWorkspace />
          ) : (
            <>
              {visitedViews.has("dashboard") && (
                <div className={cn(view !== "dashboard" && "hidden")}>
                  <DashboardView />
                </div>
              )}
              {visitedViews.has("tradesLog") && (
                <div className={cn(view !== "tradesLog" && "hidden")}>
                  <TradesLogView />
                </div>
              )}
              {view === "tradeDetail" && <TradeDetailView />}
              {view === "tradeNew" && <TradeFormView />}
              {visitedViews.has("calendar") && (
                <div className={cn(view !== "calendar" && "hidden")}>
                  <CalendarView />
                </div>
              )}
              {visitedViews.has("analytics") && (
                <div className={cn(view !== "analytics" && "hidden")}>
                  <AnalyticsView />
                </div>
              )}
              {visitedViews.has("setups") && (
                <div className={cn(view !== "setups" && "hidden")}>
                  <PlaybooksView />
                </div>
              )}
              {visitedViews.has("accounts") && (
                <div className={cn(view !== "accounts" && "hidden")}>
                  <AccountsView />
                </div>
              )}
              {visitedViews.has("noTrades" as ViewKey) && (
                <div className={cn(view !== ("noTrades" as ViewKey) && "hidden")}>
                  <NoTradesView />
                </div>
              )}
              {visitedViews.has("archived" as ViewKey) && (
                <div className={cn(view !== ("archived" as ViewKey) && "hidden")}>
                  <ArchivedView />
                </div>
              )}
              {visitedViews.has("propChallenges") && (
                <div className={cn(view !== "propChallenges" && "hidden")}>
                  <PropChallengesView />
                </div>
              )}
              {visitedViews.has("riskCalculator") && (
                <div className={cn(view !== "riskCalculator" && "hidden")}>
                  <RiskCalculatorView />
                </div>
              )}
              {visitedViews.has("tradingTodo") && (
                <div className={cn(view !== "tradingTodo" && "hidden")}>
                  <TradingTodoView />
                </div>
              )}
              {visitedViews.has("settings") && (
                <div className={cn(view !== "settings" && "hidden")}>
                  <SettingsView />
                </div>
              )}
              {visitedViews.has("backup") && (
                <div className={cn(view !== "backup" && "hidden")}>
                  <BackupView />
                </div>
              )}
            </>
          )}
        </main>
        <MobileNav />
      </div>

      <FloatingWidgetsLayer />
      <NoTradeDialog open={noTradeFormOpen} onOpenChange={setNoTradeFormOpen} />
      <CommandPalette onOpenShortcuts={() => setShortcutsOpen(true)} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
