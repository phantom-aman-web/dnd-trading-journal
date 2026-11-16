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
  BookA,
  FolderKanban,
  FileText,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { useFloatingWidgetsStore } from "@/lib/floating-widgets-store";
import { usePrivacyStore } from "@/lib/privacy-store";
import { formatSignedCents } from "@/lib/money";

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

  // Unified global search across multiple entity domains
  const trimmedQuery = query.trim();
  const { data: searchData } = useQuery({
    queryKey: ["global-search", trimmedQuery],
    queryFn: async () => {
      if (!trimmedQuery) return null;
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, { cache: "no-store" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: commandOpen && trimmedQuery.length > 0,
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

  // Fuzzy search commands
  const filteredCommands = useMemo(() => {
    if (!trimmedQuery) return allCommands;
    const cmdResults = fuzzySearch(allCommands, trimmedQuery, (c) => [c.label, ...c.keywords]);
    return cmdResults.map((r) => r.item);
  }, [trimmedQuery, allCommands]);

  const trades = searchData?.trades || [];
  const observations = searchData?.observations || [];
  const strategies = searchData?.strategies || [];
  const strategyVersions = searchData?.strategyVersions || [];
  const accounts = searchData?.accounts || [];
  const tasks = searchData?.tasks || [];
  const dictionary = searchData?.dictionary || [];

  // Local Notes search (Quick Notes & Sticky Notes)
  const [localQuickNotes, setLocalQuickNotes] = useState<Array<{ id: string; title: string; content: string }>>([]);
  const [localStickyNotes, setLocalStickyNotes] = useState<Array<{ id: string; text: string }>>([]);

  useEffect(() => {
    if (!commandOpen) return;
    try {
      const qnRaw = localStorage.getItem("alphapips-quick-notes-list");
      let qList: Array<{ id: string; title: string; content: string }> = [];
      if (qnRaw) {
        const parsed = JSON.parse(qnRaw);
        if (Array.isArray(parsed)) qList = parsed;
      }
      const draftRaw = localStorage.getItem("alphapips-quick-notes-active-draft");
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        if (draft && (draft.title || draft.content)) {
          qList = [{ id: "active-draft", title: draft.title || "Active Draft", content: draft.content || "" }, ...qList];
        }
      }
      setLocalQuickNotes(qList);

      const snRaw = localStorage.getItem("alphapips-sticky-notes-data");
      if (snRaw) {
        const parsed = JSON.parse(snRaw);
        if (Array.isArray(parsed)) setLocalStickyNotes(parsed);
      }
    } catch {}
  }, [commandOpen]);

  const filteredQuickNotes = useMemo(() => {
    if (!trimmedQuery) return [];
    const q = trimmedQuery.toLowerCase();
    return localQuickNotes.filter(
      (n) => (n.title && n.title.toLowerCase().includes(q)) || (n.content && n.content.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [trimmedQuery, localQuickNotes]);

  const filteredStickyNotes = useMemo(() => {
    if (!trimmedQuery) return [];
    const q = trimmedQuery.toLowerCase();
    return localStickyNotes.filter(
      (n) => n.text && n.text.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [trimmedQuery, localStickyNotes]);

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput
        placeholder="Search trades, observations, setups, tasks, notes... (or type shortcut)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {trimmedQuery ? `No results for "${query}". Try a different term or keyword.` : "Start typing to search..."}
        </CommandEmpty>

        {/* 1. Actions & Navigation */}
        <CommandGroup heading="Actions & Navigation">
          {filteredCommands.slice(0, 8).map((c) => {
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

        {/* 2. Trades */}
        {trades.length > 0 && (
          <CommandGroup heading="Trades">
            {trades.map((t: any) => {
              const pnl = formatSignedCents(t.netPnlCents || 0);
              return (
                <CommandItem
                  key={`trade-${t.id}`}
                  onSelect={() => {
                    navigate("tradeDetail", { id: t.id });
                    setCommandOpen(false);
                  }}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`h-4 w-4 ${t.direction === "long" ? "text-profit" : "text-loss"}`} />
                    <span className="font-semibold font-mono">{t.instrumentSymbol}</span>
                    <span className="text-xs uppercase text-muted-foreground">({t.direction})</span>
                    {t.setupGrade && <span className="text-xs text-muted-foreground">· Grade {t.setupGrade}</span>}
                    {t.session && <span className="text-xs text-muted-foreground">· {t.session}</span>}
                  </div>
                  <div className={`text-xs font-mono font-medium ${pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground"}`}>
                    {pnl.text}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* 3. No-Trade Observations */}
        {observations.length > 0 && (
          <CommandGroup heading="No-Trade Observations">
            {observations.map((o: any) => (
              <CommandItem
                key={`obs-${o.id}`}
                onSelect={() => {
                  navigate("tradesLog", { tab: "observations" });
                  setCommandOpen(false);
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold font-mono">{o.instrumentSymbol}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                    · {o.title || o.observation || o.reasonCategory}
                  </span>
                </div>
                <span className="text-[11px] capitalize text-muted-foreground">{o.decisionType?.replace(/_/g, " ")}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 4. Setups & Strategies */}
        {strategies.length > 0 && (
          <CommandGroup heading="Setups & Strategies">
            {strategies.map((s: any) => (
              <CommandItem
                key={`strat-${s.id}`}
                onSelect={() => {
                  navigate("setups", { strategyId: s.id });
                  setCommandOpen(false);
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{s.name}</span>
                  {s.market && <span className="text-xs text-muted-foreground">· {s.market}</span>}
                  {s.timeframe && <span className="text-xs text-muted-foreground">· {s.timeframe}</span>}
                </div>
                <span className="text-xs text-muted-foreground">Open Setup</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 4b. Strategy Versions */}
        {strategyVersions.length > 0 && (
          <CommandGroup heading="Strategy Versions">
            {strategyVersions.map((v: any) => (
              <CommandItem
                key={`strat-ver-${v.id}`}
                onSelect={() => {
                  navigate("setups", { strategyId: v.strategyId });
                  setCommandOpen(false);
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary/70" />
                  <span className="font-semibold">{v.strategy?.name || "Setup"}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                    v{v.versionLabel}
                  </span>
                  {v.changeSummary && (
                    <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                      · {v.changeSummary}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Inspect Version</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 5. Trading Accounts */}
        {accounts.length > 0 && (
          <CommandGroup heading="Accounts">
            {accounts.map((a: any) => (
              <CommandItem
                key={`acc-${a.id}`}
                onSelect={() => {
                  navigate("accounts");
                  setCommandOpen(false);
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-500" />
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({a.broker || a.accountType}) · {a.currency}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Manage</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 6. Trading Tasks */}
        {tasks.length > 0 && (
          <CommandGroup heading="Tasks & To-Dos">
            {tasks.map((tk: any) => (
              <CommandItem
                key={`task-${tk.id}`}
                onSelect={() => {
                  navigate("tradingTodo");
                  setCommandOpen(false);
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-blue-500" />
                  <span className="font-medium truncate max-w-[280px]">{tk.title}</span>
                  <span className="text-xs text-muted-foreground">[{tk.listName}]</span>
                </div>
                <span className="text-xs capitalize text-muted-foreground">{tk.priority}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 7. Trading Dictionary */}
        {dictionary.length > 0 && (
          <CommandGroup heading="Strategy Glossary & Concepts">
            {dictionary.map((d: any) => (
              <CommandItem
                key={`dict-${d.id}`}
                onSelect={() => {
                  navigate("setups");
                  setCommandOpen(false);
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <BookA className="h-4 w-4 text-purple-500" />
                  <span className="font-semibold">{d.term}</span>
                  {d.abbreviation && <span className="text-xs font-mono text-muted-foreground">({d.abbreviation})</span>}
                  <span className="text-xs text-muted-foreground truncate max-w-[260px]">· {d.definition}</span>
                </div>
                {d.category && <span className="text-xs text-muted-foreground">{d.category}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 8. Quick Notes */}
        {filteredQuickNotes.length > 0 && (
          <CommandGroup heading="Quick Notes">
            {filteredQuickNotes.map((qn) => (
              <CommandItem
                key={`qn-${qn.id}`}
                onSelect={() => {
                  useFloatingWidgetsStore.getState().setWidgetVisible("quick_notes", true);
                  useFloatingWidgetsStore.getState().bringToFront("quick_notes");
                  setCommandOpen(false);
                  toast.success(`Opened Quick Note: ${qn.title || "Untitled"}`);
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold">{qn.title || "Quick Note"}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[260px]">
                    · {qn.content.replace(/\n/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Open Widget</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 9. Sticky Notes */}
        {filteredStickyNotes.length > 0 && (
          <CommandGroup heading="Sticky Notes">
            {filteredStickyNotes.map((sn) => (
              <CommandItem
                key={`sn-${sn.id}`}
                onSelect={() => {
                  useFloatingWidgetsStore.getState().setWidgetVisible("sticky_notes", true);
                  useFloatingWidgetsStore.getState().bringToFront("sticky_notes");
                  setCommandOpen(false);
                  toast.success("Opened Sticky Notes widget");
                }}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium text-xs truncate max-w-[320px]">
                    {sn.text.replace(/\n/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Open Widget</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
