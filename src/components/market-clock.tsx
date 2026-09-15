"use client";

import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock } from "lucide-react";

/**
 * DnD — New York Market Clock.
 *
 * Displays the real New York local time + date + current trading session,
 * derived entirely from the `America/New_York` IANA timezone via
 * `Intl.DateTimeFormat`. This automatically handles DST transitions
 * (EDT = UTC-4, EST = UTC-5) without any manual offset selection.
 *
 * The user's general timezone setting (UserSettings.timezone) is NOT used
 * here — this clock always shows New York market time regardless of where
 * the user is located.
 *
 * Session definitions (New York LOCAL wall-clock time):
 *   Asian Range:  20:00 – 03:00  (crosses midnight)
 *   London Open:  03:00 – 08:30
 *   NY AM:        08:30 – 12:00
 *   NY Lunch:     12:00 – 13:00
 *   NY PM:        13:00 – 17:00
 *   Off Hours:    17:00 – 20:00
 *
 * The offset label (UTC-4 / UTC-5) is derived automatically from the
 * timezone's current offset — never user-selected.
 */

interface NyTimeParts {
  /** e.g. "Mon, Sep 9" */
  dateLabel: string;
  /** e.g. "10:26:31 AM" */
  timeLabel: string;
  /** e.g. "10:26 AM" (no seconds — mobile compact) */
  timeShort: string;
  /** e.g. "UTC-4" or "UTC-5" — derived from the timezone, not user-selected */
  offsetLabel: string;
  /** e.g. "NY AM" */
  sessionLabel: string;
  /** Internal: numeric hour 0-23 for session calculation */
  hourNum: number;
  /** Internal: numeric minute 0-59 */
  minuteNum: number;
}

const SESSION_LABELS: Record<string, string> = {
  asian_range: "Asian",
  london_open: "London",
  ny_am: "NY AM",
  ny_lunch: "NY Lunch",
  ny_pm: "NY PM",
  off_hours: "Off",
};

/**
 * Determine the current trading session based on New York local hour.
 *
 * Boundaries (NY local wall-clock):
 *   Asian Range:  20:00 – 03:00  (crosses midnight: 20:00-23:59 AND 00:00-03:00)
 *   London Open: 03:00 – 08:30
 *   NY AM:       08:30 – 12:00
 *   NY Lunch:    12:00 – 13:00
 *   NY PM:       13:00 – 17:00
 *   Off Hours:   17:00 – 20:00
 *
 * Times are compared as decimal hours (e.g. 08:30 = 8.5).
 */
function getSessionForNyHour(hour: number, minute: number): string {
  const time = hour + minute / 60;
  // Asian Range crosses midnight: 20:00-23:59 OR 00:00-03:00
  if (time >= 20 || time < 3) return "asian_range";
  if (time >= 3 && time < 8.5) return "london_open";
  if (time >= 8.5 && time < 12) return "ny_am";
  if (time >= 12 && time < 13) return "ny_lunch";
  if (time >= 13 && time < 17) return "ny_pm";
  return "off_hours";
}

/**
 * Compute the current UTC offset label (e.g. "UTC-4" or "UTC-5") for
 * America/New_York at the given date. Uses `Intl.DateTimeFormat` with
 * `timeZoneName: "shortOffset"` to get the offset string, then normalizes
 * it to the "UTC±N" format.
 *
 * This automatically reflects DST: during EDT (March-November) it returns
 * "UTC-4"; during EST (November-March) it returns "UTC-5".
 */
function getNyOffsetLabel(date: Date): string {
  try {
    // "shortOffset" gives e.g. "GMT-4" or "GMT-5"
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(date);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    const val = offsetPart?.value ?? "";
    // Normalize "GMT-4" → "UTC-4", "GMT+0" → "UTC+0"
    const match = val.match(/GMT([+-]\d+)/);
    if (match) return "UTC" + match[1];
    return val.replace("GMT", "UTC");
  } catch {
    return "UTC-4";
  }
}

