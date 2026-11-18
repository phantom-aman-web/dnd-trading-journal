"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  ArrowLeft,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  FileText,
  Settings as SettingsIcon,
  Plus,
  Calendar,
  ExternalLink,
  ChevronRight,
  Info,
  Building,
  RotateCcw,
  Percent,
  Wallet,
  AlertOctagon,
  Scale,
  Sparkles,
  Filter,
  Check,
  Award,
  ArrowUpRight,
} from "lucide-react";
import { FundedPhaseDetailModal } from "./funded-phase-detail-modal";
import { useNav } from "@/lib/nav-store";
import { usePrivacyStore, maskAccountName } from "@/lib/privacy-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  simulateHypotheticalScenario,
  isSyntheticSampleTrade,
  type PropRuleDefinition,
  type PropViolationRecord,
  type PropPhaseConfig,
  type PropPayoutRecord,
  type PropPhaseSnapshot,
  type RuleStatus,
  type RuleCategory,
} from "@/lib/prop-lifecycle-engine";

interface PropChallengeDetailProps {
  challengeId: string;
  onBack: () => void;
}

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function formatSignedCents(cents: number, currency = "USD"): { text: string; isPositive: boolean; isNegative: boolean } {
  const isPositive = cents > 0;
  const isNegative = cents < 0;
  const prefix = isPositive ? "+" : isNegative ? "-" : "";
  const absDollars = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absDollars);
  return {
    text: `${prefix}${formatted}`,
    isPositive,
    isNegative,
  };
}

