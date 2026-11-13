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
}

export function PropChallengesSection({ accounts }: PropChallengesSectionProps) {
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
  }

  function handleOpenCreate() {
    resetForm();
    if (accounts.length > 0) {
      setAccountId(accounts[0].id);
      setStartingBalance((accounts[0].startingBalanceCents / 100).toString());
    }
    setIsModalOpen(true);
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

    createMutation.mutate({
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
    });
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
    <div className="space-y-4 pt-6 border-t border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

      {challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
          <Trophy className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <h4 className="text-sm font-semibold text-foreground">No active challenge trackers</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Connect an evaluation account to track profit target, daily loss cutoff time, and static or trailing drawdown.
          </p>
          <Button onClick={handleOpenCreate} variant="outline" size="sm" className="mt-3">
            Track a Challenge
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {challenges.map((c) => {
            const m = c.metrics;
            const currency = c.account.currency || "USD";
            const targetPct = m.profitTargetProgressPct ?? 0;
            const dailyPct = m.dailyLossUsedPct ?? 0;
            const ddPct = m.drawdownUsedPct ?? 0;

            return (
              <div
                key={c.id}
                className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-4 flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-base">{c.name}</span>
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider">
                        {c.propFirm}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.stage.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Linked: <span className="font-medium text-foreground">{c.account.name}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(m)}
                    <button
                      onClick={() => {
                        if (confirm(`Delete challenge "${c.name}"?`)) {
                          deleteMutation.mutate(c.id);
                        }
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-rose-500 transition-colors ml-1"
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

      {/* New Challenge Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Track Prop Firm Challenge</DialogTitle>
            <DialogDescription>
              Configure evaluation target, daily loss limit, and drawdown rules.
            </DialogDescription>
          </DialogHeader>

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
                  placeholder="e.g. FTMO, FundingPips"
                  value={propFirm}
                  onChange={(e) => setPropFirm(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Name & Stage */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tracker Name</Label>
                <Input
                  placeholder="e.g. 100k Challenge"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phase1">Phase 1 (Step 1)</SelectItem>
                    <SelectItem value="phase2">Phase 2 (Verification)</SelectItem>
                    <SelectItem value="funded">Funded Account</SelectItem>
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
                  placeholder="100000"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Profit Target (%)</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={profitTargetPct}
                  onChange={(e) => setProfitTargetPct(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Daily Loss & Max Drawdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Daily Loss Limit (%)</Label>
                <Input
                  type="number"
                  placeholder="5"
                  value={dailyLossLimitPct}
                  onChange={(e) => setDailyLossLimitPct(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Max Drawdown (%)</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={maxDrawdownPct}
                  onChange={(e) => setMaxDrawdownPct(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Drawdown Type & Min Days */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Drawdown Calculation</Label>
                <Select value={drawdownType} onValueChange={setDrawdownType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static (from Initial Balance)</SelectItem>
                    <SelectItem value="trailing">Trailing (High-Water Mark)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Minimum Trading Days</Label>
                <Input
                  type="number"
                  placeholder="4"
                  value={minTradingDays}
                  onChange={(e) => setMinTradingDays(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Timezone & Reset Hour */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Daily Reset Timezone</Label>
                <Select value={resetTimezone} onValueChange={setResetTimezone}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">America/New York (ET)</SelectItem>
                    <SelectItem value="UTC">UTC / GMT</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Europe/Prague">Europe/Prague (CE(S)T)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Reset Hour (0–23)</Label>
                <Input
                  type="number"
                  placeholder="17"
                  value={resetHour}
                  onChange={(e) => setResetHour(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              Create Tracker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

