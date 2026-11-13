"use client";

import { useMemo } from "react";
import {
  Clock,
  Timer,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Hourglass,
  Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatSignedCents } from "@/lib/money";
import { formatDurationHuman, type TimeInTradeAnalytics } from "@/lib/duration-analytics";

interface TimeInTradeTabProps {
  data: TimeInTradeAnalytics | null;
}

export function TimeInTradeTab({ data }: TimeInTradeTabProps) {
  const buckets = Array.isArray(data?.buckets) ? data.buckets : [];

  if (!data || !data.totalClosedAnalyzed || buckets.length === 0) {
    return (
      <Card className="p-10 text-center border-border">
        <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="font-semibold text-foreground text-base">No holding time data available</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Log trades with valid entry and exit times to analyze your holding durations and performance correlations.
        </p>
      </Card>
    );
  }

  const chartData = useMemo(() => {
    return buckets.map((b) => ({
      name: b.label.split("(")[0].trim(),
      trades: b.tradesCount,
      pnlDollars: b.netPnlCents / 100,
      winRate: b.winRatePct ?? 0,
    }));
  }, [buckets]);

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Average Duration */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Average Duration</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatDurationHuman(data.avgMinutes)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Median: <strong className="text-foreground">{formatDurationHuman(data.medianMinutes)}</strong>
          </div>
        </div>

        {/* Win Avg Duration */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <TrendingUp className="h-3.5 w-3.5 text-profit" />
            <span>Avg Winner Duration</span>
          </div>
          <div className="text-2xl font-bold text-profit">
            {formatDurationHuman(data.winAvgMinutes)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Median: <strong className="text-foreground">{formatDurationHuman(data.winMedianMinutes)}</strong>
          </div>
        </div>

        {/* Loss Avg Duration */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <TrendingDown className="h-3.5 w-3.5 text-loss" />
            <span>Avg Loser Duration</span>
          </div>
          <div className="text-2xl font-bold text-loss">
            {formatDurationHuman(data.lossAvgMinutes)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Median: <strong className="text-foreground">{formatDurationHuman(data.lossMedianMinutes)}</strong>
          </div>
        </div>

        {/* Win / Loss Duration Ratio */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Hourglass className="h-3.5 w-3.5 text-amber-500" />
            <span>Win/Loss Duration Ratio</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {data.winLossDurationRatio !== null ? `${data.winLossDurationRatio}x` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {data.winLossDurationRatio !== null && data.winLossDurationRatio > 1
              ? "Winners held longer than losers"
              : data.winLossDurationRatio !== null
              ? "Losers cut faster than winners"
              : "No comparison data"}
          </div>
        </div>
      </div>

      {/* Duration Distribution Chart */}
      <div className="bg-card p-4 md:p-5 rounded-xl border border-border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" />
              Holding Duration Distribution
            </h3>
            <p className="text-xs text-muted-foreground">
              Trade frequency grouped by holding duration buckets.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {data.totalClosedAnalyzed} closed trades analyzed
          </div>
        </div>

        <div className="h-64 w-full min-w-0 pt-2">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border p-2.5 rounded-lg shadow-md text-xs space-y-1">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div>Trades: <strong className="text-foreground">{item.trades}</strong></div>
                      <div>Win Rate: <strong className="text-foreground">{item.winRate}%</strong></div>
                      <div>Net P&amp;L: <strong className={item.pnlDollars >= 0 ? "text-profit" : "text-loss"}>${item.pnlDollars.toFixed(2)}</strong></div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="trades"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Duration Breakdown Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Performance by Holding Duration</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Key metrics across each timeframe bucket.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left font-semibold text-muted-foreground">
                <th className="px-4 py-2.5">Duration Bucket</th>
                <th className="px-3 py-2.5 text-right">Trades</th>
                <th className="px-3 py-2.5 text-right">W / L / BE</th>
                <th className="px-3 py-2.5 text-right">Win Rate</th>
                <th className="px-3 py-2.5 text-right">Net P&amp;L</th>
                <th className="px-3 py-2.5 text-right">Avg R</th>
                <th className="px-3 py-2.5 text-right">Expectancy</th>
                <th className="px-4 py-2.5 text-right">Profit Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {buckets.map((b) => {
                const pnl = formatSignedCents(b.netPnlCents);
                return (
                  <tr key={b.bucketKey} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {b.label}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                      {b.tradesCount}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {b.wins} / {b.losses} / {b.breakevens}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {b.winRatePct !== null ? (
                        <span className={`font-semibold ${b.winRatePct >= 50 ? "text-profit" : "text-loss"}`}>
                          {b.winRatePct}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${pnl.sign < 0 ? "text-loss" : pnl.sign > 0 ? "text-profit" : "text-muted-foreground"}`}>
                      {pnl.text}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                      {b.avgR ? `${parseFloat(b.avgR).toFixed(2)}R` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                      {b.expectancyCents !== null ? formatSignedCents(b.expectancyCents).text : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {b.profitFactor ? parseFloat(b.profitFactor).toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Exclusion note */}
        {data.openExcludedCount > 0 && (
          <div className="p-3 bg-muted/20 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              {data.openExcludedCount} open position{data.openExcludedCount === 1 ? "" : "s"} excluded from duration distributions to maintain closed-trade integrity.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

