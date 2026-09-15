"use client";

import { useEffect, useState, useCallback } from "react";

export type DndTheme = "nordic" | "terminal" | "institutional";

// Simple event-based theme store so components can reactively track the current theme.
let currentTheme: DndTheme = "nordic";
const themeListeners = new Set<(t: DndTheme) => void>();

function notifyTheme(t: DndTheme) {
  currentTheme = t;
  themeListeners.forEach((fn) => fn(t));
}

function applyThemeToDOM(t: DndTheme) {
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.classList.toggle("dark", t !== "nordic");
  // Also set color-scheme so native form controls + scrollbars match.
  document.documentElement.style.colorScheme = t === "nordic" ? "light" : "dark";
}

/**
 * Hook that returns the current theme and a setter.
 * Re-renders when the theme changes.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<DndTheme>(currentTheme);

  useEffect(() => {
    // Initialize from localStorage on mount
    const stored = (localStorage.getItem("dnd-theme") as DndTheme) || "nordic";
    const t: DndTheme = stored === "terminal" || stored === "institutional" ? stored : "nordic";
    currentTheme = t;
    setThemeState(t);

    const listener = (t: DndTheme) => setThemeState(t);
    themeListeners.add(listener);
    return () => {
      themeListeners.delete(listener);
    };
  }, []);

  const changeTheme = useCallback((t: DndTheme) => {
    setTheme(t);
  }, []);

  return { theme, setTheme: changeTheme };
}

/**
 * DnD theme provider.
 * The theme is applied by a blocking inline script in layout.tsx BEFORE
 * first paint (no FOUC), then synced here after hydration.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Apply the stored theme once on mount (reinforces the inline script
  // after hydration so React state stays in sync).
  useEffect(() => {
    const stored = (localStorage.getItem("dnd-theme") as DndTheme) || "nordic";
    const t: DndTheme = stored === "terminal" || stored === "institutional" ? stored : "nordic";
    applyThemeToDOM(t);
    notifyTheme(t);

    const density = (localStorage.getItem("dnd-density") as string) || "comfortable";
    document.documentElement.setAttribute("data-density", density);

    const larger = localStorage.getItem("dnd-larger-text") === "true";
    if (larger) document.documentElement.setAttribute("data-larger-text", "true");
  }, []);
  return <>{children}</>;
}

export function setTheme(theme: DndTheme) {
  if (typeof window === "undefined") return;
  localStorage.setItem("dnd-theme", theme);
  applyThemeToDOM(theme);
  notifyTheme(theme);
}

export function getTheme(): DndTheme {
  if (typeof window === "undefined") return "nordic";
  const stored = localStorage.getItem("dnd-theme") as DndTheme;
  return stored === "terminal" || stored === "institutional" ? stored : "nordic";
}

export function setDensity(d: "comfortable" | "compact") {
  if (typeof window === "undefined") return;
  localStorage.setItem("dnd-density", d);
  document.documentElement.setAttribute("data-density", d);
}

export function setLargerText(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("dnd-larger-text", String(on));
  document.documentElement.setAttribute("data-larger-text", String(on));
}

export function setReducedMotion(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("dnd-reduced-motion", String(on));
  if (on) document.documentElement.style.setProperty("scroll-behavior", "auto");
}
