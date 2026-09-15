/** DnD — Audit trail (spec section 111). */

import { db } from "./db";
import { getSessionUser } from "./auth";

export async function audit(
  action: string,
  entity: string,
  entityId?: string,
  diff?: Record<string, unknown>,
): Promise<void> {
  try {
    const user = await getSessionUser();
    if (!user) return;
    await db.auditEvent.create({
      data: {
        userId: user.id,
        action,
        entity,
        entityId,
        diffJson: diff ? JSON.stringify(diff) : null,
      },
    });
  } catch {
    // never let audit failure break the user operation
  }
}

export async function auditForUser(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  diff?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        diffJson: diff ? JSON.stringify(diff) : null,
      },
    });
  } catch {
    /* ignore */
  }
}
