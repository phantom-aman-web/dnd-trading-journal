"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, PencilLine, Trash2, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatSignedCents } from "@/lib/money";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface TradingAccount {
  id: string;
  name: string;
  broker?: string | null;
  accountType: string;
  currency: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
  consistencyRate?: number | null;
  dailyLossLimitPct?: number | null;
  maxDrawdownPct?: number | null;
  isDefault: boolean;
  createdAt: string;
}

interface TradeRow {
  id: string;
  accountId: string;
  netPnlCents: number;
  isDraft: boolean;
  status: string;
}

const ACCOUNT_TYPES = [
  { value: "personal", label: "Personal" },
  { value: "prop", label: "Prop Firm" },
  { value: "funded", label: "Funded" },
  { value: "demo", label: "Demo" },
  { value: "backtest", label: "Backtest" },
  { value: "other", label: "Other" },
];

const ACCOUNT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.value, t.label]),
);

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];

/** Reference-site badge styling per account type. */
function typeBadgeClasses(type: string): string {
  switch (type) {
    case "personal":
      return "bg-primary/15 text-blue-700";
    case "prop":
      return "bg-primary/15 text-purple-700";
    case "funded":
      return "bg-profit/15 text-profit";
    case "demo":
      return "bg-background text-muted-foreground";
    case "backtest":
      return "bg-warning/15 text-warning";
    default:
      return "bg-background text-muted-foreground";
  }
}

/* ------------------------------------------------------------------ */
/* Data fetching                                                       */
/* ------------------------------------------------------------------ */

