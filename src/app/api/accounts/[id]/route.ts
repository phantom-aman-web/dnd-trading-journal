import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";

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

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const account = await db.tradingAccount.findFirst({ where: { id, userId: user.id } });
  if (!account) return notFound("Account not found");
  const tradeCount = await db.trade.count({ where: { accountId: id } });
  if (tradeCount > 0) return bad("Cannot delete an account with trades. Archive it instead.");
  await db.tradingAccount.delete({ where: { id } });
  return ok({ ok: true });
}
