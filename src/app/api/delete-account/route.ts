import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, clearSessionCookie } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { auditForUser } from "@/lib/audit";

/**
 * DELETE /api/delete-account
 *
 * Permanently deletes the user's entire account — the User record, all
 * trades, strategies, accounts, media, settings, legal consent records,
 * and everything else associated with the user. This is irreversible.
 *
 * The session cookie is cleared so the user is signed out.
 */
export async function DELETE(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }

  // Audit BEFORE deleting (the user record will be gone after).
  await auditForUser(user.id, "user.delete_account", "user", user.id);

  // Delete all owned data first (cascade handles most, but we do it
  // explicitly to be safe with SQLite).
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

  await db.analyticsCache.deleteMany({ where: { userId: user.id } });
  await db.deviceSession.deleteMany({ where: { userId: user.id } });
  await db.legalAcceptance.deleteMany({ where: { userId: user.id } });
  await db.notificationPreferences.deleteMany({ where: { userId: user.id } });
  await db.userSettings.deleteMany({ where: { userId: user.id } });
  await db.auditEvent.deleteMany({ where: { userId: user.id } });

  // Finally, delete the User record itself.
  await db.user.delete({ where: { id: user.id } });

  // Clear the session cookie.
  await clearSessionCookie();

  return ok({ deleted: true });
}
