import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const symbol = searchParams.get("symbol");

  const where: any = { userId: user.id };
  if (status && status !== "all") {
    where.status = status;
  }
  if (symbol) {
    where.symbol = { contains: symbol, mode: "insensitive" };
  }

  const items = await db.watchlistOutcome.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");

  const {
    symbol,
    direction = "long",
    timeframe = "15m",
    plannedEntry,
    invalidationLevel,
    targetLevel,
    status = "watching",
    recordedOutcome = "pending",
    notes,
    strategyId,
  } = body;

  if (!symbol) return bad("symbol is required");

  const item = await db.watchlistOutcome.create({
    data: {
      userId: user.id,
      symbol: symbol.toUpperCase().trim(),
      direction: direction === "short" ? "short" : "long",
      timeframe: timeframe || "15m",
      plannedEntry: plannedEntry ? String(plannedEntry).trim() : null,
      invalidationLevel: invalidationLevel ? String(invalidationLevel).trim() : null,
      targetLevel: targetLevel ? String(targetLevel).trim() : null,
      status: status || "watching",
      recordedOutcome: recordedOutcome || "pending",
      notes: notes || null,
      strategyId: strategyId || null,
    },
  });

  await audit("watchlist.created", "watchlistOutcome", item.id, {
    symbol: item.symbol,
    direction: item.direction,
  });

  return ok(item);
}
