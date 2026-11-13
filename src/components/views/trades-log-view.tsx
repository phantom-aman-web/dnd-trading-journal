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
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  Search,
  X,
  Lock,
  Play,
  Loader2,
} from "lucide-react";
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
  account?: { id: string; name: string } | null;
  planAdherenceJson: string | null;
}

interface TradesResponse {
  items: TradeRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function fetchTradesList(params: {
  page: number;
  pageSize: number;
  search: string;
  accountId: string;
  setupId: string;
  direction: string;
  outcome: string;
}): Promise<TradesResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.pageSize),
    sortBy: "entryTime",
    sortDir: "desc",
  });
  if (params.search.trim()) qs.set("search", params.search.trim());
  if (params.accountId !== "all") qs.set("accountId", params.accountId);
  if (params.setupId !== "all") qs.set("strategyId", params.setupId);
  if (params.direction !== "all") qs.set("direction", params.direction);
  if (params.outcome !== "all") qs.set("outcome", params.outcome);

  const res = await fetch(`/api/trades?${qs.toString()}`, { cache: "no-store" });
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

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export function TradesLogView() {
  const { navigate, params, setParams, selectedAccountId, setSelectedAccountId } = useNav();
  const { user } = useAuth();

  const accountFilter = selectedAccountId || params.accountId || "all";
  function setAccountFilter(v: string) {
    setSelectedAccountId(v === "all" ? "" : v);
    setPage(1);
  }
  const [setupFilter, setSetupFilter] = useState<string>(params.strategyId || "all");
  const [directionFilter, setDirectionFilter] = useState<string>(params.direction || "all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>(params.outcome || "all");
  const [search, setSearch] = useState(params.search || params.symbol || "");
  const [debouncedSearch, setDebouncedSearch] = useState<string>(search);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>("");
  const [closeTradeId, setCloseTradeId] = useState<string | null>(null);
  const [executeTradeId, setExecuteTradeId] = useState<string | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Sync state if navigation params update
  useEffect(() => {
    if (params.symbol && params.symbol !== search) {
      setSearch(params.symbol);
      setPage(1);
    }
    if (params.search && params.search !== search) {
      setSearch(params.search);
      setPage(1);
    }
    if (params.strategyId && params.strategyId !== setupFilter) {
      setSetupFilter(params.strategyId);
      setPage(1);
    }
    if (params.direction && params.direction !== directionFilter) {
      setDirectionFilter(params.direction);
      setPage(1);
    }
    if (params.outcome && params.outcome !== outcomeFilter) {
      setOutcomeFilter(params.outcome);
      setPage(1);
    }
  }, [params.symbol, params.search, params.strategyId, params.direction, params.outcome]);

  const {
    data: tradesData,
    isLoading: tradesLoading,
    isFetching: tradesFetching,
  } = useQuery({
    queryKey: [
      "trades-log",
      page,
      pageSize,
      debouncedSearch,
      accountFilter,
      setupFilter,
      directionFilter,
      outcomeFilter,
    ],
    queryFn: () =>
      fetchTradesList({
        page,
        pageSize,
        search: debouncedSearch,
        accountId: accountFilter,
        setupId: setupFilter,
        direction: directionFilter,
        outcome: outcomeFilter,
      }),
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

  const trades: TradeRow[] = tradesData?.items ?? [];
  const totalTrades: number = tradesData?.total ?? 0;
  const totalPages: number = Math.max(1, tradesData?.totalPages ?? 1);

  // Auto-correct page if current page exceeds total pages
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
    setPage(1);
  }

  function handleApplyPresetFilters(filters: FilterState) {
    if (filters.accountId !== undefined) setAccountFilter(filters.accountId);
    if (filters.setupId !== undefined) {
      setSetupFilter(filters.setupId);
      setPage(1);
    }
    if (filters.direction !== undefined) {
      setDirectionFilter(filters.direction);
      setPage(1);
    }
    if (filters.outcome !== undefined) {
      setOutcomeFilter(filters.outcome);
      setPage(1);
    }
    if (filters.search !== undefined) {
      setSearch(filters.search);
      setPage(1);
    }
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

  const startTradeIndex = totalTrades === 0 ? 0 : (page - 1) * pageSize + 1;
  const endTradeIndex = Math.min(page * pageSize, totalTrades);

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
              placeholder="Search symbol, notes, strategy, tags, account, direction, outcome..."
              className="h-9 pl-9 pr-14 border-input rounded-lg bg-card text-sm"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {tradesFetching && (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              )}
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
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

            <Select
              value={setupFilter}
              onValueChange={(v) => {
                setSetupFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full border-input rounded-lg">
                <SelectValue placeholder="All Setups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Setups ({strategies.length})</SelectItem>
                {strategies.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={directionFilter}
              onValueChange={(v) => {
                setDirectionFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full border-input rounded-lg">
                <SelectValue placeholder="All Directions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={outcomeFilter}
              onValueChange={(v) => {
                setOutcomeFilter(v);
                setPage(1);
              }}
            >
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
            <span className="font-semibold text-foreground tabular-nums">{startTradeIndex}–{endTradeIndex}</span>{" "}
            of{" "}
            <span className="font-semibold text-foreground tabular-nums">{totalTrades}</span>{" "}
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
      ) : trades.length === 0 ? (
        <EmptyTradesState
          hasAny={totalTrades > 0}
          onLogTrade={() => navigate("tradeNew")}
        />
      ) : (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {/* Mobile Card List */}
            <div className="sm:hidden divide-y divide-border">
              {trades.map((t) => {
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
                  {trades.map((t) => {
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

          {/* Pagination & Range Footer */}
          <div className="bg-card rounded-xl border border-border p-3 md:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
              <span>
                Showing{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {startTradeIndex}–{endTradeIndex}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground tabular-nums">{totalTrades}</span>{" "}
                trades
              </span>

              {/* Page size selector */}
              <div className="flex items-center gap-1.5 ml-2">
                <span className="hidden sm:inline text-xs">Per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v) || 25);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[72px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Page controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 flex-wrap justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || tradesFetching}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Previous
                </Button>

                {getPageNumbers(page, totalPages).map((pNum, idx) => {
                  if (pNum === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                        …
                      </span>
                    );
                  }
                  const isCurrent = pNum === page;
                  return (
                    <Button
                      key={pNum}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 min-w-[32px] px-2 text-xs tabular-nums",
                        isCurrent && "font-semibold shadow-xs",
                      )}
                      onClick={() => setPage(pNum as number)}
                      disabled={tradesFetching}
                    >
                      {pNum}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || tradesFetching}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>

                {/* Jump to page */}
                <div className="flex items-center gap-1 ml-2">
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    placeholder="#"
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const target = Number(jumpPageInput);
                        if (target >= 1 && target <= totalPages) {
                          setPage(target);
                          setJumpPageInput("");
                        }
                      }
                    }}
                    className="h-8 w-14 text-xs tabular-nums text-center px-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      const target = Number(jumpPageInput);
                      if (target >= 1 && target <= totalPages) {
                        setPage(target);
                        setJumpPageInput("");
                      }
                    }}
                    disabled={!jumpPageInput || Number(jumpPageInput) < 1 || Number(jumpPageInput) > totalPages}
                  >
                    Go
                  </Button>
                </div>
              </div>
            )}
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
