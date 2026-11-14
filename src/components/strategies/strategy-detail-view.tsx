"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  PencilLine,
  GitCompare,
  ListChecks,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  BarChart3,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  Layers,
  ChevronRight,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { formatSignedCents } from "@/lib/money";
import { formatDurationHuman } from "@/lib/duration-analytics";
import { useNav } from "@/lib/nav-store";
import { EditStrategyVersionModal } from "./edit-strategy-version-modal";
import { StrategyVersionComparisonModal } from "./strategy-version-comparison-modal";
import { StrategyDictionarySection } from "@/components/dictionary/strategy-dictionary-section";

interface StrategyDetailViewProps {
  strategyId: string;
  onBack: () => void;
}

const MARKET_LABELS: Record<string, string> = {
  forex: "Forex",
  gold: "Gold",
  indices: "Indices",
  futures: "Futures",
  crypto: "Crypto",
  stocks: "Stocks",
  mixed: "Mixed",
  custom: "Custom",
};

export function StrategyDetailView({ strategyId, onBack }: StrategyDetailViewProps) {
  const qc = useQueryClient();
  const { navigate } = useNav();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const { data: strategy, isLoading } = useQuery({
    queryKey: ["strategy", strategyId],
    queryFn: async () => {
      const res = await fetch(`/api/strategies/${strategyId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load strategy details");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-5xl">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <h3 className="font-semibold text-foreground">Strategy Not Found</h3>
        <p className="text-xs text-muted-foreground mt-1">
          The requested setup could not be located.
        </p>
        <Button onClick={onBack} variant="outline" size="sm" className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Setups
        </Button>
      </div>
    );
  }

  const versions: any[] = strategy.versions ?? [];
  const latestVersion = versions[0];
  const aggregate = strategy.aggregate ?? {};
  const versionPerf: any[] = strategy.versionPerformance ?? [];
  const byInstrument: any[] = strategy.byInstrument ?? [];
  const directionBreakdown = strategy.directionBreakdown ?? {};

  // Extract checklist from latest version rules
  let activeChecklist: any[] = [];
  try {
    const parsed = JSON.parse(latestVersion?.rulesJson || "[]");
    activeChecklist = Array.isArray(parsed) ? parsed : [];
  } catch {}

  const sampleSize = aggregate.totalTrades ?? 0;
  const isLowSample = sampleSize < 20;
  const marketLabel = strategy.market ? MARKET_LABELS[strategy.market] ?? strategy.market : "Forex";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Setups &amp; Checklists
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
            {strategy.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => navigate("tradesLog", { strategyId: strategy.id })}
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
          >
            <ExternalLink className="h-3 w-3" /> View in Trades Log ({sampleSize})
          </Button>

          {versions.length >= 2 && (
            <Button
              onClick={() => setIsCompareModalOpen(true)}
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
            >
              <GitCompare className="h-3 w-3" /> Compare Versions
            </Button>
          )}

          <Button
            onClick={() => setIsEditModalOpen(true)}
            size="sm"
            className="h-8 text-xs gap-1.5"
          >
            <PencilLine className="h-3.5 w-3.5" /> Edit (New Version)
          </Button>
        </div>
      </div>

      {/* Strategy Hero Card */}
      <div className="bg-card rounded-xl border border-border p-4 md:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{strategy.name}</h1>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                {marketLabel}
              </Badge>
              <Badge className="bg-primary/15 text-primary text-[10px] font-mono">
                v{latestVersion?.versionLabel ?? "1.0"} (Current)
              </Badge>
            </div>
            {strategy.description && (
              <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
                {strategy.description}
              </p>
            )}
          </div>

          <div className="text-left sm:text-right text-[11px] text-muted-foreground space-y-0.5 shrink-0">
            <div>Created: {new Date(strategy.createdAt).toLocaleDateString()}</div>
            <div>Updated: {new Date(strategy.updatedAt).toLocaleDateString()}</div>
            <div>Versions: <strong className="text-foreground">{versions.length}</strong></div>
          </div>
        </div>

        {/* Quick KPI stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border text-xs">
          <div>
            <span className="text-muted-foreground">Total Trades: </span>
            <strong className="text-foreground">{sampleSize}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Win Rate: </span>
            <strong className={aggregate.winRate && parseFloat(aggregate.winRate) >= 0.5 ? "text-profit" : "text-foreground"}>
              {aggregate.winRate ? `${Math.round(parseFloat(aggregate.winRate) * 100)}%` : "—"}
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground">Net P&amp;L: </span>
            <strong className={aggregate.netPnlCents > 0 ? "text-profit" : aggregate.netPnlCents < 0 ? "text-loss" : "text-foreground"}>
              {formatSignedCents(aggregate.netPnlCents ?? 0).text}
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground">Checklist Rules: </span>
            <strong className="text-foreground">{activeChecklist.length}</strong>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border border-border rounded-lg">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Overview &amp; Active Rules
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Performance Analytics
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5">
            <History className="h-3.5 w-3.5" /> Version History ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="dictionary" className="text-xs gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Strategy Dictionary
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Tab 1: Overview & Active Rules ---------------- */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Left: Active Checklist Rules */}
            <div className="md:col-span-2 bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ListChecks className="h-4 w-4 text-primary" /> Active Rules Checklist (v{latestVersion?.versionLabel ?? "1.0"})
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Rules scored and verified when executing trades under this setup.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {activeChecklist.filter((r) => r.required).length} Required
                </Badge>
              </div>

              {activeChecklist.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  No checklist rules configured for this strategy version. Click "Edit (New Version)" to add rules.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeChecklist.map((rule: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-border bg-muted/20 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          <span>{rule.title}</span>
                          {rule.required && (
                            <Badge variant="outline" className="text-[10px] bg-background text-amber-600 dark:text-amber-400 border-amber-500/30">
                              Required
                            </Badge>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-[11px] text-muted-foreground leading-normal">
                            {rule.description}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground/60">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Versioning Details & Fast Action */}
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-4 space-y-3 text-xs">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                  <GitCompare className="h-4 w-4 text-primary" /> Version Management
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  DnD uses immutable strategy versioning. Editing rules never alters past trades or historical version snapshots.
                </p>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border space-y-1">
                  <div>Active: <strong>v{latestVersion?.versionLabel ?? "1.0"}</strong></div>
                  <div>Historical Versions: <strong>{versions.length}</strong></div>
                  <div>Attributed Trades: <strong>{sampleSize}</strong></div>
                </div>
                <Button
                  onClick={() => setIsEditModalOpen(true)}
                  className="w-full text-xs"
                  size="sm"
                >
                  <PencilLine className="h-3.5 w-3.5 mr-1" /> Create Next Version
                </Button>
              </div>

              {/* Version History preview */}
              <div className="bg-card rounded-xl border border-border p-4 space-y-2 text-xs">
                <h4 className="font-semibold text-foreground">Recent Versions</h4>
                <div className="space-y-1.5">
                  {versions.slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border text-[11px]"
                    >
                      <span className="font-mono font-semibold">v{v.versionLabel}</span>
                      <span className="text-muted-foreground truncate max-w-[120px]">
                        {v.changeReason || "Initial setup"}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(v.effectiveDate).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ---------------- Tab 2: Performance Analytics ---------------- */}
        <TabsContent value="analytics" className="space-y-4 mt-0">
          {/* Small Sample Warning */}
          {isLowSample && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Small sample size ({sampleSize} trade{sampleSize === 1 ? "" : "s"}): </span>
                Statistical conclusions should be interpreted with caution until at least 20 trades are recorded under this setup.
              </div>
            </div>
          )}

          {/* Primary Financial KPIs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Win Rate */}
            <div className="p-3.5 bg-card rounded-xl border border-border shadow-sm space-y-1">
              <div className="text-muted-foreground font-medium">Win Rate</div>
              <div className="text-2xl font-bold text-foreground">
                {aggregate.winRate ? `${Math.round(parseFloat(aggregate.winRate) * 100)}%` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {aggregate.wins ?? 0}W · {aggregate.losses ?? 0}L · {aggregate.breakevens ?? 0}BE
              </div>
            </div>

            {/* Net P&L */}
            <div className="p-3.5 bg-card rounded-xl border border-border shadow-sm space-y-1">
              <div className="text-muted-foreground font-medium">Net Realized P&amp;L</div>
              <div className={`text-2xl font-bold truncate ${aggregate.netPnlCents > 0 ? "text-profit" : aggregate.netPnlCents < 0 ? "text-loss" : "text-foreground"}`}>
                {formatSignedCents(aggregate.netPnlCents ?? 0).text}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Gross: {formatSignedCents(aggregate.grossPnlCents ?? 0).text}
              </div>
            </div>

            {/* Profit Factor */}
            <div className="p-3.5 bg-card rounded-xl border border-border shadow-sm space-y-1">
              <div className="text-muted-foreground font-medium">Profit Factor</div>
              <div className="text-2xl font-bold text-foreground">
                {aggregate.profitFactor ? parseFloat(aggregate.profitFactor).toFixed(2) : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Gross Win / Gross Loss
              </div>
            </div>

            {/* Expectancy */}
            <div className="p-3.5 bg-card rounded-xl border border-border shadow-sm space-y-1">
              <div className="text-muted-foreground font-medium">Expectancy</div>
              <div className="text-2xl font-bold text-foreground">
                {aggregate.expectancyCents !== null && aggregate.expectancyCents !== undefined
                  ? formatSignedCents(aggregate.expectancyCents).text
                  : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Avg return per trade
              </div>
            </div>

            {/* Average R */}
            <div className="p-3.5 bg-card rounded-xl border border-border shadow-sm space-y-1">
              <div className="text-muted-foreground font-medium">Average R</div>
              <div className="text-2xl font-bold text-foreground">
                {aggregate.avgR ? `${parseFloat(aggregate.avgR).toFixed(2)}R` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Total R: {aggregate.totalR ? `${parseFloat(aggregate.totalR).toFixed(1)}R` : "—"}
              </div>
            </div>

            {/* Average Win / Loss */}
            <div className="p-3.5 bg-card rounded-xl border border-border shadow-sm space-y-1">
              <div className="text-muted-foreground font-medium">Avg Win / Loss</div>
              <div className="text-base font-bold text-foreground">
                <span className="text-profit">{aggregate.avgWinCents ? formatSignedCents(aggregate.avgWinCents).text : "—"}</span>
                {" / "}
                <span className="text-loss">{aggregate.avgLossCents ? formatSignedCents(aggregate.avgLossCents).text : "—"}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Win/Loss Ratio: {aggregate.avgWinCents && aggregate.avgLossCents ? (Math.abs(aggregate.avgWinCents / aggregate.avgLossCents)).toFixed(2) + "x" : "—"}
              </div>
            </div>

            {/* Average Holding Time */}
            <div className="p-3.5 bg-card rounded-xl border border-border shadow-sm space-y-1">
              <div className="text-muted-foreground font-medium">Avg Holding Time</div>
              <div className="text-2xl font-bold text-foreground">
                {formatDurationHuman(strategy.avgHoldMinutes)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Across closed executions
              </div>
            </div>

            {/* Checklist Adherence */}
            <div className="p-3.5 bg-card rounded-xl border border-border shadow-sm space-y-1">
              <div className="text-muted-foreground font-medium">Checklist Adherence</div>
              <div className="text-2xl font-bold text-foreground">
                {strategy.checklistAdherencePct !== null ? `${strategy.checklistAdherencePct}%` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Plan execution compliance
              </div>
            </div>
          </div>

          {/* Direction & Instrument Breakdown Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Long vs Short */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-3 text-xs">
              <h4 className="font-semibold text-foreground">Direction Breakdown</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border">
                  <div>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Long Trades</span>
                    <div className="text-[11px] text-muted-foreground">{directionBreakdown.long?.tradesCount ?? 0} trades</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{directionBreakdown.long?.winRate ? `${Math.round(parseFloat(directionBreakdown.long.winRate) * 100)}% Win` : "—"}</div>
                    <div className={directionBreakdown.long?.netPnlCents > 0 ? "text-profit" : "text-muted-foreground"}>
                      {formatSignedCents(directionBreakdown.long?.netPnlCents ?? 0).text}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border">
                  <div>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">Short Trades</span>
                    <div className="text-[11px] text-muted-foreground">{directionBreakdown.short?.tradesCount ?? 0} trades</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{directionBreakdown.short?.winRate ? `${Math.round(parseFloat(directionBreakdown.short.winRate) * 100)}% Win` : "—"}</div>
                    <div className={directionBreakdown.short?.netPnlCents > 0 ? "text-profit" : "text-muted-foreground"}>
                      {formatSignedCents(directionBreakdown.short?.netPnlCents ?? 0).text}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance by Instrument */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-3 text-xs">
              <h4 className="font-semibold text-foreground">Top Instruments</h4>
              {byInstrument.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  No instrument data logged yet.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {byInstrument.map((inst) => (
                    <div
                      key={inst.symbol}
                      className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border text-[11px]"
                    >
                      <span className="font-semibold text-foreground">{inst.symbol}</span>
                      <span className="text-muted-foreground">{inst.tradesCount} trades</span>
                      <span className="font-medium">{inst.winRate ? `${Math.round(parseFloat(inst.winRate) * 100)}%` : "—"}</span>
                      <span className={`font-semibold ${inst.netPnlCents > 0 ? "text-profit" : inst.netPnlCents < 0 ? "text-loss" : "text-muted-foreground"}`}>
                        {formatSignedCents(inst.netPnlCents).text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ---------------- Tab 3: Version History & Comparison ---------------- */}
        <TabsContent value="history" className="space-y-4 mt-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4 text-primary" /> Version History &amp; Evolution
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Chronological list of all strategy revisions and their historically attributed metrics.
              </p>
            </div>
            {versions.length >= 2 && (
              <Button
                onClick={() => setIsCompareModalOpen(true)}
                variant="outline"
                size="sm"
                className="text-xs gap-1"
              >
                <GitCompare className="h-3.5 w-3.5" /> Compare Any Two
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {versionPerf.map((vp, index) => {
              const isCurrent = index === 0;
              let versionRules: any[] = [];
              try {
                const parsed = JSON.parse(vp.rulesJson || "[]");
                versionRules = Array.isArray(parsed) ? parsed : [];
              } catch {}

              return (
                <div
                  key={vp.versionId}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-foreground">
                        v{vp.versionLabel}
                      </span>
                      {isCurrent ? (
                        <Badge className="bg-primary/15 text-primary text-[10px]">Active Current</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Historical</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Effective: {new Date(vp.effectiveDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {versions.length >= 2 && !isCurrent && (
                        <Button
                          onClick={() => setIsCompareModalOpen(true)}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary hover:bg-primary/10 gap-1"
                        >
                          <GitCompare className="h-3 w-3" /> Compare with v{latestVersion?.versionLabel}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Change Reason & Summary */}
                  {(vp.changeSummary || vp.changeReason) && (
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs space-y-0.5">
                      {vp.changeReason && (
                        <div className="font-semibold text-foreground">
                          Reason: <span className="font-normal text-muted-foreground">{vp.changeReason}</span>
                        </div>
                      )}
                      {vp.changeSummary && (
                        <div className="text-[11px] text-muted-foreground">
                          {vp.changeSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Version Metrics Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-muted-foreground">Attributed Trades: </span>
                      <strong className="text-foreground">{vp.tradesCount}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Win Rate: </span>
                      <strong className={vp.winRate && parseFloat(vp.winRate) >= 0.5 ? "text-profit" : "text-foreground"}>
                        {vp.winRate ? `${Math.round(parseFloat(vp.winRate) * 100)}%` : "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Net P&amp;L: </span>
                      <strong className={vp.pnlCents > 0 ? "text-profit" : vp.pnlCents < 0 ? "text-loss" : "text-foreground"}>
                        {formatSignedCents(vp.pnlCents).text}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Average R: </span>
                      <strong className="text-foreground">
                        {vp.avgR ? `${parseFloat(vp.avgR).toFixed(2)}R` : "—"}
                      </strong>
                    </div>
                  </div>

                  {/* Snapshot of Rules in this version */}
                  <div className="pt-2 border-t border-border">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                      Checklist Rules Snapshot ({versionRules.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {versionRules.map((r: any, rIdx: number) => (
                        <span
                          key={rIdx}
                          className="px-2 py-0.5 rounded text-[11px] bg-muted/40 border border-border text-foreground truncate max-w-[200px]"
                        >
                          {r.title}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ---------------- Tab 4: Strategy Dictionary ---------------- */}
        <TabsContent value="dictionary" className="space-y-4 mt-0">
          <StrategyDictionarySection strategyId={strategyId} strategyName={strategy.name} />
        </TabsContent>
      </Tabs>

      {/* Edit Strategy & Create New Version Modal */}
      {isEditModalOpen && (
        <EditStrategyVersionModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          strategy={strategy}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["strategy", strategyId] });
            qc.invalidateQueries({ queryKey: ["strategies"] });
          }}
        />
      )}

      {/* Strategy Version Comparison Modal */}
      {isCompareModalOpen && versions.length >= 2 && (
        <StrategyVersionComparisonModal
          open={isCompareModalOpen}
          onOpenChange={setIsCompareModalOpen}
          strategyId={strategyId}
          strategyName={strategy.name}
          versions={versions}
        />
      )}
    </div>
  );
}

