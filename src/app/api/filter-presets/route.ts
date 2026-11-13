import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const url = new URL(req.url);
  const targetView = url.searchParams.get("targetView") || "tradesLog";

  const presets = await db.filterPreset.findMany({
    where: {
      userId: user.id,
      targetView,
    },
    orderBy: [
      { isPinned: "desc" },
      { isDefault: "desc" },
      { updatedAt: "desc" },
    ],
  });

  return ok({ items: presets });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const body = await parseJson<{
    name?: string;
    description?: string;
    targetView?: string;
    filtersJson?: string;
    isDefault?: boolean;
    isPinned?: boolean;
  }>(req);

  if (!body) return bad("Invalid JSON payload");
  const { name, description, targetView = "tradesLog", filtersJson, isDefault = false, isPinned = false } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return bad("Preset name is required");
  }
  if (!filtersJson || typeof filtersJson !== "string") {
    return bad("filtersJson is required and must be a string");
  }

  // Validate JSON string
  try {
    JSON.parse(filtersJson);
  } catch {
    return bad("filtersJson must be valid JSON");
  }

  // If set to default, unset any existing defaults for this targetView
  if (isDefault) {
    await db.filterPreset.updateMany({
      where: {
        userId: user.id,
        targetView,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  const preset = await db.filterPreset.create({
    data: {
      userId: user.id,
      name: name.trim(),
      description: description?.trim() || null,
      targetView,
      filtersJson,
      isDefault: Boolean(isDefault),
      isPinned: Boolean(isPinned),
    },
  });

  return ok(preset, 201);
}

