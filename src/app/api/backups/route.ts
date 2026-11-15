import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { saveUpload, ensureStorage } from "@/lib/storage";
import { audit } from "@/lib/audit";

interface BackupData {
  schemaVersion?: string;
  appName?: string;
  exportedAt?: string;
  accounts?: any[];
  instruments?: any[];
  strategies?: any[];
  checklists?: any[];
  trades?: any[];
  tags?: any[];
  goals?: any[];
  noTrades?: any[];
  propChallenges?: any[];
  tasks?: any[];
  dictionary?: any[];
  userSettings?: any;
}

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }
  const items = await db.backup.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return ok({ items });
}

// Create backup (spec section 89 - complete entity coverage)
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }
  await ensureStorage();

  const [
    accounts,
    instruments,
    strategies,
    checklists,
    trades,
    tags,
    goals,
    noTrades,
    propChallenges,
    tasks,
    dictionary,
    userSettings,
  ] = await Promise.all([
    db.tradingAccount.findMany({ where: { userId: user.id } }),
    db.instrument.findMany({ where: { userId: user.id } }),
    db.strategy.findMany({
      where: { userId: user.id },
      include: { versions: true, experiments: true },
    }),
    db.checklistConfig.findMany({
      where: { userId: user.id },
      include: { versions: true },
    }),
    db.trade.findMany({
      where: { userId: user.id },
      include: {
        executions: true,
        targets: true,
        checklistEvaluations: true,
        media: { include: { annotations: true } },
      },
    }),
    db.tag.findMany({ where: { userId: user.id } }),
    db.goal.findMany({ where: { userId: user.id } }),
    db.noTradeEntry.findMany({ where: { userId: user.id } }),
    db.propChallenge.findMany({ where: { userId: user.id } }),
    db.tradingTask.findMany({ where: { userId: user.id } }),
    db.strategyDictionaryEntry.findMany({ where: { userId: user.id } }),
    db.userSettings.findUnique({ where: { userId: user.id } }),
  ]);

  const data: BackupData = {
    schemaVersion: "2.0",
    appName: "AlphaPips",
    exportedAt: new Date().toISOString(),
    accounts,
    instruments,
    strategies,
    checklists,
    trades,
    tags,
    goals,
    noTrades,
    propChallenges,
    tasks,
    dictionary,
    userSettings: userSettings || undefined,
  };

  const payload = JSON.stringify(data, null, 2);
  const buf = Buffer.from(payload, "utf-8");
  const filename = `alphapips-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const storedPath = await saveUpload(user.id, filename, buf, "backups");

  const counts = {
    accounts: accounts.length,
    instruments: instruments.length,
    strategies: strategies.length,
    checklists: checklists.length,
    trades: trades.length,
    noTrades: noTrades.length,
    propChallenges: propChallenges.length,
    tasks: tasks.length,
    dictionary: dictionary.length,
  };

  const backup = await db.backup.create({
    data: {
      userId: user.id,
      filename,
      storedPath,
      sizeBytes: buf.length,
      recordCountsJson: JSON.stringify(counts),
    },
  });

  await audit("backup.performed", "backup", backup.id, counts);
  return ok(backup);
}

// Restore (spec section 90 - atomic transaction with automatic pre-replace snapshot)
export async function PUT(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { backupId, payload: directPayload, mode, duplicateAction } = body;

  let data: BackupData;

  if (directPayload && typeof directPayload === "object") {
    data = directPayload;
  } else if (backupId) {
    const backup = await db.backup.findFirst({
      where: { id: backupId, userId: user.id },
    });
    if (!backup) return bad("Backup not found");
    const { readStored } = await import("@/lib/storage");
    const buf = await readStored(backup.storedPath);
    try {
      data = JSON.parse(buf.toString("utf-8"));
    } catch {
      return bad("Corrupted backup file");
    }
  } else {
    return bad("backupId or backup payload is required");
  }

  const restoreMode = mode === "replace" ? "replace" : "merge";
  const skipDuplicates = duplicateAction !== "import_as_new";

  // Pre-replace automatic safety snapshot
  if (restoreMode === "replace") {
    await ensureStorage();
    const [currAccounts, currStrategies, currTrades, currNoTrades, currPropChallenges] =
      await Promise.all([
        db.tradingAccount.findMany({ where: { userId: user.id } }),
        db.strategy.findMany({
          where: { userId: user.id },
          include: { versions: true },
        }),
        db.trade.findMany({
          where: { userId: user.id },
          include: { executions: true, targets: true },
        }),
        db.noTradeEntry.findMany({ where: { userId: user.id } }),
        db.propChallenge.findMany({ where: { userId: user.id } }),
      ]);

    const preSnapshotPayload = JSON.stringify({
      schemaVersion: "2.0",
      snapshotReason: "Pre-Restore Safety Snapshot",
      exportedAt: new Date().toISOString(),
      accounts: currAccounts,
      strategies: currStrategies,
      trades: currTrades,
      noTrades: currNoTrades,
      propChallenges: currPropChallenges,
    });
    const snapBuf = Buffer.from(preSnapshotPayload, "utf-8");
    const snapFilename = `pre-replace-snapshot-${Date.now()}.json`;
    const snapPath = await saveUpload(user.id, snapFilename, snapBuf, "backups");
    await db.backup.create({
      data: {
        userId: user.id,
        filename: snapFilename,
        storedPath: snapPath,
        sizeBytes: snapBuf.length,
        recordCountsJson: JSON.stringify({
          accounts: currAccounts.length,
          trades: currTrades.length,
          preRestoreSnapshot: true,
        }),
      },
    });
  }

  // Execute restore inside ACID transaction
  const result = await db.$transaction(
    async (tx) => {
      if (restoreMode === "replace") {
        // Safe cascade deletes for existing records
        await tx.reviewTradeLink.deleteMany({ where: { trade: { userId: user.id } } });
        await tx.tradeChecklistEvaluation.deleteMany({ where: { trade: { userId: user.id } } });
        await tx.mediaAnnotation.deleteMany({ where: { media: { userId: user.id } } });
        await tx.tradeMedia.deleteMany({ where: { userId: user.id } });
        await tx.tradeExecution.deleteMany({ where: { trade: { userId: user.id } } });
        await tx.tradeTarget.deleteMany({ where: { trade: { userId: user.id } } });
        await tx.trade.deleteMany({ where: { userId: user.id } });
        await tx.noTradeEntry.deleteMany({ where: { userId: user.id } });
        await tx.propChallenge.deleteMany({ where: { userId: user.id } });
        await tx.tradingTask.deleteMany({ where: { userId: user.id } });
        await tx.strategyDictionaryEntry.deleteMany({ where: { userId: user.id } });
        await tx.strategyExperiment.deleteMany({ where: { strategy: { userId: user.id } } });
        await tx.strategyVersion.deleteMany({ where: { strategy: { userId: user.id } } });
        await tx.strategy.deleteMany({ where: { userId: user.id } });
        await tx.checklistVersion.deleteMany({ where: { checklist: { userId: user.id } } });
        await tx.checklistConfig.deleteMany({ where: { userId: user.id } });
        await tx.tag.deleteMany({ where: { userId: user.id } });
        await tx.goal.deleteMany({ where: { userId: user.id } });
        await tx.instrument.deleteMany({ where: { userId: user.id } });
        await tx.tradingAccount.deleteMany({ where: { userId: user.id } });
      }

      // 1. Accounts
      const accountIdMap = new Map<string, string>();
      let restoredAccounts = 0;
      for (const a of data.accounts ?? []) {
        const newAcc = await tx.tradingAccount.create({
          data: {
            userId: user.id,
            name: a.name || "Restored Account",
            broker: a.broker ?? null,
            accountType: a.accountType ?? "live",
            currency: a.currency ?? "USD",
            startingBalanceCents: a.startingBalanceCents ?? 100000,
            currentBalanceCents: a.currentBalanceCents ?? a.startingBalanceCents ?? 100000,
            consistencyRate: a.consistencyRate ?? null,
            dailyLossLimitPct: a.dailyLossLimitPct ?? null,
            maxDrawdownPct: a.maxDrawdownPct ?? null,
            isDefault: a.isDefault ?? false,
          },
        });
        accountIdMap.set(a.id, newAcc.id);
        restoredAccounts++;
      }

      // Fallback default account if none exists
      let primaryAccountId = accountIdMap.values().next().value;
      if (!primaryAccountId) {
        const existingAcc = await tx.tradingAccount.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
        });
        if (existingAcc) {
          primaryAccountId = existingAcc.id;
        } else {
          const createdDefault = await tx.tradingAccount.create({
            data: {
              userId: user.id,
              name: "Primary Trading Account",
              broker: "Manual Journal",
              accountType: "live",
              currency: "USD",
              startingBalanceCents: 1000000,
              currentBalanceCents: 1000000,
              isDefault: true,
            },
          });
          primaryAccountId = createdDefault.id;
        }
      }

      // 2. Instruments
      const instrIdMap = new Map<string, string>();
      for (const i of data.instruments ?? []) {
        let existing = await tx.instrument.findFirst({
          where: { userId: user.id, symbol: i.symbol },
        });
        if (!existing) {
          existing = await tx.instrument.create({
            data: {
              userId: user.id,
              symbol: i.symbol,
              name: i.name,
              market: i.market || "forex",
              pipSize: i.pipSize || "0.0001",
              tickSize: i.tickSize || "0.0001",
              contractSize: i.contractSize || "1",
              pricePrecision: i.pricePrecision || 5,
              currency: i.currency || "USD",
            },
          });
        }
        instrIdMap.set(i.id, existing.id);
      }

      // 3. Tags
      for (const t of data.tags ?? []) {
        const existing = await tx.tag.findFirst({
          where: { userId: user.id, name: t.name },
        });
        if (!existing) {
          await tx.tag.create({
            data: {
              userId: user.id,
              name: t.name,
              color: t.color || "slate",
              archived: t.archived ?? false,
            },
          });
        }
      }

      // 4. Goals
      for (const g of data.goals ?? []) {
        await tx.goal.create({
          data: {
            userId: user.id,
            title: g.title,
            kind: g.kind || "process",
            target: g.target ?? null,
            status: g.status || "active",
          },
        });
      }

      // 5. Checklists
      const checklistIdMap = new Map<string, string>();
      const checklistVersionIdMap = new Map<string, string>();
      for (const c of data.checklists ?? []) {
        const nc = await tx.checklistConfig.create({
          data: {
            userId: user.id,
            name: c.name,
            description: c.description ?? null,
          },
        });
        checklistIdMap.set(c.id, nc.id);
        for (const cv of c.versions ?? []) {
          const ncv = await tx.checklistVersion.create({
            data: {
              checklistId: nc.id,
              versionLabel: cv.versionLabel,
              itemsJson: cv.itemsJson,
              gradingThresholdsJson: cv.gradingThresholdsJson ?? null,
              effectiveDate: new Date(cv.effectiveDate),
            },
          });
          checklistVersionIdMap.set(cv.id, ncv.id);
        }
      }

      // 6. Strategies
      const stratIdMap = new Map<string, string>();
      const stratVersionIdMap = new Map<string, string>();
      let restoredStrategies = 0;
      for (const s of data.strategies ?? []) {
        const ns = await tx.strategy.create({
          data: {
            userId: user.id,
            name: s.name,
            description: s.description ?? null,
            purpose: s.purpose ?? null,
            instruments: s.instruments ?? null,
            market: s.market ?? null,
            timeframe: s.timeframe ?? null,
            session: s.session ?? null,
            status: s.status || "active",
            isArchived: s.isArchived ?? false,
            checklistConfigId: s.checklistConfigId
              ? checklistIdMap.get(s.checklistConfigId) ?? null
              : null,
          },
        });
        stratIdMap.set(s.id, ns.id);
        restoredStrategies++;

        for (const v of s.versions ?? []) {
          const nv = await tx.strategyVersion.create({
            data: {
              strategyId: ns.id,
              versionLabel: v.versionLabel,
              changeReason: v.changeReason ?? null,
              changeSummary: v.changeSummary ?? null,
              expectedImpact: v.expectedImpact ?? null,
              rulesJson: v.rulesJson || "{}",
              checklistJson: v.checklistJson ?? null,
              effectiveDate: new Date(v.effectiveDate),
              status: v.status || "active",
            },
          });
          stratVersionIdMap.set(v.id, nv.id);
        }
      }

      // 7. Tasks
      let restoredTasks = 0;
      for (const tk of data.tasks ?? []) {
        await tx.tradingTask.create({
          data: {
            userId: user.id,
            title: tk.title,
            description: tk.description ?? null,
            notes: tk.notes ?? null,
            status: tk.status || "pending",
            priority: tk.priority || "medium",
            dueDate: tk.dueDate ?? null,
            dueTime: tk.dueTime ?? null,
            listName: tk.listName || "Inbox",
            category: tk.category ?? null,
            tagsJson: tk.tagsJson || "[]",
            isPinned: tk.isPinned ?? false,
            isArchived: tk.isArchived ?? false,
            subtasksJson: tk.subtasksJson || "[]",
            templateKind: tk.templateKind ?? null,
            templateDataJson: tk.templateDataJson ?? null,
            accountId: tk.accountId ? accountIdMap.get(tk.accountId) ?? null : null,
            instrumentSymbol: tk.instrumentSymbol ?? null,
            strategyId: tk.strategyId ? stratIdMap.get(tk.strategyId) ?? null : null,
          },
        });
        restoredTasks++;
      }

      // 8. Dictionary
      let restoredDictionary = 0;
      for (const d of data.dictionary ?? []) {
        await tx.strategyDictionaryEntry.create({
          data: {
            userId: user.id,
            strategyId: d.strategyId ? stratIdMap.get(d.strategyId) ?? null : null,
            term: d.term,
            abbreviation: d.abbreviation ?? null,
            category: d.category ?? null,
            definition: d.definition || "",
            practicalExplanation: d.practicalExplanation ?? null,
            exampleUsage: d.exampleUsage ?? null,
            relatedTermsJson: d.relatedTermsJson || "[]",
            tagsJson: d.tagsJson || "[]",
            isFavorite: d.isFavorite ?? false,
            diagramUrl: d.diagramUrl ?? null,
          },
        });
        restoredDictionary++;
      }

      // 9. Prop Challenges
      let restoredPropChallenges = 0;
      for (const pc of data.propChallenges ?? []) {
        const accId = pc.accountId ? accountIdMap.get(pc.accountId) || primaryAccountId : primaryAccountId;
        await tx.propChallenge.create({
          data: {
            userId: user.id,
            accountId: accId,
            name: pc.name,
            propFirm: pc.propFirm || "Prop Firm",
            stage: pc.stage || "phase1",
            status: pc.status || "active",
            startingBalanceCents: pc.startingBalanceCents,
            profitTargetCents: pc.profitTargetCents ?? null,
            dailyLossLimitCents: pc.dailyLossLimitCents ?? null,
            dailyLossLimitPct: pc.dailyLossLimitPct ?? null,
            maxDrawdownCents: pc.maxDrawdownCents ?? null,
            maxDrawdownPct: pc.maxDrawdownPct ?? null,
            drawdownType: pc.drawdownType || "static",
            trailingHighWaterMarkCents: pc.trailingHighWaterMarkCents ?? null,
            minTradingDays: pc.minTradingDays ?? 4,
            maxTradingDays: pc.maxTradingDays ?? null,
            resetTimezone: pc.resetTimezone || "America/New_York",
            resetHour: pc.resetHour ?? 17,
            startDate: pc.startDate ? new Date(pc.startDate) : new Date(),
            endDate: pc.endDate ? new Date(pc.endDate) : null,
            notes: pc.notes ?? null,
          },
        });
        restoredPropChallenges++;
      }

      // 10. No-Trade Observations
      let restoredNoTrades = 0;
      for (const nt of data.noTrades ?? []) {
        await tx.noTradeEntry.create({
          data: {
            userId: user.id,
            instrumentSymbol: nt.instrumentSymbol,
            instrumentId: nt.instrumentId ? instrIdMap.get(nt.instrumentId) ?? null : null,
            market: nt.market ?? null,
            accountId: nt.accountId ? accountIdMap.get(nt.accountId) ?? null : null,
            strategyId: nt.strategyId ? stratIdMap.get(nt.strategyId) ?? null : null,
            strategyVersionId: nt.strategyVersionId
              ? stratVersionIdMap.get(nt.strategyVersionId) ?? null
              : null,
            date: nt.date ? new Date(nt.date) : new Date(),
            time: nt.time ?? null,
            session: nt.session ?? null,
            timeframe: nt.timeframe ?? null,
            bias: nt.bias ?? null,
            title: nt.title ?? null,
            observation: nt.observation ?? null,
            priceLevels: nt.priceLevels ?? null,
            marketStructure: nt.marketStructure ?? null,
            liquidityConditions: nt.liquidityConditions ?? null,
            setupIdentified: nt.setupIdentified ?? null,
            expectedDirection: nt.expectedDirection ?? null,
            reasonCategory: nt.reasonCategory || "no_valid_setup",
            reasonNotes: nt.reasonNotes ?? null,
            conditionMissing: nt.conditionMissing ?? null,
            wouldHaveValidated: nt.wouldHaveValidated ?? null,
            invalidationReason: nt.invalidationReason ?? null,
            decisionType: nt.decisionType || "deliberate_avoidance",
            status: nt.status || "observing",
            psychologyNotes: nt.psychologyNotes ?? null,
            behaviorFlagsJson: nt.behaviorFlagsJson || "[]",
            tagsJson: nt.tagsJson || "[]",
            customFieldsJson: nt.customFieldsJson || "{}",
            followUpNotes: nt.followUpNotes ?? null,
            isArchived: nt.isArchived ?? false,
          },
        });
        restoredNoTrades++;
      }

      // 11. Existing trade signatures for duplicate detection
      const existingTradeSignatures = new Set<string>();
      if (restoreMode === "merge" && skipDuplicates) {
        const existingTrades = await tx.trade.findMany({
          where: { userId: user.id },
          select: {
            instrumentSymbol: true,
            direction: true,
            entryTime: true,
            entryPriceAvg: true,
            positionSize: true,
          },
        });
        for (const et of existingTrades) {
          if (et.entryTime) {
            const timeSec = Math.floor(new Date(et.entryTime).getTime() / 1000);
            existingTradeSignatures.add(
              `${et.instrumentSymbol.toUpperCase()}:${et.direction.toLowerCase()}:${timeSec}:${et.entryPriceAvg || ""}:${et.positionSize || ""}`
            );
          }
        }
      }

      // 12. Restore Trades
      let restoredTrades = 0;
      let skippedDuplicates = 0;

      for (const t of data.trades ?? []) {
        const accountId =
          (t.accountId && accountIdMap.get(t.accountId)) || primaryAccountId;
        if (!accountId) continue;

        if (restoreMode === "merge" && skipDuplicates && t.entryTime) {
          const tTimeSec = Math.floor(new Date(t.entryTime).getTime() / 1000);
          const sig = `${(t.instrumentSymbol || "").toUpperCase()}:${(t.direction || "").toLowerCase()}:${tTimeSec}:${t.entryPriceAvg || ""}:${t.positionSize || ""}`;
          if (existingTradeSignatures.has(sig)) {
            skippedDuplicates++;
            continue;
          }
        }

        await tx.trade.create({
          data: {
            userId: user.id,
            accountId,
            instrumentId: t.instrumentId ? instrIdMap.get(t.instrumentId) ?? null : null,
            instrumentSymbol: t.instrumentSymbol,
            market: t.market,
            direction: t.direction,
            status: t.status || "open",
            session: t.session,
            strategyId: t.strategyId ? stratIdMap.get(t.strategyId) ?? null : null,
            strategyVersionId: t.strategyVersionId
              ? stratVersionIdMap.get(t.strategyVersionId) ?? null
              : null,
            setupGrade: t.setupGrade,
            setupScore: t.setupScore,
            tagsJson: typeof t.tagsJson === "string" ? t.tagsJson : JSON.stringify(t.tagsJson || []),
            plannedEntryPrice: t.plannedEntryPrice,
            plannedStopPrice: t.plannedStopPrice,
            plannedTargetPrice: t.plannedTargetPrice,
            plannedRiskPct: t.plannedRiskPct,
            plannedRiskAmountCents: t.plannedRiskAmountCents,
            plannedRR: t.plannedRR,
            entryPriceAvg: t.entryPriceAvg,
            exitPriceAvg: t.exitPriceAvg,
            positionSize: t.positionSize,
            feesCents: t.feesCents ?? 0,
            commissionCents: t.commissionCents ?? 0,
            swapCents: t.swapCents ?? 0,
            slippageCents: t.slippageCents ?? 0,
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
            behaviorFlagsJson:
              typeof t.behaviorFlagsJson === "string"
                ? t.behaviorFlagsJson
                : JSON.stringify(t.behaviorFlagsJson || []),
            isDraft: t.isDraft ?? false,
            isArchived: t.isArchived ?? false,
            executions: {
              create: (t.executions ?? []).map((e: any) => ({
                kind: e.kind || "entry",
                seq: e.seq ?? 0,
                price: String(e.price),
                quantity: String(e.quantity),
                timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
                notes: e.notes ?? null,
              })),
            },
            targets: {
              create: (t.targets ?? []).map((tg: any) => ({
                label: tg.label || "TP",
                price: String(tg.price),
                quantityPct: String(tg.quantityPct || "1"),
              })),
            },
          },
        });
        restoredTrades++;
      }

      return {
        restoredAccounts,
        restoredStrategies,
        restoredTrades,
        restoredNoTrades,
        restoredPropChallenges,
        restoredTasks,
        restoredDictionary,
        skippedDuplicates,
      };
    },
    { timeout: 60000 }
  );

  await audit("restore.performed", "backup", backupId || "direct-payload", {
    mode: restoreMode,
    ...result,
  });

  return ok({
    success: true,
    mode: restoreMode,
    ...result,
  });
}
