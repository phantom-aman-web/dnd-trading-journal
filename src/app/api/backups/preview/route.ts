import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON request");

  let data = body.payload;

  if (!data && body.backupId) {
    const backup = await db.backup.findFirst({
      where: { id: body.backupId, userId: user.id },
    });
    if (!backup) return bad("Backup not found");
    const { readStored } = await import("@/lib/storage");
    const buf = await readStored(backup.storedPath);
    try {
      data = JSON.parse(buf.toString("utf-8"));
    } catch {
      return bad("Stored backup file is corrupted or unreadable");
    }
  }

  if (!data || typeof data !== "object") {
    return bad("Missing or invalid backup archive data");
  }

  // Schema verification
  const schemaVersion = data.schemaVersion || "1.0";
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const instruments = Array.isArray(data.instruments) ? data.instruments : [];
  const strategies = Array.isArray(data.strategies) ? data.strategies : [];
  const checklists = Array.isArray(data.checklists) ? data.checklists : [];
  const trades = Array.isArray(data.trades) ? data.trades : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const goals = Array.isArray(data.goals) ? data.goals : [];
  const noTrades = Array.isArray(data.noTrades) ? data.noTrades : [];
  const propChallenges = Array.isArray(data.propChallenges) ? data.propChallenges : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const dictionary = Array.isArray(data.dictionary) ? data.dictionary : [];

  const totalEntities =
    accounts.length +
    strategies.length +
    trades.length +
    noTrades.length +
    propChallenges.length +
    tasks.length +
    dictionary.length;

  if (totalEntities === 0) {
    return bad("Backup archive contains no recoverable trading entities.");
  }

  // Duplicate analysis against existing user trades
  const existingTrades = await db.trade.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      accountId: true,
      instrumentSymbol: true,
      direction: true,
      entryTime: true,
      entryPriceAvg: true,
      positionSize: true,
      account: { select: { id: true, name: true } },
    },
  });

  // Account name set for fuzzy matching accounts
  const existingAccountNames = new Map<string, string>();
  for (const et of existingTrades) {
    if (et.account) {
      existingAccountNames.set(et.account.name.toLowerCase(), et.account.id);
    }
  }

  let exactDuplicatesCount = 0;
  let likelyDuplicatesCount = 0;
  let possibleDuplicatesCount = 0;
  const duplicateSamples: Array<{
    symbol: string;
    direction: string;
    entryTime: string | null;
    confidence: number;
    matchReason: string;
  }> = [];

  for (const t of trades) {
    if (!t.entryTime || !t.instrumentSymbol) continue;
    const tTime = new Date(t.entryTime).getTime();
    if (isNaN(tTime)) continue;

    let matched = false;

    for (const et of existingTrades) {
      if (!et.entryTime) continue;
      const etTime = new Date(et.entryTime).getTime();
      const timeDiffMs = Math.abs(tTime - etTime);

      const symbolMatch =
        (t.instrumentSymbol || "").toUpperCase() === (et.instrumentSymbol || "").toUpperCase();
      const directionMatch =
        (t.direction || "").toLowerCase() === (et.direction || "").toLowerCase();

      if (!symbolMatch || !directionMatch) continue;

      const priceMatch =
        t.entryPriceAvg && et.entryPriceAvg
          ? Math.abs(parseFloat(t.entryPriceAvg) - parseFloat(et.entryPriceAvg)) < 0.0001
          : false;

      const sizeMatch =
        t.positionSize && et.positionSize
          ? Math.abs(parseFloat(t.positionSize) - parseFloat(et.positionSize)) < 0.0001
          : false;

      // 100% exact duplicate: same symbol, direction, entryTime within 5s, price & size match
      if (timeDiffMs <= 5000 && priceMatch && sizeMatch) {
        exactDuplicatesCount++;
        matched = true;
        if (duplicateSamples.length < 5) {
          duplicateSamples.push({
            symbol: t.instrumentSymbol,
            direction: t.direction,
            entryTime: t.entryTime,
            confidence: 100,
            matchReason: "Exact match on symbol, direction, timestamp, price, and position size",
          });
        }
        break;
      }

      // 85% likely duplicate: same symbol, direction, time within 60s, price or size match
      if (timeDiffMs <= 60000 && (priceMatch || sizeMatch)) {
        likelyDuplicatesCount++;
        matched = true;
        if (duplicateSamples.length < 5) {
          duplicateSamples.push({
            symbol: t.instrumentSymbol,
            direction: t.direction,
            entryTime: t.entryTime,
            confidence: 85,
            matchReason: "Likely match on symbol, direction, 60s window, and identical price/size",
          });
        }
        break;
      }

      // 60% possible duplicate: same symbol, direction within 5 minutes
      if (timeDiffMs <= 300000) {
        possibleDuplicatesCount++;
        matched = true;
        if (duplicateSamples.length < 5) {
          duplicateSamples.push({
            symbol: t.instrumentSymbol,
            direction: t.direction,
            entryTime: t.entryTime,
            confidence: 60,
            matchReason: "Close timing match on same symbol and direction (within 5 minutes)",
          });
        }
        break;
      }
    }
  }

  const cleanTradesCount = Math.max(
    0,
    trades.length - exactDuplicatesCount - likelyDuplicatesCount,
  );

  // Unresolved foreign keys check
  const backupAccountIds = new Set(accounts.map((a: any) => a.id));
  const unresolvedAccountRefs: string[] = [];
  for (const t of trades) {
    if (t.accountId && !backupAccountIds.has(t.accountId)) {
      if (!unresolvedAccountRefs.includes(t.accountId)) {
        unresolvedAccountRefs.push(t.accountId);
      }
    }
  }

  return ok({
    valid: true,
    schemaVersion,
    exportedAt: data.exportedAt || null,
    appName: data.appName || "AlphaPips",
    counts: {
      accounts: accounts.length,
      instruments: instruments.length,
      strategies: strategies.length,
      checklists: checklists.length,
      trades: trades.length,
      noTrades: noTrades.length,
      propChallenges: propChallenges.length,
      tasks: tasks.length,
      dictionary: dictionary.length,
      tags: tags.length,
      goals: goals.length,
    },
    duplicateAnalysis: {
      exactDuplicatesCount,
      likelyDuplicatesCount,
      possibleDuplicatesCount,
      cleanTradesCount,
      samples: duplicateSamples,
    },
    unresolvedReferences: {
      missingAccountIds: unresolvedAccountRefs,
      note:
        unresolvedAccountRefs.length > 0
          ? `${unresolvedAccountRefs.length} trade(s) reference accounts not in the backup archive. They will be linked to your primary account during restore.`
          : null,
    },
    safetySummary: {
      transactional: true,
      atomicityNotice:
        "All mutations execute in an ACID database transaction. Any error triggers an immediate 100% rollback without partial state.",
      mergeBehavior:
        "Merge mode: Exactly matched trades (100% confidence) are skipped idempotently. New trades and non-duplicate entities are safely appended.",
      replaceBehavior:
        "Replace mode: Automatically creates an encrypted pre-restore safety snapshot before safely overwriting data.",
    },
  });
}
