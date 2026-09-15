import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import {  } from "@/lib/financial-engine";
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
import { audit } from "@/lib/audit";

const ExecutionSchema = z.object({
  kind: z.enum(["entry", "exit"]),
  price: z.string(),
  quantity: z.string(),
  timestamp: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const PartialExitSchema = z.object({
  id: z.string().optional(),
  name: z.string().default("TP1"),
  price: z.string(),
});

const TradeCreateSchema = z.object({
  accountId: z.string(),
  instrumentId: z.string().optional().nullable(),
  instrumentSymbol: z.string(),
  market: z.string().optional().nullable(),
  direction: z.enum(["long", "short"]),
  session: z.string().optional().nullable(),
  newsEvent: z.string().optional().nullable(),
  strategyId: z.string().optional().nullable(),
  strategyVersionId: z.string().optional().nullable(),
  dailyPlanId: z.string().optional().nullable(),
  checklistVersionId: z.string().optional().nullable(),
  checklistAnswers: z.record(z.string(), z.any()).optional().nullable(),
  // setupGrade / setupScore are accepted but ALWAYS overridden by the server's
  // authoritative evaluation. The client cannot inject a higher grade.
  setupGrade: z.string().optional().nullable(),
  setupScore: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  plannedEntryPrice: z.string().optional().nullable(),
  plannedStopPrice: z.string().optional().nullable(),
  plannedTargetPrice: z.string().optional().nullable(),
  plannedRiskPct: z.string().optional().nullable(),
  executions: z.array(ExecutionSchema).default([]),
  feesCents: z.number().int().default(0),
  commissionCents: z.number().int().default(0),
  swapCents: z.number().int().default(0),
  slippageCents: z.number().int().default(0),
  entryTime: z.string().datetime().optional().nullable(),
  exitTime: z.string().datetime().optional().nullable(),
  tradingTimezone: z.string().default("UTC"),
  setup: z.record(z.string(), z.any()).optional().nullable(),
  thesis: z.record(z.string(), z.any()).optional().nullable(),
  notes: z.string().optional().nullable(),
  lessons: z.string().optional().nullable(),
  planAdherence: z.record(z.string(), z.any()).optional().nullable(),
  psychBefore: z.record(z.string(), z.any()).optional().nullable(),
  psychAfter: z.record(z.string(), z.any()).optional().nullable(),
  ruleCompliance: z.record(z.string(), z.any()).optional().nullable(),
  behaviorFlags: z.array(z.string()).default([]),
  status: z.string().default("open"),
  isDraft: z.boolean().default(false),
  partialExits: z.array(PartialExitSchema).default([]),
});

const ListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(100),
  cursor: z.string().optional(),
  search: z.string().optional(),
  accountId: z.string().optional(),
  instrumentId: z.string().optional(),
  strategyId: z.string().optional(),
  session: z.string().optional(),
  status: z.string().optional(),
  direction: z.enum(["long", "short"]).optional(),
  setupGrade: z.string().optional(),
  tag: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sortBy: z.string().default("entryTime"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  includeArchived: z.coerce.boolean().default(false),
});

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = ListQuerySchema.safeParse(params);
  if (!parsed.success) return bad("Invalid query", parsed.error.flatten());
  const q = parsed.data;

  // Authorization: enforce userId ownership on every query (spec section 100/101)
  const where: any = { userId: user.id, isArchived: q.includeArchived ? undefined : false };
  if (q.includeArchived === false) where.isArchived = false;
  if (q.accountId) where.accountId = q.accountId;
  if (q.instrumentId) where.instrumentId = q.instrumentId;
  if (q.strategyId) where.strategyId = q.strategyId;
  if (q.session) where.session = q.session;
  if (q.status) where.status = q.status;
  if (q.direction) where.direction = q.direction;
  if (q.setupGrade) where.setupGrade = q.setupGrade;
  if (q.tag) where.tagsJson = { contains: `"${q.tag}"` };
  if (q.search) {
    where.OR = [
      { instrumentSymbol: { contains: q.search } },
      { notes: { contains: q.search } },
    ];
  }
  if (q.fromDate || q.toDate) {
    where.entryTime = {};
    if (q.fromDate) where.entryTime.gte = new Date(q.fromDate);
    if (q.toDate) where.entryTime.lte = new Date(q.toDate);
  }

  const trades = await db.trade.findMany({
    where,
    orderBy: { [q.sortBy]: q.sortDir },
    take: q.limit + 1,
    ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
    include: {
      executions: { orderBy: { seq: "asc" } },
      strategy: { select: { id: true, name: true } },
      strategyVersion: { select: { id: true, versionLabel: true } },
    },
  });

  const hasMore = trades.length > q.limit;
  const items = hasMore ? trades.slice(0, q.limit) : trades;
  return ok({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    total: items.length,
  });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const parsed = TradeCreateSchema.safeParse(body);
  if (!parsed.success) return bad("Invalid input", parsed.error.flatten());
  const data = parsed.data;

  // Normalize the instrument symbol: trim whitespace + uppercase.
  const normalizedSymbol = (data.instrumentSymbol || "").trim().toUpperCase();
  data.instrumentSymbol = normalizedSymbol;

  // Authorization: verify account belongs to user (spec section 101)
  const account = await db.tradingAccount.findFirst({
    where: { id: data.accountId, userId: user.id },
  });
  if (!account) return bad("Account not found or not owned by user");

  // ── INSTRUMENT RESOLUTION (Fix #2) ──────────────────────────────
  // The server is the authoritative source for instrument metadata.
  // We resolve the instrument from the DB (user override) or the static
  // catalog — NEVER trusting client-provided financial metadata.
  const resolved = await resolveInstrumentForServer(normalizedSymbol, user.id);
  const instrument = resolved.def;
  // Use the resolved instrumentId if we found a DB row; otherwise leave it
  // null (the catalog doesn't have a DB id, but the symbol is sufficient).
  const instrumentId = resolved.instrumentId ?? null;

  if (data.strategyId) {
    const strat = await db.strategy.findFirst({
      where: { id: data.strategyId, userId: user.id },
    });
    if (!strat) return bad("Strategy not found or not owned by user");
  }
  if (data.dailyPlanId) {
    const plan = await db.dailyPlan.findFirst({
      where: { id: data.dailyPlanId, userId: user.id },
    });
    if (!plan) return bad("Daily plan not found or not owned by user");
  }

  // ── SERVER-SIDE FINANCIAL CALCULATION (Authoritative Engine) ───
  // The FinancialEngine is the SINGLE authoritative source for all financial
  // calculations (spec §1). The legacy calculateTradeMetrics is retained only
  // for backward compatibility with code paths that haven't migrated yet.
  const accountCurrency = account.currency ?? "USD";
  const instrumentEconomics = toInstrumentEconomics(instrument, accountCurrency);
  const engineResult = calculateTradeMetrics({
    instrument: instrumentEconomics,
    accountCurrency,
    direction: data.direction,
    plannedEntryPrice: data.plannedEntryPrice ?? null,
    plannedStopPrice: data.plannedStopPrice ?? null,
    plannedTargetPrice: data.plannedTargetPrice ?? null,
    fills: data.executions.map((e) => ({
      kind: e.kind,
      price: e.price,
      quantity: e.quantity,
    })),
    feesCents: data.feesCents,
    commissionCents: data.commissionCents,
    swapCents: data.swapCents,
    slippageCents: data.slippageCents,
  });
  // Use engine result as authoritative (spec §1).
  const calc = {
    entryPriceAvg: engineResult.entryPriceAvg,
    exitPriceAvg: engineResult.exitPriceAvg,
    totalQuantity: engineResult.entryQuantity,
    grossPnlCents: engineResult.grossPnlNativeCents,
    netPnlCents: engineResult.netPnlNativeCents,
    actualR: engineResult.actualR,
    plannedRR: engineResult.plannedRR,
    riskAmountCents: engineResult.plannedRiskAmountCents,
    rewardAmountCents: engineResult.plannedRewardAmountCents,
    status: engineResult.outcome === "open" ? "open" : engineResult.status === "closed" ? engineResult.outcome : engineResult.status === "partial" ? engineResult.outcome : "open",
  };

  // ── CHECKLIST ANTI-CHEAT (Fix #1) ────────────────────────────────
  // The SERVER is the authoritative source for checklist score/grade.
  // The client may send setupGrade/setupScore as a preview, but the server
  // ALWAYS recomputes them from the authoritative rule definition.
  //
  // Resolution path:
  //   - If a strategyVersionId is provided, load the StrategyVersion and
  //     extract items from its rulesJson (this is the normal path for
  //     user-created trades).
  //   - If a checklistVersionId is provided (ChecklistConfig path), load
  //     that ChecklistVersion and use its itemsJson.
  //   - In either case, the server evaluates the raw checklistAnswers
  //     against the authoritative items and overrides setupGrade/setupScore.
  let setupGrade: string | null = null;
  let setupScore: string | null = null;
  let pendingEvaluation: {
    checklistVersionId: string | null;
    strategyVersionId: string | null;
    rawAnswersJson: string;
    weightedScore: string;
    finalGrade: string;
  } | null = null;

  const hasChecklistAnswers =
    data.checklistAnswers &&
    typeof data.checklistAnswers === "object" &&
    Object.keys(data.checklistAnswers).length > 0;

  if (hasChecklistAnswers) {
    let items: ReturnType<typeof extractChecklist> = [];
    let thresholds: ReturnType<typeof parseGradingThresholds> = {
      ...({} as any),
    };
    let evalChecklistVersionId: string | null = null;
    let evalStrategyVersionId: string | null = null;

    // Path A: StrategyVersion.rulesJson (the normal path for form-driven trades).
    if (data.strategyVersionId) {
      const sv = await db.strategyVersion.findFirst({
        where: { id: data.strategyVersionId, strategy: { userId: user.id } },
      });
      if (sv) {
        items = extractChecklist(sv.rulesJson);
        // If the strategy has an associated ChecklistConfig, link the
        // evaluation to its latest version too (for the snapshot FK).
        if (data.strategyId) {
          const strat = await db.strategy.findFirst({
            where: { id: data.strategyId, userId: user.id },
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
            // Use the ChecklistVersion's thresholds if available (authoritative).
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

    // Path B: explicit checklistVersionId (ChecklistConfig path).
    if (items.length === 0 && data.checklistVersionId) {
      const cv = await db.checklistVersion.findFirst({
        where: { id: data.checklistVersionId, checklist: { userId: user.id } },
      });
      if (cv) {
        items = parseChecklistItems(cv.itemsJson);
        thresholds = parseGradingThresholds(cv.gradingThresholdsJson);
        evalChecklistVersionId = cv.id;
      }
    }

    // Evaluate authoritatively on the server.
    if (items.length > 0) {
      const answers = data.checklistAnswers as ChecklistAnswer;
      const result = evaluateChecklist(items, answers, thresholds);
      setupGrade = result.grade;
      setupScore = String(result.score);
      pendingEvaluation = {
        checklistVersionId: evalChecklistVersionId,
        strategyVersionId: evalStrategyVersionId,
        rawAnswersJson: serializeAnswers(answers),
        weightedScore: String(result.score),
        finalGrade: result.grade,
      };
    }
  }

  let trade;
  try {
    trade = await db.trade.create({
      data: {
        userId: user.id,
        accountId: data.accountId,
        instrumentId,
        instrumentSymbol: data.instrumentSymbol,
        market: data.market ?? instrument.market ?? null,
        direction: data.direction,
        // Derive status from P&L when executions are present (win/loss/breakeven),
        // otherwise use the user-supplied status (open/planned/draft).
        status: data.isDraft ? "open" : (
          // BUG-CALC-2 fix: only derive status from calc when a real EXIT
          // execution exists. Without exits, calc.status is always "open"
          // (because exitQty=0 → deriveStatus returns "open"), which would
          // silently override the user's explicit "closed" selection.
          data.executions.some((e) => e.kind === "exit") ? calc.status : data.status
        ),
        session: data.session,
        newsEvent: data.newsEvent ?? "none",
        strategyId: data.strategyId,
        strategyVersionId: data.strategyVersionId,
        dailyPlanId: data.dailyPlanId,
        checklistVersionId: pendingEvaluation?.checklistVersionId ?? null,
        setupGrade,
        setupScore,
        tagsJson: JSON.stringify(data.tags),
        plannedEntryPrice: data.plannedEntryPrice ?? null,
        plannedStopPrice: data.plannedStopPrice ?? null,
        plannedTargetPrice: data.plannedTargetPrice ?? null,
        plannedRiskPct: data.plannedRiskPct,
        // BUG-CALC-8 fix: persist the server-computed risk amount so the
        // CloseTradeModal can display it and compute estimated R live.
        plannedRiskAmountCents: calc.riskAmountCents,
        // BUG-CALC-3 fix: persist the planned R:R ratio (target/stop distance).
        plannedRR: calc.plannedRR,
        entryPriceAvg: calc.entryPriceAvg,
        exitPriceAvg: calc.exitPriceAvg,
        positionSize: calc.totalQuantity ?? null,
        feesCents: data.feesCents,
        commissionCents: data.commissionCents,
        swapCents: data.swapCents,
        slippageCents: data.slippageCents,
        grossPnlCents: calc.grossPnlCents,
        netPnlCents: calc.netPnlCents,
        actualR: calc.actualR,
        entryTime: data.entryTime ?? (data.executions.find((e) => e.kind === "entry")?.timestamp ?? null),
        exitTime: data.exitTime ?? (data.executions.find((e) => e.kind === "exit")?.timestamp ?? null),
        tradingTimezone: data.tradingTimezone,
        setupJson: data.setup ? JSON.stringify(data.setup) : null,
        thesisJson: data.thesis ? JSON.stringify(data.thesis) : null,
        notes: data.notes,
        lessons: data.lessons,
        planAdherenceJson: data.planAdherence ? JSON.stringify(data.planAdherence) : (data.ruleCompliance ? JSON.stringify({ ruleCompliance: data.ruleCompliance }) : null),
        psychBeforeJson: data.psychBefore ? JSON.stringify(data.psychBefore) : null,
        psychAfterJson: data.psychAfter ? JSON.stringify(data.psychAfter) : null,
        behaviorFlagsJson: JSON.stringify(data.behaviorFlags),
        isDraft: data.isDraft,
        executions: {
          create: data.executions.map((e, idx) => ({
            kind: e.kind,
            seq: idx,
            price: e.price,
            quantity: e.quantity,
            timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
            notes: e.notes,
          })),
        },
        // ── PARTIAL EXITS PERSISTENCE (Fix #3) ─────────────────────
        // Persist planned TP levels to the TradeTarget table. Only valid
        // (non-empty price) entries are stored; ordering is preserved by
        // the array index. quantityPct defaults to "0" (not used for
        // display — these are PLANNED targets, not actual execution fills).
        targets: {
          create: data.partialExits
            .filter((tp) => tp.price && tp.price.trim() !== "")
            .map((tp, idx) => ({
              label: tp.name || `TP${idx + 1}`,
              price: tp.price,
              quantityPct: "0",
            })),
        },
      },
      include: {
        executions: { orderBy: { seq: "asc" } },
        targets: { orderBy: { createdAt: "asc" } },
      },
    });
  } catch (err: any) {
    if (err?.code === "P2003") {
      return bad("Invalid reference: one of the provided IDs (strategy, instrument, etc.) does not exist.");
    }
    return bad("Failed to create trade.");
  }

  await audit("trade.created", "trade", trade.id, { symbol: trade.instrumentSymbol });

  // Persist the TradeChecklistEvaluation snapshot (Fix #1 — historical
  // version safety). The snapshot is immutable — it preserves the exact
  // answers + computed score/grade at trade-creation time so later
  // strategy/checklist edits never silently change old trades.
  if (pendingEvaluation) {
    try {
      await db.tradeChecklistEvaluation.create({
        data: {
          tradeId: trade.id,
          checklistVersionId: pendingEvaluation.checklistVersionId,
          strategyVersionId: pendingEvaluation.strategyVersionId,
          rawAnswersJson: pendingEvaluation.rawAnswersJson,
          weightedScore: pendingEvaluation.weightedScore,
          finalGrade: pendingEvaluation.finalGrade,
        },
      });
    } catch {
      // Non-fatal: the trade itself was created. Log via audit and continue.
      await audit("trade.checklist_eval_failed", "trade", trade.id);
    }
  }

  return ok(trade);
}
