"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NoTradeDialog, REASON_CATEGORIES, OBSERVATION_STATUSES } from "@/components/no-trades/no-trade-dialog";
import {
  EyeOff,
  Plus,
  Search,
  Filter,
  Clock,
  Tag,
  Archive,
  ArrowUpDown,
  Compass,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function NoTradesView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [reasonCategory, setReasonCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [bias, setBias] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["no-trades", search, reasonCategory, status, bias],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (reasonCategory !== "all") params.set("reasonCategory", reasonCategory);
      if (status !== "all") params.set("status", status);
      if (bias !== "all") params.set("bias", bias);

      const res = await fetch(`/api/no-trades?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load observations");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "archive" | "restore" }) => {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "noTrade", id, action }),
      });
      if (!res.ok) throw new Error("Failed to archive observation");
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "archive" ? "Observation archived." : "Observation restored.");
      queryClient.invalidateQueries({ queryKey: ["no-trades"] });
      setSelectedEntry(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update archive status"),
  });

  const items: any[] = data?.items || [];
  const stats = data?.stats || {
    totalObservations: 0,
    topReasons: [],
    statusDistribution: {},
    topSymbols: [],
  };

  const topReason = stats.topReasons[0]?.reason
    ? REASON_CATEGORIES.find((r) => r.key === stats.topReasons[0].reason)?.label || stats.topReasons[0].reason
    : "None yet";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold font-jakarta text-foreground">No-Trade Journal</h1>
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-xs">
              {stats.totalObservations} Observations
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log market situations where you monitored setups but exercised discipline or avoided low-probability entries.
          </p>
        </div>

        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-9 gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Log Observation</span>
        </Button>
      </div>

      {/* Behavioral Analytics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border border-border rounded-xl shadow-xs p-4">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Total Observations
          </div>
          <div className="mt-1 text-2xl font-bold font-jakarta text-foreground">
            {stats.totalObservations}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Separate from trade ledger</div>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-xs p-4">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Top Avoidance Reason
          </div>
          <div className="mt-1 text-base font-bold font-jakarta text-foreground truncate" title={topReason}>
            {topReason}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.topReasons[0]?.count ? `${stats.topReasons[0].count} setups avoided` : "No data"}
          </div>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-xs p-4">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Status Breakdown
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-bold text-amber-500">
              {stats.statusDistribution?.observing || 0} Obs
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-sm font-bold text-rose-500">
              {stats.statusDistribution?.rejected || 0} Rej
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-sm font-bold text-blue-500">
              {stats.statusDistribution?.missed || 0} Miss
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Discipline & opportunity tracking</div>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-xs p-4">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Most Observed Pair
          </div>
          <div className="mt-1 text-base font-bold font-mono text-foreground">
            {stats.topSymbols[0]?.symbol || "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.topSymbols[0]?.count ? `${stats.topSymbols[0].count} observations recorded` : "—"}
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground ml-1" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search observations, key levels, notes..."
            className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 shadow-none px-1"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reason Filter */}
          <select
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-hidden"
          >
            <option value="all">All Reasons</option>
            {REASON_CATEGORIES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            {OBSERVATION_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Bias Filter */}
          <select
            value={bias}
            onChange={(e) => setBias(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-hidden"
          >
            <option value="all">All Biases</option>
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
      </div>

      {/* Observations Feed */}
      <Card className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <EyeOff className="h-6 w-6" />
            </div>
            <div className="font-semibold text-foreground text-base">No observations recorded yet</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Recording situations where you consciously refrained from trading builds patience, adherence, and market awareness.
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs mt-2"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Log First Observation
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {items.map((entry) => {
              const reasonLabel =
                REASON_CATEGORIES.find((r) => r.key === entry.reasonCategory)?.label || entry.reasonCategory;
              const dateStr = entry.date
                ? new Date(entry.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—";

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="p-4 hover:bg-muted/30 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold font-mono text-sm text-foreground">
                        {entry.instrumentSymbol}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase font-semibold px-1.5 py-0",
                          entry.bias === "bullish"
                            ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                            : entry.bias === "bearish"
                              ? "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                              : "border-border text-muted-foreground bg-muted/40"
                        )}
                      >
                        {entry.bias}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground">
                        {entry.session?.replace("_", " ").toUpperCase() || "SESSION"}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{dateStr}</span>
                    </div>

                    <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {entry.title || "Market Observation"}
                    </div>

                    {entry.observation && (
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-2xl leading-relaxed">
                        {entry.observation}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                        Reason: {reasonLabel}
                      </Badge>
                      {entry.conditionMissing && (
                        <span className="text-[11px] text-muted-foreground italic truncate max-w-xs">
                          Missing: {entry.conditionMissing}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Badge variant="secondary" className="text-[11px] capitalize font-medium">
                      {entry.status.replace("_", " ")}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Creation Modal */}
      <NoTradeDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Detail Inspection Modal */}
      {selectedEntry && (
        <NoTradeDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onArchive={() => archiveMutation.mutate({ id: selectedEntry.id, action: "archive" })}
        />
      )}
    </div>
  );
}

function NoTradeDetailModal({
  entry,
  onClose,
  onArchive,
}: {
  entry: any;
  onClose: () => void;
  onArchive: () => void;
}) {
  const reasonLabel =
    REASON_CATEGORIES.find((r) => r.key === entry.reasonCategory)?.label || entry.reasonCategory;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <Card className="bg-card border-border max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-foreground">{entry.instrumentSymbol}</span>
            <Badge variant="outline" className="text-xs uppercase font-semibold">
              {entry.bias}
            </Badge>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-medium px-2 py-1"
          >
            ✕
          </button>
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground font-jakarta">
            {entry.title || "Market Observation Details"}
          </h2>
          <div className="text-xs text-muted-foreground mt-0.5">
            Recorded on {new Date(entry.date).toLocaleString()}
          </div>
        </div>

        {/* Reason highlight */}
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-1">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Why No Trade Was Taken
          </div>
          <div className="text-sm font-medium text-foreground">{reasonLabel}</div>
          {entry.reasonNotes && <p className="text-xs text-muted-foreground">{entry.reasonNotes}</p>}
        </div>

        {/* Observation text */}
        {entry.observation && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Market Behavior & Structure
            </div>
            <p className="text-xs text-foreground bg-muted/30 p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
              {entry.observation}
            </p>
          </div>
        )}

        {/* Key conditions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {entry.conditionMissing && (
            <div className="p-2.5 rounded-lg border border-border bg-card">
              <span className="font-semibold text-muted-foreground block mb-0.5">Missing Criterion:</span>
              <span className="text-foreground">{entry.conditionMissing}</span>
            </div>
          )}
          {entry.wouldHaveValidated && (
            <div className="p-2.5 rounded-lg border border-border bg-card">
              <span className="font-semibold text-muted-foreground block mb-0.5">Validation Trigger:</span>
              <span className="text-foreground">{entry.wouldHaveValidated}</span>
            </div>
          )}
        </div>

        {/* Psychology Notes */}
        {entry.psychologyNotes && (
          <div className="p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 space-y-1">
            <div className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              Psychology & Restraint Reflection
            </div>
            <p className="text-xs text-foreground">{entry.psychologyNotes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onArchive}
            className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive Observation
          </Button>

          <Button type="button" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
