import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";

interface CalendarDay {
  date: string;
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

/** Internal accumulator — includes a per-day session tally map that doesn't
 * appear in the JSON response (we only return `primarySession`). */
interface DayAcc extends CalendarDay {
  sessionTally: Map<string, number>;
}

function safeR(r: string | null): number | null {
  if (r == null) return null;
  const n = Number(r);
  return Number.isFinite(n) ? n : null;
}

function safeParseArr(json: string | null): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

/**
 * Format a Date as `YYYY-MM-DD` interpreted in the given IANA timezone.
 * `Intl.DateTimeFormat('en-CA', ...)` yields `YYYY-MM-DD` (Canadian English
 * uses the ISO-style short date), which is exactly what we need for calendar
 * day bucketing.
 */
function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    // Invalid timezone string — fall back to UTC to avoid throwing.
    return date.toISOString().slice(0, 10);
  }
}

function emptyDay(date: string): DayAcc {
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
    sessionTally: new Map<string, number>(),
  };
}

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const timezone = (user.timezone as string) || "UTC";
  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  const monthStr = url.searchParams.get("month");
  const now = new Date();
  const year = yearStr ? parseInt(yearStr) : now.getFullYear();
  const month = monthStr ? parseInt(monthStr) : now.getMonth() + 1;

  // Query window covers the calendar month PLUS a 1-day buffer on each side
  // to catch trades that fall on month boundaries when viewed in a non-UTC
  // timezone (e.g. a trade at 23:00 UTC on the 1st may belong to the previous
  // day in a Western timezone). The formatDateInTimezone grouping then
  // assigns each trade to the correct local day, and we filter to the
  // requested calendar month afterwards.
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  end.setUTCDate(end.getUTCDate() + 1);

  const trades = await db.trade.findMany({
    where: {
      userId: user.id,
      isArchived: false,
      entryTime: { gte: start, lte: end },
    },
    orderBy: { entryTime: "asc" },
  });

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const dayMap = new Map<string, DayAcc>();
  for (const t of trades) {
    if (!t.entryTime) continue;
    const key = formatDateInTimezone(new Date(t.entryTime), timezone);
    // Drop trades that fall outside the requested calendar month in the
    // user's timezone (they were only fetched for the boundary buffer).
    if (!key.startsWith(monthPrefix)) continue;
    const entry = dayMap.get(key) ?? emptyDay(key);
    entry.pnlCents += t.netPnlCents;
    entry.trades += 1;
    if (t.netPnlCents > 0) entry.wins += 1;
    if (t.netPnlCents < 0) entry.losses += 1;
    if (t.setupGrade === "A+") entry.aplusCount += 1;
    if (safeParseArr(t.behaviorFlagsJson).length > 0) entry.ruleViolations += 1;
    // Best/worst trade tracking
    if (entry.bestTradeCents == null || t.netPnlCents > entry.bestTradeCents) {
      entry.bestTradeCents = t.netPnlCents;
      entry.bestTradeR = safeR(t.actualR);
    }
    if (entry.worstTradeCents == null || t.netPnlCents < entry.worstTradeCents) {
      entry.worstTradeCents = t.netPnlCents;
    }
    // R aggregation
    const r = safeR(t.actualR);
    if (r != null) {
      if (entry.r == null) entry.r = 0;
      entry.r += r;
    }
    // Session tally (for primarySession)
    if (t.session) {
      entry.sessionTally.set(t.session, (entry.sessionTally.get(t.session) ?? 0) + 1);
    }
    dayMap.set(key, entry);
  }

  // Average R per day, derive winRate + primarySession, strip the
  // internal sessionTally map from the JSON response.
  const days: CalendarDay[] = [];
  for (const d of dayMap.values()) {
    if (d.r != null && d.trades > 0) {
      d.r = +(d.r / d.trades).toFixed(2);
    }
    d.winRate = d.trades > 0 ? +(d.wins / d.trades).toFixed(4) : null;
    if (d.sessionTally.size > 0) {
      let best: string | null = null;
      let bestCount = -1;
      for (const [sess, count] of d.sessionTally.entries()) {
        if (count > bestCount) { bestCount = count; best = sess; }
      }
      d.primarySession = best;
    } else {
      d.primarySession = null;
    }
    const { sessionTally: _omit, ...rest } = d;
    days.push(rest);
  }

  return ok({
    year,
    month,
    timezone,
    days: days.sort((a, b) => a.date.localeCompare(b.date)),
  });
}
