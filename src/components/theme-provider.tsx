"use client";

import { useEffect, useState, useCallback } from "react";

export type DndTheme = "nordic" | "terminal" | "institutional";
export type DndFont = "default" | "jetbrains" | "inter" | "jakarta" | "playfair" | "cinzel";
export type DndInterfaceFont = "default" | "inter" | "jakarta";
export type DndDisplayFont = "default" | "jakarta" | "inter" | "playfair" | "cinzel" | "system";
export type DndFinancialFont = "jetbrains" | "system";
export type DndFontSize = "small" | "medium" | "large" | "xlarge";
export type DndDensity = "compact" | "comfortable" | "spacious";

// Simple event-based theme store so components can reactively track the current theme.
let currentTheme: DndTheme = "nordic";
let currentFont: DndFont = "default";
let currentInterfaceFont: DndInterfaceFont = "default";
let currentDisplayFont: DndDisplayFont = "default";
let currentFinancialFont: DndFinancialFont = "jetbrains";
let currentFontSize: DndFontSize = "medium";
let currentDensity: DndDensity = "comfortable";
let currentMonoNumbers = false;

const themeListeners = new Set<(t: DndTheme) => void>();
const fontListeners = new Set<(f: DndFont) => void>();
const prefsListeners = new Set<() => void>();

function notifyPrefs() {
  prefsListeners.forEach((fn) => fn());
}

function notifyTheme(t: DndTheme) {
  currentTheme = t;
  themeListeners.forEach((fn) => fn(t));
  notifyPrefs();
}

function notifyFont(f: DndFont) {
  currentFont = f;
  fontListeners.forEach((fn) => fn(f));
  notifyPrefs();
}

function applyThemeToDOM(t: DndTheme) {
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.classList.toggle("dark", t === "terminal" || t === "institutional");
  // Also set color-scheme so native form controls + scrollbars match.
  document.documentElement.style.colorScheme = (t === "terminal" || t === "institutional") ? "dark" : "light";
}

function applyFontToDOM(f: DndFont) {
  if (f === "default") {
    document.documentElement.removeAttribute("data-font");
  } else {
    document.documentElement.setAttribute("data-font", f);
  }
}

