// Timezone list & formatting helpers for the Settings timezone selector.
//
// Uses `Intl.supportedValuesOf('timeZone')` when available (modern browsers
// and Node 18+) to get the full list of IANA timezone identifiers the
// runtime knows about. Falls back to a curated list covering all major
// regions if that API is missing (older browsers, edge runtimes).

const FALLBACK_TIMEZONES: string[] = [
  "UTC",
  // Africa
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Addis_Ababa",
  "Africa/Accra",
  "Africa/Algiers",
  "Africa/Tunis",
  // Americas
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",
  // Asia
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jerusalem",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Asia/Manila",
  "Asia/Jakarta",
  // Europe
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Zurich",
  // Pacific
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "Pacific/Sydney",
  "Pacific/Tahiti",
  // Australia
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
];

/**
 * Returns the list of IANA timezone identifiers available in the current
 * runtime. Uses `Intl.supportedValuesOf('timeZone')` when present, falling
 * back to a curated list of 50+ timezones covering all major regions.
 */
export function getIanaTimezones(): string[] {
  try {
    // `Intl.supportedValuesOf` is supported in modern browsers (Chrome 99+,
    // Firefox 128+, Safari 15.4+) and Node 18+. It returns string[] for the
    // 'timeZone' key. We use a defensive cast for older TS lib targets.
    const supported = (Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }).supportedValuesOf?.("timeZone");
    if (supported && Array.isArray(supported) && supported.length > 0) {
      // Make sure UTC is present and at the front so it's always easy to find.
      const list = supported.filter((tz) => tz !== "UTC");
      return ["UTC", ...list.sort()];
    }
  } catch {
    // Fall through to the hardcoded list below.
  }
  return [...FALLBACK_TIMEZONES];
}

/**
 * Friendly display name for an IANA timezone identifier.
 *
 *   "America/New_York"      -> "New York (America/New_York)"
 *   "Africa/Addis_Ababa"    -> "Addis Ababa (Africa/Addis_Ababa)"
 *   "UTC"                   -> "UTC (UTC)"
 *   "Europe/London"         -> "London (Europe/London)"
 */
export function formatTimezoneLabel(tz: string): string {
  if (!tz) return "";
  if (tz === "UTC") return "UTC (UTC)";
  const slash = tz.lastIndexOf("/");
  const city = slash >= 0 ? tz.slice(slash + 1) : tz;
  const friendly = city.replace(/_/g, " ");
  return `${friendly} (${tz})`;
}

/**
 * The city-only portion of the display name (no IANA suffix).
 *
 *   "America/New_York"   -> "New York"
 *   "UTC"                -> "UTC"
 */
export function timezoneCity(tz: string): string {
  if (!tz) return "";
  if (tz === "UTC") return "UTC";
  const slash = tz.lastIndexOf("/");
  const city = slash >= 0 ? tz.slice(slash + 1) : tz;
  return city.replace(/_/g, " ");
}
