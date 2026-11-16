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
  ChevronDown,
  ChevronRight,
  Info,
  HelpCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DataQualityTabProps {
  data: any;
  onFixTrade: (tradeId: string) => void;
}

interface IssueGroupMeta {
  title: string;
  whyItMatters: string;
  actionOutcome: string;
  severity: "high" | "medium" | "low";
}

const ISSUE_METADATA: Record<string, IssueGroupMeta> = {
  missing_checklist: {
    title: "Incomplete Checklist Responses",
    whyItMatters: "Execution-process analytics, rule discipline metrics, and strategy adherence cannot be computed reliably when checklist rules are left unanswered.",
    actionOutcome: "Inspect affected trades, complete the pre-execution rules in Trade Detail, and restore process adherence tracking.",
    severity: "medium",
  },
  missing_risk: {
    title: "Missing Initial Risk / Stop-Loss Definition",
    whyItMatters: "R-multiple calculations, planned-versus-realized drawdown, and risk efficiency depend on a known stop-loss price.",
    actionOutcome: "Specify the initial stop-loss price to unlock exact R-multiples and risk metrics.",
    severity: "high",
  },
  missing_exit_timestamp: {
    title: "Missing Exit Timestamps",
    whyItMatters: "Trade duration, time-in-trade distribution, and session breakdown require verified exit timestamps.",
    actionOutcome: "Provide the exit timestamp on closed trades to calibrate duration analytics.",
    severity: "high",
  },
  missing_strategy: {
    title: "Unattributed Strategy & Setup",
    whyItMatters: "Performance decomposition by setup cannot attribute win rates or expectancy without strategy assignment.",
    actionOutcome: "Link each trade to its corresponding playbook setup.",
    severity: "medium",
  },
  missing_notes: {
    title: "Missing Trade Rationale & Notes",
    whyItMatters: "Historical post-trade review and behavioral debugging require an initial thesis or execution rationale.",
    actionOutcome: "Add observations, market context, or post-trade reflections.",
    severity: "low",
  },
  potential_duplicate: {
    title: "Potential Duplicate Trade Records",
    whyItMatters: "Identical trades executed within 60 seconds with identical sizing may skew performance metrics if imported twice.",
    actionOutcome: "Review records to confirm whether executions were intentional scale-ins or duplicate imports.",
    severity: "medium",
  },
};

