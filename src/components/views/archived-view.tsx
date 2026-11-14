"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatSignedCents } from "@/lib/money";
import { useNav } from "@/lib/nav-store";
import {
  Archive,
  RotateCcw,
  Trash2,
  TrendingUp,
  TrendingDown,
  Layers,
  Wallet,
  EyeOff,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ArchivedView() {
  const queryClient = useQueryClient();
  const { navigate } = useNav();
  const [activeTab, setActiveTab] = useState("trades");

  const { data, isLoading } = useQuery({
    queryKey: ["archived-records"],
    queryFn: async () => {
      const res = await fetch("/api/archive", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load archived records");
      return res.json();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ entityType, id }: { entityType: "trade" | "account" | "strategy" | "noTrade"; id: string }) => {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, id, action: "restore" }),
      });
      if (!res.ok) throw new Error("Failed to restore record");
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.entityType.toUpperCase()} restored to active workspace.`);
      queryClient.invalidateQueries({ queryKey: ["archived-records"] });
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["no-trades"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to restore record"),
  });

  const trades: any[] = data?.trades || [];
  const accounts: any[] = data?.accounts || [];
  const strategies: any[] = data?.strategies || [];
  const noTrades: any[] = data?.noTrades || [];
  const totalArchived = data?.totalArchived || 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold font-jakarta text-foreground">Archived Records</h1>
            <Badge variant="outline" className="border-border text-muted-foreground font-mono text-xs">
              {totalArchived} Archived Items
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Archived records are kept safe and intact without altering your historical calculations or relationships. Restore them anytime.
          </p>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-0.5">
          <strong className="text-foreground font-semibold">Reversible Archiving Safety: </strong>
          Archiving is non-destructive. Archived accounts preserve their trades and equity, archived setups preserve historical executions and version diffs, and archived trades continue informing your long-term aggregate statistics unless explicitly excluded.
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border border-border rounded-lg">
          <TabsTrigger value="trades" className="text-xs gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Archived Trades ({trades.length})
          </TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Archived Accounts ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="strategies" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Archived Setups ({strategies.length})
          </TabsTrigger>
          <TabsTrigger value="noTrades" className="text-xs gap-1.5">
            <EyeOff className="h-3.5 w-3.5" /> Archived Observations ({noTrades.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Archived Trades */}
        <TabsContent value="trades" className="mt-0 space-y-3">
          <Card className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : trades.length === 0 ? (
              <EmptyArchiveState label="No archived trades." />
            ) : (
              <div className="divide-y divide-border/60">
                {trades.map((t) => {
                  const pnl = formatSignedCents(t.netPnlCents);
                  return (
                    <div
                      key={t.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold font-mono text-sm text-foreground">
                            {t.instrumentSymbol}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {t.direction}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {t.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {t.entryTime ? new Date(t.entryTime).toLocaleDateString() : "—"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Account: {t.account?.name || "Default"} · Setup: {t.strategy?.name || "Discretionary"}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div
                          className={cn(
                            "text-sm font-bold font-mono text-right",
                            pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground"
                          )}
                        >
                          {pnl.text}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate({ entityType: "trade", id: t.id })}
                          className="text-xs h-7 gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Restore</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Archived Accounts */}
        <TabsContent value="accounts" className="mt-0 space-y-3">
          <Card className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : accounts.length === 0 ? (
              <EmptyArchiveState label="No archived accounts." />
            ) : (
              <div className="divide-y divide-border/60">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{acc.name}</span>
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {acc.accountType}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {acc.currency}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {acc._count?.trades || 0} associated historical trades retained.
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate({ entityType: "account", id: acc.id })}
                      className="text-xs h-7 gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restore Account</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 3: Archived Strategies */}
        <TabsContent value="strategies" className="mt-0 space-y-3">
          <Card className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : strategies.length === 0 ? (
              <EmptyArchiveState label="No archived setups." />
            ) : (
              <div className="divide-y divide-border/60">
                {strategies.map((strat) => (
                  <div
                    key={strat.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{strat.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {strat._count?.versions || 1} Versions
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {strat._count?.trades || 0} trades attributed. Definitions and rules preserved.
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate({ entityType: "strategy", id: strat.id })}
                      className="text-xs h-7 gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restore Setup</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 4: Archived Observations */}
        <TabsContent value="noTrades" className="mt-0 space-y-3">
          <Card className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : noTrades.length === 0 ? (
              <EmptyArchiveState label="No archived market observations." />
            ) : (
              <div className="divide-y divide-border/60">
                {noTrades.map((obs) => (
                  <div
                    key={obs.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm text-foreground">
                          {obs.instrumentSymbol}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {obs.reasonCategory}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {obs.date ? new Date(obs.date).toLocaleDateString() : "—"}
                        </span>
                      </div>
                      {obs.observation && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{obs.observation}</p>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate({ entityType: "noTrade", id: obs.id })}
                      className="text-xs h-7 gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restore Observation</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyArchiveState({ label }: { label: string }) {
  return (
    <div className="p-10 text-center space-y-2">
      <Archive className="h-6 w-6 text-muted-foreground mx-auto" />
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <p className="text-[11px] text-muted-foreground">
        When you archive items from the active workspace, they will appear here safely stored.
      </p>
    </div>
  );
}
