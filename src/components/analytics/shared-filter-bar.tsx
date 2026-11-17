"use client";

import { useMemo, useState } from "react";
import { Filter, RotateCcw, X, Calendar, Layers, Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AnalyticsFilterState {
  accountId: string;
  datePreset: "all" | "today" | "7d" | "30d" | "month" | "last_month" | "custom";
  customFrom: string;
  customTo: string;
  instrumentId: string;
  strategyId: string;
  direction: "all" | "BUY" | "SELL";
}

interface SharedFilterBarProps {
  filters: AnalyticsFilterState;
  onChange: (updated: Partial<AnalyticsFilterState>) => void;
  onReset: () => void;
  accounts: Array<{ id: string; name: string }>;
  instruments: Array<{ id: string; symbol: string; name?: string }>;
  strategies: Array<{ id: string; name: string }>;
}

const DATE_PRESET_LABELS: Record<string, string> = {
  all: "All Time",
  today: "Today",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  month: "This Month",
  last_month: "Last Month",
  custom: "Custom Range",
};

export function SharedFilterBar({
  filters,
  onChange,
  onReset,
  accounts,
  instruments,
  strategies,
}: SharedFilterBarProps) {
  const hasActiveFilters = useMemo(() => {
    return (
      (filters.accountId && filters.accountId !== "all") ||
      filters.datePreset !== "all" ||
      (filters.instrumentId && filters.instrumentId !== "all") ||
      (filters.strategyId && filters.strategyId !== "all") ||
      (filters.direction && filters.direction !== "all")
    );
  }, [filters]);

  const activeAccountName = useMemo(() => {
    if (!filters.accountId || filters.accountId === "all") return null;
    return accounts.find((a) => a.id === filters.accountId)?.name ?? "Account";
  }, [filters.accountId, accounts]);

  const activeInstrumentSymbol = useMemo(() => {
    if (!filters.instrumentId || filters.instrumentId === "all") return null;
    return instruments.find((i) => i.id === filters.instrumentId)?.symbol ?? "Instrument";
  }, [filters.instrumentId, instruments]);

  const activeStrategyName = useMemo(() => {
    if (!filters.strategyId || filters.strategyId === "all") return null;
    return strategies.find((s) => s.id === filters.strategyId)?.name ?? "Strategy";
  }, [filters.strategyId, strategies]);

  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount =
    (filters.accountId && filters.accountId !== "all" ? 1 : 0) +
    (filters.datePreset !== "all" ? 1 : 0) +
    (filters.instrumentId && filters.instrumentId !== "all" ? 1 : 0) +
    (filters.strategyId && filters.strategyId !== "all" ? 1 : 0) +
    (filters.direction && filters.direction !== "all" ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Mobile Filter Trigger & Sheet */}
      <div className="md:hidden flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-card/60">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 px-3 gap-1.5 flex-1 justify-start border-input text-xs",
                activeCount > 0 && "border-primary/60 bg-primary/10 text-primary font-medium"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeCount > 0 ? (
                <Badge variant="default" className="h-4 px-1 text-[10px] min-w-[16px] flex items-center justify-center font-mono ml-auto">
                  {activeCount} active
                </Badge>
              ) : (
                <span className="text-muted-foreground ml-auto text-[11px]">All data</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl p-4 overflow-y-auto">
            <SheetHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-base font-semibold">Analytics Filters</SheetTitle>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                  >
                    Reset All
                  </Button>
                )}
              </div>
            </SheetHeader>
            <div className="py-4 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Date Range
                </label>
                <Select
                  value={filters.datePreset}
                  onValueChange={(v: any) => onChange({ datePreset: v })}
                >
                  <SelectTrigger className="h-9 text-xs bg-card">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATE_PRESET_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filters.datePreset === "custom" && (
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">From</label>
                    <Input
                      type="date"
                      value={filters.customFrom}
                      onChange={(e) => onChange({ customFrom: e.target.value })}
                      className="h-8 text-xs bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">To</label>
                    <Input
                      type="date"
                      value={filters.customTo}
                      onChange={(e) => onChange({ customTo: e.target.value })}
                      className="h-8 text-xs bg-card"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Account
                </label>
                <Select
                  value={filters.accountId || "all"}
                  onValueChange={(v) => onChange({ accountId: v })}
                >
                  <SelectTrigger className="h-9 text-xs bg-card">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Instrument</label>
                <Select
                  value={filters.instrumentId || "all"}
                  onValueChange={(v) => onChange({ instrumentId: v })}
                >
                  <SelectTrigger className="h-9 text-xs bg-card">
                    <SelectValue placeholder="All Instruments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Instruments</SelectItem>
                    {instruments.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Strategy</label>
                <Select
                  value={filters.strategyId || "all"}
                  onValueChange={(v) => onChange({ strategyId: v })}
                >
                  <SelectTrigger className="h-9 text-xs bg-card">
                    <SelectValue placeholder="All Strategies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strategies</SelectItem>
                    {strategies.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Direction</label>
                <Select
                  value={filters.direction || "all"}
                  onValueChange={(v: any) => onChange({ direction: v })}
                >
                  <SelectTrigger className="h-9 text-xs bg-card">
                    <SelectValue placeholder="All Directions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Directions</SelectItem>
                    <SelectItem value="BUY">Long Only (Buy)</SelectItem>
                    <SelectItem value="SELL">Short Only (Sell)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <Button className="w-full" onClick={() => setSheetOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Primary Control Selectors Grid (Desktop) */}
      <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3 rounded-xl border border-border bg-card/60">
        {/* Date Preset */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Date Range
          </label>
          <Select
            value={filters.datePreset}
            onValueChange={(v: any) => onChange({ datePreset: v })}
          >
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATE_PRESET_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Account Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Layers className="h-3 w-3" /> Account
          </label>
          <Select
            value={filters.accountId || "all"}
            onValueChange={(v) => onChange({ accountId: v })}
          >
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Instrument Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Instrument
          </label>
          <Select
            value={filters.instrumentId || "all"}
            onValueChange={(v) => onChange({ instrumentId: v })}
          >
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All Instruments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Instruments</SelectItem>
              {instruments.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Strategy Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Strategy
          </label>
          <Select
            value={filters.strategyId || "all"}
            onValueChange={(v) => onChange({ strategyId: v })}
          >
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All Strategies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strategies</SelectItem>
              {strategies.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Direction Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Direction
          </label>
          <Select
            value={filters.direction || "all"}
            onValueChange={(v: any) => onChange({ direction: v })}
          >
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All Directions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="BUY">Long Only (Buy)</SelectItem>
              <SelectItem value="SELL">Short Only (Sell)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Action */}
        <div className="space-y-1 flex flex-col justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="h-8 text-xs gap-1.5 w-full text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset Filters
          </Button>
        </div>
      </div>

      {/* Custom Date Range Pickers if selected */}
      {filters.datePreset === "custom" && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border text-xs">
          <span className="font-semibold text-foreground">Custom Date Bounds:</span>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground">From:</label>
            <Input
              type="date"
              value={filters.customFrom}
              onChange={(e) => onChange({ customFrom: e.target.value })}
              className="h-7 text-xs w-36 bg-card"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground">To:</label>
            <Input
              type="date"
              value={filters.customTo}
              onChange={(e) => onChange({ customTo: e.target.value })}
              className="h-7 text-xs w-36 bg-card"
            />
          </div>
        </div>
      )}

      {/* Active Filter Badges Strip */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
            Active Filters:
          </span>

          {activeAccountName && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal pl-2 pr-1 h-6">
              <span>Account: {activeAccountName}</span>
              <button
                onClick={() => onChange({ accountId: "all" })}
                className="hover:text-foreground ml-0.5 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.datePreset !== "all" && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal pl-2 pr-1 h-6">
              <span>Date: {DATE_PRESET_LABELS[filters.datePreset]}</span>
              <button
                onClick={() => onChange({ datePreset: "all", customFrom: "", customTo: "" })}
                className="hover:text-foreground ml-0.5 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {activeInstrumentSymbol && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal pl-2 pr-1 h-6">
              <span>Symbol: {activeInstrumentSymbol}</span>
              <button
                onClick={() => onChange({ instrumentId: "all" })}
                className="hover:text-foreground ml-0.5 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {activeStrategyName && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal pl-2 pr-1 h-6">
              <span>Strategy: {activeStrategyName}</span>
              <button
                onClick={() => onChange({ strategyId: "all" })}
                className="hover:text-foreground ml-0.5 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.direction !== "all" && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal pl-2 pr-1 h-6">
              <span>Direction: {filters.direction === "BUY" ? "Long" : "Short"}</span>
              <button
                onClick={() => onChange({ direction: "all" })}
                className="hover:text-foreground ml-0.5 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <button
            onClick={onReset}
            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
