"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { CHART_TOOLTIP_CONTENT_STYLE, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_ITEM_STYLE, CHART_AXIS_TICK_STYLE } from "./chart-theme";
import { formatCents } from "@/lib/money";

interface Point {
  date: string;
  label: string;
  cumulativeCents: number;
  pnlCents: number;
}

export function EquityCurveChart({ data, startingBalanceCents = 0 }: { data: Point[]; startingBalanceCents?: number }) {
  const chartData = data.map((d) => ({
    label: d.label,
    value: d.cumulativeCents / 100,
  }));
  const minVal = Math.min(...chartData.map((d) => d.value));
  const maxVal = Math.max(...chartData.map((d) => d.value));
  const padding = (maxVal - minVal) * 0.1 || 1;

  return (
    <div className="h-48 md:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={CHART_AXIS_TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            tick={CHART_AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            itemStyle={CHART_TOOLTIP_ITEM_STYLE}
            cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.3 }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Equity"]}
          />
          <ReferenceLine y={startingBalanceCents / 100} stroke="var(--muted-foreground)" strokeDasharray="3 3" strokeOpacity={0.4} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#equityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
