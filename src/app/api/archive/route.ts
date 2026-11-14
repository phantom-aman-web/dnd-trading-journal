import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { auditForUser } from "@/lib/audit";
import { invalidateCache } from "@/lib/server-cache";

const ArchiveActionSchema = z.object({
  entityType: z.enum(["trade", "account", "strategy", "noTrade"]),
  id: z.string(),
  action: z.enum(["archive", "restore"]),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // optional: 'trades' | 'accounts' | 'strategies' | 'noTrades'

    const [trades, accounts, strategies, noTrades] = await Promise.all([
      (!type || type === "trades")
        ? db.trade.findMany({
            where: { userId: user.id, isArchived: true },
            orderBy: { archivedAt: "desc" },
            include: {
              account: { select: { id: true, name: true } },
              strategy: { select: { id: true, name: true } },
            },
          })
        : [],
      (!type || type === "accounts")
        ? db.tradingAccount.findMany({
            where: { userId: user.id, isArchived: true },
            orderBy: { archivedAt: "desc" },
            include: {
              _count: { select: { trades: true } },
            },
          })
        : [],
      (!type || type === "strategies")
        ? db.strategy.findMany({
            where: { userId: user.id, isArchived: true },
            orderBy: { archivedAt: "desc" },
            include: {
              _count: { select: { trades: true, versions: true } },
            },
          })
        : [],
      (!type || type === "noTrades")
        ? db.noTradeEntry.findMany({
            where: { userId: user.id, isArchived: true },
            orderBy: { archivedAt: "desc" },
            include: {
              account: { select: { id: true, name: true } },
              strategy: { select: { id: true, name: true } },
            },
          })
        : [],
    ]);

    return ok({
      trades,
      accounts,
      strategies,
      noTrades,
      totalArchived: trades.length + accounts.length + strategies.length + noTrades.length,
    });
  } catch (err) {
    return toApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await parseJson(req);
    if (!body) return bad("Invalid JSON body");

    const parsed = ArchiveActionSchema.safeParse(body);
    if (!parsed.success) return bad("Invalid input", parsed.error.flatten());

    const { entityType, id, action } = parsed.data;
    const isArchived = action === "archive";
    const archivedAt = isArchived ? new Date() : null;

    let result: any = null;

    if (entityType === "trade") {
      const existing = await db.trade.findFirst({ where: { id, userId: user.id } });
      if (!existing) return notFound("Trade not found");

      result = await db.trade.update({
        where: { id },
        data: { isArchived, archivedAt },
      });
      invalidateCache(`trades:${user.id}*`);
      invalidateCache(`dashboard:${user.id}*`);
      await auditForUser(user.id, `trade.${action}d`, "Trade", id);
    } else if (entityType === "account") {
      const existing = await db.tradingAccount.findFirst({ where: { id, userId: user.id } });
      if (!existing) return notFound("Account not found");

      result = await db.tradingAccount.update({
        where: { id },
        data: { isArchived, archivedAt },
      });
      invalidateCache(`accounts:${user.id}*`);
      await auditForUser(user.id, `account.${action}d`, "TradingAccount", id);
    } else if (entityType === "strategy") {
      const existing = await db.strategy.findFirst({ where: { id, userId: user.id } });
      if (!existing) return notFound("Strategy not found");

      result = await db.strategy.update({
        where: { id },
        data: { isArchived, archivedAt },
      });
      invalidateCache(`strategies:${user.id}*`);
      await auditForUser(user.id, `strategy.${action}d`, "Strategy", id);
    } else if (entityType === "noTrade") {
      const existing = await db.noTradeEntry.findFirst({ where: { id, userId: user.id } });
      if (!existing) return notFound("Observation not found");

      result = await db.noTradeEntry.update({
        where: { id },
        data: { isArchived, archivedAt },
      });
      await auditForUser(user.id, `notrade.${action}d`, "NoTradeEntry", id);
    }

    return ok({ success: true, entityType, id, action, record: result });
  } catch (err) {
    return toApiError(err);
  }
}
