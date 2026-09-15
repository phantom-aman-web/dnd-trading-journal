import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { auditForUser } from "@/lib/audit";

/**
 * DELETE /api/clear-data
 *
 * Permanently deletes ALL user data (trades, strategies, accounts, media,
 * instruments, tags, daily plans, reviews, action items, goals, etc.)
 * while preserving the User account itself and LegalAcceptance records.
 *
 * This is a destructive, irreversible operation.
 */
export async function DELETE(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }

  // Delete in dependency order (children first, parents last).
  // TradeMedia and TradeChecklistEvaluation cascade from Trade, but
  // we delete explicitly to be safe with SQLite.
  await db.tradeChecklistEvaluation.deleteMany({ where: { trade: { userId: user.id } } });
  await db.tradeExecution.deleteMany({ where: { trade: { userId: user.id } } });
  await db.tradeTarget.deleteMany({ where: { trade: { userId: user.id } } });
  await db.mediaAnnotation.deleteMany({ where: { media: { userId: user.id } } });
  await db.tradeMedia.deleteMany({ where: { userId: user.id } });
  await db.trade.deleteMany({ where: { userId: user.id } });

  await db.reviewTradeLink.deleteMany({ where: { review: { userId: user.id } } });
  await db.actionItem.deleteMany({ where: { userId: user.id } });
  await db.review.deleteMany({ where: { userId: user.id } });

  await db.dailyPlan.deleteMany({ where: { userId: user.id } });

  await db.strategyVersion.deleteMany({ where: { strategy: { userId: user.id } } });
  await db.strategyExperiment.deleteMany({ where: { strategy: { userId: user.id } } });
  await db.strategy.deleteMany({ where: { userId: user.id } });

  await db.checklistVersion.deleteMany({ where: { checklist: { userId: user.id } } });
  await db.checklistConfig.deleteMany({ where: { userId: user.id } });

  await db.instrument.deleteMany({ where: { userId: user.id } });
  await db.tag.deleteMany({ where: { userId: user.id } });
  await db.goal.deleteMany({ where: { userId: user.id } });
  await db.notification.deleteMany({ where: { userId: user.id } });

  await db.importRow.deleteMany({ where: { import: { userId: user.id } } });
  await db.import.deleteMany({ where: { userId: user.id } });
  await db.backup.deleteMany({ where: { userId: user.id } });

  await db.tradingAccount.deleteMany({ where: { userId: user.id } });

  // Reset analytics cache.
  await db.analyticsCache.deleteMany({ where: { userId: user.id } });

  // Audit the clear.
  await auditForUser(user.id, "user.clear_data", "user", user.id);

  return ok({ cleared: true });
}