async function fetchAccounts(): Promise<TradingAccount[]> {
  const res = await fetch("/api/accounts", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const arr = (data as any)?.items ?? (data as any)?.accounts ?? (Array.isArray(data) ? data : []);
  return Array.isArray(arr) ? arr : [];
}

async function fetchTrades(): Promise<TradeRow[]> {
  const qs = new URLSearchParams({ limit: "200", sortBy: "entryTime", sortDir: "desc" }).toString();
  const res = await fetch(`/api/trades?${qs}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const arr = (data as any)?.items ?? (data as any)?.trades ?? (Array.isArray(data) ? data : []);
  return Array.isArray(arr) ? arr : [];
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function AccountsView() {
  const qc = useQueryClient();
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });
  const { data: tradesData } = useQuery({
    queryKey: ["trades", { log: true }],
    queryFn: fetchTrades,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TradingAccount | null>(null);

  const accounts: TradingAccount[] = Array.isArray(accountsData) ? accountsData : (accountsData?.items ?? (Array.isArray(accountsData?.accounts) ? accountsData.accounts : []));
  const trades: TradeRow[] = Array.isArray(tradesData) ? tradesData : (tradesData?.items ?? (Array.isArray(tradesData?.trades) ? tradesData.trades : []));

  // Group trades by account and compute per-account stats.
  const statsByAccount = useMemo(() => {
    const map = new Map<
      string,
      { count: number; wins: number; losses: number; pnlCents: number }
    >();
    for (const t of trades) {
      const s = map.get(t.accountId) ?? { count: 0, wins: 0, losses: 0, pnlCents: 0 };
      s.count += 1;
      s.pnlCents += t.netPnlCents;
      if (!t.isDraft && t.status !== "open") {
        if (t.netPnlCents > 0) s.wins += 1;
        else if (t.netPnlCents < 0) s.losses += 1;
      }
      map.set(t.accountId, s);
    }
    return map;
  }, [trades]);

  // Aggregate summary across all accounts.
  const aggregate = useMemo(() => {
    let totalBalanceCents = 0;
    let totalStartingCents = 0;
    let totalTrades = 0;
    let totalWins = 0;
    let totalClosed = 0;
    let totalPnlCents = 0;
    for (const a of accounts) {
      totalBalanceCents += a.currentBalanceCents;
      totalStartingCents += a.startingBalanceCents;
      const s = statsByAccount.get(a.id);
      if (s) {
        totalTrades += s.count;
        totalWins += s.wins;
        totalClosed += s.wins + s.losses;
        totalPnlCents += s.pnlCents;
      }
    }
    return {
      totalBalanceCents: totalStartingCents + totalPnlCents,
      totalPnlCents,
      totalTrades,
      winRate: totalClosed > 0 ? Math.round((totalWins / totalClosed) * 100) : null,
    };
  }, [accounts, statsByAccount]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(a: TradingAccount) {
    setEditing(a);
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-6xl">
        <Skeleton className="h-10 w-48" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your trading accounts, balances, and risk limits.
          </p>
        </div>
        <div className="sm:ml-auto">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Account
          </Button>
        </div>
      </div>

      {/* Aggregate summary */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryStat
            label="Total Balance"
            value={formatSignedCents(aggregate.totalBalanceCents).text}
            valueClass="text-foreground"
          />
          <SummaryStat
            label="Total P&L"
            value={formatSignedCents(aggregate.totalPnlCents).text}
            valueClass={
              aggregate.totalPnlCents > 0
                ? "text-profit"
                : aggregate.totalPnlCents < 0
                  ? "text-loss"
                  : "text-foreground"
            }
          />
          <SummaryStat
            label="Total Trades"
            value={String(aggregate.totalTrades)}
            valueClass="text-foreground"
          />
          <SummaryStat
            label="Win Rate"
            value={aggregate.winRate == null ? "—" : `${aggregate.winRate}%`}
            valueClass="text-foreground"
          />
        </div>
      )}

      {/* Empty state */}
      {accounts.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-sm p-10 text-center">
          <Wallet className="h-8 w-8 mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-foreground">No accounts yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Add your first trading account to start logging trades and tracking performance.
          </p>
          <Button onClick={openCreate} className="mt-4">
            <Plus className="h-4 w-4" /> Add Account
          </Button>
        </div>
      ) : (
        /* Account cards grid */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => {
            const stats = statsByAccount.get(a.id);
            const tradesCount = stats?.count ?? 0;
            const closed = stats ? stats.wins + stats.losses : 0;
            const winRate = closed > 0 ? Math.round((stats!.wins / closed) * 100) : null;
            const pnlCents = stats?.pnlCents ?? 0;
            const pnl = formatSignedCents(pnlCents, a.currency ?? "USD");
            const balance = formatSignedCents(a.startingBalanceCents + pnlCents, a.currency ?? "USD");
            return (
              <div
                key={a.id}
                className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                          typeBadgeClasses(a.accountType),
                        )}
                      >
                        {ACCOUNT_TYPE_LABELS[a.accountType] ?? a.accountType}
                      </span>
                      {a.isDefault && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-slate-900 text-primary-foreground">
                          Default
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-foreground truncate">{a.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.broker ? a.broker : <span className="italic">No broker</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(a)}
                      className="p-1.5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-background transition-colors"
                      aria-label="Edit account"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (tradesCount > 0) {
                          toast.error(
                            `Cannot delete: ${tradesCount} trade${tradesCount === 1 ? "" : "s"} linked to this account. Archive trades first.`,
                          );
                          return;
                        }
                        if (!confirm("Delete this account?")) return;
                        const res = await fetch(`/api/accounts/${a.id}`, { method: "DELETE" });
                        if (res.ok) {
                          toast.success("Account deleted.");
                          qc.invalidateQueries({ queryKey: ["accounts"] });
                        } else {
                          const d = await res.json().catch(() => null);
                          toast.error(d?.error ?? "Failed to delete account.");
                        }
                      }}
                      className="p-1.5 rounded text-muted-foreground/70 hover:text-loss hover:bg-background transition-colors"
                      aria-label="Delete account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Balance + P&L */}
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Balance
                    </div>
                    <div className="text-2xl font-bold text-foreground tabular-nums">
                      {balance.text}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      P&amp;L
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        pnl.sign < 0 ? "text-loss" : pnl.sign > 0 ? "text-profit" : "text-muted-foreground",
                      )}
                    >
                      {pnl.text}
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                  <StatCell label="Trades" value={String(tradesCount)} />
                  <StatCell
                    label="Win Rate"
                    value={winRate == null ? "—" : `${winRate}%`}
                  />
                  <StatCell
                    label="Consistency"
                    value={
                      a.consistencyRate == null
                        ? "—"
                        : `${Math.round(a.consistencyRate)}%`
                    }
                  />
                </div>

                {/* Risk limits (optional) */}
                {(a.dailyLossLimitPct != null || a.maxDrawdownPct != null) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[11px] text-muted-foreground">
                    {a.dailyLossLimitPct != null && (
                      <span>
                        Daily loss limit:{" "}
                        <span className="font-medium text-loss tabular-nums">
                          {a.dailyLossLimitPct}%
                        </span>
                      </span>
                    )}
                    {a.maxDrawdownPct != null && (
                      <span>
                        Max DD:{" "}
                        <span className="font-medium text-loss tabular-nums">
                          {a.maxDrawdownPct}%
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Performance detail section */}
      {accounts.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h2 className="font-semibold text-foreground mb-3">Performance Detail</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">Starting</th>
                  <th className="px-3 py-2 text-right">P&amp;L</th>
                  <th className="px-3 py-2 text-right">Trades</th>
                  <th className="px-3 py-2 text-right">Win Rate</th>
                  <th className="px-3 py-2 text-right hidden md:table-cell">Consistency</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const stats = statsByAccount.get(a.id);
                  const tradesCount = stats?.count ?? 0;
                  const closed = stats ? stats.wins + stats.losses : 0;
                  const winRate = closed > 0 ? Math.round((stats!.wins / closed) * 100) : null;
                  const pnlCents = stats?.pnlCents ?? 0;
                  const pnl = formatSignedCents(pnlCents, a.currency ?? "USD");
                  const bal = formatSignedCents(a.startingBalanceCents + pnlCents, a.currency ?? "USD");
                  const start = formatSignedCents(a.startingBalanceCents, a.currency ?? "USD");
                  return (
                    <tr key={a.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground truncate max-w-[200px]">
                          {a.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{a.currency}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {bal.text}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {start.text}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums font-medium",
                          pnl.sign < 0 ? "text-loss" : pnl.sign > 0 ? "text-profit" : "text-muted-foreground",
                        )}
                      >
                        {pnl.text}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {tradesCount}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {winRate == null ? "—" : `${winRate}%`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground hidden md:table-cell">
                        {a.consistencyRate == null ? "—" : `${Math.round(a.consistencyRate)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Account create / edit dialog (controlled, triggerless) */}
      <AccountDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        account={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["accounts"] });
          qc.invalidateQueries({ queryKey: ["trades"] });
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function SummaryStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("text-lg font-bold tabular-nums mt-1", valueClass)}>
        {value}
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account create / edit dialog                                        */
/* ------------------------------------------------------------------ */

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog acts as an Edit dialog for this account. */
  account?: TradingAccount | null;
  onSaved: () => void;
}

function AccountDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: AccountDialogProps) {
  const isEdit = !!account;

  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [accountType, setAccountType] = useState("personal");
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState("10000");
  const [consistencyRate, setConsistencyRate] = useState("");
  const [dailyLossLimitPct, setDailyLossLimitPct] = useState("");
  const [maxDrawdownPct, setMaxDrawdownPct] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed from the account prop whenever the dialog opens (so edits on
  // different rows stay fresh and create mode starts clean).
  useEffect(() => {
    if (!open) {
      setSeeded(false);
      return;
    }
    if (seeded) return;
    setName(account?.name ?? "");
    setBroker(account?.broker ?? "");
    setAccountType(account?.accountType ?? "personal");
    setCurrency(account?.currency ?? "USD");
    setBalance(
      account
        ? (account.startingBalanceCents / 100).toFixed(2)
        : "10000",
    );
    setConsistencyRate(
      account?.consistencyRate != null ? String(account.consistencyRate) : "",
    );
    setDailyLossLimitPct(
      account?.dailyLossLimitPct != null ? String(account.dailyLossLimitPct) : "",
    );
    setMaxDrawdownPct(
      account?.maxDrawdownPct != null ? String(account.maxDrawdownPct) : "",
    );
    setIsDefault(account?.isDefault ?? false);
    setSeeded(true);
  }, [open, account, seeded]);

  async function submit() {
    if (!name.trim()) {
      toast.error("Account name is required");
      return;
    }
    const balanceNum = Number(balance);
    if (!Number.isFinite(balanceNum)) {
      toast.error("Initial balance must be a valid number");
      return;
    }
    setLoading(true);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      broker: broker.trim() || null,
      accountType,
      currency,
      consistencyRate: consistencyRate === "" ? null : Number(consistencyRate),
      dailyLossLimitPct: dailyLossLimitPct === "" ? null : Number(dailyLossLimitPct),
      maxDrawdownPct: maxDrawdownPct === "" ? null : Number(maxDrawdownPct),
      isDefault,
      startingBalanceCents: Math.round(balanceNum * 100),
    };

    try {
      const res = isEdit
        ? await fetch(`/api/accounts/${account!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast.success(isEdit ? "Account updated." : "Account created.");
        onSaved();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? `Failed to ${isEdit ? "update" : "create"} account.`);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "New Account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-foreground text-sm font-medium">
              Account Name <span className="text-loss">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FTMO 100k, Primary"
              className="border-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm font-medium">Broker or Firm</Label>
              <Input
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                placeholder="FTMO"
                className="border-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm font-medium">Account Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger className="border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm font-medium">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm font-medium">
                Initial Balance <span className="text-loss">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="border-input tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm font-medium">Consistency Rate %</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={consistencyRate}
                onChange={(e) => setConsistencyRate(e.target.value)}
                placeholder="—"
                className="border-input tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm font-medium">Daily Loss Limit %</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={dailyLossLimitPct}
                onChange={(e) => setDailyLossLimitPct(e.target.value)}
                placeholder="—"
                className="border-input tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm font-medium">Max Drawdown %</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={maxDrawdownPct}
                onChange={(e) => setMaxDrawdownPct(e.target.value)}
                placeholder="—"
                className="border-input tabular-nums"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
            <Checkbox
              checked={isDefault}
              onCheckedChange={(v) => setIsDefault(v === true)}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">Default account</div>
              <div className="text-xs text-muted-foreground">
                Use this account for new trades by default.
              </div>
            </div>
          </label>

          <Button onClick={submit} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
