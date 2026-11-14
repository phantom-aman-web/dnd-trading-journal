import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { auditForUser } from "@/lib/audit";

const DictionaryCreateSchema = z.object({
  strategyId: z.string().optional().nullable(),
  term: z.string().min(1, "Term is required"),
  abbreviation: z.string().optional().nullable(),
  category: z.string().default("General"),
  definition: z.string().min(1, "Definition is required"),
  practicalExplanation: z.string().optional().nullable(),
  exampleUsage: z.string().optional().nullable(),
  relatedTerms: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  isFavorite: z.boolean().default(false),
  diagramUrl: z.string().optional().nullable(),
});

const DictionaryQuerySchema = z.object({
  strategyId: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  isFavorite: z.coerce.boolean().optional(),
  letter: z.string().max(1).optional(),
  includeGlobal: z.coerce.boolean().default(true),
  sortBy: z.enum(["term", "updatedAt", "createdAt"]).default("term"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const parsed = DictionaryQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return bad("Invalid query params", parsed.error.flatten());

    const {
      strategyId,
      category,
      search,
      isFavorite,
      letter,
      includeGlobal,
      sortBy,
      sortDir,
    } = parsed.data;

    const where: any = {
      userId: user.id,
    };

    if (strategyId) {
      if (includeGlobal) {
        where.OR = [
          { strategyId },
          { strategyId: null },
        ];
      } else {
        where.strategyId = strategyId;
      }
    }

    if (category && category !== "all") {
      where.category = category;
    }

    if (isFavorite !== undefined) {
      where.isFavorite = isFavorite;
    }

    if (letter && letter !== "all") {
      where.term = {
        startsWith: letter,
        mode: "insensitive",
      };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { term: { contains: q, mode: "insensitive" } },
            { abbreviation: { contains: q, mode: "insensitive" } },
            { definition: { contains: q, mode: "insensitive" } },
            { practicalExplanation: { contains: q, mode: "insensitive" } },
            { tagsJson: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const entries = await db.strategyDictionaryEntry.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      include: {
        strategy: { select: { id: true, name: true } },
      },
    });

    // Compute category counts
    const allUserEntries = await db.strategyDictionaryEntry.findMany({
      where: { userId: user.id },
      select: { category: true, isFavorite: true },
    });

    const categoryCounts: Record<string, number> = {};
    let favoriteCount = 0;

    allUserEntries.forEach((e) => {
      if (e.category) {
        categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
      }
      if (e.isFavorite) favoriteCount++;
    });

    return ok({
      items: entries,
      total: entries.length,
      categories: categoryCounts,
      favoriteCount,
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

    const parsed = DictionaryCreateSchema.safeParse(body);
    if (!parsed.success) return bad("Invalid input", parsed.error.flatten());

    const data = parsed.data;

    // Verify strategy ownership if strategyId provided
    if (data.strategyId) {
      const strat = await db.strategy.findFirst({
        where: { id: data.strategyId, userId: user.id },
      });
      if (!strat) return bad("Strategy not found or access denied");
    }

    const entry = await db.strategyDictionaryEntry.create({
      data: {
        userId: user.id,
        strategyId: data.strategyId || null,
        term: data.term.trim(),
        abbreviation: data.abbreviation?.trim() || null,
        category: data.category?.trim() || "General",
        definition: data.definition.trim(),
        practicalExplanation: data.practicalExplanation?.trim() || null,
        exampleUsage: data.exampleUsage?.trim() || null,
        relatedTermsJson: JSON.stringify(data.relatedTerms || []),
        tagsJson: JSON.stringify(data.tags || []),
        isFavorite: data.isFavorite,
        diagramUrl: data.diagramUrl || null,
      },
      include: {
        strategy: { select: { id: true, name: true } },
      },
    });

    await auditForUser(user.id, "dictionary.created", "StrategyDictionaryEntry", entry.id, {
      term: entry.term,
      strategyId: entry.strategyId ?? undefined,
    });

    return ok(entry);
  } catch (err) {
    return toApiError(err);
  }
}
