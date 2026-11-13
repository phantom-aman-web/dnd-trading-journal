import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id } = await params;
  const existing = await db.filterPreset.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    return notFound("Preset not found");
  }

  const body = await parseJson<{
    name?: string;
    description?: string;
    filtersJson?: string;
    isDefault?: boolean;
    isPinned?: boolean;
  }>(req);

  if (!body) return bad("Invalid JSON payload");

  const updateData: {
    name?: string;
    description?: string | null;
    filtersJson?: string;
    isDefault?: boolean;
    isPinned?: boolean;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return bad("Name cannot be empty");
    }
    updateData.name = body.name.trim();
  }

  if (body.description !== undefined) {
    updateData.description = body.description ? body.description.trim() : null;
  }

  if (body.filtersJson !== undefined) {
    try {
      JSON.parse(body.filtersJson);
      updateData.filtersJson = body.filtersJson;
    } catch {
      return bad("filtersJson must be valid JSON");
    }
  }

  if (body.isPinned !== undefined) {
    updateData.isPinned = Boolean(body.isPinned);
  }

  if (body.isDefault !== undefined) {
    const isDef = Boolean(body.isDefault);
    updateData.isDefault = isDef;
    if (isDef) {
      await db.filterPreset.updateMany({
        where: {
          userId: user.id,
          targetView: existing.targetView,
          isDefault: true,
          id: { not: existing.id },
        },
        data: { isDefault: false },
      });
    }
  }

  const updated = await db.filterPreset.update({
    where: { id: existing.id },
    data: updateData,
  });

  return ok(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id } = await params;
  const existing = await db.filterPreset.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    return notFound("Preset not found");
  }

  await db.filterPreset.delete({
    where: { id },
  });

  return ok({ deleted: true, id });
}

