/**
 * AlphaPips — Trading To-Do Reminder Scheduler
 * Handles reminder scheduling, rescheduling, cancellation, quiet hours, and timezone mapping.
 */

import { db } from "@/lib/db";
import { queueTodoReminder, cancelTaskReminders } from "./delivery-engine";

export { cancelTaskReminders };

export interface SyncTaskReminderInput {
  id: string;
  title: string;
  status: string; // pending | in_progress | completed | cancelled
  dueDate?: string | null; // YYYY-MM-DD
  dueTime?: string | null; // HH:mm
  customReminderAt?: Date | string | number | null;
  reminderMinutesBefore?: number | null;
}

/**
 * Returns today's calendar date (YYYY-MM-DD) in the specified user timezone.
 * Avoids UTC date skew across midnight boundaries (e.g. New York evening vs UTC morning).
 */
export function getTodayDateInTimezone(timezone = "UTC", now = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now); // en-CA locale formats as YYYY-MM-DD
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Parses a calendar date (YYYY-MM-DD) and wall-clock time (HH:mm) in a target timezone
 * into an exact absolute UTC Date.
 * Handles daylight saving transitions and midnight boundaries accurately.
 */
export function parseZonedTimestamp(
  dateStr: string,
  timeStr: string,
  timezone = "UTC"
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  // Initial approximation treating local numbers as UTC
  const approxUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date(approxUtc));
    const partMap: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") {
        partMap[p.type] = Number(p.value);
      }
    }

    const zonedYear = partMap.year ?? year;
    const zonedMonth = partMap.month ?? month;
    const zonedDay = partMap.day ?? day;
    let zonedHour = partMap.hour ?? hours;
    if (zonedHour === 24) zonedHour = 0;
    const zonedMin = partMap.minute ?? minutes;

    const zonedAsUtc = Date.UTC(zonedYear, zonedMonth - 1, zonedDay, zonedHour, zonedMin, 0, 0);
    const offsetMs = zonedAsUtc - approxUtc;

    return new Date(approxUtc - offsetMs);
  } catch {
    return new Date(approxUtc);
  }
}

/**
 * Parses a task due timestamp using the user's configured AlphaPips timezone.
 * If dueDate is omitted for a time-only task, uses today's calendar date in the user's timezone.
 */
export function parseTaskDueTimestamp(
  dueDate?: string | null,
  dueTime?: string | null,
  timezone = "UTC",
  now = new Date()
): Date {
  const dateStr =
    dueDate && dueDate.trim().length > 0
      ? dueDate.trim()
      : getTodayDateInTimezone(timezone, now);
  const timeStr = dueTime && dueTime.trim().length > 0 ? dueTime.trim() : "09:00";
  return parseZonedTimestamp(dateStr, timeStr, timezone);
}

/**
 * Preserves customReminderAt as a proper timezone-aware absolute timestamp.
 * If already ISO string with 'Z' or offset, parses directly as absolute UTC.
 * If unzoned string, interprets it within the user's configured timezone.
 */
