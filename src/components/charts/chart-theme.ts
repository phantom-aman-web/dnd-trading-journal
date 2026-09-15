"use client";

/**
 * Shared recharts tooltip style constants.
 * Per spec section 110: never show NaN/Infinity. Per section 12: use theme colors.
 * These use explicit CSS variables that resolve at runtime from the active theme.
 */
export const CHART_TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontSize: "12px",
  color: "var(--card-foreground)",
  padding: "8px 12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
};

export const CHART_TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: "var(--foreground)",
  fontWeight: 500,
  marginBottom: "2px",
};

export const CHART_TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: "var(--muted-foreground)",
};

export const CHART_AXIS_TICK_STYLE = {
  fontSize: 10,
  fill: "var(--muted-foreground)",
} as const;
