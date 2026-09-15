import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, getSessionUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { CURRENT_VERSIONS, LEGAL_DOC_CONTENT, getLegalDocMeta, type LegalDocType } from "@/lib/legal-versions";

/**
 * GET /api/legal/[doc]
 *
 * Public: returns the document content + current version.
 * If authenticated: also includes the user's acceptance status.
 *
 * This allows the landing page and signup form to link to legal documents
 * without requiring authentication.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ doc: string }> }) {
  const { doc } = await ctx.params;
  const meta = getLegalDocMeta(doc);
  if (!meta) return notFound("Document not found");

  // Public fields — available without auth.
  const result: Record<string, unknown> = {
    docType: meta.key,
    title: meta.label,
    version: meta.version,
    content: LEGAL_DOC_CONTENT[meta.key as LegalDocType],
  };

  // If authenticated, include acceptance status.
  const user = await getSessionUser();
  if (user) {
    const acceptances = await db.legalAcceptance.findMany({
      where: { userId: user.id, docType: meta.key },
      orderBy: { acceptedAt: "desc" },
      take: 1,
    });
    const latest = acceptances[0];
    result.accepted = !!latest;
    result.acceptedVersion = latest?.version ?? null;
    result.acceptedAt = latest?.acceptedAt ?? null;
    // True when the user's latest acceptance matches the current version.
    // Front-end can use this to prompt re-acceptance after a policy update.
    result.isCurrent = !!latest && latest.version === meta.version;
  } else {
    result.accepted = false;
    result.acceptedVersion = null;
    result.acceptedAt = null;
    result.isCurrent = false;
  }

  return ok(result);
}

/**
 * POST /api/legal/[doc]
 *
 * Authenticated only. Records (or re-records) acceptance of the document
 * at the current version. Non-destructive: never overwrites prior records,
 * always creates a new row so acceptance history is preserved.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ doc: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { doc } = await ctx.params;
  const meta = getLegalDocMeta(doc);
  if (!meta) return notFound("Document not found");

  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  // Client may send a specific version, but we always pin to the current
  // version from the source of truth. This prevents a client from accepting
  // an outdated version and suppressing re-acceptance prompts.
  const version = meta.version;

  // Idempotent: if the user already accepted THIS version, return the existing row.
  const existing = await db.legalAcceptance.findFirst({
    where: { userId: user.id, docType: meta.key, version },
  });
  if (existing) return ok(existing);

  // Otherwise create a new acceptance record (preserving history).
  const acc = await db.legalAcceptance.create({
    data: { userId: user.id, docType: meta.key, version },
  });
  return ok(acc);
}