function applyTypographyRolesToDOM(interfaceF: DndInterfaceFont, displayF: DndDisplayFont, financialF: DndFinancialFont) {
  document.documentElement.setAttribute("data-font-interface", interfaceF);
  document.documentElement.setAttribute("data-font-display", displayF);
  document.documentElement.setAttribute("data-font-financial", financialF);
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
  useEffect(() => {
    const stored = (localStorage.getItem("dnd-theme") as DndTheme) || "nordic";
    const t: DndTheme = stored === "terminal" || stored === "institutional" ? stored : "nordic";
    applyThemeToDOM(t);
    notifyTheme(t);

    const storedFont = (localStorage.getItem("alphapips-font") as DndFont) || "default";
    applyFontToDOM(storedFont);
    notifyFont(storedFont);

    // Three independent typography roles
    const storedInterface = (localStorage.getItem("alphapips-font-interface") as DndInterfaceFont) ||
      (storedFont === "inter" || storedFont === "jakarta" || storedFont === "default" ? storedFont : "default");
    const storedDisplay = (localStorage.getItem("alphapips-font-display") as DndDisplayFont) ||
      (storedFont === "playfair" || storedFont === "cinzel" || storedFont === "jakarta" || storedFont === "inter" ? storedFont : "default");
    const storedFinancial = (localStorage.getItem("alphapips-font-financial") as DndFinancialFont) || "jetbrains";

    currentInterfaceFont = storedInterface;
    currentDisplayFont = storedDisplay;
    currentFinancialFont = storedFinancial;
    applyTypographyRolesToDOM(storedInterface, storedDisplay, storedFinancial);

    const density = (localStorage.getItem("dnd-density") as DndDensity) || "comfortable";
    currentDensity = density;
    document.documentElement.setAttribute("data-density", density);

    const fontSize = (localStorage.getItem("alphapips-font-size") as DndFontSize) || "medium";
    currentFontSize = fontSize;
    document.documentElement.setAttribute("data-font-size", fontSize);

    const monoNum = localStorage.getItem("alphapips-mono-numbers") === "true";
    currentMonoNumbers = monoNum;
    document.documentElement.setAttribute("data-mono-num", String(monoNum));

    const larger = localStorage.getItem("dnd-larger-text") === "true";
    if (larger) document.documentElement.setAttribute("data-larger-text", "true");

    const reducedMotion = localStorage.getItem("dnd-reduced-motion") === "true";
    if (reducedMotion) document.documentElement.style.setProperty("scroll-behavior", "auto");
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

export function setInterfaceFont(f: DndInterfaceFont) {
  if (typeof window === "undefined") return;
  currentInterfaceFont = f;
  try {
    localStorage.setItem("alphapips-font-interface", f);
  } catch {}
  document.documentElement.setAttribute("data-font-interface", f);
  notifyPrefs();
}

export function setDisplayFont(f: DndDisplayFont) {
  if (typeof window === "undefined") return;
  currentDisplayFont = f;
  try {
    localStorage.setItem("alphapips-font-display", f);
  } catch {}
  document.documentElement.setAttribute("data-font-display", f);
  notifyPrefs();
}

export function setFinancialFont(f: DndFinancialFont) {
  if (typeof window === "undefined") return;
  currentFinancialFont = f;
  try {
    localStorage.setItem("alphapips-font-financial", f);
  } catch {}
  document.documentElement.setAttribute("data-font-financial", f);
  notifyPrefs();
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

export function setDensity(d: DndDensity) {
  if (typeof window === "undefined") return;
  currentDensity = d;
  localStorage.setItem("dnd-density", d);
  document.documentElement.setAttribute("data-density", d);
  notifyPrefs();
}

export function setFontSize(size: DndFontSize) {
  if (typeof window === "undefined") return;
  currentFontSize = size;
  localStorage.setItem("alphapips-font-size", size);
  document.documentElement.setAttribute("data-font-size", size);
  notifyPrefs();
}

export function setMonoNumbers(on: boolean) {
  if (typeof window === "undefined") return;
  currentMonoNumbers = on;
  localStorage.setItem("alphapips-mono-numbers", String(on));
  document.documentElement.setAttribute("data-mono-num", String(on));
  notifyPrefs();
}

export function setLargerText(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("dnd-larger-text", String(on));
  document.documentElement.setAttribute("data-larger-text", String(on));
  notifyPrefs();
}

export function setReducedMotion(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("dnd-reduced-motion", String(on));
  if (on) document.documentElement.style.setProperty("scroll-behavior", "auto");
  notifyPrefs();
}

// Test & development instrumentation — strictly gated to non-production environments
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as any).__themeControl = {
    setTheme,
    setDensity,
    setFont,
    setInterfaceFont,
    setDisplayFont,
    setFinancialFont,
    getTheme,
  };
}

/**
 * Reactive hook for all user appearance, typography, and density preferences.
 */
export function usePreferences() {
  const [theme, setThemeState] = useState<DndTheme>(currentTheme);
  const [font, setFontState] = useState<DndFont>(currentFont);
  const [interfaceFont, setInterfaceFontState] = useState<DndInterfaceFont>(currentInterfaceFont);
  const [displayFont, setDisplayFontState] = useState<DndDisplayFont>(currentDisplayFont);
  const [financialFont, setFinancialFontState] = useState<DndFinancialFont>(currentFinancialFont);
  const [fontSize, setFontSizeState] = useState<DndFontSize>(currentFontSize);
  const [density, setDensityState] = useState<DndDensity>(currentDensity);
  const [monoNumbers, setMonoNumbersState] = useState<boolean>(currentMonoNumbers);

  useEffect(() => {
    const update = () => {
      setThemeState(currentTheme);
      setFontState(currentFont);
      setInterfaceFontState(currentInterfaceFont);
      setDisplayFontState(currentDisplayFont);
      setFinancialFontState(currentFinancialFont);
      setFontSizeState(currentFontSize);
      setDensityState(currentDensity);
      setMonoNumbersState(currentMonoNumbers);
    };

    update();
    prefsListeners.add(update);
    return () => {
      prefsListeners.delete(update);
    };
  }, []);

  return {
    theme,
    setTheme,
    font,
    setFont,
    interfaceFont,
    setInterfaceFont,
    displayFont,
    setDisplayFont,
    financialFont,
    setFinancialFont,
    fontSize,
    setFontSize,
    density,
    setDensity,
    monoNumbers,
    setMonoNumbers,
  };
}
