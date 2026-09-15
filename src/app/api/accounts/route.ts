import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const url = new URL(req.url);
  const isDefault = url.searchParams.get("default") === "true";
  const where = { userId: user.id, ...(isDefault ? { isDefault: true } : {}) };
  const items = await db.tradingAccount.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const {
    name, broker, accountType, currency, startingBalanceCents, isDefault,
    consistencyRate, dailyLossLimitPct, maxDrawdownPct,
  } = body;
  if (!name) return bad("Name is required");
  if (isDefault) {
    await db.tradingAccount.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
  }
  const account = await db.tradingAccount.create({
    data: {
      userId: user.id,
      name,
      broker,
      accountType: accountType ?? "live",
      currency: currency ?? "USD",
      startingBalanceCents: startingBalanceCents ?? 0,
      currentBalanceCents: startingBalanceCents ?? 0,
      isDefault: isDefault ?? false,
      ...(consistencyRate !== undefined && consistencyRate !== null && consistencyRate !== ""
        ? { consistencyRate: Number(consistencyRate) }
        : {}),
      ...(dailyLossLimitPct !== undefined && dailyLossLimitPct !== null && dailyLossLimitPct !== ""
        ? { dailyLossLimitPct: Number(dailyLossLimitPct) }
        : {}),
      ...(maxDrawdownPct !== undefined && maxDrawdownPct !== null && maxDrawdownPct !== ""
        ? { maxDrawdownPct: Number(maxDrawdownPct) }
        : {}),
    },
  });
  await audit("account.created", "trading_account", account.id);
  return ok(account);
}
