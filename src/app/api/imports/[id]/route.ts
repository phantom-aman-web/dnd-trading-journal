import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { calculateTradeMetrics } from "@/lib/financial-engine";
import { resolveInstrumentForServer } from "@/lib/instrument-resolver";
import { audit } from "@/lib/audit";
import {
  normalizeCsvDecimal,
  parseCsvMoneyCents,
  parseCsvDateTime,
} from "@/lib/broker-csv-presets";
import { classifyDuplicateTrade } from "@/lib/import-parser";

// Get import preview and row statuses
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const importRecord = await db.import.findFirst({
    where: { id, userId: user.id },
    include: { rows: true },
  });
  if (!importRecord) return notFound("Import not found");
  return ok(importRecord);
}

// Apply mapping and validate rows (spec section 84, 86, 87)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const importRecord = await db.import.findFirst({ where: { id, userId: user.id }, include: { rows: true } });
  if (!importRecord) return notFound("Import not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");

  // Helper to resolve an account reliably
  async function resolveTargetAccount(requestedAccountId?: string) {
    if (requestedAccountId) {
      const specified = await db.tradingAccount.findFirst({ where: { id: requestedAccountId, userId: user.id } });
      if (specified) return specified;
    }
    const def = await db.tradingAccount.findFirst({ where: { userId: user.id, isDefault: true } });
    if (def) return def;
    const firstActive = await db.tradingAccount.findFirst({ where: { userId: user.id, isArchived: false }, orderBy: { createdAt: "asc" } });
    if (firstActive) return firstActive;
    const anyAcc = await db.tradingAccount.findFirst({ where: { userId: user.id } });
    if (anyAcc) return anyAcc;

    return await db.tradingAccount.create({
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
  }

  if (body.action === "map") {
    // Apply field mapping and validate
    const mapping: Record<string, string> = body.mapping ?? {};
    const account = await resolveTargetAccount(body.accountId);
    const brokerUtcOffset = typeof body.brokerUtcOffset === "number" ? body.brokerUtcOffset : undefined;

    // Load recent user trades for duplicate detection
    const existingTrades = await db.trade.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        instrumentSymbol: true,
        direction: true,
        entryPriceAvg: true,
        entryTime: true,
        netPnlCents: true,
        notes: true,
      },
      take: 2000,
      orderBy: { createdAt: "desc" },
    });

    const issues: string[] = [];
    let valid = 0, duplicates = 0, possibleDuplicates = 0, conflicts = 0;

    for (const row of importRecord.rows) {
      const raw = JSON.parse(row.rawJson);
      const mapped: Record<string, string> = {};
      for (const [csvCol, dndField] of Object.entries(mapping)) {
        if (raw[csvCol] != null) mapped[dndField] = String(raw[csvCol]).trim();
      }
      // Normalize decimal formats (handling European commas)
      if (mapped.entryPrice) mapped.entryPrice = normalizeCsvDecimal(mapped.entryPrice);
      if (mapped.exitPrice) mapped.exitPrice = normalizeCsvDecimal(mapped.exitPrice);
      if (mapped.stopPrice) mapped.stopPrice = normalizeCsvDecimal(mapped.stopPrice);
      if (mapped.targetPrice) mapped.targetPrice = normalizeCsvDecimal(mapped.targetPrice);
      if (mapped.quantity) mapped.quantity = normalizeCsvDecimal(mapped.quantity);

      // Extract broker ticket/order identifier
      const externalTicketId = mapped.externalTicketId || mapped.ticket || mapped.orderId || raw["Ticket"] || raw["Order ID"] || raw["Position Id"] || raw["Position ID"] || raw["Trade number"] || null;
      if (externalTicketId) mapped.externalTicketId = externalTicketId;

      // Basic validation
      const rowIssues: string[] = [];
      if (!mapped.instrumentSymbol) rowIssues.push("Missing instrument");
      if (!mapped.direction) rowIssues.push("Missing direction");
      if (!mapped.entryPrice || isNaN(parseFloat(mapped.entryPrice))) rowIssues.push("Missing or invalid entry price");

      // Advanced duplicate detection (exact, likely, conflict, new)
      const entryTime = parseCsvDateTime(mapped.entryTime, brokerUtcOffset);
      const dupCheck = classifyDuplicateTrade(
        {
          externalTicketId,
          instrumentSymbol: mapped.instrumentSymbol,
          direction: mapped.direction,
          entryPrice: mapped.entryPrice,
          entryTime,
        },
        existingTrades
      );

      let status: string;
      if (rowIssues.length > 0) {
        status = "invalid";
        issues.push(`Row ${row.rowIndex + 1}: ${rowIssues.join(", ")}`);
      } else if (dupCheck.status === "exact_duplicate") {
        status = "duplicate";
        duplicates++;
        rowIssues.push(dupCheck.reason || "Exact duplicate trade");
      } else if (dupCheck.status === "possible_duplicate") {
        status = "possible_duplicate";
        possibleDuplicates++;
        rowIssues.push(dupCheck.reason || "Likely duplicate trade");
      } else if (dupCheck.status === "conflict") {
        status = "conflict";
        conflicts++;
        rowIssues.push(dupCheck.reason || "Ticket ID conflict with differing parameters");
      } else {
        status = "valid";
        valid++;
      }

      await db.importRow.update({
        where: { id: row.id },
        data: { mappedJson: JSON.stringify(mapped), status, issues: rowIssues.join("; ") || null },
      });
    }

    await db.import.update({
      where: { id },
      data: {
        status: "validated",
        summaryJson: JSON.stringify({
          valid,
          invalid: issues.length,
          duplicates,
          possibleDuplicates,
          conflicts,
          issues: issues.slice(0, 20),
          accountId: account.id,
          brokerUtcOffset,
        }),
      },
    });
    return ok({ valid, invalid: issues.length, duplicates, possibleDuplicates, conflicts, issues: issues.slice(0, 20) });
  }

  // Quarantine correction: update individual row fields without re-uploading
  if (body.action === "updateRow") {
    const { rowId, updatedFields } = body;
    const row = await db.importRow.findFirst({ where: { id: rowId, importId: id } });
    if (!row) return notFound("Import row not found");

    const currentMapped = JSON.parse(row.mappedJson || "{}");
    const nextMapped = { ...currentMapped, ...updatedFields };

    const rowIssues: string[] = [];
    if (!nextMapped.instrumentSymbol) rowIssues.push("Missing instrument");
    if (!nextMapped.direction) rowIssues.push("Missing direction");
    if (!nextMapped.entryPrice || isNaN(parseFloat(nextMapped.entryPrice))) rowIssues.push("Missing or invalid entry price");

    const nextStatus = rowIssues.length > 0 ? "invalid" : "valid";
    await db.importRow.update({
      where: { id: rowId },
      data: {
        mappedJson: JSON.stringify(nextMapped),
        status: nextStatus,
        issues: rowIssues.join("; ") || null,
      },
    });
    return ok({ success: true, status: nextStatus, issues: rowIssues });
  }

  if (body.action === "confirm") {
    // Import only valid rows inside database transaction
    const targetAccount = await resolveTargetAccount(body.accountId);
    let configuredBrokerUtcOffset = typeof body.brokerUtcOffset === "number" ? body.brokerUtcOffset : undefined;
    if (configuredBrokerUtcOffset === undefined && importRecord.summaryJson) {
      try {
        const parsedSummary = JSON.parse(importRecord.summaryJson);
        if (typeof parsedSummary.brokerUtcOffset === "number") {
          configuredBrokerUtcOffset = parsedSummary.brokerUtcOffset;
        }
      } catch {}
    }
    const statusesToImport = body.includePossibleDuplicates === true ? ["valid", "possible_duplicate"] : ["valid"];
    const rows = await db.importRow.findMany({ where: { importId: id, status: { in: statusesToImport } } });

    const createdTradeIds: string[] = [];
    const imported = await db.$transaction(async (tx) => {
      let count = 0;
      for (const row of rows) {
        const mapped = JSON.parse(row.mappedJson ?? "{}");
        const resolved = await resolveInstrumentForServer(mapped.instrumentSymbol, user.id);
        let instr = await tx.instrument.findFirst({ where: { userId: user.id, symbol: resolved.def.symbol } });
        if (!instr) {
          instr = await tx.instrument.create({
            data: {
              userId: user.id,
              symbol: resolved.def.symbol,
              name: resolved.def.displayName,
              market: resolved.def.market,
              pipSize: resolved.def.pipSize,
              tickSize: resolved.def.tickSize,
              contractSize: resolved.def.contractSize,
              pricePrecision: resolved.def.pricePrecision,
            },
          });
        }

        const entryPrice = normalizeCsvDecimal(mapped.entryPrice) || "0";
        const exitPrice = mapped.exitPrice ? normalizeCsvDecimal(mapped.exitPrice) : null;
        const stopPrice = mapped.stopPrice ? normalizeCsvDecimal(mapped.stopPrice) : null;
        const targetPrice = mapped.targetPrice ? normalizeCsvDecimal(mapped.targetPrice) : null;
        const quantity = normalizeCsvDecimal(mapped.quantity) || "1";

        const feesCents = parseCsvMoneyCents(mapped.feesCents ?? mapped.fees ?? "0");
        const commissionCents = parseCsvMoneyCents(mapped.commissionCents ?? mapped.commission ?? "0");
        const swapCents = parseCsvMoneyCents(mapped.swapCents ?? mapped.swap ?? "0");
        const slippageCents = parseCsvMoneyCents(mapped.slippageCents ?? mapped.slippage ?? "0");

        const parsedEntryTime = parseCsvDateTime(mapped.entryTime, configuredBrokerUtcOffset);
        const parsedExitTime = parseCsvDateTime(mapped.exitTime, configuredBrokerUtcOffset);

        const calcInput: any = {
          direction: (mapped.direction ?? "long").toLowerCase().includes("short") ? "short" : "long",
          plannedEntryPrice: entryPrice,
          plannedStopPrice: stopPrice,
          plannedTargetPrice: targetPrice,
          fills: [
            { kind: "entry", price: entryPrice, quantity },
            ...(exitPrice ? [{ kind: "exit" as const, price: exitPrice, quantity }] : []),
          ],
          feesCents,
          commissionCents,
          swapCents,
          slippageCents,
          contractSize: resolved.def.contractSize,
          pipSize: resolved.def.pipSize,
          pointValueCents: resolved.def.pointValueCents,
        };
        const calc = calculateTradeMetrics(calcInput as any);

        let finalNetPnlCents = calc.netPnlNativeCents;
        let finalGrossPnlCents = calc.grossPnlNativeCents;
        if (mapped.netPnlCents || mapped.profit) {
          const brokerReportedNet = parseCsvMoneyCents(mapped.netPnlCents ?? mapped.profit);
          if (brokerReportedNet !== 0 || exitPrice) {
            finalNetPnlCents = brokerReportedNet;
            finalGrossPnlCents = brokerReportedNet + feesCents + commissionCents + swapCents;
          }
        }

        const externalTicketRef = mapped.externalTicketId ? `Broker Ticket #${mapped.externalTicketId}` : undefined;

        const newTrade = await tx.trade.create({
          data: {
            userId: user.id,
            accountId: targetAccount.id,
            instrumentId: instr.id,
            instrumentSymbol: instr.symbol,
            market: instr.market,
            direction: calcInput.direction,
            status: calc.status,
            session: mapped.session ?? null,
            setupGrade: mapped.setupGrade ?? null,
            plannedEntryPrice: calcInput.plannedEntryPrice,
            plannedStopPrice: calcInput.plannedStopPrice,
            plannedTargetPrice: calcInput.plannedTargetPrice,
            entryPriceAvg: calc.entryPriceAvg,
            exitPriceAvg: calc.exitPriceAvg,
            positionSize: quantity,
            feesCents: calcInput.feesCents ?? 0,
            commissionCents: calcInput.commissionCents ?? 0,
            swapCents: calcInput.swapCents ?? 0,
            grossPnlCents: finalGrossPnlCents,
            netPnlCents: finalNetPnlCents,
            actualR: calc.actualR,
            entryTime: parsedEntryTime,
            exitTime: parsedExitTime,
            notes: externalTicketRef,
            executions: {
              create: [
                {
                  kind: "entry",
                  price: String(entryPrice),
                  quantity: String(quantity),
                  timestamp: parsedEntryTime || new Date(),
                  notes: externalTicketRef,
                },
                ...(exitPrice ? [{
                  kind: "exit",
                  price: String(exitPrice),
                  quantity: String(quantity),
                  timestamp: parsedExitTime || new Date(),
                  notes: externalTicketRef,
                }] : []),
              ],
            },
          },
        });
        createdTradeIds.push(newTrade.id);
        await tx.importRow.update({ where: { id: row.id }, data: { status: "imported" } });
        count++;
      }
      return count;
    }, { timeout: 60000 });

    const reconciliation = {
      totalRows: importRecord.rows.length,
      imported,
      skippedExactDuplicates: importRecord.rows.filter((r) => r.status === "duplicate").length,
      skippedPossibleDuplicates: body.includePossibleDuplicates === true ? 0 : importRecord.rows.filter((r) => r.status === "possible_duplicate").length,
      rejectedInvalid: importRecord.rows.filter((r) => r.status === "invalid").length,
      conflicts: importRecord.rows.filter((r) => r.status === "conflict").length,
    };

    await db.import.update({
      where: { id },
      data: {
        status: "imported",
        summaryJson: JSON.stringify({
          imported,
          tradeIds: createdTradeIds,
          importedAt: new Date().toISOString(),
          reconciliation,
        }),
      },
    });
    await audit("import.completed", "import", id, { imported, tradeCount: createdTradeIds.length, reconciliation });
    return ok({ imported, tradeIds: createdTradeIds, reconciliation });
  }

  if (body.action === "rollback") {
    // Require explicit confirmation before executing batch rollback
    if (body.confirmed !== true) {
      return bad("Explicit confirmation is required to rollback an import batch.");
    }

    // Transactional, user-scoped rollback strictly restricted to verified records created by this batch
    let rolledBackCount = 0;
    let protectedCount = 0;
    if (importRecord.summaryJson) {
      try {
        const summary = JSON.parse(importRecord.summaryJson);
        if (Array.isArray(summary.tradeIds) && summary.tradeIds.length > 0) {
          // Identify candidates strictly belonging to this user and batch
          const candidateTrades = await db.trade.findMany({
            where: { id: { in: summary.tradeIds }, userId: user.id },
            select: { id: true, notes: true, lessons: true, strategyId: true, thesisJson: true, setupJson: true },
          });

          const tradesToDelete: string[] = [];
          for (const t of candidateTrades) {
            // Protect subsequently modified or linked trades unless user explicitly opted to include them
            const isModified = Boolean(t.notes || t.lessons || t.strategyId || t.thesisJson || t.setupJson);
            if (isModified && body.protectModified !== false) {
              protectedCount++;
            } else {
              tradesToDelete.push(t.id);
            }
          }

          if (tradesToDelete.length > 0) {
            await db.$transaction(async (tx) => {
              const delRes = await tx.trade.deleteMany({
                where: { id: { in: tradesToDelete }, userId: user.id },
              });
              rolledBackCount = delRes.count;
              await tx.import.update({
                where: { id },
                data: {
                  status: tradesToDelete.length === candidateTrades.length ? "rolled_back" : "partially_rolled_back",
                  summaryJson: JSON.stringify({
                    ...summary,
                    rolledBackCount,
                    protectedCount,
                    rolledBackAt: new Date().toISOString(),
                    remainingTradeIds: summary.tradeIds.filter((tid: string) => !tradesToDelete.includes(tid)),
                  }),
                },
              });
            });
          } else {
            // All candidates were protected
            await db.import.update({
              where: { id },
              data: {
                summaryJson: JSON.stringify({
                  ...summary,
                  rolledBackCount: 0,
                  protectedCount,
                  rolledBackAt: new Date().toISOString(),
                }),
              },
            });
          }
        }
      } catch (err) {
        console.error("Rollback error:", err);
      }
    }
    await audit("import.rolled_back", "import", id, { rolledBackCount, protectedCount });
    return ok({ ok: true, rolledBackCount, protectedCount });
  }

  return bad("Unknown action");
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const importRecord = await db.import.findFirst({ where: { id, userId: user.id } });
  if (!importRecord) return notFound("Import not found");

  // Rollback records created by this batch transactionally before deleting the import metadata
  let rolledBackCount = 0;
  let protectedCount = 0;
  if (importRecord.summaryJson) {
    try {
      const summary = JSON.parse(importRecord.summaryJson);
      if (Array.isArray(summary.tradeIds) && summary.tradeIds.length > 0) {
        const candidateTrades = await db.trade.findMany({
          where: { id: { in: summary.tradeIds }, userId: user.id },
          select: { id: true, notes: true, lessons: true, strategyId: true, thesisJson: true, setupJson: true },
        });
        const tradesToDelete = candidateTrades
          .filter((t) => !(t.notes || t.lessons || t.strategyId || t.thesisJson || t.setupJson))
          .map((t) => t.id);
        protectedCount = candidateTrades.length - tradesToDelete.length;

        await db.$transaction(async (tx) => {
          if (tradesToDelete.length > 0) {
            const delRes = await tx.trade.deleteMany({
              where: { id: { in: tradesToDelete }, userId: user.id },
            });
            rolledBackCount = delRes.count;
          }
          await tx.import.delete({ where: { id } });
        });
      } else {
        await db.import.delete({ where: { id } });
      }
    } catch {
      await db.import.delete({ where: { id } });
    }
  } else {
    await db.import.delete({ where: { id } });
  }

  await audit("import.deleted", "import", id, { rolledBackCount, protectedCount });
  return ok({ ok: true, rolledBackCount, protectedCount });
}
