"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { PropChallengesSection } from "@/components/accounts/prop-challenges-section";
import { PropChallengeDetail } from "@/components/accounts/prop-challenge-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useNav } from "@/lib/nav-store";

interface TradingAccount {
  id: string;
  name: string;
  accountType: string;
  currency: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
}

export function PropChallengesView() {
  const { params, navigate } = useNav();
  const selectedChallengeId = params.challengeId;

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json();
      const arr = Array.isArray(json) ? json : (json?.items ?? json?.accounts ?? []);
      return Array.isArray(arr) ? arr : [];
    },
  });

  const accounts: TradingAccount[] = Array.isArray(accountsData)
    ? accountsData
    : Array.isArray((accountsData as any)?.items)
    ? (accountsData as any).items
    : Array.isArray((accountsData as any)?.accounts)
    ? (accountsData as any).accounts
    : [];

  // If a specific challenge is selected, open the complete individual account detail experience
  if (selectedChallengeId) {
    return (
      <PropChallengeDetail
        challengeId={selectedChallengeId}
        onBack={() => navigate("propChallenges", { challengeId: "" })}
      />
    );
  }

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
              Prop Firm Challenge & Lifecycle Intelligence
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Monitor evaluation phases, configurable account models, compliance rules, failure diagnosis, and payout disbursements.
          </p>
        </div>
      </div>

      {/* Scope distinction banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border/70 bg-card/60 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/10 text-primary border-primary/20 shrink-0">
            Rules & Lifecycle Engine
          </Badge>
          <span>
            Tracks multi-step evaluation phases, profit targets, failure diagnosis, and drawdown thresholds. Capital balances and trade executions are managed in{" "}
            <button
              type="button"
              onClick={() => navigate("accounts")}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Accounts
            </button>
            .
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <PropChallengesSection accounts={accounts} hideHeader={true} />
      )}
    </div>
  );
}
