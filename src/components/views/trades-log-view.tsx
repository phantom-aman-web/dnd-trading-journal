"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useNav } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ChevronRight, BookOpen, Search, X, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSignedCents, formatR } from "@/lib/money";
import { dToNumber } from "@/lib/decimal";
import { CloseTradeModal } from "@/components/trade/close-trade-modal";
import { ExecuteTradeModal } from "@/components/trade/execute-trade-modal";
import { SavedFilterPresets, type FilterState } from "@/components/trades/saved-filter-presets";

/* ------------------------------------------------------------------ */
/* Data fetching                                                       */
/* ------------------------------------------------------------------ */

interface TradeRow {
  id: string;
  instrumentSymbol: string;
  direction: "long" | "short";
  status: string;
  session: string | null;
  setupGrade: string | null;
  entryTime: string | null;
  exitTime: string | null;
  netPnlCents: number;
  actualR: string | null;
  isDraft: boolean;
  accountId: string;
  strategyId: string | null;
  strategyVersionId?: string | null;
  strategy?: { id: string; name: string } | null;
  strategyVersion?: { id: string; versionLabel: string; strategyId?: string } | null;
  planAdherenceJson: string | null;
}

async function fetchTrades(): Promise<{ items: TradeRow[] }> {
  const qs = new URLSearchParams({
    limit: "200",
    sortBy: "entryTime",
    sortDir: "desc",
  }).toString();
  const res = await fetch(`/api/trades?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load trades");
  return res.json();
}

async function fetchAccounts(): Promise<{ items: any[] }> {
  const res = await fetch("/api/accounts", { cache: "no-store" });
  if (!res.ok) return { items: [] };
  const data = await res.json();
  const arr = (data as any)?.items ?? (data as any)?.accounts ?? (Array.isArray(data) ? data : []);
  return { items: Array.isArray(arr) ? arr : [] };
}

async function fetchStrategies(): Promise<{ items: any[] }> {
  const res = await fetch("/api/strategies", { cache: "no-store" });
  if (!res.ok) return { items: [] };
  const data = await res.json();
  const arr = (data as any)?.items ?? (data as any)?.strategies ?? (Array.isArray(data) ? data : []);
  return { items: Array.isArray(arr) ? arr : [] };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Parse planAdherenceJson → % of true ruleCompliance values (0–100). */
function adherencePct(planAdherenceJson: string | null | undefined): number | null {
  if (!planAdherenceJson) return null;
  try {
    const pa = JSON.parse(planAdherenceJson);
    if (pa && typeof pa.adherencePct === 'number') {
      return Math.round(pa.adherencePct);
    }
    if (pa && typeof pa.followedPlan === 'boolean') {
      return pa.followedPlan ? 100 : 0;
    }
    const rc = pa?.ruleCompliance;
    if (!rc || typeof rc !== "object") return null;
    const values = Object.values(rc);
    if (values.length === 0) return null;
    const truthy = values.filter((v) => v === true).length;
    return Math.round((truthy / values.length) * 100);
  } catch {
    return null;
  }
}

type OutcomeKey = "win" | "loss" | "breakeven" | "open";

/** Classify a trade's outcome from P&L + status (Draft/Open/Planned excluded from W/L/BE). */
function classifyOutcome(t: TradeRow): OutcomeKey {
  if (t.isDraft) return "open";
  if (t.status === "open") return "open";
  if (t.status === "planned") return "open";
  if (t.netPnlCents > 0) return "win";
  if (t.netPnlCents < 0) return "loss";
  return "breakeven";
}

/** Map a trade row to a UI status label (Draft/Planned/Open/Closed). */
function statusLabel(t: TradeRow): { label: string; className: string } {
  if (t.isDraft) {
    return { label: "Draft", className: "bg-background text-muted-foreground border border-border" };
  }
  if (t.status === "planned") {
    return { label: "Planned", className: "bg-primary/10 text-primary" };
  }
  if (t.status === "open") {
    return { label: "Open", className: "bg-warning/15 text-warning" };
  }
  // Closed — win/loss/breakeven/partial_*/cancelled all collapse to "Closed"
  // in the reference UI, but we keep a small colored dot via the badge text.
  return { label: "Closed", className: "bg-background text-muted-foreground" };
}

function setupName(t: TradeRow): string | null {
  return t.strategy?.name ?? null;
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function TradesLogView() {
  const { navigate, params, setParams, selectedAccountId, setSelectedAccountId } = useNav();
  const { user } = useAuth();

  const accountFilter = selectedAccountId || params.accountId || "all";
  function setAccountFilter(v: string) {
    setSelectedAccountId(v === "all" ? "" : v);
  }
  const [setupFilter, setSetupFilter] = useState<string>(params.strategyId || "all");
  const [directionFilter, setDirectionFilter] = useState<string>(params.direction || "all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>(params.outcome || "all");
  const [search, setSearch] = useState(params.search || params.symbol || "");
  const [closeTradeId, setCloseTradeId] = useState<string | null>(null);
  const [executeTradeId, setExecuteTradeId] = useState<string | null>(null);

  // Sync state if navigation params update
  useEffect(() => {
    if (params.symbol && params.symbol !== search) setSearch(params.symbol);
    if (params.search && params.search !== search) setSearch(params.search);
    if (params.strategyId && params.strategyId !== setupFilter) setSetupFilter(params.strategyId);
    if (params.direction && params.direction !== directionFilter) setDirectionFilter(params.direction);
    if (params.outcome && params.outcome !== outcomeFilter) setOutcomeFilter(params.outcome);
  }, [params.symbol, params.search, params.strategyId, params.direction, params.outcome]);

  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ["trades", { log: true }],
    queryFn: fetchTrades,
  });
  const { data: accountsData } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: fetchAccounts,
    enabled: !!user?.id,
  });
  const { data: strategiesData } = useQuery({
    queryKey: ["strategies"],
    queryFn: fetchStrategies,
  });

  const allTrades: TradeRow[] = useMemo(() => {
    if (Array.isArray(tradesData)) return tradesData;
    if (Array.isArray(tradesData?.items)) return tradesData.items;
    if (Array.isArray((tradesData as any)?.trades)) return (tradesData as any).trades;
    return [];
  }, [tradesData]);

  const accounts: { id: string; name: string; broker?: string | null; accountType?: string | null; currency?: string }[] = useMemo(() => {
    if (Array.isArray(accountsData)) return accountsData;
    if (Array.isArray(accountsData?.items)) return accountsData.items;
    if (Array.isArray((accountsData as any)?.accounts)) return (accountsData as any).accounts;
    return [];
  }, [accountsData]);

  const strategies: { id: string; name: string }[] = useMemo(() => {
    if (Array.isArray(strategiesData)) return strategiesData;
    if (Array.isArray(strategiesData?.items)) return strategiesData.items;
    if (Array.isArray((strategiesData as any)?.strategies)) return (strategiesData as any).strategies;
    return [];
  }, [strategiesData]);

  // Compute trade count per strategy to display in the setup selector
  const tradeCountsByStrategy = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of allTrades) {
      const sId = t.strategyId || t.strategy?.id || t.strategyVersion?.strategyId;
      if (sId) {
        counts.set(sId, (counts.get(sId) || 0) + 1);
      }
    }
    return counts;
  }, [allTrades]);

  const selectedStrategy = useMemo(() => {
    if (setupFilter === "all") return null;
    return strategies.find((s) => s.id === setupFilter) || null;
  }, [strategies, setupFilter]);

  const filtered = useMemo(() => {
    return allTrades.filter((t) => {
      // Account filter
      if (accountFilter !== "all" && t.accountId !== accountFilter) return false;

      // Setup filter: resolve parent strategy ID via strategyId, strategy.id, strategyVersion.strategyId, or matching name
      if (setupFilter !== "all") {
        const tradeStratId = t.strategyId || t.strategy?.id || t.strategyVersion?.strategyId;
        const matchesId = tradeStratId === setupFilter;
        const matchesName =
          selectedStrategy?.name &&
          t.strategy?.name &&
          t.strategy.name.toLowerCase() === selectedStrategy.name.toLowerCase();

        if (!matchesId && !matchesName) return false;
      }

      if (directionFilter !== "all" && t.direction !== directionFilter) return false;
      if (outcomeFilter !== "all" && classifyOutcome(t) !== outcomeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.instrumentSymbol.toLowerCase().includes(q) &&
          !(t.strategy?.name ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allTrades, accountFilter, setupFilter, selectedStrategy, directionFilter, outcomeFilter, search]);

  const hasActiveFilters =
    accountFilter !== "all" ||
    setupFilter !== "all" ||
    directionFilter !== "all" ||
    outcomeFilter !== "all" ||
    search !== "";

  function clearFilters() {
    setAccountFilter("all");
    setSetupFilter("all");
    setDirectionFilter("all");
    setOutcomeFilter("all");
    setSearch("");
  }

  function handleApplyPresetFilters(filters: FilterState) {
    if (filters.accountId !== undefined) setAccountFilter(filters.accountId);
    if (filters.setupId !== undefined) setSetupFilter(filters.setupId);
    if (filters.direction !== undefined) setDirectionFilter(filters.direction);
    if (filters.outcome !== undefined) setOutcomeFilter(filters.outcome);
    if (filters.search !== undefined) setSearch(filters.search);
  }

  const currentFilterState: FilterState = useMemo(() => ({
    accountId: accountFilter,
    setupId: setupFilter,
    direction: directionFilter,
    outcome: outcomeFilter,
    search,
  }), [accountFilter, setupFilter, directionFilter, outcomeFilter, search]);

  const availableAccountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
  const availableStrategyIds = useMemo(() => strategies.map((s) => s.id), [strategies]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trades Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every trade you've logged, in chronological order.
          </p>
        </div>
        <div className="sm:ml-auto">
          <Button onClick={() => navigate("tradeNew")}>
            <Plus className="h-4 w-4" /> Log Trade
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-3 md:p-4 space-y-3">
        <SavedFilterPresets
          targetView="tradesLog"
          currentFilters={currentFilterState}
          onApplyFilters={handleApplyPresetFilters}
          availableAccountIds={availableAccountIds}
          availableStrategyIds={availableStrategyIds}
        />

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 z-10" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol or setup…"
              className="h-9 pl-9 border-input rounded-lg bg-card"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-9 w-full border-input rounded-lg">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts ({accounts.length})</SelectItem>
                {accounts.map((a) => {
                  const isDuplicateName = accounts.filter((other) => other.name === a.name).length > 1;
                  const secondary = isDuplicateName
                    ? ` (${a.broker || a.accountType || a.currency || a.id.slice(-4)})`
                    : "";
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{secondary}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={setupFilter} onValueChange={setSetupFilter}>
              <SelectTrigger className="h-9 w-full border-input rounded-lg">
                <SelectValue placeholder="All Setups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Setups ({strategies.length})</SelectItem>
                {strategies.map((s) => {
                  const count = tradeCountsByStrategy.get(s.id) || 0;
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{count > 0 ? ` (${count} trade${count === 1 ? "" : "s"})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="h-9 w-full border-input rounded-lg">
                <SelectValue placeholder="All Directions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>

            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="h-9 w-full border-input rounded-lg">
                <SelectValue placeholder="All Outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="win">Win</SelectItem>
                <SelectItem value="loss">Loss</SelectItem>
                <SelectItem value="breakeven">Breakeven</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Count + clear */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span>{" "}
            of{" "}
            <span className="font-semibold text-foreground tabular-nums">{allTrades.length}</span>{" "}
            trades
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {tradesLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyTradesState
          hasAny={allTrades.length > 0}
          onLogTrade={() => navigate("tradeNew")}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Mobile Card List */}
          <div className="sm:hidden divide-y divide-border">
            {filtered.map((t) => {
              const pnl = formatSignedCents(t.netPnlCents);
              const st = statusLabel(t);
              const setup = setupName(t);
              const rNum = t.actualR ? dToNumber(t.actualR) : null;
              const dateStr = t.entryTime
                ? new Date(t.entryTime).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—";

              return (
                <div
                  key={t.id}
                  onClick={() => navigate("tradeDetail", { id: t.id })}
                  className="p-3.5 hover:bg-muted/50 active:bg-muted/70 cursor-pointer transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base text-foreground">
                        {t.instrumentSymbol}
                      </span>
                      <DirectionBadge direction={t.direction} />
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                          st.className,
                        )}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "text-base font-semibold tabular-nums text-right",
                        pnl.sign < 0 ? "text-loss" : pnl.sign > 0 ? "text-profit" : "text-muted-foreground",
                      )}
                    >
                      {pnl.text}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate max-w-[210px]">
                      <span>{dateStr}</span>
                      {setup && (
                        <>
                          <span>•</span>
                          <span className="truncate">{setup}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {formatR(t.actualR) && (
                        <span
                          className={cn(
                            "tabular-nums font-medium",
                            rNum != null && rNum > 0
                              ? "text-profit"
                              : rNum != null && rNum < 0
                                ? "text-loss"
                                : "text-muted-foreground",
                          )}
                        >
                          {formatR(t.actualR)}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3 hidden md:table-cell">Setup</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">P&amp;L</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">R Multiple</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">Adherence</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const pnl = formatSignedCents(t.netPnlCents);
                  const st = statusLabel(t);
                  const setup = setupName(t);
                  const adherence = adherencePct(t.planAdherenceJson);
                  const rNum = t.actualR ? dToNumber(t.actualR) : null;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate("tradeDetail", { id: t.id })}
                      className="border-b border-border last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                        {t.entryTime
                          ? new Date(t.entryTime).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                        {t.instrumentSymbol}
                      </td>
                      <td className="px-4 py-3">
                        <DirectionBadge direction={t.direction} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {setup ?? <span className="text-muted-foreground/70">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
                            st.className,
                          )}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap",
                          pnl.sign < 0 ? "text-loss" : pnl.sign > 0 ? "text-profit" : "text-muted-foreground",
                        )}
                      >
                        {pnl.text}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums whitespace-nowrap hidden sm:table-cell",
                          rNum == null
                            ? "text-muted-foreground/70"
                            : rNum > 0
                              ? "text-profit font-medium"
                              : rNum < 0
                                ? "text-loss font-medium"
                                : "text-muted-foreground",
                        )}
                      >
                        {formatR(t.actualR)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                        {adherence == null ? (
                          <span className="text-muted-foreground/70">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-medium",
                              adherence >= 80
                                ? "text-profit"
                                : adherence >= 50
                                  ? "text-warning"
                                  : "text-loss",
                            )}
                          >
                            {adherence}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.status === "planned" && !t.isDraft && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px] font-medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("tradeNew", { id: t.id });
                                }}
                              >
                                Edit Plan
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 px-2 text-[11px] font-medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExecuteTradeId(t.id);
                                }}
                              >
                                Start
                              </Button>
                            </>
                          )}
                          {t.status === "open" && !t.isDraft && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCloseTradeId(t.id);
                              }}
                            >
                              <Lock className="h-3 w-3" />
                              Close
                            </Button>
                          )}
                          <span className="inline-flex items-center text-muted-foreground/70">
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Close Trade Modal */}
      <CloseTradeModal
        tradeId={closeTradeId}
        onClose={() => setCloseTradeId(null)}
      />

      {/* Execute Trade Modal */}
      <ExecuteTradeModal
        tradeId={executeTradeId}
        onClose={() => setExecuteTradeId(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Direction badge                                                     */
/* ------------------------------------------------------------------ */

function DirectionBadge({ direction }: { direction: "long" | "short" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold",
        direction === "long"
          ? "bg-profit/15 text-profit"
          : "bg-loss/15 text-loss",
      )}
    >
      {direction === "long" ? "Long" : "Short"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyTradesState({
  hasAny,
  onLogTrade,
}: {
  hasAny: boolean;
  onLogTrade: () => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-10 text-center">
      <BookOpen className="h-8 w-8 mx-auto text-slate-300 mb-3" />
      <h3 className="font-semibold text-foreground">
        {hasAny ? "No trades found matching criteria" : "No trades logged yet"}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        {hasAny
          ? "Try adjusting your filters, or log a new trade to get started."
          : "Log your first trade to start building your performance journal."}
      </p>
      <Button onClick={onLogTrade} className="mt-4">
        <Plus className="h-4 w-4" /> Log Trade
      </Button>
    </div>
  );
}
