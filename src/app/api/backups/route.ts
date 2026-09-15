import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { saveUpload, ensureStorage } from "@/lib/storage";
import { audit } from "@/lib/audit";

interface BackupData {
  accounts: any[];
  instruments: any[];
  strategies: any[];
  checklists: any[];
  trades: any[];
  reviews: any[];
  actionItems: any[];
  tags: any[];
  goals: any[];
  dailyPlans: any[];
}

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const items = await db.backup.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return ok({ items });
}

// Create backup (spec section 89)
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  await ensureStorage();

  const [accounts, instruments, strategies, checklists, trades, reviews, actionItems, tags, goals, dailyPlans] = await Promise.all([
    db.tradingAccount.findMany({ where: { userId: user.id } }),
    db.instrument.findMany({ where: { userId: user.id } }),
    db.strategy.findMany({ where: { userId: user.id }, include: { versions: true, experiments: true } }),
    db.checklistConfig.findMany({ where: { userId: user.id }, include: { versions: true } }),
    db.trade.findMany({ where: { userId: user.id }, include: { executions: true, media: true } }),
    db.review.findMany({ where: { userId: user.id } }),
    db.actionItem.findMany({ where: { userId: user.id } }),
    db.tag.findMany({ where: { userId: user.id } }),
    db.goal.findMany({ where: { userId: user.id } }),
    db.dailyPlan.findMany({ where: { userId: user.id } }),
  ]);

  const data: BackupData = {
    accounts, instruments, strategies, checklists, trades, reviews, actionItems, tags, goals, dailyPlans,
  };
  const payload = JSON.stringify(data, null, 2);
  const buf = Buffer.from(payload, "utf-8");
  const filename = `dnd-backup-${new Date().toISOString().slice(0,10)}.json`;
  const storedPath = await saveUpload(user.id, filename, buf, "backups");

  const backup = await db.backup.create({
    data: {
      userId: user.id,
      filename,
      storedPath,
      sizeBytes: buf.length,
      recordCountsJson: JSON.stringify({
        accounts: accounts.length,
        instruments: instruments.length,
        strategies: strategies.length,
        trades: trades.length,
        reviews: reviews.length,
      }),
    },
  });
  await audit("backup.performed", "backup", backup.id);
  return ok(backup);
}

