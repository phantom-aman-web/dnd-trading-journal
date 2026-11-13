import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError } from "@/lib/api";
import { computeAggregateMetrics, type TradeMetricRow, type TradeOutcome } from "@/lib/financial-engine";

interface ChecklistItem {
  title: string;
  required?: boolean;
  description?: string;
}

function parseChecklistRules(rulesJson: string | null | undefined): ChecklistItem[] {
  if (!rulesJson) return [];
  try {
    const parsed = JSON.parse(rulesJson);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any) => ({
          title: String(item?.title ?? item?.text ?? "").trim(),
          required: item?.required ?? true,
          description: item?.description ? String(item.description) : "",
        }))
        .filter((i) => i.title.length > 0);
    }
    if (parsed && typeof parsed === "object") {
      const sections = ["entry", "stop", "target", "management", "invalidation"];
      const items: ChecklistItem[] = [];
      for (const sec of sections) {
        const arr = (parsed as any)[sec];
        if (!Array.isArray(arr)) continue;
        for (const r of arr) {
          const title = typeof r === "string" ? r : String(r?.text ?? "").trim();
          if (!title) continue;
          items.push({
            title,
            required: typeof r === "object" && r ? r.required ?? true : true,
            description: typeof r === "object" && r && r.description ? String(r.description) : "",
          });
        }
      }
      return items;
    }
  } catch {
    return [];
  }
  return [];
}

function computeAdherencePct(planAdherenceJson: string | null | undefined): number | null {
  if (!planAdherenceJson) return null;
  try {
    const pa = JSON.parse(planAdherenceJson);
    if (pa && typeof pa.adherencePct === "number") return Math.round(pa.adherencePct);
    if (pa && typeof pa.followedPlan === "boolean") return pa.followedPlan ? 100 : 0;
    const rc = pa?.ruleCompliance;
    if (!rc || typeof rc !== "object") return null;
    const values = Object.values(rc);
    if (values.length === 0) return null;
    const truthy = values.filter((v) => v === true).length;
    return Math.round((truthy / values.length) * 100);
  } catch {
    return null;
  }
}

