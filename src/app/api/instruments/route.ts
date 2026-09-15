import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const items = await db.instrument.findMany({ where: { userId: user.id }, orderBy: { symbol: "asc" } });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { symbol, name, market, pipSize, tickSize, contractSize, pricePrecision, currency } = body;
  if (!symbol) return bad("Symbol is required");
  try {
    const instr = await db.instrument.create({
      data: {
        userId: user.id,
        symbol: symbol.toUpperCase(),
        name,
        market: market ?? "custom",
        pipSize: pipSize ?? "0.0001",
        tickSize: tickSize ?? "0.0001",
        contractSize: contractSize ?? "1",
        pricePrecision: pricePrecision ?? 5,
        currency: currency ?? "USD",
      },
    });
    return ok(instr);
  } catch (e: any) {
    if (e?.code === "P2002") return bad("Instrument with that symbol already exists");
    return toApiError(e);
  }
}
