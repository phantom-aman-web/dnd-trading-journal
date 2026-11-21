"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSignedCents, formatR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  Scale,
  Clock,
  Tag,
  CheckCircle2,
  X,
  Gauge,
  Info,
} from "lucide-react";
import type { BehavioralAnalyticsResult } from "@/lib/behavioral-engine";

interface BehavioralAnalyticsTabProps {
  data: BehavioralAnalyticsResult | null;
  isLoading: boolean;
}

export function BehavioralAnalyticsTab({ data, isLoading }: BehavioralAnalyticsTabProps) {
  const [dismissedWarningIds, setDismissedWarningIds] = useState<string[]>([]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-28 rounded-xl bg-card animate-pulse border border-border/60" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-card animate-pulse border border-border/60" />
          ))}
        </div>
      </div>
    );
  }

  const { streakAnalysis, riskConsistency, sessionDiscipline, mistakeTags, activeWarnings } = data;
  const visibleWarnings = activeWarnings.filter((w) => !dismissedWarningIds.includes(w.id));

  return (
    <div className="space-y-6">
      {/* 1. Behavioral Warnings (Feature 35) */}
      {visibleWarnings.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Active Behavioral Warnings ({visibleWarnings.length})
            </span>
            <span className="text-[11px] text-muted-foreground">Objective pattern telemetry</span>
          </div>

          <div className="space-y-2">
            {visibleWarnings.map((warn) => (
              <div
                key={warn.id}
                className={cn(
                  "p-3.5 rounded-xl border text-xs shadow-xs flex items-start justify-between gap-3",
                  warn.severity === "critical"
                    ? "bg-loss/10 border-loss/30 text-loss"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                )}
              >
                <div className="flex items-start gap-2.5">
                  {warn.severity === "critical" ? (
                    <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">{warn.title}</span>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase px-1.5 py-0">
                        {warn.sampleSize}
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-[10px] capitalize">
                        {warn.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{warn.neutralDescription}</p>
                    <p className="text-[11px] font-medium text-foreground pt-0.5">
                      <strong>Prescribed Rule:</strong> {warn.recommendedAction}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissedWarningIds((prev) => [...prev, warn.id])}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  title="Acknowledge warning"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Top Metric Cards: Streak Analysis & Risk Consistency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Streak Impact Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" /> Streak Reaction &amp; Tilt Telemetry
              </CardTitle>
              <span className="text-[10px] font-mono text-muted-foreground">Trade N vs Trade N-1</span>
            </div>
            <CardDescription className="text-xs">
              Compares execution quality and performance immediately following a win versus immediately following a loss.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              {/* After Win */}
              <div className="p-3 rounded-lg bg-profit/5 border border-profit/20 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center justify-between">
                  <span>Following a Win</span>
                  <span className="text-profit font-semibold">N={streakAnalysis.afterWin.tradesCount}</span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-xs text-muted-foreground">Win Rate:</span>
                  <span className="text-sm font-bold text-foreground">{streakAnalysis.afterWin.winRate}%</span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-xs text-muted-foreground">Average R:</span>
                  <span className="font-bold text-foreground">{formatR(streakAnalysis.afterWin.avgR)}</span>
                </div>
                <div className="flex items-baseline justify-between font-mono pt-1 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground">Net P&amp;L:</span>
                  <span className="font-bold text-profit">{formatSignedCents(streakAnalysis.afterWin.totalPnlCents).text}</span>
                </div>
              </div>

              {/* After Loss */}
              <div className="p-3 rounded-lg bg-loss/5 border border-loss/20 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center justify-between">
                  <span>Following a Loss</span>
                  <span className="text-loss font-semibold">N={streakAnalysis.afterLoss.tradesCount}</span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-xs text-muted-foreground">Win Rate:</span>
                  <span className="text-sm font-bold text-foreground">{streakAnalysis.afterLoss.winRate}%</span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-xs text-muted-foreground">Average R:</span>
                  <span className="font-bold text-foreground">{formatR(streakAnalysis.afterLoss.avgR)}</span>
                </div>
                <div className="flex items-baseline justify-between font-mono pt-1 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground">Net P&amp;L:</span>
                  <span className={cn("font-bold", streakAnalysis.afterLoss.totalPnlCents >= 0 ? "text-profit" : "text-loss")}>
                    {formatSignedCents(streakAnalysis.afterLoss.totalPnlCents).text}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Multiplier Note */}
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-[11px] flex items-center justify-between">
              <span className="text-muted-foreground">Post-Loss Sizing Multiplier:</span>
              <span className={cn(
                "font-mono font-semibold",
                streakAnalysis.riskMultiplierAfterLoss > 1.25
                  ? "text-loss"
                  : streakAnalysis.riskMultiplierAfterLoss > 1.05
                  ? "text-amber-500"
                  : "text-profit"
              )}>
                {streakAnalysis.riskMultiplierAfterLoss.toFixed(2)}× average risk
                {streakAnalysis.riskMultiplierAfterLoss > 1.25 && " (Oversizing after loss detected)"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Risk Consistency Metric */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-primary" /> Planned Risk Consistency
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-xs font-semibold px-2 py-0.5",
                  riskConsistency.rating === "High Consistency"
                    ? "bg-profit/15 text-profit border-profit/30"
                    : riskConsistency.rating === "Moderate Variance"
                    ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                    : "bg-loss/15 text-loss border-loss/30"
                )}
              >
                {riskConsistency.rating}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Evaluates variance in position sizing to ensure predictable risk allocation across trades.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 font-mono">
                <div className="text-[10px] text-muted-foreground uppercase">Median Risk</div>
                <div className="font-bold text-foreground mt-0.5">${(riskConsistency.medianRiskCents / 100).toFixed(0)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 font-mono">
                <div className="text-[10px] text-muted-foreground uppercase">Mean Risk</div>
                <div className="font-bold text-foreground mt-0.5">${(riskConsistency.meanRiskCents / 100).toFixed(0)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 font-mono">
                <div className="text-[10px] text-muted-foreground uppercase">Std Deviation</div>
                <div className="font-bold text-foreground mt-0.5">±${(riskConsistency.stdDevRiskCents / 100).toFixed(0)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 font-mono">
                <div className="text-[10px] text-muted-foreground uppercase">Dispersion CV</div>
                <div className={cn("font-bold mt-0.5", riskConsistency.coefficientOfVariationPct > 40 ? "text-loss" : "text-foreground")}>
                  {riskConsistency.coefficientOfVariationPct}%
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
              {riskConsistency.coefficientOfVariationPct <= 20
                ? "Excellent risk discipline. Your position sizing adheres tightly to your model without erratic swings."
                : riskConsistency.coefficientOfVariationPct <= 45
                ? "Moderate sizing variance. Review trades with large deviations from your median risk."
                : "High sizing volatility. Frequent doubling or swinging of risk budgets increases drawdown vulnerability."}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Session Discipline Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-primary" /> Session Discipline &amp; Timing Edge
          </h4>
          <span className="text-xs text-muted-foreground">Performance distributed across market sessions</span>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-[11px] font-mono text-muted-foreground uppercase">
              <tr>
                <th className="py-2.5 px-3">Session</th>
                <th className="py-2.5 px-3 text-center">Trades</th>
                <th className="py-2.5 px-3 text-center">Win Rate</th>
                <th className="py-2.5 px-3 text-right">Avg R</th>
                <th className="py-2.5 px-3 text-right">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessionDiscipline.map((s) => (
                <tr key={s.session} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 font-semibold text-foreground">
                    {s.label}
                  </td>
                  <td className="py-2 px-3 text-center font-mono">
                    {s.tradesCount}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-medium">
                    {s.winRate}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">
                    {formatR(s.avgR)}
                  </td>
                  <td className={cn("py-2 px-3 text-right font-mono font-semibold", s.totalPnlCents > 0 ? "text-profit" : s.totalPnlCents < 0 ? "text-loss" : "text-muted-foreground")}>
                    {formatSignedCents(s.totalPnlCents).text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Psychological & Mistake Tags Financial Cost */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            <Tag className="h-4 w-4 text-primary" /> Execution Leakage &amp; Mistake Tag Audit
          </h4>
          <span className="text-xs text-muted-foreground">Financial cost attributed to recorded execution mistakes</span>
        </div>

        {mistakeTags.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-xs text-muted-foreground">
            No execution mistake tags recorded in the selected period. Excellent journal discipline!
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-[11px] font-mono text-muted-foreground uppercase">
                <tr>
                  <th className="py-2.5 px-3">Mistake Pattern</th>
                  <th className="py-2.5 px-3 text-center">Frequency</th>
                  <th className="py-2.5 px-3 text-center">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">Avg R</th>
                  <th className="py-2.5 px-3 text-right">Financial Cost (P&amp;L)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mistakeTags.map((tag) => (
                  <tr key={tag.tag} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3 font-semibold text-foreground flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-loss" />
                      <span>{tag.label}</span>
                    </td>
                    <td className="py-2 px-3 text-center font-mono">
                      {tag.occurrences}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">
                      {tag.winRate}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-loss">
                      {formatR(tag.avgR)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-loss">
                      {formatSignedCents(tag.totalPnlCents).text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
