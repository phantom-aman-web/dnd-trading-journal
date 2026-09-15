import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const strat = await db.strategy.findFirst({
    where: { id, userId: user.id },
    include: {
      versions: { orderBy: { effectiveDate: "desc" } },
      experiments: true,
      checklistConfig: true,
    },
  });
  if (!strat) return notFound("Strategy not found");
  // Performance per version
  const trades = await db.trade.findMany({
    where: { userId: user.id, strategyId: id, isArchived: false },
    orderBy: { entryTime: "asc" },
  });
  const versionPerf = strat.versions.map((v) => {
    const vTrades = trades.filter((t) => t.strategyVersionId === v.id);
    const wins = vTrades.filter((t) => t.netPnlCents > 0).length;
    const losses = vTrades.filter((t) => t.netPnlCents < 0).length;
    const totalPnl = vTrades.reduce((s, t) => s + t.netPnlCents, 0);
    const rVals = vTrades.map((t) => t.actualR).filter((r) => r != null && Number.isFinite(Number(r)));
    const avgR = rVals.length > 0 ? String(+(rVals.reduce((s, r) => s + Number(r), 0) / rVals.length).toFixed(4)) : null;
    return {
      versionId: v.id,
      versionLabel: v.versionLabel,
      trades: vTrades.length,
      wins, losses,
      winRate: vTrades.length > 0 ? String(+(wins / vTrades.length).toFixed(4)) : null,
      pnlCents: totalPnl,
      avgR,
    };
  });
  return ok({ ...strat, trades, versionPerformance: versionPerf });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const strat = await db.strategy.findFirst({ where: { id, userId: user.id } });
  if (!strat) return notFound("Strategy not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const updated = await db.strategy.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.purpose !== undefined ? { purpose: body.purpose } : {}),
      ...(body.instruments !== undefined ? { instruments: body.instruments } : {}),
      ...(body.market !== undefined ? { market: body.market } : {}),
      ...(body.timeframe !== undefined ? { timeframe: body.timeframe } : {}),
      ...(body.session !== undefined ? { session: body.session } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.checklistConfigId !== undefined ? { checklistConfigId: body.checklistConfigId || null } : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const strat = await db.strategy.findFirst({ where: { id, userId: user.id } });
  if (!strat) return notFound("Strategy not found");
  await db.strategy.delete({ where: { id } });
  return ok({ ok: true });
}

// Create a new strategy version (spec section 57, 58)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const strat = await db.strategy.findFirst({ where: { id, userId: user.id } });
  if (!strat) return notFound("Strategy not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { versionLabel, changeReason, changeSummary, expectedImpact, rules, checklist, effectiveDate } = body;
  if (!versionLabel) return bad("Version label is required");
  const existing = await db.strategyVersion.findUnique({
    where: { strategyId_versionLabel: { strategyId: id, versionLabel } },
  });
  if (existing) return bad("Version label already exists");
  const version = await db.strategyVersion.create({
    data: {
      strategyId: id,
      versionLabel,
      changeReason,
      changeSummary,
      expectedImpact,
      rulesJson: JSON.stringify(rules ?? {}),
      checklistJson: checklist ? JSON.stringify(checklist) : null,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
    },
  });
  await audit("strategy.versioned", "strategy_version", version.id, { strategyId: id, versionLabel });
  return ok(version);
}
