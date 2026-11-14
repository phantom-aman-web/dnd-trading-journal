import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { auditForUser } from "@/lib/audit";

const DictionaryUpdateSchema = z.object({
  strategyId: z.string().optional().nullable(),
  term: z.string().min(1).optional(),
  abbreviation: z.string().optional().nullable(),
  category: z.string().optional(),
  definition: z.string().min(1).optional(),
  practicalExplanation: z.string().optional().nullable(),
  exampleUsage: z.string().optional().nullable(),
  relatedTerms: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  diagramUrl: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const entry = await db.strategyDictionaryEntry.findFirst({
      where: { id, userId: user.id },
      include: {
        strategy: { select: { id: true, name: true, description: true } },
      },
    });

    if (!entry) return notFound("Dictionary entry not found");
    return ok(entry);
  } catch (err) {
    return toApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await parseJson(req);
    if (!body) return bad("Invalid JSON body");

    const parsed = DictionaryUpdateSchema.safeParse(body);
    if (!parsed.success) return bad("Invalid input", parsed.error.flatten());

    const existing = await db.strategyDictionaryEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return notFound("Dictionary entry not found");

    const data = parsed.data;
    const updateData: any = {};

    if (data.strategyId !== undefined) updateData.strategyId = data.strategyId;
    if (data.term !== undefined) updateData.term = data.term.trim();
    if (data.abbreviation !== undefined) updateData.abbreviation = data.abbreviation?.trim() || null;
    if (data.category !== undefined) updateData.category = data.category?.trim() || "General";
    if (data.definition !== undefined) updateData.definition = data.definition.trim();
    if (data.practicalExplanation !== undefined) updateData.practicalExplanation = data.practicalExplanation?.trim() || null;
    if (data.exampleUsage !== undefined) updateData.exampleUsage = data.exampleUsage?.trim() || null;
    if (data.relatedTerms !== undefined) updateData.relatedTermsJson = JSON.stringify(data.relatedTerms);
    if (data.tags !== undefined) updateData.tagsJson = JSON.stringify(data.tags);
    if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
    if (data.diagramUrl !== undefined) updateData.diagramUrl = data.diagramUrl;

    const updated = await db.strategyDictionaryEntry.update({
      where: { id },
      data: updateData,
      include: {
        strategy: { select: { id: true, name: true } },
      },
    });

    await auditForUser(user.id, "dictionary.updated", "StrategyDictionaryEntry", updated.id, updateData as Record<string, unknown>);

    return ok(updated);
  } catch (err) {
    return toApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await db.strategyDictionaryEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return notFound("Dictionary entry not found");

    await db.strategyDictionaryEntry.delete({ where: { id } });
    await auditForUser(user.id, "dictionary.deleted", "StrategyDictionaryEntry", id);

    return ok({ success: true, id });
  } catch (err) {
    return toApiError(err);
  }
}
