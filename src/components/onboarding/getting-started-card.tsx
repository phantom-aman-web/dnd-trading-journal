"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNav } from "@/lib/nav-store";
import { useOnboarding, type SetupStep } from "@/lib/onboarding-store";

interface MeResponse {
  accounts?: unknown[];
  instruments?: unknown[];
  strategies?: unknown[];
  tradeCount?: number;
}

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) return {};
  return res.json();
}

interface Item {
  key: SetupStep;
  label: string;
  onClick: () => void;
  /** Returns true if this item is satisfied by real data. */
  isRealDone: () => boolean;
}

export function GettingStartedCard() {
  const { state, completedSteps } = useOnboarding();
  const { navigate } = useNav();
  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [hidden, setHidden] = useState(false);

  const realData = {
    account: (meData?.accounts?.length ?? 0) > 0,
    instrument: (meData?.instruments?.length ?? 0) > 0,
    strategy: (meData?.strategies?.length ?? 0) > 0,
    plan: false, // No me endpoint exposes plans; rely on completedSteps.
    trade: (meData?.tradeCount ?? 0) > 0,
  };

  const items: Item[] = [
    {
      key: "account",
      label: "Trading Account",
      onClick: () => navigate("settings"),
      isRealDone: () => realData.account,
    },
    {
      key: "instrument",
      label: "Instrument",
      onClick: () => navigate("settings"),
      isRealDone: () => realData.instrument,
    },
    {
      key: "strategy",
      label: "Setup",
      onClick: () => navigate("setups"),
      isRealDone: () => realData.strategy,
    },
    {
      key: "plan",
      label: "Daily Plan",
      onClick: () => navigate("dashboard"),
      isRealDone: () => realData.plan,
    },
    {
      key: "trade",
      label: "First Trade",
      onClick: () => navigate("tradeNew"),
      isRealDone: () => realData.trade,
    },
  ];

  const doneCount = items.filter(
    (it) => completedSteps.includes(it.key) || it.isRealDone(),
  ).length;
  const total = items.length;
  const allDone = doneCount === total;

  // Auto-hide after all items are checked.
  useEffect(() => {
    if (!allDone) return;
    const t = setTimeout(() => setHidden(true), 1500);
    return () => clearTimeout(t);
  }, [allDone]);

  // Once onboarding has reached "completed" or "skipped", the user has
  // finished their setup. Never show the Getting Started card again —
  // it's only for the active onboarding phase.
  // Also hide during "tour" so the guidance walkthrough has a clean
  // background without the checklist distracting from the spotlight.
  if (
    state === "completed" ||
    state === "skipped" ||
    state === "tour"
  )
    return null;
  if (hidden) return null;

  const pct = Math.round((doneCount / total) * 100);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Getting Started</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete these steps to get the most out of DnD.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-medium tnum">
            {doneCount}/{total}
          </div>
          <div className="text-[10px] text-muted-foreground">{pct}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Items */}
      <ul className="mt-3 space-y-0.5">
        {items.map((it) => {
          const done = completedSteps.includes(it.key) || it.isRealDone();
          return (
            <li key={it.key}>
              <button
                onClick={it.onClick}
                className={cn(
                  "group w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                  "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    done
                      ? "border-profit bg-profit text-profit-foreground"
                      : "border-border bg-background text-transparent",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-3 w-3" /> : <Loader2 className="hidden" />}
                </span>
                <span
                  className={cn(
                    "flex-1 text-sm",
                    done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {it.label}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          );
        })}
      </ul>

      {allDone && (
        <div className="mt-3 rounded-md border border-profit/30 bg-profit/5 p-2 text-xs text-profit">
          All set — your trading workspace is ready.
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground h-7"
          onClick={() => setHidden(true)}
        >
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
