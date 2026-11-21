import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { isSyntheticSampleTrade } from "@/lib/prop-firm-engine";

/**
 * Export user data as CSV or JSON (spec section 88).
 * GET /api/exports?format=csv|json&type=trades|all
 */
export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const type = url.searchParams.get("type") ?? "trades";

  if (type === "trades") {
    const trades = await db.trade.findMany({
      where: { userId: user.id, isArchived: false },
      orderBy: { entryTime: "desc" },
      include: { executions: true },
    });
    if (format === "csv") {
      const headers = [
        "id","entryTime","exitTime","instrument","direction","session","status",
        "setupGrade","entryPrice","exitPrice","stop","target","qty",
        "netPnlCents","actualR","feesCents","commissionCents","swapCents","isDemoSample",
      ];
      const lines = [headers.join(",")];
      for (const t of trades) {
        lines.push([
          t.id,
          t.entryTime?.toISOString() ?? "",
          t.exitTime?.toISOString() ?? "",
          t.instrumentSymbol,
          t.direction,
          t.session ?? "",
          t.status,
          t.setupGrade ?? "",
          t.entryPriceAvg ?? "",
          t.exitPriceAvg ?? "",
          t.plannedStopPrice ?? "",
          t.plannedTargetPrice ?? "",
          t.positionSize ?? "",
          t.netPnlCents,
          t.actualR ?? "",
          t.feesCents,
          t.commissionCents,
          t.swapCents,
          isSyntheticSampleTrade(t) ? "true" : "false",
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
      }
      await audit("export.performed", "trade", undefined, { format, count: trades.length });
      return new Response(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="alphapips-trades-${Date.now()}.csv"`,
        },
      });
    }
    await audit("export.performed", "trade", undefined, { format, count: trades.length });
    const enrichedTrades = trades.map((t) => ({
      ...t,
      isDemoSample: isSyntheticSampleTrade(t),
    }));
    return Response.json({ trades: enrichedTrades });
  }

  // Full JSON export
  const [
    accounts,
    instruments,
    strategies,
    checklists,
    trades,
    tags,
    goals,
    propChallenges,
    watchlistOutcomes,
    notifications,
    tradingTasks,
    noTradeEntries,
    filterPresets,
    settings,
  ] = await Promise.all([
    db.tradingAccount.findMany({ where: { userId: user.id } }),
    db.instrument.findMany({ where: { userId: user.id } }),
    db.strategy.findMany({ where: { userId: user.id }, include: { versions: true, experiments: true } }),
    db.checklistConfig.findMany({ where: { userId: user.id }, include: { versions: true } }),
    db.trade.findMany({
      where: { userId: user.id },
      include: {
        executions: true,
        targets: true,
        media: { include: { annotations: true } },
        checklistEvaluations: true,
      },
    }),
    db.tag.findMany({ where: { userId: user.id } }),
    db.goal.findMany({ where: { userId: user.id } }),
    db.propChallenge.findMany({ where: { userId: user.id } }),
    db.watchlistOutcome.findMany({ where: { userId: user.id } }),
    db.notification.findMany({ where: { userId: user.id } }),
    db.tradingTask.findMany({ where: { userId: user.id } }),
    db.noTradeEntry.findMany({ where: { userId: user.id } }),
    db.filterPreset.findMany({ where: { userId: user.id } }),
    db.userSettings.findUnique({
      where: { userId: user.id },
      select: {
        userId: true,
        timezone: true,
        displayTimezone: true,
        tradingTimezone: true,
        theme: true,
        density: true,
        reducedMotion: true,
        largerText: true,
        defaultRiskPct: true,
        baseCurrencySymbol: true,
        normalRiskMaxPct: true,
        warningRiskMaxPct: true,
        criticalRiskMaxPct: true,
        defaultAccountId: true,
        defaultSession: true,
        defaultInstrument: true,
        defaultTimeframe: true,
        dailyTradeLimit: true,
        maxTradesPerDay: true,
        maxRiskPerTradePct: true,
        dailyLossLimitPct: true,
        preferredInstruments: true,
        dateFormat: true,
        timeFormat: true,
        weekStartsOn: true,
        nyMarketOffset: true,
        privacyModeEnabled: true,
        updatedAt: true,
      },
    }),
  ]);
  await audit("export.performed", "user", user.id, { format: "json", type: "all" });
  return Response.json({
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    settings,
    accounts,
    instruments,
    strategies,
    checklists,
    trades,
    tags,
    goals,
    propChallenges,
    watchlistOutcomes,
    notifications,
    tradingTasks,
    noTradeEntries,
    filterPresets,
  });
}
