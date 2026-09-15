"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine, LabelList } from "recharts";
import { CHART_TOOLTIP_CONTENT_STYLE, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_ITEM_STYLE, CHART_AXIS_TICK_STYLE } from "./chart-theme";

interface Row {
  label: string;
  value: number;
  count: number;
}

export function GroupBarChart({ data, valueLabel = "Value" }: { data: Row[]; valueLabel?: string }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
        No data.
      </div>
    );
  }
  return (
    <div className="h-48 md:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
          <XAxis type="number" tick={CHART_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={CHART_AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={90} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            itemStyle={CHART_TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }}
            formatter={(value: number, _name: any, ctx: any) => [`${value.toFixed(2)} (${ctx?.payload?.count ?? 0} trades)`, valueLabel]}
          />
          <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeOpacity={0.3} />
          <Bar dataKey="value" radius={[0, 2, 2, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? "var(--profit)" : "var(--loss)"} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: "var(--muted-foreground)" }} formatter={(v: number) => v.toFixed(2)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
