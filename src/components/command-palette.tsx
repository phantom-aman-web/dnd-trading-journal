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
} from "lucide-react";
import { toast } from "sonner";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { useQuery } from "@tanstack/react-query";

interface CommandEntry {
  id: string;
  label: string;
  view?: ViewKey;
  action?: () => void | Promise<void>;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

const BASE_COMMANDS: CommandEntry[] = [
  { id: "dashboard", label: "Open Dashboard", view: "dashboard", icon: LayoutDashboard, keywords: ["home", "overview", "metrics", "pnl", "performance"] },
  { id: "tradesLog", label: "Open Trades Log", view: "tradesLog", icon: BookOpen, keywords: ["trades", "history", "log", "entries", "journal"] },
  { id: "add-trade", label: "Add Trade", view: "tradeNew", icon: Plus, keywords: ["new", "create", "log", "record"] },
  { id: "calendar", label: "Open Trading Calendar", view: "calendar", icon: Calendar, keywords: ["monthly", "daily", "schedule", "days"] },
  { id: "analytics", label: "Open Analytics Engine", view: "analytics", icon: BarChart3, keywords: ["stats", "charts", "breakdown", "instrument", "session"] },
  { id: "setups", label: "Open Setups & Checklists", view: "setups", icon: ListChecks, keywords: ["strategy", "strategies", "rules", "checklist", "setups"] },
  { id: "accounts", label: "Open Accounts", view: "accounts", icon: Wallet, keywords: ["account", "balance", "broker", "prop", "funded"] },
  { id: "settings", label: "Open Settings", view: "settings", icon: Settings, keywords: ["profile", "accounts", "appearance", "theme", "privacy", "risk"] },
  { id: "backup", label: "Open Backup / Restore", view: "backup", icon: DatabaseBackup, keywords: ["backup", "restore", "export", "import", "json"] },
];

async function fetchTradesForSearch() {
  const res = await fetch("/api/trades?limit=200", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, navigate } = useNav();
  const [query, setQuery] = useState("");

  // Fetch trades for search (only when palette is open)
  const { data: trades } = useQuery({
    queryKey: ["trades-search"],
    queryFn: fetchTradesForSearch,
    enabled: commandOpen,
  });

  // Clear query when palette closes
  useEffect(() => {
    if (!commandOpen) setQuery("");
  }, [commandOpen]);

  // Build the full searchable list
  const allCommands = useMemo(() => {
    const cmds: CommandEntry[] = [...BASE_COMMANDS];
    // Add export action
    cmds.push({
      id: "export-data",
      label: "Export Data",
      icon: Download,
      keywords: ["download", "backup", "csv", "json"],
      action: async () => {
        const res = await fetch("/api/exports?format=json&type=all");
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dnd-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export ready.");
      },
    });
    return cmds;
  }, []);

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

  const exactCommands = searchResults.commands.filter((_, i) => {
    if (!query.trim()) return true;
    const r = fuzzySearch([allCommands.find(c => c.id === searchResults.commands[i]?.id) ?? { label: "", keywords: [] }], query, (c) => [c.label, ...c.keywords])[0];
    return r?.isExact || r?.isFuzzy;
  });

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Type a command or search trades..." value={query} onValueChange={setQuery} />
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
                      if (c.view) navigate(c.view);
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

        <CommandGroup heading="Navigate">
          {searchResults.commands.slice(0, 10).map((c) => {
            const Icon = c.icon;
            return (
              <CommandItem
                key={c.id}
                onSelect={() => {
                  if (c.view) navigate(c.view);
                  else c.action?.();
                  setCommandOpen(false);
                }}
                className="cursor-pointer"
              >
                <Icon className="h-4 w-4" />
                <span>{c.label}</span>
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
