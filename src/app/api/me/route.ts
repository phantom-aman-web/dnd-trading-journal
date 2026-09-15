import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const accounts = await db.tradingAccount.findMany({ where: { userId: user.id } });
  const instruments = await db.instrument.findMany({ where: { userId: user.id } });
  const strategies = await db.strategy.findMany({ where: { userId: user.id }, include: { versions: { orderBy: { effectiveDate: "desc" }, take: 1 } } });
  const checklists = await db.checklistConfig.findMany({ where: { userId: user.id }, include: { versions: { orderBy: { effectiveDate: "desc" }, take: 1 } } });
  const tags = await db.tag.findMany({ where: { userId: user.id, archived: false } });
  const tradeCount = await db.trade.count({ where: { userId: user.id, isArchived: false } });
  const draftCount = await db.trade.count({ where: { userId: user.id, isDraft: true } });
  return ok({
    user: { id: user.id, email: user.email, name: user.name },
    accounts,
    instruments,
    strategies,
    checklists,
    tags,
    tradeCount,
    draftCount,
  });
}
