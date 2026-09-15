import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  if (dateStr) {
    const date = new Date(dateStr);
    date.setUTCHours(0, 0, 0, 0);
    const plan = await db.dailyPlan.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    return ok(plan);
  }
  const items = await db.dailyPlan.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 30,
  });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { date } = body;
  if (!date) return bad("Date is required");
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  // Mass-assignment protection: explicit field allowlist (spec section 102).
  // The previous `...rest` spread allowed callers to overwrite `userId` (and
  // any other column), which would let one user inject a daily plan onto
  // another user's account. Whitelist the editable columns only.
  const allowed: Record<string, unknown> = {};
  const fields = [
    "weeklyBias", "dailyBias", "instruments", "pwh", "pwl", "pdh", "pdl",
    "htfLevelsJson", "liquidityTargets", "session", "setupConditions",
    "invalidation", "maxTrades", "maxDailyRiskPct", "notes",
  ];
  for (const f of fields) {
    if (f in body) allowed[f] = body[f];
  }

  const plan = await db.dailyPlan.upsert({
    where: { userId_date: { userId: user.id, date: d } },
    update: { ...allowed },
    create: { userId: user.id, date: d, ...allowed },
  });
  return ok(plan);
}
