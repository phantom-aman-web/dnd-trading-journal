"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Wallet,
  Calendar,
  DollarSign,
  Award,
  ArrowUpRight,
  History,
  FileText,
  Percent,
} from "lucide-react";
import { usePrivacyStore, maskAccountName } from "@/lib/privacy-store";
import { useNav } from "@/lib/nav-store";
import { formatProfitFactor } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  PropPhaseConfig,
  PropRuleDefinition,
  PropPayoutRecord,
  PropLifecycleEvent,
  PropViolationRecord,
  PropLifecycleEvaluationResult,
} from "@/lib/prop-lifecycle-engine";

interface FundedPhaseDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: any;
  phase: PropPhaseConfig;
  lifecycle: PropLifecycleEvaluationResult;
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

function formatSignedCents(cents: number | null | undefined, currency = "USD"): { text: string; isPositive: boolean } {
  if (cents === null || cents === undefined) return { text: "—", isPositive: false };
  const dollars = cents / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(dollars));
  return {
    text: cents > 0 ? `+ ${formatted}` : cents < 0 ? `- ${formatted}` : formatted,
    isPositive: cents > 0,
  };
}

export function FundedPhaseDetailModal({
  open,
  onOpenChange,
  challenge,
  phase,
  lifecycle,
}: FundedPhaseDetailModalProps) {
  const { navigate } = useNav();
  const isPrivate = usePrivacyStore((s) => s.isPrivate);
  const [activeTab, setActiveTab] = useState<string>("overview");

  const currency = challenge.currency || challenge.account?.currency || "USD";
  const rules = phase.rules || challenge.rules || lifecycle.rules || [];
  const payouts: PropPayoutRecord[] = challenge.payouts || challenge.meta?.payouts || [];
  const events: PropLifecycleEvent[] = challenge.events || lifecycle.events || challenge.meta?.events || [];
  const violations: PropViolationRecord[] = challenge.violations || lifecycle.violations || [];

  const startingBalanceCents = phase.startingBalanceCents || challenge.startingBalanceCents || 10000000;
  const currentBalanceCents = lifecycle.currentBalanceCents;
  const currentEquityCents = lifecycle.currentEquityCents;
  const netProfitCents = lifecycle.netProfitCents;
  const highWaterMarkCents = lifecycle.highWaterMarkCents;
  const maxDrawdownCents = phase.maxDrawdownCents ?? challenge.maxDrawdownCents;
  const dailyLossLimitCents = phase.dailyLossLimitCents ?? challenge.dailyLossLimitCents;

  const totalPaidPayouts = payouts
    .filter((p) => p.status === "paid" || p.status === "approved")
    .reduce((acc, p) => acc + p.netTraderPayoutCents, 0);

  const totalPendingPayouts = payouts
    .filter((p) => p.status === "requested")
    .reduce((acc, p) => acc + p.netTraderPayoutCents, 0);

  const profitSplitPct = challenge.meta?.profitSplitPct || 80;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scroll-thin p-0 border border-border/80">
        {/* Header with Funded Badge & Distinction */}
        <div className="bg-gradient-to-r from-amber-500/10 via-card to-card border-b border-border/60 p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold">
                    {challenge.propFirm} Funded Master Account
                  </DialogTitle>
                  <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 text-[11px] font-semibold">
                    Funded Live Capital
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Complete historical record, live compliance intelligence, and payout reconciliation for {phase.name}.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  const targetAcc = (phase as any).tradingAccountId || challenge.accountId || "";
                  if (targetAcc) {
                    useNav.getState().setSelectedAccountId(targetAcc);
                  }
                  navigate("tradesLog", {
                    accountId: targetAcc,
                    propChallengeId: challenge.id,
                    propChallengeName: challenge.name,
                    propFirm: challenge.propFirm,
                    phase: phase.name,
                  });
                }}
                className="text-xs gap-1.5 h-8 font-medium cursor-pointer"
              >
                <span>View Phase Trades</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <div className="text-[10px] text-muted-foreground uppercase font-mono">Current Balance</div>
              <div className="text-sm font-bold font-mono text-foreground">
                {isPrivate ? "••••••" : formatCents(currentBalanceCents, currency)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <div className="text-[10px] text-muted-foreground uppercase font-mono">Total Net P&L</div>
              <div className={cn("text-sm font-bold font-mono", netProfitCents >= 0 ? "text-profit" : "text-loss")}>
                {isPrivate ? "••••••" : formatSignedCents(netProfitCents, currency).text}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <div className="text-[10px] text-muted-foreground uppercase font-mono">Payouts Distributed</div>
              <div className="text-sm font-bold font-mono text-profit">
                {isPrivate ? "••••••" : formatCents(totalPaidPayouts, currency)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <div className="text-[10px] text-muted-foreground uppercase font-mono">Compliance Status</div>
              <div className="text-sm font-bold font-mono capitalize text-primary flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {lifecycle.status}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs (8 Core Sections) */}
        <div className="p-6 pt-3 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-4 sm:grid-cols-8 h-auto p-1 bg-muted/40 gap-1 border border-border/40">
              <TabsTrigger value="overview" className="text-[11px] py-1.5">Overview</TabsTrigger>
              <TabsTrigger value="financials" className="text-[11px] py-1.5">Financials</TabsTrigger>
              <TabsTrigger value="rules" className="text-[11px] py-1.5">Rules ({rules.length})</TabsTrigger>
              <TabsTrigger value="trades" className="text-[11px] py-1.5">Trades ({lifecycle.tradeCount})</TabsTrigger>
              <TabsTrigger value="risk" className="text-[11px] py-1.5">Drawdown</TabsTrigger>
              <TabsTrigger value="payouts" className="text-[11px] py-1.5">Payouts ({payouts.length})</TabsTrigger>
              <TabsTrigger value="events" className="text-[11px] py-1.5">Audits</TabsTrigger>
              <TabsTrigger value="timeline" className="text-[11px] py-1.5">Timeline</TabsTrigger>
            </TabsList>

            {/* 1. OVERVIEW */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    Account Identity & Origin
                  </h4>
                  <div className="space-y-2 text-xs divide-y divide-border/40">
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Prop Firm</span>
                      <strong className="text-foreground">{challenge.propFirm}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Linked Trading Account</span>
                      <strong className="font-mono text-foreground">
                        {isPrivate ? maskAccountName(challenge.account?.name, isPrivate) : challenge.account?.name || "Funded Account"}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Account Model</span>
                      <strong className="capitalize text-foreground">{challenge.accountModel || "Standard Funded"}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Phase Type</span>
                      <strong className="capitalize text-amber-500">Funded Phase ({phase.sequence})</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Activation Date</span>
                      <strong className="font-mono text-foreground">
                        {phase.activationDate ? new Date(phase.activationDate).toLocaleDateString() : new Date(phase.startDate).toLocaleDateString()}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    Governance & Contract Version
                  </h4>
                  <div className="space-y-2 text-xs divide-y divide-border/40">
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Rule Source Version</span>
                      <strong className="font-mono text-foreground">firm_contract_v2.4</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Reset Timezone & Hour</span>
                      <strong className="font-mono text-foreground">
                        {challenge.resetTimezone || "America/New_York"} @ {challenge.resetHour ?? 17}:00
                      </strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Profit Split Rate</span>
                      <strong className="font-mono text-profit">{profitSplitPct}% Trader / {100 - profitSplitPct}% Firm</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Drawdown Basis</span>
                      <strong className="font-mono text-foreground capitalize">
                        {phase.drawdownType} ({phase.drawdownBasis})
                      </strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        Active & In Good Standing
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 2. FINANCIAL PERFORMANCE */}
            <TabsContent value="financials" className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Starting Capital</div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {isPrivate ? "••••••" : formatCents(startingBalanceCents, currency)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Current Balance</div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {isPrivate ? "••••••" : formatCents(currentBalanceCents, currency)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Current Equity</div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {isPrivate ? "••••••" : formatCents(currentEquityCents, currency)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">High-Water Mark</div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {isPrivate ? "••••••" : formatCents(highWaterMarkCents, currency)}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                  Cash Flow & Payout Summary
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-mono uppercase">Net Trading Profit</span>
                    <strong className={cn("text-base font-mono", netProfitCents >= 0 ? "text-profit" : "text-loss")}>
                      {isPrivate ? "••••••" : formatSignedCents(netProfitCents, currency).text}
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-mono uppercase">Total Paid to Date</span>
                    <strong className="text-base font-mono text-profit">
                      {isPrivate ? "••••••" : formatCents(totalPaidPayouts, currency)}
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-mono uppercase">Pending / In-Review</span>
                    <strong className="text-base font-mono text-amber-500">
                      {isPrivate ? "••••••" : formatCents(totalPendingPayouts, currency)}
                    </strong>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 3. RULES & COMPLIANCE */}
            <TabsContent value="rules" className="space-y-3">
              <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4">Rule Name</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Configured Threshold</th>
                      <th className="py-2.5 px-4">Evaluation Basis</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {rules.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-4 font-medium text-foreground">{r.name}</td>
                        <td className="py-2.5 px-4 font-mono capitalize text-muted-foreground">{r.category}</td>
                        <td className="py-2.5 px-4 font-mono">
                          {r.config?.threshold !== undefined ? String(r.config.threshold) : "Standard"}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-muted-foreground">{r.calculationMethod}</td>
                        <td className="py-2.5 px-4 text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] capitalize font-mono",
                              r.status === "passed"
                                ? "bg-profit/10 text-profit border-profit/30"
                                : r.status === "violated"
                                ? "bg-loss/10 text-loss border-loss/30"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                            )}
                          >
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* 4. TRADES */}
            <TabsContent value="trades" className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Total Executions</div>
                  <div className="text-lg font-bold font-mono text-foreground">{lifecycle.tradeCount}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Win Rate</div>
                  <div className="text-lg font-bold font-mono text-foreground">{lifecycle.winRate}%</div>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Profit Factor</div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {formatProfitFactor(lifecycle.profitFactor)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Active Trading Days</div>
                  <div className="text-lg font-bold font-mono text-foreground">{lifecycle.tradingDaysCount} days</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-card flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold">Inspect Full Execution History</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Navigate to Trades Log with this funded account and phase filter automatically applied.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    const targetAcc = (phase as any).tradingAccountId || challenge.accountId || "";
                    if (targetAcc) {
                      useNav.getState().setSelectedAccountId(targetAcc);
                    }
                    navigate("tradesLog", {
                      accountId: targetAcc,
                      propChallengeId: challenge.id,
                      propChallengeName: challenge.name,
                      propFirm: challenge.propFirm,
                      phase: phase.name,
                    });
                  }}
                  className="text-xs gap-1 cursor-pointer"
                >
                  Open Trades Log <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TabsContent>

            {/* 5. DRAWDOWN & RISK */}
            <TabsContent value="risk" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Max Trailing Drawdown Limit</div>
                  <div className="text-lg font-bold font-mono text-loss">
                    {maxDrawdownCents ? formatCents(maxDrawdownCents, currency) : "—"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Current Drawdown From Peak</div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {formatCents(lifecycle.currentDrawdownCents, currency)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Buffer to Drawdown Breach</div>
                  <div className="text-lg font-bold font-mono text-profit">
                    {formatCents(lifecycle.remainingDrawdownCents, currency)}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                  Daily Loss Monitoring (Cycle @ {challenge.resetHour ?? 17}:00 {challenge.resetTimezone || "America/New_York"})
                </h4>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-muted-foreground">Today's Realized + Floating Loss</span>
                  <span className="font-mono font-semibold">{formatCents(lifecycle.todayLossCents, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-muted-foreground">Remaining Daily Buffer</span>
                  <span className="font-mono font-semibold text-profit">{formatCents(lifecycle.remainingDailyLossCents, currency)}</span>
                </div>
              </div>
            </TabsContent>

            {/* 6. PAYOUTS */}
            <TabsContent value="payouts" className="space-y-4">
              {payouts.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-border/60 bg-card text-xs text-muted-foreground">
                  No payouts logged yet for this funded account.
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-mono text-[10px] border-b border-border">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4 text-right">Gross Amount</th>
                        <th className="py-2.5 px-4 text-right">Trader Share ({profitSplitPct}%)</th>
                        <th className="py-2.5 px-4 text-right">Firm Share</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {payouts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-4 font-mono">{new Date(p.requestedAt).toLocaleDateString()}</td>
                          <td className="py-2.5 px-4 text-right font-mono">{formatCents(p.amountCents, currency)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-profit">
                            {formatCents(p.netTraderPayoutCents, currency)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                            {formatCents(p.firmSplitCents ?? (p.amountCents - p.netTraderPayoutCents), currency)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] capitalize font-mono",
                                p.status === "paid" ? "bg-profit/10 text-profit border-profit/30" : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                              )}
                            >
                              {p.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* 7. EVENTS & BREACH AUDIT */}
            <TabsContent value="events" className="space-y-4">
              {violations.length === 0 ? (
                <div className="p-4 rounded-xl border border-profit/30 bg-profit/5 text-xs text-profit flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Zero rule violations or parameter breaches recorded. This account has maintained 100% compliance.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {violations.map((v) => (
                    <div key={v.id} className="p-3.5 rounded-xl border border-loss/30 bg-loss/5 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-loss">
                        <span>{v.ruleName}</span>
                        <span className="font-mono text-[11px]">{new Date(v.occurredAt).toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{v.calculationExplanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 8. LIFECYCLE TIMELINE */}
            <TabsContent value="timeline" className="space-y-3">
              <div className="space-y-3 p-2">
                {events.map((ev, idx) => (
                  <div key={ev.id || idx} className="flex items-start gap-3 text-xs">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 text-primary">
                      <Clock className="h-3 w-3" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-foreground">{ev.title}</strong>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(ev.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{ev.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
