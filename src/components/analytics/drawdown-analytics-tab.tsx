"use client";

import { useMemo } from "react";
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Layers,
  ArrowDownRight,
  Info,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatSignedCents } from "@/lib/money";

interface DrawdownAnalyticsData {
  estimatedBalanceCurve: Array<{
    date: string;
    tradeId: string;
    symbol: string;
    netPnlCents: number;
    balanceCents: number;
    peakBalanceCents: number;
    drawdownCents: number;
    drawdownPct: number;
  }>;
  peakBalanceCents: number;
  troughBalanceCents: number;
  maxDrawdownCents: number;
  maxDrawdownPct: number;
  currentDrawdownCents: number;
  currentDrawdownPct: number;
  longestUnderwaterDays: number;
  underwaterTradesCount: number;
  losingStreaks: {
    maxConsecutiveLosses: number;
    avgConsecutiveLosses: number;
    totalLossStreaks: number;
  };
  recoveryTrades: {
    avgTradesToRecover: number;
    longestRecoveryTrades: number;
  };
  dailyLossDistribution: Array<{
    bracket: string;
    count: number;
    totalLossCents: number;
  }>;
}

interface DrawdownAnalyticsTabProps {
  data: any;
}

export function DrawdownAnalyticsTab({ data }: DrawdownAnalyticsTabProps) {
  const curve: any[] = data?.curve ?? data?.estimatedBalanceCurve ?? [];

  const chartData = useMemo(() => {
    return curve.map((pt, idx) => ({
      idx: idx + 1,
      date: new Date(pt.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      balanceDollars: pt.balanceCents / 100,
      peakDollars: pt.peakBalanceCents / 100,
      drawdownPct: -Math.abs(pt.drawdownPct),
      symbol: pt.symbol,
      pnlDollars: pt.netPnlCents / 100,
    }));
  }, [curve]);

  if (!data || curve.length === 0) {
    return (
      <Card className="p-10 text-center border-border">
        <TrendingDown className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="font-semibold text-foreground text-base">No drawdown data available</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Execute and close trades with an initial account balance to analyze peak-to-trough drawdowns, losing streaks, and recovery cycles.
        </p>
      </Card>
    );
  }

  const rawStreaks = Array.isArray(data?.losingStreaks) ? data.losingStreaks : [];
  const maxLossCount = rawStreaks.length > 0
    ? Math.max(...rawStreaks.map((s: any) => s.tradeCount ?? s.consecutiveLosses ?? 0))
    : (data?.losingStreaks?.maxConsecutiveLosses ?? 0);
  const avgLossCount = rawStreaks.length > 0
    ? (rawStreaks.reduce((acc: number, s: any) => acc + (s.tradeCount ?? s.consecutiveLosses ?? 0), 0) / rawStreaks.length)
    : (data?.losingStreaks?.avgConsecutiveLosses ?? 0);
  const avgRecovery = data?.averageDrawdownRecoveryTrades ?? data?.recoveryTrades?.avgTradesToRecover ?? 0;
  const longestRecovery = data?.maxDrawdownDurationTrades ?? data?.recoveryTrades?.longestRecoveryTrades ?? 0;

  return (
    <div className="space-y-6">
      {/* Scope and Context Notice */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">Estimated Balance Curve &amp; Drawdown Analytics: </span>
          <span>
            {data.currencyExplanation ||
              "Calculated from sequential realized closed-trade P&L relative to initial capital base. Historical peak-to-trough metrics reflect finalized book positions. Live intraday open equity fluctuations require continuous broker synchronization."}
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Peak Balance */}
        <Card className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">Peak Balance</div>
          <div className="text-lg font-bold font-mono text-foreground truncate">
            {formatSignedCents(data.peakBalanceCents ?? 0).text}
          </div>
          <div className="text-[10px] text-muted-foreground">High water mark</div>
        </Card>

        {/* Max Drawdown */}
        <Card className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">Max Drawdown</div>
          <div className="text-lg font-bold font-mono text-loss truncate">
            {formatSignedCents(-Math.abs(data.maxDrawdownCents ?? 0)).text}
          </div>
          <div className="text-[10px] font-semibold text-loss">
            -{(data.maxDrawdownPct ?? 0).toFixed(1)}% peak-to-trough
          </div>
        </Card>

        {/* Current Drawdown */}
        <Card className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">Current Drawdown</div>
          <div className="text-lg font-bold font-mono text-foreground truncate">
            {(data.currentDrawdownCents ?? 0) > 0
              ? formatSignedCents(-Math.abs(data.currentDrawdownCents)).text
              : "$0.00"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {(data.currentDrawdownPct ?? 0) > 0 ? `-${data.currentDrawdownPct.toFixed(1)}% from peak` : "At peak"}
          </div>
        </Card>

        {/* Longest Underwater */}
        <Card className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">Longest Underwater</div>
          <div className="text-lg font-bold font-mono text-foreground">
            {data.longestUnderwaterDays ?? 0} <span className="text-xs font-normal">days</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {data.maxDrawdownDurationTrades ?? data.underwaterTradesCount ?? 0} trades during streak
          </div>
        </Card>

        {/* Losing Streak */}
        <Card className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">Losing Streak</div>
          <div className="text-lg font-bold font-mono text-loss">
            {maxLossCount} <span className="text-xs font-normal">losses</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Avg: {avgLossCount.toFixed(1)} losses
          </div>
        </Card>

        {/* Recovery Velocity */}
        <Card className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">Recovery Velocity</div>
          <div className="text-lg font-bold font-mono text-foreground">
            {avgRecovery > 0 ? `${avgRecovery.toFixed(1)} tr` : "1.0 tr"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Max: {longestRecovery} trades to peak
          </div>
        </Card>
      </div>

      {/* Balance & High-Water Mark Curve */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground">Balance Curve &amp; High-Water Mark</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cumulative balance evolution compared against historical peak capital equity.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              <span className="text-muted-foreground">Account Balance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Peak Water Mark</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="p-3 bg-card border border-border rounded-lg shadow-lg text-xs space-y-1">
                      <div className="font-semibold text-foreground">
                        Trade #{item.idx} · {item.symbol}
                      </div>
                      <div className="text-muted-foreground">Date: {item.date}</div>
                      <div className="font-mono text-foreground">
                        Balance: ${item.balanceDollars.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="font-mono text-emerald-600 dark:text-emerald-400">
                        Peak: ${item.peakDollars.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div
                        className={
                          item.pnlDollars >= 0
                            ? "font-mono text-profit font-semibold"
                            : "font-mono text-loss font-semibold"
                        }
                      >
                        Trade P&amp;L: {item.pnlDollars >= 0 ? `+$${item.pnlDollars.toFixed(2)}` : `-$${Math.abs(item.pnlDollars).toFixed(2)}`}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="peakDollars"
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="balanceDollars"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Underwater Drawdown Depth Area Chart */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground">Underwater Drawdown Depth (%)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Depth of drawdown below previous peak equity per closed trade.
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] self-start sm:self-auto font-mono text-loss">
            Max: -{data.maxDrawdownPct.toFixed(1)}%
          </Badge>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                domain={["auto", 0]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="p-2.5 bg-card border border-border rounded-lg shadow-lg text-xs space-y-1">
                      <div className="font-semibold text-foreground">Trade #{item.idx} · {item.symbol}</div>
                      <div className="font-mono text-loss font-semibold">
                        Underwater: {item.drawdownPct.toFixed(2)}%
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="drawdownPct"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.2}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Loss Size Distribution Brackets */}
      {data.dailyLossDistribution && data.dailyLossDistribution.length > 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Loss Size Distribution</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Breakdown of losing trades partitioned by loss severity brackets.
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">Tail Risk Control</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.dailyLossDistribution.map((bracket: any, idx: number) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-border bg-card/60 space-y-1.5"
              >
                <div className="text-xs font-semibold text-foreground">{bracket.bracket}</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold font-mono text-foreground">{bracket.count}</span>
                  <span className="text-xs text-muted-foreground font-medium">trades</span>
                </div>
                <div className="text-[11px] font-mono text-loss font-semibold">
                  {formatSignedCents(-Math.abs(bracket.totalLossCents)).text}
                </div>
              </div>
            ))}
          </div>

          {/* Normalized % of Account Capital Loss Severity */}
          {data.normalizedLossDistribution && data.normalizedLossDistribution.length > 0 && (
            <div className="pt-3 border-t border-border/60 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Capital-Normalized Loss Severity (% of Initial Account)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {data.normalizedLossDistribution.map((nb: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-border/70 bg-muted/20 text-xs space-y-1">
                    <div className="font-medium text-foreground">{nb.bracket}</div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-bold font-mono text-foreground">{nb.count}</span>
                      <span className="text-[11px] text-muted-foreground font-medium">{nb.pctOfLosingTrades}% of losses</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
