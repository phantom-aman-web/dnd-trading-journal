"use client";

import { useEffect, useState, useRef } from "react";
import { useNav } from "@/lib/nav-store";
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
import { SettingsView } from "@/components/views/settings-view";
import { BackupView } from "@/components/views/backup-view";

export function AppShell() {
  const { view, getScroll, saveScroll } = useNav();
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<string | null>(null);

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
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 scroll-thin bg-background"
        >
          {view === "dashboard" && <DashboardView />}
          {view === "tradesLog" && <TradesLogView />}
          {view === "tradeDetail" && <TradeDetailView />}
          {view === "tradeNew" && <TradeFormView />}
          {view === "calendar" && <CalendarView />}
          {view === "analytics" && <AnalyticsView />}
          {view === "setups" && <PlaybooksView />}
          {view === "accounts" && <AccountsView />}
          {view === "settings" && <SettingsView />}
          {view === "backup" && <BackupView />}
        </main>
        <MobileNav />
      </div>

      <CommandPalette />
    </div>
  );
}
