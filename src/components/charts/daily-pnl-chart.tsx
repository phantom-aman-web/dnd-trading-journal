"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { CHART_TOOLTIP_CONTENT_STYLE, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_ITEM_STYLE, CHART_AXIS_TICK_STYLE } from "./chart-theme";

interface Point {
  date: string;
  label: string;
  pnlCents: number;
  tradeCount: number;
}

export function DailyPnlChart({ data }: { data: Point[] }) {
  const chartData = data.map((d) => ({
    label: d.label,
    value: d.pnlCents / 100,
    count: d.tradeCount,
  }));
  return (
    <div className="h-48 md:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis dataKey="label" tick={CHART_AXIS_TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={CHART_AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `$${v.toFixed(0)}`} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            itemStyle={CHART_TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }}
            formatter={(value: number, _name: any, ctx: any) => [`$${value.toFixed(2)}`, `P&L (${ctx?.payload?.count ?? 0} trades)`]}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? "var(--profit)" : "var(--loss)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
