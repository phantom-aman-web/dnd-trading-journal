"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  generateTempId,
  optimisticInsert,
  optimisticUpdate,
  optimisticDelete,
  reconcileTempId,
  notifyOptimisticFailure,
} from "@/lib/optimistic";
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
  RefreshCw,
  ArrowUpRight,
  Info,
  Calendar,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatSignedCents, formatProfitFactor } from "@/lib/money";
import { useNav } from "@/lib/nav-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PropChallengeMetrics } from "@/lib/prop-firm-engine";
import type { PropAccountModel, PropAggregateStatistics } from "@/lib/prop-lifecycle-engine";

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
  lifecycle?: any;
  meta?: any;
}

interface PropChallengesSectionProps {
  accounts: { id: string; name: string; accountType: string; startingBalanceCents: number }[];
  hideHeader?: boolean;
  accountId?: string;
}

export function PropChallengesSection({ accounts: rawAccounts, hideHeader = false, accountId: propAccountId }: PropChallengesSectionProps) {
  const accounts: any[] = Array.isArray(rawAccounts)
    ? rawAccounts
    : Array.isArray((rawAccounts as any)?.items)
    ? (rawAccounts as any).items
    : Array.isArray((rawAccounts as any)?.accounts)
    ? (rawAccounts as any).accounts
    : [];
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { navigate, selectedAccountId } = useNav();
  const effectiveAccountId = propAccountId !== undefined ? propAccountId : (selectedAccountId || "");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [name, setName] = useState("");
  const [propFirm, setPropFirm] = useState("FTMO");
  const [accountModel, setAccountModel] = useState<PropAccountModel>("two_step");
  const [accountCost, setAccountCost] = useState("540");
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
  const [showAggregates, setShowAggregates] = useState(true);

  const { data, isLoading, isError, error, refetch } = useQuery<{
    items: PropChallengeWithMetrics[];
    aggregates?: PropAggregateStatistics;
  }>({
    queryKey: ["prop-challenges", effectiveAccountId],
    queryFn: async () => {
      const url = effectiveAccountId
        ? `/api/prop-challenges?accountId=${encodeURIComponent(effectiveAccountId)}`
        : `/api/prop-challenges`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to load prop challenges");
      }
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const challenges = data?.items ?? [];
  const aggregates = data?.aggregates;

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
    onMutate: async (payload: any) => {
      await queryClient.cancelQueries({ queryKey: ["prop-challenges"] });
      const previous = queryClient.getQueriesData({ queryKey: ["prop-challenges"] });

      const tempId = generateTempId("challenge");
      const selectedAccount = accounts.find((a: any) => a.id === payload.accountId);
      const optimisticItem = {
        id: tempId,
        name: payload.name || "New Challenge",
        propFirm: payload.propFirm || "Custom",
        stepType: payload.stepType || payload.accountModel || "two_step",
        stage: payload.stage || "phase1",
        status: "active",
        startingBalanceCents: payload.startingBalanceCents || 10000000,
        currentBalanceCents: payload.startingBalanceCents || 10000000,
        profitTargetCents: payload.profitTargetCents || null,
        maxDrawdownCents: payload.maxDrawdownCents || null,
        dailyLossLimitCents: payload.dailyLossLimitCents || null,
        drawdownType: payload.drawdownType || "static",
        minTradingDays: payload.minTradingDays ?? 4,
        maxTradingDays: null,
        resetTimezone: payload.resetTimezone || "America/New_York",
        resetHour: payload.resetHour ?? 17,
        startDate: new Date().toISOString(),
        notes: null,
        account: {
          id: selectedAccount?.id || payload.accountId || "acc-1",
          name: selectedAccount?.name || "Account",
          currency: selectedAccount?.currency || "USD",
        },
        metrics: {
          status: "safe",
          currentBalanceCents: payload.startingBalanceCents || 10000000,
          currentEquityCents: payload.startingBalanceCents || 10000000,
          startingBalanceCents: payload.startingBalanceCents || 10000000,
          targetCents: payload.profitTargetCents || 1000000,
          currentProfitCents: 0,
          profitProgressPct: 0,
          dailyLossRemainingCents: payload.dailyLossLimitCents || 500000,
          maxDrawdownRemainingCents: payload.maxDrawdownCents || 1000000,
          tradingDays: 0,
          tradingDaysRemaining: payload.minTradingDays ?? 4,
          dailyLossBreached: false,
          maxDrawdownBreached: false,
          targetReached: false,
        },
        meta: {
          accountModel: payload.accountModel,
          accountCostCents: payload.accountCostCents,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...payload,
      };

      queryClient.setQueriesData({ queryKey: ["prop-challenges"] }, (old: any) =>
        optimisticInsert(old, optimisticItem)
      );

      toast.success("Prop firm challenge created");
      setIsModalOpen(false);
      resetForm();

      return { previous, tempId };
    },
    onError: (err: any, _vars: any, context: any) => {
      if (context?.previous) {
        for (const [key, oldData] of context.previous) {
          queryClient.setQueryData(key, oldData);
        }
      }
      notifyOptimisticFailure(err, "Failed to create challenge.");
    },
    onSuccess: (data: any, _vars: any, context: any) => {
      const canonicalRecord = data?.item || data?.challenge || data;
      if (context?.tempId && canonicalRecord?.id) {
        queryClient.setQueriesData({ queryKey: ["prop-challenges"] }, (old: any) =>
          reconcileTempId(old, context.tempId, canonicalRecord)
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["prop-challenges"] });
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
    onMutate: async ({ id, payload }: { id: string; payload: any }) => {
      await queryClient.cancelQueries({ queryKey: ["prop-challenges"] });
      const previous = queryClient.getQueriesData({ queryKey: ["prop-challenges"] });

      queryClient.setQueriesData({ queryKey: ["prop-challenges"] }, (old: any) =>
        optimisticUpdate(old, id, (item: any) => ({
          ...item,
          ...payload,
          updatedAt: new Date().toISOString(),
        }))
      );

      toast.success("Prop firm challenge updated");
      setIsModalOpen(false);
      resetForm();

      return { previous };
    },
    onError: (err: any, _vars: any, context: any) => {
      if (context?.previous) {
        for (const [key, oldData] of context.previous) {
          queryClient.setQueryData(key, oldData);
        }
      }
      notifyOptimisticFailure(err, "Failed to update challenge.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["prop-challenges"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prop-challenges/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete challenge");
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["prop-challenges"] });
      const previous = queryClient.getQueriesData({ queryKey: ["prop-challenges"] });

      queryClient.setQueriesData({ queryKey: ["prop-challenges"] }, (old: any) =>
        optimisticDelete(old, id)
      );

      toast.success("Challenge tracker deleted");

      return { previous };
    },
    onError: (err: any, _vars: any, context: any) => {
      if (context?.previous) {
        for (const [key, oldData] of context.previous) {
          queryClient.setQueryData(key, oldData);
        }
      }
      notifyOptimisticFailure(err, "Failed to delete challenge.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["prop-challenges"] });
    },
  });

  function resetForm() {
    setEditingId(null);
    setName("");
    setPropFirm("FTMO");
    setAccountModel("two_step");
    setAccountCost("540");
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
    setAccountModel(c.meta?.accountModel || "two_step");
    setAccountCost(((c.meta?.accountCostCents || 54000) / 100).toString());
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

  function applyPreset(preset: "ftmo" | "apex" | "fundednext" | "instant") {
    if (preset === "ftmo") {
      setPropFirm("FTMO");
      setName("FTMO $100K 2-Phase");
      setAccountModel("two_step");
      setAccountCost("540");
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
      setName("Apex 50K Trailing Evaluation");
      setAccountModel("one_step");
      setAccountCost("160");
      setStage("phase1");
      setStartingBalance("50000");
      setProfitTargetPct("6");
      setDailyLossLimitPct("4");
      setMaxDrawdownPct("5");
      setDrawdownType("trailing");
      setMinTradingDays("7");
      setResetHour("16");
      setResetTimezone("America/Chicago");
      setConsistencyRuleType("single_day_max");
      setConsistencyThresholdPct("30");
      setConsistencyAction("dilution_required");
    } else if (preset === "fundednext") {
      setPropFirm("FundedNext");
      setName("FundedNext Stellar $100K");
      setAccountModel("two_step");
      setAccountCost("549");
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
    } else if (preset === "instant") {
      setPropFirm("Instant Funded");
      setName("Instant Funded $100K Direct");
      setAccountModel("instant_funded");
      setAccountCost("350");
      setStage("funded");
      setStartingBalance("100000");
      setProfitTargetPct("0");
      setDailyLossLimitPct("5");
      setMaxDrawdownPct("10");
      setDrawdownType("static");
      setMinTradingDays("0");
      setResetHour("17");
      setResetTimezone("America/New_York");
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
    const targetCents = accountModel === "instant_funded" || accountModel === "direct_funded"
      ? null
      : targetPct ? Math.round(startBalCents * (targetPct / 100)) : null;

    const dailyPct = parseFloat(dailyLossLimitPct) || null;
    const dailyCents = dailyPct ? Math.round(startBalCents * (dailyPct / 100)) : null;

    const maxDDPct = parseFloat(maxDrawdownPct) || null;
    const maxDDCents = maxDDPct ? Math.round(startBalCents * (maxDDPct / 100)) : null;

    const consistencyPct = consistencyRuleType !== "none" ? (parseFloat(consistencyThresholdPct) || 50) : null;

    const payload = {
      accountId,
      name: name.trim() || `${propFirm} ${stage.toUpperCase()}`,
      propFirm,
      accountModel,
      accountCostCents: Math.round((parseFloat(accountCost) || 0) * 100),
      stage: accountModel === "instant_funded" || accountModel === "direct_funded" ? "funded" : stage,
      startingBalanceCents: startBalCents,
      profitTargetCents: targetCents,
      dailyLossLimitCents: dailyCents,
      dailyLossLimitPct: dailyPct,
      maxDrawdownCents: maxDDCents,
      maxDrawdownPct: maxDDPct,
      drawdownType,
      minTradingDays: accountModel === "instant_funded" || accountModel === "direct_funded" ? null : (parseInt(minTradingDays, 10) || 4),
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

  function getStatusBadge(metrics?: PropChallengeMetrics, lifecycleStatus?: string) {
    const status = lifecycleStatus || metrics?.status || "safe";
    switch (status) {
      case "passed":
        return <Badge className="bg-profit/15 text-profit border-profit/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Passed</Badge>;
      case "breached":
      case "failed":
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1"><AlertTriangle className="h-3 w-3" /> Breached</Badge>;
      case "at_risk":
        return <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30 gap-1"><ShieldAlert className="h-3 w-3" /> At Risk</Badge>;
      case "funded":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"><Trophy className="h-3 w-3" /> Funded</Badge>;
      case "approaching_limit":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"><AlertTriangle className="h-3 w-3" /> Warning (75%)</Badge>;
      default:
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1">Safe</Badge>;
    }
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-4">
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
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <h4 className="text-base font-semibold text-foreground">Failed to load challenge trackers</h4>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {error instanceof Error ? error.message : "An unexpected error occurred while loading prop firm challenges."}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Retry Loading
        </Button>
      </div>
    );
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

      {/* Prop Firm Portfolio & Aggregated Analytics Hub */}
      {aggregates && aggregates.totalChallenges > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-xs uppercase tracking-wider font-mono text-foreground">
                Prop Firm Portfolio & Financial Reconciliation
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAggregates(!showAggregates)}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              {showAggregates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {showAggregates && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Total Challenges</div>
                  <div className="font-bold text-foreground text-sm font-mono mt-0.5">{aggregates.totalChallenges}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Active Evals</div>
                  <div className="font-bold text-primary text-sm font-mono mt-0.5">{aggregates.activeEvaluations}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Passed / Funded</div>
                  <div className="font-bold text-profit text-sm font-mono mt-0.5">
                    {aggregates.passedEvaluations} / {aggregates.fundedAccounts}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Pass Rate</div>
                  <div className="font-bold text-foreground text-sm font-mono mt-0.5">{aggregates.passRatePct}%</div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Realized Payouts</div>
                  {aggregates.isMultiCurrency && aggregates.byCurrency ? (
                    <div className="font-bold text-profit text-xs font-mono mt-0.5 space-y-0.5">
                      {Object.entries(aggregates.byCurrency).map(([cur, fin]) => (
                        <div key={cur}>{cur}: {formatSignedCents(fin.totalPayoutsCents, cur).text.replace("+ ", "")}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="font-bold text-profit text-sm font-mono mt-0.5">
                      {formatSignedCents(aggregates.totalPayoutsCents, aggregates.primaryCurrency || "USD").text.replace("+ ", "")}
                    </div>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Fees Paid</div>
                  {aggregates.isMultiCurrency && aggregates.byCurrency ? (
                    <div className="font-bold text-muted-foreground text-xs font-mono mt-0.5 space-y-0.5">
                      {Object.entries(aggregates.byCurrency).map(([cur, fin]) => (
                        <div key={cur}>{cur}: {formatSignedCents(fin.totalFeesCents, cur).text.replace("+ ", "")}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="font-bold text-muted-foreground text-sm font-mono mt-0.5">
                      {formatSignedCents(aggregates.totalFeesCents, aggregates.primaryCurrency || "USD").text.replace("+ ", "")}
                    </div>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Net Cash Outcome</div>
                  {aggregates.isMultiCurrency && aggregates.byCurrency ? (
                    <div className="font-bold text-xs font-mono mt-0.5 space-y-0.5">
                      {Object.entries(aggregates.byCurrency).map(([cur, fin]) => (
                        <div key={cur} className={fin.netCashOutcomeCents >= 0 ? "text-profit" : "text-loss"}>
                          {cur}: {formatSignedCents(fin.netCashOutcomeCents, cur).text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={cn("font-bold text-sm font-mono mt-0.5", (aggregates.netCashOutcomeCents ?? aggregates.netProfitabilityCents) >= 0 ? "text-profit" : "text-loss")}>
                      {formatSignedCents(aggregates.netCashOutcomeCents ?? aggregates.netProfitabilityCents, aggregates.primaryCurrency || "USD").text}
                    </div>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Simulated P&L</div>
                  {aggregates.isMultiCurrency && aggregates.byCurrency ? (
                    <div className="font-bold text-xs font-mono mt-0.5 space-y-0.5">
                      {Object.entries(aggregates.byCurrency).map(([cur, fin]) => (
                        <div key={cur} className={fin.simulatedTradingProfitCents >= 0 ? "text-profit" : "text-loss"}>
                          {cur}: {formatSignedCents(fin.simulatedTradingProfitCents, cur).text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={cn("font-bold text-sm font-mono mt-0.5", (aggregates.totalSimulatedTradingProfitCents ?? 0) >= 0 ? "text-profit" : "text-loss")}>
                      {formatSignedCents(aggregates.totalSimulatedTradingProfitCents ?? 0, aggregates.primaryCurrency || "USD").text}
                    </div>
                  )}
                </div>
              </div>

              {/* Informational Financial Note */}
              <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/50 flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                  <strong>Financial Ledger Clarity:</strong> Net Cash Outcome tracks real cash flow (payout disbursements received minus challenge fees paid). Simulated P&L reflects cumulative trading gains across evaluation and funded accounts.
                </span>
                {aggregates.isMultiCurrency && aggregates.byCurrency && (
                  <span className="text-[10px] text-muted-foreground/90 font-mono">
                    Multi-currency isolation active ({Object.keys(aggregates.byCurrency).join(", ")}): metrics are tracked strictly by denomination to prevent inaccurate currency mixing.
                  </span>
                )}
              </div>

              {/* Firm & Failure Breakdown */}
              {Object.keys(aggregates.byFirm).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-border/50">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">Performance by Firm</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Object.entries(aggregates.byFirm).map(([firm, data]) => (
                        <Badge key={firm} variant="secondary" className="text-[11px] font-normal gap-1 py-0.5">
                          <strong>{firm}:</strong> {data.total} accts • {data.passed} passed • {formatSignedCents(data.netPnlCents, data.currency || "USD").text}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {aggregates.frequentBreachRules.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">Frequent Failure Rules</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {aggregates.frequentBreachRules.slice(0, 3).map((r) => (
                          <Badge key={r.ruleKey} variant="outline" className="text-[11px] font-normal text-loss border-loss/30 gap-1 py-0.5">
                            {r.ruleName} ({r.count})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
            const m = c.metrics || {
              status: "safe",
              statusReason: "All rules within normal boundaries",
              startingBalanceCents: c.startingBalanceCents || 10000000,
              currentBalanceCents: c.startingBalanceCents || 10000000,
              netProfitCents: 0,
              profitTargetProgressPct: 0,
              profitTargetReached: false,
              todayLossCents: 0,
              dailyLossLimitCents: c.dailyLossLimitCents,
              dailyLossBreached: false,
              dailyLossUsedPct: 0,
              highWaterMarkCents: c.startingBalanceCents || 10000000,
              currentDrawdownCents: 0,
              maxDrawdownLimitCents: c.maxDrawdownCents,
              drawdownBreached: false,
              drawdownUsedPct: 0,
              tradeCount: 0,
              winCount: 0,
              lossCount: 0,
              breakevenCount: 0,
              winRate: 0,
              profitFactor: null,
              tradingDaysCount: 0,
              minDaysMet: true,
              daysRemaining: null,
              bestDayProfitCents: 0,
              bestDayPctOfTotal: null,
              consistencyBreached: false,
              rules: [],
              violations: [],
            };
            const currency = c.account?.currency || "USD";
            const targetPct = m.profitTargetProgressPct ?? 0;
            const dailyPct = m.dailyLossUsedPct ?? 0;
            const ddPct = m.drawdownUsedPct ?? 0;

            const formattedStartDate = c.startDate
              ? new Date(c.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—";

            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        onClick={() => navigate("propChallenges", { challengeId: c.id })}
                        className="font-bold text-foreground text-base hover:text-primary cursor-pointer transition-colors"
                      >
                        {c.name}
                      </h3>
                      {getStatusBadge(m, c.lifecycle?.status)}
                      {c.meta?.isFirmDispute && (
                        <Badge
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("propChallenges", { challengeId: c.id, tab: "breaches" });
                          }}
                          className="bg-loss/15 text-loss border-loss/30 text-[10px] font-mono cursor-pointer hover:bg-loss/20 gap-1"
                        >
                          <ShieldAlert className="h-3 w-3" /> Firm Dispute
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="font-medium text-foreground">{c.propFirm}</span>
                      <span>·</span>
                      <span className="uppercase tracking-wide font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {c.meta?.accountModel?.replace("_", " ") || c.stage}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {c.lifecycle?.activePhase?.name || c.stage}
                      </span>
                      <span>·</span>
                      {c.account ? (
                        <span>Account: <strong className="text-foreground">{c.account.name}</strong> ({currency})</span>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Unlinked Account</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 mt-1">
                      <Calendar className="h-3 w-3 text-primary shrink-0" />
                      <span>Tracking since {formattedStartDate}</span>
                      {c.maxTradingDays && (
                        <>
                          <span>·</span>
                          <span>{m.daysRemaining !== null ? `${m.daysRemaining} days remaining` : ""}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                      title="Edit challenge rules"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Delete Challenge Tracker",
                          description: `Delete challenge tracker "${c.name}"? This action cannot be undone.`,
                          confirmText: "Delete Tracker",
                          cancelText: "Cancel",
                          variant: "destructive",
                        });
                        if (ok) {
                          deleteMutation.mutate(c.id);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                      title="Delete tracker"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Live Account Performance Summary KPI Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl border border-border/70 bg-muted/20 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono block">Current Balance</span>
                    <div className="font-bold text-foreground text-sm font-mono truncate">
                      {formatSignedCents(m.currentBalanceCents, currency).text.replace("+ ", "")}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      Start: {formatSignedCents(m.startingBalanceCents, currency).text.replace("+ ", "")}
                    </div>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono block">Total Net P&L</span>
                    <div className={cn("font-bold text-sm font-mono truncate", m.netProfitCents >= 0 ? "text-profit" : "text-loss")}>
                      {formatSignedCents(m.netProfitCents, currency).text}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {m.startingBalanceCents > 0
                        ? `${m.netProfitCents >= 0 ? "+" : ""}${((m.netProfitCents / m.startingBalanceCents) * 100).toFixed(1)}% return`
                        : "—"}
                    </div>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono block">Executions</span>
                    <div className="font-bold text-foreground text-sm font-mono truncate">
                      {m.tradeCount} <span className="text-[11px] font-normal text-muted-foreground">trades</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {m.winRate}% ({m.winCount}W · {m.lossCount}L)
                    </div>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono block">Profit Factor</span>
                    <div className="font-bold text-foreground text-sm font-mono truncate">
                      {formatProfitFactor(m.profitFactor)}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {m.breakevenCount} Breakevens
                    </div>
                  </div>
                </div>

                {/* Informational callout if account has 0 trades */}
                {m.tradeCount === 0 && (
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      No trades executed yet for this challenge account. Every trade logged under <strong>{c.account?.name || "this account"}</strong> will automatically update this tracker in real time.
                    </span>
                  </div>
                )}

                {/* Status reason alert if not safe */}
                {m.status !== "safe" && (
                  <div
                    className={cn(
                      "text-xs p-2.5 rounded-lg border flex items-center gap-2",
                      m.status === "passed"
                        ? "bg-profit/10 border-profit/20 text-profit"
                        : m.status === "breached"
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    )}
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
                        <span className="font-semibold text-foreground font-mono">
                          {formatSignedCents(m.netProfitCents, currency).text} / {formatSignedCents(c.profitTargetCents, currency).text} ({Math.max(0, targetPct)}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, Math.max(0, targetPct))}
                        className={cn("h-2", m.profitTargetReached && "[&>div]:bg-profit")}
                      />
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                        <span>Target Progress:</span>
                        <span className={cn("font-medium", m.profitTargetReached ? "text-profit font-semibold" : "text-foreground font-mono")}>
                          {m.profitTargetReached
                            ? "Target Achieved ✓"
                            : `Remaining: ${formatSignedCents(m.remainingProfitTargetCents ?? 0, currency).text}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Daily Loss Limit */}
                  {c.dailyLossLimitCents && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="h-3.5 w-3.5 text-amber-500" /> Daily Loss ({m.cycleResetTime})
                        </span>
                        <span className={cn("font-semibold font-mono", dailyPct >= 90 ? "text-rose-500" : dailyPct >= 75 ? "text-amber-500" : "text-foreground")}>
                          ${(m.todayLossCents / 100).toFixed(2)} / ${(c.dailyLossLimitCents / 100).toFixed(2)} ({dailyPct}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, dailyPct)}
                        className={cn("h-2", dailyPct >= 90 ? "[&>div]:bg-rose-500" : dailyPct >= 75 ? "[&>div]:bg-amber-500" : "")}
                      />
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                        <span>Allowable Risk Remaining Today:</span>
                        <span className={cn("font-mono font-medium", m.dailyLossBreached ? "text-rose-500 font-bold" : "text-foreground")}>
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
                          <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> Max Drawdown ({c.drawdownType === "trailing" ? "Trailing from Peak" : "Static from Start"})
                        </span>
                        <span className={cn("font-semibold font-mono", ddPct >= 90 ? "text-rose-500" : ddPct >= 75 ? "text-amber-500" : "text-foreground")}>
                          ${(m.currentDrawdownCents / 100).toFixed(2)} / ${(c.maxDrawdownCents / 100).toFixed(2)} ({ddPct}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, ddPct)}
                        className={cn("h-2", ddPct >= 90 ? "[&>div]:bg-rose-500" : ddPct >= 75 ? "[&>div]:bg-amber-500" : "")}
                      />
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                        <span>{c.drawdownType === "trailing" ? `Peak Equity: $${(m.highWaterMarkCents / 100).toFixed(2)} · Buffer Left:` : "Drawdown Buffer Remaining:"}</span>
                        <span className={cn("font-mono font-medium", m.drawdownBreached ? "text-rose-500 font-bold" : "text-foreground")}>
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
                          <Percent className="h-3.5 w-3.5 text-blue-500" /> Consistency Limit (Max {m.consistencyThresholdPct}% single day)
                        </span>
                        <span className={cn("font-semibold font-mono",
                          m.consistencyStatus === "breached" ? "text-rose-500" :
                          m.consistencyStatus === "at_risk" ? "text-amber-500" : "text-foreground"
                        )}>
                          Best Day: {m.bestDayPctOfTotal !== null ? `${m.bestDayPctOfTotal}%` : "0%"} / {m.consistencyThresholdPct}% ({m.consistencyStatus.toUpperCase()})
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, Math.round(((m.bestDayPctOfTotal ?? 0) / m.consistencyThresholdPct) * 100))}
                        className={cn("h-2", m.consistencyStatus === "breached" ? "[&>div]:bg-rose-500" : m.consistencyStatus === "at_risk" ? "[&>div]:bg-amber-500" : "")}
                      />
                    </div>
                  )}
                </div>

                {/* Footer metrics row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    <span>Trading Days:</span>
                    <strong className="text-foreground font-mono">
                      {m.tradingDaysCount} {c.minTradingDays ? `/ ${c.minTradingDays}` : ""} {m.minDaysMet ? "✓" : ""}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Percent className="h-3.5 w-3.5 text-primary" />
                    <span>Best Day:</span>
                    <strong className="text-foreground font-mono">
                      {m.bestDayProfitCents > 0 ? formatSignedCents(m.bestDayProfitCents, currency).text : "—"}
                    </strong>
                  </div>
                  {c.account?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const accId = c.account?.id || "";
                        useNav.getState().setSelectedAccountId(accId);
                        navigate("tradesLog", {
                          accountId: accId,
                          propChallengeId: c.id,
                          propChallengeName: c.name,
                          propFirm: c.propFirm,
                        });
                      }}
                      className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10 ml-auto cursor-pointer"
                    >
                      Trades ({m.tradeCount}) <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Card Full Inspection Action */}
                <div className="pt-2 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("propChallenges", { challengeId: c.id })}
                    className="w-full text-xs font-semibold gap-1.5 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20 justify-center h-8"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Inspect Details, Rules & Diagnostics →
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New / Edit Challenge Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Challenge Tracker" : "Track Prop Firm Challenge"}</DialogTitle>
            <DialogDescription>
              Configure evaluation model, rules, daily loss limit, drawdown parameters, and reset timezone.
            </DialogDescription>
          </DialogHeader>

          {/* Quick presets in modal */}
          {!editingId && (
            <div className="flex items-center gap-1.5 pb-2 border-b border-border text-xs flex-wrap">
              <span className="text-muted-foreground text-[11px] font-medium">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset("ftmo")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium transition-colors"
              >
                FTMO 100k (2-Step)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("apex")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium transition-colors"
              >
                Apex 50k (Trailing)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("fundednext")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium transition-colors"
              >
                FundedNext 100k
              </button>
              <button
                type="button"
                onClick={() => applyPreset("instant")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium transition-colors"
              >
                Instant Funded 100k
              </button>
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            {/* Account & Firm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-9 w-full">
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

              <div className="min-w-0 space-y-1.5">
                <Label>Prop Firm</Label>
                <Input
                  value={propFirm}
                  onChange={(e) => setPropFirm(e.target.value)}
                  placeholder="e.g. FTMO, Apex, MFF"
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Account Model & Challenge Cost */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Account Model</Label>
                <Select value={accountModel} onValueChange={(v: any) => {
                  setAccountModel(v);
                  if (v === "instant_funded" || v === "direct_funded") {
                    setStage("funded");
                    setProfitTargetPct("0");
                  } else if (v === "one_step") {
                    setStage("phase1");
                  } else if (v === "two_step") {
                    setStage("phase1");
                  }
                }}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="two_step">2-Step Evaluation (Standard)</SelectItem>
                    <SelectItem value="one_step">1-Step Evaluation (Fast Pass)</SelectItem>
                    <SelectItem value="multi_step">Multi-Step Evaluation (3+ Phases)</SelectItem>
                    <SelectItem value="instant_funded">Instant Funded (No Evaluation)</SelectItem>
                    <SelectItem value="direct_funded">Direct Funded</SelectItem>
                    <SelectItem value="custom">Custom Firm Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label>Challenge Cost / Fee ($)</Label>
                <Input
                  type="number"
                  value={accountCost}
                  onChange={(e) => setAccountCost(e.target.value)}
                  placeholder="540"
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Name & Stage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Challenge Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. FTMO 100K Phase 1"
                  className="h-9 w-full"
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label>Initial Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phase1">Phase 1</SelectItem>
                    <SelectItem value="phase2">Phase 2</SelectItem>
                    <SelectItem value="funded">Funded Stage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Starting Balance & Profit Target */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Starting Balance ($)</Label>
                <Input
                  type="number"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="100000"
                  className="h-9 w-full"
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label>Profit Target (%)</Label>
                <Input
                  type="number"
                  value={profitTargetPct}
                  onChange={(e) => setProfitTargetPct(e.target.value)}
                  placeholder="10"
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Daily Loss & Max DD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Daily Loss Limit (%)</Label>
                <Input
                  type="number"
                  value={dailyLossLimitPct}
                  onChange={(e) => setDailyLossLimitPct(e.target.value)}
                  placeholder="5"
                  className="h-9 w-full"
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label>Max Drawdown (%)</Label>
                <Input
                  type="number"
                  value={maxDrawdownPct}
                  onChange={(e) => setMaxDrawdownPct(e.target.value)}
                  placeholder="10"
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Drawdown Type & Min Trading Days */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Drawdown Model</Label>
                <Select value={drawdownType} onValueChange={setDrawdownType}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue className="truncate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static (From Starting Balance)</SelectItem>
                    <SelectItem value="trailing">Trailing (High-Water Mark)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Static: initial capital basis. Trailing: follows equity peak.
                </p>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label>Min Trading Days</Label>
                <Input
                  type="number"
                  value={minTradingDays}
                  onChange={(e) => setMinTradingDays(e.target.value)}
                  placeholder="4"
                  className="h-9 w-full"
                />
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Required active days before completion/payout.
                </p>
              </div>
            </div>

            {/* Consistency Rules Configuration */}
            <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-3">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-primary" /> Configurable Consistency Rules
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="min-w-0 space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Rule Type</span>
                  <Select value={consistencyRuleType} onValueChange={setConsistencyRuleType}>
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="single_day_max">Max Day Profit %</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Threshold %</span>
                  <Input
                    type="number"
                    disabled={consistencyRuleType === "none"}
                    value={consistencyThresholdPct}
                    onChange={(e) => setConsistencyThresholdPct(e.target.value)}
                    placeholder="50"
                    className="h-8 text-xs w-full"
                  />
                </div>

                <div className="min-w-0 space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Action On Breach</span>
                  <Select
                    disabled={consistencyRuleType === "none"}
                    value={consistencyAction}
                    onValueChange={(v: any) => setConsistencyAction(v)}
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Reset Timezone</Label>
                <Select value={resetTimezone} onValueChange={setResetTimezone}>
                  <SelectTrigger className="h-9 w-full">
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

              <div className="min-w-0 space-y-1.5">
                <Label>Daily Reset Hour</Label>
                <Select value={resetHour} onValueChange={setResetHour}>
                  <SelectTrigger className="h-9 w-full">
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
