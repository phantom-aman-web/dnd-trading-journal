"use client";

import { useState, useMemo, useEffect } from "react";
import { useNav, type ViewKey } from "@/lib/nav-store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  BarChart3,
  ListChecks,
  Settings,
  Plus,
  Download,
  Search as SearchIcon,
  TrendingUp,
  Wallet,
  DatabaseBackup,
  Star,
  Trophy,
  Calculator,
  CheckSquare,
  Keyboard,
  EyeOff,
  Archive,
  Columns3,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { useFloatingWidgetsStore } from "@/lib/floating-widgets-store";
import { usePrivacyStore } from "@/lib/privacy-store";

interface CommandEntry {
  id: string;
  label: string;
  view?: ViewKey;
  params?: Record<string, string>;
  action?: () => void | Promise<void>;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  shortcut?: string;
}

interface CommandPaletteProps {
  onOpenShortcuts?: () => void;
}

export function CommandPalette({ onOpenShortcuts }: CommandPaletteProps) {
  const { commandOpen, setCommandOpen, navigate } = useNav();
  const [query, setQuery] = useState("");

  const baseCommands: CommandEntry[] = useMemo(() => [
    { id: "dashboard", label: "Open Dashboard", view: "dashboard", icon: LayoutDashboard, shortcut: "G D", keywords: ["home", "overview", "metrics", "pnl", "performance"] },
    { id: "tradesLog", label: "Open Trades Log", view: "tradesLog", params: { favorites: "0" } as Record<string, string>, icon: BookOpen, shortcut: "G T", keywords: ["trades", "history", "log", "entries", "journal"] },
    { id: "favorites", label: "Open Favorite Trades", view: "tradesLog", params: { favorites: "1" } as Record<string, string>, icon: Star, shortcut: "G F", keywords: ["favorite", "starred", "bookmarks", "pinned", "best"] },
    { id: "noTrades", label: "Open No-Trade Observations", view: "tradesLog", params: { tab: "observations" } as Record<string, string>, icon: EyeOff, shortcut: "G O", keywords: ["observation", "discipline", "avoidance", "market", "no trade"] },
    { id: "add-trade", label: "Log Trade", view: "tradeNew", icon: Plus, shortcut: "N", keywords: ["new", "create", "log", "record"] },
    { id: "log-observation", label: "Log No-Trade Observation", icon: EyeOff, shortcut: "O", keywords: ["observation", "restraint", "missed", "rejected"], action: () => { useNav.getState().setNoTradeFormOpen(true); } },
    { id: "toggle-privacy", label: "Toggle Sensitive Info Privacy Mode", icon: EyeOff, keywords: ["privacy", "hide", "mask", "masking", "sensitive", "stealth"], action: () => { usePrivacyStore.getState().togglePrivacy(); } },
    { id: "toggle-workspace", label: "Toggle Multi-Panel Workspace", icon: Columns3, shortcut: "Alt+W", keywords: ["panels", "workspace", "multi", "columns", "split"], action: () => { useWorkspaceStore.getState().toggleWorkspace(); } },
    { id: "floating-widgets", label: "Manage Floating Mini Widgets", icon: Sliders, keywords: ["floating", "widgets", "overlay", "mini"], action: () => { useFloatingWidgetsStore.getState().toggleManager(); } },
    { id: "calendar", label: "Open Trading Calendar", view: "calendar", icon: Calendar, shortcut: "G C", keywords: ["monthly", "daily", "schedule", "days"] },
    { id: "analytics", label: "Open Analytics Engine", view: "analytics", icon: BarChart3, shortcut: "G A", keywords: ["stats", "charts", "breakdown", "instrument", "session"] },
    { id: "setups", label: "Open Setups & Checklists", view: "setups", icon: ListChecks, shortcut: "G S", keywords: ["strategy", "strategies", "rules", "checklist", "setups"] },
    { id: "propChallenges", label: "Open Prop Challenges", view: "propChallenges", icon: Trophy, shortcut: "G P", keywords: ["prop", "challenge", "firm", "evaluation", "drawdown", "ftmo"] },
    { id: "riskCalculator", label: "Open Risk Calculator", view: "riskCalculator", icon: Calculator, shortcut: "G R", keywords: ["risk", "calculator", "lot", "sizing", "position"] },
    { id: "tradingTodo", label: "Open Trading To-Do", view: "tradingTodo", icon: CheckSquare, shortcut: "G W", keywords: ["todo", "watchlist", "tasks", "research", "pre-market"] },
    { id: "archived", label: "Open Archived Records", view: "archived" as ViewKey, icon: Archive, keywords: ["archive", "restore", "deleted", "history"] },
    { id: "accounts", label: "Open Accounts", view: "accounts", icon: Wallet, keywords: ["account", "balance", "broker", "prop", "funded"] },
    { id: "settings", label: "Open Settings", view: "settings", icon: Settings, shortcut: "G ,", keywords: ["profile", "accounts", "appearance", "theme", "privacy", "risk"] },
    { id: "shortcuts", label: "View Keyboard Shortcuts", icon: Keyboard, shortcut: "?", keywords: ["shortcuts", "keys", "hotkeys", "help"], action: () => { onOpenShortcuts?.(); } },
    { id: "backup", label: "Open Backup / Restore", view: "backup", icon: DatabaseBackup, keywords: ["backup", "restore", "export", "import", "json"] },
  ], [onOpenShortcuts]);

  // Fetch trades with server-side query (only when palette is open)
  const { data: trades } = useQuery({
    queryKey: ["trades-search", query.trim()],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("limit", "50");
      if (query.trim()) {
        qs.set("search", query.trim());
      }
      const res = await fetch(`/api/trades?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.items ?? [];
    },
    enabled: commandOpen,
  });

  // Clear query when palette closes
  useEffect(() => {
    if (!commandOpen) setQuery("");
  }, [commandOpen]);

  // Build the full searchable list
  const allCommands = useMemo(() => {
    const cmds: CommandEntry[] = [...baseCommands];
    // Add export action
    cmds.push({
      id: "export-data",
      label: "Export Data (JSON)",
      icon: Download,
      keywords: ["download", "backup", "csv", "json"],
      action: async () => {
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
      },
    });
    return cmds;
  }, [baseCommands]);

  // Fuzzy search commands + trades
  const searchResults = useMemo(() => {
    if (!query.trim()) return { commands: allCommands, trades: [], hasTypoResults: false };

    // Search commands
    const cmdResults = fuzzySearch(allCommands, query, (c) => [c.label, ...c.keywords]);

    // Search trades
    const tradeResults = trades
      ? fuzzySearch(trades as any[], query, (t: any) => [
          t.instrumentSymbol,
          t.direction,
          t.status,
          t.setupGrade ?? "",
          t.session ?? "",
          ...((() => {
            try { return JSON.parse(t.tagsJson ?? "[]"); } catch { return []; }
          })()),
        ]).slice(0, 8)
      : [];

    const hasTypoResults = cmdResults.some(r => r.isTypoCorrection) || tradeResults.some(r => r.isTypoCorrection);

    return {
      commands: cmdResults.map(r => r.item),
      trades: tradeResults.map(r => ({ ...r.item, _isTypo: r.isTypoCorrection, _isFuzzy: r.isFuzzy })),
      hasTypoResults,
    };
  }, [query, allCommands, trades]);

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Type a command, shortcut, or search trades..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>
          {query.trim() ? `No results for "${query}". Try a different spelling.` : "Start typing to search..."}
        </CommandEmpty>

        {searchResults.hasTypoResults && (
          <CommandGroup heading="Did you mean?">
            {searchResults.commands
              .filter((_, i) => {
                const r = fuzzySearch([allCommands[i] ?? { label: "", keywords: [] }], query, (c) => [c.label, ...c.keywords])[0];
                return r?.isTypoCorrection;
              })
              .map((c) => {
                const Icon = c.icon;
                return (
                  <CommandItem
                    key={`typo-${c.id}`}
                    onSelect={() => {
                      if (c.view) navigate(c.view, c.params);
                      else c.action?.();
                      setCommandOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-warning" />
                    <span>{c.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">similar</span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        )}

        <CommandGroup heading="Actions &amp; Navigation">
          {searchResults.commands.slice(0, 12).map((c) => {
            const Icon = c.icon;
            return (
              <CommandItem
                key={c.id}
                onSelect={() => {
                  if (c.view) navigate(c.view, c.params);
                  else c.action?.();
                  setCommandOpen(false);
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{c.label}</span>
                </div>
                {c.shortcut && (
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold border border-border">
                    {c.shortcut}
                  </kbd>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {searchResults.trades.length > 0 && (
          <CommandGroup heading="Trades">
            {searchResults.trades.map((t: any) => (
              <CommandItem
                key={t.id}
                onSelect={() => {
                  navigate("tradeDetail", { id: t.id });
                  setCommandOpen(false);
                }}
                className="cursor-pointer"
              >
                <TrendingUp className={`h-4 w-4 ${t.direction === "long" ? "text-profit" : "text-loss"}`} />
                <span className="font-medium">{t.instrumentSymbol}</span>
                <span className="text-xs text-muted-foreground">{t.direction}</span>
                {t.setupGrade && <span className="text-xs text-muted-foreground">· {t.setupGrade}</span>}
                {(t as any)._isTypo && <span className="ml-auto text-xs text-warning">similar</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
