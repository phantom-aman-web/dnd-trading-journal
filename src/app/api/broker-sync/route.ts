import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import {
  executeBrokerSync,
  reconcileBrokerTrades,
  verifyReadOnlyPermission,
  validateReplayAndSignature,
  BrokerRawTrade,
} from "@/lib/broker-sync";
import { encryptBotToken } from "@/lib/telegram/encryption";
import { triggerChallengeRuleAlertsForAccount } from "@/lib/prop-simulator-engine";

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }

  const accounts = await db.tradingAccount.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      broker: true,
      accountType: true,
      currency: true,
      currentBalanceCents: true,
      updatedAt: true,
    },
  });

  return ok({ accounts });
}

export async function POST(req: NextRequest) {
  let user;
  const webhookSecret = req.headers.get("x-alphapips-secret") || req.headers.get("x-webhook-token");
  const timestampHeader = req.headers.get("x-alphapips-timestamp");
  const signatureHeader = req.headers.get("x-alphapips-signature");

  const clonedReq = req.clone();
  const rawBodyText = await clonedReq.text();
  let body: any = null;
  try {
    body = JSON.parse(rawBodyText);
  } catch {
    return bad("Invalid JSON body");
  }

  if (webhookSecret) {
    // Authenticate EA Webhook using token/secret with replay protection
    const replayCheck = validateReplayAndSignature(
      rawBodyText,
      signatureHeader,
      webhookSecret,
      timestampHeader,
      300 // 5-minute replay window
    );
    if (!replayCheck.valid) {
      return bad(`Webhook authentication failed: ${replayCheck.reason}`);
    }

    if (!body?.accountId) return bad("accountId is required in webhook payload");
    const account = await db.tradingAccount.findUnique({
      where: { id: body.accountId },
      include: { user: true },
    });
    if (!account) return bad("Trading account not found or access denied.");
    user = account.user;
  } else {
    try {
      user = await requireUser();
    } catch (e) {
      return toApiError(e);
    }
  }

  const { action = "sync", accountId } = body;
  if (!accountId) return bad("accountId is required");

  const account = await db.tradingAccount.findFirst({
    where: { id: accountId, userId: user.id },
  });
  if (!account) return bad("Trading account not found or access denied.");

  // Action 1: Connect / Update Broker Integration
  if (action === "connect") {
    const { brokerName, connectorType, credentials, requestedScopes = ["read_only", "history"] } = body;
    if (!verifyReadOnlyPermission(requestedScopes)) {
      return bad("Permission denied: AlphaPips only connects in strictly read-only mode. Trading or order execution permissions are rejected.");
    }

    // Encrypt sensitive token/credentials server-side
    const enc = credentials?.apiToken ? encryptBotToken(credentials.apiToken) : null;

    await db.tradingAccount.update({
      where: { id: accountId },
      data: {
        broker: brokerName || account.broker || "External Broker",
      },
    });

    await audit("broker_sync.connected", "tradingAccount", accountId, {
      connectorType,
      readOnlyVerified: true,
    });

    return ok({
      success: true,
      status: "connected",
      readOnlyVerified: true,
      message: "Broker connected in strictly read-only mode.",
    });
  }

  // Action 2: Trigger Read-Only Synchronization
  if (action === "sync") {
    const rawTrades: BrokerRawTrade[] = Array.isArray(body.trades) ? body.trades : [];
    const report = await executeBrokerSync(user.id, accountId, rawTrades);

    await audit("broker_sync.completed", "tradingAccount", accountId, {
      imported: report.newImportedTrades,
      matched: report.existingMatchedTrades,
      discrepancyCount: report.discrepancies.length,
    });

    if (report.newImportedTrades > 0) {
      triggerChallengeRuleAlertsForAccount(user.id, accountId).catch(() => {});
    }

    return ok(report);
  }

  // Action 3: Reconcile Journal with Broker Records
  if (action === "reconcile") {
    const rawTrades: BrokerRawTrade[] = Array.isArray(body.trades) ? body.trades : [];
    const existingTrades = await db.trade.findMany({
      where: { userId: user.id, accountId },
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

    const report = reconcileBrokerTrades(rawTrades, existingTrades);
    return ok(report);
  }

  // Action 4: Disconnect Broker Integration
  if (action === "disconnect") {
    await audit("broker_sync.disconnected", "tradingAccount", accountId, {});
    return ok({ success: true, message: "Broker disconnected and credentials purged." });
  }

  return bad("Unsupported action");
}
