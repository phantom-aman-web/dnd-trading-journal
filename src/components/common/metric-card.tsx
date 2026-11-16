"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PrivacyMask } from "@/components/common/privacy-mask";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "profit" | "loss" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
  isSensitive?: boolean;
  className?: string;
}

export function MetricCard({ label, value, sub, tone = "neutral", icon: Icon, isSensitive, className }: MetricCardProps) {
  const sensitive = isSensitive ?? (/p&l|pnl|avg win|avg loss|balance|equity|drawdown/i.test(label));

  return (
    <Card className={cn("p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn("h-3.5 w-3.5", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-muted-foreground")} />}
      </div>
      <div
        className={cn(
          "mt-1 text-lg md:text-xl font-semibold tnum",
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "",
        )}
      >
        {sensitive ? <PrivacyMask value={value} /> : value}
      </div>
      {sub && <div className="text-xs text-muted-foreground tnum">{sub}</div>}
    </Card>
  );
}
