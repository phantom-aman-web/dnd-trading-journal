"use client";

import { useState, useEffect } from "react";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { useFavorites } from "@/lib/favorites-store";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  ListChecks,
  PlusCircle,
  Plus,
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
  ChevronDown,
  Star,
  Keyboard,
  EyeOff,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  view: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dataTour?: string;
  isFavorites?: boolean;
  shortcut?: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "OVERVIEW",
    items: [
      { view: "dashboard", label: "Dashboard", icon: LayoutDashboard, dataTour: "dashboard", shortcut: "G D" },
    ],
  },
  {
    id: "journal",
    label: "JOURNAL",
    items: [
      { view: "tradesLog", label: "Trades Log", icon: BookOpen, dataTour: "trades-log", shortcut: "G T" },
      { view: "calendar", label: "Trading Calendar", icon: CalendarDays, dataTour: "calendar", shortcut: "G C" },
    ],
  },
  {
    id: "analyze",
    label: "ANALYZE",
    items: [
      { view: "analytics", label: "Analytics Engine", icon: BarChart3, dataTour: "analytics", shortcut: "G A" },
      { view: "setups", label: "Setups & Checklists", icon: ListChecks, dataTour: "setups", shortcut: "G S" },
    ],
  },
  {
    id: "risk",
    label: "RISK & ACCOUNTS",
    items: [
      { view: "accounts", label: "Accounts", icon: Wallet, dataTour: "accounts" },
      { view: "propChallenges", label: "Prop Challenges", icon: Trophy, dataTour: "prop-challenges", shortcut: "G P" },
      { view: "riskCalculator", label: "Risk Calculator", icon: Calculator, dataTour: "risk-calculator", shortcut: "G R" },
    ],
  },
  {
    id: "tasks",
    label: "TASKS",
    items: [
      { view: "tradingTodo", label: "Trading To-Do", icon: CheckSquare, dataTour: "trading-todo", shortcut: "G W" },
    ],
  },
  {
    id: "manage",
    label: "MANAGE",
    items: [
      { view: "settings", label: "Preferences", icon: SettingsIcon, dataTour: "settings", shortcut: "G ," },
      { view: "archived", label: "Archived Records", icon: Archive },
      { view: "backup", label: "Backup / Restore", icon: DatabaseBackup },
    ],
  },
];

const COLLAPSED_GROUPS_KEY = "alphapips-collapsed-sidebar-groups";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { view, params, navigate, sidebarCollapsed, toggleSidebar } = useNav();
  const { signOut } = useAuth();
  const favoriteCount = useFavorites((s) => s.favoriteCount);

  // Collapsed sidebar groups state persisted in localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
      if (stored) {
        setCollapsedGroups(JSON.parse(stored));
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, []);

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const updated = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }

  function handleNav(item: NavItem) {
    navigate(item.view);
    onNavigate?.();
  }

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col h-screen shrink-0 transition-[width] duration-200 select-none",
        sidebarCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-sidebar-border",
          sidebarCollapsed ? "justify-center px-2" : "px-3 gap-2.5"
        )}
      >
        <BrandLogo
          size="md"
          collapsed={sidebarCollapsed}
          showBadge={true}
          subtitle="Performance OS"
          className={sidebarCollapsed ? "justify-center" : ""}
        />
        {onNavigate && !sidebarCollapsed && (
          <button
            onClick={onNavigate}
            className="md:hidden p-1.5 rounded-md text-muted-foreground/70 hover:text-sidebar-foreground ml-auto"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* New Entry Action (Unified dropdown for executed trades and observations) */}
      <div className="px-3 pt-4 space-y-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-tour="add-trade"
              className={cn(
                "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 font-semibold text-sm border-0 relative group shadow-sm cursor-pointer",
                sidebarCollapsed ? "w-10 h-10 p-0 mx-auto justify-center" : "w-full justify-between",
              )}
              title={sidebarCollapsed ? "New Entry (N)" : undefined}
            >
              <div className="flex items-center gap-2 min-w-0">
                <PlusCircle className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">New Entry</span>}
              </div>
              {!sidebarCollapsed && <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-1.5 bg-card border-border shadow-lg">
            <DropdownMenuItem
              onClick={() => {
                navigate("tradeNew");
                onNavigate?.();
              }}
              className="cursor-pointer py-2"
            >
              <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center mr-2.5 shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs">Log Executed Trade</span>
                  <kbd className="text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground">N</kbd>
                </div>
                <span className="text-[10px] text-muted-foreground">Quick Entry or Wizard</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                useNav.getState().setNoTradeFormOpen(true);
                onNavigate?.();
              }}
              className="cursor-pointer py-2"
            >
              <div className="h-7 w-7 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center mr-2.5 shrink-0">
                <EyeOff className="h-4 w-4" />
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs">Log No-Trade Observation</span>
                  <kbd className="text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground">O</kbd>
                </div>
                <span className="text-[10px] text-muted-foreground">Market restraint record</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-3 sidebar-scroll">
        {NAV_GROUPS.map((group) => {
          const isCollapsed = !sidebarCollapsed && !!collapsedGroups[group.id];

          return (
            <div key={group.id} className="space-y-0.5">
              {/* Group Header (Collapsible toggle when expanded) */}
              {!sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors rounded-md group/head focus:outline-hidden"
                  aria-expanded={!isCollapsed}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-sidebar-foreground/40 group-hover/head:text-sidebar-foreground/80 transition-transform duration-200",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>
              )}

              {/* Group Items (with smooth collapse/expand transition) */}
              <div
                className={cn(
                  "transition-all duration-200 ease-in-out overflow-hidden space-y-0.5",
                  isCollapsed ? "max-h-0 opacity-0 pointer-events-none" : "max-h-96 opacity-100"
                )}
              >
                {group.items.map((item) => {
                  const active = view === item.view;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      onClick={() => handleNav(item)}
                      title={sidebarCollapsed ? `${item.label}${item.shortcut ? ` (${item.shortcut})` : ""}` : undefined}
                      data-tour={item.dataTour}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group/item",
                        sidebarCollapsed && "justify-center px-0 h-10 w-10 mx-auto",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                          : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          item.isFavorites && (active || favoriteCount > 0) && "text-amber-400 fill-amber-400/30"
                        )}
                      />
                      {!sidebarCollapsed && (
                        <div className="flex items-center justify-between w-full">
                          <span>{item.label}</span>
                          <div className="flex items-center gap-1.5">
                            {item.isFavorites && favoriteCount > 0 && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30">
                                {favoriteCount}
                              </span>
                            )}
                            {item.shortcut && (
                              <kbd className="opacity-0 group-hover/item:opacity-70 text-[9px] font-mono text-muted-foreground px-1 py-0.2 rounded bg-muted/60 transition-opacity">
                                {item.shortcut}
                              </kbd>
                            )}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle + Sign Out */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar ([)" : "Collapse sidebar ([)"}
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
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between w-full">
              <span>Collapse</span>
              <kbd className="text-[10px] font-mono text-sidebar-foreground/50">[</kbd>
            </div>
          )}
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
