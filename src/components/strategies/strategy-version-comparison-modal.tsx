"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
  Check,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatSignedCents } from "@/lib/money";

interface VersionItem {
  id: string;
  versionLabel: string;
  effectiveDate: string;
  changeReason?: string | null;
  changeSummary?: string | null;
}

interface StrategyVersionComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyId: string;
  strategyName: string;
  versions: VersionItem[];
}

export function StrategyVersionComparisonModal({
  open,
  onOpenChange,
  strategyId,
  strategyName,
  versions,
}: StrategyVersionComparisonModalProps) {
  // Sort versions chronological ascending (v1, v2, ...)
  const sorted = [...versions].sort(
    (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
  );

  const defaultV1 = sorted[0]?.id || "";
  const defaultV2 = sorted[sorted.length - 1]?.id || "";

  const [v1Id, setV1Id] = useState(defaultV1);
  const [v2Id, setV2Id] = useState(defaultV2);

  // Sync if opened
  if (v1Id === "" && defaultV1 !== "") setV1Id(defaultV1);
  if (v2Id === "" && defaultV2 !== "") setV2Id(defaultV2);

  const { data, isLoading } = useQuery({
    queryKey: ["strategy-compare", strategyId, v1Id, v2Id],
    queryFn: async () => {
      if (!v1Id || !v2Id || v1Id === v2Id) return null;
      const res = await fetch(
        `/api/strategies/${strategyId}/compare?v1=${encodeURIComponent(v1Id)}&v2=${encodeURIComponent(v2Id)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to compare versions");
      return res.json();
    },
    enabled: open && !!v1Id && !!v2Id && v1Id !== v2Id,
  });

  const v1 = data?.version1;
  const v2 = data?.version2;
  const deltas = data?.deltas;
  const ruleDiff = data?.ruleDiff;

  const isLowSample = v1?.isLowSample || v2?.isLowSample;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            <DialogTitle>Compare Versions — {strategyName}</DialogTitle>
          </div>
          <DialogDescription>
            Side-by-side performance metrics and rule changes between playbook iterations.
          </DialogDescription>
        </DialogHeader>

        {/* Version Selectors Bar */}
        <div className="grid sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Base Version (A)
            </label>
            <Select value={v1Id} onValueChange={setV1Id}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select version A" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.versionLabel} ({new Date(v.effectiveDate).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Comparison Version (B)
            </label>
            <Select value={v2Id} onValueChange={setV2Id}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select version B" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.versionLabel} ({new Date(v.effectiveDate).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {v1Id === v2Id ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Please select two different versions to compare.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Calculating version performance metrics…</span>
          </div>
        ) : !data ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No comparison data available for the selected versions.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Small Sample Warning Alert */}
            {isLowSample && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Small sample size detected: </span>
                  {v1?.isLowSample && (
                    <span>v{v1.versionLabel} has only {v1.metrics.totalTrades} trade(s). </span>
                  )}
                  {v2?.isLowSample && (
                    <span>v{v2.versionLabel} has only {v2.metrics.totalTrades} trade(s). </span>
                  )}
                  <span>Sample sizes under 20 trades should be interpreted with caution.</span>
                </div>
              </div>
            )}

            {/* Change Summary if provided */}
            {v2?.changeSummary && (
              <div className="p-3 bg-card rounded-lg border border-border text-xs space-y-1">
                <div className="font-semibold text-foreground">
                  Changes introduced in v{v2.versionLabel}:
                </div>
                <div className="text-muted-foreground">{v2.changeSummary}</div>
                {v2.changeReason && (
                  <div className="text-[11px] text-muted-foreground/80 italic">
                    Reason: {v2.changeReason}
                  </div>
                )}
              </div>
            )}

            {/* KPI Delta Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Trades Count */}
              <div className="p-3 bg-card rounded-lg border border-border space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Sample Trades</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">{v1?.metrics.totalTrades} → {v2?.metrics.totalTrades}</span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {deltas?.trades > 0 ? `+${deltas.trades}` : deltas?.trades}
                  </span>
                </div>
              </div>

              {/* Win Rate */}
              <div className="p-3 bg-card rounded-lg border border-border space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Win Rate</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">
                    {v1?.metrics.winRate ? `${Math.round(parseFloat(v1.metrics.winRate) * 100)}%` : "—"} →{" "}
                    {v2?.metrics.winRate ? `${Math.round(parseFloat(v2.metrics.winRate) * 100)}%` : "—"}
                  </span>
                  {deltas?.winRatePct !== undefined && (
                    <span
                      className={`text-xs font-semibold ${
                        deltas.winRatePct > 0 ? "text-profit" : deltas.winRatePct < 0 ? "text-loss" : "text-muted-foreground"
                      }`}
                    >
                      {deltas.winRatePct > 0 ? `+${deltas.winRatePct}%` : `${deltas.winRatePct}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Net P&L */}
              <div className="p-3 bg-card rounded-lg border border-border space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Net P&L</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold truncate">
                    {formatSignedCents(v2?.metrics.netPnlCents ?? 0).text}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      deltas?.netPnlCents > 0 ? "text-profit" : deltas?.netPnlCents < 0 ? "text-loss" : "text-muted-foreground"
                    }`}
                  >
                    {formatSignedCents(deltas?.netPnlCents ?? 0).text}
                  </span>
                </div>
              </div>

              {/* Profit Factor */}
              <div className="p-3 bg-card rounded-lg border border-border space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Profit Factor</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">
                    {v1?.metrics.profitFactor ? parseFloat(v1.metrics.profitFactor).toFixed(2) : "—"} →{" "}
                    {v2?.metrics.profitFactor ? parseFloat(v2.metrics.profitFactor).toFixed(2) : "—"}
                  </span>
                  {deltas?.profitFactor !== undefined && (
                    <span
                      className={`text-xs font-semibold ${
                        deltas.profitFactor > 0 ? "text-profit" : deltas.profitFactor < 0 ? "text-loss" : "text-muted-foreground"
                      }`}
                    >
                      {deltas.profitFactor > 0 ? `+${deltas.profitFactor}` : deltas.profitFactor}
                    </span>
                  )}
                </div>
              </div>

              {/* Expectancy */}
              <div className="p-3 bg-card rounded-lg border border-border space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Expectancy</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">
                    {v2?.metrics.expectancyCents !== null ? formatSignedCents(v2.metrics.expectancyCents).text : "—"}
                  </span>
                  {deltas?.expectancyCents !== undefined && (
                    <span
                      className={`text-xs font-semibold ${
                        deltas.expectancyCents > 0 ? "text-profit" : deltas.expectancyCents < 0 ? "text-loss" : "text-muted-foreground"
                      }`}
                    >
                      {formatSignedCents(deltas.expectancyCents).text}
                    </span>
                  )}
                </div>
              </div>

              {/* Average R */}
              <div className="p-3 bg-card rounded-lg border border-border space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Average R</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">
                    {v1?.metrics.avgR ? `${parseFloat(v1.metrics.avgR).toFixed(2)}R` : "—"} →{" "}
                    {v2?.metrics.avgR ? `${parseFloat(v2.metrics.avgR).toFixed(2)}R` : "—"}
                  </span>
                  {deltas?.avgR !== undefined && (
                    <span
                      className={`text-xs font-semibold ${
                        deltas.avgR > 0 ? "text-profit" : deltas.avgR < 0 ? "text-loss" : "text-muted-foreground"
                      }`}
                    >
                      {deltas.avgR > 0 ? `+${deltas.avgR}R` : `${deltas.avgR}R`}
                    </span>
                  )}
                </div>
              </div>

              {/* Checklist Adherence */}
              <div className="p-3 bg-card rounded-lg border border-border space-y-1 col-span-2">
                <div className="text-[11px] font-medium text-muted-foreground">Checklist Adherence</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">
                    {v1?.checklistAdherencePct !== null ? `${v1.checklistAdherencePct}%` : "—"} →{" "}
                    {v2?.checklistAdherencePct !== null ? `${v2.checklistAdherencePct}%` : "—"}
                  </span>
                  {deltas?.checklistAdherencePct !== null && deltas?.checklistAdherencePct !== undefined && (
                    <span
                      className={`text-xs font-semibold ${
                        deltas.checklistAdherencePct > 0 ? "text-profit" : deltas.checklistAdherencePct < 0 ? "text-loss" : "text-muted-foreground"
                      }`}
                    >
                      {deltas.checklistAdherencePct > 0 ? `+${deltas.checklistAdherencePct}%` : `${deltas.checklistAdherencePct}%`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Checklist & Rule Diffs */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-bold text-foreground">Rule &amp; Checklist Diffs</h4>

              <div className="space-y-2 text-xs">
                {/* Added Rules */}
                {ruleDiff?.added.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Added in v{v2?.versionLabel} ({ruleDiff.added.length})
                    </div>
                    {ruleDiff.added.map((r: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between"
                      >
                        <span className="font-medium">{r.title}</span>
                        {r.required && <Badge variant="outline" className="text-[10px] bg-background">Required</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Removed Rules */}
                {ruleDiff?.removed.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                      <Minus className="h-3 w-3" /> Removed from v{v1?.versionLabel} ({ruleDiff.removed.length})
                    </div>
                    {ruleDiff.removed.map((r: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-between line-through opacity-80"
                      >
                        <span>{r.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Unchanged Rules */}
                {ruleDiff?.unchanged.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Check className="h-3 w-3" /> Unchanged Rules ({ruleDiff.unchanged.length})
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {ruleDiff.unchanged.map((r: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-1.5 rounded bg-muted/40 border border-border text-muted-foreground flex items-center justify-between text-[11px]"
                        >
                          <span className="truncate">{r.title}</span>
                          {r.required && <span className="text-[10px] text-muted-foreground/70 shrink-0">Req</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ruleDiff?.added.length === 0 && ruleDiff?.removed.length === 0 && (
                  <div className="p-3 bg-muted/30 rounded-lg text-center text-muted-foreground">
                    No checklist rule differences between v{v1?.versionLabel} and v{v2?.versionLabel}.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