// Restore (spec section 90)
export async function PUT(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { backupId, mode } = body;
  if (!backupId) return bad("backupId is required");
  const restoreMode = mode ?? "merge"; // merge | replace

  const backup = await db.backup.findFirst({ where: { id: backupId, userId: user.id } });
  if (!backup) return bad("Backup not found");

  const { readStored } = await import("@/lib/storage");
  const buf = await readStored(backup.storedPath);
  const data: BackupData = JSON.parse(buf.toString("utf-8"));

  if (restoreMode === "replace") {
    // Delete existing user data (careful)
    await db.trade.deleteMany({ where: { userId: user.id } });
    await db.review.deleteMany({ where: { userId: user.id } });
    await db.actionItem.deleteMany({ where: { userId: user.id } });
    await db.dailyPlan.deleteMany({ where: { userId: user.id } });
    await db.strategy.deleteMany({ where: { userId: user.id } });
    await db.checklistConfig.deleteMany({ where: { userId: user.id } });
    await db.tag.deleteMany({ where: { userId: user.id } });
    await db.goal.deleteMany({ where: { userId: user.id } });
    await db.instrument.deleteMany({ where: { userId: user.id } });
    await db.tradingAccount.deleteMany({ where: { userId: user.id } });
  }

  // Restore accounts
  const accountIdMap = new Map<string, string>();
  for (const a of data.accounts ?? []) {
    const newAcc = await db.tradingAccount.create({
      data: {
        userId: user.id,
        name: a.name,
        broker: a.broker,
        accountType: a.accountType,
        currency: a.currency,
        startingBalanceCents: a.startingBalanceCents,
        currentBalanceCents: a.currentBalanceCents,
        isDefault: a.isDefault,
      },
    });
    accountIdMap.set(a.id, newAcc.id);
  }

  // Restore instruments
  const instrIdMap = new Map<string, string>();
  for (const i of data.instruments ?? []) {
    const ni = await db.instrument.create({
      data: {
        userId: user.id,
        symbol: i.symbol,
        name: i.name,
        market: i.market,
        pipSize: i.pipSize,
        tickSize: i.tickSize,
        contractSize: i.contractSize,
        pricePrecision: i.pricePrecision,
        currency: i.currency,
      },
    });
    instrIdMap.set(i.id, ni.id);
  }

  // Restore tags
  const tagIdMap = new Map<string, string>();
  for (const t of data.tags ?? []) {
    const nt = await db.tag.create({
      data: { userId: user.id, name: t.name, color: t.color, archived: t.archived },
    });
    tagIdMap.set(t.id, nt.id);
  }

  // Restore strategies
  const stratIdMap = new Map<string, string>();
  const stratVersionIdMap = new Map<string, string>();
  for (const s of data.strategies ?? []) {
    const ns = await db.strategy.create({
      data: {
        userId: user.id,
        name: s.name,
        description: s.description,
        purpose: s.purpose,
        instruments: s.instruments,
        market: s.market,
        timeframe: s.timeframe,
        session: s.session,
        status: s.status,
      },
    });
    stratIdMap.set(s.id, ns.id);
    for (const v of s.versions ?? []) {
      const nv = await db.strategyVersion.create({
        data: {
          strategyId: ns.id,
          versionLabel: v.versionLabel,
          changeReason: v.changeReason,
          changeSummary: v.changeSummary,
          expectedImpact: v.expectedImpact,
          rulesJson: v.rulesJson,
          checklistJson: v.checklistJson,
          effectiveDate: new Date(v.effectiveDate),
          status: v.status,
        },
      });
      stratVersionIdMap.set(v.id, nv.id);
    }
  }

  // Restore trades (best-effort, skip if references missing)
  let restoredTrades = 0;
  for (const t of data.trades ?? []) {
    const accountId = accountIdMap.get(t.accountId);
    if (!accountId) continue;
    const nt = await db.trade.create({
      data: {
        userId: user.id,
        accountId,
        instrumentId: t.instrumentId ? instrIdMap.get(t.instrumentId) ?? null : null,
        instrumentSymbol: t.instrumentSymbol,
        market: t.market,
        direction: t.direction,
        status: t.status,
        session: t.session,
        strategyId: t.strategyId ? stratIdMap.get(t.strategyId) ?? null : null,
        strategyVersionId: t.strategyVersionId ? stratVersionIdMap.get(t.strategyVersionId) ?? null : null,
        setupGrade: t.setupGrade,
        setupScore: t.setupScore,
        tagsJson: t.tagsJson ?? "[]",
        plannedEntryPrice: t.plannedEntryPrice,
        plannedStopPrice: t.plannedStopPrice,
        plannedTargetPrice: t.plannedTargetPrice,
        plannedRiskPct: t.plannedRiskPct,
        entryPriceAvg: t.entryPriceAvg,
        exitPriceAvg: t.exitPriceAvg,
        positionSize: t.positionSize,
        feesCents: t.feesCents ?? 0,
        commissionCents: t.commissionCents ?? 0,
        swapCents: t.swapCents ?? 0,
        grossPnlCents: t.grossPnlCents ?? 0,
        netPnlCents: t.netPnlCents ?? 0,
        actualR: t.actualR,
        entryTime: t.entryTime ? new Date(t.entryTime) : null,
        exitTime: t.exitTime ? new Date(t.exitTime) : null,
        setupJson: t.setupJson,
        thesisJson: t.thesisJson,
        notes: t.notes,
        lessons: t.lessons,
        psychBeforeJson: t.psychBeforeJson,
        psychAfterJson: t.psychAfterJson,
        behaviorFlagsJson: t.behaviorFlagsJson ?? "[]",
        isDraft: t.isDraft ?? false,
        executions: {
          create: (t.executions ?? []).map((e: any) => ({
            kind: e.kind,
            seq: e.seq,
            price: e.price,
            quantity: e.quantity,
            timestamp: new Date(e.timestamp),
            notes: e.notes,
          })),
        },
      },
    });
    restoredTrades++;
  }

  await audit("restore.performed", "backup", backup.id, { mode: restoreMode, restoredTrades });
  return ok({ restoredTrades, mode: restoreMode });
}
