import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { invalidateCache } from "@/lib/server-cache";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const account = await db.tradingAccount.findFirst({ where: { id, userId: user.id } });
  if (!account) return notFound("Account not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const {
    name, broker, accountType, currency, startingBalanceCents, currentBalanceCents, isDefault,
    consistencyRate, dailyLossLimitPct, maxDrawdownPct,
  } = body;
  if (isDefault) {
    await db.tradingAccount.updateMany({ where: { userId: user.id, isDefault: true, NOT: { id } }, data: { isDefault: false } });
  }
  const updated = await db.tradingAccount.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(broker !== undefined ? { broker } : {}),
      ...(accountType !== undefined ? { accountType } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(startingBalanceCents !== undefined ? { startingBalanceCents } : {}),
      ...(currentBalanceCents !== undefined ? { currentBalanceCents } : {}),
      ...(isDefault !== undefined ? { isDefault } : {}),
      // Numeric optional fields: empty string clears the value (set null),
      // any other finite number sets it.
      ...(consistencyRate !== undefined
        ? { consistencyRate: consistencyRate === "" || consistencyRate === null ? null : Number(consistencyRate) }
        : {}),
      ...(dailyLossLimitPct !== undefined
        ? { dailyLossLimitPct: dailyLossLimitPct === "" || dailyLossLimitPct === null ? null : Number(dailyLossLimitPct) }
        : {}),
      ...(maxDrawdownPct !== undefined
        ? { maxDrawdownPct: maxDrawdownPct === "" || maxDrawdownPct === null ? null : Number(maxDrawdownPct) }
        : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const account = await db.tradingAccount.findFirst({ where: { id, userId: user.id } });
  if (!account) return notFound("Account not found");

  const url = new URL(req.url);
  const cascade = url.searchParams.get("cascade") === "true";

  const tradeCount = await db.trade.count({ where: { accountId: id } });
  if (tradeCount > 0 && !cascade) {
    return bad(
      `Cannot delete: ${tradeCount} trade${tradeCount === 1 ? "" : "s"} linked to this account. Pass cascade=true to delete account along with all its trades.`,
    );
  }

  // If cascade and trades exist, clean up trade child relations first
  if (tradeCount > 0) {
    const trades = await db.trade.findMany({ where: { accountId: id }, select: { id: true } });
    const tradeIds = trades.map((t) => t.id);

    await db.tradeExecution.deleteMany({ where: { tradeId: { in: tradeIds } } });
    await db.tradeTarget.deleteMany({ where: { tradeId: { in: tradeIds } } });
    await db.tradeChecklistEvaluation.deleteMany({ where: { tradeId: { in: tradeIds } } });
    await db.tradeMedia.deleteMany({ where: { tradeId: { in: tradeIds } } });
    await db.trade.deleteMany({ where: { accountId: id } });
  }

  await db.tradingAccount.delete({ where: { id } });

  invalidateCache(`accounts:${user.id}`);
  invalidateCache(`trades:${user.id}`);
  invalidateCache(`dashboard:${user.id}`);
  invalidateCache(`analytics:${user.id}`);
  invalidateCache(`calendar:${user.id}`);
  invalidateCache(`me:${user.id}`);

  await audit("account.deleted", "tradingAccount", id, {
    accountName: account.name,
    tradesDeleted: tradeCount,
  });

  return ok({ ok: true, tradesDeleted: tradeCount });
}
