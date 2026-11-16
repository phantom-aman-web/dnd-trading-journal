"use client";

/**
 * DnD — Dashboard view (rebuild)
 *
 * Reference design: ae-tradingjournal.vercel.app aesthetic — light
 * `bg-background` background, white `rounded-xl border border-border`
 * cards with `shadow-sm`, navy accent (`#1e2330` ≈ theme `--primary`),
 * slate-900 headings, slate-500 muted text, slate-600 body, profit
 * green / loss red, `tabular-nums` for numbers.
 *
 * The dashboard surfaces two focused sections:
 *   1. PROCESS & ADHERENCE BREAKDOWN — setup adherence metrics
 *      (total trades, adherence rate, rule violations, top violated rules)
 *   2. RECENT TRADES ACTIVITY — a compact list of recent trades
 *      (date, symbol, direction, setup, P&L, adherence)
 *
 * The GettingStartedCard was intentionally removed in a prior task
 * (ref-site-alignment) and is NOT rendered here.
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/common/metric-card";
import { EquityCurveChart } from "@/components/charts/equity-curve-chart";
import { DailyPnlChart } from "@/components/charts/daily-pnl-chart";
import { RDistributionChart } from "@/components/charts/r-distribution-chart";
import { useDashboardLayout } from "@/lib/dashboard-layout-store";
import { CustomizeDashboardDialog } from "@/components/dashboard/customize-dashboard-dialog";
import { FavoriteTradesWidget } from "@/components/dashboard/favorite-trades-widget";
import { useNav } from "@/lib/nav-store";
import { formatSignedCents, formatR, formatPct } from "@/lib/money";
import { PrivacyMask } from "@/components/common/privacy-mask";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Compass,
  Layers,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "thisQuarter", label: "This Quarter" },
  { key: "thisYear", label: "This Year" },
  { key: "all", label: "All Time" },
] as const;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

interface GroupBreakdownItem {
  key: string;
  label: string;
  trades: number;
  wins: number;
  winRate: number | null;
  avgR: string | null;
  expectancyR: string | null;
  pnlCents: number;
}

interface LongVsShortMetrics {
  trades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: string | null;
  avgR: string | null;
  profitFactor: string | null;
  expectancyR: string | null;
  pnlCents: number;
}

interface PeriodComparison {
  prevNetPnlCents: number;
  pnlChangeCents: number;
  prevWinRate: string | null;
  winRateDelta: string | null;
  prevTrades: number;
  tradesDelta: number;
}

interface DashboardResponse {
  preset: string;
  aggregate: {
    totalTrades: number;
    closedTrades: number;
    wins: number;
    losses: number;
    breakevens: number;
    netPnlCents: number;
    avgR?: string | null;
    winRate?: string | null;
    profitFactor?: string | null;
    expectancyR?: string | null;
    avgWinCents?: number | null;
    avgLossCents?: number | null;
  };
  comparison?: PeriodComparison | null;
  longVsShort?: {
    long: LongVsShortMetrics;
    short: LongVsShortMetrics;
  } | null;
  byInstrument?: GroupBreakdownItem[];
  bySession?: GroupBreakdownItem[];
  byStrategy?: GroupBreakdownItem[];
  byBehavior: Array<{
    key: string;
    label: string;
    trades: number;
    avgR: string | null;
    pnlCents: number;
    winRate: number | null;
  }>;
  equityCurve?: Array<{ date: string; label: string; cumulativeCents: number; pnlCents: number }>;
  dailyPnl?: Array<{ date: string; label: string; pnlCents: number; tradeCount: number }>;
  rDistribution?: Array<{ bucket: string; count: number }>;
  startingBalanceCents?: number;
  range: { from: string; to: string } | null;
  totalTrades: number;
}

interface TradeRow {
  id: string;
  instrumentSymbol: string;
  direction: "long" | "short";
  status: string;
  setupGrade: string | null;
  netPnlCents: number;
  actualR: string | null;
  entryTime: string | null;
  behaviorFlagsJson: string | null;
  strategy: { id: string; name: string } | null;
}

interface TradesResponse {
  items: TradeRow[];
}

async function fetchDashboard(preset: string, accountId?: string): Promise<DashboardResponse> {
  const params = new URLSearchParams({ preset });
  if (accountId) params.set("accountId", accountId);
  const res = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

async function fetchRecentTrades(accountId?: string): Promise<TradesResponse> {
  const params = new URLSearchParams({ limit: "10", sortBy: "entryTime", sortDir: "desc" });
  if (accountId) params.set("accountId", accountId);
  const res = await fetch(`/api/trades?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load trades");
  return res.json();
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function safeParseArr(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Per-trade adherence: 100% when no behavior flags are recorded, else 0%. */
function tradeAdherencePct(trade: TradeRow): number {
  return safeParseArr(trade.behaviorFlagsJson).length === 0 ? 100 : 0;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardView() {
  const [preset, setPreset] = useState<string>("thisMonth");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { navigate, params, selectedAccountId } = useNav();
  const accountId = selectedAccountId || params.accountId || undefined;

  const widgets = useDashboardLayout((state) => state.widgets);
  const sortedWidgets = useMemo(() => {
    return [...widgets].sort((a, b) => a.order - b.order);
  }, [widgets]);

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard", preset, accountId],
    queryFn: () => fetchDashboard(preset, accountId),
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.items ?? [];
    },
  });

  const accountName = useMemo(() => {
    if (!accountId || accountId === "all") return "All Accounts";
    const list = Array.isArray(accountsData) ? accountsData : [];
    return list.find((a: any) => a.id === accountId)?.name ?? "Account";
  }, [accountId, accountsData]);

  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ["dashboard-recent-trades", accountId],
    queryFn: () => fetchRecentTrades(accountId),
  });

  const recentTrades: TradeRow[] = Array.isArray(tradesData) ? tradesData : (tradesData?.items ?? []);

  // Adherence breakdown derived from BOTH the dashboard's period-correct
  // aggregate + byBehavior (rule violations + top violated rules) AND the
  // recent-trades snapshot (recent adherence rate).
  const breakdown = useMemo(() => {
    const totalTrades = dash?.aggregate.totalTrades ?? 0;
    const byBehavior = dash?.byBehavior ?? [];

    // Total violation instances (a trade with 2 flags counts as 2).
    const totalViolations = byBehavior.reduce((s, b) => s + (b.trades ?? 0), 0);

    // Top 3 violated rules sorted by trade count, then P&L impact.
    const topViolated = [...byBehavior]
      .sort((a, b) => b.trades - a.trades || Math.abs(b.pnlCents) - Math.abs(a.pnlCents))
      .slice(0, 3);

    // Recent-trades adherence snapshot — fraction of the recent 10 trades
    // that have zero behavior flags. Reported as a percentage.
    const recentCount = recentTrades.length;
    const recentCompliant = recentTrades.filter(
      (t) => safeParseArr(t.behaviorFlagsJson).length === 0,
    ).length;
    const recentAdherenceRate =
      recentCount > 0 ? Math.round((recentCompliant / recentCount) * 100) : null;

    return { totalTrades, totalViolations, topViolated, recentAdherenceRate, recentCount };
  }, [dash, recentTrades]);

  const isLoading = dashLoading || tradesLoading;
  const hasNoData = !isLoading && breakdown.totalTrades === 0 && recentTrades.length === 0;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (hasNoData) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <DashboardHeader
          preset={preset}
          setPreset={setPreset}
          comparison={dash?.comparison}
          onOpenCustomize={() => setCustomizeOpen(true)}
        />
        <EmptyDashboard onLogTrade={() => navigate("tradeNew")} />
        <CustomizeDashboardDialog open={customizeOpen} onOpenChange={setCustomizeOpen} />
      </div>
    );
  }

  const renderWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case "metrics_summary": {
        if (!dash?.aggregate) return null;
        const pnl = dash.aggregate.netPnlCents ?? 0;
        const pf = dash.aggregate.profitFactor ? Number(dash.aggregate.profitFactor) : null;
        const expectancy = dash.aggregate.expectancyR ? Number(dash.aggregate.expectancyR) : null;

        return (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle
                icon={TrendingUp}
                title="PERFORMANCE OVERVIEW"
                subtitle="Primary KPI hierarchy and secondary performance metrics for this period."
              />
              <button
                type="button"
                onClick={() =>
                  navigate("analytics", {
                    preset,
                    ...(accountId ? { accountId } : {}),
                  })
                }
                className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                Detailed Analytics
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Primary 5-Metric KPI Strip (Net P&L, Win Rate, Profit Factor, Trade Count, Avg R) */}
            <div className="grid grid-cols-1 @[380px]:grid-cols-2 @[560px]:grid-cols-3 @[850px]:grid-cols-5 gap-3">
              <MetricCard
                label="Net P&L"
                value={formatSignedCents(pnl).text}
                tone={pnl > 0 ? "profit" : pnl < 0 ? "loss" : "neutral"}
                icon={Activity}
                sub={
                  dash.comparison
                    ? `vs prev: ${formatSignedCents(dash.comparison.pnlChangeCents).text}`
                    : `${dash.aggregate.wins}W · ${dash.aggregate.losses}L`
                }
                className="col-span-1 @[380px]:col-span-2 @[560px]:col-span-1 border-primary/20 bg-card shadow-xs"
              />
              <MetricCard
                label="Win Rate"
                value={dash.aggregate.winRate ? formatPct(dash.aggregate.winRate) : "N/A"}
                tone="neutral"
                icon={Target}
                sub={`${dash.aggregate.wins} wins / ${dash.aggregate.closedTrades} closed`}
              />
              <MetricCard
                label="Profit Factor"
                value={pf != null ? pf.toFixed(2) : "N/A"}
                tone={pf != null && pf >= 1 ? "profit" : pf != null ? "loss" : "neutral"}
                icon={Activity}
                sub="Gross Win / Loss Ratio"
              />
              <MetricCard
                label="Trade Count"
                value={String(dash.aggregate.totalTrades ?? 0)}
                tone="neutral"
                icon={ClipboardList}
                sub={`${dash.aggregate.closedTrades} closed trades`}
              />
              <MetricCard
                label="Avg R"
                value={formatR(dash.aggregate.avgR)}
                tone={dash.aggregate.avgR && Number(dash.aggregate.avgR) > 0 ? "profit" : dash.aggregate.avgR && Number(dash.aggregate.avgR) < 0 ? "loss" : "neutral"}
                icon={TrendingUp}
                sub="Per Closed Execution"
              />
            </div>

            {/* Compact Secondary Metrics Strip */}
            <div className="grid grid-cols-2 @[600px]:grid-cols-4 gap-2.5 p-3 rounded-xl border border-border/70 bg-muted/20">
              <div className="flex flex-col gap-0.5 px-2">
                <span className="text-[11px] font-medium text-muted-foreground">Expectancy</span>
                <span className="text-sm font-semibold tnum text-foreground">
                  {formatR(dash.aggregate.expectancyR)}
                </span>
                <span className="text-[10px] text-muted-foreground/70">Expected R / trade</span>
              </div>
              <div className="flex flex-col gap-0.5 px-2 border-l border-border/50">
                <span className="text-[11px] font-medium text-muted-foreground">Avg Win</span>
                <span className="text-sm font-semibold tnum text-profit">
                  {dash.aggregate.avgWinCents != null ? formatSignedCents(dash.aggregate.avgWinCents).text : "N/A"}
                </span>
                <span className="text-[10px] text-muted-foreground/70">Winning executions</span>
              </div>
              <div className="flex flex-col gap-0.5 px-2 border-l border-border/50">
                <span className="text-[11px] font-medium text-muted-foreground">Avg Loss</span>
                <span className="text-sm font-semibold tnum text-loss">
                  {dash.aggregate.avgLossCents != null ? formatSignedCents(dash.aggregate.avgLossCents).text : "N/A"}
                </span>
                <span className="text-[10px] text-muted-foreground/70">Losing executions</span>
              </div>
              <div className="flex flex-col gap-0.5 px-2 border-l border-border/50">
                <span className="text-[11px] font-medium text-muted-foreground">Breakevens</span>
                <span className="text-sm font-semibold tnum text-foreground">
                  {dash.aggregate.breakevens ?? 0}
                </span>
                <span className="text-[10px] text-muted-foreground/70">0R executions</span>
              </div>
            </div>
          </section>
        );
      }

      case "equity_curve": {
        const data = dash?.equityCurve ?? [];
        return (
          <Card className="bg-card border border-border rounded-xl shadow-sm p-4 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground/70" />
                  <h3 className="text-sm font-semibold text-foreground">Equity Curve</h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate("analytics", {
                      tab: "growth",
                      preset,
                      ...(accountId ? { accountId } : {}),
                    })
                  }
                  className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  Analytics <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              {data.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No equity curve data for this period</div>
              ) : (
                <EquityCurveChart data={data} startingBalanceCents={dash?.startingBalanceCents ?? 0} />
              )}
            </div>
          </Card>
        );
      }

      case "daily_pnl": {
        const data = dash?.dailyPnl ?? [];
        return (
          <Card className="bg-card border border-border rounded-xl shadow-sm p-4 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground/70" />
                  <h3 className="text-sm font-semibold text-foreground">Daily P&L</h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate("analytics", {
                      tab: "performance",
                      preset,
                      ...(accountId ? { accountId } : {}),
                    })
                  }
                  className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  Analytics <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              {data.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No daily P&L data for this period</div>
              ) : (
                <DailyPnlChart data={data} />
              )}
            </div>
          </Card>
        );
      }

      case "r_distribution": {
        const data = dash?.rDistribution ?? [];
        return (
          <Card className="bg-card border border-border rounded-xl shadow-sm p-4 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground/70" />
                  <h3 className="text-sm font-semibold text-foreground">R Distribution</h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate("analytics", {
                      tab: "risk",
                      preset,
                      ...(accountId ? { accountId } : {}),
                    })
                  }
                  className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  Analytics <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              {data.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No R distribution data for this period</div>
              ) : (
                <RDistributionChart data={data} />
              )}
            </div>
          </Card>
        );
      }

      case "process_adherence": {
        return (
          <section className="space-y-3">
            <SectionTitle
              icon={ShieldCheck}
              title="PROCESS & ADHERENCE BREAKDOWN"
              subtitle="How well are you following your trading checklist?"
            />
            <div className="grid grid-cols-1 @[380px]:grid-cols-2 @[750px]:grid-cols-4 gap-3">
              <MetricTile
                label="Total Trades"
                value={String(breakdown.totalTrades)}
                sub={dash?.aggregate ? `${dash.aggregate.wins}W · ${dash.aggregate.losses}L` : undefined}
                icon={ClipboardList}
              />
              <MetricTile
                label="Adherence Rate"
                value={
                  breakdown.recentAdherenceRate != null
                    ? `${breakdown.recentAdherenceRate}%`
                    : "—"
                }
                sub={
                  breakdown.recentCount > 0
                    ? `last ${breakdown.recentCount} trades`
                    : undefined
                }
                icon={CheckCircle2}
                tone={
                  breakdown.recentAdherenceRate == null
                    ? "neutral"
                    : breakdown.recentAdherenceRate >= 80
                      ? "profit"
                      : breakdown.recentAdherenceRate < 50
                        ? "loss"
                        : "neutral"
                }
              />
              <MetricTile
                label="Rule Violations"
                value={String(breakdown.totalViolations)}
                sub={
                  breakdown.totalViolations > 0
                    ? `${dash?.byBehavior?.length ?? 0} distinct rule${(dash?.byBehavior?.length ?? 0) === 1 ? "" : "s"}`
                    : "no violations"
                }
                icon={AlertTriangle}
                tone={breakdown.totalViolations > 0 ? "loss" : "profit"}
              />
              <MetricTile
                label="Net P&L"
                value={formatSignedCents(dash?.aggregate.netPnlCents ?? 0).text}
                sub={
                  dash?.comparison
                    ? `vs prev: ${formatSignedCents(dash.comparison.pnlChangeCents).text}`
                    : dash?.aggregate
                      ? `${dash.aggregate.closedTrades} closed`
                      : undefined
                }
                icon={Activity}
                tone={
                  (dash?.aggregate.netPnlCents ?? 0) > 0
                    ? "profit"
                    : (dash?.aggregate.netPnlCents ?? 0) < 0
                      ? "loss"
                      : "neutral"
                }
              />
            </div>

            {/* Top violated rules */}
            <Card className="bg-card border border-border rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Top Violated Rules</h3>
                <Badge
                  variant="outline"
                  className="bg-muted/50 text-muted-foreground border-border text-[10px] uppercase tracking-wide"
                >
                  {breakdown.topViolated.length} rule{breakdown.topViolated.length === 1 ? "" : "s"}
                </Badge>
              </div>
              {breakdown.topViolated.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-profit" />
                  No rule violations in this period — clean execution.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {breakdown.topViolated.map((rule) => {
                    const pnl = formatSignedCents(rule.pnlCents);
                    return (
                      <li
                        key={rule.key}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {rule.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 tnum">
                            {rule.trades} trade{rule.trades === 1 ? "" : "s"} affected
                            {rule.winRate != null
                              ? ` · ${Math.round(rule.winRate * 100)}% win rate`
                              : ""}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "text-sm font-semibold tnum shrink-0",
                            pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground",
                          )}
                        >
                          {pnl.text}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        );
      }

      case "long_vs_short": {
        if (!dash || dash.totalTrades === 0) return null;
        return (
          <StrategicBreakdown
            byInstrument={dash.byInstrument}
            byStrategy={dash.byStrategy}
            bySession={dash.bySession}
            longVsShort={dash.longVsShort}
            onSelectSymbol={(sym) => navigate("tradesLog", { symbol: sym })}
            onSelectStrategy={(stratId) => navigate("tradesLog", { strategyId: stratId })}
            onSelectDirection={(dir) => navigate("tradesLog", { direction: dir })}
          />
        );
      }

      case "favorite_trades": {
        return <FavoriteTradesWidget />;
      }

      case "recent_trades": {
        return (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <SectionTitle
                icon={Activity}
                title="RECENT TRADES ACTIVITY"
                subtitle="Your latest 10 logged trades."
                as="div"
              />
              <Button
                variant="outline"
                size="sm"
                className="bg-card border-border text-foreground hover:bg-muted/50 h-8"
                onClick={() => navigate("tradesLog")}
              >
                View all
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Card className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-0">
              {recentTrades.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No trades logged yet.</p>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => navigate("tradeNew")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Log Trade
                  </Button>
                </div>
              ) : (
                <>
                  {/* Desktop / tablet table */}
                  <div className="hidden @[550px]:block overflow-x-auto min-w-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <Th className="text-left">Date</Th>
                          <Th className="text-left">Symbol</Th>
                          <Th className="text-left">Dir</Th>
                          <Th className="text-left">Setup</Th>
                          <Th className="text-right">P&amp;L</Th>
                          <Th className="text-right">Adherence</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTrades.map((t) => (
                          <TradeRowDesktop key={t.id} trade={t} onOpen={() => navigate("tradeDetail", { id: t.id })} />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card list */}
                  <ul className="@[550px]:hidden divide-y divide-border">
                    {recentTrades.map((t) => (
                      <TradeRowMobile key={t.id} trade={t} onOpen={() => navigate("tradeDetail", { id: t.id })} />
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <DashboardHeader
        preset={preset}
        setPreset={setPreset}
        comparison={dash?.comparison}
        onOpenCustomize={() => setCustomizeOpen(true)}
        accountName={accountName}
        onInspectTrades={() => navigate("tradesLog", accountId ? { accountId } : undefined)}
        onOpenAnalytics={() => navigate("analytics", { preset, ...(accountId ? { accountId } : {}) })}
      />

      <div className="grid grid-cols-1 @[750px]:grid-cols-2 gap-4">
        {sortedWidgets
          .filter((w) => w.visible)
          .map((widget) => {
            const content = renderWidgetContent(widget.id);
            if (!content) return null;
            const isFull = widget.size === "full";
            return (
              <div
                key={widget.id}
                className={cn(
                  "transition-all duration-200",
                  isFull ? "@[750px]:col-span-2" : "@[750px]:col-span-1"
                )}
              >
                {content}
              </div>
            );
          })}
      </div>

      <CustomizeDashboardDialog open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DashboardHeader({
  preset,
  setPreset,
  comparison,
  onOpenCustomize,
  accountName = "All Accounts",
  onInspectTrades,
  onOpenAnalytics,
}: {
  preset: string;
  setPreset: (p: string) => void;
  comparison?: PeriodComparison | null;
  onOpenCustomize?: () => void;
  accountName?: string;
  onInspectTrades?: () => void;
  onOpenAnalytics?: () => void;
}) {
  const currentPresetLabel = PRESETS.find((p) => p.key === preset)?.label ?? "This Month";

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            {comparison && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-mono font-medium tracking-tight",
                  comparison.pnlChangeCents > 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : comparison.pnlChangeCents < 0
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      : "bg-muted text-muted-foreground border-border",
                )}
              >
                vs prev: {formatSignedCents(comparison.pnlChangeCents).text}
                {comparison.winRateDelta ? ` (${comparison.winRateDelta.startsWith("-") ? "" : "+"}${comparison.winRateDelta} WR)` : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Track your adherence, edge, and market performance.</p>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-2">
          {onOpenCustomize && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCustomize}
              className="h-8 gap-1.5 text-xs bg-card border-border text-foreground hover:bg-muted/50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Customize</span>
            </Button>
          )}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const active = preset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPreset(p.key)}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                    active
                      ? "bg-slate-900 text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Explicit Scope Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-border/80 bg-muted/30 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">Active Scope:</span>
          <Badge variant="outline" className="font-medium bg-card text-foreground border-border text-[11px] py-0.5">
            {accountName}
          </Badge>
          <Badge variant="outline" className="font-medium bg-card text-foreground border-border text-[11px] py-0.5">
            {currentPresetLabel}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20 py-0.5">
            Closed Realized Trades
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {onOpenAnalytics && (
            <button
              type="button"
              onClick={onOpenAnalytics}
              className="text-primary hover:underline font-medium inline-flex items-center gap-1 transition-colors cursor-pointer text-xs"
            >
              Full Analytics <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
          {onInspectTrades && (
            <button
              type="button"
              onClick={onInspectTrades}
              className="text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1 transition-colors cursor-pointer text-xs"
            >
              Trades Log <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  as: Tag = "div",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  as?: "h2" | "div";
}) {
  return (
    <Tag className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground/70" />
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground/70">{subtitle}</div>}
      </div>
    </Tag>
  );
}

function MetricTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  isSensitive,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "profit" | "loss" | "neutral";
  isSensitive?: boolean;
}) {
  const sensitive = isSensitive ?? (/p&l|pnl|avg win|avg loss|balance|equity|drawdown/i.test(label));

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-muted-foreground/70",
            )}
          />
        )}
      </div>
      <div
        className={cn(
          "mt-1.5 text-xl font-semibold tnum",
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground",
        )}
      >
        {sensitive ? <PrivacyMask value={value} /> : value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground tnum mt-0.5">{sub}</div>}
    </Card>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function TradeRowDesktop({ trade, onOpen }: { trade: TradeRow; onOpen: () => void }) {
  const pnl = formatSignedCents(trade.netPnlCents);
  const adherence = tradeAdherencePct(trade);
  const setupName = trade.strategy?.name ?? "—";
  const isLong = trade.direction === "long";

  return (
    <tr
      onClick={onOpen}
      className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer"
    >
      <td className="px-4 py-2.5 text-muted-foreground tnum whitespace-nowrap">
        {formatDate(trade.entryTime)}
      </td>
      <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
        {trade.instrumentSymbol}
      </td>
      <td className="px-4 py-2.5">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wide",
            isLong
              ? "bg-emerald-50 text-profit border-emerald-200"
              : "bg-red-50 text-loss border-red-200",
          )}
        >
          {isLong ? "Long" : "Short"}
        </Badge>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground max-w-[180px] truncate">
        {trade.setupGrade && (
          <Badge
            variant="outline"
            className="mr-2 text-[10px] px-1.5 py-0 bg-muted/50 text-muted-foreground border-border"
          >
            {trade.setupGrade}
          </Badge>
        )}
        {setupName}
      </td>
      <td
        className={cn(
          "px-4 py-2.5 text-right font-semibold tnum whitespace-nowrap",
          pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground",
        )}
      >
        <PrivacyMask value={pnl.text} />
      </td>
      <td className="px-4 py-2.5 text-right tnum">
        <span
          className={cn(
            "text-xs font-semibold",
            adherence >= 100 ? "text-profit" : "text-loss",
          )}
        >
          {adherence}%
        </span>
      </td>
    </tr>
  );
}

function TradeRowMobile({ trade, onOpen }: { trade: TradeRow; onOpen: () => void }) {
  const pnl = formatSignedCents(trade.netPnlCents);
  const adherence = tradeAdherencePct(trade);
  const isLong = trade.direction === "long";
  const setupName = trade.strategy?.name ?? "—";

  return (
    <li onClick={onOpen} className="p-3 hover:bg-muted/50 active:bg-background cursor-pointer">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wide shrink-0",
              isLong
                ? "bg-emerald-50 text-profit border-emerald-200"
                : "bg-red-50 text-loss border-red-200",
            )}
          >
            {isLong ? "L" : "S"}
          </Badge>
          <div className="min-w-0">
            <div className="font-medium text-foreground text-sm truncate">{trade.instrumentSymbol}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {formatDate(trade.entryTime)} · {setupName}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={cn(
              "text-sm font-semibold tnum",
              pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground",
            )}
          >
            <PrivacyMask value={pnl.text} />
          </div>
          <div
            className={cn(
              "text-[10px] font-semibold tnum",
              adherence >= 100 ? "text-profit" : "text-loss",
            )}
          >
            {adherence}% adherent
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyDashboard({ onLogTrade }: { onLogTrade: () => void }) {
  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm">
      <div className="p-8 md:p-12 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-background flex items-center justify-center mb-4">
          <ClipboardList className="h-6 w-6 text-muted-foreground/70" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Your trading dashboard starts here.</h3>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
          Log your first trade to begin building your journal. Once you have data, your adherence
          metrics and recent activity will appear here.
        </p>
        <Button
          className="mt-5 bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={onLogTrade}
        >
          <Plus className="h-4 w-4" />
          Log Trade
        </Button>
      </div>
    </Card>
  );
}

/**
 * PERFORMANCE OVERVIEW — 8 MetricCards + 3 charts (Equity Curve, Daily P&L,
 * R Distribution). Renders only when aggregate data exists and the relevant
 * chart data arrays have length > 0; otherwise the whole section is skipped
 * to avoid empty chart placeholders.
 */
function PerformanceOverview({
  aggregate,
  equityCurve,
  dailyPnl,
  rDistribution,
  startingBalanceCents,
}: {
  aggregate: NonNullable<DashboardResponse["aggregate"]>;
  equityCurve: NonNullable<DashboardResponse["equityCurve"]>;
  dailyPnl: NonNullable<DashboardResponse["dailyPnl"]>;
  rDistribution: NonNullable<DashboardResponse["rDistribution"]>;
  startingBalanceCents: number;
}) {
  const pnl = aggregate.netPnlCents ?? 0;
  const pf = aggregate.profitFactor ? Number(aggregate.profitFactor) : null;
  const expectancy = aggregate.expectancyR ? Number(aggregate.expectancyR) : null;

  const hasEquity = (equityCurve?.length ?? 0) > 0;
  const hasDaily = (dailyPnl?.length ?? 0) > 0;
  const hasRDist = (rDistribution?.length ?? 0) > 0;
  if (!hasEquity && !hasDaily && !hasRDist) return null;

  return (
    <section className="space-y-3">
      <SectionTitle
        icon={TrendingUp}
        title="PERFORMANCE OVERVIEW"
        subtitle="Aggregate performance and key metrics for this period."
      />

      <div className="grid grid-cols-2 @[600px]:grid-cols-4 gap-3">
        <MetricCard
          label="Net P&L"
          value={formatSignedCents(pnl).text}
          tone={pnl > 0 ? "profit" : pnl < 0 ? "loss" : "neutral"}
          icon={Activity}
        />
        <MetricCard
          label="Win Rate"
          value={aggregate.winRate ? formatPct(aggregate.winRate) : "N/A"}
          tone="neutral"
          icon={Target}
        />
        <MetricCard
          label="Avg R"
          value={formatR(aggregate.avgR)}
          tone={aggregate.avgR && Number(aggregate.avgR) > 0 ? "profit" : aggregate.avgR && Number(aggregate.avgR) < 0 ? "loss" : "neutral"}
          icon={TrendingUp}
        />
        <MetricCard
          label="Trade Count"
          value={String(aggregate.totalTrades ?? 0)}
          tone="neutral"
          icon={ClipboardList}
        />
        <MetricCard
          label="Profit Factor"
          value={pf != null ? pf.toFixed(2) : "N/A"}
          tone={pf != null && pf >= 1 ? "profit" : pf != null ? "loss" : "neutral"}
          icon={Activity}
        />
        <MetricCard
          label="Expectancy"
          value={formatR(aggregate.expectancyR)}
          tone={expectancy != null && expectancy > 0 ? "profit" : expectancy != null && expectancy < 0 ? "loss" : "neutral"}
          icon={TrendingUp}
        />
        <MetricCard
          label="Avg Win"
          value={aggregate.avgWinCents != null ? formatSignedCents(aggregate.avgWinCents).text : "N/A"}
          tone="profit"
          icon={TrendingUp}
        />
        <MetricCard
          label="Avg Loss"
          value={aggregate.avgLossCents != null ? formatSignedCents(aggregate.avgLossCents).text : "N/A"}
          tone="loss"
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 @[700px]:grid-cols-3 gap-3">
        {hasEquity && (
          <Card className="bg-card border border-border rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Equity Curve</h3>
            <EquityCurveChart data={equityCurve} startingBalanceCents={startingBalanceCents} />
          </Card>
        )}
        {hasDaily && (
          <Card className="bg-card border border-border rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Daily P&L</h3>
            <DailyPnlChart data={dailyPnl} />
          </Card>
        )}
        {hasRDist && (
          <Card className="bg-card border border-border rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">R Distribution</h3>
            <RDistributionChart data={rDistribution} />
          </Card>
        )}
      </div>
    </section>
  );
}

function StrategicBreakdown({
  byInstrument = [],
  byStrategy = [],
  bySession = [],
  longVsShort,
  onSelectSymbol,
  onSelectStrategy,
  onSelectDirection,
}: {
  byInstrument?: GroupBreakdownItem[];
  byStrategy?: GroupBreakdownItem[];
  bySession?: GroupBreakdownItem[];
  longVsShort?: {
    long: LongVsShortMetrics;
    short: LongVsShortMetrics;
  } | null;
  onSelectSymbol: (symbol: string) => void;
  onSelectStrategy: (strategyId: string) => void;
  onSelectDirection: (direction: "long" | "short") => void;
}) {
  const topInstruments = byInstrument.slice(0, 5);
  const topStrategies = byStrategy.slice(0, 5);

  const totalDirectionalTrades =
    (longVsShort?.long?.trades ?? 0) + (longVsShort?.short?.trades ?? 0);
  const longPct =
    totalDirectionalTrades > 0
      ? Math.round(((longVsShort?.long?.trades ?? 0) / totalDirectionalTrades) * 100)
      : 50;
  const shortPct = 100 - longPct;

  return (
    <section className="space-y-3">
      <SectionTitle
        icon={Layers}
        title="MARKET BREAKDOWN & EDGE ANALYSIS"
        subtitle="Rankings by instrument, strategy setup, directional bias, and trading session."
      />

      {/* Row 1: Instrument Rankings & Strategy Rankings */}
      <div className="grid grid-cols-1 @[700px]:grid-cols-2 gap-3">
        {/* Instrument Rankings */}
        <Card className="bg-card border border-border rounded-xl shadow-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Top Instruments</h3>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                Click to filter
              </span>
            </div>
            {topInstruments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No instrument data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-[10px] uppercase font-semibold">
                      <th className="text-left pb-2">Instrument</th>
                      <th className="text-right pb-2">Trades</th>
                      <th className="text-right pb-2">Win %</th>
                      <th className="text-right pb-2">Avg R</th>
                      <th className="text-right pb-2">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {topInstruments.map((item) => {
                      const pnl = formatSignedCents(item.pnlCents);
                      return (
                        <tr
                          key={item.key}
                          onClick={() => onSelectSymbol(item.key)}
                          className="hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 font-medium text-foreground">{item.label}</td>
                          <td className="py-2.5 text-right font-mono text-muted-foreground">{item.trades}</td>
                          <td className="py-2.5 text-right font-mono">
                            {item.winRate != null ? `${Math.round(item.winRate * 100)}%` : "—"}
                          </td>
                          <td className="py-2.5 text-right font-mono text-muted-foreground">
                            {formatR(item.avgR)}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 text-right font-semibold font-mono",
                              pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground",
                            )}
                          >
                            <PrivacyMask value={pnl.text} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* Strategy Rankings */}
        <Card className="bg-card border border-border rounded-xl shadow-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Strategy Edge</h3>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                Click to filter
              </span>
            </div>
            {topStrategies.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No strategy data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-[10px] uppercase font-semibold">
                      <th className="text-left pb-2">Strategy</th>
                      <th className="text-right pb-2">Trades</th>
                      <th className="text-right pb-2">Win %</th>
                      <th className="text-right pb-2">Expectancy</th>
                      <th className="text-right pb-2">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {topStrategies.map((item) => {
                      const pnl = formatSignedCents(item.pnlCents);
                      return (
                        <tr
                          key={item.key}
                          onClick={() => onSelectStrategy(item.key)}
                          className="hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 font-medium text-foreground max-w-[140px] truncate">
                            {item.label}
                          </td>
                          <td className="py-2.5 text-right font-mono text-muted-foreground">{item.trades}</td>
                          <td className="py-2.5 text-right font-mono">
                            {item.winRate != null ? `${Math.round(item.winRate * 100)}%` : "—"}
                          </td>
                          <td className="py-2.5 text-right font-mono text-muted-foreground">
                            {formatR(item.expectancyR)}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 text-right font-semibold font-mono",
                              pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground",
                            )}
                          >
                            <PrivacyMask value={pnl.text} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Directional Asymmetry (Long vs Short) & Session Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Long vs Short */}
        <Card className="bg-card border border-border rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Directional Asymmetry (Long vs Short)</h3>
            <span className="text-[10px] text-muted-foreground font-mono">
              {totalDirectionalTrades} trades
            </span>
          </div>

          {/* Ratio bar */}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-500 font-medium">Long: {longPct}%</span>
              <span className="text-rose-500 font-medium">Short: {shortPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted">
              <div style={{ width: `${longPct}%` }} className="bg-emerald-500 transition-all" />
              <div style={{ width: `${shortPct}%` }} className="bg-rose-500 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
            {/* Long details */}
            <div
              onClick={() => onSelectDirection("long")}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors border border-border/50 space-y-1.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                <TrendingUp className="h-3.5 w-3.5" />
                LONG
              </div>
              <div className="text-sm font-bold font-mono">
                <PrivacyMask value={formatSignedCents(longVsShort?.long?.pnlCents ?? 0).text} />
              </div>
              <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
                <div>Win Rate: {longVsShort?.long?.winRate ? formatPct(longVsShort.long.winRate) : "—"}</div>
                <div>Avg R: {formatR(longVsShort?.long?.avgR)}</div>
                <div>PF: {longVsShort?.long?.profitFactor ? Number(longVsShort.long.profitFactor).toFixed(2) : "—"}</div>
              </div>
            </div>

            {/* Short details */}
            <div
              onClick={() => onSelectDirection("short")}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors border border-border/50 space-y-1.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                <TrendingDown className="h-3.5 w-3.5" />
                SHORT
              </div>
              <div className="text-sm font-bold font-mono">
                <PrivacyMask value={formatSignedCents(longVsShort?.short?.pnlCents ?? 0).text} />
              </div>
              <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
                <div>Win Rate: {longVsShort?.short?.winRate ? formatPct(longVsShort.short.winRate) : "—"}</div>
                <div>Avg R: {formatR(longVsShort?.short?.avgR)}</div>
                <div>PF: {longVsShort?.short?.profitFactor ? Number(longVsShort.short.profitFactor).toFixed(2) : "—"}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Trading Session Performance */}
        <Card className="bg-card border border-border rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Trading Sessions</h3>
            </div>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
              Realized P&amp;L
            </span>
          </div>

          {bySession.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No session data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-[10px] uppercase font-semibold">
                    <th className="text-left pb-2">Session</th>
                    <th className="text-right pb-2">Trades</th>
                    <th className="text-right pb-2">Win %</th>
                    <th className="text-right pb-2">Net P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {bySession.map((sess) => {
                    const pnl = formatSignedCents(sess.pnlCents);
                    return (
                      <tr key={sess.key} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 font-medium text-foreground">{sess.label}</td>
                        <td className="py-2.5 text-right font-mono text-muted-foreground">{sess.trades}</td>
                        <td className="py-2.5 text-right font-mono">
                          {sess.winRate != null ? `${Math.round(sess.winRate * 100)}%` : "—"}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-semibold font-mono",
                            pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground",
                          )}
                        >
                          <PrivacyMask value={pnl.text} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 bg-border" />
          <Skeleton className="h-4 w-56 bg-border" />
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Skeleton key={p.key} className="h-8 w-20 bg-border rounded-md" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-64 bg-border" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-border rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 bg-border rounded-xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-56 bg-border" />
        <Skeleton className="h-72 bg-border rounded-xl" />
      </div>
    </div>
  );
}
