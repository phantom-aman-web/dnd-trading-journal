"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { CHART_TOOLTIP_CONTENT_STYLE, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_ITEM_STYLE, CHART_AXIS_TICK_STYLE } from "./chart-theme";

interface Bucket {
  bucket: string;
  count: number;
}

export function RDistributionChart({ data }: { data: Bucket[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
        No R data available.
      </div>
    );
  }
  return (
    <div className="h-48 md:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis dataKey="bucket" tick={CHART_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
          <YAxis tick={CHART_AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            itemStyle={CHART_TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }}
            formatter={(value: number) => [`${value} trades`, "Count"]}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => {
              const isNegative = d.bucket.includes("-");
              const isBE = d.bucket === "BE";
              const fill = isBE ? "var(--muted-foreground)" : isNegative ? "var(--loss)" : "var(--profit)";
              return <Cell key={i} fill={fill} />;
            })}
            <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
