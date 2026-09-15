"use client";

import { useState } from "react";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Plus,
  Calendar,
  Wallet,
  ListChecks,
  BarChart3,
  Settings,
  DatabaseBackup,
  Palette,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";

const MOBILE_ITEMS: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Home", icon: LayoutDashboard },
  { key: "tradesLog", label: "Trades", icon: BookOpen },
  { key: "tradeNew", label: "Add", icon: Plus },
  { key: "calendar", label: "Calendar", icon: Calendar },
];

const MORE_ITEMS: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "accounts", label: "Accounts", icon: Wallet },
  { key: "setups", label: "Setups & Checklists", icon: ListChecks },
  { key: "analytics", label: "Analytics Engine", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "backup", label: "Backup / Restore", icon: DatabaseBackup },
];

export function MobileNav() {
  const { view, navigate } = useNav();
  const { user, signOut } = useAuth();
  const { theme: currentTheme, setTheme: applyTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  function go(key: ViewKey) {
    navigate(key);
    setMoreOpen(false);
  }

  const moreKeys = new Set<ViewKey>(MORE_ITEMS.map((i) => i.key));
  const moreActive = moreKeys.has(view) ||
    (view === "tradeDetail" && moreKeys.has("tradesLog"));

  const themeOptions = [
    { key: "nordic", label: "Nordic Clean" },
    { key: "terminal", label: "Sleek Terminal" },
    { key: "institutional", label: "Institutional Blue" },
  ] as const;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5">
        {MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.key || (view === "tradeDetail" && item.key === "tradesLog");
          const isAdd = item.key === "tradeNew";
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-xs transition-colors",
                isAdd
                  ? "text-primary"
                  : active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-full transition-colors",
                  isAdd && "bg-primary text-primary-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-xs transition-colors",
                moreActive
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Profile and more"
            >
              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground overflow-hidden">
                {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
              </span>
              <span>Profile</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 mb-2">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span>{user?.name ?? "Trader"}</span>
              <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
              Appearance
            </DropdownMenuLabel>
            {themeOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.key}
                onClick={() => applyTheme(opt.key)}
                className={cn("flex items-center gap-2", currentTheme === opt.key && "font-semibold")}
              >
                <Palette className="h-3.5 w-3.5" />
                <span className="flex-1">{opt.label}</span>
                {currentTheme === opt.key && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
              Navigation
            </DropdownMenuLabel>
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => go(item.key)}
                  className={cn("flex items-center gap-2", active && "font-semibold")}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                const res = await fetch("/api/exports?format=json&type=all");
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `dnd-export-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <DatabaseBackup className="h-4 w-4 mr-2" />
              Export Data
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-loss focus:text-loss"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
