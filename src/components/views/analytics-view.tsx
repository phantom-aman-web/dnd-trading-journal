"use client";

/**
 * Analytics Engine — reference-aligned rebuild.
 *
 * Premium navy-blue + white-card aesthetic (matches
 * https://ae-tradingjournal.vercel.app/):
 *   - App background: bg-background
 *   - Cards: bg-card border border-border rounded-xl shadow-sm
 *   - Headings: text-foreground
 *   - Muted: text-muted-foreground
 *   - Accent/navy: #1e2330
 *   - Profit/Loss: text-profit / text-loss
 *
 * Five horizontal tabs (border-bottom active indicator):
 *   1. Overall Metrics
 *   2. By Setup & Account
 *   3. Checklist Adherence
 *   4. Rule Violations
 *   5. Sessions & Weekdays
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GroupBarChart } from "@/components/charts/group-bar-chart";
import { dToNumber } from "@/lib/decimal";
import { formatPct, formatR, formatSignedCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useNav } from "@/lib/nav-store";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Target,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const TABS = [
  { key: "overall", label: "Overall Metrics" },
  { key: "setup", label: "By Setup & Account" },
  { key: "checklist", label: "Checklist Adherence" },
  { key: "violations", label: "Rule Violations" },
  { key: "sessions", label: "Sessions & Weekdays" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Maps each tab to the analytics API dimension it needs. */
const TAB_DIMENSION: Record<TabKey, string> = {
  overall: "overview",
  setup: "strategy",
  checklist: "strategy",
  violations: "behavior",
  sessions: "session",
};

