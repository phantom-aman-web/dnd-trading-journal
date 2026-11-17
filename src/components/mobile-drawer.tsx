"use client";

import React, { useEffect } from "react";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  ListChecks,
  BookOpen,
  BarChart3,
  Settings as SettingsIcon,
  DatabaseBackup,
  LogOut,
  X,
  Trophy,
  Calculator,
  CheckSquare,
  Archive,
  ChevronRight,
} from "lucide-react";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface NavGroup {
  id: string;
  label: string;
  items: {
    view: ViewKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    params?: Record<string, string>;
  }[];
}

const DRAWER_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    id: "journal",
    label: "Journal",
    items: [
      { view: "tradesLog", label: "Trades Log", icon: BookOpen },
      { view: "calendar", label: "Trading Calendar", icon: CalendarDays },
    ],
  },
  {
    id: "analyze",
    label: "Analyze",
    items: [
      { view: "analytics", label: "Analytics Engine", icon: BarChart3 },
      { view: "setups", label: "Setups & Checklists", icon: ListChecks },
    ],
  },
  {
    id: "risk",
    label: "Risk & Accounts",
    items: [
      { view: "accounts", label: "Accounts", icon: Wallet },
      { view: "propChallenges", label: "Prop Challenges", icon: Trophy },
      { view: "riskCalculator", label: "Risk Calculator", icon: Calculator },
    ],
  },
  {
    id: "tasks",
    label: "Tasks",
    items: [
      { view: "tradingTodo", label: "Trading To-Do", icon: CheckSquare },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    items: [
      { view: "settings", label: "Preferences", icon: SettingsIcon },
      { view: "archived", label: "Archived Records", icon: Archive },
      { view: "backup", label: "Backup / Restore", icon: DatabaseBackup },
    ],
  },
];

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const { view, params, navigate } = useNav();
  const { user, signOut } = useAuth();

  // Prevent background scrolling while drawer is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleSelect(item: { view: ViewKey; params?: Record<string, string> }) {
    navigate(item.view, item.params);
    onClose();
  }

  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer content */}
      <aside
        className="relative z-10 w-[84vw] max-w-[320px] h-full bg-sidebar text-sidebar-foreground shadow-2xl flex flex-col animate-in slide-in-from-left duration-250 select-none"
        aria-label="Navigation drawer"
      >
        {/* Header */}
        <div className="h-14 px-4 border-b border-sidebar-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 via-cyan-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-sm border border-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M12 3 L20 20 L15.5 20 L12 11 L8.5 20 L4 20 Z" fill="currentColor" fillOpacity="0.3" />
                <circle cx="12" cy="8" r="1.5" fill="#34D399" stroke="#34D399" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-sidebar-foreground flex items-center gap-1.5 font-jakarta">
                <span>AlphaPips</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30">
                  PRO
                </span>
              </div>
              <div className="text-[9px] text-sidebar-foreground/60 leading-none mt-0.5">Performance OS</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4 sidebar-scroll">
          {DRAWER_GROUPS.map((group) => (
            <div key={group.id} className="space-y-1">
              <div className="px-2.5 text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  // For preferences, active only if settings view and not profile tab
                  const isItemActive =
                    item.view === "settings"
                      ? view === "settings" && params.tab !== "profile"
                      : view === item.view;

                  return (
                    <button
                      key={item.label}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left",
                        isItemActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: User identity display & single clear sign out */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar/50 shrink-0 space-y-2">
          {/* User Identity Display (Non-duplicating identity badge) */}
          <div className="w-full p-2.5 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
              {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-sidebar-foreground truncate">
                {user?.name ?? "AlphaPips Trader"}
              </div>
              <div className="text-[10px] text-sidebar-foreground/60 truncate">
                {user?.email ?? "Signed In"}
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={() => {
              onClose();
              signOut();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
