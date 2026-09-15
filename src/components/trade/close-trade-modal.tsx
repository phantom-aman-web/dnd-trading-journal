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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatSignedCents, formatR } from "@/lib/money";
import { dToNumber } from "@/lib/decimal";
import { useQueryClient } from "@tanstack/react-query";

interface CloseTradeModalProps {
  tradeId: string | null;
  onClose: () => void;
}

interface TradeData {
  id: string;
  instrumentSymbol: string;
  direction: string;
  status: string;
  positionSize: string | null;
  entryPriceAvg: string | null;
  plannedEntryPrice: string | null;
  plannedStopPrice: string | null;
  plannedTargetPrice: string | null;
  plannedRiskAmountCents: number | null;
  netPnlCents: number;
  actualR: string | null;
  feesCents: number;
  commissionCents: number;
  swapCents: number;
  slippageCents: number;
  entryTime: string | null;
  executions: { id: string; kind: string; price: string; quantity: string }[];
  account: { currency: string } | null;
}

export function CloseTradeModal({ tradeId, onClose }: CloseTradeModalProps) {
  const qc = useQueryClient();
  const [trade, setTrade] = useState<TradeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [exitPrice, setExitPrice] = useState("");
  const [exitQty, setExitQty] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [fees, setFees] = useState("0");
  const [commission, setCommission] = useState("0");
  const [swap, setSwap] = useState("0");
  const [slippage, setSlippage] = useState("0");
  const [notes, setNotes] = useState("");

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
        // Pre-fill form
        const now = new Date();
        setExitDate(now.toISOString().slice(0, 10));
        setExitTime(now.toTimeString().slice(0, 5));
        setFees(String(data.feesCents ? (data.feesCents / 100).toFixed(2) : "0"));
        setCommission(String(data.commissionCents ? (data.commissionCents / 100).toFixed(2) : "0"));
        setSwap(String(data.swapCents ? (data.swapCents / 100).toFixed(2) : "0"));
        setSlippage(String(data.slippageCents ? (data.slippageCents / 100).toFixed(2) : "0"));

        // Calculate remaining quantity from existing exits
        const entryFills = (data.executions || []).filter((e: any) => e.kind === "entry");
        const exitFills = (data.executions || []).filter((e: any) => e.kind === "exit");
        const totalEntry = entryFills.reduce((s: number, e: any) => s + parseFloat(e.quantity || "0"), 0);
        const totalExit = exitFills.reduce((s: number, e: any) => s + parseFloat(e.quantity || "0"), 0);
        const remaining = totalEntry - totalExit;
        setExitQty(String(remaining > 0 ? remaining : totalEntry));
      })
      .catch(() => {
        toast.error("Network error loading trade.");
        onClose();
      })
      .finally(() => setLoading(false));
  }, [tradeId, onClose]);

  // Live summary calculations
  const summary = useMemo(() => {
    if (!trade) return null;

    const entryPrice = trade.entryPriceAvg ?? trade.plannedEntryPrice;
    const exPrice = parseFloat(exitPrice) || 0;
    const qty = parseFloat(exitQty) || 0;
    const totalEntryQty = (trade.executions || [])
      .filter((e) => e.kind === "entry")
      .reduce((s, e) => s + parseFloat(e.quantity || "0"), 0);
    const totalExitQty = (trade.executions || [])
      .filter((e) => e.kind === "exit")
      .reduce((s, e) => s + parseFloat(e.quantity || "0"), 0);
    const remainingBefore = totalEntryQty - totalExitQty;
    const remainingAfter = remainingBefore - qty;
    const isFullClose = remainingAfter <= 0.0001;

    // Estimated P&L for this exit portion
    const direction = trade.direction === "long" ? 1 : -1;
    const priceDiff = (exPrice - parseFloat(entryPrice || "0")) * direction;
    const estimatedPnl = priceDiff * qty;

    // Estimated R
    const riskAmount = trade.plannedRiskAmountCents ?? 0;
    const estimatedR = riskAmount > 0 ? estimatedPnl / (riskAmount / 100) : 0;

    return {
      entryPrice: entryPrice ?? "—",
      exitPrice: exPrice || "—",
      qty,
      remainingBefore,
      remainingAfter: Math.max(0, remainingAfter),
      isFullClose,
      estimatedPnl,
      estimatedR,
      direction: trade.direction,
      symbol: trade.instrumentSymbol,
    };
  }, [trade, exitPrice, exitQty]);

  async function handleSubmit() {
    if (!trade || !summary) return;

    // Validation
    if (!exitPrice || parseFloat(exitPrice) <= 0) {
      toast.error("Please enter a valid exit price.");
      return;
    }
    if (!exitQty || parseFloat(exitQty) <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }
    if (summary.remainingAfter < -0.0001) {
      toast.error("Quantity exceeds remaining position.");
      return;
    }

    setSaving(true);
    try {
      // Build exit execution
      const exitTimestamp = new Date(`${exitDate}T${exitTime}:00`).toISOString();
      const newExit = {
        kind: "exit",
        price: exitPrice,
        quantity: exitQty,
        timestamp: exitTimestamp,
        notes: notes || undefined,
      };

      // Merge with existing executions
      const existingExecs = (trade.executions || []).map((e) => ({
        kind: e.kind,
        price: e.price,
        quantity: e.quantity,
        timestamp: trade.entryTime || new Date().toISOString(),
        notes: undefined,
      }));

      const allExecutions = [...existingExecs, newExit];

      const payload: Record<string, unknown> = {
        executions: allExecutions,
        feesCents: Math.round(parseFloat(fees || "0") * 100),
        commissionCents: Math.round(parseFloat(commission || "0") * 100),
        swapCents: Math.round(parseFloat(swap || "0") * 100),
        slippageCents: Math.round(parseFloat(slippage || "0") * 100),
        exitTime: exitTimestamp,
        status: summary.isFullClose ? undefined : undefined, // Let server derive from executions
      };

      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to close trade.");
        setSaving(false);
        return;
      }

      const result = await res.json();
      toast.success(summary.isFullClose ? "Trade closed." : "Partial exit recorded.");

      // Invalidate all relevant queries
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["trade", trade.id] });

      onClose();
    } catch {
      toast.error("Network error while closing trade.");
      setSaving(false);
    }
  }

  const open = !!tradeId;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Close Trade
            {trade && (
              <Badge variant="outline" className="text-[10px] uppercase">
                {trade.instrumentSymbol}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {summary?.isFullClose
              ? "Close the full remaining position."
              : "Record a partial exit. The trade stays open until fully closed."}
          </DialogDescription>
        </DialogHeader>

        {loading || !trade ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scroll-thin space-y-4">
            {/* Position summary */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Direction</div>
                <div className={cn("text-sm font-semibold", trade.direction === "long" ? "text-profit" : "text-loss")}>
                  {trade.direction === "long" ? "Long" : "Short"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Entry Price</div>
                <div className="text-sm font-semibold tabular-nums">{summary?.entryPrice}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining Qty</div>
                <div className="text-sm font-semibold tabular-nums">{summary?.remainingBefore ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk Amount</div>
                <div className="text-sm font-semibold tabular-nums">
                  {trade.plannedRiskAmountCents ? formatSignedCents(trade.plannedRiskAmountCents).text : "—"}
                </div>
              </div>
            </div>

            {/* Exit fields */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Exit Price *</Label>
                  <Input
                    type="number"
                    step="any"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder="0.00"
                    className="h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Quantity to Close *</Label>
                  <Input
                    type="number"
                    step="any"
                    value={exitQty}
                    onChange={(e) => setExitQty(e.target.value)}
                    placeholder="0"
                    className="h-9 text-sm"
                  />
                  {summary && summary.remainingAfter > 0 && (
                    <p className="text-[10px] text-warning">
                      Partial: {summary.remainingAfter} remaining
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Exit Date</Label>
                  <Input
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Exit Time</Label>
                  <Input
                    type="time"
                    value={exitTime}
                    onChange={(e) => setExitTime(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Costs */}
              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Costs (optional)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">Fees ($)</Label>
                    <Input type="number" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">Commission ($)</Label>
                    <Input type="number" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">Swap ($)</Label>
                    <Input type="number" step="0.01" value={swap} onChange={(e) => setSwap(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">Slippage ($)</Label>
                    <Input type="number" step="0.01" value={slippage} onChange={(e) => setSlippage(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Exit Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why did you close this trade? What happened?"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            {/* Live summary */}
            {summary && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Live Summary
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exit Price:</span>
                    <span className="font-semibold tabular-nums">{summary.exitPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-semibold tabular-nums">{summary.qty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. P&L:</span>
                    <span className={cn("font-semibold tabular-nums", summary.estimatedPnl > 0 ? "text-profit" : summary.estimatedPnl < 0 ? "text-loss" : "")}>
                      {summary.estimatedPnl >= 0 ? "+" : ""}${summary.estimatedPnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. R:</span>
                    <span className={cn("font-semibold tabular-nums", summary.estimatedR > 0 ? "text-profit" : summary.estimatedR < 0 ? "text-loss" : "")}>
                      {formatR(String(summary.estimatedR))}
                    </span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Final Status:</span>
                    <Badge variant="outline" className={cn("text-[10px]", summary.isFullClose ? "text-profit" : "text-warning")}>
                      {summary.isFullClose ? "CLOSED" : "PARTIAL (still open)"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || loading || !trade}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {summary?.isFullClose ? "Close Trade" : "Record Partial Exit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
