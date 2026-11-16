"use client";

/**
 * Analytics Engine — reference-aligned rebuild.
 *
 * Premium navy-blue + white-card aesthetic (matches
 * https://ae-tradingjournal.vercel.app/):
 *   - App background: bg-background
 *   - Cards: bg-card border border-border rounded-xl shadow-sm
 *   - Headings: text-foreground
 *   - Muted: text-muted-foreground
 *   - Accent/navy: #1e2330
 *   - Profit/Loss: text-profit / text-loss
 *
 * Five horizontal tabs (border-bottom active indicator):
 *   1. Overall Metrics
 *   2. By Setup & Account
 *   3. Checklist Adherence
 *   4. Rule Violations
 *   5. Sessions & Weekdays
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GroupBarChart } from "@/components/charts/group-bar-chart";
import { dToNumber } from "@/lib/decimal";
import { formatPct, formatR, formatSignedCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useNav } from "@/lib/nav-store";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Target,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Compass,
  Gauge,
  Timer,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeInTradeTab } from "@/components/analytics/time-in-trade-tab";
import { DrawdownAnalyticsTab } from "@/components/analytics/drawdown-analytics-tab";
import { DataQualityTab } from "@/components/analytics/data-quality-tab";
import { MetricDefinitionsModal } from "@/components/analytics/metric-definitions-modal";
import { SharedFilterBar, type AnalyticsFilterState } from "@/components/analytics/shared-filter-bar";

export type TabKey =
  | "overall"
  | "instruments"
  | "setup"
  | "drawdown"
  | "holdingTime"
  | "checklist"
  | "violations"
  | "sessions"
  | "dataQuality";

export interface AnalyticsSectionDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

export interface AnalyticsCategoryDef {
  id: string;
  label: string;
  sections: AnalyticsSectionDef[];
}

export const ANALYTICS_CATEGORIES: AnalyticsCategoryDef[] = [
  {
    id: "performance",
    label: "Performance",
    sections: [
      { key: "overall", label: "Overall Metrics", icon: BarChart3, desc: "P&L, win rate, profit factor, expectancy" },
      { key: "instruments", label: "By Instrument", icon: Compass, desc: "Asset class and symbol breakdown" },
      { key: "setup", label: "By Setup & Strategy", icon: Target, desc: "Playbook and strategy edge analysis" },
    ],
  },
  {
    id: "risk",
    label: "Risk & Capital",
    sections: [
      { key: "drawdown", label: "Equity & Drawdown", icon: TrendingUp, desc: "High-water mark and drawdown recovery" },
    ],
  },
  {
    id: "execution",
    label: "Execution",
    sections: [
      { key: "holdingTime", label: "Time in Trade", icon: Timer, desc: "Holding time distributions and trade duration" },
      { key: "sessions", label: "Sessions & Weekdays", icon: Calendar, desc: "NY/London/Asia session and weekday performance" },
    ],
  },
  {
    id: "quality",
    label: "Process & Quality",
    sections: [
      { key: "checklist", label: "Checklist Adherence", icon: CheckCircle2, desc: "Rule adherence and plan execution rate" },
      { key: "violations", label: "Rule Violations", icon: AlertTriangle, desc: "Discipline mistakes and behavioral impact" },
      { key: "dataQuality", label: "Data Quality", icon: ShieldCheck, desc: "Journal completeness and integrity audit" },
    ],
  },
];

export const ALL_SECTIONS: AnalyticsSectionDef[] = ANALYTICS_CATEGORIES.flatMap((c) => c.sections);

const TABS = ALL_SECTIONS;

/** Maps each tab to the analytics API dimension it needs. */
const TAB_DIMENSION: Record<TabKey, string> = {
  overall: "overview",
  instruments: "instrument",
  setup: "strategy",
  drawdown: "drawdown",
  holdingTime: "holding-time",
  checklist: "checklist",
  violations: "behavior",
  sessions: "session",
  dataQuality: "data-quality",
};

interface AnalyticsFetchFilters {
  accountId?: string;
  from?: string;
  to?: string;
  instrumentId?: string;
  strategyId?: string;
  direction?: string;
}