export function parseCustomReminderTimestamp(
  input: Date | string | number,
  timezone = "UTC"
): Date {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date() : input;
  }
  if (typeof input === "number") {
    return new Date(input);
  }
  const trimmed = String(input).trim();
  if (trimmed.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  const [dPart, tPart] = trimmed.split(/[T\s]+/);
  if (dPart && tPart) {
    return parseZonedTimestamp(dPart, tPart.slice(0, 5), timezone);
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Gets wall-clock hours and minutes for a Date in a specific timezone.
 */
export function getTimeInTimezone(date: Date, timezone = "UTC"): { hours: number; minutes: number } {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    let hours = 0;
    let minutes = 0;
    for (const p of parts) {
      if (p.type === "hour") hours = Number(p.value);
      if (p.type === "minute") minutes = Number(p.value);
    }
    if (hours === 24) hours = 0;
    return { hours, minutes };
  } catch {
    return { hours: date.getUTCHours(), minutes: date.getUTCMinutes() };
  }
}

/**
 * Checks if a given Date falls within a user's quiet hours window in their local timezone.
 */
export function isWithinQuietHours(
  date: Date,
  quietStart = "22:00",
  quietEnd = "07:00",
  timezone = "UTC"
): boolean {
  const { hours, minutes } = getTimeInTimezone(date, timezone);
  const currentTotalMins = hours * 60 + minutes;

  const [sH, sM] = quietStart.split(":").map(Number);
  const [eH, eM] = quietEnd.split(":").map(Number);
  const startMins = sH * 60 + sM;
  const endMins = eH * 60 + eM;

  if (startMins > endMins) {
    // Overnight quiet hours, e.g. 22:00 to 07:00
    return currentTotalMins >= startMins || currentTotalMins < endMins;
  }
  return currentTotalMins >= startMins && currentTotalMins < endMins;
}

/**
 * Defers a reminder timestamp to the end of quiet hours in the user's timezone if it falls within the window.
 * Preserves the reminder rather than discarding it.
 */
export function deferPastQuietHours(
  date: Date,
  quietStart = "22:00",
  quietEnd = "07:00",
  timezone = "UTC"
): Date {
  if (!isWithinQuietHours(date, quietStart, quietEnd, timezone)) {
    return date;
  }

  const { hours, minutes } = getTimeInTimezone(date, timezone);
  const currentMins = hours * 60 + minutes;
  const [sH, sM] = quietStart.split(":").map(Number);
  const [eH, eM] = quietEnd.split(":").map(Number);
  const startMins = sH * 60 + sM;
  const endMins = eH * 60 + eM;

  const localDateStr = getTodayDateInTimezone(timezone, date);
  let targetDateStr = localDateStr;

  if (startMins > endMins) {
    // Overnight window, e.g. 22:00 to 07:00
    if (currentMins >= startMins) {
      // Late night (e.g. 23:00): quiet end is 07:00 the following morning
      const [y, m, d] = localDateStr.split("-").map(Number);
      const nextDay = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
      targetDateStr = nextDay.toISOString().slice(0, 10);
    }
    // If currentMins < endMins (e.g. 03:00): quiet end is 07:00 today
  } else {
    // Same-day window, e.g. 13:00 to 14:00
    if (currentMins >= endMins) {
      const [y, m, d] = localDateStr.split("-").map(Number);
      const nextDay = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
      targetDateStr = nextDay.toISOString().slice(0, 10);
    }
  }

  return parseZonedTimestamp(targetDateStr, quietEnd, timezone);
}

/**
 * Synchronizes Telegram reminders for a Trading To-Do task.
 * Cancels pending reminders if task is completed/cancelled.
 * Re-computes and queues reminders if active using the user's configured AlphaPips timezone.
 * Deterministic behavior for passed times: never silently rolls a one-time reminder to tomorrow.
 */
export async function syncTaskReminders(
  task: SyncTaskReminderInput,
  userId: string,
  explicitMinutesBefore?: number | null,
  currentDate = new Date()
): Promise<void> {
  try {
    // 1. If completed or cancelled, cancel all pending reminders
    if (task.status === "completed" || task.status === "cancelled") {
      await cancelTaskReminders(task.id, userId);
      return;
    }

    // 2. Fetch reminder settings, integration state, and user's profile timezone
    const [settings, integration, userSettings] = await Promise.all([
      db.telegramReminderSettings.findUnique({ where: { userId } }),
      db.telegramIntegration.findUnique({ where: { userId } }),
      db.userSettings.findUnique({ where: { userId } }),
    ]);

    if (!integration || !integration.privateChatId || !integration.isPrivateLinked) {
      return; // Private chat not linked
    }

    if (settings && settings.enabled === false) {
      return; // User disabled To-Do reminders
    }

    // Resolve user's configured timezone
    const tz = settings?.timezone || userSettings?.displayTimezone || userSettings?.timezone || "UTC";
    const now = currentDate;

    // 3. Determine target timestamp: custom reminder timestamp OR dueDate/dueTime
    let dueTime: Date | null = null;

    if (task.customReminderAt) {
      dueTime = parseCustomReminderTimestamp(task.customReminderAt, tz);
    } else if (task.dueDate || task.dueTime) {
      dueTime = parseTaskDueTimestamp(task.dueDate, task.dueTime, tz, now);
    }

    if (!dueTime || isNaN(dueTime.getTime())) {
      return; // No date or time anchor scheduled
    }

    const intervalMins =
      explicitMinutesBefore !== undefined && explicitMinutesBefore !== null
        ? explicitMinutesBefore
        : settings?.defaultIntervalMins ?? 15;

    let reminderTime = new Date(dueTime.getTime() - intervalMins * 60 * 1000);

    // 4. Handle quiet hours deferral in the user's timezone if enabled
    if (settings?.quietHoursEnabled && settings.quietHoursStart && settings.quietHoursEnd) {
      reminderTime = deferPastQuietHours(
        reminderTime,
        settings.quietHoursStart,
        settings.quietHoursEnd,
        tz
      );
    }

    // 5. Cancel previously pending reminders for this task (rescheduling)
    await cancelTaskReminders(task.id, userId);

    // 6. If reminder is in the future, record and queue it
    if (reminderTime.getTime() > now.getTime()) {
      const dedupKey = `rem:${task.id}:${intervalMins}:${reminderTime.getTime()}`;

      await db.telegramReminder.upsert({
        where: { dedupKey },
        create: {
          userId,
          taskId: task.id,
          reminderTime,
          intervalMinutes: intervalMins,
          status: "pending",
          dedupKey,
        },
        update: {
          reminderTime,
          status: "pending",
        },
      });

      await queueTodoReminder({
        taskId: task.id,
        userId,
        scheduledFor: reminderTime,
        intervalMinutes: intervalMins,
      });
    } else if (dueTime.getTime() <= now.getTime()) {
      // Deterministic behavior for passed times:
      // The scheduled time for today has already passed.
      // NEVER silently move a one-time reminder to tomorrow.
      // If overdue alerts are enabled (once or repeat_hourly), queue an overdue alert today.
      if (settings?.overdueBehavior !== "none") {
        let overdueScheduled = now;
        if (settings?.quietHoursEnabled && settings.quietHoursStart && settings.quietHoursEnd) {
          overdueScheduled = deferPastQuietHours(
            now,
            settings.quietHoursStart,
            settings.quietHoursEnd,
            tz
          );
        }

        await queueTodoReminder({
          taskId: task.id,
          userId,
          scheduledFor: overdueScheduled,
          intervalMinutes: 0,
        });
      }
    }
  } catch (err) {
    console.error("Non-fatal: Failed to sync task reminders:", err);
  }
}
