"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface ExecuteTradeModalProps {
  tradeId: string | null;
  onClose: () => void;
}

interface TradeData {
  id: string;
  instrumentSymbol: string;
  direction: string;
  status: string;
  plannedEntryPrice: string | null;
  plannedStopPrice: string | null;
  plannedTargetPrice: string | null;
  plannedRiskPct: string | null;
  positionSize: string | null;
  entryTime: string | null;
  strategy?: { name: string } | null;
}

export function ExecuteTradeModal({ tradeId, onClose }: ExecuteTradeModalProps) {
  const qc = useQueryClient();
  const [trade, setTrade] = useState<TradeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [actualEntry, setActualEntry] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [execDate, setExecDate] = useState("");
  const [execTime, setExecTime] = useState("");

  useEffect(() => {
    if (!tradeId) {
      setTrade(null);
      return;
    }
    setLoading(true);
    fetch(`/api/trades/${tradeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) {
          toast.error("Failed to load trade.");
          onClose();
          return;
        }
        setTrade(data);
        setActualEntry(data.plannedEntryPrice ?? "");
        setActualQty(data.positionSize ?? "1");
        const now = new Date();
        setExecDate(now.toISOString().slice(0, 10));
        setExecTime(now.toTimeString().slice(0, 5));
      })
      .catch(() => {
        toast.error("Network error loading trade.");
        onClose();
      })
      .finally(() => setLoading(false));
  }, [tradeId, onClose]);

  async function handleExecute() {
    if (!trade) return;
    if (!actualEntry || parseFloat(actualEntry) <= 0) {
      toast.error("Please enter a valid entry price.");
      return;
    }
    if (!actualQty || parseFloat(actualQty) <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    setSaving(true);
    try {
      const execTimestamp = new Date(`${execDate}T${execTime}:00`).toISOString();

      // Build entry execution with actual values
      const entryExecution = {
        kind: "entry",
        price: actualEntry,
        quantity: actualQty,
        timestamp: execTimestamp,
      };

      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executions: [entryExecution],
          status: "open",
          entryTime: execTimestamp,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to execute trade.");
        setSaving(false);
        return;
      }

      toast.success("Trade executed — now open.");

      // Invalidate all relevant queries
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["trade", trade.id] });

      onClose();
    } catch {
      toast.error("Network error while executing trade.");
      setSaving(false);
    }
  }

  const open = !!tradeId;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Execute Trade
            {trade && (
              <Badge variant="outline" className="text-[10px] uppercase">
                {trade.instrumentSymbol}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Confirm your actual execution details. The planned values are preserved.
          </DialogDescription>
        </DialogHeader>

        {loading || !trade ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scroll-thin space-y-4">
            {/* Planned values summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Planned Values
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Direction:</span>
                  <span className={cn("font-semibold", trade.direction === "long" ? "text-profit" : "text-loss")}>
                    {trade.direction === "long" ? "Long" : "Short"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planned Entry:</span>
                  <span className="font-semibold tabular-nums">{trade.plannedEntryPrice ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stop:</span>
                  <span className="font-semibold tabular-nums">{trade.plannedStopPrice ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target:</span>
                  <span className="font-semibold tabular-nums">{trade.plannedTargetPrice ?? "—"}</span>
                </div>
                {trade.strategy?.name && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Strategy:</span>
                    <span className="font-semibold">{trade.strategy.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actual execution fields */}
            <div className="space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Actual Execution
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Actual Entry Price *</Label>
                  <Input
                    type="number"
                    step="any"
                    value={actualEntry}
                    onChange={(e) => setActualEntry(e.target.value)}
                    placeholder="0.00"
                    className="h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Quantity *</Label>
                  <Input
                    type="number"
                    step="any"
                    value={actualQty}
                    onChange={(e) => setActualQty(e.target.value)}
                    placeholder="1"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Execution Date</Label>
                  <Input
                    type="date"
                    value={execDate}
                    onChange={(e) => setExecDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Execution Time</Label>
                  <Input
                    type="time"
                    value={execTime}
                    onChange={(e) => setExecTime(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              The trade will change from Planned to Open. Planned values are preserved for comparison.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExecute} disabled={saving || loading || !trade}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start Trade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
