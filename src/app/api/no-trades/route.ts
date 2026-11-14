import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { auditForUser } from "@/lib/audit";

const NoTradeCreateSchema = z.object({
  instrumentSymbol: z.string().min(1, "Instrument symbol is required"),
  instrumentId: z.string().optional().nullable(),
  market: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  strategyId: z.string().optional().nullable(),
  strategyVersionId: z.string().optional().nullable(),
  date: z.string().datetime().optional().nullable(),
  time: z.string().optional().nullable(),
  session: z.string().optional().nullable(),
  timeframe: z.string().optional().nullable(),
  bias: z.enum(["bullish", "bearish", "neutral"]).default("neutral"),
  title: z.string().optional().nullable(),
  observation: z.string().optional().nullable(),
  priceLevels: z.string().optional().nullable(),
  marketStructure: z.string().optional().nullable(),
  liquidityConditions: z.string().optional().nullable(),
  setupIdentified: z.string().optional().nullable(),
  expectedDirection: z.string().optional().nullable(),
  reasonCategory: z.string().default("no_valid_setup"),
  reasonNotes: z.string().optional().nullable(),
  conditionMissing: z.string().optional().nullable(),
  wouldHaveValidated: z.string().optional().nullable(),
  invalidationReason: z.string().optional().nullable(),
  decisionType: z.enum(["deliberate_avoidance", "missed", "rejected", "not_ready"]).default("deliberate_avoidance"),
  status: z.enum(["observing", "waiting_confirmation", "rejected", "missed", "invalidated", "completed"]).default("observing"),
  psychologyNotes: z.string().optional().nullable(),
  behaviorFlags: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.any()).optional().nullable(),
  followUpNotes: z.string().optional().nullable(),
  isArchived: z.boolean().default(false),
});

const NoTradeQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
  search: z.string().optional(),
  symbol: z.string().optional(),
  strategyId: z.string().optional(),
  accountId: z.string().optional(),
  reasonCategory: z.string().optional(),
  status: z.string().optional(),
  bias: z.string().optional(),
  session: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  isArchived: z.coerce.boolean().default(false),
  sortBy: z.enum(["date", "createdAt", "instrumentSymbol"]).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const parsed = NoTradeQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return bad("Invalid query params", parsed.error.flatten());

    const {
      page,
      limit,
      search,
      symbol,
      strategyId,
      accountId,
      reasonCategory,
      status,
      bias,
      session,
      fromDate,
      toDate,
      isArchived,
      sortBy,
      sortDir,
    } = parsed.data;

    const where: any = {
      userId: user.id,
      isArchived,
    };

    if (symbol) {
      where.instrumentSymbol = { equals: symbol.toUpperCase(), mode: "insensitive" };
    }

    if (strategyId && strategyId !== "all") {
      where.strategyId = strategyId;
    }

    if (accountId && accountId !== "all") {
      where.accountId = accountId;
    }

    if (reasonCategory && reasonCategory !== "all") {
      where.reasonCategory = reasonCategory;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (bias && bias !== "all") {
      where.bias = bias;
    }

    if (session && session !== "all") {
      where.session = session;
    }

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { instrumentSymbol: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { observation: { contains: q, mode: "insensitive" } },
        { reasonNotes: { contains: q, mode: "insensitive" } },
        { setupIdentified: { contains: q, mode: "insensitive" } },
        { tagsJson: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.noTradeEntry.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortDir },
        include: {
          strategy: { select: { id: true, name: true } },
          account: { select: { id: true, name: true, currency: true } },
        },
      }),
      db.noTradeEntry.count({ where }),
    ]);

    // Behavioral analytics summary
    const allUserEntries = await db.noTradeEntry.findMany({
      where: { userId: user.id, isArchived: false },
      select: {
        reasonCategory: true,
        status: true,
        instrumentSymbol: true,
        decisionType: true,
      },
    });

    const reasonsMap: Record<string, number> = {};
    const statusMap: Record<string, number> = {};
    const symbolMap: Record<string, number> = {};

    allUserEntries.forEach((e) => {
      reasonsMap[e.reasonCategory] = (reasonsMap[e.reasonCategory] || 0) + 1;
      statusMap[e.status] = (statusMap[e.status] || 0) + 1;
      symbolMap[e.instrumentSymbol] = (symbolMap[e.instrumentSymbol] || 0) + 1;
    });

    const topReasons = Object.entries(reasonsMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return ok({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        totalObservations: allUserEntries.length,
        topReasons,
        statusDistribution: statusMap,
        topSymbols: Object.entries(symbolMap)
          .map(([symbol, count]) => ({ symbol, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      },
    });
  } catch (err) {
    return toApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await parseJson(req);
    if (!body) return bad("Invalid JSON body");

    const parsed = NoTradeCreateSchema.safeParse(body);
    if (!parsed.success) return bad("Invalid input", parsed.error.flatten());

    const data = parsed.data;

    const entry = await db.noTradeEntry.create({
      data: {
        userId: user.id,
        instrumentSymbol: data.instrumentSymbol.toUpperCase().trim(),
        instrumentId: data.instrumentId || null,
        market: data.market || null,
        accountId: data.accountId || null,
        strategyId: data.strategyId || null,
        strategyVersionId: data.strategyVersionId || null,
        date: data.date ? new Date(data.date) : new Date(),
        time: data.time || null,
        session: data.session || null,
        timeframe: data.timeframe || null,
        bias: data.bias,
        title: data.title || null,
        observation: data.observation || null,
        priceLevels: data.priceLevels || null,
        marketStructure: data.marketStructure || null,
        liquidityConditions: data.liquidityConditions || null,
        setupIdentified: data.setupIdentified || null,
        expectedDirection: data.expectedDirection || null,
        reasonCategory: data.reasonCategory,
        reasonNotes: data.reasonNotes || null,
        conditionMissing: data.conditionMissing || null,
        wouldHaveValidated: data.wouldHaveValidated || null,
        invalidationReason: data.invalidationReason || null,
        decisionType: data.decisionType,
        status: data.status,
        psychologyNotes: data.psychologyNotes || null,
        behaviorFlagsJson: JSON.stringify(data.behaviorFlags),
        tagsJson: JSON.stringify(data.tags),
        customFieldsJson: JSON.stringify(data.customFields || {}),
        followUpNotes: data.followUpNotes || null,
        isArchived: data.isArchived,
      },
      include: {
        strategy: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
      },
    });

    await auditForUser(user.id, "notrade.created", "NoTradeEntry", entry.id, {
      symbol: entry.instrumentSymbol,
      reason: entry.reasonCategory,
      status: entry.status,
    });

    return ok(entry);
  } catch (err) {
    return toApiError(err);
  }
}
