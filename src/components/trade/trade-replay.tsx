"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Clock,
  DollarSign,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatSignedCents, formatR } from "@/lib/money";
import { resolveInstrument } from "@/lib/instrument-catalog";
import { dToNumber } from "@/lib/decimal";

interface ExecutionFill {
  id: string;
  kind: "entry" | "exit";
  price: string;
  quantity: string;
  timestamp: string;
  notes?: string | null;
}

interface TradeReplayProps {
  trade: {
    id: string;
    instrumentSymbol: string;
    direction: "long" | "short";
    status: string;
    executions: ExecutionFill[];
    plannedRiskAmountCents?: number | null;
    plannedEntryPrice?: string | null;
    plannedStopPrice?: string | null;
    plannedTargetPrice?: string | null;
  };
}

interface ReplayStepState {
  stepIndex: number;
  currentFill: ExecutionFill;
  cumulativeEntryQty: number;
  cumulativeExitQty: number;
  activeRemainingQty: number;
  avgEntryPrice: number;
  realizedPnlCents: number;
  realizedR: number;
  phaseLabel: string;
}

export function TradeReplay({ trade }: TradeReplayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const sortedFills = useMemo(() => {
    return [...(trade.executions || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [trade.executions]);

  const instrument = useMemo(() => {
    return resolveInstrument(trade.instrumentSymbol);
  }, [trade.instrumentSymbol]);

  const pointMultiplier = (instrument.pointValueCents || 100) / 100;
  const directionSign = trade.direction === "long" ? 1 : -1;
  const riskDollars = (trade.plannedRiskAmountCents || 0) / 100;

  // Compute cumulative state at each fill index
  const replayTimeline = useMemo<ReplayStepState[]>(() => {
    if (sortedFills.length === 0) return [];

    const timeline: ReplayStepState[] = [];
    let cumEntryQty = 0;
    let cumEntryCost = 0;
    let cumExitQty = 0;
    let runningRealizedPnlDollars = 0;

    for (let i = 0; i < sortedFills.length; i++) {
      const fill = sortedFills[i];
      const fillPrice = parseFloat(fill.price || "0");
      const fillQty = parseFloat(fill.quantity || "0");

      let currentAvgEntry = 0;

      if (fill.kind === "entry") {
        cumEntryQty += fillQty;
        cumEntryCost += fillPrice * fillQty;
        currentAvgEntry = cumEntryQty > 0 ? cumEntryCost / cumEntryQty : fillPrice;
      } else {
        cumExitQty += fillQty;
        currentAvgEntry = cumEntryQty > 0 ? cumEntryCost / cumEntryQty : fillPrice;
        // Realized PnL for this exit fill against the prevailing average entry
        const fillPnl = (fillPrice - currentAvgEntry) * directionSign * fillQty * pointMultiplier;
        runningRealizedPnlDollars += fillPnl;
      }

      const activeQty = Math.max(0, cumEntryQty - cumExitQty);
      const realizedCents = Math.round(runningRealizedPnlDollars * 100);
      const currentR = riskDollars > 0 ? runningRealizedPnlDollars / riskDollars : 0;

      let phase = "Building Position";
      if (fill.kind === "exit") {
        phase = activeQty <= 0.0001 ? "Position Fully Closed" : "Taking Partial / De-risking";
      } else if (cumEntryQty > fillQty) {
        phase = "Adding to Position";
      }

      timeline.push({
        stepIndex: i,
        currentFill: fill,
        cumulativeEntryQty: cumEntryQty,
        cumulativeExitQty: cumExitQty,
        activeRemainingQty: activeQty,
        avgEntryPrice: currentAvgEntry,
        realizedPnlCents: realizedCents,
        realizedR: currentR,
        phaseLabel: phase,
      });
    }

    return timeline;
  }, [sortedFills, directionSign, pointMultiplier, riskDollars]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return;
    if (currentStep >= replayTimeline.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, replayTimeline.length - 1));
    }, 1500);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, replayTimeline.length]);

  if (replayTimeline.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No execution fills to replay</p>
        <p className="text-xs text-muted-foreground mt-1">
          Execution fills must be recorded on this trade to enable Trade Replay mode.
        </p>
      </Card>
    );
  }

  const activeState = replayTimeline[currentStep] || replayTimeline[0];
  const isFinalStep = currentStep === replayTimeline.length - 1;

  return (
    <div className="space-y-4">
      {/* Playback Controls & Progress */}
      <Card className="p-4 bg-card/60 backdrop-blur-sm border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "uppercase tracking-wider text-[11px] font-semibold px-2.5 py-0.5",
                activeState.currentFill.kind === "entry"
                  ? "bg-profit/10 text-profit border-profit/20"
                  : "bg-loss/10 text-loss border-loss/20",
              )}
            >
              Step {currentStep + 1} of {replayTimeline.length} — {activeState.currentFill.kind.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground font-medium truncate">
              {activeState.phaseLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPlaying(false);
                setCurrentStep(0);
              }}
              title="Reset to beginning"
              className="h-8 w-8 p-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentStep === 0}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStep((s) => Math.max(0, s - 1));
              }}
              title="Previous fill"
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isPlaying ? "secondary" : "default"}
              size="sm"
              onClick={() => {
                if (isFinalStep) {
                  setCurrentStep(0);
                  setIsPlaying(true);
                } else {
                  setIsPlaying((p) => !p);
                }
              }}
              className="h-8 px-3 gap-1.5 font-medium text-xs"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> {isFinalStep ? "Replay" : "Play"}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isFinalStep}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStep((s) => Math.min(replayTimeline.length - 1, s + 1));
              }}
              title="Next fill"
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-1.5">
          <Slider
            value={[currentStep]}
            max={replayTimeline.length - 1}
            step={1}
            onValueChange={([val]) => {
              setIsPlaying(false);
              setCurrentStep(val);
            }}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground/80 font-mono">
            <span>{new Date(replayTimeline[0].currentFill.timestamp).toLocaleTimeString()}</span>
            <span>
              {new Date(
                replayTimeline[replayTimeline.length - 1].currentFill.timestamp,
              ).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Snapshot Cards at Current Step */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-card/40">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-primary" /> Fill Price
          </div>
          <div className="text-lg font-bold font-mono tracking-tight text-foreground mt-1">
            {formatPrice(activeState.currentFill.price, instrument.pricePrecision)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Quantity: <span className="font-mono text-foreground">{activeState.currentFill.quantity}</span>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/40">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" /> Active Position
          </div>
          <div className="text-lg font-bold font-mono tracking-tight text-foreground mt-1">
            {activeState.activeRemainingQty.toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Avg Entry:{" "}
            <span className="font-mono text-foreground">
              {formatPrice(activeState.avgEntryPrice, instrument.pricePrecision)}
            </span>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/40">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            {activeState.realizedPnlCents >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-profit" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-loss" />
            )}
            Realized P&L
          </div>
          <div
            className={cn(
              "text-lg font-bold font-mono tracking-tight mt-1",
              activeState.realizedPnlCents > 0
                ? "text-profit"
                : activeState.realizedPnlCents < 0
                  ? "text-loss"
                  : "text-foreground",
            )}
          >
            {formatSignedCents(activeState.realizedPnlCents).text}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Realized R:{" "}
            <span
              className={cn(
                "font-mono font-medium",
                activeState.realizedR > 0
                  ? "text-profit"
                  : activeState.realizedR < 0
                    ? "text-loss"
                    : "text-foreground",
              )}
            >
              {formatR(String(activeState.realizedR))}
            </span>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/40">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" /> Time of Fill
          </div>
          <div className="text-sm font-semibold font-mono text-foreground mt-1 truncate">
            {new Date(activeState.currentFill.timestamp).toLocaleTimeString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {new Date(activeState.currentFill.timestamp).toLocaleDateString()}
          </div>
        </Card>
      </div>

      {/* Execution Sequence Tracker */}
      <Card className="p-4 bg-card/40">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Chronological Execution Flow
        </h4>
        <div className="space-y-2">
          {replayTimeline.map((step, idx) => {
            const isCurrent = idx === currentStep;
            const isPast = idx < currentStep;
            return (
              <div
                key={step.currentFill.id || idx}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep(idx);
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all",
                  isCurrent
                    ? "border-primary bg-primary/5 shadow-sm"
                    : isPast
                      ? "border-border/60 bg-muted/20 opacity-80 hover:opacity-100"
                      : "border-border/30 bg-background/50 opacity-50 hover:opacity-80",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center font-mono text-[10px] font-semibold shrink-0",
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {idx + 1}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "uppercase text-[10px] font-semibold py-0 px-1.5 shrink-0",
                      step.currentFill.kind === "entry" ? "text-profit border-profit/30" : "text-loss border-loss/30",
                    )}
                  >
                    {step.currentFill.kind}
                  </Badge>
                  <span className="font-mono tabular-nums text-foreground">
                    {step.currentFill.quantity} @ {formatPrice(step.currentFill.price, instrument.pricePrecision)}
                  </span>
                  {step.currentFill.notes && (
                    <span className="text-muted-foreground italic truncate hidden md:inline">
                      "{step.currentFill.notes}"
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0 font-mono text-[11px]">
                  <span className="text-muted-foreground">
                    Rem: <span className="text-foreground">{step.activeRemainingQty.toFixed(2)}</span>
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      step.realizedPnlCents > 0
                        ? "text-profit"
                        : step.realizedPnlCents < 0
                          ? "text-loss"
                          : "text-muted-foreground",
                    )}
                  >
                    {formatSignedCents(step.realizedPnlCents).text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
