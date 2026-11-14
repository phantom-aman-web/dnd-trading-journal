"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  EyeOff,
  Clock,
  Compass,
  AlertCircle,
  CheckCircle2,
  Brain,
  Archive,
  Calendar,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ObservationDetailDialogProps {
  observation: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchiveSuccess?: () => void;
}

export function ObservationDetailDialog({
  observation,
  open,
  onOpenChange,
  onArchiveSuccess,
}: ObservationDetailDialogProps) {
  const qc = useQueryClient();

  if (!observation) return null;

  async function handleArchive() {
    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "noTrade",
          id: observation.id,
          action: "archive",
        }),
      });
      if (res.ok) {
        toast.success("Observation safely archived.");
        qc.invalidateQueries({ queryKey: ["no-trades"] });
        qc.invalidateQueries({ queryKey: ["trades"] });
        onArchiveSuccess?.();
        onOpenChange(false);
      } else {
        toast.error("Failed to archive observation.");
      }
    } catch {
      toast.error("Error archiving observation.");
    }
  }

  const tags: string[] = (() => {
    try {
      return typeof observation.tagsJson === "string"
        ? JSON.parse(observation.tagsJson)
        : Array.isArray(observation.tagsJson)
          ? observation.tagsJson
          : [];
    } catch {
      return [];
    }
  })();

  const behaviorFlags: string[] = (() => {
    try {
      return typeof observation.behaviorFlagsJson === "string"
        ? JSON.parse(observation.behaviorFlagsJson)
        : Array.isArray(observation.behaviorFlagsJson)
          ? observation.behaviorFlagsJson
          : [];
    } catch {
      return [];
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-mono uppercase">
              No-Trade Observation
            </Badge>
            {observation.bias && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase font-bold",
                  observation.bias === "bullish"
                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                    : observation.bias === "bearish"
                      ? "text-rose-500 border-rose-500/30 bg-rose-500/10"
                      : "text-muted-foreground border-border"
                )}
              >
                {observation.bias}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
              Status: {observation.status?.replace("_", " ") || "Observing"}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold font-jakarta mt-2 flex items-center justify-between">
            <span>{observation.instrumentSymbol}</span>
            {observation.strategy?.name && (
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 font-sans">
                <Layers className="h-3.5 w-3.5" />
                {observation.strategy.name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {observation.date ? new Date(observation.date).toLocaleDateString() : "No date"}
            </span>
            {observation.session && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {observation.session} session
              </span>
            )}
            {observation.timeframe && (
              <span className="flex items-center gap-1">
                <Compass className="h-3.5 w-3.5" />
                {observation.timeframe}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 text-xs">
          {/* Reason Category Card */}
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Avoidance / Pass Reason: {observation.reasonCategory}
            </div>
            {observation.reasonNotes && (
              <p className="text-foreground/90 pl-5">{observation.reasonNotes}</p>
            )}
          </div>

          {/* Condition Missing & Would Have Validated */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
              <div className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                Condition Missing
              </div>
              <p className="text-foreground/90">
                {observation.conditionMissing || "No specific missing condition specified."}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
              <div className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                What Would Have Validated
              </div>
              <p className="text-foreground/90">
                {observation.wouldHaveValidated || "Not recorded."}
              </p>
            </div>
          </div>

          {/* Market Observation & Levels */}
          <div className="p-3 rounded-lg bg-card border border-border space-y-2">
            <div className="font-semibold text-foreground">Market Observation &amp; Structure</div>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {observation.observation}
            </p>
            {observation.priceLevels && (
              <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Key Levels: </span>
                {observation.priceLevels}
              </div>
            )}
          </div>

          {/* Psychology & Behavior Notes */}
          {(observation.psychologyNotes || behaviorFlags.length > 0) && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-primary" />
                Trading Psychology &amp; Discipline
              </div>
              {observation.psychologyNotes && (
                <p className="text-muted-foreground">{observation.psychologyNotes}</p>
              )}
              {behaviorFlags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {behaviorFlags.map((flag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[10px]">
                      {flag.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-muted-foreground uppercase font-mono">Tags:</span>
              {tags.map((t, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px]">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            className="text-muted-foreground hover:text-amber-500 gap-1.5 text-xs"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive Observation
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