function mapToTradeMetricRow(t: any): TradeMetricRow {
  let outcome: TradeOutcome = "open";
  if (!t.isDraft && t.status !== "planned" && t.status !== "open") {
    if (t.netPnlCents > 0) outcome = "win";
    else if (t.netPnlCents < 0) outcome = "loss";
    else outcome = "breakeven";
  }

  return {
    id: t.id,
    netPnlCents: t.netPnlCents ?? 0,
    grossPnlCents: t.grossPnlCents ?? t.netPnlCents ?? 0,
    actualR: t.actualR ? String(t.actualR) : null,
    status: t.status,
    outcome,
    exitTime: t.exitTime ? new Date(t.exitTime).toISOString() : null,
    entryTime: t.entryTime ? new Date(t.entryTime).toISOString() : null,
    instrumentSymbol: t.instrumentSymbol,
    direction: t.direction,
    setupGrade: t.setupGrade,
    session: t.session,
    strategyId: t.strategyId,
    strategyVersionId: t.strategyVersionId,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id: strategyId } = await params;
  const url = new URL(req.url);
  const v1Id = url.searchParams.get("v1");
  const v2Id = url.searchParams.get("v2");

  const strategy = await db.strategy.findFirst({
    where: { id: strategyId, userId: user.id },
    include: {
      versions: {
        orderBy: { effectiveDate: "asc" },
      },
    },
  });

  if (!strategy) return notFound("Strategy not found");

  if (!v1Id || !v2Id) {
    return bad("v1 and v2 version IDs are required in query params");
  }

  const v1 = strategy.versions.find((v) => v.id === v1Id);
  const v2 = strategy.versions.find((v) => v.id === v2Id);

  if (!v1 || !v2) {
    return notFound("One or both strategy versions not found");
  }

  // Fetch trades for each version
  const [v1TradesRaw, v2TradesRaw] = await Promise.all([
    db.trade.findMany({
      where: { userId: user.id, strategyId, strategyVersionId: v1.id, isArchived: false },
      orderBy: { entryTime: "asc" },
    }),
    db.trade.findMany({
      where: { userId: user.id, strategyId, strategyVersionId: v2.id, isArchived: false },
      orderBy: { entryTime: "asc" },
    }),
  ]);

  // Aggregate metrics using financial engine
  const v1Metrics = computeAggregateMetrics(v1TradesRaw.map(mapToTradeMetricRow), null);
  const v2Metrics = computeAggregateMetrics(v2TradesRaw.map(mapToTradeMetricRow), null);

  // Calculate average checklist adherence
  const calcAdherence = (trades: any[]) => {
    const scores = trades
      .map((t) => computeAdherencePct(t.planAdherenceJson))
      .filter((s): s is number => s !== null);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const v1Adherence = calcAdherence(v1TradesRaw);
  const v2Adherence = calcAdherence(v2TradesRaw);

  // Parse rules
  const v1Rules = parseChecklistRules(v1.rulesJson);
  const v2Rules = parseChecklistRules(v2.rulesJson);

  // Diff rules
  const v1Titles = new Set(v1Rules.map((r) => r.title.toLowerCase()));
  const v2Titles = new Set(v2Rules.map((r) => r.title.toLowerCase()));

  const addedRules = v2Rules.filter((r) => !v1Titles.has(r.title.toLowerCase()));
  const removedRules = v1Rules.filter((r) => !v2Titles.has(r.title.toLowerCase()));
  const unchangedRules = v2Rules.filter((r) => v1Titles.has(r.title.toLowerCase()));

  // Deltas (V2 minus V1)
  const v1WinRateNum = v1Metrics.winRate ? parseFloat(v1Metrics.winRate) * 100 : 0;
  const v2WinRateNum = v2Metrics.winRate ? parseFloat(v2Metrics.winRate) * 100 : 0;
  const deltaWinRate = +(v2WinRateNum - v1WinRateNum).toFixed(1);

  const deltaNetPnlCents = v2Metrics.netPnlCents - v1Metrics.netPnlCents;
  const v1Pf = v1Metrics.profitFactor ? parseFloat(v1Metrics.profitFactor) : 0;
  const v2Pf = v2Metrics.profitFactor ? parseFloat(v2Metrics.profitFactor) : 0;
  const deltaProfitFactor = +(v2Pf - v1Pf).toFixed(2);

  const v1AvgR = v1Metrics.avgR ? parseFloat(v1Metrics.avgR) : 0;
  const v2AvgR = v2Metrics.avgR ? parseFloat(v2Metrics.avgR) : 0;
  const deltaAvgR = +(v2AvgR - v1AvgR).toFixed(2);

  const deltaExpectancyCents = (v2Metrics.expectancyCents ?? 0) - (v1Metrics.expectancyCents ?? 0);
  const deltaAdherence = v1Adherence !== null && v2Adherence !== null ? v2Adherence - v1Adherence : null;

  return ok({
    strategy: {
      id: strategy.id,
      name: strategy.name,
      market: strategy.market,
    },
    version1: {
      id: v1.id,
      versionLabel: v1.versionLabel,
      effectiveDate: v1.effectiveDate,
      changeReason: v1.changeReason,
      changeSummary: v1.changeSummary,
      rules: v1Rules,
      metrics: v1Metrics,
      checklistAdherencePct: v1Adherence,
      isLowSample: v1TradesRaw.length < 20,
    },
    version2: {
      id: v2.id,
      versionLabel: v2.versionLabel,
      effectiveDate: v2.effectiveDate,
      changeReason: v2.changeReason,
      changeSummary: v2.changeSummary,
      rules: v2Rules,
      metrics: v2Metrics,
      checklistAdherencePct: v2Adherence,
      isLowSample: v2TradesRaw.length < 20,
    },
    ruleDiff: {
      added: addedRules,
      removed: removedRules,
      unchanged: unchangedRules,
    },
    deltas: {
      trades: v2Metrics.totalTrades - v1Metrics.totalTrades,
      netPnlCents: deltaNetPnlCents,
      winRatePct: deltaWinRate,
      profitFactor: deltaProfitFactor,
      avgR: deltaAvgR,
      expectancyCents: deltaExpectancyCents,
      checklistAdherencePct: deltaAdherence,
    },
  });
}