// ---------------------------------------------------------------------------
// Interactive Rule Simulator Component
// ---------------------------------------------------------------------------
function RuleSimulatorWidget({
  lifecycle,
  activePhase,
  currency,
  isPrivate,
}: {
  lifecycle: any;
  activePhase: PropPhaseConfig;
  currency: string;
  isPrivate: boolean;
}) {
  const [simPnl, setSimPnl] = useState<string>("-500");
  const [simFloating, setSimFloating] = useState<string>("0");
  const [simWithdrawal, setSimWithdrawal] = useState<string>("0");
  const [isNewDay, setIsNewDay] = useState<boolean>(false);

  const pnlCents = Math.round((parseFloat(simPnl) || 0) * 100);
  const floatingCents = Math.round((parseFloat(simFloating) || 0) * 100);
  const withdrawalCents = Math.round((parseFloat(simWithdrawal) || 0) * 100);

  const simResult = simulateHypotheticalScenario(
    { ...lifecycle, activePhase },
    {
      hypotheticalPnlCents: pnlCents,
      floatingDrawdownCents: floatingCents,
      hypotheticalWithdrawalCents: withdrawalCents,
      isNewTradingDay: isNewDay,
    }
  );

  return (
    <Card className="border-primary/25 bg-card/60 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Interactive Rule & Risk Simulator
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-xs font-semibold px-2.5 py-0.5 self-start sm:self-auto",
              simResult.isSafe
                ? "bg-profit/15 text-profit border-profit/30"
                : "bg-loss/15 text-loss border-loss/30"
            )}
          >
            {simResult.isSafe ? "Hypothetically Safe ✓" : "Breach Risk Alert ✕"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Simulate trade outcomes, drawdowns, and withdrawals to stress-test your account against daily loss and max drawdown limits before executing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {/* Quick Scenario Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium">Quick Scenarios:</span>
          <button
            type="button"
            onClick={() => { setSimPnl("-500"); setSimFloating("0"); setSimWithdrawal("0"); setIsNewDay(false); }}
            className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono transition-colors"
          >
            -$500 Day Loss
          </button>
          <button
            type="button"
            onClick={() => { setSimPnl("-1500"); setSimFloating("0"); setSimWithdrawal("0"); setIsNewDay(false); }}
            className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono transition-colors"
          >
            -$1,500 Heavy Loss
          </button>
          <button
            type="button"
            onClick={() => { setSimPnl("1500"); setSimFloating("0"); setSimWithdrawal("0"); setIsNewDay(false); }}
            className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono transition-colors"
          >
            +$1,500 Win
          </button>
          <button
            type="button"
            onClick={() => { setSimPnl("3000"); setSimFloating("0"); setSimWithdrawal("0"); setIsNewDay(false); }}
            className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono transition-colors"
          >
            +$3,000 Big Win
          </button>
          <button
            type="button"
            onClick={() => { setSimPnl("0"); setSimFloating("2000"); setSimWithdrawal("0"); setIsNewDay(false); }}
            className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono transition-colors"
          >
            $2,000 Floating DD
          </button>
        </div>

        {/* Custom Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px]">Simulated Net P&L ($)</Label>
            <Input
              type="number"
              value={simPnl}
              onChange={(e) => setSimPnl(e.target.value)}
              placeholder="-500"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Floating Drawdown ($)</Label>
            <Input
              type="number"
              value={simFloating}
              onChange={(e) => setSimFloating(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Withdrawal ($)</Label>
            <Input
              type="number"
              value={simWithdrawal}
              onChange={(e) => setSimWithdrawal(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>

        {/* Breach Warnings if any */}
        {simResult.breachWarnings.length > 0 && (
          <div className="p-3 rounded-lg bg-loss/10 border border-loss/20 text-loss space-y-1">
            <div className="font-semibold text-xs flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Predicted Compliance Breach Warnings:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              {simResult.breachWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Projected Metrics Preview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Projected Balance</div>
            <div className="font-bold text-foreground text-xs sm:text-sm font-mono mt-0.5">
              {isPrivate ? "••••••" : formatCents(simResult.projectedBalanceCents, currency)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Daily Loss Usage</div>
            <div className={cn("font-bold text-xs sm:text-sm font-mono mt-0.5", simResult.projectedDailyLossBreached ? "text-loss" : "text-foreground")}>
              {simResult.projectedDailyLossUsedPct !== null ? `${simResult.projectedDailyLossUsedPct}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {simResult.projectedDailyLossBreached ? "Breach Limit Exceeded" : `Loss: $${(simResult.projectedDailyLossCents / 100).toFixed(0)}`}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Drawdown Usage</div>
            <div className={cn("font-bold text-xs sm:text-sm font-mono mt-0.5", simResult.projectedDrawdownBreached ? "text-loss" : "text-foreground")}>
              {simResult.projectedDrawdownUsedPct !== null ? `${simResult.projectedDrawdownUsedPct}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {simResult.projectedDrawdownBreached ? "Max DD Breached" : `DD: $${(simResult.projectedDrawdownCents / 100).toFixed(0)}`}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Target Progress</div>
            <div className={cn("font-bold text-xs sm:text-sm font-mono mt-0.5", simResult.projectedProfitTargetReached ? "text-profit" : "text-foreground")}>
              {simResult.projectedProfitTargetProgressPct !== null ? `${simResult.projectedProfitTargetProgressPct}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {simResult.projectedProfitTargetReached ? "Target Achieved ✓" : `Net: ${formatSignedCents(simResult.projectedNetProfitCents, currency).text}`}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Prop Challenge Detail View
// ---------------------------------------------------------------------------
export function PropChallengeDetail({ challengeId, onBack }: PropChallengeDetailProps) {
  const queryClient = useQueryClient();
  const { params, navigate } = useNav();
  const { isPrivate } = usePrivacyStore();

  const [activeTab, setActiveTabState] = useState(params.tab || "overview");
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    navigate("propChallenges", { challengeId, tab });
  };

  // Dialog states
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [selectedFundedPhase, setSelectedFundedPhase] = useState<PropPhaseConfig | null>(null);

  // Transition policy state
  const [transitionPolicy, setTransitionPolicy] = useState<"carry_forward" | "fresh_baseline">("carry_forward");

  // Dispute form state
  const [firmComm, setFirmComm] = useState("");
  const [undisclosedRule, setUndisclosedRule] = useState("");
  const [userVerifiedDispute, setUserVerifiedDispute] = useState(false);

  // Payout form state
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");

  // Rule filter
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<string>("all");

  // Trade History filter
  const [tradeFilter, setTradeFilter] = useState<"all" | "win" | "loss">("all");

  // Fetch challenge details
  const { data: challenge, isLoading, isError, refetch } = useQuery({
    queryKey: ["prop-challenge", challengeId],
    queryFn: async () => {
      const res = await fetch(`/api/prop-challenges/${challengeId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load challenge details");
      return res.json();
    },
    staleTime: 0,
  });

  // Fetch all user accounts for Account Settings rebind
  const { data: accountsData } = useQuery({
    queryKey: ["trading-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
    },
    staleTime: 0,
  });
  const availableAccounts = accountsData || [];
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Mutations
  const patchMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/prop-challenges/${challengeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update challenge");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prop-challenge", challengeId] });
      queryClient.invalidateQueries({ queryKey: ["prop-challenges"] });
      if (variables.action === "transition_phase") {
        toast.success("Successfully transitioned to next phase!");
        setIsTransitionModalOpen(false);
      } else if (variables.action === "record_firm_rejection") {
        toast.warning("Firm rejection investigation recorded.");
        setIsDisputeModalOpen(false);
      } else if (variables.action === "request_payout") {
        toast.success("Payout request submitted successfully!");
        setIsPayoutModalOpen(false);
        setPayoutAmount("");
      } else {
        toast.success("Challenge settings updated.");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Operation failed");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
            <ArrowLeft className="h-4 w-4" /> Back to Challenges
          </Button>
        </div>
        <div className="h-48 rounded-2xl bg-card/60 animate-pulse border border-border/60" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-card/60 animate-pulse border border-border/60" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !challenge) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-semibold">Challenge Not Found</h2>
        <p className="text-xs text-muted-foreground">The requested prop challenge record could not be loaded.</p>
        <Button onClick={onBack} variant="outline" size="sm">
          Return to All Challenges
        </Button>
      </div>
    );
  }

  const currency = challenge.account?.currency || "USD";
  const lifecycle = challenge.lifecycle || {};
  const activePhase: PropPhaseConfig = challenge.activePhase || lifecycle.activePhase || {};
  const allPhases: PropPhaseConfig[] = challenge.allPhases || lifecycle.allPhases || [];
  const rules: PropRuleDefinition[] = challenge.rules || lifecycle.rules || [];
  const violations: PropViolationRecord[] = challenge.violations || lifecycle.violations || [];
  const warnings = challenge.warnings || lifecycle.warnings || [];
  const payouts: PropPayoutRecord[] = challenge.payouts || lifecycle.payouts || challenge.meta?.payouts || [];
  const events = challenge.events || lifecycle.events || challenge.meta?.events || [];
  const rawTrades: any[] = challenge.trades || [];
  const trades: any[] = rawTrades.filter((t: any) => !isSyntheticSampleTrade(t));
  const payoutEligibility = challenge.payoutEligibility || lifecycle.payoutEligibility || {};

  const isPassed = lifecycle.status === "passed";
  const isBreached = lifecycle.status === "breached";
  const isFailed = lifecycle.status === "failed";
  const isFunded = lifecycle.status === "funded";
  const isFirmDispute = challenge.isFirmDispute || lifecycle.isFirmDispute;

  // Filtered rules
  const filteredRules = rules.filter((r) => {
    if (ruleCategoryFilter === "all") return true;
    return r.category === ruleCategoryFilter;
  });

  // Filter categories with counts
  const categories: Array<{ key: string; label: string }> = [
    { key: "all", label: "All" },
    { key: "target", label: "Target" },
    { key: "daily_loss", label: "Daily Loss" },
    { key: "drawdown", label: "Drawdown" },
    { key: "consistency", label: "Consistency" },
    { key: "trading_behavior", label: "Behavior" },
    { key: "holding", label: "Holding" },
    { key: "risk_management", label: "Risk" },
    { key: "payout", label: "Payout" },
  ];

  // Derived trade statistics for Performance tab
  const closedTrades = trades.filter((t: any) => t.status !== "open" && t.exitTime !== null);
  const winningTrades = closedTrades.filter((t: any) => t.netPnlCents > 0 || t.status === "win");
  const losingTrades = closedTrades.filter((t: any) => t.netPnlCents < 0 || t.status === "loss");
  const breakevenTrades = closedTrades.filter((t: any) => t.netPnlCents === 0 || t.status === "breakeven");

  const longTrades = closedTrades.filter((t: any) => t.direction === "long");
  const shortTrades = closedTrades.filter((t: any) => t.direction === "short");

  const longWins = longTrades.filter((t: any) => t.netPnlCents > 0 || t.status === "win").length;
  const shortWins = shortTrades.filter((t: any) => t.netPnlCents > 0 || t.status === "win").length;

  const longWinRate = longTrades.length > 0 ? Math.round((longWins / longTrades.length) * 100) : 0;
  const shortWinRate = shortTrades.length > 0 ? Math.round((shortWins / shortTrades.length) * 100) : 0;

  const longPnlCents = longTrades.reduce((acc: number, t: any) => acc + (t.netPnlCents || 0), 0);
  const shortPnlCents = shortTrades.reduce((acc: number, t: any) => acc + (t.netPnlCents || 0), 0);

  const avgWinCents = winningTrades.length > 0
    ? Math.round(winningTrades.reduce((acc: number, t: any) => acc + t.netPnlCents, 0) / winningTrades.length)
    : 0;
  const avgLossCents = losingTrades.length > 0
    ? Math.round(Math.abs(losingTrades.reduce((acc: number, t: any) => acc + t.netPnlCents, 0)) / losingTrades.length)
    : 0;
  const winLossRatio = avgLossCents > 0 ? (avgWinCents / avgLossCents).toFixed(2) : "—";

  // Instrument cohort breakdown
  const instrumentMap = new Map<string, { count: number; wins: number; pnlCents: number }>();
  for (const t of closedTrades) {
    const sym = t.instrumentSymbol || "Other";
    const prev = instrumentMap.get(sym) || { count: 0, wins: 0, pnlCents: 0 };
    prev.count++;
    if (t.netPnlCents > 0 || t.status === "win") prev.wins++;
    prev.pnlCents += t.netPnlCents || 0;
    instrumentMap.set(sym, prev);
  }
  const instrumentList = Array.from(instrumentMap.entries())
    .map(([sym, stats]) => ({
      symbol: sym,
      trades: stats.count,
      winRate: Math.round((stats.wins / stats.count) * 100),
      pnlCents: stats.pnlCents,
    }))
    .sort((a, b) => b.trades - a.trades);

  // Filtered trades for Trade History tab
  const filteredTrades = trades.filter((t: any) => {
    if (tradeFilter === "win") return t.netPnlCents > 0 || t.status === "win";
    if (tradeFilter === "loss") return t.netPnlCents < 0 || t.status === "loss";
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> All Challenges
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
              {challenge.propFirm}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-medium text-foreground">
              {isPrivate ? "••••••" : maskAccountName(challenge.account?.name || "Account", isPrivate)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPassed && activePhase.phaseType !== "funded" && (
            <Button
              onClick={() => setIsTransitionModalOpen(true)}
              size="sm"
              className="gap-1.5 bg-profit text-profit-foreground hover:bg-profit/90 font-semibold text-xs shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              Activate Next Phase →
            </Button>
          )}

          {isFunded && payoutEligibility.eligible && (
            <Button
              onClick={() => setIsPayoutModalOpen(true)}
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground text-xs font-semibold shadow-sm cursor-pointer"
            >
              <Wallet className="h-4 w-4" />
              Request Payout
            </Button>
          )}

          <Button
            onClick={() => setIsDisputeModalOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            Record Firm Rejection
          </Button>
        </div>
      </div>

      {/* Main Challenge Hero Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-5 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 flex-wrap">
                <span>{challenge.propFirm}</span>
                <span className="text-muted-foreground font-normal">—</span>
                <span className="text-primary">{activePhase.name || challenge.name}</span>
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-xs uppercase px-2.5 py-0.5 font-semibold tracking-wide",
                  isFunded
                    ? "bg-profit/15 text-profit border-profit/30"
                    : isPassed
                    ? "bg-profit/15 text-profit border-profit/30"
                    : isBreached || isFailed
                    ? "bg-loss/15 text-loss border-loss/30"
                    : "bg-primary/10 text-primary border-primary/20"
                )}
              >
                {lifecycle.status?.replace("_", " ")}
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs capitalize">
                {challenge.meta?.accountModel?.replace("_", " ") || "Evaluation"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {lifecycle.statusReason || "Monitoring rules, drawdown, profit targets, and execution compliance."}
            </p>
          </div>

          {/* Phase Sequence Progress Pills */}
          <div className="flex items-center gap-1.5 flex-wrap bg-muted/40 p-1.5 rounded-xl border border-border/60">
            {allPhases.map((phase, idx) => {
              const isCurrent = phase.id === activePhase.id;
              const isCompleted = phase.status === "passed";
              return (
                <div
                  key={phase.id}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-card text-foreground shadow-xs border border-border font-semibold"
                      : isCompleted
                      ? "text-profit hover:bg-card/50"
                      : "text-muted-foreground/70"
                  )}
                >
                  <span className="font-mono text-[10px] opacity-70">{idx + 1}.</span>
                  <span>{phase.name}</span>
                  {isCompleted && <CheckCircle2 className="h-3 w-3 text-profit ml-0.5" />}
                  {isCurrent && phase.status === "breached" && <XCircle className="h-3 w-3 text-loss ml-0.5" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Firm Dispute & Undisclosed Rejection Banner */}
        {isFirmDispute && (
          <div className="rounded-xl border border-loss/40 bg-loss/10 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-loss font-semibold">
              <AlertOctagon className="h-4 w-4 shrink-0" />
              <span>
                {challenge.meta?.firmRejectionDetails?.undisclosedRuleName
                  ? `Firm Rejection: ${challenge.meta.firmRejectionDetails.undisclosedRuleName}`
                  : "Firm rejection — no violation established by currently configured rules."}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {challenge.meta?.firmRejectionDetails?.firmCommunication ||
                "The prop firm rejected this evaluation stage under proprietary or undisclosed review terms, despite all configured risk and drawdown thresholds appearing satisfied locally."}
            </p>
            {challenge.meta?.firmRejectionDetails?.date && (
              <div className="text-[10px] font-mono text-muted-foreground pt-1">
                Recorded Date: {new Date(challenge.meta.firmRejectionDetails.date).toLocaleDateString()} • Verified by user:{" "}
                {challenge.meta.firmRejectionDetails.userVerified ? "Yes" : "Pending Independent Verification"}
              </div>
            )}
          </div>
        )}

        {/* Active Warning Alerts */}
        {warnings.length > 0 && !isFirmDispute && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Active Compliance Warnings ({warnings.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {warnings.map((w: any, idx: number) => (
                <div key={idx} className="bg-card/70 p-2.5 rounded-lg border border-border/60 space-y-0.5">
                  <div className="font-semibold text-foreground">{w.title}</div>
                  <div className="text-muted-foreground text-[11px]">{w.message}</div>
                  {w.remainingAllowance && (
                    <div className="text-[10px] font-mono text-primary font-medium">{w.remainingAllowance}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-time Financial Performance Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {/* 1. Starting Balance */}
          <div className="p-3 rounded-xl border border-border/70 bg-card/60 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Starting Balance</span>
            <div className="text-sm md:text-base font-bold font-mono text-foreground">
              {isPrivate ? "••••••" : formatCents(lifecycle.startingBalanceCents, currency)}
            </div>
          </div>

          {/* 2. Current Equity */}
          <div className="p-3 rounded-xl border border-border/70 bg-card/60 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Current Equity</span>
            <div className="text-sm md:text-base font-bold font-mono text-foreground">
              {isPrivate ? "••••••" : formatCents(lifecycle.currentEquityCents, currency)}
            </div>
          </div>

          {/* 3. Total Net P&L */}
          <div className="p-3 rounded-xl border border-border/70 bg-card/60 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Net P&L</span>
            <div
              className={cn(
                "text-sm md:text-base font-bold font-mono",
                lifecycle.netProfitCents > 0
                  ? "text-profit"
                  : lifecycle.netProfitCents < 0
                  ? "text-loss"
                  : "text-foreground"
              )}
            >
              {isPrivate ? "••••••" : formatSignedCents(lifecycle.netProfitCents, currency).text}
            </div>
          </div>

          {/* 4. Daily Loss Allowance */}
          <div className="p-3 rounded-xl border border-border/70 bg-card/60 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Daily Loss Buffer</span>
            <div className="text-sm md:text-base font-bold font-mono text-foreground">
              {isPrivate ? "••••••" : formatCents(lifecycle.remainingDailyLossCents, currency)}
            </div>
          </div>

          {/* 5. Max Drawdown Buffer */}
          <div className="p-3 rounded-xl border border-border/70 bg-card/60 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Drawdown Buffer</span>
            <div className="text-sm md:text-base font-bold font-mono text-foreground">
              {isPrivate ? "••••••" : formatCents(lifecycle.remainingDrawdownCents, currency)}
            </div>
          </div>

          {/* 6. Trading Days & Win Rate */}
          <div className="p-3 rounded-xl border border-border/70 bg-card/60 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Days & Win Rate</span>
            <div className="text-sm md:text-base font-bold font-mono text-foreground">
              {lifecycle.tradingDaysCount ?? 0}d • {lifecycle.winRate ?? 0}%
            </div>
          </div>
        </div>
      </div>

      {/* 8 Functional Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 md:grid-cols-8 h-auto p-1 bg-muted/70 rounded-xl gap-1">
          <TabsTrigger value="overview" className="text-xs py-2">
            Overview
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs py-2">
            Rules & Compliance
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs py-2">
            Performance
          </TabsTrigger>
          <TabsTrigger value="trades" className="text-xs py-2">
            Trade History
          </TabsTrigger>
          <TabsTrigger value="phases" className="text-xs py-2">
            Phase History
          </TabsTrigger>
          <TabsTrigger value="breaches" className="text-xs py-2">
            Failures & Breaches
          </TabsTrigger>
          <TabsTrigger value="payouts" className="text-xs py-2">
            Payouts
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs py-2">
            Account Settings
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Profit Target Progress */}
            {activePhase.profitTargetCents && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" /> Profit Target
                    </CardTitle>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {isPrivate ? "••••••" : `${formatSignedCents(lifecycle.netProfitCents, currency).text} / ${formatCents(activePhase.profitTargetCents, currency)}`}
                    </span>
                  </div>
                  <CardDescription className="text-xs">
                    Phase Profit Target Progress: {Math.max(0, lifecycle.profitTargetProgressPct || 0)}%
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress
                    value={Math.min(100, Math.max(0, lifecycle.profitTargetProgressPct || 0))}
                    className={cn("h-2.5", lifecycle.profitTargetReached && "[&>div]:bg-profit")}
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                    <span>Target Progress:</span>
                    <span className={cn("font-medium", lifecycle.profitTargetReached ? "text-profit font-semibold" : "text-foreground font-mono")}>
                      {lifecycle.profitTargetReached
                        ? "Target Reached ✓"
                        : `Remaining: ${isPrivate ? "••••••" : formatCents(lifecycle.remainingProfitTargetCents, currency)}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Daily Loss Limit */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" /> Daily Loss Limit
                  </CardTitle>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {isPrivate ? "••••••" : `${formatCents(lifecycle.todayLossCents, currency)} / ${formatCents(lifecycle.dailyLossLimitCents, currency)}`}
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Resets daily at {lifecycle.cycleResetTime || `${challenge.resetHour ?? 17}:00 ${challenge.resetTimezone || "America/New_York"}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress
                  value={Math.min(100, Math.max(0, lifecycle.dailyLossUsedPct || 0))}
                  className={cn(
                    "h-2.5",
                    (lifecycle.dailyLossUsedPct || 0) >= 90
                      ? "[&>div]:bg-loss"
                      : (lifecycle.dailyLossUsedPct || 0) >= 75
                      ? "[&>div]:bg-amber-500"
                      : ""
                  )}
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                  <span>Daily Loss Used: {lifecycle.dailyLossUsedPct || 0}%</span>
                  <span className={cn("font-medium font-mono", lifecycle.dailyLossBreached ? "text-loss font-semibold" : "text-foreground")}>
                    {lifecycle.dailyLossBreached
                      ? "Daily Limit Breached ✕"
                      : `Buffer Remaining Today: ${isPrivate ? "••••••" : formatCents(lifecycle.remainingDailyLossCents, currency)}`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Maximum Drawdown */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-loss" /> Maximum Drawdown
                  </CardTitle>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {isPrivate ? "••••••" : `${formatCents(lifecycle.currentDrawdownCents, currency)} / ${formatCents(lifecycle.maxDrawdownLimitCents, currency)}`}
                  </span>
                </div>
                <CardDescription className="text-xs">
                  {activePhase.drawdownType === "trailing"
                    ? `Trailing from high-water mark (${isPrivate ? "••••••" : formatCents(lifecycle.highWaterMarkCents, currency)}).`
                    : "Static threshold calculated from starting balance."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress
                  value={Math.min(100, Math.max(0, lifecycle.drawdownUsedPct || 0))}
                  className={cn(
                    "h-2.5",
                    (lifecycle.drawdownUsedPct || 0) >= 90
                      ? "[&>div]:bg-loss"
                      : (lifecycle.drawdownUsedPct || 0) >= 75
                      ? "[&>div]:bg-amber-500"
                      : ""
                  )}
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                  <span>Drawdown Consumed: {lifecycle.drawdownUsedPct || 0}%</span>
                  <span className={cn("font-medium font-mono", lifecycle.drawdownBreached ? "text-loss font-semibold" : "text-foreground")}>
                    {lifecycle.drawdownBreached
                      ? "Drawdown Breached ✕"
                      : `Buffer Remaining: ${isPrivate ? "••••••" : formatCents(lifecycle.remainingDrawdownCents, currency)}`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Consistency & Trading Days */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" /> Minimum Days & Consistency
                  </CardTitle>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {lifecycle.tradingDaysCount} / {activePhase.minTradingDays ?? 4} Days
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Requires disciplined execution distribution without extreme single-day profit spikes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Minimum Trading Days:</span>
                  <span className={cn("font-semibold", lifecycle.minDaysMet ? "text-profit" : "text-amber-500")}>
                    {lifecycle.minDaysMet ? "Satisfied ✓" : `${(activePhase.minTradingDays ?? 4) - lifecycle.tradingDaysCount} days remaining`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Best Day Profit Concentration:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {lifecycle.bestDayPctOfTotal !== null ? `${lifecycle.bestDayPctOfTotal}% of total profit` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Profit Factor:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {lifecycle.profitFactor !== null ? lifecycle.profitFactor : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. RULES & COMPLIANCE TAB */}
        <TabsContent value="rules" className="space-y-5">
          {/* Rule Simulator */}
          <RuleSimulatorWidget
            lifecycle={lifecycle}
            activePhase={activePhase}
            currency={currency}
            isPrivate={isPrivate}
          />

          {/* Rule Filter Categories with Counts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-wrap">
              {categories.map((cat) => {
                const count = cat.key === "all"
                  ? rules.length
                  : rules.filter((r) => r.category === cat.key).length;
                return (
                  <Button
                    key={cat.key}
                    variant={ruleCategoryFilter === cat.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRuleCategoryFilter(cat.key)}
                    className="text-xs capitalize h-8 gap-1"
                  >
                    <span>{cat.label}</span>
                    <span className={cn(
                      "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                      ruleCategoryFilter === cat.key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </Button>
                );
              })}
            </div>

            <Button
              onClick={() => setIsRuleModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs self-start sm:self-auto shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Custom Rule
            </Button>
          </div>

          {/* Rules Cards or Rich Contextual Empty State */}
          {filteredRules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center space-y-3">
              <div className="h-10 w-10 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  {ruleCategoryFilter === "payout"
                    ? "No Active Payout Rules in Current Stage"
                    : `No Rules Found for "${ruleCategoryFilter.replace("_", " ")}"`}
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  {ruleCategoryFilter === "payout"
                    ? "Payout withdrawal rules activate upon successfully passing evaluation phases and entering the Funded Stage. You can inspect payout eligibility, splits, and history on the Payouts tab."
                    : `There are currently no rules configured under the ${ruleCategoryFilter.replace("_", " ")} category for ${activePhase.name}.`}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                {ruleCategoryFilter === "payout" && (
                  <Button size="sm" onClick={() => setActiveTab("payouts")} className="text-xs gap-1.5 cursor-pointer">
                    <Wallet className="h-3.5 w-3.5" /> View Payouts Tab
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setRuleCategoryFilter("all")} className="text-xs cursor-pointer">
                  Show All Rules ({rules.length})
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRules.map((rule) => {
                const statusVariant: Record<RuleStatus, { label: string; badgeClass: string; icon: any }> = {
                  passed: { label: "Passed", badgeClass: "bg-profit/15 text-profit border-profit/30", icon: CheckCircle2 },
                  violated: { label: "Violated", badgeClass: "bg-loss/15 text-loss border-loss/30", icon: XCircle },
                  at_risk: { label: "At Risk", badgeClass: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: AlertTriangle },
                  unknown: { label: "Unknown", badgeClass: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
                  unverified: { label: "Unverified (External Audit)", badgeClass: "bg-purple-500/15 text-purple-600 border-purple-500/30", icon: HelpCircle },
                  not_applicable: { label: "N/A", badgeClass: "bg-muted/50 text-muted-foreground/60 border-border/50", icon: Info },
                };

                const currentStatus = statusVariant[rule.status] || statusVariant.unknown;
                const StatusIcon = currentStatus.icon;

                return (
                  <Card key={rule.id} className="relative overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                            {rule.name}
                          </CardTitle>
                          <CardDescription className="text-xs leading-relaxed">
                            {rule.description}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] font-mono shrink-0 gap-1", currentStatus.badgeClass)}>
                          <StatusIcon className="h-3 w-3" />
                          {currentStatus.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 space-y-1">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground/80">Calculation Method</div>
                        <div className="text-foreground text-[11px] leading-relaxed">{rule.calculationMethod}</div>
                      </div>

                      {rule.statusExplanation && (
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Status Note:</span> {rule.statusExplanation}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                        <span>Source: <strong className="text-foreground capitalize">{rule.ruleSource?.replace("_", " ")}</strong></span>
                        <span>Evaluated: {new Date(rule.lastEvaluatedAt).toLocaleTimeString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 3. PERFORMANCE TAB */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">{lifecycle.winRate ?? 0}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {lifecycle.winCount ?? 0} wins / {lifecycle.tradeCount ?? 0} total trades
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Profit Factor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {lifecycle.profitFactor !== null ? lifecycle.profitFactor : "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Gross Win / Gross Loss ratio</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Best Day Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-profit">
                  {isPrivate ? "••••••" : formatCents(lifecycle.bestDayProfitCents, currency)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {lifecycle.bestDayPctOfTotal !== null ? `${lifecycle.bestDayPctOfTotal}% of total profit` : "No profit yet"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Executed Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">{lifecycle.tradeCount ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {lifecycle.breakevenCount ?? 0} breakeven / {lifecycle.lossCount ?? 0} losses
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Directional & Cohort Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Directional Performance (Long vs Short)</CardTitle>
                <CardDescription className="text-xs">Performance segmentation across position sides</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-profit">Long Positions ({longTrades.length})</span>
                    <span className="font-mono font-bold text-profit">{longWinRate}% WR</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Long Net P&L:</span>
                    <span className={cn("font-mono font-semibold", longPnlCents >= 0 ? "text-profit" : "text-loss")}>
                      {isPrivate ? "••••••" : formatSignedCents(longPnlCents, currency).text}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-loss">Short Positions ({shortTrades.length})</span>
                    <span className="font-mono font-bold text-loss">{shortWinRate}% WR</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Short Net P&L:</span>
                    <span className={cn("font-mono font-semibold", shortPnlCents >= 0 ? "text-profit" : "text-loss")}>
                      {isPrivate ? "••••••" : formatSignedCents(shortPnlCents, currency).text}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Win/Loss Payoff Ratio</CardTitle>
                <CardDescription className="text-xs">Average win versus average loss magnitude</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-border/50 bg-muted/20">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono block">Average Win</span>
                    <div className="text-base font-bold font-mono text-profit mt-0.5">
                      {isPrivate ? "••••••" : formatCents(avgWinCents, currency)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-border/50 bg-muted/20">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono block">Average Loss</span>
                    <div className="text-base font-bold font-mono text-loss mt-0.5">
                      {isPrivate ? "••••••" : formatCents(avgLossCents, currency)}
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-border/50 bg-muted/20 flex justify-between items-center">
                  <span className="text-muted-foreground">Reward-to-Risk Payoff Ratio:</span>
                  <span className="font-mono font-bold text-foreground text-sm">{winLossRatio}:1</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Traded Instruments */}
          {instrumentList.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Instrument Breakdown</CardTitle>
                <CardDescription className="text-xs">Executed volume and profitability by market symbol</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                      <tr>
                        <th className="py-2 px-3">Symbol</th>
                        <th className="py-2 px-3">Trades</th>
                        <th className="py-2 px-3">Win Rate</th>
                        <th className="py-2 px-3 text-right">Net P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {instrumentList.map((inst) => (
                        <tr key={inst.symbol} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-semibold text-foreground">{inst.symbol}</td>
                          <td className="py-2 px-3 font-mono">{inst.trades}</td>
                          <td className="py-2 px-3 font-mono">{inst.winRate}%</td>
                          <td className={cn("py-2 px-3 text-right font-mono font-semibold", inst.pnlCents >= 0 ? "text-profit" : "text-loss")}>
                            {isPrivate ? "••••••" : formatSignedCents(inst.pnlCents, currency).text}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 4. TRADE HISTORY TAB */}
        <TabsContent value="trades" className="space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm">Phase Trade Executions ({trades.length})</h3>
                <p className="text-xs text-muted-foreground">
                  Executed trades recorded for this challenge during {activePhase.name}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50 text-xs">
                  <button
                    onClick={() => setTradeFilter("all")}
                    className={cn("px-2 py-0.5 rounded transition-colors text-[11px]", tradeFilter === "all" ? "bg-card font-semibold text-foreground shadow-xs" : "text-muted-foreground")}
                  >
                    All ({trades.length})
                  </button>
                  <button
                    onClick={() => setTradeFilter("win")}
                    className={cn("px-2 py-0.5 rounded transition-colors text-[11px]", tradeFilter === "win" ? "bg-card font-semibold text-profit shadow-xs" : "text-muted-foreground")}
                  >
                    Wins ({winningTrades.length})
                  </button>
                  <button
                    onClick={() => setTradeFilter("loss")}
                    className={cn("px-2 py-0.5 rounded transition-colors text-[11px]", tradeFilter === "loss" ? "bg-card font-semibold text-loss shadow-xs" : "text-muted-foreground")}
                  >
                    Losses ({losingTrades.length})
                  </button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (challenge.accountId) {
                      useNav.getState().setSelectedAccountId(challenge.accountId);
                    }
                    navigate("tradesLog", {
                      accountId: challenge.accountId || "",
                      propChallengeId: challenge.id,
                      propChallengeName: challenge.name,
                      propFirm: challenge.propFirm,
                      phase: activePhase?.name,
                    });
                  }}
                  className="text-xs gap-1 cursor-pointer"
                >
                  Full Log <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {filteredTrades.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No trades match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4">Symbol</th>
                      <th className="py-2.5 px-4">Direction</th>
                      <th className="py-2.5 px-4">Size</th>
                      <th className="py-2.5 px-4">Entry / Exit</th>
                      <th className="py-2.5 px-4 text-right">Net P&L</th>
                      <th className="py-2.5 px-4 text-center">Compliance Impact</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTrades.map((t: any) => {
                      const pnl = formatSignedCents(t.netPnlCents, currency);
                      const isWin = t.netPnlCents > 0 || t.status === "win";
                      const isLoss = t.netPnlCents < 0 || t.status === "loss";

                      return (
                        <tr key={t.id} className="hover:bg-muted/20">
                          <td className="py-2.5 px-4 font-semibold text-foreground">{t.instrumentSymbol || "—"}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={cn(
                                "font-mono uppercase text-[10px] px-1.5 py-0.5 rounded",
                                t.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                              )}
                            >
                              {t.direction}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono">{t.positionSize || "—"}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {t.entryTime ? new Date(t.entryTime).toLocaleDateString() : "—"}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 px-4 text-right font-mono font-semibold",
                              pnl.isPositive ? "text-profit" : pnl.isNegative ? "text-loss" : "text-foreground"
                            )}
                          >
                            {isPrivate ? "••••••" : pnl.text}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {isWin ? (
                              <span className="font-mono text-[10px] text-profit bg-profit/10 px-1.5 py-0.5 rounded font-medium">
                                HWM +${(t.netPnlCents / 100).toFixed(0)}
                              </span>
                            ) : isLoss ? (
                              <span className="font-mono text-[10px] text-loss bg-loss/10 px-1.5 py-0.5 rounded font-medium">
                                Daily Loss -${(Math.abs(t.netPnlCents) / 100).toFixed(0)}
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                Neutral
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {t.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 5. PHASE HISTORY TAB */}
        <TabsContent value="phases" className="space-y-4">
          <div className="space-y-4">
            {allPhases.map((phase, idx) => {
              const isCurrent = phase.id === activePhase.id;
              const snapshot: PropPhaseSnapshot | undefined = phase.snapshot;
              const isFundedPhase = phase.phaseType === "funded";

              return (
                <Card
                  key={phase.id}
                  className={cn(
                    "relative overflow-hidden transition-all",
                    isFundedPhase
                      ? "border-amber-500/40 bg-gradient-to-r from-amber-500/5 via-card to-card shadow-xs"
                      : isCurrent && "border-primary/50 shadow-sm"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center font-mono font-bold text-xs",
                            isFundedPhase
                              ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-semibold">{phase.name}</CardTitle>
                            {isFundedPhase && (
                              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 text-[10px] py-0 font-semibold flex items-center gap-1">
                                <Award className="h-2.5 w-2.5" /> Funded Account
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">
                            Type: <strong className="capitalize text-foreground">{phase.phaseType}</strong> • Status:{" "}
                            <strong className="capitalize text-foreground">{phase.status}</strong>
                            {phase.activationDate && (
                              <span> • Activated: <strong>{new Date(phase.activationDate).toLocaleDateString()}</strong></span>
                            )}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isFundedPhase ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedFundedPhase(phase)}
                              className="h-7 text-xs gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer font-medium"
                            >
                              <Award className="h-3.5 w-3.5" />
                              Inspect Funded Details →
                            </Button>
                            {isCurrent && (
                              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                Active Live Capital
                              </Badge>
                            )}
                          </>
                        ) : isCurrent ? (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                            Active Phase
                          </Badge>
                        ) : phase.status === "passed" ? (
                          <Badge variant="outline" className="text-xs bg-profit/15 text-profit border-profit/30 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Passed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                            Awaiting Activation
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    {/* Phase configured parameters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-mono">Starting Balance</div>
                        <div className="font-mono font-semibold text-foreground">
                          {isPrivate ? "••••••" : formatCents(phase.startingBalanceCents, currency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-mono">Profit Target</div>
                        <div className="font-mono font-semibold text-foreground">
                          {phase.profitTargetCents ? formatCents(phase.profitTargetCents, currency) : "None (Funded)"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-mono">Daily Loss Limit</div>
                        <div className="font-mono font-semibold text-foreground">
                          {formatCents(phase.dailyLossLimitCents, currency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-mono">Max Drawdown</div>
                        <div className="font-mono font-semibold text-foreground">
                          {formatCents(phase.maxDrawdownCents, currency)} ({phase.drawdownType})
                        </div>
                      </div>
                    </div>

                    {/* Historical Snapshot if completed */}
                    {snapshot ? (
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span className="font-semibold text-foreground">Preserved Historical Completion Snapshot:</span>
                          <span className="font-mono">Completed: {new Date(snapshot.completedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <span className="text-[10px] text-muted-foreground block font-mono uppercase">Final Balance</span>
                            <strong className="font-mono text-foreground">{isPrivate ? "••••••" : formatCents(snapshot.finalBalanceCents, currency)}</strong>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <span className="text-[10px] text-muted-foreground block font-mono uppercase">Net Profit</span>
                            <strong className="font-mono text-profit">{isPrivate ? "••••••" : formatSignedCents(snapshot.netProfitCents, currency).text}</strong>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <span className="text-[10px] text-muted-foreground block font-mono uppercase">Win Rate & Trades</span>
                            <strong className="font-mono text-foreground">{snapshot.winRate}% ({snapshot.tradeCount} trades)</strong>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <span className="text-[10px] text-muted-foreground block font-mono uppercase">Trading Days</span>
                            <strong className="font-mono text-foreground">{snapshot.tradingDaysCount ?? "—"} days</strong>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <span className="text-[10px] text-muted-foreground block font-mono uppercase">Rules Passed</span>
                            <strong className="font-mono text-foreground">{snapshot.rulesPassedCount} / {snapshot.rulesTotalCount}</strong>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <span className="text-[10px] text-muted-foreground block font-mono uppercase">Calculation Basis</span>
                            <strong className="font-mono text-foreground capitalize">{snapshot.calculationMethods?.drawdownType || phase.drawdownType} ({snapshot.calculationMethods?.drawdownBasis || phase.drawdownBasis})</strong>
                          </div>
                        </div>
                      </div>
                    ) : isCurrent ? (
                      <div className="p-2.5 rounded-lg bg-primary/5 text-primary text-xs flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Active phase in progress. Trades and metrics update this phase in real-time.</span>
                      </div>
                    ) : null}

                    {/* Phase actions bar */}
                    <div className="pt-2 flex items-center justify-between border-t border-border/40 text-xs">
                      <div className="text-muted-foreground text-[11px]">
                        {isFundedPhase
                          ? `Live funded capital instance · ${phase.activationDate ? `Activated: ${new Date(phase.activationDate).toLocaleDateString()}` : "Active"}`
                          : snapshot
                          ? `Completed phase · ${snapshot.tradeCount} historical trades logged`
                          : "Active evaluation stage"}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const targetAcc = (phase as any).tradingAccountId || (snapshot as any)?.tradingAccountId || challenge.accountId || "";
                          if (targetAcc) {
                            useNav.getState().setSelectedAccountId(targetAcc);
                          }
                          navigate("tradesLog", {
                            accountId: targetAcc,
                            propChallengeId: challenge.id,
                            propChallengeName: challenge.name,
                            propFirm: challenge.propFirm,
                            phase: snapshot?.phaseName || phase.name,
                          });
                        }}
                        className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 cursor-pointer font-medium"
                      >
                        View Phase Trades <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* 6. FAILURES & BREACHES TAB */}
        <TabsContent value="breaches" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">Violation Investigation & Failure Diagnosis</h3>
              <p className="text-xs text-muted-foreground">
                Authoritative audit records of any parameter breaches, calculated values, and contributing trades.
              </p>
            </div>
            <Button
              onClick={() => setIsDisputeModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-loss border-loss/30 hover:bg-loss/10 cursor-pointer"
            >
              <ShieldAlert className="h-4 w-4" /> Record Firm Rejection
            </Button>
          </div>

          {violations.length === 0 && !isFirmDispute ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-profit mx-auto" />
              <div className="font-semibold text-sm text-foreground">Zero Violations Established</div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No risk or drawdown rules have been breached on this account. All trading parameters remain within safe thresholds.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {isFirmDispute && (
                <Card className="border-loss/50 bg-card overflow-hidden shadow-xs">
                  <CardHeader className="bg-loss/10 pb-3 border-b border-loss/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-semibold text-loss flex items-center gap-2">
                          <AlertOctagon className="h-4 w-4" />
                          {challenge.meta?.firmRejectionDetails?.undisclosedRuleName
                            ? `Firm Rejection: ${challenge.meta.firmRejectionDetails.undisclosedRuleName}`
                            : "Firm rejection — no violation established by currently configured rules."}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Category: <strong>Proprietary / External Firm Review</strong> • Severity:{" "}
                          <strong className="uppercase font-mono text-loss">DISPUTE / REJECTION</strong>
                        </CardDescription>
                      </div>
                      {challenge.meta?.firmRejectionDetails?.date && (
                        <div className="text-right text-[11px] font-mono text-muted-foreground">
                          {new Date(challenge.meta.firmRejectionDetails.date).toLocaleString()} ({challenge.resetTimezone || "America/New_York"})
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Local Rule Compliance</div>
                        <div className="font-mono font-bold text-profit text-sm">All Configured Rules Passed</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Firm Outcome</div>
                        <div className="font-mono font-bold text-loss text-sm">Account Rejected / Suspended</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Dispute Status</div>
                        <div className="font-mono font-bold text-foreground text-sm">
                          {challenge.meta?.firmRejectionDetails?.userVerified ? "Verified by Trader" : "Under Investigation"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="font-semibold text-foreground text-[11px]">Firm Explanation & Communication Record</div>
                      <p className="text-muted-foreground leading-relaxed text-xs bg-muted/20 p-3 rounded-lg border border-border/60">
                        {challenge.meta?.firmRejectionDetails?.firmCommunication ||
                          "Firm rejected the account under discretionary or undisclosed review terms, despite all configured risk and drawdown rules passing."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {violations.map((violation) => (
                <Card key={violation.id} className="border-loss/40 bg-card overflow-hidden">
                  <CardHeader className="bg-loss/5 pb-3 border-b border-loss/20">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-semibold text-loss flex items-center gap-2">
                          <XCircle className="h-4 w-4" /> {violation.ruleName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Category: <strong className="capitalize">{violation.category}</strong> • Severity:{" "}
                          <strong className="uppercase font-mono">{violation.severity}</strong>
                        </CardDescription>
                      </div>
                      <div className="text-right text-[11px] font-mono text-muted-foreground">
                        {new Date(violation.occurredAt).toLocaleString()} ({violation.firmTimezone})
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    {/* Exact Threshold vs Actual vs Amount Exceeded */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Required Limit</div>
                        <div className="font-mono font-bold text-foreground text-sm">{violation.requiredThreshold}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Actual Result</div>
                        <div className="font-mono font-bold text-loss text-sm">{violation.actualValue}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Amount Exceeded</div>
                        <div className="font-mono font-bold text-loss text-sm">{violation.amountExceeded}</div>
                      </div>
                    </div>

                    {/* Calculation Explanation */}
                    <div className="space-y-1">
                      <div className="font-semibold text-foreground text-[11px]">Calculation Explanation</div>
                      <p className="text-muted-foreground leading-relaxed text-xs">
                        {violation.calculationExplanation}
                      </p>
                    </div>

                    {/* Contributing Trades */}
                    {violation.contributingTradeIds && violation.contributingTradeIds.length > 0 && (
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground text-[11px]">Contributing Trade IDs</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {violation.contributingTradeIds.map((tid) => (
                            <Badge key={tid} variant="secondary" className="font-mono text-[10px]">
                              {tid}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 7. PAYOUTS TAB */}
        <TabsContent value="payouts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Payout Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold uppercase px-2 py-0.5",
                      payoutEligibility.eligible
                        ? "bg-profit/15 text-profit border-profit/30"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {payoutEligibility.eligible ? "Eligible" : "Not Eligible"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed pt-1">
                  {payoutEligibility.reason}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Available Trader Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-profit">
                  {isPrivate ? "••••••" : formatCents(payoutEligibility.traderShareCents, currency)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {challenge.meta?.payoutConfig?.profitSplitPct || 80}% Trader Split
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Firm Profit Share</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {isPrivate ? "••••••" : formatCents(payoutEligibility.firmShareCents, currency)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {100 - (challenge.meta?.payoutConfig?.profitSplitPct || 80)}% Prop Firm Share
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payout History Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-sm">Payout Requests & Withdrawals</h4>
                <p className="text-xs text-muted-foreground">Complete historical ledger of requested and processed disbursements.</p>
              </div>
              {payoutEligibility.eligible && (
                <Button size="sm" onClick={() => setIsPayoutModalOpen(true)} className="text-xs gap-1 cursor-pointer">
                  <Wallet className="h-3.5 w-3.5" /> Request Payout
                </Button>
              )}
            </div>

            {payouts.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No payouts requested on this account yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4">Requested Date</th>
                      <th className="py-2.5 px-4 text-right">Gross Amount</th>
                      <th className="py-2.5 px-4 text-right">Net Trader Received</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-4 font-mono">{new Date(p.requestedAt).toLocaleDateString()}</td>
                        <td className="py-2.5 px-4 text-right font-mono">{formatCents(p.amountCents, currency)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-profit">
                          {formatCents(p.netTraderPayoutCents, currency)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase font-mono",
                              p.status === "paid" ? "bg-profit/15 text-profit" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">{p.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 8. ACCOUNT SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-4">
          {/* Account Connection & Sizing Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Account Connection & Isolation</CardTitle>
              <CardDescription className="text-xs">
                Manage the linked trading account for this challenge. Each challenge requires its own dedicated account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                <div className="text-[11px] font-semibold text-foreground">Currently Linked Trading Account:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">Account Name</span>
                    <div className="font-bold text-foreground text-xs mt-0.5">{challenge.account?.name || "Unlinked"}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">Account ID</span>
                    <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">{challenge.account?.id}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">Currency & Balance</span>
                    <div className="font-mono font-bold text-foreground text-xs mt-0.5">
                      {challenge.account?.currency} {formatCents(challenge.account?.currentBalanceCents, challenge.account?.currency)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Re-bind to another account */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs font-semibold">Switch Linked Trading Account</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={selectedAccountId || challenge.account?.id}
                    onValueChange={setSelectedAccountId}
                  >
                    <SelectTrigger className="h-9 text-xs w-full sm:w-80">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAccounts.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.currency || "USD"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    disabled={!selectedAccountId || selectedAccountId === challenge.account?.id || patchMutation.isPending}
                    onClick={() => {
                      if (confirm(`Switch linked account for "${challenge.name}" to the selected account?`)) {
                        patchMutation.mutate({ accountId: selectedAccountId });
                      }
                    }}
                    className="h-9 text-xs cursor-pointer"
                  >
                    Update Linked Account
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Switching linked accounts safely migrates this challenge to monitor the new account's trade history.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Prop Challenge Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Prop Challenge Parameters</CardTitle>
              <CardDescription className="text-xs">
                Review challenge timezone, daily reset schedule, and firm information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Challenge Name</Label>
                  <Input defaultValue={challenge.name} className="h-9" readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Prop Firm</Label>
                  <Input defaultValue={challenge.propFirm} className="h-9" readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Daily Reset Timezone</Label>
                  <Input defaultValue={challenge.resetTimezone || "America/New_York"} className="h-9" readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Reset Hour (0-23)</Label>
                  <Input defaultValue={challenge.resetHour ?? 17} className="h-9" readOnly />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Transition Phase Confirmation */}
      <Dialog open={isTransitionModalOpen} onOpenChange={setIsTransitionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-profit">
              <CheckCircle2 className="h-5 w-5" /> Confirm Phase Transition
            </DialogTitle>
            <DialogDescription className="text-xs">
              You have fulfilled all profit and compliance criteria for {activePhase.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 text-xs space-y-3">
            <p className="leading-relaxed">
              Transitioning will mark <strong>{activePhase.name}</strong> as completed, freeze its metrics into a permanent historical snapshot, and activate the subsequent stage.
            </p>

            <div className="space-y-2 p-3 rounded-lg border border-border/70 bg-muted/30">
              <Label className="text-xs font-semibold">Balance Policy for Next Stage:</Label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="policy"
                    checked={transitionPolicy === "carry_forward"}
                    onChange={() => setTransitionPolicy("carry_forward")}
                    className="h-3.5 w-3.5"
                  />
                  <span><strong>Carry Forward</strong> current balance to subsequent phase</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="policy"
                    checked={transitionPolicy === "fresh_baseline"}
                    onChange={() => setTransitionPolicy("fresh_baseline")}
                    className="h-3.5 w-3.5"
                  />
                  <span><strong>Fresh Baseline</strong> (reset to stage initial starting balance)</span>
                </label>
              </div>
            </div>

            {availableAccounts.length > 0 && (
              <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-muted/30">
                <Label className="text-xs font-semibold">Separate Funded Account Instance (Optional):</Label>
                <p className="text-[11px] text-muted-foreground">
                  If your firm issued a new funded account number, select it below or keep the existing account.
                </p>
                <Select value={selectedAccountId || challenge.accountId || ""} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Keep current linked account" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.currency || "USD"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsTransitionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                patchMutation.mutate({
                  action: "transition_phase",
                  confirmed: true,
                  policy: transitionPolicy,
                  fundedAccountId: selectedAccountId || undefined,
                })
              }
              disabled={patchMutation.isPending}
              className="bg-profit text-profit-foreground font-semibold cursor-pointer"
            >
              Confirm & Activate Next Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Record Firm Rejection & Dispute */}
      <Dialog open={isDisputeModalOpen} onOpenChange={setIsDisputeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-loss">
              <ShieldAlert className="h-5 w-5" /> Record Firm Rejection / Dispute
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record prop firm rejection reasons, undisclosed rule clauses, or investigation details.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3 text-xs">
            <div className="space-y-1">
              <Label>Undisclosed Rule / Violation Name (Optional)</Label>
              <Input
                placeholder="e.g. Latency Arbitrage Clause, Single-Ticket Invalidation"
                value={undisclosedRule}
                onChange={(e) => setUndisclosedRule(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label>Firm Communication / Rejection Explanation</Label>
              <Textarea
                placeholder="Paste the firm's email, rejection notice, or ticket explanation..."
                value={firmComm}
                onChange={(e) => setFirmComm(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="userVerified"
                checked={userVerifiedDispute}
                onChange={(e) => setUserVerifiedDispute(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="userVerified" className="cursor-pointer">
                I have independently reviewed and verified this explanation
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDisputeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                patchMutation.mutate({
                  action: "record_firm_rejection",
                  firmCommunication: firmComm,
                  undisclosedRuleName: undisclosedRule,
                  userVerified: userVerifiedDispute,
                })
              }
              disabled={!firmComm.trim() || patchMutation.isPending}
              className="bg-loss text-loss-foreground cursor-pointer"
            >
              Record Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Payout Request */}
      <Dialog open={isPayoutModalOpen} onOpenChange={setIsPayoutModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Wallet className="h-5 w-5" /> Request Profit Split Payout
            </DialogTitle>
            <DialogDescription className="text-xs">
              Disburse accumulated profits from your funded account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3 text-xs">
            <div className="space-y-1">
              <Label>Withdrawal Amount (Gross $)</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="h-9"
              />
            </div>
            {Number(payoutAmount) > 0 && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trader Net Received ({challenge.meta?.payoutConfig?.profitSplitPct || 80}%):</span>
                  <span className="font-bold font-mono text-profit">
                    {formatCents(Math.round(Number(payoutAmount) * 100 * ((challenge.meta?.payoutConfig?.profitSplitPct || 80) / 100)), currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prop Firm Retained Share:</span>
                  <span className="font-mono text-muted-foreground">
                    {formatCents(Math.round(Number(payoutAmount) * 100 * (1 - (challenge.meta?.payoutConfig?.profitSplitPct || 80) / 100)), currency)}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Notes / Bank / Crypto Reference</Label>
              <Input
                placeholder="e.g. Deel invoice #104, USDT TRC20"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsPayoutModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                patchMutation.mutate({
                  action: "request_payout",
                  amountCents: Math.round(Number(payoutAmount) * 100),
                  notes: payoutNotes,
                })
              }
              disabled={Number(payoutAmount) <= 0 || patchMutation.isPending}
              className="cursor-pointer"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: Funded Phase Inspection & History */}
      <FundedPhaseDetailModal
        open={Boolean(selectedFundedPhase)}
        onOpenChange={(open) => !open && setSelectedFundedPhase(null)}
        challenge={challenge}
        phase={selectedFundedPhase || activePhase}
        lifecycle={lifecycle}
      />
    </div>
  );
}
