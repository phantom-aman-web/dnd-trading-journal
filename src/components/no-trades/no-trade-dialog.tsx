"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useNav } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { syncEngine } from "@/lib/offline-sync-engine";
import { toast } from "sonner";
import {
  generateTempId,
  optimisticInsert,
  reconcileTempId,
  notifyOptimisticFailure,
} from "@/lib/optimistic";
import {
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Compass,
  Tag,
  Brain,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const REASON_CATEGORIES = [
  { key: "no_valid_setup", label: "No Valid Setup" },
  { key: "poor_rr", label: "Poor Risk-to-Reward" },
  { key: "confirmation_missing", label: "Confirmation Missing" },
  { key: "news_risk", label: "High Impact News Risk" },
  { key: "unclear_structure", label: "Unclear Market Structure" },
  { key: "spread_high", label: "Spread / Slippage Too High" },
  { key: "daily_loss_reached", label: "Daily Risk Limit Reached" },
  { key: "limit_reached", label: "Personal Max Trades Reached" },
  { key: "emotional_psychological", label: "Emotional / Psychological Reason" },
  { key: "other", label: "Other / Discretionary" },
] as const;

export const OBSERVATION_STATUSES = [
  { key: "observing", label: "Observing" },
  { key: "waiting_confirmation", label: "Waiting for Confirmation" },
  { key: "rejected", label: "Setup Rejected" },
  { key: "missed", label: "Missed Opportunity" },
  { key: "invalidated", label: "Invalidated" },
  { key: "completed", label: "Observation Complete" },
] as const;

interface NoTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  onSuccess?: () => void;
}

