import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { getCached, setCached } from "@/lib/server-cache";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }

  const cacheKey = `me:${user.id}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return ok(cached);

  const [accounts, instruments, strategies, checklists, tags, tradeCount, draftCount] =
    await Promise.all([
      db.tradingAccount.findMany({ where: { userId: user.id } }),
      db.instrument.findMany({ where: { userId: user.id } }),
      db.strategy.findMany({
        where: { userId: user.id },
        include: { versions: { orderBy: { effectiveDate: "desc" }, take: 1 } },
      }),
      db.checklistConfig.findMany({
        where: { userId: user.id },
        include: { versions: { orderBy: { effectiveDate: "desc" }, take: 1 } },
      }),
      db.tag.findMany({ where: { userId: user.id, archived: false } }),
      db.trade.count({ where: { userId: user.id, isArchived: false } }),
      db.trade.count({ where: { userId: user.id, isDraft: true } }),
    ]);

  const result = {
    user: { id: user.id, email: user.email, name: user.name },
    accounts,
    instruments,
    strategies,
    checklists,
    tags,
    tradeCount,
    draftCount,
  };

  setCached(cacheKey, result, 30_000);
  return ok(result);
}
