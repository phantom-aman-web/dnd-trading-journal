"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileQuestion,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DataQualityTabProps {
  data: any;
  onFixTrade: (tradeId: string) => void;
}

export function DataQualityTab({ data, onFixTrade }: DataQualityTabProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const totalScanned = data?.totalTradesScanned ?? data?.totalEvaluatedTrades ?? 0;
  const score = data?.completenessScorePct ?? 100;
  const isHigh = score >= 90;
  const isMedium = score >= 70 && score < 90;
  const isLow = score < 70;

  const issuesSummary = {
    missingRisk: data?.issuesByCategory?.missingRiskCount ?? data?.issuesSummary?.missingRisk ?? 0,
    missingExitTimestamp: data?.issuesByCategory?.missingTimestampCount ?? data?.issuesSummary?.missingExitTimestamp ?? 0,
    missingStrategy: data?.issuesByCategory?.missingStrategyCount ?? data?.issuesSummary?.missingStrategy ?? 0,
    missingChecklistAnswers: data?.issuesByCategory?.missingChecklistCount ?? data?.issuesSummary?.missingChecklistAnswers ?? 0,
    missingNotes: data?.issuesByCategory?.missingNotesCount ?? data?.issuesSummary?.missingNotes ?? 0,
    potentialDuplicates: data?.issuesByCategory?.potentialDuplicatesCount ?? data?.issuesSummary?.potentialDuplicates ?? 0,
  };

  const rawIssues: any[] = data?.issues ?? [];
  const issuesList = useMemo(() => {
    return rawIssues.map((i: any) => ({
      tradeId: i.tradeId,
      symbol: i.instrumentSymbol ?? i.symbol ?? "Trade",
      entryTime: i.entryDate ?? i.entryTime ?? null,
      issueType: i.category ?? i.issueType ?? "missing_data",
      severity: i.severity ?? "medium",
      message: i.description ?? i.message ?? i.title ?? "",
    }));
  }, [rawIssues]);

  if (!data || totalScanned === 0) {
    return (
      <Card className="p-10 text-center border-border">
        <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="font-semibold text-foreground text-base">No trade records evaluated</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Execute and log trades in your journal to calculate data quality scores and audit actionable completeness gaps.
        </p>
      </Card>
    );
  }

  const filteredIssues = useMemo(() => {
    return issuesList.filter((issue) => {
      if (filterType !== "all" && issue.issueType !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesMsg = issue.message.toLowerCase().includes(q);
        const matchesSym = (issue.symbol ?? "").toLowerCase().includes(q);
        const matchesType = issue.issueType.toLowerCase().includes(q);
        if (!matchesMsg && !matchesSym && !matchesType) return false;
      }
      return true;
    });
  }, [issuesList, filterType, search]);

  return (
    <div className="space-y-6">
      {/* Completeness Score Hero Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isHigh ? (
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              ) : isMedium ? (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-rose-500" />
              )}
              <h2 className="text-xl font-bold text-foreground">
                Journal Completeness &amp; Integrity Score
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Calculates how rigorously your trades are documented across initial risk / stop-loss definition,
              valid exit timestamps, strategy attribution, checklist completion, trade rationale, and duplicate detection.
              High completeness ensures trustworthy financial analytics and clean strategy attribution.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-xl border border-border shrink-0 self-start sm:self-auto">
            <div className="text-right">
              <div
                className={`text-3xl font-extrabold font-mono tabular-nums ${
                  isHigh ? "text-profit" : isMedium ? "text-amber-500" : "text-loss"
                }`}
              >
                {score}%
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isHigh ? "Audit Ready" : isMedium ? "Action Required" : "Gaps Detected"}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isHigh ? "bg-emerald-500" : isMedium ? "bg-amber-500" : "bg-rose-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      </Card>

      {/* Issues Category Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Missing Risk */}
        <button
          onClick={() => setFilterType(filterType === "missing_risk" ? "all" : "missing_risk")}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterType === "missing_risk"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-muted-foreground">Missing Risk / SL</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {data.issuesSummary.missingRisk}
          </div>
          <div className="text-[10px] text-muted-foreground">Trades lacking SL</div>
        </button>

        {/* Missing Exits */}
        <button
          onClick={() => setFilterType(filterType === "missing_exit_timestamp" ? "all" : "missing_exit_timestamp")}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterType === "missing_exit_timestamp"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-muted-foreground">Missing Exit Time</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {data.issuesSummary.missingExitTimestamp}
          </div>
          <div className="text-[10px] text-muted-foreground">Closed without exit</div>
        </button>

        {/* Missing Strategy */}
        <button
          onClick={() => setFilterType(filterType === "missing_strategy" ? "all" : "missing_strategy")}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterType === "missing_strategy"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-muted-foreground">Missing Strategy</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {data.issuesSummary.missingStrategy}
          </div>
          <div className="text-[10px] text-muted-foreground">Unattributed trades</div>
        </button>

        {/* Missing Checklist */}
        <button
          onClick={() => setFilterType(filterType === "missing_checklist" ? "all" : "missing_checklist")}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterType === "missing_checklist"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-muted-foreground">Incomplete Checklist</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {data.issuesSummary.missingChecklistAnswers}
          </div>
          <div className="text-[10px] text-muted-foreground">Rules unanswered</div>
        </button>

        {/* Missing Notes */}
        <button
          onClick={() => setFilterType(filterType === "missing_notes" ? "all" : "missing_notes")}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterType === "missing_notes"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-muted-foreground">Missing Notes</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {data.issuesSummary.missingNotes}
          </div>
          <div className="text-[10px] text-muted-foreground">No entry thesis</div>
        </button>

        {/* Potential Duplicates */}
        <button
          onClick={() => setFilterType(filterType === "potential_duplicate" ? "all" : "potential_duplicate")}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterType === "potential_duplicate"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-muted-foreground">Duplicate Flags</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {data.issuesSummary.potentialDuplicates}
          </div>
          <div className="text-[10px] text-muted-foreground">Within 60s window</div>
        </button>
      </div>

      {/* Actionable Issue Resolution List */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Actionable Issues ({filteredIssues.length})</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select any trade to inspect and resolve missing fields directly in the trade detail editor.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-card"
              />
            </div>
            {filterType !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterType("all")}
                className="h-8 text-xs text-muted-foreground"
              >
                Clear filter
              </Button>
            )}
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <div className="text-sm font-semibold text-foreground">No matching data quality issues</div>
            <p className="text-xs text-muted-foreground">
              {data.issues.length === 0
                ? "All trades in the selected scope are fully documented with risk, strategy attribution, and timestamps."
                : "No issues match the active filter or search query."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
                  <th className="px-3 py-2 text-left">Trade</th>
                  <th className="px-3 py-2 text-left">Severity</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Diagnostic Finding</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((issue, idx) => {
                  return (
                    <tr
                      key={idx}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3 py-3 font-semibold text-foreground">
                        <div>{issue.symbol ?? "Trade"}</div>
                        {issue.entryTime && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {new Date(issue.entryTime).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-semibold ${
                            issue.severity === "high"
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : issue.severity === "medium"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {issue.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-medium text-foreground capitalize">
                        {issue.issueType.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground max-w-md">
                        {issue.message}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onFixTrade(issue.tradeId)}
                          className="h-7 text-[11px] gap-1 hover:bg-primary/10 hover:text-primary"
                        >
                          <ExternalLink className="h-3 w-3" /> Fix in Detail
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
