"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSignedCents, formatR, formatWinRate, formatProfitFactor } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  FileText,
  Printer,
  Download,
  CheckSquare,
  Square,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

interface ReportBuilderTabProps {
  overviewData: any;
  instrumentData: any;
  sessionData: any;
  matrixData: any;
  behavioralData: any;
  filterState: {
    accountId?: string;
    from?: string;
    to?: string;
  };
  isLoading: boolean;
}

export function ReportBuilderTab({
  overviewData,
  instrumentData,
  sessionData,
  matrixData,
  behavioralData,
  filterState,
  isLoading,
}: ReportBuilderTabProps) {
  // Modular section toggles
  const [sections, setSections] = useState({
    summary: true,
    riskDrawdown: true,
    processMatrix: true,
    behavioral: true,
    instruments: true,
    sessions: true,
    tradeLog: true,
  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const aggregate = overviewData?.aggregate || {};

  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    const rows = [
      ["AlphaPips Trading Performance Report"],
      ["Generated", new Date().toLocaleString()],
      ["Account", filterState.accountId || "All Accounts"],
      ["Date Range", `${filterState.from || "Start"} to ${filterState.to || "Present"}`],
      [],
      ["EXECUTIVE SUMMARY"],
      ["Total Trades", aggregate.totalTrades ?? 0],
      ["Win Rate", formatWinRate(aggregate.winRate)],
      ["Total Realized P&L ($)", ((aggregate.netPnlCents ?? 0) / 100).toFixed(2)],
      ["Average R", aggregate.avgR ?? 0],
      ["Profit Factor", formatProfitFactor(aggregate.profitFactor)],
      ["Expectancy ($)", ((aggregate.expectancyCents ?? 0) / 100).toFixed(2)],
      [],
      ["PROCESS VS OUTCOME MATRIX"],
      ["Process Discipline (%)", matrixData?.overallProcessAdherencePct != null ? `${matrixData.overallProcessAdherencePct}% (${(matrixData as any).evaluatedTradesCount ?? (aggregate.totalTrades - (matrixData.insufficientDataCount ?? 0))}/${aggregate.totalTrades} evaluated)` : "N/A (0 evaluated)"],
      ["Disciplined Net P&L ($)", ((matrixData?.disciplinedNetPnlCents ?? 0) / 100).toFixed(2)],
      ["Undisciplined Net P&L ($)", ((matrixData?.undisciplinedNetPnlCents ?? 0) / 100).toFixed(2)],
      [],
      ["INSTRUMENT BREAKDOWN"],
      ["Symbol", "Trades", "Win Rate (%)", "Net P&L ($)", "Avg R"],
    ];

    if (instrumentData?.items) {
      for (const item of instrumentData.items) {
        rows.push([
          item.label || item.key,
          item.items?.totalTrades ?? 0,
          item.items?.winRate ?? 0,
          ((item.items?.netPnlCents ?? 0) / 100).toFixed(2),
          item.items?.avgR ?? 0,
        ]);
      }
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `alphapips_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Configuration Toolbar */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> Report Builder &amp; Export Center
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select modular sections to include in your customized performance dossier.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              title="Opens system print dialog to print or save vector PDF"
              className="h-8 text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* Modular Section Selector Chips */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/50 text-xs">
          <span className="text-[11px] text-muted-foreground font-medium">Sections:</span>
          {([
            { key: "summary", label: "Executive Summary" },
            { key: "riskDrawdown", label: "Risk & Sizing" },
            { key: "processMatrix", label: "Process vs Outcome" },
            { key: "behavioral", label: "Behavioral Telemetry" },
            { key: "instruments", label: "Instruments" },
            { key: "sessions", label: "Sessions" },
          ] as const).map(({ key, label }) => {
            const active = sections[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSection(key)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                  active
                    ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {active ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Printable Report Canvas */}
      <div id="alphapips-report-canvas" className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6 shadow-sm">
        {/* Report Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-border gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-primary tracking-tight">ALPHAPIPS</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Performance Dossier
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Trading Performance &amp; Execution Audit
            </h1>
          </div>

          <div className="text-right text-xs text-muted-foreground space-y-0.5 font-mono">
            <div>Generated: {new Date().toLocaleDateString()}</div>
            <div>Account: {filterState.accountId || "Consolidated Portfolio"}</div>
            <div>Window: {filterState.from || "Genesis"} → {filterState.to || "Current"}</div>
          </div>
        </div>

        {/* Section 1: Executive Summary */}
        {sections.summary && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> 1. Executive Performance Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Net Realized P&amp;L</div>
                <div className={cn("text-base font-bold font-mono mt-0.5", (aggregate.netPnlCents || 0) >= 0 ? "text-profit" : "text-loss")}>
                  {formatSignedCents(aggregate.netPnlCents || 0).text}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Win Rate</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {formatWinRate(aggregate.winRate)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {aggregate.wins ?? 0}W / {aggregate.losses ?? 0}L
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Average R</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {formatR(aggregate.avgR)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Expectancy: {formatSignedCents(aggregate.expectancyCents || 0).text}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Profit Factor</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {formatProfitFactor(aggregate.profitFactor)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {aggregate.totalTrades ?? 0} closed trades
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Process vs Outcome Matrix */}
        {sections.processMatrix && matrixData && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> 2. Process vs. Outcome Analysis
              </h3>
              <Badge variant="outline" className="font-mono text-xs">
                Process Discipline: {matrixData.overallProcessAdherencePct != null ? `${matrixData.overallProcessAdherencePct}% (${(matrixData as any).evaluatedTradesCount ?? (aggregate.totalTrades - (matrixData.insufficientDataCount ?? 0))}/${aggregate.totalTrades} evaluated)` : "Not Evaluated (0 evaluated)"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-profit/5 border border-profit/25">
                <div className="font-semibold text-profit">Disciplined Win ({matrixData.quadrants.disciplinedWin.tradesCount} trades)</div>
                <div className="text-[11px] text-muted-foreground">Followed process + positive outcome</div>
                <div className="font-mono font-bold text-profit mt-1">
                  {formatSignedCents(matrixData.quadrants.disciplinedWin.totalPnlCents).text}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/25">
                <div className="font-semibold text-amber-500">Lucky Win ({matrixData.quadrants.luckyWin.tradesCount} trades)</div>
                <div className="text-[11px] text-muted-foreground">Broke process + positive outcome</div>
                <div className="font-mono font-bold text-foreground mt-1">
                  {formatSignedCents(matrixData.quadrants.luckyWin.totalPnlCents).text}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/25">
                <div className="font-semibold text-blue-500">Good Loss ({matrixData.quadrants.goodLoss.tradesCount} trades)</div>
                <div className="text-[11px] text-muted-foreground">Followed process + statistical loss</div>
                <div className="font-mono font-bold text-foreground mt-1">
                  {formatSignedCents(matrixData.quadrants.goodLoss.totalPnlCents).text}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-loss/5 border border-loss/25">
                <div className="font-semibold text-loss">Undisciplined Loss ({matrixData.quadrants.undisciplinedLoss.tradesCount} trades)</div>
                <div className="text-[11px] text-muted-foreground">Broke process + negative outcome</div>
                <div className="font-mono font-bold text-loss mt-1">
                  {formatSignedCents(matrixData.quadrants.undisciplinedLoss.totalPnlCents).text}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Behavioral Telemetry */}
        {sections.behavioral && behavioralData && (
          <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> 3. Behavioral Consistency &amp; Streak Response
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Post-Win Win Rate</div>
                <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                  {behavioralData.streakAnalysis?.afterWin?.winRate ?? 0}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Avg R: {formatR(behavioralData.streakAnalysis?.afterWin?.avgR)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Post-Loss Win Rate</div>
                <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                  {behavioralData.streakAnalysis?.afterLoss?.winRate ?? 0}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Avg R: {formatR(behavioralData.streakAnalysis?.afterLoss?.avgR)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Post-Loss Risk Escalation</div>
                <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                  {behavioralData.streakAnalysis?.riskMultiplierAfterLoss ?? 1.0}×
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Baseline multiplier
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Instrument Breakdown */}
        {sections.instruments && instrumentData?.items && (
          <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> 4. Instrument Breakdown
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b border-border text-[10px] font-mono text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3 text-center">Trades</th>
                    <th className="py-2 px-3 text-center">Win Rate</th>
                    <th className="py-2 px-3 text-right">Avg R</th>
                    <th className="py-2 px-3 text-right">Net P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {instrumentData.items.map((item: any) => (
                    <tr key={item.key || item.label}>
                      <td className="py-1.5 px-3 font-mono font-semibold">{item.label || item.key}</td>
                      <td className="py-1.5 px-3 text-center font-mono">{item.items?.totalTrades ?? 0}</td>
                      <td className="py-1.5 px-3 text-center font-mono">{item.items?.winRate ?? 0}%</td>
                      <td className="py-1.5 px-3 text-right font-mono">{formatR(item.items?.avgR)}</td>
                      <td className={cn("py-1.5 px-3 text-right font-mono font-semibold", (item.items?.netPnlCents ?? 0) >= 0 ? "text-profit" : "text-loss")}>
                        {formatSignedCents(item.items?.netPnlCents ?? 0).text}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Footer */}
        <div className="pt-4 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
          <span>AlphaPips Performance Journal — Authoritative Financial Telemetry</span>
          <span>Confidential &amp; Proprietary</span>
        </div>
      </div>
    </div>
  );
}
