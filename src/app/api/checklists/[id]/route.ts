import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const checklist = await db.checklistConfig.findFirst({
    where: { id, userId: user.id },
    include: { versions: { orderBy: { effectiveDate: "desc" } } },
  });
  if (!checklist) return notFound("Checklist not found");
  return ok(checklist);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const checklist = await db.checklistConfig.findFirst({ where: { id, userId: user.id } });
  if (!checklist) return notFound("Checklist not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const updated = await db.checklistConfig.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    },
  });
  return ok(updated);
}

// Create a new checklist version (spec section 40)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const checklist = await db.checklistConfig.findFirst({ where: { id, userId: user.id } });
  if (!checklist) return notFound("Checklist not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { versionLabel, items, gradingThresholds } = body;
  if (!versionLabel) return bad("Version label is required");
  const existing = await db.checklistVersion.findUnique({
    where: { checklistId_versionLabel: { checklistId: id, versionLabel } },
  });
  if (existing) return bad("Version label already exists");
  const version = await db.checklistVersion.create({
    data: {
      checklistId: id,
      versionLabel,
      itemsJson: JSON.stringify(items ?? []),
      gradingThresholdsJson: gradingThresholds ? JSON.stringify(gradingThresholds) : null,
      effectiveDate: new Date(),
    },
  });
  await audit("checklist.versioned", "checklist_version", version.id, { checklistId: id, versionLabel });
  return ok(version);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const checklist = await db.checklistConfig.findFirst({ where: { id, userId: user.id } });
  if (!checklist) return notFound("Checklist not found");
  await db.checklistConfig.delete({ where: { id } });
  return ok({ ok: true });
}
