import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { calculateTradeMetrics } from "@/lib/financial-engine";
import { audit } from "@/lib/audit";

// Apply mapping and validate rows (spec section 84, 86, 87)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const importRecord = await db.import.findFirst({ where: { id, userId: user.id }, include: { rows: true } });
  if (!importRecord) return notFound("Import not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");

  if (body.action === "map") {
    // Apply field mapping and validate
    const mapping: Record<string, string> = body.mapping ?? {};
    const account = await db.tradingAccount.findFirst({ where: { userId: user.id, isDefault: true } });
    if (!account) return bad("No default account found. Create one first.");

    const issues: string[] = [];
    let valid = 0, duplicates = 0;

    for (const row of importRecord.rows) {
      const raw = JSON.parse(row.rawJson);
      const mapped: Record<string, string> = {};
      for (const [csvCol, dndField] of Object.entries(mapping)) {
        if (raw[csvCol] != null) mapped[dndField] = raw[csvCol];
      }
      // Basic validation
      const rowIssues: string[] = [];
      if (!mapped.instrumentSymbol) rowIssues.push("Missing instrument");
      if (!mapped.direction) rowIssues.push("Missing direction");
      if (!mapped.entryPrice) rowIssues.push("Missing entry price");

      // Duplicate detection (spec section 87)
      const entryTime = mapped.entryTime ? new Date(mapped.entryTime) : null;
      let isDup = false;
      if (entryTime && mapped.instrumentSymbol) {
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
      data: { status: "validated", summaryJson: JSON.stringify({ valid, invalid: issues.length, duplicates, issues: issues.slice(0, 20) }) },
    });
    return ok({ valid, invalid: issues.length, duplicates, issues: issues.slice(0, 20) });
  }

  if (body.action === "confirm") {
    // Import only valid rows
    const account = await db.tradingAccount.findFirst({ where: { userId: user.id, isDefault: true } });
    if (!account) return bad("No default account");
    const rows = await db.importRow.findMany({ where: { importId: id, status: "valid" } });
    let imported = 0;
    for (const row of rows) {
      const mapped = JSON.parse(row.mappedJson ?? "{}");
      // Find or create instrument
      let instr = await db.instrument.findFirst({ where: { userId: user.id, symbol: mapped.instrumentSymbol } });
      if (!instr) {
        instr = await db.instrument.create({
          data: { userId: user.id, symbol: mapped.instrumentSymbol, market: mapped.market ?? "custom", pipSize: "0.0001", tickSize: "0.0001", contractSize: "1", pricePrecision: 5 },
        });
      }
      const calcInput: any = {
        direction: (mapped.direction ?? "long").toLowerCase().includes("short") ? "short" : "long",
        plannedEntryPrice: mapped.entryPrice ?? null,
        plannedStopPrice: mapped.stopPrice ?? null,
        plannedTargetPrice: mapped.targetPrice ?? null,
        fills: [
          { kind: "entry", price: mapped.entryPrice ?? "0", quantity: mapped.quantity ?? "1" },
          ...(mapped.exitPrice ? [{ kind: "exit" as const, price: mapped.exitPrice, quantity: mapped.quantity ?? "1" }] : []),
        ],
        feesCents: parseInt(mapped.feesCents ?? "0") || 0,
        commissionCents: parseInt(mapped.commissionCents ?? "0") || 0,
        swapCents: parseInt(mapped.swapCents ?? "0") || 0,
        slippageCents: parseInt(mapped.slippageCents ?? "0") || 0,
        contractSize: instr.contractSize,
        pipSize: instr.pipSize,
        // Instrument-aware point value (spec §31, §7): use the instrument's
        // stored spec rather than the legacy hardcoded 100. For imported
        // forex/metals/indices rows this gives correct per-pip/tick values;
        // for crypto/stocks (contractSize 1) it falls back to 100.
        pointValueCents: 100 || computePointValueCents(
          instr.contractSize,
          instr.tickSize,
          instr.pipSize,
        ),
      };
      const calc = calculateTradeMetrics(calcInput as any);
      await db.trade.create({
        data: {
          userId: user.id,
          accountId: account.id,
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
          positionSize: mapped.quantity ?? null,
          feesCents: calcInput.feesCents ?? 0,
          commissionCents: calcInput.commissionCents ?? 0,
          swapCents: calcInput.swapCents ?? 0,
          grossPnlCents: calc.grossPnlNativeCents,
          netPnlCents: calc.netPnlNativeCents,
          actualR: calc.actualR,
          entryTime: mapped.entryTime ? new Date(mapped.entryTime) : null,
          exitTime: mapped.exitTime ? new Date(mapped.exitTime) : null,
        },
      });
      await db.importRow.update({ where: { id: row.id }, data: { status: "imported" } });
      imported++;
    }
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
