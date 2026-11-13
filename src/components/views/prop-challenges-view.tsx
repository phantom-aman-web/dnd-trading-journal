"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { PropChallengesSection } from "@/components/accounts/prop-challenges-section";
import { Skeleton } from "@/components/ui/skeleton";

interface TradingAccount {
  id: string;
  name: string;
  currency: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
}

export function PropChallengesView() {
  const { data: accounts = [], isLoading } = useQuery<TradingAccount[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.items ?? [];
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Prop Firm Challenge Tracker
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Monitor evaluation rules, profit targets, daily loss limits with custom reset hours, drawdown, and consistency requirements.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <PropChallengesSection accounts={accounts} />
      )}
    </div>
  );
}