/**
 * Build all display parts for the New York market clock from a Date.
 * Uses Intl.DateTimeFormat with timeZone: "America/New_York" so the
 * result is always New York local time regardless of the user's
 * browser timezone.
 */
function buildNyTimeParts(date: Date): NyTimeParts {
  // Date parts: "Mon, Sep 9"
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const dateParts = dateFmt.formatToParts(date);
  const weekday = dateParts.find((p) => p.type === "weekday")?.value ?? "";
  const month = dateParts.find((p) => p.type === "month")?.value ?? "";
  const day = dateParts.find((p) => p.type === "day")?.value ?? "";
  const dateLabel = `${weekday}, ${month} ${day}`;

  // Time parts (with seconds): "10:26:31 AM"
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const timeParts = timeFmt.formatToParts(date);
  const hour = timeParts.find((p) => p.type === "hour")?.value ?? "12";
  const minute = timeParts.find((p) => p.type === "minute")?.value ?? "00";
  const second = timeParts.find((p) => p.type === "second")?.value ?? "00";
  const dayPeriod = timeParts.find((p) => p.type === "dayPeriod")?.value ?? "AM";
  const timeLabel = `${hour}:${minute}:${second} ${dayPeriod}`;

  // Short time (no seconds): "10:26 AM"
  const timeShortFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const timeShort = timeShortFmt.format(date);

  // Derive numeric hour (0-23) for session calculation.
  let hourNum = parseInt(hour, 10);
  if (isNaN(hourNum)) hourNum = 0;
  if (dayPeriod === "PM" && hourNum !== 12) hourNum += 12;
  if (dayPeriod === "AM" && hourNum === 12) hourNum = 0;
  const minuteNum = parseInt(minute, 10) || 0;

  const session = getSessionForNyHour(hourNum, minuteNum);
  const sessionLabel = SESSION_LABELS[session] ?? "—";
  const offsetLabel = getNyOffsetLabel(date);

  return {
    dateLabel,
    timeLabel,
    timeShort,
    offsetLabel,
    sessionLabel,
    hourNum,
    minuteNum,
  };
}

export function MarketClock() {
  // Start with null on first render to avoid SSR/CSR hydration mismatch.
  // The server renders no time; the client fills it in after mount.
  // This is the standard pattern for time-based components in Next.js
  // (see https://react.dev/reference/react/useClient).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // On the very first render (SSR + initial CSR), `now` is null.
  // We render placeholder text to avoid hydration mismatch. After mount,
  // the useEffect fires and the real time appears.
  const parts = now ? buildNyTimeParts(now) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md hover:bg-muted transition-colors"
          aria-label="New York market clock"
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex flex-col items-start leading-none">
            {/* Desktop: full time + seconds. Mobile: compact HH:MM. */}
            <span className="text-[11px] font-mono font-medium tabular-nums text-foreground hidden sm:inline">
              {parts ? parts.timeLabel : "—"}
            </span>
            <span className="text-[11px] font-mono font-medium tabular-nums text-foreground sm:hidden">
              {parts ? parts.timeShort : "—"}
            </span>
            <span className="text-[9px] text-muted-foreground mt-0.5">
              <span className="hidden sm:inline">{parts ? parts.offsetLabel + " · " : ""}</span>
              {parts ? parts.sessionLabel : ""}
            </span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">New York Market Time</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 space-y-1">
          <div className="text-xs text-muted-foreground">{parts ? parts.dateLabel : "Loading…"}</div>
          <div className="text-sm font-mono font-medium tabular-nums">
            {parts ? parts.timeLabel : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {parts ? `${parts.offsetLabel} · ${parts.sessionLabel}` : ""}
          </div>
          <div className="text-[10px] text-muted-foreground/70 pt-1">
            America/New_York — DST auto-detected
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
