"use client";

import { useNav } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  ChevronDown,
  Menu,
  LogOut,
  Settings as SettingsIcon,
  DatabaseBackup,
  Keyboard,
  Columns3,
  Sliders,
  Palette,
  Eye,
  EyeOff,
  User,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivacyStore, maskAccountName } from "@/lib/privacy-store";
import { useTheme, type DndTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MarketClock } from "@/components/market-clock";
import { SyncStatusIndicator } from "@/components/offline/sync-status-indicator";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { useFloatingWidgetsStore } from "@/lib/floating-widgets-store";

async function fetchAccounts() {
  const res = await fetch("/api/accounts", { cache: "no-store" });
  if (!res.ok) return { items: [] };
  const data = await res.json();
  const arr = (data as any)?.items ?? (data as any)?.accounts ?? (Array.isArray(data) ? data : []);
  return { items: Array.isArray(arr) ? arr : [] };
}

interface TopBarProps {
  onOpenMobileNav?: () => void;
  onOpenShortcuts?: () => void;
}

export function TopBar({ onOpenMobileNav, onOpenShortcuts }: TopBarProps) {
  const { navigate, setCommandOpen, params, selectedAccountId, setSelectedAccountId } = useNav();
  const { user, signOut } = useAuth();
  const { isPrivate, togglePrivacy } = usePrivacyStore();
  const { theme, setTheme } = useTheme();
  const { isActive: isWorkspaceActive, toggleWorkspace } = useWorkspaceStore();
  const { toggleManager: toggleFloatingManager } = useFloatingWidgetsStore();
  const qc = useQueryClient();

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: fetchAccounts,
    enabled: !!user?.id,
  });
  const accounts: any[] = Array.isArray(accountsData)
    ? accountsData
    : (Array.isArray((accountsData as any)?.items)
      ? (accountsData as any).items
      : (Array.isArray((accountsData as any)?.accounts) ? (accountsData as any).accounts : []));

  const validAccountSelected = selectedAccountId && accounts.some((a: any) => a.id === selectedAccountId);
  const accountFilter = validAccountSelected ? selectedAccountId : "all";

  function setAccountFilter(v: string) {
    setSelectedAccountId(v === "all" ? "" : v);
  }

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-card flex items-center gap-2 px-4">
      <button
        className="md:hidden p-1 text-muted-foreground"
        onClick={onOpenMobileNav}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Select value={accountFilter} onValueChange={setAccountFilter}>
        <SelectTrigger className="flex w-auto max-w-[130px] sm:max-w-none sm:min-w-[160px] h-9 text-xs sm:text-sm font-medium border-input bg-card shrink-0">
          <SelectValue placeholder="All Accounts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Accounts ({accounts.length})</SelectItem>
          {accounts.map((a: any, idx: number) => (
            <SelectItem key={a.id} value={a.id}>
              {maskAccountName(a.name, isPrivate, idx + 1)} ({isPrivate ? "••••••" : `$${((a.startingBalanceCents ?? 0) / 100).toLocaleString()}`})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        onClick={() => setCommandOpen(true)}
        className="flex items-center justify-between h-9 px-3 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground hover:bg-muted w-full max-w-md group"
        title="Open Command Palette (⌘K or /)"
      >
        <div className="flex items-center gap-2 truncate">
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline truncate">Search trades, observations, setups, tasks, notes...</span>
          <span className="sm:hidden">Search</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border group-hover:border-foreground/30">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Real-time New York Market Clock — automatic DST, no manual offset */}
        <MarketClock />

        {/* Local Offline & Synchronization Status */}
        <SyncStatusIndicator />

        {/* Multi-Panel Workspace Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleWorkspace}
          className={cn(
            "h-8 px-2.5 text-xs gap-1.5 hidden sm:inline-flex border transition-colors",
            isWorkspaceActive
              ? "bg-primary text-primary-foreground border-primary font-semibold"
              : "bg-card border-border text-foreground hover:bg-muted/50"
          )}
          title="Toggle Multi-Panel Workspace (Pro Mode)"
        >
          <Columns3 className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Workspace</span>
        </Button>

        {/* Floating Mini Widgets Manager Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFloatingManager}
          aria-label="Floating Widgets"
          className="h-8 w-8 text-muted-foreground hover:bg-muted"
          title="Floating Mini Widgets Manager"
        >
          <Sliders className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 h-9 px-2 rounded-md hover:bg-muted transition-colors">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-xs">
                {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            {/* Account header */}
            <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="font-semibold text-foreground text-sm">{user?.name ?? "Trader"}</span>
              <span className="text-xs text-muted-foreground font-normal truncate">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />

            {/* Account section */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
              Account
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("settings", { tab: "profile" })}>
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              Profile & Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("settings", { tab: "trading" })}>
              <SettingsIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              Trading Preferences
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            {/* Preferences section */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
              Preferences
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("settings", { tab: "preferences" })}>
              <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
              Preferences Center
            </DropdownMenuItem>

            {/* Direct Themes Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Palette className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="flex-1">Themes</span>
                <span className="text-[10px] font-mono text-muted-foreground capitalize mr-1">
                  {theme === "nordic" ? "Nordic" : theme === "terminal" ? "Terminal" : "Institutional"}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 p-1">
                <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
                  Choose Theme
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setTheme("nordic")}
                  className="flex items-center justify-between cursor-pointer py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-slate-200 border border-slate-300" />
                    <span className="text-xs font-medium">Nordic</span>
                  </div>
                  {theme === "nordic" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("terminal")}
                  className="flex items-center justify-between cursor-pointer py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 border border-emerald-600" />
                    <span className="text-xs font-medium">Terminal</span>
                  </div>
                  {theme === "terminal" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("institutional")}
                  className="flex items-center justify-between cursor-pointer py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-slate-700 border border-slate-800" />
                    <span className="text-xs font-medium">Slate Contrast</span>
                  </div>
                  {theme === "institutional" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={() => navigate("settings", { tab: "preferences", sub: "themes" })}
                  className="text-xs text-muted-foreground cursor-pointer py-1.5"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-2" />
                  <span>More Theme Settings…</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => onOpenShortcuts?.() || navigate("settings", { tab: "preferences", sub: "shortcuts" })}>
              <Keyboard className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="flex-1">Keyboard Shortcuts</span>
              <kbd className="text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground">?</kbd>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            {/* Privacy section */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
              Privacy
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                togglePrivacy();
                toast.success(isPrivate ? "Sensitive information is now visible." : "Sensitive financial information masked globally.");
              }}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isPrivate ? (
                  <Eye className="h-4 w-4 text-emerald-500" />
                ) : (
                  <EyeOff className="h-4 w-4 text-amber-500" />
                )}
                <span className="font-medium text-xs">{isPrivate ? "Show Sensitive Information" : "Hide Sensitive Information"}</span>
              </div>
              <span
                className={cn(
                  "text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold tracking-wide",
                  isPrivate
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isPrivate ? "MASKED" : "VISIBLE"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            {/* Session section */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
              Session
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("backup")}>
              <DatabaseBackup className="h-4 w-4 mr-2 text-muted-foreground" />
              Backup / Restore
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const res = await fetch("/api/exports?format=json&type=all");
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `alphapips-export-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Export ready.");
              }}
            >
              Export Data (JSON)
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
    </header>
  );
}
