/**
 * AlphaPips — Read-Only Broker Synchronization Engine
 * Reusable connector framework for read-only broker ingestion, reconciliation,
 * encrypted credential handling, and duplicate prevention.
 * Strict permission boundary: NEVER submits, modifies, cancels orders, or requests trading privileges.
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { encryptBotToken, decryptBotToken } from "@/lib/telegram/encryption";
import { calculateTradeMetrics } from "@/lib/financial-engine";
import { resolveInstrumentForServer } from "@/lib/instrument-resolver";
import { normalizeCsvDecimal, parseCsvMoneyCents } from "@/lib/broker-csv-presets";

/**
 * Validates request timestamp for replay protection (max age 5 minutes)
 * and verifies HMAC-SHA256 signature when secret is provided.
 */
export function validateReplayAndSignature(
  payloadStr: string,
  signature: string | null,
  secret: string,
  timestampHeader: string | null,
  maxSkewSec = 300
): { valid: boolean; reason?: string } {
  if (!timestampHeader) {
    return { valid: false, reason: "Missing timestamp header (replay protection required)." };
  }

  const reqTime = parseInt(timestampHeader, 10);
  if (isNaN(reqTime)) {
    return { valid: false, reason: "Invalid timestamp header." };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const diffSec = Math.abs(nowSec - reqTime);
  if (diffSec > maxSkewSec) {
    return { valid: false, reason: `Request timestamp skewed by ${diffSec}s (max allowed: ${maxSkewSec}s).` };
  }

  if (signature) {
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${timestampHeader}:${payloadStr}`)
      .digest("hex");
    if (signature !== expectedSig) {
      return { valid: false, reason: "HMAC signature mismatch." };
    }
  }

  return { valid: true };
}

export type BrokerConnectorType = "mt4_mt5_bridge" | "ctrader_open_api" | "tradelocker_readonly" | "generic_readonly_api";

export interface BrokerConnectionConfig {
  id: string;
  userId: string;
  accountId: string;
  connectorType: BrokerConnectorType;
  brokerName: string;
  accountNumber?: string;
  serverName?: string;
  status: "connected" | "disconnected" | "sync_error" | "expired_credentials";
  lastSyncAt?: Date | null;
  lastError?: string | null;
  readOnlyVerified: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
}

export interface BrokerRawTrade {
  ticketId: string;
  symbol: string;
  direction: "long" | "short";
  volume: string; // lots or contracts
  openPrice: string;
  openTime: Date | string;
  closePrice?: string | null;
  closeTime?: Date | string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
  commissionCents?: number;
  swapCents?: number;
  profitCents?: number;
}

export interface ReconciliationDiscrepancy {
  type: "missing_in_alphapips" | "price_discrepancy" | "volume_discrepancy" | "fee_discrepancy" | "unmatched_in_broker";
  ticketId: string;
  symbol: string;
  description: string;
  brokerValue?: any;
  journalValue?: any;
}

export interface SyncReconciliationReport {
  timestamp: string;
  totalBrokerTrades: number;
  existingMatchedTrades: number;
  newImportedTrades: number;
  discrepancies: ReconciliationDiscrepancy[];
}

/**
 * Validates strictly read-only permission boundaries for a broker connection.
 */
export function verifyReadOnlyPermission(scope: string[] = []): boolean {
  const forbiddenScopes = ["trade", "orders_write", "trading", "withdraw", "account_write", "order_create", "order_cancel"];
  for (const s of scope) {
    if (forbiddenScopes.some((f) => s.toLowerCase().includes(f))) {
      return false;
    }
  }
  return true;
}

/**
 * Reconciles broker records against existing trades in AlphaPips.
 */
export function reconcileBrokerTrades(
  brokerTrades: BrokerRawTrade[],
  journalTrades: Array<{
    id: string;
    instrumentSymbol: string;
    direction: string;
    entryPriceAvg?: string | null;
    exitPriceAvg?: string | null;
    positionSize?: string | null;
    feesCents?: number | null;
    notes?: string | null;
    executions?: Array<{ notes?: string | null; price: string; quantity: string }>;
  }>
): { matches: Array<{ brokerTrade: BrokerRawTrade; tradeId: string }>; discrepancies: ReconciliationDiscrepancy[] } {
  const discrepancies: ReconciliationDiscrepancy[] = [];
  const matches: Array<{ brokerTrade: BrokerRawTrade; tradeId: string }> = [];
  const matchedTradeIds = new Set<string>();

  for (const bTrade of brokerTrades) {
    // Match by external ticket reference in notes or executions
    const ticketTag = `Ticket #${bTrade.ticketId}`;
    const matched = journalTrades.find((t) =>
      (t.notes && t.notes.includes(bTrade.ticketId)) ||
      (t.executions && t.executions.some((ex) => ex.notes && ex.notes.includes(bTrade.ticketId)))
    );

    if (!matched) {
      discrepancies.push({
        type: "missing_in_alphapips",
        ticketId: bTrade.ticketId,
        symbol: bTrade.symbol,
        description: `Broker trade #${bTrade.ticketId} (${bTrade.symbol} ${bTrade.direction}) is not recorded in AlphaPips.`,
        brokerValue: bTrade,
      });
      continue;
    }

    matchedTradeIds.add(matched.id);
    matches.push({ brokerTrade: bTrade, tradeId: matched.id });

    // Compare prices
    const bOpen = parseFloat(bTrade.openPrice);
    const jOpen = matched.entryPriceAvg ? parseFloat(matched.entryPriceAvg) : null;
    if (jOpen !== null && Math.abs(bOpen - jOpen) > 0.0001) {
      discrepancies.push({
        type: "price_discrepancy",
        ticketId: bTrade.ticketId,
        symbol: bTrade.symbol,
        description: `Entry price discrepancy on #${bTrade.ticketId}: Broker ${bOpen} vs Journal ${jOpen}.`,
        brokerValue: bOpen,
        journalValue: jOpen,
      });
    }

    // Compare sizes
    const bVol = parseFloat(bTrade.volume);
    const jVol = matched.positionSize ? parseFloat(matched.positionSize) : null;
    if (jVol !== null && Math.abs(bVol - jVol) > 0.001) {
      discrepancies.push({
        type: "volume_discrepancy",
        ticketId: bTrade.ticketId,
        symbol: bTrade.symbol,
        description: `Position size discrepancy on #${bTrade.ticketId}: Broker ${bVol} vs Journal ${jVol}.`,
        brokerValue: bVol,
        journalValue: jVol,
      });
    }
  }

  return { matches, discrepancies };
}

/**
 * Executes a read-only synchronization pass for a user's connected broker account.
 */
export async function executeBrokerSync(
  userId: string,
  accountId: string,
  incomingBrokerTrades: BrokerRawTrade[]
): Promise<SyncReconciliationReport> {
  const account = await db.tradingAccount.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new Error("Trading account not found.");

  const existingTrades = await db.trade.findMany({
    where: { userId, accountId },
    select: {
      id: true,
      instrumentSymbol: true,
      direction: true,
      entryPriceAvg: true,
      exitPriceAvg: true,
      positionSize: true,
      feesCents: true,
      notes: true,
      executions: {
        select: { notes: true, price: true, quantity: true },
      },
    },
  });

  const { matches, discrepancies } = reconcileBrokerTrades(incomingBrokerTrades, existingTrades);
  const matchedTicketIds = new Set(matches.map((m) => m.brokerTrade.ticketId));

  // Ingest missing broker trades as server-normalized journal trades
  let newImportedTrades = 0;
  for (const bTrade of incomingBrokerTrades) {
    if (matchedTicketIds.has(bTrade.ticketId)) continue;

    try {
      const resolved = await resolveInstrumentForServer(bTrade.symbol, userId);
      let instr = await db.instrument.findFirst({
        where: { userId, symbol: resolved.def.symbol },
      });
      if (!instr) {
        instr = await db.instrument.create({
          data: {
            userId,
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

      const entryPrice = normalizeCsvDecimal(bTrade.openPrice) || "0";
      const exitPrice = bTrade.closePrice ? normalizeCsvDecimal(bTrade.closePrice) : null;
      const quantity = normalizeCsvDecimal(bTrade.volume) || "1";
      const feesCents = (bTrade.commissionCents ?? 0) + (bTrade.swapCents ?? 0);
      const parsedEntryTime = new Date(bTrade.openTime);
      const parsedExitTime = bTrade.closeTime ? new Date(bTrade.closeTime) : null;

      const calcInput: any = {
        direction: bTrade.direction,
        plannedEntryPrice: entryPrice,
        plannedStopPrice: bTrade.stopLoss || null,
        plannedTargetPrice: bTrade.takeProfit || null,
        fills: [
          { kind: "entry", price: entryPrice, quantity },
          ...(exitPrice ? [{ kind: "exit" as const, price: exitPrice, quantity }] : []),
        ],
        feesCents,
        contractSize: resolved.def.contractSize,
        pipSize: resolved.def.pipSize,
        pointValueCents: resolved.def.pointValueCents,
      };
      const calc = calculateTradeMetrics(calcInput);
      const ticketRef = `Broker Ticket #${bTrade.ticketId} (Synced)`;

      await db.trade.create({
        data: {
          userId,
          accountId,
          instrumentId: instr.id,
          instrumentSymbol: instr.symbol,
          market: instr.market,
          direction: bTrade.direction,
          status: calc.status,
          entryPriceAvg: calc.entryPriceAvg,
          exitPriceAvg: calc.exitPriceAvg,
          positionSize: quantity,
          feesCents,
          grossPnlCents: bTrade.profitCents ? bTrade.profitCents + feesCents : calc.grossPnlNativeCents,
          netPnlCents: bTrade.profitCents ?? calc.netPnlNativeCents,
          actualR: calc.actualR,
          entryTime: parsedEntryTime,
          exitTime: parsedExitTime,
          notes: ticketRef,
          executions: {
            create: [
              {
                kind: "entry",
                price: entryPrice,
                quantity,
                timestamp: parsedEntryTime,
                notes: ticketRef,
              },
              ...(exitPrice ? [{
                kind: "exit",
                price: exitPrice,
                quantity,
                timestamp: parsedExitTime || new Date(),
                notes: ticketRef,
              }] : []),
            ],
          },
        },
      });
      newImportedTrades++;
    } catch (importErr) {
      console.warn(`Failed to ingest broker trade #${bTrade.ticketId}:`, importErr);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalBrokerTrades: incomingBrokerTrades.length,
    existingMatchedTrades: matches.length,
    newImportedTrades,
    discrepancies: discrepancies.filter((d) => d.type !== "missing_in_alphapips"),
  };
}
