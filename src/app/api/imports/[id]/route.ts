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

    const issues: string[] = [];
    let valid = 0, duplicates = 0;

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

      // Basic validation
      const rowIssues: string[] = [];
      if (!mapped.instrumentSymbol) rowIssues.push("Missing instrument");
      if (!mapped.direction) rowIssues.push("Missing direction");
      if (!mapped.entryPrice || isNaN(parseFloat(mapped.entryPrice))) rowIssues.push("Missing or invalid entry price");

      // Duplicate detection (spec section 87)
      const entryTime = parseCsvDateTime(mapped.entryTime, brokerUtcOffset);
      let isDup = false;
      if (entryTime && !isNaN(entryTime.getTime()) && mapped.instrumentSymbol) {
        const existing = await db.trade.findFirst({
          where: {
            userId: user.id,
            instrumentSymbol: mapped.instrumentSymbol,
            entryTime: { gte: new Date(entryTime.getTime() - 60_000), lte: new Date(entryTime.getTime() + 60_000) },
          },
        });
        if (existing) isDup = true;
      }
      let status: string;
      if (isDup) { status = "duplicate"; duplicates++; }
      else if (rowIssues.length > 0) { status = "invalid"; issues.push(`Row ${row.rowIndex + 1}: ${rowIssues.join(", ")}`); }
      else { status = "valid"; valid++; }

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
          issues: issues.slice(0, 20),
          accountId: account.id,
          brokerUtcOffset,
        }),
      },
    });
    return ok({ valid, invalid: issues.length, duplicates, issues: issues.slice(0, 20) });
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
    const rows = await db.importRow.findMany({ where: { importId: id, status: "valid" } });

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

        await tx.trade.create({
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
            executions: {
              create: [
                {
                  kind: "entry",
                  price: String(entryPrice),
                  quantity: String(quantity),
                  timestamp: parsedEntryTime || new Date(),
                },
                ...(exitPrice ? [{
                  kind: "exit",
                  price: String(exitPrice),
                  quantity: String(quantity),
                  timestamp: parsedExitTime || new Date(),
                }] : []),
              ],
            },
          },
        });
        await tx.importRow.update({ where: { id: row.id }, data: { status: "imported" } });
        count++;
      }
      return count;
    }, { timeout: 60000 });

    await db.import.update({ where: { id }, data: { status: "imported", summaryJson: JSON.stringify({ imported }) } });
    await audit("import.completed", "import", id, { imported });
    return ok({ imported });
  }
  return bad("Unknown action");
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const importRecord = await db.import.findFirst({ where: { id, userId: user.id } });
  if (!importRecord) return notFound("Import not found");
  await db.import.delete({ where: { id } });
  return ok({ ok: true });
}
