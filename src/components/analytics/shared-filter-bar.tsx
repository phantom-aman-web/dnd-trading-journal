"use client";

import { useMemo } from "react";
import { Filter, RotateCcw, X, Calendar, Layers, Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  return (
    <div className="space-y-3">
      {/* Primary Control Selectors Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3 rounded-xl border border-border bg-card/60">
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
