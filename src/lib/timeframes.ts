export const TIMEFRAMES = [
  { value: "1W", label: "Weekly", group: "Higher Timeframe" },
  { value: "1D", label: "Daily", group: "Higher Timeframe" },
  { value: "4H", label: "4H", group: "Higher Timeframe" },
  { value: "1H", label: "1H", group: "Execution Timeframe" },
  { value: "30m", label: "30m", group: "Execution Timeframe" },
  { value: "15m", label: "15m", group: "Execution Timeframe" },
  { value: "5m", label: "5m", group: "Entry / Trigger" },
  { value: "3m", label: "3m", group: "Entry / Trigger" },
  { value: "1m", label: "1m", group: "Entry / Trigger" },
  { value: "custom", label: "Custom", group: "Other" },
] as const;

export const TIMEFRAME_GROUPS = ["Higher Timeframe", "Execution Timeframe", "Entry / Trigger", "Other"];

/** Look up the group for a given timeframe value. Returns "Other" if not found. */
export function getTimeframeGroup(value: string | null | undefined): string | null {
  if (!value) return null;
  return TIMEFRAMES.find((t) => t.value === value)?.group ?? "Other";
}

/** Look up the human label for a given timeframe value. Returns the value as-is if not found. */
export function getTimeframeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return TIMEFRAMES.find((t) => t.value === value)?.label ?? value;
}
