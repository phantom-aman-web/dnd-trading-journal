"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  PencilLine,
  Target,
  TrendingDown,
  CalendarDays,
  Percent,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatSignedCents } from "@/lib/money";
import { toast } from "sonner";
import type { PropChallengeMetrics } from "@/lib/prop-firm-engine";

interface PropChallengeWithMetrics {
  id: string;
  name: string;
  propFirm: string;
  stage: string;
  status: string;
  startingBalanceCents: number;
  profitTargetCents: number | null;
  dailyLossLimitCents: number | null;
  dailyLossLimitPct: number | null;
  maxDrawdownCents: number | null;
  maxDrawdownPct: number | null;
  drawdownType: string;
  minTradingDays: number | null;
  maxTradingDays: number | null;
  resetTimezone: string;
  resetHour: number;
  startDate: string;
  notes: string | null;
  account: {
    id: string;
    name: string;
    currency: string;
  };
  metrics: PropChallengeMetrics;
}

interface PropChallengesSectionProps {
  accounts: { id: string; name: string; accountType: string; startingBalanceCents: number }[];
  hideHeader?: boolean;
}

export function PropChallengesSection({ accounts, hideHeader = false }: PropChallengesSectionProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [name, setName] = useState("");
  const [propFirm, setPropFirm] = useState("FTMO");
  const [stage, setStage] = useState("phase1");
  const [startingBalance, setStartingBalance] = useState("100000");
  const [profitTargetPct, setProfitTargetPct] = useState("10");
  const [dailyLossLimitPct, setDailyLossLimitPct] = useState("5");
  const [maxDrawdownPct, setMaxDrawdownPct] = useState("10");
  const [drawdownType, setDrawdownType] = useState("static");
  const [minTradingDays, setMinTradingDays] = useState("4");
  const [resetTimezone, setResetTimezone] = useState("America/New_York");
  const [resetHour, setResetHour] = useState("17");
  const [consistencyRuleType, setConsistencyRuleType] = useState("single_day_max");
  const [consistencyThresholdPct, setConsistencyThresholdPct] = useState("50");
  const [consistencyAction, setConsistencyAction] = useState<
    "dilution_required" | "warning" | "payout_restricted" | "hard_breach"
  >("dilution_required");

  const { data, isLoading } = useQuery<{ items: PropChallengeWithMetrics[] }>({
    queryKey: ["prop-challenges"],
    queryFn: async () => {
      const res = await fetch("/api/prop-challenges", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load prop challenges");
      return res.json();
    },
  });

  const challenges = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/prop-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to create challenge");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Prop firm challenge created");
      queryClient.invalidateQueries({ queryKey: ["prop-challenges"] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/prop-challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to update challenge");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Prop firm challenge updated");
      queryClient.invalidateQueries({ queryKey: ["prop-challenges"] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prop-challenges/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete challenge");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Challenge tracker deleted");
      queryClient.invalidateQueries({ queryKey: ["prop-challenges"] });
    },
  });

  function resetForm() {
    setEditingId(null);
    setName("");
    setPropFirm("FTMO");
    setStage("phase1");
    setStartingBalance("100000");
    setProfitTargetPct("10");
    setDailyLossLimitPct("5");
    setMaxDrawdownPct("10");
    setDrawdownType("static");
    setMinTradingDays("4");
    setResetTimezone("America/New_York");
    setResetHour("17");
    setConsistencyRuleType("single_day_max");
    setConsistencyThresholdPct("50");
    setConsistencyAction("dilution_required");
  }

  function handleOpenCreate() {
    resetForm();
    if (accounts.length > 0) {
      setAccountId(accounts[0].id);
      setStartingBalance((accounts[0].startingBalanceCents / 100).toString());
    }
    setIsModalOpen(true);
  }

  function handleOpenEdit(c: PropChallengeWithMetrics) {
    setEditingId(c.id);
    setAccountId(c.account?.id || accounts[0]?.id || "");
    setName(c.name || "");
    setPropFirm(c.propFirm || "FTMO");
    setStage(c.stage || "phase1");
    setStartingBalance((c.startingBalanceCents / 100).toString());
    setProfitTargetPct(
      c.profitTargetCents && c.startingBalanceCents > 0
        ? ((c.profitTargetCents / c.startingBalanceCents) * 100).toString()
        : "10"
    );
    setDailyLossLimitPct(c.dailyLossLimitPct ? c.dailyLossLimitPct.toString() : "5");
    setMaxDrawdownPct(c.maxDrawdownPct ? c.maxDrawdownPct.toString() : "10");
    setDrawdownType(c.drawdownType || "static");
    setMinTradingDays(c.minTradingDays ? c.minTradingDays.toString() : "4");
    setResetTimezone(c.resetTimezone || "America/New_York");
    setResetHour(c.resetHour !== undefined ? c.resetHour.toString() : "17");
    setConsistencyRuleType(c.metrics.consistencyRuleType || "single_day_max");
    setConsistencyThresholdPct(
      c.metrics.consistencyThresholdPct ? c.metrics.consistencyThresholdPct.toString() : "50"
    );
    setConsistencyAction(
      (c.metrics as any).consistencyAction || "dilution_required"
    );
    setIsModalOpen(true);
  }

  function applyPreset(preset: "ftmo" | "apex" | "fundednext") {
    if (preset === "ftmo") {
      setPropFirm("FTMO");
      setName("FTMO $100K Phase 1");
      setStage("phase1");
      setStartingBalance("100000");
      setProfitTargetPct("10");
      setDailyLossLimitPct("5");
      setMaxDrawdownPct("10");
      setDrawdownType("static");
      setMinTradingDays("4");
      setResetHour("17");
      setResetTimezone("America/New_York");
      setConsistencyRuleType("single_day_max");
      setConsistencyThresholdPct("50");
      setConsistencyAction("dilution_required");
    } else if (preset === "apex") {
      setPropFirm("Apex");
      setName("Apex $50K Evaluation");
      setStage("evaluation");
      setStartingBalance("50000");
      setProfitTargetPct("6");
      setDailyLossLimitPct("0");
      setMaxDrawdownPct("5");
      setDrawdownType("trailing");
      setMinTradingDays("7");
      setResetHour("17");
      setResetTimezone("America/Chicago");
      setConsistencyRuleType("single_day_max");
      setConsistencyThresholdPct("30");
      setConsistencyAction("dilution_required");
    } else if (preset === "fundednext") {
      setPropFirm("FundedNext");
      setName("FundedNext Stellar $100K");
      setStage("phase1");
      setStartingBalance("100000");
      setProfitTargetPct("8");
      setDailyLossLimitPct("5");
      setMaxDrawdownPct("10");
      setDrawdownType("static");
      setMinTradingDays("5");
      setResetHour("0");
      setResetTimezone("UTC");
      setConsistencyRuleType("none");
      setConsistencyThresholdPct("0");
      setConsistencyAction("warning");
    }
  }

  function handleSave() {
    const startBal = parseFloat(startingBalance);
    if (isNaN(startBal) || startBal <= 0) {
      toast.error("Please enter a valid starting balance");
      return;
    }

    const startBalCents = Math.round(startBal * 100);
    const targetPct = parseFloat(profitTargetPct) || null;
    const targetCents = targetPct ? Math.round(startBalCents * (targetPct / 100)) : null;

    const dailyPct = parseFloat(dailyLossLimitPct) || null;
    const dailyCents = dailyPct ? Math.round(startBalCents * (dailyPct / 100)) : null;

    const maxDDPct = parseFloat(maxDrawdownPct) || null;
    const maxDDCents = maxDDPct ? Math.round(startBalCents * (maxDDPct / 100)) : null;

    const consistencyPct = consistencyRuleType !== "none" ? (parseFloat(consistencyThresholdPct) || 50) : null;

    const payload = {
      accountId,
      name: name.trim() || `${propFirm} ${stage.toUpperCase()}`,
      propFirm,
      stage,
      startingBalanceCents: startBalCents,
      profitTargetCents: targetCents,
      dailyLossLimitCents: dailyCents,
      dailyLossLimitPct: dailyPct,
      maxDrawdownCents: maxDDCents,
      maxDrawdownPct: maxDDPct,
      drawdownType,
      minTradingDays: parseInt(minTradingDays, 10) || 4,
      resetTimezone,
      resetHour: parseInt(resetHour, 10) || 17,
      consistencyRuleType,
      consistencyThresholdPct: consistencyPct,
      consistencyAction,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function getStatusBadge(metrics: PropChallengeMetrics) {
    switch (metrics.status) {
      case "passed":
        return <Badge className="bg-profit/15 text-profit border-profit/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Passed</Badge>;
      case "breached":
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1"><AlertTriangle className="h-3 w-3" /> Breached</Badge>;
      case "at_risk":
        return <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30 gap-1"><ShieldAlert className="h-3 w-3" /> At Risk</Badge>;
      case "approaching_limit":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"><AlertTriangle className="h-3 w-3" /> Warning (75%)</Badge>;
      default:
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1">Safe</Badge>;
    }
  }

  return (
    <div className="space-y-4">
      {/* If header is not hidden by parent view, render Section Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Prop Firm Challenge Tracker
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time rule tracking for evaluation challenges and funded accounts.
            </p>
          </div>
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> New Challenge
          </Button>
        </div>
      )}

      {/* If header is hidden, show action toolbar */}
      {hideHeader && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Active Challenges: {challenges.length}
          </span>
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New Challenge
          </Button>
        </div>
      )}

      {challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center space-y-4">
          <Trophy className="h-10 w-10 mx-auto text-amber-500/70 mb-2" />
          <div>
            <h4 className="text-base font-semibold text-foreground">No active challenge trackers</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Track your evaluation rules, daily drawdown reset time, profit targets, and consistency thresholds in real-time.
            </p>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleOpenCreate();
                applyPreset("ftmo");
              }}
              className="gap-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> FTMO 100K 2-Phase
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleOpenCreate();
                applyPreset("apex");
              }}
              className="gap-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Apex 50K Trailing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleOpenCreate();
                applyPreset("fundednext");
              }}
              className="gap-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-500" /> FundedNext Stellar 100K
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges.map((c) => {
            const m = c.metrics;
            const currency = c.account?.currency || "USD";
            const targetPct = m.profitTargetProgressPct ?? 0;
            const dailyPct = m.dailyLossUsedPct ?? 0;
            const ddPct = m.drawdownUsedPct ?? 0;

            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground text-base">{c.name}</h3>
                      {getStatusBadge(m)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.propFirm} · {c.stage.toUpperCase()} · Account: {c.account?.name || "Unlinked"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Edit challenge rules"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete challenge tracker "${c.name}"?`)) {
                          deleteMutation.mutate(c.id);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Delete tracker"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Status reason alert if not safe */}
                {m.status !== "safe" && (
                  <div
                    className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                      m.status === "passed"
                        ? "bg-profit/10 border-profit/20 text-profit"
                        : m.status === "breached"
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {m.status === "passed" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{m.statusReason}</span>
                  </div>
                )}

                {/* Gauges & Rules */}
                <div className="space-y-3 text-xs">
                  {/* Profit Target */}
                  {c.profitTargetCents && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <Target className="h-3.5 w-3.5 text-primary" /> Profit Target
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatSignedCents(m.netProfitCents, currency).text} / {formatSignedCents(c.profitTargetCents, currency).text} ({Math.max(0, targetPct)}%)
                        </span>
                      </div>
                      <Progress value={Math.min(100, Math.max(0, targetPct))} className="h-2" />
                    </div>
                  )}

                  {/* Daily Loss Limit */}
                  {c.dailyLossLimitCents && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="h-3.5 w-3.5 text-amber-500" /> Daily Loss ({m.cycleResetTime})
                        </span>
                        <span className={`font-semibold ${dailyPct >= 90 ? "text-rose-500" : dailyPct >= 75 ? "text-amber-500" : "text-foreground"}`}>
                          ${(m.todayLossCents / 100).toFixed(2)} / ${(c.dailyLossLimitCents / 100).toFixed(2)} ({dailyPct}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, dailyPct)}
                        className={`h-2 ${dailyPct >= 90 ? "[&>div]:bg-rose-500" : dailyPct >= 75 ? "[&>div]:bg-amber-500" : ""}`}
                      />
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                        <span>Buffer Remaining:</span>
                        <span className={`font-mono font-medium ${m.dailyLossBreached ? "text-rose-500" : "text-foreground"}`}>
                          ${((m.remainingDailyLossCents ?? 0) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Maximum Drawdown */}
                  {c.maxDrawdownCents && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> Max Drawdown ({c.drawdownType})
                        </span>
                        <span className={`font-semibold ${ddPct >= 90 ? "text-rose-500" : ddPct >= 75 ? "text-amber-500" : "text-foreground"}`}>
                          ${(m.currentDrawdownCents / 100).toFixed(2)} / ${(c.maxDrawdownCents / 100).toFixed(2)} ({ddPct}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, ddPct)}
                        className={`h-2 ${ddPct >= 90 ? "[&>div]:bg-rose-500" : ddPct >= 75 ? "[&>div]:bg-amber-500" : ""}`}
                      />
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                        <span>Buffer Remaining:</span>
                        <span className={`font-mono font-medium ${m.drawdownBreached ? "text-rose-500" : "text-foreground"}`}>
                          ${((m.remainingDrawdownCents ?? 0) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Consistency Rule Gauge */}
                  {m.consistencyRuleType && m.consistencyRuleType !== "none" && m.consistencyThresholdPct && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <Percent className="h-3.5 w-3.5 text-blue-500" /> Consistency Limit (Max {m.consistencyThresholdPct}%)
                        </span>
                        <span className={`font-semibold ${
                          m.consistencyStatus === "breached" ? "text-rose-500" :
                          m.consistencyStatus === "at_risk" ? "text-amber-500" : "text-foreground"
                        }`}>
                          {m.bestDayPctOfTotal !== null ? `${m.bestDayPctOfTotal}%` : "0%"} / {m.consistencyThresholdPct}% ({m.consistencyStatus.toUpperCase()})
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, Math.round(((m.bestDayPctOfTotal ?? 0) / m.consistencyThresholdPct) * 100))}
                        className={`h-2 ${m.consistencyStatus === "breached" ? "[&>div]:bg-rose-500" : m.consistencyStatus === "at_risk" ? "[&>div]:bg-amber-500" : ""}`}
                      />
                    </div>
                  )}
                </div>

                {/* Footer metrics row */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    <span>Trading Days:</span>
                    <strong className="text-foreground ml-auto">
                      {m.tradingDaysCount} {c.minTradingDays ? `/ ${c.minTradingDays}` : ""} {m.minDaysMet ? "✓" : ""}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Percent className="h-3.5 w-3.5 text-primary" />
                    <span>Best Day:</span>
                    <strong className="text-foreground ml-auto">
                      {m.bestDayPctOfTotal !== null ? `${m.bestDayPctOfTotal}%` : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New / Edit Challenge Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Challenge Tracker" : "Track Prop Firm Challenge"}</DialogTitle>
            <DialogDescription>
              Configure evaluation target, daily loss limit, and drawdown rules.
            </DialogDescription>
          </DialogHeader>

          {/* Quick presets in modal */}
          {!editingId && (
            <div className="flex items-center gap-1.5 pb-2 border-b border-border text-xs">
              <span className="text-muted-foreground text-[11px] font-medium">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset("ftmo")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium"
              >
                FTMO 100k
              </button>
              <button
                type="button"
                onClick={() => applyPreset("apex")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium"
              >
                Apex 50k
              </button>
              <button
                type="button"
                onClick={() => applyPreset("fundednext")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium"
              >
                FundedNext 100k
              </button>
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            {/* Account & Firm */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Prop Firm</Label>
                <Input
                  value={propFirm}
                  onChange={(e) => setPropFirm(e.target.value)}
                  placeholder="e.g. FTMO, Apex, MFF"
                  className="h-9"
                />
              </div>
            </div>

            {/* Name & Stage */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Challenge Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. FTMO 100K Phase 1"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Stage / Phase</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phase1">Phase 1 (Step 1)</SelectItem>
                    <SelectItem value="phase2">Phase 2 (Verification)</SelectItem>
                    <SelectItem value="funded">Funded / Live Account</SelectItem>
                    <SelectItem value="evaluation">Single Phase Evaluation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Starting Balance & Profit Target */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Starting Balance ($)</Label>
                <Input
                  type="number"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="100000"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Profit Target (%)</Label>
                <Input
                  type="number"
                  value={profitTargetPct}
                  onChange={(e) => setProfitTargetPct(e.target.value)}
                  placeholder="10"
                  className="h-9"
                />
              </div>
            </div>

            {/* Daily Loss & Max DD */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Daily Loss Limit (%)</Label>
                <Input
                  type="number"
                  value={dailyLossLimitPct}
                  onChange={(e) => setDailyLossLimitPct(e.target.value)}
                  placeholder="5"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Max Drawdown (%)</Label>
                <Input
                  type="number"
                  value={maxDrawdownPct}
                  onChange={(e) => setMaxDrawdownPct(e.target.value)}
                  placeholder="10"
                  className="h-9"
                />
              </div>
            </div>

            {/* Drawdown Type & Min Trading Days */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Drawdown Model</Label>
                <Select value={drawdownType} onValueChange={setDrawdownType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static (From Starting Balance)</SelectItem>
                    <SelectItem value="trailing">Trailing (High-Water Mark)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Min Trading Days</Label>
                <Input
                  type="number"
                  value={minTradingDays}
                  onChange={(e) => setMinTradingDays(e.target.value)}
                  placeholder="4"
                  className="h-9"
                />
              </div>
            </div>

            {/* Consistency Rules Configuration */}
            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-primary" /> Configurable Consistency Rules
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Rule Type</span>
                  <Select value={consistencyRuleType} onValueChange={setConsistencyRuleType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="single_day_max">Max Day Profit %</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Threshold %</span>
                  <Input
                    type="number"
                    disabled={consistencyRuleType === "none"}
                    value={consistencyThresholdPct}
                    onChange={(e) => setConsistencyThresholdPct(e.target.value)}
                    placeholder="50"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Action On Breach</span>
                  <Select
                    disabled={consistencyRuleType === "none"}
                    value={consistencyAction}
                    onValueChange={(v: any) => setConsistencyAction(v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dilution_required">Dilute (Soft)</SelectItem>
                      <SelectItem value="warning">Warning Only</SelectItem>
                      <SelectItem value="payout_restricted">Restrict Payout</SelectItem>
                      <SelectItem value="hard_breach">Hard Breach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Daily Cutoff Reset Timezone & Hour */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reset Timezone</Label>
                <Select value={resetTimezone} onValueChange={setResetTimezone}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">New York (EST/EDT)</SelectItem>
                    <SelectItem value="UTC">UTC (00:00 UTC)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                    <SelectItem value="Europe/Prague">Prague (CE(S)T - FTMO)</SelectItem>
                    <SelectItem value="America/Chicago">Chicago (CST/CDT - Apex)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Daily Reset Hour</Label>
                <Select value={resetHour} onValueChange={setResetHour}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="17">17:00 (5:00 PM NY Close)</SelectItem>
                    <SelectItem value="0">00:00 (Midnight UTC)</SelectItem>
                    <SelectItem value="23">23:00 (11:00 PM CET)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Update Tracker" : "Create Tracker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
