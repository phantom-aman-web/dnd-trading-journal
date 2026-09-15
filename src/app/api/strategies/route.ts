import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const items = await db.strategy.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { versions: { orderBy: { effectiveDate: "desc" } }, checklistConfig: true },
  });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { name, description, purpose, instruments, market, timeframe, session, rules, checklist, checklistConfigId } = body;
  if (!name) return bad("Name is required");
  const strat = await db.strategy.create({
    data: {
      userId: user.id,
      name,
      description,
      purpose,
      instruments,
      market,
      timeframe,
      session,
      checklistConfigId: checklistConfigId || null,
    },
  });
  // Always create v1.0
  await db.strategyVersion.create({
    data: {
      strategyId: strat.id,
      versionLabel: "1.0",
      changeReason: "Initial version",
      changeSummary: "Initial ruleset",
      rulesJson: JSON.stringify(rules ?? { entry: [], stop: [], target: [], management: [], invalidation: [] }),
      checklistJson: checklist ? JSON.stringify(checklist) : null,
      effectiveDate: new Date(),
    },
  });
  await audit("strategy.created", "strategy", strat.id);
  return ok(strat);
}