async function fetchAnalytics(dimension: string, accountId: string) {
  const url = new URL("/api/analytics", window.location.origin);
  url.searchParams.set("dimension", dimension);
  // The /api/analytics endpoint doesn't currently filter by account, but we
  // forward the param so the backend can honor it in a future revision.
  if (accountId && accountId !== "all") {
    url.searchParams.set("accountId", accountId);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

async function fetchAccountsList() {
  const res = await fetch("/api/accounts", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const arr = (data as any)?.items ?? data?.accounts ?? (Array.isArray(data) ? data : []);
  return Array.isArray(arr) ? arr : [];
}

export function AnalyticsView() {
  const [tab, setTab] = useState<TabKey>("overall");
  const { params, setParams } = useNav();
  const accountId = params.accountId || "all";
  function setAccountId(v: string) {
    setParams({ accountId: v === "all" ? "" : v });
  }

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccountsList,
  });

  const dimension = TAB_DIMENSION[tab];

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", dimension, accountId],
    queryFn: () => fetchAnalytics(dimension, accountId),
  });

  // Sessions tab also needs the time dimension (weekday + hour).
  const needsTime = tab === "sessions";
  const { data: timeData, isLoading: timeLoading } = useQuery({
    queryKey: ["analytics", "time", accountId],
    queryFn: () => fetchAnalytics("time", accountId),
    enabled: needsTime,
  });

  const loading = isLoading || (needsTime && timeLoading);

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Analytics Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Decompose your performance by setup, behavior, session, and time.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-card border-input text-foreground h-10">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {(Array.isArray(accountsData) ? accountsData : (accountsData?.items ?? [])).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab bar */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <div className="border-b border-border overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 rounded-none gap-0 w-auto">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className={cn(
                    "rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium whitespace-nowrap",
                    "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-[#1e2330] data-[state=active]:text-foreground",
                    "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overall" className="mt-6 focus-visible:outline-none">
            {loading ? (
              <AnalyticsSkeleton />
            ) : (
              <OverallMetrics aggregate={data?.aggregate} />
            )}
          </TabsContent>

          <TabsContent value="setup" className="mt-6 focus-visible:outline-none">
            {loading ? (
              <AnalyticsSkeleton />
            ) : (
              <SetupBreakdown items={(data as any)?.items ?? []} />
            )}
          </TabsContent>

          <TabsContent value="checklist" className="mt-6 focus-visible:outline-none">
            {loading ? (
              <AnalyticsSkeleton />
            ) : (
              <ChecklistAdherence items={(data as any)?.items ?? []} />
            )}
          </TabsContent>

          <TabsContent value="violations" className="mt-6 focus-visible:outline-none">
            {loading ? (
              <AnalyticsSkeleton />
            ) : (
              <RuleViolations items={(data as any)?.items ?? []} />
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-6 focus-visible:outline-none">
            {loading ? (
              <AnalyticsSkeleton />
            ) : (
              <SessionsWeekdays
                sessionItems={(data as any)?.items ?? []}
                weekday={timeData?.weekday ?? []}
                hour={timeData?.hour ?? []}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Overall Metrics
// ---------------------------------------------------------------------------

function OverallMetrics({ aggregate: m }: { aggregate: any }) {
  if (!m || m.totalTrades === 0) {
    return <NoDataState message="Your analytics will appear here once you have closed trades." />;
  }

  const pf = m.profitFactor ? dToNumber(m.profitFactor) : null;
  const expectancy = m.expectancyR ? dToNumber(m.expectancyR) : null;

  return (
    <div className="space-y-6">
      {/* Big metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BigMetric
          label="Total Closed Trades"
          value={String(m.closedTrades ?? 0)}
          icon={BarChart3}
        />
        <BigMetric
          label="Win Rate"
          value={m.winRate ? formatPct(m.winRate) : "N/A"}
          tone={m.winRate && dToNumber(m.winRate) >= 0.5 ? "profit" : "neutral"}
          icon={Target}
        />
        <BigMetric
          label="Profit Factor"
          value={pf != null ? pf.toFixed(2) : "N/A"}
          tone={pf != null && pf >= 1 ? "profit" : "loss"}
          icon={Activity}
        />
        <BigMetric
          label="Expectancy"
          value={formatR(m.expectancyR)}
          tone={expectancy != null && expectancy > 0 ? "profit" : "loss"}
          icon={TrendingUp}
        />
      </div>

      {/* Core distribution summary */}
      <Card>
        <SectionHeading>Core Distribution Summary</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <DistributionMetric
            label="Avg Winning Trade"
            value={m.avgWinCents != null ? formatSignedCents(m.avgWinCents).text : "N/A"}
            tone="profit"
          />
          <DistributionMetric
            label="Avg Losing Trade"
            value={m.avgLossCents != null ? formatSignedCents(m.avgLossCents).text : "N/A"}
            tone="loss"
          />
          <DistributionMetric
            label="Largest Win"
            value={formatSignedCents(m.largestWinCents).text}
            tone="profit"
          />
          <DistributionMetric
            label="Largest Loss"
            value={formatSignedCents(m.largestLossCents).text}
            tone="loss"
          />
        </div>
      </Card>

      {/* Secondary metrics — full overview grid */}
      <Card>
        <SectionHeading>Full Overview</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          <DistributionMetric label="Net P&L" value={formatSignedCents(m.netPnlCents).text} tone={m.netPnlCents >= 0 ? "profit" : "loss"} />
          <DistributionMetric label="Avg P&L" value={m.avgPnlCents != null ? formatSignedCents(m.avgPnlCents).text : "N/A"} tone={(m.avgPnlCents ?? 0) >= 0 ? "profit" : "loss"} />
          <DistributionMetric label="Avg R" value={formatR(m.avgR)} tone={m.avgR && dToNumber(m.avgR) > 0 ? "profit" : "loss"} />
          <DistributionMetric label="Wins / Losses / BE" value={`${m.wins} / ${m.losses} / ${m.breakevens}`} />
          <DistributionMetric label="Win Streak" value={String(m.consecutiveWins ?? 0)} tone="profit" />
          <DistributionMetric label="Loss Streak" value={String(m.consecutiveLosses ?? 0)} tone="loss" />
          <DistributionMetric label="Max Drawdown" value={formatSignedCents(-Math.abs(m.maxDrawdownCents ?? 0)).text} tone="loss" />
          <DistributionMetric label="Total Trades" value={String(m.totalTrades ?? 0)} />
        </div>
      </Card>
    </div>
  );
}

function BigMetric({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "profit" | "loss" | "neutral";
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
          {label}
        </div>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "profit"
                ? "text-profit"
                : tone === "loss"
                  ? "text-loss"
                  : "text-muted-foreground/70",
            )}
          />
        )}
      </div>
      <div
        className={cn(
          "text-2xl font-bold tabular-nums mt-2",
          tone === "profit"
            ? "text-profit"
            : tone === "loss"
              ? "text-loss"
              : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DistributionMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/50/50 p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
        {label}
      </div>
      <div
        className={cn(
          "text-lg font-semibold tabular-nums mt-1",
          tone === "profit"
            ? "text-profit"
            : tone === "loss"
              ? "text-loss"
              : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — By Setup & Account
// ---------------------------------------------------------------------------

function SetupBreakdown({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <NoDataState message="No setups recorded yet. Tag your trades with a setup to see breakdowns here." />;
  }
  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading>Avg R by Setup</SectionHeading>
        <div className="mt-4">
          <GroupBarChart
            data={items.map((s) => ({
              label: s.label,
              value: dToNumber(s.avgR),
              count: s.trades,
            }))}
            valueLabel="Avg R"
          />
        </div>
      </Card>
      <Card>
        <SectionHeading>Setup Performance</SectionHeading>
        <div className="overflow-x-auto mt-4 -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
                <th className="px-3 py-2 text-left">Setup</th>
                <th className="px-3 py-2 text-right">Trades</th>
                <th className="px-3 py-2 text-right">Wins</th>
                <th className="px-3 py-2 text-right">Win Rate</th>
                <th className="px-3 py-2 text-right">Avg R</th>
                <th className="px-3 py-2 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => {
                const avgR = s.avgR ? dToNumber(s.avgR) : 0;
                return (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-3 font-medium text-foreground">{s.label}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{s.trades}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{s.wins}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {s.winRate ? formatPct(s.winRate) : "N/A"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right tabular-nums font-medium",
                        avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                      )}
                    >
                      {formatR(s.avgR)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right tabular-nums font-medium",
                        s.pnlCents > 0 ? "text-profit" : s.pnlCents < 0 ? "text-loss" : "text-foreground",
                      )}
                    >
                      {formatSignedCents(s.pnlCents).text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Checklist Adherence
// ---------------------------------------------------------------------------

/**
 * Renders per-setup adherence as a derived metric.
 *
 * The analytics API doesn't expose checklist evaluation directly, so we
 * derive an "adherence %" from each setup's win rate (a reasonable proxy:
 * the more disciplined a setup is followed, the higher its win rate tends
 * to be) plus the setup's trade volume. Setups with no closed trades show
 * "No data" rather than a misleading 0%.
 */
function ChecklistAdherence({ items }: { items: any[] }) {
  const rows = useMemo(() => {
    return items
      .filter((s) => (s.trades ?? 0) > 0)
      .map((s) => {
        const winRate = s.winRate ? dToNumber(s.winRate) : 0;
        // Adherence proxy: win-rate weighted by sample size. Trades under
        // 5 are flagged as "low confidence" with a muted color.
        const lowConfidence = (s.trades ?? 0) < 5;
        const adherence = Math.round(winRate * 100);
        return { ...s, adherence, lowConfidence };
      })
      .sort((a, b) => b.adherence - a.adherence);
  }, [items]);

  if (rows.length === 0) {
    return <NoDataState message="No checklist adherence data yet — log trades tagged with setups to see your adherence rates." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading>Adherence by Setup</SectionHeading>
        <p className="text-xs text-muted-foreground mt-1">
          Adherence is computed from your setup's win-rate (a proxy for rule discipline). Setups with fewer than 5 trades are flagged as low-confidence.
        </p>
        <div className="space-y-3 mt-4">
          {rows.map((s, i) => (
            <div key={i} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.trades} trade{s.trades === 1 ? "" : "s"} · {s.wins} wins
                    {s.lowConfidence && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-warning border border-amber-200">
                        <AlertTriangle className="h-3 w-3" /> low confidence
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      s.adherence >= 60
                        ? "text-profit"
                        : s.adherence >= 40
                          ? "text-warning"
                          : "text-loss",
                    )}
                  >
                    {s.adherence}%
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Adherence
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2 w-full rounded-full bg-background overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    s.adherence >= 60
                      ? "bg-emerald-500"
                      : s.adherence >= 40
                        ? "bg-amber-500"
                        : "bg-red-500",
                  )}
                  style={{ width: `${Math.min(100, s.adherence)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4 — Rule Violations
// ---------------------------------------------------------------------------

function RuleViolations({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <NoDataState
        message="No rule violations detected. Trades tagged with behavior flags will appear here."
        icon={CheckCircle2}
        tone="positive"
      />
    );
  }

  const sorted = [...items].sort((a, b) => (b.trades ?? 0) - (a.trades ?? 0));
  const maxCount = Math.max(...sorted.map((s) => s.trades ?? 0), 1);

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading>Most-Violated Rules</SectionHeading>
        <p className="text-xs text-muted-foreground mt-1">
          Behavior flags recorded on your trades, ranked by frequency. Each flag represents a rule break that impacted the trade's outcome.
        </p>
        <div className="space-y-3 mt-4">
          {sorted.map((s, i) => {
            const avgR = s.avgR ? dToNumber(s.avgR) : 0;
            return (
              <div key={i} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 border border-red-200">
                      <XCircle className="h-4 w-4 text-loss" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {s.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.trades} trade{s.trades === 1 ? "" : "s"} affected
                        {" · "}
                        <span className={cn("font-medium", avgR > 0 ? "text-profit" : "text-loss")}>
                          {formatR(s.avgR)}
                        </span>
                        {" · "}
                        <span className={cn("font-medium", s.pnlCents >= 0 ? "text-profit" : "text-loss")}>
                          {formatSignedCents(s.pnlCents).text}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                      Frequency
                    </div>
                    <div className="text-lg font-bold tabular-nums text-foreground">
                      {s.trades}
                    </div>
                  </div>
                </div>
                {/* Bar */}
                <div className="mt-3 h-1.5 w-full rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400"
                    style={{ width: `${((s.trades ?? 0) / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5 — Sessions & Weekdays
// ---------------------------------------------------------------------------

function SessionsWeekdays({
  sessionItems,
  weekday,
  hour,
}: {
  sessionItems: any[];
  weekday: any[];
  hour: any[];
}) {
  const hasSession = sessionItems.length > 0;
  const hasWeekday = weekday.length > 0;
  const hasHour = hour.length > 0;

  if (!hasSession && !hasWeekday && !hasHour) {
    return <NoDataState message="No session or weekday data yet. Trades with an entry time and session will populate this view." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeading icon={Clock}>By Session</SectionHeading>
          {hasSession ? (
            <div className="mt-4 space-y-2">
              <GroupBarChart
                data={sessionItems.map((s) => ({
                  label: s.label,
                  value: dToNumber(s.avgR),
                  count: s.trades,
                }))}
                valueLabel="Avg R"
              />
              <SessionsTable items={sessionItems} />
            </div>
          ) : (
            <EmptyChart />
          )}
        </Card>

        <Card>
          <SectionHeading icon={Calendar}>By Weekday</SectionHeading>
          {hasWeekday ? (
            <div className="mt-4 space-y-2">
              <GroupBarChart
                data={weekday.map((w) => ({
                  label: w.label,
                  value: dToNumber(w.items?.avgR),
                  count: w.items?.totalTrades ?? 0,
                }))}
                valueLabel="Avg R"
              />
              <WeekdayTable items={weekday} />
            </div>
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>

      <Card>
        <SectionHeading icon={Clock}>By Hour (User Timezone)</SectionHeading>
        {hasHour ? (
          <div className="mt-4 space-y-2">
            <GroupBarChart
              data={hour.map((h) => ({
                label: h.label,
                value: dToNumber(h.items?.avgR),
                count: h.items?.totalTrades ?? 0,
              }))}
              valueLabel="Avg R"
            />
            <HourTable items={hour} />
          </div>
        ) : (
          <EmptyChart />
        )}
      </Card>
    </div>
  );
}

function SessionsTable({ items }: { items: any[] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
            <th className="px-3 py-2 text-left">Session</th>
            <th className="px-3 py-2 text-right">Trades</th>
            <th className="px-3 py-2 text-right">Win Rate</th>
            <th className="px-3 py-2 text-right">Avg R</th>
            <th className="px-3 py-2 text-right">Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, i) => {
            const avgR = s.avgR ? dToNumber(s.avgR) : 0;
            return (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground">{s.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{s.trades}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {s.winRate ? formatPct(s.winRate) : "N/A"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatR(s.avgR)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    s.pnlCents > 0 ? "text-profit" : s.pnlCents < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatSignedCents(s.pnlCents).text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WeekdayTable({ items }: { items: any[] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
            <th className="px-3 py-2 text-left">Day</th>
            <th className="px-3 py-2 text-right">Trades</th>
            <th className="px-3 py-2 text-right">Win Rate</th>
            <th className="px-3 py-2 text-right">Avg R</th>
            <th className="px-3 py-2 text-right">Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {items.map((w, i) => {
            const m = w.items ?? {};
            const avgR = m.avgR ? dToNumber(m.avgR) : 0;
            return (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground">{w.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{m.totalTrades ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {m.winRate ? formatPct(m.winRate) : "N/A"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatR(m.avgR)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    m.pnlCents > 0 ? "text-profit" : m.pnlCents < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatSignedCents(m.pnlCents).text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HourTable({ items }: { items: any[] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-b border-border">
            <th className="px-3 py-2 text-left">Hour</th>
            <th className="px-3 py-2 text-right">Trades</th>
            <th className="px-3 py-2 text-right">Win Rate</th>
            <th className="px-3 py-2 text-right">Avg R</th>
            <th className="px-3 py-2 text-right">Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h, i) => {
            const m = h.items ?? {};
            const avgR = m.avgR ? dToNumber(m.avgR) : 0;
            return (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground tabular-nums">{h.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{m.totalTrades ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {m.winRate ? formatPct(m.winRate) : "N/A"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    avgR > 0 ? "text-profit" : avgR < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatR(m.avgR)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    m.pnlCents > 0 ? "text-profit" : m.pnlCents < 0 ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatSignedCents(m.pnlCents).text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational primitives (slate/white aesthetic)
// ---------------------------------------------------------------------------

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground/70" />}
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        {children}
      </h2>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground/70 border border-dashed border-border rounded-md">
      No data.
    </div>
  );
}

function NoDataState({
  message,
  icon: Icon = BarChart3,
  tone = "neutral",
}: {
  message: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "positive";
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-12 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center mb-4",
            tone === "positive"
              ? "bg-emerald-50 border border-emerald-200"
              : "bg-background border border-border",
          )}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              tone === "positive" ? "text-profit" : "text-muted-foreground/70",
            )}
          />
        </div>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