async function fetchAnalytics(dimension: string, filters: AnalyticsFetchFilters) {
  const url = new URL("/api/analytics", window.location.origin);
  url.searchParams.set("dimension", dimension);
  if (filters.accountId && filters.accountId !== "all") {
    url.searchParams.set("accountId", filters.accountId);
  }
  if (filters.from) url.searchParams.set("from", filters.from);
  if (filters.to) url.searchParams.set("to", filters.to);
  if (filters.instrumentId && filters.instrumentId !== "all") {
    url.searchParams.set("instrumentId", filters.instrumentId);
  }
  if (filters.strategyId && filters.strategyId !== "all") {
    url.searchParams.set("strategyId", filters.strategyId);
  }
  if (filters.direction && filters.direction !== "all") {
    url.searchParams.set("direction", filters.direction);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

async function fetchAccountsList() {
  const res = await fetch("/api/accounts", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const arr = (data as any)?.items ?? data?.accounts ?? (Array.isArray(data) ? data : []);
  return Array.isArray(arr) ? arr : [];
}

async function fetchInstrumentsList() {
  const res = await fetch("/api/instruments", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const arr = Array.isArray(data) ? data : data?.items ?? [];
  return Array.isArray(arr) ? arr : [];
}

async function fetchStrategiesList() {
  const res = await fetch("/api/strategies", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const arr = (data as any)?.items ?? (Array.isArray(data) ? data : []);
  return Array.isArray(arr) ? arr : [];
}

export function AnalyticsView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("overall");
  const [isDefinitionsModalOpen, setIsDefinitionsModalOpen] = useState(false);
  const { params, setParams, navigate, selectedAccountId, setSelectedAccountId } = useNav();
  
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    accountId: selectedAccountId || params.accountId || "all",
    datePreset: "all",
    customFrom: "",
    customTo: "",
    instrumentId: "all",
    strategyId: "all",
    direction: "all",
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: fetchAccountsList,
    enabled: !!user?.id,
  });

  const { data: instrumentsData } = useQuery({
    queryKey: ["instruments"],
    queryFn: fetchInstrumentsList,
  });

  const { data: strategiesData } = useQuery({
    queryKey: ["strategies", user?.id],
    queryFn: fetchStrategiesList,
    enabled: !!user?.id,
  });

  const selectedAccountName = useMemo(() => {
    if (!filters.accountId || filters.accountId === "all") return "All Accounts";
    const accList = Array.isArray(accountsData) ? accountsData : ((accountsData as any)?.items ?? []);
    return accList.find((a: any) => a.id === filters.accountId)?.name ?? "Account";
  }, [filters.accountId, accountsData]);

  // Derive date bounds from preset
  const { from, to } = useMemo(() => {
    if (filters.datePreset === "all") return { from: undefined, to: undefined };
    const now = new Date();
    if (filters.datePreset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { from: start, to: undefined };
    }
    if (filters.datePreset === "7d") {
      const start = new Date(now.getTime() - 7 * 86400000).toISOString();
      return { from: start, to: undefined };
    }
    if (filters.datePreset === "30d") {
      const start = new Date(now.getTime() - 30 * 86400000).toISOString();
      return { from: start, to: undefined };
    }
    if (filters.datePreset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return { from: start, to: undefined };
    }
    if (filters.datePreset === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
      return { from: start, to: end };
    }
    if (filters.datePreset === "custom") {
      return {
        from: filters.customFrom ? new Date(filters.customFrom).toISOString() : undefined,
        to: filters.customTo ? new Date(filters.customTo).toISOString() : undefined,
      };
    }
    return { from: undefined, to: undefined };
  }, [filters.datePreset, filters.customFrom, filters.customTo]);

  const queryFilters: AnalyticsFetchFilters = useMemo(() => ({
    accountId: filters.accountId,
    from,
    to,
    instrumentId: filters.instrumentId !== "all" ? filters.instrumentId : undefined,
    strategyId: filters.strategyId !== "all" ? filters.strategyId : undefined,
    direction: filters.direction !== "all" ? filters.direction : undefined,
  }), [filters.accountId, from, to, filters.instrumentId, filters.strategyId, filters.direction]);

  const dimension = TAB_DIMENSION[tab];

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", dimension, queryFilters],
    queryFn: () => fetchAnalytics(dimension, queryFilters),
  });

  // Sessions tab also needs the time dimension (weekday + hour).
  const needsTime = tab === "sessions";
  const { data: timeData, isLoading: timeLoading } = useQuery({
    queryKey: ["analytics", "time", queryFilters],
    queryFn: () => fetchAnalytics("time", queryFilters),
    enabled: needsTime,
  });

  const loading = isLoading || (needsTime && timeLoading);

  function handleFilterChange(updated: Partial<AnalyticsFilterState>) {
    setFilters((prev) => {
      const next = { ...prev, ...updated };
      if ("accountId" in updated) {
        setSelectedAccountId(updated.accountId === "all" ? "" : updated.accountId ?? "");
      }
      return next;
    });
  }

  function handleResetFilters() {
    setSelectedAccountId("");
    setFilters({
      accountId: "all",
      datePreset: "all",
      customFrom: "",
      customTo: "",
      instrumentId: "all",
      strategyId: "all",
      direction: "all",
    });
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Analytics Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Decompose your performance by setup, instrument, behavior, session, time, and capital drawdown.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDefinitionsModalOpen(true)}
              className="h-9 text-xs gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Metric Formulas</span>
            </Button>
          </div>
        </div>

        {/* Shared Analytical Filter Bar */}
        <SharedFilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          accounts={Array.isArray(accountsData) ? accountsData : []}
          instruments={Array.isArray(instrumentsData) ? instrumentsData : []}
          strategies={Array.isArray(strategiesData) ? strategiesData : []}
        />

        {/* Active Scope & Audit Context Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-border/80 bg-muted/30 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground">Active Scope:</span>
            <span className="font-medium text-foreground">{selectedAccountName}</span>
            <span>·</span>
            <span>{filters.datePreset === "all" ? "All Recorded History" : "Filtered Window"}</span>
            <span>·</span>
            <span className="text-foreground font-medium">Closed Realized Trades Only</span>
          </div>
          <button
            onClick={() => navigate("tradesLog", filters.accountId !== "all" ? { accountId: filters.accountId } : undefined)}
            className="text-primary hover:underline font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            Inspect contributing trades in Journal →
          </button>
        </div>

        {/* Grouped Analytics Navigation — Full Discoverability without Horizontal Scrolling */}
        <div className="space-y-3">
          {/* Mobile / Narrow Workspace Panel Dropdown Selector */}
          <div className="block md:hidden">
            <Select value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <SelectTrigger className="w-full h-10 bg-card border-border text-xs font-semibold">
                <SelectValue placeholder="Select analytics section" />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="py-1">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30">
                      {cat.label}
                    </div>
                    {cat.sections.map((s) => {
                      const Icon = s.icon;
                      return (
                        <SelectItem key={s.key} value={s.key} className="text-xs py-2 cursor-pointer">
                          <span className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            <span>{s.label}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop & Workspace Grouped Navigation */}
          <div className="hidden md:flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-2.5 shadow-xs">
            {/* Tier 1: Categories */}
            <div className="flex items-center gap-1.5 flex-wrap border-b border-border/60 pb-2">
              {ANALYTICS_CATEGORIES.map((cat) => {
                const isCatActive = cat.sections.some((s) => s.key === tab);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (!isCatActive) {
                        setTab(cat.sections[0].key);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                      isCatActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                        isCatActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {cat.sections.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tier 2: Specific Sections within Active Category */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {ANALYTICS_CATEGORIES.find((c) => c.sections.some((s) => s.key === tab))?.sections.map((s) => {
                const Icon = s.icon;
                const isSelected = tab === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setTab(s.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 cursor-pointer border",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                    title={s.desc}
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab content containers */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="hidden">
            {ALL_SECTIONS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overall" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "overall" ? (
              <AnalyticsSkeleton />
            ) : (
              <OverallMetrics
                aggregate={data?.aggregate}
                holdingDuration={data?.holdingDuration}
                excursion={data?.excursion}
              />
            )}
          </TabsContent>

          <TabsContent value="instruments" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "instruments" ? (
              <AnalyticsSkeleton />
            ) : (
              <InstrumentBreakdown
                items={(data as any)?.items ?? []}
                onSelectSymbol={(sym) => navigate("tradesLog", { symbol: sym })}
              />
            )}
          </TabsContent>

          <TabsContent value="setup" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "setup" ? (
              <AnalyticsSkeleton />
            ) : (
              <SetupBreakdown
                items={(data as any)?.items ?? []}
                onSelectStrategy={(stratId) => navigate("tradesLog", { strategyId: stratId })}
              />
            )}
          </TabsContent>

          <TabsContent value="drawdown" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "drawdown" ? (
              <AnalyticsSkeleton />
            ) : (
              <DrawdownAnalyticsTab data={data as any} />
            )}
          </TabsContent>

          <TabsContent value="holdingTime" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "holdingTime" ? (
              <AnalyticsSkeleton />
            ) : (
              <TimeInTradeTab data={data as any} />
            )}
          </TabsContent>

          <TabsContent value="checklist" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "checklist" ? (
              <AnalyticsSkeleton />
            ) : (
              <ChecklistAdherence data={data} />
            )}
          </TabsContent>

          <TabsContent value="violations" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "violations" ? (
              <AnalyticsSkeleton />
            ) : (
              <RuleViolations
                items={(data as any)?.items ?? []}
                totalTrades={(data as any)?.totalTrades ?? 0}
                onSelectRule={(flag) => navigate("tradesLog", { search: flag })}
              />
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "sessions" ? (
              <AnalyticsSkeleton />
            ) : (
              <SessionsWeekdays
                sessionItems={(data as any)?.items ?? []}
                weekday={timeData?.weekday ?? []}
                hour={timeData?.hour ?? []}
                entryHour={timeData?.entryHour}
                realizationHour={timeData?.realizationHour}
                onSelectSession={(sess) => navigate("tradesLog", { session: sess })}
              />
            )}
          </TabsContent>

          <TabsContent value="dataQuality" className="mt-6 focus-visible:outline-none">
            {loading || tab !== "dataQuality" ? (
              <AnalyticsSkeleton />
            ) : (
              <DataQualityTab
                data={data as any}
                onFixTrade={(tradeId) => navigate("tradeDetail", { id: tradeId })}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Metric Definitions Modal */}
        <MetricDefinitionsModal
          open={isDefinitionsModalOpen}
          onOpenChange={setIsDefinitionsModalOpen}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDurationMinutes(mins: number | null | undefined): string {
  if (mins == null || mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hrs < 24) {
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  }
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

// ---------------------------------------------------------------------------
// Tab 1 — Overall Metrics
// ---------------------------------------------------------------------------

function OverallMetrics({
  aggregate: m,
  holdingDuration,
  excursion,
}: {
  aggregate: any;
  holdingDuration?: {
    avgAllMinutes: number | null;
    avgWinMinutes: number | null;
    avgLossMinutes: number | null;
  };
  excursion?: {
    avgMfeR: string | null;
    avgMaeR: string | null;
    avgProfitRetentionPct: number | null;
    tradesWithExcursionCount: number;
  };
}) {
  if (!m || m.totalTrades === 0) {
    return <NoDataState message="Your analytics will appear here once you have closed trades." />;
  }

  const pf = m.profitFactor ? dToNumber(m.profitFactor) : null;
  const expectancy = m.expectancyR ? dToNumber(m.expectancyR) : null;

  return (
    <div className="space-y-6">
      {/* Big metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BigMetric
          label="Total Closed Trades"
          value={String(m.closedTrades ?? 0)}
          icon={BarChart3}
        />
        <BigMetric
          label="Win Rate"
          value={m.winRate ? formatPct(m.winRate) : "N/A"}
          tone={m.winRate && dToNumber(m.winRate) >= 0.5 ? "profit" : "neutral"}
          icon={Target}
        />
        <BigMetric
          label="Profit Factor"
          value={pf != null ? pf.toFixed(2) : "N/A"}
          tone={pf != null && pf >= 1 ? "profit" : "loss"}
          icon={Activity}
        />
        <BigMetric
          label="Expectancy"
          value={m.expectancyR ? `${formatR(m.expectancyR)} / trade` : "N/A"}
          tone={expectancy != null && expectancy > 0 ? "profit" : "loss"}
          icon={TrendingUp}
        />
      </div>

      {/* Core distribution summary */}
      <Card>
        <SectionHeading>Core Distribution Summary</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <DistributionMetric
            label="Avg Winning Trade"
            value={m.avgWinCents != null ? formatSignedCents(m.avgWinCents).text : "N/A"}
            tone="profit"
          />
          <DistributionMetric
            label="Avg Losing Trade"
            value={m.avgLossCents != null ? formatSignedCents(m.avgLossCents).text : "N/A"}
            tone="loss"
          />
          <DistributionMetric
            label="Largest Win"
            value={m.largestWinCents != null ? formatSignedCents(m.largestWinCents).text : "N/A"}
            tone="profit"
          />
          <DistributionMetric
            label="Largest Loss"
            value={m.largestLossCents != null ? formatSignedCents(m.largestLossCents).text : "N/A"}
            tone="loss"
          />
        </div>
      </Card>

      {/* Execution & Streak Statistics */}
      <Card>
        <SectionHeading>Execution & Streak Statistics</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          <DistributionMetric label="Net P&L" value={formatSignedCents(m.netPnlCents).text} tone={m.netPnlCents >= 0 ? "profit" : "loss"} />
          <DistributionMetric label="Expectancy ($)" value={m.expectancyCents != null ? formatSignedCents(m.expectancyCents).text : "N/A"} tone={(m.expectancyCents ?? 0) >= 0 ? "profit" : "loss"} />
          <DistributionMetric label="Avg R" value={formatR(m.avgR)} tone={m.avgR && dToNumber(m.avgR) > 0 ? "profit" : "loss"} />
          <DistributionMetric label="Total R" value={formatR(m.totalR)} tone={m.totalR && dToNumber(m.totalR) > 0 ? "profit" : "loss"} />
          <DistributionMetric label="Wins / Losses / BE" value={`${m.wins} / ${m.losses} / ${m.breakevens}`} />
          <DistributionMetric
            label="Win Streak"
            value={`${m.currentWinStreak ?? 0} (Max ${m.maxWinStreak ?? 0})`}
            tone="profit"
          />
          <DistributionMetric
            label="Loss Streak"
            value={`${m.currentLossStreak ?? 0} (Max ${m.maxLossStreak ?? 0})`}
            tone="loss"
          />
          <DistributionMetric
            label="Max Drawdown (Realized)"
            value={
              m.maxDrawdownCents != null
                ? `${formatSignedCents(-Math.abs(m.maxDrawdownCents)).text}${
                    m.drawdownPct != null ? ` (${(dToNumber(m.drawdownPct) * 100).toFixed(1)}%)` : ""
                  }`
                : "Unavailable (Starting balance required)"
            }
            tone={m.maxDrawdownCents != null ? "loss" : "neutral"}
          />
        </div>
      </Card>

      {/* Trade Duration & Holding Time Analysis */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionHeading>Trade Duration & Holding Time Analysis</SectionHeading>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Measure how long positions are held to identify behavioral disparities between winners and losers.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <DistributionMetric
            label="Avg Hold Time (All Trades)"
            value={formatDurationMinutes(holdingDuration?.avgAllMinutes)}
          />
          <DistributionMetric
            label="Avg Win Hold Time"
            value={formatDurationMinutes(holdingDuration?.avgWinMinutes)}
            tone="profit"
          />
          <DistributionMetric
            label="Avg Loss Hold Time"
            value={formatDurationMinutes(holdingDuration?.avgLossMinutes)}
            tone="loss"
          />
        </div>
      </Card>

      {/* Excursion & Execution Efficiency (MAE / MFE) */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionHeading>Excursion & Execution Efficiency (MAE / MFE)</SectionHeading>
          <Gauge className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Maximum Favorable Excursion (MFE) and Maximum Adverse Excursion (MAE) track peak unrealized gains and drawdowns during trade life.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <DistributionMetric
            label="Avg MFE (Peak Potential)"
            value={excursion?.avgMfeR ? `${excursion.avgMfeR} R` : "—"}
            tone="profit"
          />
          <DistributionMetric
            label="Avg MAE (Peak Drawdown)"
            value={excursion?.avgMaeR ? `${excursion.avgMaeR} R` : "—"}
            tone="loss"
          />
          <DistributionMetric
            label="Avg Profit Retention"
            value={excursion?.avgProfitRetentionPct != null ? `${excursion.avgProfitRetentionPct}%` : "—"}
            tone={excursion?.avgProfitRetentionPct && excursion.avgProfitRetentionPct >= 70 ? "profit" : "neutral"}
          />
        </div>
      </Card>
    </div>
  );
}

function BigMetric({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "profit" | "loss" | "neutral";
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
          {label}
        </div>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "profit"
                ? "text-profit"
                : tone === "loss"
                  ? "text-loss"
                  : "text-muted-foreground/70",
            )}
          />
        )}
      </div>
      <div
        className={cn(
          "text-2xl font-bold tabular-nums mt-2",
          tone === "profit"
            ? "text-profit"
            : tone === "loss"
              ? "text-loss"
              : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DistributionMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/50/50 p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
        {label}
      </div>
      <div
        className={cn(
          "text-lg font-semibold tabular-nums mt-1",
          tone === "profit"
            ? "text-profit"
            : tone === "loss"
              ? "text-loss"
              : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — By Instrument
// ---------------------------------------------------------------------------

function InstrumentBreakdown({
  items,
  onSelectSymbol,
}: {
  items: any[];
  onSelectSymbol: (symbol: string) => void;
}) {
  if (items.length === 0) {
    return <NoDataState message="No instrument data recorded yet. Log trades to see instrument rankings and edge." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading>Avg R by Instrument</SectionHeading>
        <div className="mt-4">
          <GroupBarChart
            data={items.map((s) => ({
              label: s.label,
              value: dToNumber(s.avgR),
              count: s.trades,
            }))}
            valueLabel="Avg R"
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <SectionHeading>Instrument Performance Rankings</SectionHeading>
          <span className="text-[10px] uppercase font-mono text-muted-foreground">Click row to filter trades</span>
        </div>
        <div className="overflow-x-auto mt-4 -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
                <th className="px-3 py-2 text-left">Instrument</th>
                <th className="px-3 py-2 text-right">Trades</th>
                <th className="px-3 py-2 text-right">Wins</th>
                <th className="px-3 py-2 text-right">Win Rate</th>
                <th className="px-3 py-2 text-right">Avg R</th>
                <th className="px-3 py-2 text-right">Expectancy</th>
                <th className="px-3 py-2 text-right">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => {
                const avgR = s.avgR ? dToNumber(s.avgR) : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => onSelectSymbol(s.key)}
                    className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3 font-semibold text-foreground">{s.label}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">{s.trades}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">{s.wins}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">
                      {s.winRate ? formatPct(s.winRate) : "N/A"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right font-mono font-medium",
                        avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                      )}
                    >
                      {formatR(s.avgR)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">
                      {formatR(s.expectancyR)}
                      {s.expectancyCents != null ? ` (${formatSignedCents(s.expectancyCents).text})` : ""}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right font-mono font-semibold",
                        s.pnlCents > 0 ? "text-profit" : s.pnlCents < 0 ? "text-loss" : "text-foreground",
                      )}
                    >
                      {formatSignedCents(s.pnlCents).text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — By Setup & Strategy
// ---------------------------------------------------------------------------

function SetupBreakdown({
  items,
  onSelectStrategy,
}: {
  items: any[];
  onSelectStrategy: (strategyId: string) => void;
}) {
  if (items.length === 0) {
    return <NoDataState message="No setups recorded yet. Tag your trades with a setup to see breakdowns here." />;
  }
  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading>Avg R by Setup</SectionHeading>
        <div className="mt-4">
          <GroupBarChart
            data={items.map((s) => ({
              label: s.label,
              value: dToNumber(s.avgR),
              count: s.trades,
            }))}
            valueLabel="Avg R"
          />
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <SectionHeading>Setup Performance &amp; Expectancy</SectionHeading>
          <span className="text-[10px] uppercase font-mono text-muted-foreground">Click row to filter trades</span>
        </div>
        <div className="overflow-x-auto mt-4 -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
                <th className="px-3 py-2 text-left">Setup</th>
                <th className="px-3 py-2 text-right">Trades</th>
                <th className="px-3 py-2 text-right">Wins</th>
                <th className="px-3 py-2 text-right">Win Rate</th>
                <th className="px-3 py-2 text-right">Avg R</th>
                <th className="px-3 py-2 text-right">Expectancy</th>
                <th className="px-3 py-2 text-right">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => {
                const avgR = s.avgR ? dToNumber(s.avgR) : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => onSelectStrategy(s.key)}
                    className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3 font-medium text-foreground">{s.label}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">{s.trades}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">{s.wins}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">
                      {s.winRate ? formatPct(s.winRate) : "N/A"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right font-mono font-medium",
                        avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                      )}
                    >
                      {formatR(s.avgR)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">
                      {formatR(s.expectancyR)}
                      {s.expectancyCents != null ? ` (${formatSignedCents(s.expectancyCents).text})` : ""}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right font-mono font-medium",
                        s.pnlCents > 0 ? "text-profit" : s.pnlCents < 0 ? "text-loss" : "text-foreground",
                      )}
                    >
                      {formatSignedCents(s.pnlCents).text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Checklist Adherence
// ---------------------------------------------------------------------------

interface ChecklistAdherenceData {
  overallAdherencePct: number | null;
  totalTrades: number;
  totalEvaluatedTrades: number;
  totalMissingDataTrades: number;
  totalCompletedRequiredItems: number;
  totalApplicableRequiredItems: number;
  strategies: Array<{
    strategyId: string;
    strategyName: string;
    totalTrades: number;
    evaluatedTrades: number;
    missingDataTrades: number;
    completedRequiredItems: number;
    totalRequiredItems: number;
    adherencePct: number | null;
    winRate: number | null;
    wins: number;
    losses: number;
    breakevens: number;
    netPnlCents: number;
    avgR: string | null;
    versions: Array<{
      versionId: string;
      versionLabel: string;
      evaluatedTrades: number;
      totalTrades: number;
      missingDataTrades: number;
      completedRequiredItems: number;
      totalRequiredItems: number;
      adherencePct: number | null;
      winRate: number | null;
    }>;
  }>;
}

function ChecklistAdherence({ data }: { data: any }) {
  const summary = (data as ChecklistAdherenceData) || { strategies: [] };
  const strategies = summary.strategies ?? [];

  if (strategies.length === 0) {
    return (
      <NoDataState message="No checklist adherence data recorded yet. Tag your trades with strategies and checklists to measure execution discipline." />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <DistributionMetric
          label="Overall Discipline"
          value={summary.overallAdherencePct != null ? `${summary.overallAdherencePct}%` : "Insufficient data"}
          tone={summary.overallAdherencePct != null && summary.overallAdherencePct >= 70 ? "profit" : summary.overallAdherencePct != null && summary.overallAdherencePct >= 50 ? "neutral" : "loss"}
        />
        <DistributionMetric
          label="Evaluated Trades"
          value={`${summary.totalEvaluatedTrades ?? 0} of ${summary.totalTrades ?? 0}`}
        />
        <DistributionMetric
          label="Required Rules Followed"
          value={`${summary.totalCompletedRequiredItems ?? 0} / ${summary.totalApplicableRequiredItems ?? 0}`}
          tone="profit"
        />
        <DistributionMetric
          label="Missing Checklist Data"
          value={String(summary.totalMissingDataTrades ?? 0)}
          tone={summary.totalMissingDataTrades > 0 ? "loss" : "neutral"}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <SectionHeading>Checklist Adherence by Strategy</SectionHeading>
          <span className="text-[10px] uppercase font-mono text-muted-foreground">Strict Rule Discipline</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Adherence is calculated strictly from actual checklist answers against applicable required strategy rules:{" "}
          <span className="font-mono text-foreground font-semibold">Completed Required / Total Applicable Required × 100</span>. Strategy win rate is shown independently and is never used as a discipline proxy.
        </p>

        <div className="space-y-4 mt-5">
          {strategies.map((s) => {
            const hasData = s.adherencePct != null && s.evaluatedTrades > 0;
            const adherence = s.adherencePct ?? 0;
            const winRatePct = s.winRate != null ? Math.round(s.winRate * 100) : null;

            return (
              <div key={s.strategyId} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-foreground truncate">
                        {s.strategyName}
                      </span>
                      {s.missingDataTrades > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="h-3 w-3" /> {s.missingDataTrades} trade{s.missingDataTrades === 1 ? "" : "s"} missing checklist
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{s.evaluatedTrades} evaluated trade{s.evaluatedTrades === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{s.completedRequiredItems} of {s.totalRequiredItems} required items completed</span>
                      <span>·</span>
                      <span className="font-medium text-foreground">
                        Strategy Win Rate: {winRatePct != null ? `${winRatePct}%` : "N/A"} (Independent)
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {hasData ? (
                      <>
                        <div
                          className={cn(
                            "text-2xl font-bold tabular-nums font-mono",
                            adherence >= 70 ? "text-profit" : adherence >= 50 ? "text-warning" : "text-loss",
                          )}
                        >
                          {adherence}%
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                          Checklist Adherence
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground italic bg-muted/40 px-3 py-1.5 rounded-md border border-border">
                        Insufficient checklist data
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {hasData && (
                  <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        adherence >= 70 ? "bg-emerald-500" : adherence >= 50 ? "bg-amber-500" : "bg-red-500",
                      )}
                      style={{ width: `${Math.min(100, adherence)}%` }}
                    />
                  </div>
                )}

                {/* Strategy Version Breakdown (if multiple versions) */}
                {s.versions && s.versions.length > 1 && (
                  <div className="pt-2 border-t border-border/60">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Version Cohort Breakdown
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {s.versions.map((v) => (
                        <div key={v.versionId} className="p-2.5 rounded-lg border border-border/70 bg-muted/30 text-xs">
                          <div className="flex items-center justify-between font-medium">
                            <span>Version {v.versionLabel}</span>
                            <span className={cn(
                              "font-mono font-bold",
                              v.adherencePct != null && v.adherencePct >= 70 ? "text-profit" : v.adherencePct != null && v.adherencePct >= 50 ? "text-warning" : "text-loss"
                            )}>
                              {v.adherencePct != null ? `${v.adherencePct}%` : "No data"}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {v.evaluatedTrades} trades · {v.completedRequiredItems}/{v.totalRequiredItems} req items
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5 — Rule Violations
// ---------------------------------------------------------------------------

function RuleViolations({
  items,
  totalTrades,
  onSelectRule,
}: {
  items: any[];
  totalTrades: number;
  onSelectRule: (ruleKey: string) => void;
}) {
  if (items.length === 0) {
    return (
      <NoDataState
        message="No rule violations detected. Trades tagged with behavior flags will appear here."
        icon={CheckCircle2}
        tone="positive"
      />
    );
  }

  const sorted = [...items].sort((a, b) => (b.trades ?? b.occurrences ?? 0) - (a.trades ?? a.occurrences ?? 0));
  const maxCount = Math.max(...sorted.map((s) => s.trades ?? s.occurrences ?? 0), 1);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <SectionHeading>Behavior Flag Association &amp; Historical Performance</SectionHeading>
          <span className="text-[10px] uppercase font-mono text-muted-foreground">Click card to inspect trades</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Historical performance of trades associated with recorded behavior flags. Shows correlation and frequency across recorded trades without implying unverified causation.
        </p>

        <div className="space-y-3 mt-4">
          {sorted.map((s, i) => {
            const avgR = s.avgR ? dToNumber(s.avgR) : 0;
            const netPnl = s.netPnlCents ?? s.pnlCents ?? 0;
            const pctOfTrades = s.percentageOfTrades ?? (totalTrades > 0 ? Math.round(((s.trades ?? 0) / totalTrades) * 1000) / 10 : 0);

            return (
              <div
                key={i}
                onClick={() => onSelectRule(s.key)}
                className="rounded-lg border border-border p-4 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-loss">
                      <XCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {s.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-foreground">{s.trades} trades affected ({pctOfTrades}% of journal)</span>
                        <span>·</span>
                        <span className="font-mono">Win Rate: {formatPct(s.winRate)}</span>
                        <span>·</span>
                        <span className={cn("font-mono font-medium", avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground")}>
                          Avg R: {formatR(s.avgR)}
                        </span>
                        <span>·</span>
                        <span className={cn("font-mono font-semibold", netPnl >= 0 ? "text-profit" : "text-loss")}>
                          Net P&amp;L: {formatSignedCents(netPnl).text}
                        </span>
                        {s.expectancyR && (
                          <>
                            <span>·</span>
                            <span className="font-mono">Expectancy: {formatR(s.expectancyR)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                      Occurrences
                    </div>
                    <div className="text-lg font-bold tabular-nums text-foreground font-mono">
                      {s.occurrences ?? s.trades}
                    </div>
                  </div>
                </div>
                {/* Bar */}
                <div className="mt-3 h-1.5 w-full rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400"
                    style={{ width: `${((s.trades ?? 0) / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5 — Sessions & Weekdays
// ---------------------------------------------------------------------------

function SessionsWeekdays({
  sessionItems,
  weekday,
  hour,
  entryHour,
  realizationHour,
  onSelectSession,
}: {
  sessionItems: any[];
  weekday: any[];
  hour: any[];
  entryHour?: any[];
  realizationHour?: any[];
  onSelectSession?: (session: string) => void;
}) {
  const [hourMode, setHourMode] = useState<"entry" | "realization">("entry");
  const activeHourData = (hourMode === "entry" ? (entryHour || hour) : (realizationHour || hour)) ?? [];
  const hasSession = sessionItems.length > 0;
  const hasWeekday = weekday.length > 0;
  const hasHour = activeHourData.length > 0;

  if (!hasSession && !hasWeekday && !hasHour) {
    return <NoDataState message="No session or weekday data yet. Trades with an entry time and session will populate this view." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeading icon={Clock}>By Session</SectionHeading>
          {hasSession ? (
            <div className="mt-4 space-y-2">
              <GroupBarChart
                data={sessionItems.map((s) => ({
                  label: s.label,
                  value: dToNumber(s.avgR),
                  count: s.trades,
                }))}
                valueLabel="Avg R"
              />
              <SessionsTable items={sessionItems} onSelectSession={onSelectSession} />
            </div>
          ) : (
            <EmptyChart />
          )}
        </Card>

        <Card>
          <SectionHeading icon={Calendar}>By Weekday</SectionHeading>
          {hasWeekday ? (
            <div className="mt-4 space-y-2">
              <GroupBarChart
                data={weekday.map((w) => ({
                  label: w.label,
                  value: dToNumber(w.items?.avgR),
                  count: w.items?.totalTrades ?? 0,
                }))}
                valueLabel="Avg R"
              />
              <WeekdayTable items={weekday} />
            </div>
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <SectionHeading icon={Clock}>By Hour (User Timezone)</SectionHeading>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hourMode === "entry"
                ? "Performance grouped by setup entry hour (evaluating entry execution timing edge)."
                : "Realized P&L grouped by position exit hour (evaluating cash realization timing)."}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border text-xs shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setHourMode("entry")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer",
                hourMode === "entry"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Entry Hour (Edge)
            </button>
            <button
              onClick={() => setHourMode("realization")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer",
                hourMode === "realization"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Exit Hour (Realization)
            </button>
          </div>
        </div>

        {hasHour ? (
          <div className="mt-4 space-y-2">
            <GroupBarChart
              data={activeHourData.map((h: any) => ({
                label: h.label,
                value: dToNumber(h.items?.avgR),
                count: h.items?.totalTrades ?? 0,
              }))}
              valueLabel="Avg R"
            />
            <HourTable items={activeHourData} />
          </div>
        ) : (
          <EmptyChart />
        )}
      </Card>
    </div>
  );
}

function SessionsTable({
  items,
  onSelectSession,
}: {
  items: any[];
  onSelectSession?: (session: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
            <th className="px-3 py-2 text-left">Session</th>
            <th className="px-3 py-2 text-right">Trades</th>
            <th className="px-3 py-2 text-right">Win Rate</th>
            <th className="px-3 py-2 text-right">Avg R</th>
            <th className="px-3 py-2 text-right">Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, i) => {
            const avgR = s.avgR ? dToNumber(s.avgR) : 0;
            return (
              <tr
                key={i}
                onClick={() => onSelectSession?.(s.key)}
                className={cn(
                  "border-b border-border last:border-0",
                  onSelectSession && "hover:bg-muted/40 cursor-pointer transition-colors"
                )}
              >
                <td className="px-3 py-2 font-medium text-foreground">{s.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{s.trades}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {s.winRate ? formatPct(s.winRate) : "N/A"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatR(s.avgR)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    s.pnlCents > 0 ? "text-profit" : s.pnlCents < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatSignedCents(s.pnlCents).text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WeekdayTable({ items }: { items: any[] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
            <th className="px-3 py-2 text-left">Day</th>
            <th className="px-3 py-2 text-right">Trades</th>
            <th className="px-3 py-2 text-right">Win Rate</th>
            <th className="px-3 py-2 text-right">Avg R</th>
            <th className="px-3 py-2 text-right">Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {items.map((w, i) => {
            const m = w.items ?? {};
            const avgR = m.avgR ? dToNumber(m.avgR) : 0;
            const netPnl = w.netPnlCents ?? w.pnlCents ?? m.netPnlCents ?? m.pnlCents ?? 0;
            return (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground">{w.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{m.totalTrades ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {m.winRate ? formatPct(m.winRate) : "N/A"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatR(m.avgR)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    netPnl > 0 ? "text-profit" : netPnl < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatSignedCents(netPnl).text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HourTable({ items }: { items: any[] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
            <th className="px-3 py-2 text-left">Hour</th>
            <th className="px-3 py-2 text-right">Trades</th>
            <th className="px-3 py-2 text-right">Win Rate</th>
            <th className="px-3 py-2 text-right">Avg R</th>
            <th className="px-3 py-2 text-right">Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h, i) => {
            const m = h.items ?? {};
            const avgR = m.avgR ? dToNumber(m.avgR) : 0;
            const netPnl = h.netPnlCents ?? h.pnlCents ?? m.netPnlCents ?? m.pnlCents ?? 0;
            return (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground tabular-nums">{h.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{m.totalTrades ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {m.winRate ? formatPct(m.winRate) : "N/A"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatR(m.avgR)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    netPnl > 0 ? "text-profit" : netPnl < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatSignedCents(netPnl).text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational primitives (slate/white aesthetic)
// ---------------------------------------------------------------------------

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground/70" />}
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        {children}
      </h2>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground/70 border border-dashed border-border rounded-md">
      No data.
    </div>
  );
}

function NoDataState({
  message,
  icon: Icon = BarChart3,
  tone = "neutral",
}: {
  message: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "positive";
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-12 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center mb-4",
            tone === "positive"
              ? "bg-emerald-50 border border-emerald-200"
              : "bg-background border border-border",
          )}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              tone === "positive" ? "text-profit" : "text-muted-foreground/70",
            )}
          />
        </div>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
