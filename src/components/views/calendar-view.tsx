"use client";

/**
 * DnD — Calendar view (rebuild)
 *
 * Reference design: ae-tradingjournal.vercel.app's "Trading Calendar" page.
 * Layout (top → bottom):
 *   1. Month header — large title "September 2026" + month/year dropdowns
 *   2. Navigation — ← Prev | Today | Next →
 *   3. Summary stats — TRADING DAYS · MONTHLY NET P&L · MONTHLY NET R
 *   4. Calendar grid — 7 columns (Sun–Sat), each cell shows the day number,
 *      the day's net P&L (green/red) when trades exist, or a subtle
 *      "+ Log Day" link on empty days. The current day is highlighted with
 *      a `bg-blue-50` tint.
 *
 * Clicking a day with trades navigates to the tradesLog filtered by that
 * date (using nav-store params). Clicking an empty day opens the trade
 * form prefilled with that date.
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNav } from "@/lib/nav-store";
import { formatSignedCents, formatR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  TrendingUp,
  Loader2,
  ArrowUpRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Year dropdown range: 5 years back, 1 year forward (rolling, based on today).
function yearOptions(now: Date): number[] {
  const arr: number[] = [];
  const thisYear = now.getFullYear();
  for (let y = thisYear - 5; y <= thisYear + 1; y++) arr.push(y);
  return arr;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

interface CalendarDay {
  date: string; // YYYY-MM-DD
  pnlCents: number;
  r: number | null;
  trades: number;
  wins: number;
  losses: number;
  aplusCount: number;
  winRate: number | null;
  bestTradeCents: number | null;
  bestTradeR: number | null;
  worstTradeCents: number | null;
  ruleViolations: number;
  primarySession: string | null;
}

interface CalendarResponse {
  year: number;
  month: number;
  timezone: string;
  days: CalendarDay[];
}

async function fetchCalendar(year: number, month: number): Promise<CalendarResponse> {
  const res = await fetch(`/api/calendar?year=${year}&month=${month}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load calendar");
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarView() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1..12
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const { navigate } = useNav();

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", year, month],
    queryFn: () => fetchCalendar(year, month),
  });

  const days: CalendarDay[] = data?.days ?? [];
  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  // Calendar grid (Sun-first). Builds leading blanks for the first weekday
  // of the month, then the days 1..N, then trailing blanks to fill the
  // final week.
  const cells = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const startDayOfWeek = firstDay.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const out: (CalendarDay | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push(dayMap.get(dateStr) ?? emptyDay(dateStr));
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month, dayMap]);

  // Today's date string for highlight (in the user's local timezone).
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Monthly summary metrics derived from the calendar days.
  const summary = useMemo(() => {
    const tradingDays = days.filter((d) => d.trades > 0).length;
    const totalPnlCents = days.reduce((s, d) => s + d.pnlCents, 0);
    const totalR = days.reduce((s, d) => s + (d.r ?? 0), 0);
    const totalTrades = days.reduce((s, d) => s + d.trades, 0);
    return { tradingDays, totalPnlCents, totalR, totalTrades };
  }, [days]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }
  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }

  function onDayClick(cell: CalendarDay) {
    if (cell.trades > 0) {
      // Day has trades — open the detail modal showing that day's trades.
      setSelectedDay(cell);
    } else {
      // Empty day — open the trade form prefilled with this date.
      navigate("tradeNew", { date: cell.date });
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header: title + month/year dropdowns */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Trading Calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            Track your daily P&amp;L and trading activity over the month.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger
                size="sm"
                className="bg-card border-border text-foreground h-8 w-[140px] rounded-md text-sm font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, idx) => (
                  <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger
                size="sm"
                className="bg-card border-border text-foreground h-8 w-[100px] rounded-md text-sm font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions(now).map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="h-8 px-3 inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-xs font-medium"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryTile
          label="Trading Days"
          value={String(summary.tradingDays)}
          sub={`${summary.totalTrades} trade${summary.totalTrades === 1 ? "" : "s"}`}
          icon={CalendarDays}
        />
        <SummaryTile
          label="Monthly Net P&L"
          value={formatSignedCents(summary.totalPnlCents).text}
          tone={
            summary.totalPnlCents > 0
              ? "profit"
              : summary.totalPnlCents < 0
                ? "loss"
                : "neutral"
          }
          icon={TrendingUp}
        />
        <SummaryTile
          label="Monthly Net R"
          value={formatR(String(summary.totalR))}
          tone={
            summary.totalR > 0
              ? "profit"
              : summary.totalR < 0
                ? "loss"
                : "neutral"
          }
        />
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <Skeleton className="h-[480px] bg-border rounded-xl" />
      ) : (
        <Card className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-0">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center border-r border-border last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              if (!cell) {
                return (
                  <div
                    key={i}
                    className="min-h-[80px] md:min-h-[110px] border-r border-b border-border bg-muted/50/40 last-of-type:border-r-0"
                  />
                );
              }
              const dayNum = new Date(cell.date).getUTCDate();
              const hasTrades = cell.trades > 0;
              const pnl = formatSignedCents(cell.pnlCents);
              const isToday = cell.date === todayStr;

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => onDayClick(cell)}
                  className={cn(
                    "group relative min-h-[80px] md:min-h-[110px] p-2 text-left border-r border-b border-border last-of-type:border-r-0 transition-colors flex flex-col",
                    isToday ? "bg-blue-50" : "bg-card hover:bg-muted/50",
                    isToday && "ring-1 ring-inset ring-blue-200",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "text-xs font-semibold tnum",
                        isToday ? "text-blue-700" : "text-foreground",
                      )}
                    >
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[9px] uppercase tracking-wide font-semibold text-blue-600">
                        Today
                      </span>
                    )}
                  </div>

                  {hasTrades ? (
                    <div className="mt-auto space-y-0.5">
                      <div
                        className={cn(
                          "text-xs font-semibold tnum",
                          pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground",
                        )}
                      >
                        {pnl.text}
                      </div>
                      <div className="text-[10px] text-muted-foreground tnum">
                        {cell.trades} trade{cell.trades === 1 ? "" : "s"}
                        {cell.r != null && (
                          <span className={cn(
                            "ml-1",
                            cell.r > 0 ? "text-profit" : cell.r < 0 ? "text-loss" : "",
                          )}>
                            · {formatR(String(cell.r))}
                          </span>
                        )}
                      </div>
                      {cell.ruleViolations > 0 && (
                        <div className="text-[10px] text-loss tnum">
                          {cell.ruleViolations} violation{cell.ruleViolations === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-auto">
                      <span className="text-[10px] text-muted-foreground/70 group-hover:text-foreground inline-flex items-center gap-0.5 transition-colors">
                        <Plus className="h-3 w-3" />
                        Log Day
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-50 border border-blue-200" />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-profit/15" />
          Profit day
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-loss/15" />
          Loss day
        </span>
        <span className="text-muted-foreground/70">Click a day to view its trades or log a new one.</span>
      </div>

      {/* Day detail modal */}
      <DayDetailModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        onAddTrade={(date) => {
          setSelectedDay(null);
          navigate("tradeNew", { date });
        }}
        onOpenTrade={(id) => {
          setSelectedDay(null);
          navigate("tradeDetail", { id });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day detail modal — shows a day's stats + its trades list, with quick links
// to add a trade or open a trade's detail page.
// ---------------------------------------------------------------------------

interface DayTradeRow {
  id: string;
  instrumentSymbol: string;
  direction: "long" | "short";
  status: string;
  setupGrade: string | null;
  netPnlCents: number;
  actualR: string | null;
  entryTime: string | null;
  strategy?: { id: string; name: string } | null;
}

function DayDetailModal({
  day,
  onClose,
  onAddTrade,
  onOpenTrade,
}: {
  day: CalendarDay | null;
  onClose: () => void;
  onAddTrade: (date: string) => void;
  onOpenTrade: (id: string) => void;
}) {
  const open = !!day;
  // Fetch this day's trades from /api/trades with fromDate/toDate params
  // (covering the whole day in UTC). The calendar's day cells are keyed by
  // YYYY-MM-DD strings, so we construct a [start, end] window.
  const { data: tradesData, isLoading } = useQuery({
    queryKey: ["day-detail-trades", day?.date],
    queryFn: async () => {
      if (!day) return { items: [] as DayTradeRow[] };
      // The day's window: from YYYY-MM-DDT00:00:00.000Z to YYYY-MM-DDT23:59:59.999Z
      const from = `${day.date}T00:00:00.000Z`;
      const to = `${day.date}T23:59:59.999Z`;
      const params = new URLSearchParams({
        fromDate: from,
        toDate: to,
        limit: "100",
        sortBy: "entryTime",
        sortDir: "asc",
      });
      const res = await fetch(`/api/trades?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return { items: [] as DayTradeRow[] };
      const data = await res.json();
      const arr = data?.items ?? data?.trades ?? (Array.isArray(data) ? data : []);
      return { items: Array.isArray(arr) ? arr : [] };
    },
    enabled: open,
  });

  const trades: DayTradeRow[] = tradesData?.items ?? [];
  const pnl = day ? formatSignedCents(day.pnlCents) : null;
  const winRate = day?.winRate != null ? Math.round(day.winRate * 100) : null;
  const dayLabel = day
    ? new Date(day.date + "T00:00:00Z").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground/70" />
            {dayLabel}
          </DialogTitle>
          <DialogDescription>
            Day performance summary and trade list.
          </DialogDescription>
        </DialogHeader>

        {day && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <DayStat label="Net P&L" value={pnl?.text ?? "—"} tone={pnl && pnl.sign > 0 ? "profit" : pnl && pnl.sign < 0 ? "loss" : "neutral"} />
            <DayStat label="Trades" value={String(day.trades)} tone="neutral" />
            <DayStat label="Net R" value={day.r != null ? formatR(String(day.r)) : "—"} tone={day.r != null && day.r > 0 ? "profit" : day.r != null && day.r < 0 ? "loss" : "neutral"} />
            <DayStat label="Win Rate" value={winRate != null ? `${winRate}%` : "—"} tone="neutral" />
          </div>
        )}

        <div className="mt-3 max-h-80 overflow-y-auto scroll-thin -mx-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading trades…
            </div>
          ) : trades.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No trades found for this day.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {trades.map((t) => {
                const tPnl = formatSignedCents(t.netPnlCents);
                const isLong = t.direction === "long";
                return (
                  <li
                    key={t.id}
                    onClick={() => onOpenTrade(t.id)}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0",
                          isLong
                            ? "bg-emerald-50 text-profit border border-emerald-200"
                            : "bg-red-50 text-loss border border-red-200",
                        )}
                      >
                        {isLong ? "Long" : "Short"}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {t.instrumentSymbol}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {t.entryTime
                            ? new Date(t.entryTime).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                timeZone: "UTC",
                              })
                            : "—"}
                          {t.strategy?.name ? ` · ${t.strategy.name}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          tPnl.sign > 0 ? "text-profit" : tPnl.sign < 0 ? "text-loss" : "text-muted-foreground",
                        )}
                      >
                        {tPnl.text}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-between gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {day && (
            <Button onClick={() => onAddTrade(day.date)}>
              <Plus className="h-4 w-4" /> Add Trade
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DayStat({
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
// Sub-components
// ---------------------------------------------------------------------------

function SummaryTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "profit" | "loss" | "neutral";
}) {
  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm p-3 md:p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-muted-foreground/70",
            )}
          />
        )}
      </div>
      <div
        className={cn(
          "mt-1 text-lg md:text-xl font-semibold tnum",
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground tnum mt-0.5">{sub}</div>}
    </Card>
  );
}

function emptyDay(date: string): CalendarDay {
  return {
    date,
    pnlCents: 0,
    r: null,
    trades: 0,
    wins: 0,
    losses: 0,
    aplusCount: 0,
    winRate: null,
    bestTradeCents: null,
    bestTradeR: null,
    worstTradeCents: null,
    ruleViolations: 0,
    primarySession: null,
  };
}
