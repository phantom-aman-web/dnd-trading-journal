"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSignedCents, formatR, formatProfitFactor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useNav } from "@/lib/nav-store";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import type { ProcessOutcomeMatrixResult, MatrixQuadrantKey } from "@/lib/behavioral-engine";

interface ProcessOutcomeTabProps {
  data: ProcessOutcomeMatrixResult | null;
  isLoading: boolean;
}

export function ProcessOutcomeTab({ data, isLoading }: ProcessOutcomeTabProps) {
  const { navigate } = useNav();
  const [selectedQuadrant, setSelectedQuadrant] = useState<MatrixQuadrantKey>("disciplined_win");

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

  const { quadrants, overallProcessAdherencePct, disciplinedNetPnlCents, undisciplinedNetPnlCents, disciplinedAvgR, undisciplinedAvgR, totalTrades } = data;

  const currentQuad =
    selectedQuadrant === "disciplined_win"
      ? quadrants.disciplinedWin
      : selectedQuadrant === "good_loss"
      ? quadrants.goodLoss
      : selectedQuadrant === "lucky_win"
      ? quadrants.luckyWin
      : quadrants.undisciplinedLoss;

  return (
    <div className="space-y-6">
      {/* Executive Summary Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground text-base">
                Process vs. Outcome Matrix
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distinguish between execution quality and market variance to eliminate outcome bias.
            </p>
          </div>
          {overallProcessAdherencePct !== null && (data as any)?.evaluatedTradesCount > 0 ? (
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs px-2.5 py-1 font-semibold",
                overallProcessAdherencePct >= 80
                  ? "bg-profit/15 text-profit border-profit/30"
                  : overallProcessAdherencePct >= 60
                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  : "bg-loss/15 text-loss border-loss/30"
              )}
            >
              Process Discipline: {overallProcessAdherencePct}% ({data.evaluatedTradesCount} of {totalTrades} trades{totalTrades > data.evaluatedTradesCount ? ` · ${totalTrades - data.evaluatedTradesCount} unassigned` : ""})
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="font-mono text-xs px-2.5 py-1 font-semibold bg-muted text-muted-foreground border-border"
            >
              Process Discipline: Not Evaluated (0 of {totalTrades} trades)
            </Badge>
          )}
        </div>

        {/* Top telemetry grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Disciplined P&amp;L</span>
            <div className="font-mono font-bold text-sm text-foreground mt-0.5">
              {formatSignedCents(disciplinedNetPnlCents).text}
            </div>
            <span className="text-[10px] text-muted-foreground">Avg R: {formatR(disciplinedAvgR)}</span>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Undisciplined P&amp;L</span>
            <div className="font-mono font-bold text-sm text-foreground mt-0.5">
              {formatSignedCents(undisciplinedNetPnlCents).text}
            </div>
            <span className="text-[10px] text-muted-foreground">Avg R: {formatR(undisciplinedAvgR)}</span>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Process Followed</span>
            <div className="font-mono font-bold text-sm text-profit mt-0.5">
              {data.disciplinedTradesCount} <span className="text-xs font-normal text-muted-foreground">trades</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{totalTrades > 0 ? Math.round((data.disciplinedTradesCount / totalTrades) * 100) : 0}% of all trades</span>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Process Broken</span>
            <div className="font-mono font-bold text-sm text-loss mt-0.5">
              {data.undisciplinedTradesCount} <span className="text-xs font-normal text-muted-foreground">trades</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{totalTrades > 0 ? Math.round((data.undisciplinedTradesCount / totalTrades) * 100) : 0}% of all trades</span>
          </div>
        </div>
      </div>

      {/* 2x2 Interactive Matrix Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-foreground">
            2×2 Performance Matrix (Click quadrant to inspect trades)
          </span>
          <span className="text-[11px]">Select quadrant to view executions</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Q1: Disciplined Win */}
          <Card
            onClick={() => setSelectedQuadrant("disciplined_win")}
            className={cn(
              "cursor-pointer transition-all border-2 relative overflow-hidden",
              selectedQuadrant === "disciplined_win"
                ? "border-profit shadow-sm bg-profit/5"
                : "border-border hover:border-profit/40 bg-card"
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-profit">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Disciplined Win</span>
                  </div>
                  <CardDescription className="text-xs">Followed Process + Positive Outcome</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs bg-profit/15 text-profit border-profit/30">
                  {quadrants.disciplinedWin.tradesCount} trades ({quadrants.disciplinedWin.pctOfTotal}%)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/40 border border-border/40 font-mono text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">Total P&amp;L</div>
                  <div className="font-bold text-profit">{formatSignedCents(quadrants.disciplinedWin.totalPnlCents).text}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Avg R</div>
                  <div className="font-bold text-foreground">{formatR(quadrants.disciplinedWin.avgR)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Profit Factor</div>
                  <div className="font-bold text-foreground">{formatProfitFactor(quadrants.disciplinedWin.profitFactor)}</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{quadrants.disciplinedWin.description}</p>
            </CardContent>
          </Card>

          {/* Q3: Lucky Win */}
          <Card
            onClick={() => setSelectedQuadrant("lucky_win")}
            className={cn(
              "cursor-pointer transition-all border-2 relative overflow-hidden",
              selectedQuadrant === "lucky_win"
                ? "border-amber-500 shadow-sm bg-amber-500/5"
                : "border-border hover:border-amber-500/40 bg-card"
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Lucky Win (Bad Habit)</span>
                  </div>
                  <CardDescription className="text-xs">Broke Process + Positive Outcome</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs bg-amber-500/15 text-amber-600 border-amber-500/30">
                  {quadrants.luckyWin.tradesCount} trades ({quadrants.luckyWin.pctOfTotal}%)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/40 border border-border/40 font-mono text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">Total P&amp;L</div>
                  <div className="font-bold text-foreground">{formatSignedCents(quadrants.luckyWin.totalPnlCents).text}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Avg R</div>
                  <div className="font-bold text-foreground">{formatR(quadrants.luckyWin.avgR)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Profit Factor</div>
                  <div className="font-bold text-foreground">{formatProfitFactor(quadrants.luckyWin.profitFactor)}</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{quadrants.luckyWin.description}</p>
            </CardContent>
          </Card>

          {/* Q2: Good Loss */}
          <Card
            onClick={() => setSelectedQuadrant("good_loss")}
            className={cn(
              "cursor-pointer transition-all border-2 relative overflow-hidden",
              selectedQuadrant === "good_loss"
                ? "border-blue-500 shadow-sm bg-blue-500/5"
                : "border-border hover:border-blue-500/40 bg-card"
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-blue-500">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Good Loss (Variance)</span>
                  </div>
                  <CardDescription className="text-xs">Followed Process + Statistical Loss</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs bg-blue-500/15 text-blue-600 border-blue-500/30">
                  {quadrants.goodLoss.tradesCount} trades ({quadrants.goodLoss.pctOfTotal}%)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/40 border border-border/40 font-mono text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">Total P&amp;L</div>
                  <div className="font-bold text-foreground">{formatSignedCents(quadrants.goodLoss.totalPnlCents).text}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Avg R</div>
                  <div className="font-bold text-foreground">{formatR(quadrants.goodLoss.avgR)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Sample Size</div>
                  <div className="font-bold text-foreground">{quadrants.goodLoss.tradesCount}</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{quadrants.goodLoss.description}</p>
            </CardContent>
          </Card>

          {/* Q4: Undisciplined Loss */}
          <Card
            onClick={() => setSelectedQuadrant("undisciplined_loss")}
            className={cn(
              "cursor-pointer transition-all border-2 relative overflow-hidden",
              selectedQuadrant === "undisciplined_loss"
                ? "border-loss shadow-sm bg-loss/5"
                : "border-border hover:border-loss/40 bg-card"
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-loss">
                    <XCircle className="h-4 w-4" />
                    <span>Undisciplined Loss</span>
                  </div>
                  <CardDescription className="text-xs">Broke Process + Negative Outcome</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs bg-loss/15 text-loss border-loss/30">
                  {quadrants.undisciplinedLoss.tradesCount} trades ({quadrants.undisciplinedLoss.pctOfTotal}%)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/40 border border-border/40 font-mono text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">Total P&amp;L</div>
                  <div className="font-bold text-loss">{formatSignedCents(quadrants.undisciplinedLoss.totalPnlCents).text}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Avg R</div>
                  <div className="font-bold text-loss">{formatR(quadrants.undisciplinedLoss.avgR)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Sample Size</div>
                  <div className="font-bold text-foreground">{quadrants.undisciplinedLoss.tradesCount}</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{quadrants.undisciplinedLoss.description}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Drilldown Trades Table for Selected Quadrant */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground">
              {currentQuad.label} Drilldown ({currentQuad.trades.length} Trades)
            </h4>
          </div>
          <span className="text-xs text-muted-foreground">
            Total {currentQuad.label} Impact: <strong className="font-mono text-foreground">{formatSignedCents(currentQuad.totalPnlCents).text}</strong>
          </span>
        </div>

        {currentQuad.trades.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-xs text-muted-foreground">
            No trades in this quadrant for the selected timeframe and filter criteria.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] font-mono text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3">Session</th>
                    <th className="py-2.5 px-3 text-right">Net P&amp;L</th>
                    <th className="py-2.5 px-3 text-right">Actual R</th>
                    <th className="py-2.5 px-3">Behavior Tags</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {currentQuad.trades.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                        {t.exitTime ? new Date(t.exitTime).toLocaleDateString() : t.entryTime ? new Date(t.entryTime).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 px-3 font-semibold font-mono text-foreground">
                        {t.instrumentSymbol}
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn(
                          "font-mono uppercase text-[10px] font-semibold px-1.5 py-0.5 rounded",
                          t.direction === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                        )}>
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2 px-3 capitalize text-muted-foreground">
                        {t.session?.replace("_", " ") || "—"}
                      </td>
                      <td className={cn("py-2 px-3 font-mono font-semibold text-right", t.netPnlCents > 0 ? "text-profit" : t.netPnlCents < 0 ? "text-loss" : "text-muted-foreground")}>
                        {formatSignedCents(t.netPnlCents).text}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-foreground">
                        {formatR(t.actualR)}
                      </td>
                      <td className="py-2 px-3">
                        {t.behaviorFlags && t.behaviorFlags.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {t.behaviorFlags.map((flag, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 bg-loss/10 text-loss border-loss/20 font-mono">
                                {flag.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-profit font-medium">✓ Plan Adherent</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate("tradeDetail", { tradeId: t.id })}
                          className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary cursor-pointer"
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
