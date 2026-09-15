import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

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
        "netPnlCents","actualR","feesCents","commissionCents","swapCents",
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
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
      }
      await audit("export.performed", "trade", undefined, { format, count: trades.length });
      return new Response(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="dnd-trades-${Date.now()}.csv"`,
        },
      });
    }
    await audit("export.performed", "trade", undefined, { format, count: trades.length });
    return Response.json({ trades });
  }

  // Full JSON export
  const [accounts, instruments, strategies, checklists, trades, reviews, actionItems, tags, goals, dailyPlans] = await Promise.all([
    db.tradingAccount.findMany({ where: { userId: user.id } }),
    db.instrument.findMany({ where: { userId: user.id } }),
    db.strategy.findMany({ where: { userId: user.id }, include: { versions: true, experiments: true } }),
    db.checklistConfig.findMany({ where: { userId: user.id }, include: { versions: true } }),
    db.trade.findMany({ where: { userId: user.id }, include: { executions: true, media: true } }),
    db.review.findMany({ where: { userId: user.id }, include: { tradeLinks: true, actionItems: true } }),
    db.actionItem.findMany({ where: { userId: user.id } }),
    db.tag.findMany({ where: { userId: user.id } }),
    db.goal.findMany({ where: { userId: user.id } }),
    db.dailyPlan.findMany({ where: { userId: user.id } }),
  ]);
  await audit("export.performed", "user", user.id, { format: "json", type: "all" });
  return Response.json({
    exportedAt: new Date().toISOString(),
    accounts, instruments, strategies, checklists, trades, reviews, actionItems, tags, goals, dailyPlans,
  });
}
