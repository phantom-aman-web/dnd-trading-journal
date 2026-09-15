import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { ExecutionFill } from "@/lib/financial-engine";
import { calculateTradeMetrics } from "@/lib/financial-engine";
import { toInstrumentEconomics } from "@/lib/instrument-bridge";
import { resolveInstrumentForServer } from "@/lib/instrument-resolver";
import {
  evaluateChecklist,
  parseChecklistItems,
  parseGradingThresholds,
  serializeAnswers,
  extractChecklist,
  type ChecklistAnswer,
} from "@/lib/checklist-evaluation";
import { buildSignedUrl } from "@/lib/storage";
import { audit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const trade = await db.trade.findFirst({
    where: { id, userId: user.id },
    include: {
      executions: { orderBy: { seq: "asc" } },
      targets: { orderBy: { createdAt: "asc" } },
      account: true,
      instrument: true,
      strategy: { include: { versions: { orderBy: { effectiveDate: "desc" } } } },
      strategyVersion: true,
      dailyPlan: true,
      checklistVersion: { include: { checklist: true } },
      checklistEvaluations: {
        include: {
          checklistVersion: { include: { checklist: true } },
          strategyVersion: true,
        },
        orderBy: { evaluatedAt: "desc" },
      },
      media: { include: { annotations: true }, orderBy: { createdAt: "asc" } },
      reviewLinks: { include: { review: true } },
    },
  });
  if (!trade) return notFound("Trade not found");
  // Inline a signed `url` into each media item so the client doesn't need
  // to make N follow-up GET /api/media/[id] requests just to render
  // evidence thumbnails (Fix 3 — media N+1 query).
  const tradeWithUrls = {
    ...trade,
    media: await Promise.all(trade.media.map(async (m) => ({ ...m, url: await buildSignedUrl(m.storedPath) }))),
  };
  return ok(tradeWithUrls);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const trade = await db.trade.findFirst({ where: { id, userId: user.id } });
  if (!trade) return notFound("Trade not found");

  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");

  // Mass-assignment protection: explicit allowlist (spec section 102)
  const allowed: Record<string, unknown> = {};
  const fields = [
    "instrumentSymbol", "market", "direction", "status", "session",
    "newsEvent",
    "strategyId", "strategyVersionId", "dailyPlanId", "checklistVersionId",
    "setupGrade", "setupScore", "plannedEntryPrice", "plannedStopPrice", "plannedTargetPrice",
    "plannedRiskPct", "entryTime", "exitTime", "tradingTimezone",
    "feesCents", "commissionCents", "swapCents", "slippageCents",
    "notes", "lessons", "isDraft", "isArchived",
  ];
  for (const f of fields) {
    if (f in body) {
      // Validate FK ownership for relational fields before passing through.
      if (f === "strategyId" && body[f]) {
        const strat = await db.strategy.findFirst({ where: { id: body[f], userId: user.id } });
        if (!strat) return bad("Strategy not found or not owned by user.");
      }
      if (f === "strategyVersionId" && body[f]) {
        const ver = await db.strategyVersion.findFirst({
          where: { id: body[f], strategy: { userId: user.id } },
        });
        if (!ver) return bad("Strategy version not found or not owned by user.");
      }
      if (f === "checklistVersionId" && body[f]) {
        const cv = await db.checklistVersion.findFirst({
          where: { id: body[f], checklist: { userId: user.id } },
        });
        if (!cv) return bad("Checklist version not found or not owned by user.");
      }
      if (f === "dailyPlanId" && body[f]) {
        const plan = await db.dailyPlan.findFirst({ where: { id: body[f], userId: user.id } });
        if (!plan) return bad("Daily plan not found or not owned by user.");
      }
      allowed[f] = body[f];
    }
  }
  if ("tags" in body) allowed.tagsJson = JSON.stringify(body.tags ?? []);
  if ("setup" in body) allowed.setupJson = body.setup ? JSON.stringify(body.setup) : null;
  if ("thesis" in body) allowed.thesisJson = body.thesis ? JSON.stringify(body.thesis) : null;
  if ("planAdherence" in body) allowed.planAdherenceJson = body.planAdherence ? JSON.stringify(body.planAdherence) : null;
  if ("psychBefore" in body) allowed.psychBeforeJson = body.psychBefore ? JSON.stringify(body.psychBefore) : null;
  if ("psychAfter" in body) allowed.psychAfterJson = body.psychAfter ? JSON.stringify(body.psychAfter) : null;
  if ("behaviorFlags" in body) allowed.behaviorFlagsJson = JSON.stringify(body.behaviorFlags ?? []);

  // ── INSTRUMENT RESOLUTION (Fix #2) ──────────────────────────────
  // If instrumentSymbol changed (or if this is the first save with a symbol),
  // re-resolve the authoritative instrument metadata so the server uses
  // the correct pointValueCents / contractSize for P&L.
  const effectiveSymbol = (body.instrumentSymbol ?? trade.instrumentSymbol ?? "").trim().toUpperCase();
  const resolved = await resolveInstrumentForServer(effectiveSymbol, user.id);
  const instrument = resolved.def;
  if (resolved.instrumentId) {
    allowed.instrumentId = resolved.instrumentId;
  }

  // If executions provided, replace ledger and recompute (spec section 31, 33).
  const hasExecutions = Array.isArray(body.executions);
  const hasFinancialChange =
    hasExecutions ||
    body.feesCents !== undefined ||
    body.commissionCents !== undefined ||
    body.swapCents !== undefined ||
    body.slippageCents !== undefined ||
    body.direction !== undefined;

  if (hasFinancialChange) {
    // Replace the executions ledger if new executions were provided.
    if (hasExecutions) {
      await db.tradeExecution.deleteMany({ where: { tradeId: id } });
      if (body.executions.length > 0) {
        await db.tradeExecution.createMany({
          data: body.executions.map((e: any, idx: number) => ({
            tradeId: id,
            kind: e.kind,
            seq: idx,
            price: String(e.price),
            quantity: String(e.quantity),
            timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
            notes: e.notes,
          })),
        });
      }
    }

    let fills: ExecutionFill[];
    if (hasExecutions) {
      fills = body.executions.map((e: any): ExecutionFill => ({
        kind: e.kind,
        price: String(e.price),
        quantity: String(e.quantity),
      }));
    } else {
      const existingExecs = await db.tradeExecution.findMany({
        where: { tradeId: id },
        orderBy: { seq: "asc" },
      });
      fills = existingExecs.map((e): ExecutionFill => ({
        kind: e.kind as "entry" | "exit",
        price: e.price,
        quantity: e.quantity,
      }));
    }

    // ── AUTHORITATIVE FINANCIAL ENGINE (spec §1) ──
    // The FinancialEngine is the SINGLE authoritative source. The legacy
    // calculateTradeMetrics is retained for backward compatibility only.
    const account = await db.tradingAccount.findFirst({
      where: { id: trade.accountId, userId: user.id },
      select: { currency: true },
    });
    const accountCurrency = account?.currency ?? "USD";
    const instrumentEconomics = toInstrumentEconomics(instrument, accountCurrency);
    const engineResult = calculateTradeMetrics({
      instrument: instrumentEconomics,
      accountCurrency,
      direction: (body.direction ?? trade.direction) as "long" | "short",
      plannedEntryPrice: body.plannedEntryPrice ?? trade.plannedEntryPrice,
      plannedStopPrice: body.plannedStopPrice ?? trade.plannedStopPrice,
      plannedTargetPrice: body.plannedTargetPrice ?? trade.plannedTargetPrice,
      fills,
      feesCents: body.feesCents ?? trade.feesCents,
      commissionCents: body.commissionCents ?? trade.commissionCents,
      swapCents: body.swapCents ?? trade.swapCents,
      slippageCents: body.slippageCents ?? trade.slippageCents,
    });
    allowed.entryPriceAvg = engineResult.entryPriceAvg;
    allowed.exitPriceAvg = engineResult.exitPriceAvg;
    allowed.grossPnlCents = engineResult.grossPnlNativeCents;
    allowed.netPnlCents = engineResult.netPnlNativeCents;
    allowed.actualR = engineResult.actualR;
    allowed.plannedRiskAmountCents = engineResult.plannedRiskAmountCents;
    allowed.plannedRR = engineResult.plannedRR;
    // SPEC v3 §8.2: status is DERIVED, never stored as user input.
    // When there's a real EXIT execution, the engine's outcome (win/loss/breakeven/
    // partial_*) is AUTHORITATIVE — body.status from the client is IGNORED.
    // The form sends status="closed" as a UI hint, but the server must persist
    // the derived outcome ("win"/"loss"/"breakeven") per the v3 spec.
    if (hasExecutions) {
      const hasExit = body.executions.some((e: any) => e.kind === "exit");
      if (hasExit) {
        // Engine derives the outcome from P&L sign + exit quantity.
        // This is AUTHORITATIVE — body.status is NOT used.
        const engineStatus =
          engineResult.outcome === "open"
            ? "open"
            : engineResult.status === "closed"
              ? engineResult.outcome
              : engineResult.status === "partial"
                ? engineResult.outcome
                : "open";
        allowed.status = engineStatus;
      } else {
        // No exit execution — respect body.status or existing trade.status
        allowed.status = body.status ?? trade.status;
      }
    }
  }

  // ── CHECKLIST ANTI-CHEAT (Fix #1) ────────────────────────────────
  // Server-authoritative evaluation. Same resolution path as POST.
  const hasChecklistAnswers =
    body.checklistAnswers &&
    typeof body.checklistAnswers === "object" &&
    Object.keys(body.checklistAnswers).length > 0;

  if (hasChecklistAnswers && (body.strategyVersionId || body.checklistVersionId || trade.strategyVersionId)) {
    let items: ReturnType<typeof extractChecklist> = [];
    let thresholds = parseGradingThresholds(null);
    let evalChecklistVersionId: string | null = null;
    let evalStrategyVersionId: string | null = null;

    const svId = body.strategyVersionId ?? trade.strategyVersionId;
    if (svId) {
      const sv = await db.strategyVersion.findFirst({
        where: { id: svId, strategy: { userId: user.id } },
      });
      if (sv) {
        items = extractChecklist(sv.rulesJson);
        // Check for an associated ChecklistConfig with its latest version.
        const stratId = body.strategyId ?? trade.strategyId;
        if (stratId) {
          const strat = await db.strategy.findFirst({
            where: { id: stratId, userId: user.id },
            include: {
              checklistConfig: {
                include: {
                  versions: { orderBy: { effectiveDate: "desc" }, take: 1 },
                },
              },
            },
          });
          if (strat?.checklistConfig?.versions?.[0]) {
            evalChecklistVersionId = strat.checklistConfig.versions[0].id;
            const cvItems = parseChecklistItems(
              strat.checklistConfig.versions[0].itemsJson,
            );
            if (cvItems.length > 0) {
              items = cvItems;
            }
            thresholds = parseGradingThresholds(
              strat.checklistConfig.versions[0].gradingThresholdsJson,
            );
          }
        }
        evalStrategyVersionId = sv.id;
      }
    }

    if (items.length === 0 && body.checklistVersionId) {
      const cv = await db.checklistVersion.findFirst({
        where: { id: body.checklistVersionId, checklist: { userId: user.id } },
      });
      if (cv) {
        items = parseChecklistItems(cv.itemsJson);
        thresholds = parseGradingThresholds(cv.gradingThresholdsJson);
        evalChecklistVersionId = cv.id;
      }
    }

    if (items.length > 0) {
      const answers = body.checklistAnswers as ChecklistAnswer;
      const result = evaluateChecklist(items, answers, thresholds);

      allowed.checklistVersionId = evalChecklistVersionId;
      allowed.setupGrade = result.grade;
      allowed.setupScore = String(result.score);

      // Upsert the TradeChecklistEvaluation snapshot.
      const existingEval = await db.tradeChecklistEvaluation.findFirst({
        where: {
          tradeId: id,
          ...(evalChecklistVersionId
            ? { checklistVersionId: evalChecklistVersionId }
            : { checklistVersionId: null }),
        },
      });
      try {
        if (existingEval) {
          await db.tradeChecklistEvaluation.update({
            where: { id: existingEval.id },
            data: {
              rawAnswersJson: serializeAnswers(answers),
              weightedScore: String(result.score),
              finalGrade: result.grade,
              evaluatedAt: new Date(),
              strategyVersionId: evalStrategyVersionId,
            },
          });
        } else {
          await db.tradeChecklistEvaluation.create({
            data: {
              tradeId: id,
              checklistVersionId: evalChecklistVersionId,
              strategyVersionId: evalStrategyVersionId,
              rawAnswersJson: serializeAnswers(answers),
              weightedScore: String(result.score),
              finalGrade: result.grade,
            },
          });
        }
      } catch {
        await audit("trade.checklist_eval_failed", "trade", id);
      }
    }
  }

  // ── PARTIAL EXITS PERSISTENCE (Fix #3) ───────────────────────────
  // If partialExits is provided, replace the existing TradeTarget rows.
  // Only valid (non-empty price) entries are stored; ordering is preserved.
  if (Array.isArray(body.partialExits)) {
    await db.tradeTarget.deleteMany({ where: { tradeId: id } });
    const validExits = body.partialExits.filter(
      (tp: any) => tp.price && String(tp.price).trim() !== "",
    );
    if (validExits.length > 0) {
      await db.tradeTarget.createMany({
        data: validExits.map((tp: any, idx: number) => ({
          tradeId: id,
          label: tp.name || `TP${idx + 1}`,
          price: String(tp.price),
          quantityPct: "0",
        })),
      });
    }
  }

  try {
    const updated = await db.trade.update({
      where: { id },
      data: allowed,
      include: {
        executions: { orderBy: { seq: "asc" } },
        targets: { orderBy: { createdAt: "asc" } },
      },
    });
    await audit("trade.updated", "trade", id);
    return ok(updated);
  } catch (err: any) {
    if (err?.code === "P2003") {
      return bad("Invalid reference: one of the provided IDs (strategy, instrument, etc.) does not exist.");
    }
    return bad("Failed to update trade.");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const trade = await db.trade.findFirst({ where: { id, userId: user.id } });
  if (!trade) return notFound("Trade not found");
  await db.trade.delete({ where: { id } });
  await audit("trade.deleted", "trade", id);
  return ok({ ok: true });
}

