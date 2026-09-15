import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const settings = await db.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, timezone: "UTC", theme: "nordic" },
  });
  const notifPrefs = await db.notificationPreferences.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, prefsJson: "{}" },
  });
  // Include the user's display name in the response so the Settings →
  // Profile tab can render + edit it without a separate /api/me round-trip.
  return ok({ settings, notificationPreferences: notifPrefs, user: { name: user.name } });
}

export async function PATCH(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson<Record<string, unknown>>(req);
  if (!body) return bad("Invalid JSON body");
  const allowed: Record<string, unknown> = {};
  const fields = [
    "timezone", "displayTimezone", "tradingTimezone",
    "theme", "density", "reducedMotion", "largerText",
    "defaultRiskPct", "baseCurrencySymbol", "defaultAccountId", "defaultSession", "defaultInstrument",
    "defaultTimeframe",
    "dailyTradeLimit", "maxTradesPerDay", "maxRiskPerTradePct",
    "dailyLossLimitPct", "preferredInstruments",
    "dateFormat", "timeFormat", "weekStartsOn",
    "privacyModeEnabled",
    "normalRiskMaxPct", "warningRiskMaxPct", "criticalRiskMaxPct",
  ];
  for (const f of fields) {
    if (f in body) allowed[f] = body[f];
  }
  // `name` lives on the User model (not UserSettings). Persist it separately
  // so the Profile tab can edit the user's display name. Empty strings are
  // treated as null to keep the column consistent with the schema's String?
  // (nullable) semantics.
  const nameValue = typeof body.name === "string" ? body.name : undefined;
  if (nameValue !== undefined) {
    await db.user.update({
      where: { id: user.id },
      data: { name: nameValue.trim() || null },
    });
  }
  const settings = await db.userSettings.upsert({
    where: { userId: user.id },
    update: allowed,
    create: { userId: user.id, timezone: "UTC", theme: "nordic", ...allowed },
  });
  if (body.notificationPreferences) {
    await db.notificationPreferences.upsert({
      where: { userId: user.id },
      update: { prefsJson: JSON.stringify(body.notificationPreferences) },
      create: { userId: user.id, prefsJson: JSON.stringify(body.notificationPreferences) },
    });
  }
  await audit("settings.updated", "user_settings", user.id);
  return ok({
    ...settings,
    user: { name: nameValue !== undefined ? (nameValue.trim() || null) : user.name },
  });
}
