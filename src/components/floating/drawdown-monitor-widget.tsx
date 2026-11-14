"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivacyStore, PRIVACY_MASK } from "@/lib/privacy-store";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropChallengeItem {
  id: string;
  name?: string;
  propFirm?: string;
  startingBalanceCents: number;
  maxDrawdownCents?: number | null;
  maxDrawdownPct?: number | null;
  drawdownType?: string; // "static" | "trailing"
}

interface AccountItem {
  id: string;
  name: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
  maxDrawdownPct?: number | null;
}

export function DrawdownMonitorWidgetContent() {
  const isPrivate = usePrivacyStore((s) => s.isPrivate);

  const { data: propData } = useQuery<{ items: PropChallengeItem[] }>({
    queryKey: ["prop-challenges-monitor"],
    queryFn: async () => {
      const res = await fetch("/api/prop-challenges");
      return res.ok ? res.json() : { items: [] };
    },
  });

  const { data: accountsData } = useQuery<{ items: AccountItem[] }>({
    queryKey: ["accounts-monitor"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      const json = await res.json();
      return { items: Array.isArray(json) ? json : json.items || [] };
    },
  });

  const challenge = propData?.items?.[0];
  const account = accountsData?.items?.[0];

  // Starting balance
  const startingBalanceCents = challenge?.startingBalanceCents || account?.startingBalanceCents || 10000000; // $100k
  const currentBalanceCents = account?.currentBalanceCents || startingBalanceCents;

  // Max Drawdown rule: prefer prop challenge maxDrawdownCents, then account maxDrawdownPct, default 10%
  const maxDrawdownLimitCents =
    challenge?.maxDrawdownCents ??
    (account?.maxDrawdownPct ? Math.round((startingBalanceCents * account.maxDrawdownPct) / 100) : Math.round(startingBalanceCents * 0.10));

  // Current drawdown: how much down from starting/peak
  const currentDrawdownCents = Math.max(0, startingBalanceCents - currentBalanceCents);
  const remainingCushionCents = Math.max(0, maxDrawdownLimitCents - currentDrawdownCents);
  const consumedPct = Math.min(100, Math.round((currentDrawdownCents / maxDrawdownLimitCents) * 100));
  const cushionPct = 100 - consumedPct;

  // Status
  let status: "safe" | "warning" | "critical" = "safe";
  let statusLabel = "Healthy Cushion";
  let statusTone = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";

  if (consumedPct >= 80) {
    status = "critical";
    statusLabel = "Critical Drawdown";
    statusTone = "text-rose-500 bg-rose-500/10 border-rose-500/20";
  } else if (consumedPct >= 50) {
    status = "warning";
    statusLabel = "Warning Level";
    statusTone = "text-amber-500 bg-amber-500/10 border-amber-500/20";
  }

  const drawdownType = challenge?.drawdownType === "trailing" ? "Trailing" : "Static";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-muted-foreground text-[10px]">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-foreground truncate max-w-[130px]">
            {challenge?.name || account?.name || "Funded Account"}
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted/60 text-muted-foreground">
            {drawdownType}
          </span>
        </div>
        <Badge variant="outline" className={cn("text-[9px] font-mono py-0 h-4 px-1.5", statusTone)}>
          {statusLabel}
        </Badge>
      </div>

      {/* Main Metric */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
          Remaining Max Drawdown Cushion
        </div>
        <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1.5">
          <span>
            {isPrivate ? (
              `${PRIVACY_MASK}`
            ) : (
              `$${(remainingCushionCents / 100).toLocaleString()}`
            )}
          </span>
          <span className={cn("text-xs font-semibold", cushionPct > 50 ? "text-emerald-500" : "text-amber-500")}>
            ({cushionPct}% cushion)
          </span>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            style={{ width: `${consumedPct}%` }}
            className={cn(
              "h-full transition-all duration-300",
              consumedPct >= 80 ? "bg-rose-500" : consumedPct >= 50 ? "bg-amber-500" : "bg-emerald-500"
            )}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>Current DD: {isPrivate ? PRIVACY_MASK : `$${(currentDrawdownCents / 100).toLocaleString()}`}</span>
          <span>Max Limit: {isPrivate ? PRIVACY_MASK : `$${(maxDrawdownLimitCents / 100).toLocaleString()}`}</span>
        </div>
      </div>
    </div>
  );
}
