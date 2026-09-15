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
} from "@/components/ui/dropdown-menu";
import {
  Search,
  ChevronDown,
  Menu,
  LogOut,
  Settings as SettingsIcon,
  DatabaseBackup,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MarketClock } from "@/components/market-clock";

async function fetchAccounts() {
  const res = await fetch("/api/accounts", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const arr = (data as any)?.items ?? (data as any)?.accounts ?? (Array.isArray(data) ? data : []);
  return Array.isArray(arr) ? arr : [];
}

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { navigate, setCommandOpen, params, setParams } = useNav();
  const { user, signOut } = useAuth();
  const { theme: currentTheme, setTheme: applyTheme } = useTheme();
  const qc = useQueryClient();

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });
  const accounts = Array.isArray(accountsData)
    ? accountsData
    : (accountsData?.items ?? (Array.isArray(accountsData?.accounts) ? accountsData.accounts : []));

  const accountFilter = params.accountId ?? "all";

  function setAccountFilter(v: string) {
    setParams({ accountId: v === "all" ? "" : v });
  }

  const themeOptions = [
    { key: "nordic", label: "Nordic Clean" },
    { key: "terminal", label: "Sleek Terminal" },
    { key: "institutional", label: "Institutional Blue" },
  ] as const;

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
        <SelectTrigger className="hidden sm:flex w-auto h-9 text-sm font-medium border-input bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Accounts ({accounts?.length ?? 0})</SelectItem>
          {accounts?.map((a: any) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} (${((a.startingBalanceCents ?? 0) / 100).toLocaleString()})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        onClick={() => setCommandOpen(true)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground hover:bg-muted w-full max-w-md"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search notes, symbol, tags...</span>
        <span className="sm:hidden">Search</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Real-time New York Market Clock — automatic DST, no manual offset */}
        <MarketClock />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme" className="hidden md:inline-flex text-muted-foreground hover:bg-muted">
              <span className="text-xs font-mono">Aa</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {themeOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.key}
                onClick={() => applyTheme(opt.key)}
                className={cn("flex items-center gap-2", currentTheme === opt.key && "font-semibold")}
              >
                <span className={cn("h-2 w-2 rounded-full", currentTheme === opt.key ? "bg-primary" : "bg-transparent border border-border")} />
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden md:flex items-center gap-2 h-9 px-2 rounded-md hover:bg-muted">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span>{user?.name ?? "Trader"}</span>
              <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("settings")}>
              <SettingsIcon className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("backup")}>
              <DatabaseBackup className="h-4 w-4 mr-2" />
              Backup / Restore
            </DropdownMenuItem>
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
