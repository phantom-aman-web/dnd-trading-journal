"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNav } from "@/lib/nav-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Eye,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  ExternalLink,
} from "lucide-react";

export type WatchlistStatus = "watching" | "triggered" | "expired" | "invalidated" | "missed";
export type WatchlistOutcome = "reached_target" | "stopped_out" | "missed_entry" | "pending";

export interface WatchlistSetup {
  id: string;
  symbol: string;
  direction: "long" | "short";
  timeframe: string;
  plannedEntry: string;
  invalidationLevel: string;
  targetLevel: string;
  status: WatchlistStatus;
  recordedOutcome: WatchlistOutcome;
  notes: string;
  convertedTradeId?: string | null;
  createdAt: string;
}

export function WatchlistOutcomesTab() {
  const { navigate } = useNav();
  const [setups, setSetups] = useState<WatchlistSetup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch setups from server API
  useEffect(() => {
    let mounted = true;
    async function loadWatchlist() {
      try {
        const res = await fetch("/api/watchlist-outcomes");
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data.items)) {
            setSetups(data.items);
          }
        }
      } catch (err) {
        console.error("Failed to load watchlist from API:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadWatchlist();
    return () => {
      mounted = false;
    };
  }, []);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State
  const [formSymbol, setFormSymbol] = useState("EURUSD");
  const [formDirection, setFormDirection] = useState<"long" | "short">("long");
  const [formTimeframe, setFormTimeframe] = useState("15m");
  const [formEntry, setFormEntry] = useState("");
  const [formInvalidation, setFormInvalidation] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formNotes, setFormNotes] = useState("");

  async function handleCreateSetup() {
    if (!formSymbol || !formEntry) {
      toast.error("Please provide at least a symbol and planned entry price.");
      return;
    }

    const payload = {
      symbol: formSymbol.toUpperCase().trim(),
      direction: formDirection,
      timeframe: formTimeframe,
      plannedEntry: formEntry.trim(),
      invalidationLevel: formInvalidation.trim(),
      targetLevel: formTarget.trim(),
      status: "watching" as WatchlistStatus,
      recordedOutcome: "pending" as WatchlistOutcome,
      notes: formNotes.trim(),
    };

    // Optimistic item
    const tempId = "wl_" + Date.now();
    const optimisticSetup: WatchlistSetup = {
      id: tempId,
      ...payload,
      createdAt: new Date().toISOString(),
    };
    setSetups((prev) => [optimisticSetup, ...prev]);
    setIsCreateModalOpen(false);

    try {
      const res = await fetch("/api/watchlist-outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setSetups((prev) => prev.map((s) => (s.id === tempId ? created : s)));
        toast.success(`Saved ${payload.symbol} setup to database`);
      } else {
        toast.error("Failed to persist setup to server.");
      }
    } catch {
      toast.error("Network error saving setup.");
    }

    setFormSymbol("EURUSD");
    setFormEntry("");
    setFormInvalidation("");
    setFormTarget("");
    setFormNotes("");
  }

  async function handleUpdateStatus(id: string, newStatus: WatchlistStatus) {
    setSetups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );
    try {
      await fetch(`/api/watchlist-outcomes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Updated setup status to ${newStatus}`);
    } catch {
      toast.error("Failed to update status on server.");
    }
  }

  async function handleUpdateOutcome(id: string, newOutcome: WatchlistOutcome) {
    setSetups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, recordedOutcome: newOutcome } : s))
    );
    try {
      await fetch(`/api/watchlist-outcomes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordedOutcome: newOutcome }),
      });
      toast.success(`Recorded outcome: ${newOutcome.replace("_", " ")}`);
    } catch {
      toast.error("Failed to update outcome on server.");
    }
  }

  async function handleDeleteSetup(id: string) {
    setSetups((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/watchlist-outcomes/${id}`, {
        method: "DELETE",
      });
      toast.info("Setup removed from database");
    } catch {
      toast.error("Failed to delete setup on server.");
    }
  }

  async function handleConvertToRealTrade(setup: WatchlistSetup) {
    if (setup.convertedTradeId) {
      toast.info(`Notice: Setup was already converted to trade #${setup.convertedTradeId}. Opening trade form.`);
    }

    // Call convert endpoint to check idempotency and record conversion
    try {
      await fetch(`/api/watchlist-outcomes/${setup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert", status: "triggered" }),
      });
    } catch {}

    toast.success(`Pre-filling new trade with ${setup.symbol} setup parameters`);
    navigate("tradeNew", {
      symbol: setup.symbol,
      direction: setup.direction,
      entry: setup.plannedEntry,
      stop: setup.invalidationLevel,
      target: setup.targetLevel,
      timeframe: setup.timeframe,
      watchlistId: setup.id,
    });
  }

  const filtered = setups.filter((s) =>
    filterStatus === "all" ? true : s.status === filterStatus
  );

  const watchingCount = setups.filter((s) => s.status === "watching").length;
  const triggeredCount = setups.filter((s) => s.status === "triggered").length;
  const reachedTargetCount = setups.filter((s) => s.recordedOutcome === "reached_target").length;
  const conversionRate = setups.length > 0 ? Math.round((triggeredCount / setups.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Overview & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Watchlist &amp; Setup Outcomes (Feature 55)
          </h3>
          <p className="text-xs text-muted-foreground">
            Track planned setups and monitor what happened without executing. Isolated from real trade statistics.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          size="sm"
          className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold h-8 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add Planned Setup
        </Button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-card border border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Actively Watching</div>
          <div className="font-mono font-bold text-lg text-primary mt-0.5">{watchingCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Triggered Setups</div>
          <div className="font-mono font-bold text-lg text-foreground mt-0.5">{triggeredCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Target Reached</div>
          <div className="font-mono font-bold text-lg text-profit mt-0.5">{reachedTargetCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Trigger Rate</div>
          <div className="font-mono font-bold text-lg text-foreground mt-0.5">{conversionRate}%</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {["all", "watching", "triggered", "expired", "invalidated", "missed"].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilterStatus(st)}
            className={cn(
              "px-3 py-1 rounded-md capitalize font-medium transition-colors cursor-pointer border",
              filterStatus === st
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {st} ({st === "all" ? setups.length : setups.filter((s) => s.status === st).length})
          </button>
        ))}
      </div>

      {/* Setups List Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center space-y-2 text-xs text-muted-foreground">
          <Eye className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p>No planned setups under this status filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((setup) => {
            const isLong = setup.direction === "long";
            return (
              <Card key={setup.id} className="relative overflow-hidden border border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-foreground">
                          {setup.symbol}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono uppercase text-[10px] font-bold px-1.5 py-0",
                            isLong ? "bg-profit/15 text-profit border-profit/30" : "bg-loss/15 text-loss border-loss/30"
                          )}
                        >
                          {setup.direction}
                        </Badge>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {setup.timeframe}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Added: {new Date(setup.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "capitalize text-xs font-mono font-semibold",
                          setup.status === "watching"
                            ? "bg-primary/10 text-primary"
                            : setup.status === "triggered"
                            ? "bg-profit/10 text-profit"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {setup.status}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSetup(setup.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-loss cursor-pointer"
                        title="Delete setup"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {/* Price Levels Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50 font-mono text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Entry Level</div>
                      <div className="font-semibold text-foreground">{setup.plannedEntry || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Invalidation</div>
                      <div className="font-semibold text-loss">{setup.invalidationLevel || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Target</div>
                      <div className="font-semibold text-profit">{setup.targetLevel || "—"}</div>
                    </div>
                  </div>

                  {setup.notes && (
                    <p className="text-[11px] text-muted-foreground bg-card/60 p-2 rounded border border-border/40">
                      {setup.notes}
                    </p>
                  )}

                  {/* Status & Outcome Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <Select
                        value={setup.status}
                        onValueChange={(val: any) => handleUpdateStatus(setup.id, val)}
                      >
                        <SelectTrigger className="h-7 text-xs font-mono w-28 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="watching">Watching</SelectItem>
                          <SelectItem value="triggered">Triggered</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="invalidated">Invalidated</SelectItem>
                          <SelectItem value="missed">Missed</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={setup.recordedOutcome}
                        onValueChange={(val: any) => handleUpdateOutcome(setup.id, val)}
                      >
                        <SelectTrigger className="h-7 text-xs font-mono w-32 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reached_target">Reached Target</SelectItem>
                          <SelectItem value="stopped_out">Stopped Out</SelectItem>
                          <SelectItem value="missed_entry">Missed Entry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 1-Click Convert to Real Trade */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConvertToRealTrade(setup)}
                      className="h-7 text-xs gap-1 text-primary hover:text-primary cursor-pointer shrink-0"
                    >
                      Convert to Real Trade <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Setup Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add Planned Setup to Watchlist</DialogTitle>
            <DialogDescription className="text-xs">
              Record a potential trade idea. Watchlist setups are strictly isolated from real executed trades.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Symbol</Label>
                <Input
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  placeholder="EURUSD, XAUUSD..."
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Direction</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormDirection("long")}
                    className={cn(
                      "h-8 rounded text-xs font-semibold border transition-colors",
                      formDirection === "long" ? "bg-profit/15 text-profit border-profit/40" : "border-border text-muted-foreground"
                    )}
                  >
                    LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDirection("short")}
                    className={cn(
                      "h-8 rounded text-xs font-semibold border transition-colors",
                      formDirection === "short" ? "bg-loss/15 text-loss border-loss/40" : "border-border text-muted-foreground"
                    )}
                  >
                    SHORT
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Planned Entry</Label>
                <Input
                  value={formEntry}
                  onChange={(e) => setFormEntry(e.target.value)}
                  placeholder="1.08250"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Stop / Invalidation</Label>
                <Input
                  value={formInvalidation}
                  onChange={(e) => setFormInvalidation(e.target.value)}
                  placeholder="1.07980"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Target Level</Label>
                <Input
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  placeholder="1.08900"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Timeframe</Label>
              <Input
                value={formTimeframe}
                onChange={(e) => setFormTimeframe(e.target.value)}
                placeholder="5m, 15m, 1h, 4h..."
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Setup Thesis &amp; Context</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Key levels, liquidity sweeps, catalyst, confluence factors..."
                className="text-xs min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateSetup} className="bg-primary text-primary-foreground font-semibold">
              Save Setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
