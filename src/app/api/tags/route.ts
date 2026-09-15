import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const items = await db.tag.findMany({
    where: { userId: user.id, archived: false },
    orderBy: { name: "asc" },
  });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { name, color } = body;
  if (!name) return bad("Name is required");
  try {
    const tag = await db.tag.create({
      data: { userId: user.id, name, color: color ?? "slate" },
    });
    return ok(tag);
  } catch (e: any) {
    if (e?.code === "P2002") return bad("Tag with that name already exists");
    return toApiError(e);
  }
}