export function DataQualityTab({ data, onFixTrade }: DataQualityTabProps) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    missing_risk: true,
    missing_checklist: true,
  });
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);

  const totalScanned = data?.totalTradesScanned ?? data?.totalEvaluatedTrades ?? 0;
  const score = data?.completenessScorePct ?? 100;
  const isHigh = score >= 90;
  const isMedium = score >= 70 && score < 90;
  const isLow = score < 70;

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

  // Group issues by category type
  const groupedIssues = useMemo(() => {
    const groups: Record<string, typeof issuesList> = {};
    issuesList.forEach((issue) => {
      const type = issue.issueType;
      if (!groups[type]) groups[type] = [];
      groups[type].push(issue);
    });
    return groups;
  }, [issuesList]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
              <h2 className="text-xl font-bold text-foreground font-display">
                Journal Completeness &amp; Integrity Score
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Audits initial risk definition, valid exit timestamps, strategy attribution, checklist adherence responses, and duplicate avoidance across {totalScanned} evaluated closed trades.
            </p>
            <button
              type="button"
              onClick={() => setShowFormulaGuide(!showFormulaGuide)}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer pt-1"
            >
              <Info className="h-3.5 w-3.5" />
              <span>{showFormulaGuide ? "Hide scoring calculation formula" : "How is Journal Completeness calculated?"}</span>
            </button>
          </div>

          <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-xl border border-border shrink-0 self-start sm:self-auto">
            <div className="text-right">
              <div
                className={cn(
                  "text-3xl font-extrabold font-mono tabular-nums",
                  isHigh ? "text-profit" : isMedium ? "text-amber-500" : "text-loss"
                )}
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
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isHigh ? "bg-emerald-500" : isMedium ? "bg-amber-500" : "bg-rose-500"
            )}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>

        {/* Expandable Scoring Formula Breakdown */}
        {showFormulaGuide && (
          <div className="mt-5 p-4 rounded-xl bg-card border border-border/80 text-xs space-y-3 animate-in fade-in-50">
            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-primary" />
              How the Journal Completeness Score is Derived
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-muted-foreground leading-relaxed">
              <div>
                <span className="font-semibold text-foreground">Contributing Fields:</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li><strong>Stop Loss / Planned Risk</strong> (25% weight) — unlocks R multiples</li>
                  <li><strong>Exit Timestamp</strong> (20% weight) — enables holding duration</li>
                  <li><strong>Strategy Attribution</strong> (20% weight) — powers setup edge</li>
                  <li><strong>Checklist Completion</strong> (20% weight) — verifies process discipline</li>
                  <li><strong>Trade Notes &amp; Rationale</strong> (10% weight) — post-trade review</li>
                  <li><strong>Duplicate Integrity</strong> (5% weight) — checks timestamp collisions</li>
                </ul>
              </div>
              <div>
                <span className="font-semibold text-foreground">Denominator &amp; Dynamic Updates:</span>
                <p className="mt-1">
                  The denominator equals the total closed realized trades within the active filter scope ({totalScanned} records).
                  Updating any missing field in Trade Detail immediately clears that diagnostic finding and raises your Journal Completeness percentage upon saving.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground font-display">
            Grouped Diagnostic Findings ({Object.keys(groupedIssues).length} Issue Categories)
          </h3>
          <p className="text-xs text-muted-foreground">
            Repeated issue types are consolidated so you can review root causes and resolve affected trades efficiently.
          </p>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search affected trades or finding..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-card"
          />
        </div>
      </div>

      {/* Grouped Issues Accordions */}
      {Object.keys(groupedIssues).length === 0 ? (
        <Card className="p-10 text-center border-border">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2" />
          <h4 className="font-bold text-foreground text-sm">Zero Data Quality Issues Detected</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Every trade in the active scope is completely documented with initial risk, exit timestamps, strategy associations, and checklist confirmations.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedIssues).map(([issueKey, items]) => {
            const meta = ISSUE_METADATA[issueKey] || {
              title: issueKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              whyItMatters: "Ensures comprehensive trade documentation and accurate analytical models.",
              actionOutcome: "Inspect affected trades and provide missing details.",
              severity: "medium" as const,
            };

            const isExpanded = !!expandedGroups[issueKey];
            const matchingItems = items.filter((item) => {
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return (
                item.symbol.toLowerCase().includes(q) ||
                item.message.toLowerCase().includes(q) ||
                meta.title.toLowerCase().includes(q)
              );
            });

            if (matchingItems.length === 0 && search.trim()) return null;

            return (
              <Card key={issueKey} className="overflow-hidden border border-border shadow-xs">
                {/* Group Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(issueKey)}
                  className="w-full p-4 flex items-start justify-between text-left hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-1.5 rounded-md bg-muted text-muted-foreground mt-0.5 shrink-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{meta.title}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-mono px-1.5 py-0",
                            meta.severity === "high"
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : meta.severity === "medium"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          )}
                        >
                          {items.length} Affected {items.length === 1 ? "Record" : "Records"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        <strong className="text-foreground/90">Why it matters:</strong> {meta.whyItMatters}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-4 hidden sm:block">
                    <span className="text-[11px] font-semibold text-primary hover:underline">
                      {isExpanded ? "Collapse" : `Inspect (${matchingItems.length})`}
                    </span>
                  </div>
                </button>

                {/* Expanded Affected Records Drawer */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                      <span><strong>Recommended Action:</strong> {meta.actionOutcome}</span>
                      <span className="font-mono text-[10px]">Showing {matchingItems.length} records</span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                            <th className="px-3 py-2 text-left">Trade</th>
                            <th className="px-3 py-2 text-left">Execution Date</th>
                            <th className="px-3 py-2 text-left">Diagnostic Finding</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchingItems.map((issue, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                            >
                              <td className="px-3 py-2.5 font-bold text-foreground">
                                {issue.symbol}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground font-mono text-[11px]">
                                {issue.entryTime ? new Date(issue.entryTime).toLocaleDateString() : "Undated"}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground max-w-md">
                                {issue.message}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onFixTrade(issue.tradeId)}
                                  className="h-6 text-[11px] px-2 gap-1 hover:bg-primary/10 hover:text-primary cursor-pointer"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>Fix Record</span>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
