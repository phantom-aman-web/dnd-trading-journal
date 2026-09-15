import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const items = await db.actionItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { title, description, dueDate, reviewId, linkedStrategyId, linkedChecklistId, status } = body;
  if (!title) return bad("Title is required");
  const item = await db.actionItem.create({
    data: {
      userId: user.id,
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      reviewId,
      linkedStrategyId,
      linkedChecklistId,
      status: status ?? "open",
    },
  });
  return ok(item);
}
