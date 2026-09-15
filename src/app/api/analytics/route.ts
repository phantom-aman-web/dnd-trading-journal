import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { TradeMetricRow, computeAggregateMetrics, groupBy, safeParsePsychTags } from "@/lib/financial-engine";

function safeParseArr(json: string | null): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const url = new URL(req.url);
  const dimension = url.searchParams.get("dimension") ?? "overview";
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const accountId = url.searchParams.get("accountId") ?? undefined;
  const where: any = { userId: user.id, isArchived: false };
  if (accountId) where.accountId = accountId;
  // SPEC v3 §18.8: realized performance analytics use EXIT time, not entry time.
  // SPEC v3 §18.4: half-open interval [start, end) — never use 23:59:59.999.
  if (fromStr || toStr) {
    where.exitTime = {};
    if (fromStr) where.exitTime.gte = new Date(fromStr);
    if (toStr) {
      const endExclusive = new Date(toStr);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endExclusive.setHours(0, 0, 0, 0);
      where.exitTime.lt = endExclusive;
    }
  }
  const trades = await db.trade.findMany({ where, orderBy: { exitTime: "asc" } });
  const rows: TradeMetricRow[] = trades.map((t) => ({
    id: t.id,
    netPnlCents: t.netPnlCents,
    grossPnlCents: t.grossPnlCents,
    actualR: t.actualR,
    status: (["win","loss","breakeven"].includes(t.status) ? "closed" : t.status) as any,
    outcome: t.status as any,
    direction: t.direction,
    entryTime: t.entryTime,
    exitTime: t.exitTime,
    setupGrade: t.setupGrade,
    instrumentSymbol: t.instrumentSymbol,
    session: t.session,
    strategyId: t.strategyId,
    strategyVersionId: t.strategyVersionId,
    behaviorFlags: safeParseArr(t.behaviorFlagsJson),
    psychTags: safeParsePsychTags(t.psychBeforeJson),
    ruleCompliant: !(safeParseArr(t.behaviorFlagsJson).length > 0),
  }));

  if (dimension === "overview") {
    return ok({ aggregate: computeAggregateMetrics(rows) });
  }
  if (dimension === "instrument", null) {
    return ok({ items: groupBy(rows, (t) => t.instrumentSymbol) });
  }
  if (dimension === "session") {
    return ok({
      items: groupBy(rows, (t) => t.session, (k) => {
        const map: Record<string, string> = { asia: "Asia", london: "London", ny_am: "New York AM", ny_pm: "New York PM", custom: "Custom" };
        return map[k] ?? k;
      }),
    });
  }
  if (dimension === "strategy") {
    // Fetch the user's strategies and resolve names so the analytics
    // breakdown labels show strategy names rather than raw cuid IDs.
    const strats = await db.strategy.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    });
    const strategyMap = new Map<string, string>();
    strats.forEach((s) => strategyMap.set(s.id, s.name));
    return ok({
      items: groupBy(rows, (t) => t.strategyId, (k) => strategyMap.get(k) ?? "Unknown"),
    });
  }
  if (dimension === "setupGrade") {
    return ok({ items: groupBy(rows, (t) => t.setupGrade, (k) => k ?? "Ungraded") });
  }
  if (dimension === "behavior") {
    const flags = new Set<string>();
    rows.forEach((t) => t.behaviorFlags?.forEach((f) => flags.add(f)));
    return ok({
      items: [...flags].map((flag) => {
        const withFlag = rows.filter((t) => t.behaviorFlags?.includes(flag));
        const m = computeAggregateMetrics(withFlag, null);
        return {
          key: flag,
          label: flag.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          trades: m.totalTrades,
          avgR: m.avgR,
          pnlCents: m.netPnlCents || 0,
          winRate: m.winRate,
        };
      }),
    });
  }
  if (dimension === "time") {
    // By weekday and hour, both derived in the user's configured timezone
    // (UserSettings.timezone, default "UTC"). Using Intl.DateTimeFormat with
    // a `timeZone` option is the correct way to do this in SQLite/Node —
    // `d.getDay()` / `d.getHours()` would otherwise reflect the server's
    // local timezone, not the user's.
    const tz = (user.timezone as string) || "UTC";
    const fmtWeekday = (() => {
      try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }); }
      catch { return new Intl.DateTimeFormat("en-US", { weekday: "short" }); }
    })();
    const fmtHour = (() => {
      try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }); }
      catch { return new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false }); }
    })();
    const weekdayMap = new Map<string, TradeMetricRow[]>();
    const hourMap = new Map<string, TradeMetricRow[]>();
    for (const t of rows) {
      if (!t.entryTime) continue;
      const d = new Date(t.entryTime);
      const wd = fmtWeekday.format(d);
      // `hour: 'numeric', hour12: false` may return "24" at midnight on some
      // runtimes — normalize to "00".
      let hrRaw = fmtHour.format(d);
      if (hrRaw === "24") hrRaw = "00";
      const hr = `${hrRaw.padStart(2, "0")}:00`;
      (weekdayMap.get(wd) ?? weekdayMap.set(wd, []).get(wd)!).push(t);
      (hourMap.get(hr) ?? hourMap.set(hr, []).get(hr)!).push(t);
    }
    return ok({
      weekday: [...weekdayMap.entries()].map(([k, arr]) => ({
        label: k, items: computeAggregateMetrics(arr, null),
      })),
      hour: [...hourMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k, arr]) => ({
        label: k, items: computeAggregateMetrics(arr, null),
      })),
    });
  }
  return ok({ aggregate: computeAggregateMetrics(rows) }, null);
}
