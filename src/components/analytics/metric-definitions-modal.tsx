"use client";

import { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { METRIC_DEFINITIONS, type MetricDefinition } from "@/lib/metric-definitions";

interface MetricDefinitionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Categories",
  financial: "Financial",
  risk: "Risk & Drawdown",
  compliance: "Checklist & Compliance",
  temporal: "Time & Duration",
};

export function MetricDefinitionsModal({ open, onOpenChange }: MetricDefinitionsModalProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const metricList = useMemo(() => {
    return Object.values(METRIC_DEFINITIONS);
  }, []);

  const filteredMetrics = useMemo(() => {
    return metricList.filter((m) => {
      if (activeCategory !== "all" && m.category !== activeCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesLabel = m.shortLabel.toLowerCase().includes(q);
        const matchesDesc = m.description.toLowerCase().includes(q);
        const matchesFormula = m.formula.toLowerCase().includes(q);
        if (!matchesName && !matchesLabel && !matchesDesc && !matchesFormula) return false;
      }
      return true;
    });
  }, [metricList, activeCategory, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <DialogTitle>Metric Definitions &amp; Calculation Formulas</DialogTitle>
          </div>
          <DialogDescription>
            Authoritative financial reference dictionary governing calculations across Analytics,
            Dashboard, Strategy Intelligence, and Performance Reports.
          </DialogDescription>
        </DialogHeader>

        {/* Filter & Search Bar */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search metrics, formulas, or rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs bg-card"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
              {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
                <button
                  key={catKey}
                  onClick={() => setActiveCategory(catKey)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    activeCategory === catKey
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {catLabel}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics List */}
        <div className="space-y-4 pt-2">
          {filteredMetrics.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No metric definitions matching your search.
            </div>
          ) : (
            filteredMetrics.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-border bg-card/60 space-y-3 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{m.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {m.shortLabel}
                    </Badge>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] uppercase self-start sm:self-auto font-semibold ${
                      m.category === "financial"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : m.category === "risk"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : m.category === "compliance"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    }`}
                  >
                    {CATEGORY_LABELS[m.category] ?? m.category}
                  </Badge>
                </div>

                {/* Formula Box */}
                <div className="p-2.5 rounded-lg bg-muted/60 border border-border/80 font-mono text-xs text-foreground overflow-x-auto">
                  <span className="text-[10px] text-muted-foreground font-sans uppercase font-bold block mb-1">
                    Formula
                  </span>
                  {m.formula}
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {m.description}
                </p>

                {/* Inclusions & Exclusions */}
                <div className="grid sm:grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2 rounded bg-muted/30 border border-border/60 space-y-0.5">
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide block">
                      Included Records
                    </span>
                    <span className="text-muted-foreground text-[11px]">{m.includedRecords}</span>
                  </div>
                  <div className="p-2 rounded bg-muted/30 border border-border/60 space-y-0.5">
                    <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide block">
                      Excluded Records
                    </span>
                    <span className="text-muted-foreground text-[11px]">{m.excludedRecords}</span>
                  </div>
                </div>

                {/* Missing Data & Sample Size Guidance */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground/80 pt-1 border-t border-border/40">
                  <div className="flex items-center gap-1">
                    <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span><strong className="text-foreground">Missing Data:</strong> {m.missingDataBehavior}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                    <span><strong className="text-foreground">Sample Size:</strong> {m.sampleSizeGuidance}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
