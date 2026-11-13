"use client";

import { useEffect, useState, useCallback } from "react";

export type DndTheme = "nordic" | "terminal" | "institutional";
export type DndFont = "default" | "jetbrains" | "inter" | "jakarta" | "playfair" | "cinzel";

// Simple event-based theme store so components can reactively track the current theme.
let currentTheme: DndTheme = "nordic";
let currentFont: DndFont = "default";
const themeListeners = new Set<(t: DndTheme) => void>();
const fontListeners = new Set<(f: DndFont) => void>();

function notifyTheme(t: DndTheme) {
  currentTheme = t;
  themeListeners.forEach((fn) => fn(t));
}

function notifyFont(f: DndFont) {
  currentFont = f;
  fontListeners.forEach((fn) => fn(f));
}

function applyThemeToDOM(t: DndTheme) {
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.classList.toggle("dark", t === "terminal");
  // Also set color-scheme so native form controls + scrollbars match.
  document.documentElement.style.colorScheme = t === "terminal" ? "dark" : "light";
}

function applyFontToDOM(f: DndFont) {
  if (f === "default") {
    document.documentElement.removeAttribute("data-font");
  } else {
    document.documentElement.setAttribute("data-font", f);
  }
}

/**
 * Hook that returns the current font and a setter.
 */
export function useFont() {
  const [font, setFontState] = useState<DndFont>(currentFont);

  useEffect(() => {
    const stored = (localStorage.getItem("alphapips-font") as DndFont) || "default";
    currentFont = stored;
    setFontState(stored);

    const listener = (f: DndFont) => setFontState(f);
    fontListeners.add(listener);
    return () => {
      fontListeners.delete(listener);
    };
  }, []);

  const changeFont = useCallback((f: DndFont) => {
    setFont(f);
  }, []);

  return { font, setFont: changeFont };
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

    const storedFont = (localStorage.getItem("alphapips-font") as DndFont) || "default";
    applyFontToDOM(storedFont);
    notifyFont(storedFont);

    const density = (localStorage.getItem("dnd-density") as string) || "comfortable";
    document.documentElement.setAttribute("data-density", density);

    const larger = localStorage.getItem("dnd-larger-text") === "true";
    if (larger) document.documentElement.setAttribute("data-larger-text", "true");
  }, []);
  return <>{children}</>;
}

export function setFont(font: DndFont) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("alphapips-font", font);
  } catch {}
  applyFontToDOM(font);
  notifyFont(font);
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
