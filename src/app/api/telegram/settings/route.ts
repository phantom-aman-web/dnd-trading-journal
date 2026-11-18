import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";

export async function GET(_req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const integration = await db.telegramIntegration.findUnique({
    where: { userId: user.id },
    include: { publishingSettings: true },
  });

  const reminderSettings = await db.telegramReminderSettings.findUnique({
    where: { userId: user.id },
  });

  const userSettings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: { timezone: true },
  });

  return ok({
    publishing: integration?.publishingSettings || {
      enabled: false,
      templateType: "standard",
      customTemplateJson: null,
      includeScreenshots: true,
      includeTags: true,
      includeDescription: true,
      includeRisk: true,
      includePerformance: true,
      includeAccountName: false,
      autoPublishNewTrades: true,
      publishTradeClosure: true,
    },
    reminders: reminderSettings || {
      enabled: true,
      defaultIntervalMins: 15,
      overdueBehavior: "once",
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      timezone: userSettings?.timezone || "UTC",
    },
  });
}

export async function PATCH(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON payload");

  const { publishing, reminders } = body;

  const integration = await db.telegramIntegration.findUnique({
    where: { userId: user.id },
  });

  // Update publishing settings if provided
  let updatedPublishing: any = null;
  if (publishing && integration) {
    updatedPublishing = await db.telegramPublishingSettings.upsert({
      where: { integrationId: integration.id },
      create: {
        integrationId: integration.id,
        enabled: Boolean(publishing.enabled),
        templateType: publishing.templateType || "standard",
        customTemplateJson: publishing.customTemplateJson ?? null,
        includeScreenshots: publishing.includeScreenshots ?? true,
        includeTags: publishing.includeTags ?? true,
        includeDescription: publishing.includeDescription ?? true,
        includeRisk: publishing.includeRisk ?? true,
        includePerformance: publishing.includePerformance ?? true,
        includeAccountName: publishing.includeAccountName ?? false,
        autoPublishNewTrades: publishing.autoPublishNewTrades ?? true,
        publishTradeClosure: publishing.publishTradeClosure ?? true,
      },
      update: {
        ...(publishing.enabled !== undefined ? { enabled: Boolean(publishing.enabled) } : {}),
        ...(publishing.templateType !== undefined ? { templateType: publishing.templateType } : {}),
        ...(publishing.customTemplateJson !== undefined
          ? { customTemplateJson: publishing.customTemplateJson }
          : {}),
        ...(publishing.includeScreenshots !== undefined
          ? { includeScreenshots: Boolean(publishing.includeScreenshots) }
          : {}),
        ...(publishing.includeTags !== undefined
          ? { includeTags: Boolean(publishing.includeTags) }
          : {}),
        ...(publishing.includeDescription !== undefined
          ? { includeDescription: Boolean(publishing.includeDescription) }
          : {}),
        ...(publishing.includeRisk !== undefined
          ? { includeRisk: Boolean(publishing.includeRisk) }
          : {}),
        ...(publishing.includePerformance !== undefined
          ? { includePerformance: Boolean(publishing.includePerformance) }
          : {}),
        ...(publishing.includeAccountName !== undefined
          ? { includeAccountName: Boolean(publishing.includeAccountName) }
          : {}),
        ...(publishing.autoPublishNewTrades !== undefined
          ? { autoPublishNewTrades: Boolean(publishing.autoPublishNewTrades) }
          : {}),
        ...(publishing.publishTradeClosure !== undefined
          ? { publishTradeClosure: Boolean(publishing.publishTradeClosure) }
          : {}),
      },
    });
  }

  // Update reminder settings if provided
  let updatedReminders: any = null;
  if (reminders) {
    updatedReminders = await db.telegramReminderSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        enabled: reminders.enabled !== undefined ? Boolean(reminders.enabled) : true,
        defaultIntervalMins:
          reminders.defaultIntervalMins !== undefined
            ? Number(reminders.defaultIntervalMins)
            : 15,
        overdueBehavior: reminders.overdueBehavior || "once",
        quietHoursEnabled: Boolean(reminders.quietHoursEnabled),
        quietHoursStart: reminders.quietHoursStart || "22:00",
        quietHoursEnd: reminders.quietHoursEnd || "07:00",
        timezone: reminders.timezone || "UTC",
      },
      update: {
        ...(reminders.enabled !== undefined ? { enabled: Boolean(reminders.enabled) } : {}),
        ...(reminders.defaultIntervalMins !== undefined
          ? { defaultIntervalMins: Number(reminders.defaultIntervalMins) }
          : {}),
        ...(reminders.overdueBehavior !== undefined
          ? { overdueBehavior: reminders.overdueBehavior }
          : {}),
        ...(reminders.quietHoursEnabled !== undefined
          ? { quietHoursEnabled: Boolean(reminders.quietHoursEnabled) }
          : {}),
        ...(reminders.quietHoursStart !== undefined
          ? { quietHoursStart: reminders.quietHoursStart }
          : {}),
        ...(reminders.quietHoursEnd !== undefined
          ? { quietHoursEnd: reminders.quietHoursEnd }
          : {}),
        ...(reminders.timezone !== undefined ? { timezone: reminders.timezone } : {}),
      },
    });
  }

  return ok({
    publishing: updatedPublishing,
    reminders: updatedReminders,
  });
}