export function NoTradeDialog({ open, onOpenChange, initialData, onSuccess }: NoTradeDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form State
  const [symbol, setSymbol] = useState(initialData?.instrumentSymbol || "XAUUSD");
  const [bias, setBias] = useState<"bullish" | "bearish" | "neutral">(initialData?.bias || "neutral");
  const [session, setSession] = useState(initialData?.session || "ny_am");
  const [timeframe, setTimeframe] = useState(initialData?.timeframe || "15m");
  const [title, setTitle] = useState(initialData?.title || "");
  const [observation, setObservation] = useState(initialData?.observation || "");
  const [priceLevels, setPriceLevels] = useState(initialData?.priceLevels || "");
  const [marketStructure, setMarketStructure] = useState(initialData?.marketStructure || "");
  const [setupIdentified, setSetupIdentified] = useState(initialData?.setupIdentified || "");
  const [reasonCategory, setReasonCategory] = useState(initialData?.reasonCategory || "confirmation_missing");
  const [reasonNotes, setReasonNotes] = useState(initialData?.reasonNotes || "");
  const [conditionMissing, setConditionMissing] = useState(initialData?.conditionMissing || "");
  const [wouldHaveValidated, setWouldHaveValidated] = useState(initialData?.wouldHaveValidated || "");
  const [status, setStatus] = useState(initialData?.status || "observing");
  const [decisionType, setDecisionType] = useState<"deliberate_avoidance" | "missed" | "rejected" | "not_ready">(
    initialData?.decisionType || "deliberate_avoidance"
  );
  const [psychologyNotes, setPsychologyNotes] = useState(initialData?.psychologyNotes || "");
  const [tagsInput, setTagsInput] = useState(
    initialData?.tagsJson ? JSON.parse(initialData.tagsJson).join(", ") : ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) {
      toast.error("Please provide an instrument symbol");
      return;
    }

    setLoading(true);

    const tags = tagsInput
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    const payload = {
      instrumentSymbol: symbol.toUpperCase().trim(),
      bias,
      session,
      timeframe,
      title: title.trim() || `Observation on ${symbol.toUpperCase().trim()}`,
      observation: observation.trim(),
      priceLevels: priceLevels.trim(),
      marketStructure: marketStructure.trim(),
      setupIdentified: setupIdentified.trim(),
      reasonCategory,
      reasonNotes: reasonNotes.trim(),
      conditionMissing: conditionMissing.trim(),
      wouldHaveValidated: wouldHaveValidated.trim(),
      status,
      decisionType,
      psychologyNotes: psychologyNotes.trim(),
      tags,
    };

    try {
      if (!navigator.onLine) {
        // Offline mode: queue in IndexedDB
        await syncEngine.queueCreateNoTrade(payload, user?.id || "offline_user");
        toast.success("Saved observation locally in Offline Mode.");
        queryClient.invalidateQueries({ queryKey: ["no-trades"] });
        queryClient.invalidateQueries({ queryKey: ["no-trades-in-log"] });
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      // Optimistic insertion
      const prevNoTrades = queryClient.getQueriesData({ queryKey: ["no-trades"] });
      const prevInLog = queryClient.getQueriesData({ queryKey: ["no-trades-in-log"] });
      const tempId = generateTempId("notrade");
      const optimisticObservation = {
        id: tempId,
        userId: user?.id || "local",
        ...payload,
        timestamp: new Date().toISOString(),
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueriesData({ queryKey: ["no-trades"] }, (old: any) =>
        optimisticInsert(old, optimisticObservation)
      );
      queryClient.setQueriesData({ queryKey: ["no-trades-in-log"] }, (old: any) =>
        optimisticInsert(old, optimisticObservation)
      );

      toast.success("No-Trade observation recorded successfully.");
      onOpenChange(false);
      onSuccess?.();

      const res = await fetch("/api/no-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || "Failed to save observation");
      }

      const realData = await res.json();
      if (realData?.id) {
        queryClient.setQueriesData({ queryKey: ["no-trades"] }, (old: any) =>
          reconcileTempId(old, tempId, realData)
        );
        queryClient.setQueriesData({ queryKey: ["no-trades-in-log"] }, (old: any) =>
          reconcileTempId(old, tempId, realData)
        );
      }
      queryClient.invalidateQueries({ queryKey: ["no-trades"] });
      queryClient.invalidateQueries({ queryKey: ["no-trades-in-log"] });
    } catch (err: any) {
      notifyOptimisticFailure(err, "Failed to record observation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border text-foreground p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <EyeOff className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-jakarta">Log No-Trade Observation</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Record deliberate restraint, missed setups, or market conditions that kept you out of the market.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Row 1: Symbol, Bias, Session, Timeframe */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Instrument
              </label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. XAUUSD"
                className="mt-1 h-8 text-xs uppercase font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Directional Bias
              </label>
              <select
                value={bias}
                onChange={(e) => setBias(e.target.value as any)}
                className="mt-1 w-full h-8 px-2 rounded-md bg-background border border-border text-xs font-medium text-foreground focus:outline-hidden"
              >
                <option value="bullish">🟢 Bullish</option>
                <option value="bearish">🔴 Bearish</option>
                <option value="neutral">⚪ Neutral / Ranging</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Session
              </label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="mt-1 w-full h-8 px-2 rounded-md bg-background border border-border text-xs font-medium text-foreground focus:outline-hidden"
              >
                <option value="london">London Open</option>
                <option value="ny_am">New York AM</option>
                <option value="ny_pm">New York PM</option>
                <option value="asia">Asian Session</option>
                <option value="custom">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Timeframe
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="mt-1 w-full h-8 px-2 rounded-md bg-background border border-border text-xs font-medium text-foreground focus:outline-hidden"
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">Daily</option>
              </select>
            </div>
          </div>

          {/* Row 2: Title & Setup Identified */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Observation Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. London Sweep without displacement"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Setup Model Monitored
              </label>
              <Input
                value={setupIdentified}
                onChange={(e) => setSetupIdentified(e.target.value)}
                placeholder="e.g. ICT Silver Bullet / FVG Rejection"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          {/* Row 3: Decision & Reason Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-border/80 bg-muted/20">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                Primary Reason No Trade Was Taken
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="mt-1.5 w-full h-8 px-2 rounded-md bg-card border border-border text-xs font-medium text-foreground focus:outline-hidden"
              >
                {REASON_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Observation Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1.5 w-full h-8 px-2 rounded-md bg-card border border-border text-xs font-medium text-foreground focus:outline-hidden"
              >
                {OBSERVATION_STATUSES.map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Observation Details & Price Levels */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Market Behavior & Structure Observed
            </label>
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Describe what the market was doing, liquidity sweeps, orderflow dynamics, or reactions..."
              className="min-h-[70px] text-xs resize-y"
            />
          </div>

          {/* Missing Condition & What Would Have Validated */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Exact Condition Missing
              </label>
              <Input
                value={conditionMissing}
                onChange={(e) => setConditionMissing(e.target.value)}
                placeholder="e.g. No 5m MSS body close"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                What Would Have Made Setup Valid
              </label>
              <Input
                value={wouldHaveValidated}
                onChange={(e) => setWouldHaveValidated(e.target.value)}
                placeholder="e.g. Retracement into OTE before 10:30 AM"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          {/* Psychology & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Brain className="h-3.5 w-3.5 text-indigo-400" />
                Psychology & Restraint Reflection
              </label>
              <Input
                value={psychologyNotes}
                onChange={(e) => setPsychologyNotes(e.target.value)}
                placeholder="e.g. Felt FOMO but stuck to the checklist"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                Tags (comma separated)
              </label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. ICT, disciplined, news_avoidance"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Observation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
