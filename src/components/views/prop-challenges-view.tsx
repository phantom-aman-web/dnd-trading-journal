"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { PropChallengesSection } from "@/components/accounts/prop-challenges-section";
import { PropChallengeDetail } from "@/components/accounts/prop-challenge-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useNav } from "@/lib/nav-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TradingAccount {
  id: string;
  name: string;
  accountType: string;
  currency: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
}

export function PropChallengesView() {
  const { params, navigate, selectedAccountId, setSelectedAccountId } = useNav();
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

        {/* Account Filter Selector */}
        {accounts.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Filter Account:</span>
            <Select
              value={selectedAccountId || "all"}
              onValueChange={(val) => setSelectedAccountId(val === "all" ? "" : val)}
            >
              <SelectTrigger className="h-9 text-xs w-48 sm:w-56">
                <SelectValue placeholder="All Trading Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trading Accounts</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
        <PropChallengesSection accounts={accounts} hideHeader={true} accountId={selectedAccountId} />
      )}
    </div>
  );
}
