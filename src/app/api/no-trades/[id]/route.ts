import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { auditForUser } from "@/lib/audit";

const NoTradeUpdateSchema = z.object({
  instrumentSymbol: z.string().optional(),
  instrumentId: z.string().optional().nullable(),
  market: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  strategyId: z.string().optional().nullable(),
  strategyVersionId: z.string().optional().nullable(),
  date: z.string().datetime().optional().nullable(),
  time: z.string().optional().nullable(),
  session: z.string().optional().nullable(),
  timeframe: z.string().optional().nullable(),
  bias: z.enum(["bullish", "bearish", "neutral"]).optional(),
  title: z.string().optional().nullable(),
  observation: z.string().optional().nullable(),
  priceLevels: z.string().optional().nullable(),
  marketStructure: z.string().optional().nullable(),
  liquidityConditions: z.string().optional().nullable(),
  setupIdentified: z.string().optional().nullable(),
  expectedDirection: z.string().optional().nullable(),
  reasonCategory: z.string().optional(),
  reasonNotes: z.string().optional().nullable(),
  conditionMissing: z.string().optional().nullable(),
  wouldHaveValidated: z.string().optional().nullable(),
  invalidationReason: z.string().optional().nullable(),
  decisionType: z.enum(["deliberate_avoidance", "missed", "rejected", "not_ready"]).optional(),
  status: z.enum(["observing", "waiting_confirmation", "rejected", "missed", "invalidated", "completed"]).optional(),
  psychologyNotes: z.string().optional().nullable(),
  behaviorFlags: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.any()).optional().nullable(),
  followUpNotes: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const entry = await db.noTradeEntry.findFirst({
      where: { id, userId: user.id },
      include: {
        strategy: { select: { id: true, name: true, description: true } },
        strategyVersion: { select: { id: true, versionLabel: true } },
        account: { select: { id: true, name: true, currency: true } },
      },
    });

    if (!entry) return notFound("Observation not found");
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

    const parsed = NoTradeUpdateSchema.safeParse(body);
    if (!parsed.success) return bad("Invalid input", parsed.error.flatten());

    const existing = await db.noTradeEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return notFound("Observation not found");

    const data = parsed.data;
    const updateData: any = {};

    if (data.instrumentSymbol !== undefined) updateData.instrumentSymbol = data.instrumentSymbol.toUpperCase().trim();
    if (data.instrumentId !== undefined) updateData.instrumentId = data.instrumentId;
    if (data.market !== undefined) updateData.market = data.market;
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.strategyId !== undefined) updateData.strategyId = data.strategyId;
    if (data.strategyVersionId !== undefined) updateData.strategyVersionId = data.strategyVersionId;
    if (data.date !== undefined) updateData.date = data.date ? new Date(data.date) : existing.date;
    if (data.time !== undefined) updateData.time = data.time;
    if (data.session !== undefined) updateData.session = data.session;
    if (data.timeframe !== undefined) updateData.timeframe = data.timeframe;
    if (data.bias !== undefined) updateData.bias = data.bias;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.observation !== undefined) updateData.observation = data.observation;
    if (data.priceLevels !== undefined) updateData.priceLevels = data.priceLevels;
    if (data.marketStructure !== undefined) updateData.marketStructure = data.marketStructure;
    if (data.liquidityConditions !== undefined) updateData.liquidityConditions = data.liquidityConditions;
    if (data.setupIdentified !== undefined) updateData.setupIdentified = data.setupIdentified;
    if (data.expectedDirection !== undefined) updateData.expectedDirection = data.expectedDirection;
    if (data.reasonCategory !== undefined) updateData.reasonCategory = data.reasonCategory;
    if (data.reasonNotes !== undefined) updateData.reasonNotes = data.reasonNotes;
    if (data.conditionMissing !== undefined) updateData.conditionMissing = data.conditionMissing;
    if (data.wouldHaveValidated !== undefined) updateData.wouldHaveValidated = data.wouldHaveValidated;
    if (data.invalidationReason !== undefined) updateData.invalidationReason = data.invalidationReason;
    if (data.decisionType !== undefined) updateData.decisionType = data.decisionType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.psychologyNotes !== undefined) updateData.psychologyNotes = data.psychologyNotes;
    if (data.behaviorFlags !== undefined) updateData.behaviorFlagsJson = JSON.stringify(data.behaviorFlags);
    if (data.tags !== undefined) updateData.tagsJson = JSON.stringify(data.tags);
    if (data.customFields !== undefined) updateData.customFieldsJson = JSON.stringify(data.customFields || {});
    if (data.followUpNotes !== undefined) updateData.followUpNotes = data.followUpNotes;
    if (data.isArchived !== undefined) {
      updateData.isArchived = data.isArchived;
      updateData.archivedAt = data.isArchived ? new Date() : null;
    }

    const updated = await db.noTradeEntry.update({
      where: { id },
      data: updateData,
      include: {
        strategy: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
      },
    });

    await auditForUser(user.id, "notrade.updated", "NoTradeEntry", updated.id, updateData as Record<string, unknown>);

    return ok(updated);
  } catch (err) {
    return toApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await db.noTradeEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return notFound("Observation not found");

    await db.noTradeEntry.delete({ where: { id } });
    await auditForUser(user.id, "notrade.deleted", "NoTradeEntry", id);

    return ok({ success: true, id });
  } catch (err) {
    return toApiError(err);
  }
}
