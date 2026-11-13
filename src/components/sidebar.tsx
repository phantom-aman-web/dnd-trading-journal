"use client";

import { useNav, type ViewKey } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  ListChecks,
  PlusCircle,
  BookOpen,
  BarChart3,
  Settings as SettingsIcon,
  DatabaseBackup,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Trophy,
  Calculator,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  view: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dataTour?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      { view: "dashboard", label: "Dashboard", icon: LayoutDashboard, dataTour: "dashboard" },
    ],
  },
  {
    label: "TRADE",
    items: [
      { view: "tradesLog", label: "Trades Log", icon: BookOpen, dataTour: "trades-log" },
      { view: "calendar", label: "Trading Calendar", icon: CalendarDays, dataTour: "calendar" },
      { view: "accounts", label: "Accounts", icon: Wallet, dataTour: "accounts" },
    ],
  },
  {
    label: "UNDERSTAND",
    items: [
      { view: "analytics", label: "Analytics Engine", icon: BarChart3, dataTour: "analytics" },
      { view: "setups", label: "Setups & Checklists", icon: ListChecks, dataTour: "setups" },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { view: "propChallenges", label: "Prop Challenges", icon: Trophy, dataTour: "prop-challenges" },
      { view: "riskCalculator", label: "Risk Calculator", icon: Calculator, dataTour: "risk-calculator" },
      { view: "tradingTodo", label: "Trading To-Do", icon: CheckSquare, dataTour: "trading-todo" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { view: "settings", label: "Settings", icon: SettingsIcon, dataTour: "settings" },
      { view: "backup", label: "Backup / Restore", icon: DatabaseBackup },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { view, navigate, sidebarCollapsed, toggleSidebar } = useNav();
  const { signOut } = useAuth();

  function handleNav(v: ViewKey) {
    navigate(v);
    onNavigate?.();
  }

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col h-screen shrink-0 transition-[width] duration-200",
        sidebarCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="px-3 h-16 flex items-center gap-2.5 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-md shrink-0 border border-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M12 3 L20 20 L15.5 20 L12 11 L8.5 20 L4 20 Z" fill="currentColor" fillOpacity="0.3" />
            <circle cx="12" cy="8" r="1.5" fill="#10B981" stroke="#10B981" />
          </svg>
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm tracking-tight text-sidebar-foreground flex items-center gap-1.5">
              <span>AlphaPips</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-primary/20 text-blue-400 font-semibold border border-blue-500/20">
                PRO
              </span>
            </div>
            <div className="text-[10px] text-sidebar-foreground/60 leading-none mt-0.5">Performance OS</div>
          </div>
        )}
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="md:hidden p-1.5 rounded-md text-muted-foreground/70 hover:text-sidebar-foreground ml-auto"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* New Trade button */}
      <div className="px-3 pt-4">
        <Button
          onClick={() => handleNav("tradeNew")}
          data-tour="add-trade"
          className={cn(
            "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 font-semibold text-sm border-0",
            sidebarCollapsed ? "w-9 h-9 p-0" : "w-full",
          )}
          title={sidebarCollapsed ? "New Trade" : undefined}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span className="ml-1.5">New Trade</span>}
        </Button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-3 sidebar-scroll">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {!sidebarCollapsed && (
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 select-none">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = view === item.view;
              const Icon = item.icon;
              return (
                <button
                  key={item.view}
                  onClick={() => handleNav(item.view)}
                  title={sidebarCollapsed ? item.label : undefined}
                  data-tour={item.dataTour}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    sidebarCollapsed && "justify-center px-0",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle + Sign Out */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors",
            sidebarCollapsed && "justify-center px-0",
          )}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={() => signOut()}
          title={sidebarCollapsed ? "Sign Out" : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors",
            sidebarCollapsed && "justify-center px-0",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
