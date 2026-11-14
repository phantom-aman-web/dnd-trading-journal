"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivacyStore, PRIVACY_MASK } from "@/lib/privacy-store";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropChallengeItem {
  id: string;
  name?: string;
  propFirm?: string;
  startingBalanceCents: number;
  dailyLossLimitCents?: number | null;
  dailyLossLimitPct?: number | null;
  resetTimezone?: string;
  resetHour?: number;
}

interface AccountItem {
  id: string;
  name: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
  dailyLossLimitPct?: number | null;
}

export function DailyRiskLimitWidgetContent() {
  const isPrivate = usePrivacyStore((s) => s.isPrivate);

  const { data: propData } = useQuery<{ items: PropChallengeItem[] }>({
    queryKey: ["prop-challenges-daily-limit"],
    queryFn: async () => {
      const res = await fetch("/api/prop-challenges");
      return res.ok ? res.json() : { items: [] };
    },
  });

  const { data: accountsData } = useQuery<{ items: AccountItem[] }>({
    queryKey: ["accounts-daily-limit"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      const json = await res.json();
      return { items: Array.isArray(json) ? json : json.items || [] };
    },
  });

  // Query today's trades to compute realized daily loss
  const { data: tradesData } = useQuery<{ trades: any[] }>({
    queryKey: ["trades-today-loss"],
    queryFn: async () => {
      const res = await fetch("/api/trades?limit=50&status=closed");
      return res.ok ? res.json() : { trades: [] };
    },
  });

  const challenge = propData?.items?.[0];
  const account = accountsData?.items?.[0];

  const startingBalanceCents = challenge?.startingBalanceCents || account?.startingBalanceCents || 10000000;

  // Daily Loss Limit rule:
  // Prop challenge configured dailyLossLimitCents, or account dailyLossLimitPct (e.g. 5%), default 5%
  const dailyLossLimitCents =
    challenge?.dailyLossLimitCents ??
    (account?.dailyLossLimitPct
      ? Math.round((startingBalanceCents * account.dailyLossLimitPct) / 100)
      : Math.round(startingBalanceCents * 0.05)); // Default 5% = $5,000 on $100k

  // Calculate today's loss from today's trades
  const todayTrades = tradesData?.trades || [];
  let todayPnlCents = 0;
  for (const t of todayTrades) {
    if (t.netPnlCents) todayPnlCents += t.netPnlCents;
  }
  const currentDailyLossCents = todayPnlCents < 0 ? Math.abs(todayPnlCents) : 0;
  const remainingAllowanceCents = Math.max(0, dailyLossLimitCents - currentDailyLossCents);
  const consumedPct = Math.min(100, Math.round((currentDailyLossCents / dailyLossLimitCents) * 100));

  // Determine status
  let status: "normal" | "approaching" | "at_risk" | "reached" = "normal";
  let statusLabel = "Normal";
  let statusTone = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";

  if (consumedPct >= 100) {
    status = "reached";
    statusLabel = "Limit Reached";
    statusTone = "text-rose-500 bg-rose-500/15 border-rose-500/30";
  } else if (consumedPct >= 75) {
    status = "at_risk";
    statusLabel = "At Risk";
    statusTone = "text-orange-500 bg-orange-500/10 border-orange-500/20";
  } else if (consumedPct >= 50) {
    status = "approaching";
    statusLabel = "Approaching Limit";
    statusTone = "text-amber-500 bg-amber-500/10 border-amber-500/20";
  }

  const resetTimeStr = "17:00 NY (21:00 UTC)";

  return (
    <div className="space-y-2 flex flex-col justify-between h-full">
      {/* Header Info */}
      <div className="flex items-center justify-between text-muted-foreground text-[10px]">
        <span className="font-semibold text-foreground truncate max-w-[140px]">
          {challenge?.name || account?.name || "Daily Trading Cycle"}
        </span>
        <Badge variant="outline" className={cn("text-[9px] font-mono py-0 h-4 px-1.5", statusTone)}>
          {statusLabel}
        </Badge>
      </div>

      {/* Main Metric */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
          Remaining Daily Allowance
        </div>
        <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1.5">
          <span>
            {isPrivate ? PRIVACY_MASK : `$${(remainingAllowanceCents / 100).toLocaleString()}`}
          </span>
          <span className={cn("text-xs font-semibold", consumedPct > 70 ? "text-rose-500" : "text-emerald-500")}>
            ({100 - consumedPct}% left)
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            style={{ width: `${consumedPct}%` }}
            className={cn(
              "h-full transition-all duration-300",
              consumedPct >= 100 ? "bg-rose-500" : consumedPct >= 75 ? "bg-orange-500" : consumedPct >= 50 ? "bg-amber-500" : "bg-emerald-500"
            )}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>Loss Today: {isPrivate ? PRIVACY_MASK : `$${(currentDailyLossCents / 100).toLocaleString()}`}</span>
          <span>Daily Cap: {isPrivate ? PRIVACY_MASK : `$${(dailyLossLimitCents / 100).toLocaleString()}`}</span>
        </div>
      </div>

      {/* Reset Cycle Time */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground/70" />
          <span>Reset:</span>
        </div>
        <span className="font-mono text-foreground font-medium">{resetTimeStr}</span>
      </div>
    </div>
  );
}
