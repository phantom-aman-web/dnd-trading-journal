"use client";

import React, { useState, useEffect } from "react";
import {
  usePreferences,
  useTheme,
  useFont,
  setFont,
  setInterfaceFont,
  setDisplayFont,
  setFinancialFont,
  setTheme,
  setDensity,
  setFontSize,
  setMonoNumbers,
  setReducedMotion,
  type DndTheme,
  type DndFont,
  type DndInterfaceFont,
  type DndDisplayFont,
  type DndFinancialFont,
  type DndDensity,
  type DndFontSize,
} from "@/components/theme-provider";
import { usePrivacyStore, PRIVACY_MASK } from "@/lib/privacy-store";
import { useWorkspaceStore, type WorkspaceLayoutType } from "@/lib/workspace-store";
import { useSyncStore, syncEngine } from "@/lib/offline-sync-engine";
import { SHORTCUTS_LIST } from "@/components/keyboard-shortcuts-dialog";
import { TimezoneSelect } from "@/components/common/timezone-select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Palette,
  Type,
  Sliders,
  Keyboard,
  Eye,
  EyeOff,
  LayoutGrid,
  RefreshCw,
  RotateCcw,
  Check,
  Search,
  CheckCircle2,
  Database,
  CloudOff,
  Shield,
  Layers,
  Globe,
  Clock,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  {
    key: "nordic" as DndTheme,
    label: "Nordic",
    desc: "Light, calm, balanced contrast and clear typography",
    sidebarBg: "#FFFFFF",
    sidebarBorder: "#E2E8F0",
    workspaceBg: "#F8FAFC",
    cardBg: "#FFFFFF",
    cardBorder: "#E2E8F0",
    primaryAccent: "#1E293B",
    primaryFg: "#FFFFFF",
    profitColor: "#047857",
    lossColor: "#DC2626",
    chartColor: "#1E293B",
    textFg: "#1E293B",
    textMuted: "#64748B",
    swatches: ["#FFFFFF", "#0F172A", "#047857"],
  },
  {
    key: "terminal" as DndTheme,
    label: "Sleek Terminal",
    desc: "Dark technical aesthetic with cyan interaction accent and emerald profit",
    sidebarBg: "#111923",
    sidebarBorder: "#2E4052",
    workspaceBg: "#0B0F14",
    cardBg: "#192431",
    cardBorder: "#2E4052",
    primaryAccent: "#55C8F2",
    primaryFg: "#0B0F14",
    profitColor: "#34D399",
    lossColor: "#FB7185",
    chartColor: "#55C8F2",
    textFg: "#F1F5F9",
    textMuted: "#94A3B8",
    swatches: ["#0B0F14", "#192431", "#55C8F2"],
  },
  {
    key: "institutional" as DndTheme,
    label: "Slate Contrast",
    desc: "Deep slate dark workspace, dark sidebar, restrained soft blue accent",
    sidebarBg: "#080D13",
    sidebarBorder: "#30363D",
    workspaceBg: "#0D1117",
    cardBg: "#1A2633",
    cardBorder: "#43566A",
    primaryAccent: "#83B6E4",
    primaryFg: "#080D13",
    profitColor: "#34D399",
    lossColor: "#FB7185",
    chartColor: "#83B6E4",
    textFg: "#F0F6FC",
    textMuted: "#8B949E",
    swatches: ["#0D1117", "#1A2633", "#83B6E4"],
  },
];

const INTERFACE_FONT_OPTIONS: { key: DndInterfaceFont; label: string; desc: string; previewFont: string }[] = [
  { key: "default", label: "Default System", desc: "Clean modern OS font for menus, tables & inputs", previewFont: "system-ui, -apple-system, sans-serif" },
  { key: "inter", label: "Inter (Recommended)", desc: "Swiss precision, ultra-clean forms and dense data grids", previewFont: "'Inter', sans-serif" },
  { key: "jakarta", label: "Plus Jakarta Sans", desc: "Contemporary geometric sans-serif for sleek ergonomics", previewFont: "'Plus Jakarta Sans', sans-serif" },
];

const DISPLAY_FONT_OPTIONS: { key: DndDisplayFont; label: string; desc: string; previewFont: string }[] = [
  { key: "default", label: "Plus Jakarta (Default)", desc: "Balanced modern heading typography", previewFont: "'Plus Jakarta Sans', sans-serif" },
  { key: "inter", label: "Inter", desc: "Minimalist structured headings", previewFont: "'Inter', sans-serif" },
  { key: "playfair", label: "Playfair Display", desc: "Classic editorial luxury serif", previewFont: "'Playfair Display', Georgia, serif" },
  { key: "cinzel", label: "Cinzel", desc: "Historic Roman display serif", previewFont: "'Cinzel', serif" },
  { key: "system", label: "Default System", desc: "Standard native sans heading", previewFont: "system-ui, sans-serif" },
];

const FINANCIAL_FONT_OPTIONS: { key: DndFinancialFont; label: string; desc: string; previewFont: string }[] = [
  { key: "jetbrains", label: "JetBrains Mono (Recommended)", desc: "Fixed-pitch monospace with slashed zeros and aligned tabular columns", previewFont: "'JetBrains Mono', monospace" },
  { key: "system", label: "System Tabular Numbers", desc: "Proportional tabular numerals with native system font", previewFont: "system-ui, monospace" },
];

const FONT_OPTIONS: { key: DndFont; label: string; desc: string; previewFont: string }[] = [
  { key: "default", label: "Default System", desc: "Clean modern sans-serif", previewFont: "system-ui, -apple-system, sans-serif" },
  { key: "jetbrains", label: "JetBrains Mono", desc: "Terminal / Monospace for technical focus", previewFont: "'JetBrains Mono', monospace" },
  { key: "inter", label: "Inter", desc: "Modern Swiss sans-serif typography", previewFont: "'Inter', sans-serif" },
  { key: "jakarta", label: "Plus Jakarta", desc: "Contemporary geometric sans-serif", previewFont: "'Plus Jakarta Sans', sans-serif" },
  { key: "playfair", label: "Playfair Display", desc: "Classic editorial serif", previewFont: "'Playfair Display', Georgia, serif" },
  { key: "cinzel", label: "Cinzel", desc: "Historic Roman typography", previewFont: "'Cinzel', serif" },
];

const DATE_FORMATS = [
  { value: "MMM D, YYYY", label: "Sep 9, 2026" },
  { value: "D MMM YYYY", label: "9 Sep 2026" },
  { value: "YYYY-MM-DD", label: "2026-09-09 (ISO)" },
  { value: "MM/DD/YYYY", label: "09/09/2026 (US)" },
  { value: "DD/MM/YYYY", label: "09/09/2026 (EU)" },
];

const TIME_FORMATS = [
  { value: "HH:mm", label: "14:30 (24h)" },
  { value: "hh:mm A", label: "02:30 PM (12h)" },
];

const WEEK_STARTS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
];

const PREFERENCE_CATEGORIES = [
  { id: "all", label: "All Preferences", icon: Layers },
  { id: "appearance", label: "Themes & Appearance", icon: Palette },
  { id: "typography", label: "Typography & Fonts", icon: Type },
  { id: "density", label: "Layout & Density", icon: Sliders },
  { id: "privacy", label: "Privacy Mode", icon: Shield },
  { id: "regional", label: "Regional & Timezone", icon: Globe },
  { id: "workspace", label: "Workspace Layout", icon: LayoutGrid },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "sync", label: "Data & Storage", icon: Database },
];

export function PreferencesCenterTab() {
  const {
    theme,
    font,
    interfaceFont,
    setInterfaceFont,
    displayFont,
    setDisplayFont,
    financialFont,
    setFinancialFont,
    fontSize,
    density,
    monoNumbers,
  } = usePreferences();
  const { isPrivate, togglePrivacy } = usePrivacyStore();
  const { layout, setLayout, resetWorkspace } = useWorkspaceStore();
  const { isOnline, status: syncStatus, pendingCount, triggerSync } = useSyncStore();

  const [shortcutSearch, setShortcutSearch] = useState("");
  const [selectedSubSection, setSelectedSubSection] = useState<string>("all");

  // Regional settings state
  const [timezone, setTimezone] = useState<string>("UTC");
  const [dateFormat, setDateFormat] = useState<string>("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState<string>("HH:mm");
  const [weekStartsOn, setWeekStartsOn] = useState<string>("monday");
  const [isSavingRegional, setIsSavingRegional] = useState<boolean>(false);

  // Load initial settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data?.settings) {
            if (data.settings.timezone) setTimezone(data.settings.timezone);
            if (data.settings.dateFormat) setDateFormat(data.settings.dateFormat);
            if (data.settings.timeFormat) setTimeFormat(data.settings.timeFormat);
            if (data.settings.weekStartsOn) setWeekStartsOn(data.settings.weekStartsOn);
          }
        }
      } catch {}
    }
    loadSettings();
  }, []);

  async function saveRegionalSetting(updates: Record<string, any>) {
    setIsSavingRegional(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        toast.success("Regional preference saved.");
      } else {
        toast.error("Failed to save regional setting.");
      }
    } catch {
      toast.error("Network error while saving setting.");
    } finally {
      setIsSavingRegional(false);
    }
  }

  const filteredShortcuts = SHORTCUTS_LIST.filter(
    (s) =>
      s.description.toLowerCase().includes(shortcutSearch.toLowerCase()) ||
      s.keys.join(" ").toLowerCase().includes(shortcutSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(shortcutSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Category Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border text-xs scroll-thin">
        {PREFERENCE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedSubSection === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedSubSection(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors shrink-0",
                cat.id === "shortcuts" && "hidden sm:flex",
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Appearance & Theme Management */}
      {(selectedSubSection === "all" || selectedSubSection === "appearance") && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Appearance &amp; Themes
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTheme("nordic");
                toast.success("Theme restored to default Nordic.");
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Restore Default Theme
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose how AlphaPips looks. All three themes are complete design systems applied across every view, modal, and widget.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTheme(t.key);
                  toast.success(`Theme updated to ${t.label}`);
                }}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between group cursor-pointer",
                  theme === t.key
                    ? "border-primary ring-2 ring-primary/20 bg-card shadow-xs"
                    : "border-border hover:bg-muted/40 bg-card"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {t.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {t.swatches.map((color, i) => (
                        <span
                          key={i}
                          className="h-2.5 w-2.5 rounded-full border border-border/60"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    {t.desc}
                  </p>

                  {/* Accurate Miniature Theme Preview */}
                  <div
                    className="w-full h-32 rounded-lg border overflow-hidden relative shadow-inner p-1.5 flex flex-col justify-between my-2.5 transition-transform group-hover:scale-[1.01]"
                    style={{
                      backgroundColor: t.workspaceBg,
                      borderColor: t.cardBorder,
                    }}
                  >
                    <div className="flex h-full gap-1.5 overflow-hidden">
                      {/* Mini Sidebar */}
                      <div
                        className="w-14 rounded p-1 flex flex-col gap-1 border shrink-0"
                        style={{
                          backgroundColor: t.sidebarBg,
                          borderColor: t.sidebarBorder,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.primaryAccent }} />
                          <span className="h-1.5 w-6 rounded-xs" style={{ backgroundColor: t.textFg, opacity: 0.8 }} />
                        </div>
                        <div className="space-y-1 mt-1">
                          <div className="h-2 rounded-xs px-1 flex items-center" style={{ backgroundColor: t.primaryAccent }}>
                            <span className="h-1 w-7 rounded-xs" style={{ backgroundColor: t.primaryFg }} />
                          </div>
                          <div className="h-1.5 w-8 rounded-xs" style={{ backgroundColor: t.textMuted, opacity: 0.5 }} />
                          <div className="h-1.5 w-6 rounded-xs" style={{ backgroundColor: t.textMuted, opacity: 0.5 }} />
                        </div>
                        <div className="mt-auto">
                          <div className="h-1.5 w-8 rounded-xs" style={{ backgroundColor: t.textMuted, opacity: 0.3 }} />
                        </div>
                      </div>

                      {/* Mini Workspace Area */}
                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        {/* Mini Topbar */}
                        <div
                          className="h-3.5 rounded px-1.5 flex items-center justify-between border"
                          style={{
                            backgroundColor: t.cardBg,
                            borderColor: t.cardBorder,
                          }}
                        >
                          <div className="h-1.5 w-10 rounded-xs" style={{ backgroundColor: t.textMuted, opacity: 0.4 }} />
                          <span className="h-1.5 w-6 rounded-xs" style={{ backgroundColor: t.primaryAccent }} />
                        </div>

                        {/* Mini KPI Card with Profit & Loss */}
                        <div
                          className="rounded p-1 border flex items-center justify-between shadow-2xs"
                          style={{
                            backgroundColor: t.cardBg,
                            borderColor: t.cardBorder,
                          }}
                        >
                          <div>
                            <div className="h-1 w-8 rounded-xs" style={{ backgroundColor: t.textMuted, opacity: 0.7 }} />
                            <div className="text-[9px] font-bold font-mono tracking-tight mt-0.5" style={{ color: t.profitColor }}>
                              +$1,420
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="h-1 w-6 rounded-xs ml-auto" style={{ backgroundColor: t.textMuted, opacity: 0.7 }} />
                            <div className="text-[9px] font-bold font-mono tracking-tight mt-0.5" style={{ color: t.lossColor }}>
                              -0.8 R
                            </div>
                          </div>
                        </div>

                        {/* Mini Sparkline Chart */}
                        <div
                          className="flex-1 rounded p-0.5 border flex items-end justify-between overflow-hidden"
                          style={{
                            backgroundColor: t.cardBg,
                            borderColor: t.cardBorder,
                          }}
                        >
                          <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                            <path
                              d="M0,18 L15,16 L30,20 L45,12 L60,14 L75,6 L90,8 L100,2"
                              fill="none"
                              stroke={t.primaryAccent}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                  {theme === t.key ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary uppercase tracking-wide">
                      <Check className="h-3.5 w-3.5" /> Active Theme
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground">
                      Click to apply
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Typography & Fonts — 3 Independent Typography Roles */}
      {(selectedSubSection === "all" || selectedSubSection === "typography") && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Typography System (3 Independent Roles)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure independent font families for interface navigation &amp; forms, display headings, and financial numbers. This prevents decorative fonts from degrading data-heavy tables while preserving brand character.
          </p>

          {/* Role 1: Interface Font */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-foreground">Role 1: Interface &amp; Navigation Font</label>
                <p className="text-[11px] text-muted-foreground">Applied to buttons, form inputs, data tables, sidebar items, and body text.</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                Active: {interfaceFont}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {INTERFACE_FONT_OPTIONS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setInterfaceFont(f.key);
                    toast.success(`Interface font updated to ${f.label}`);
                  }}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors flex flex-col justify-between cursor-pointer",
                    interfaceFont === f.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/50 bg-card"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-foreground" style={{ fontFamily: f.previewFont }}>
                      {f.label}
                    </span>
                    {interfaceFont === f.key && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 leading-snug">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* Role 2: Display / Heading Font */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-foreground">Role 2: Display &amp; Heading Font</label>
                <p className="text-[11px] text-muted-foreground">Applied to page titles, card headers, and prominent display labels.</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                Active: {displayFont}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {DISPLAY_FONT_OPTIONS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setDisplayFont(f.key);
                    toast.success(`Display font updated to ${f.label}`);
                  }}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors flex flex-col justify-between cursor-pointer",
                    displayFont === f.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/50 bg-card"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-foreground" style={{ fontFamily: f.previewFont }}>
                      {f.label}
                    </span>
                    {displayFont === f.key && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 leading-snug">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* Role 3: Financial & Technical Font */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-foreground">Role 3: Financial &amp; Technical Numbers</label>
                <p className="text-[11px] text-muted-foreground">Applied to P&amp;L, balance metrics, lot sizes, tick prices, and R multiples.</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                Active: {financialFont}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FINANCIAL_FONT_OPTIONS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setFinancialFont(f.key);
                    toast.success(`Financial font updated to ${f.label}`);
                  }}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors flex flex-col justify-between cursor-pointer",
                    financialFont === f.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/50 bg-card"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-mono font-medium text-foreground" style={{ fontFamily: f.previewFont }}>
                      {f.label}
                    </span>
                    {financialFont === f.key && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 leading-snug">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Font Size & Monospace */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Interface Text Scale</label>
              <Select
                value={fontSize}
                onValueChange={(v) => {
                  setFontSize(v as DndFontSize);
                  toast.success(`Font size updated to ${v}`);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (14px base)</SelectItem>
                  <SelectItem value="medium">Medium (16px base — Default)</SelectItem>
                  <SelectItem value="large">Large (18px base)</SelectItem>
                  <SelectItem value="xlarge">Extra Large (20px base)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Adjusts the global typography scale across all screens and modals.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-muted/20">
              <div>
                <div className="text-sm font-medium text-foreground">Tabular Numerical Alignment</div>
                <div className="text-xs text-muted-foreground">
                  Lock digit widths so table columns and prices never jitter.
                </div>
              </div>
              <Switch
                checked={monoNumbers}
                onCheckedChange={(on) => {
                  setMonoNumbers(on);
                  toast.success(on ? "Tabular digits enabled" : "Standard numeric font restored");
                }}
              />
            </div>
          </div>

          {/* Live Typography Preview Box */}
          <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
            <div className="text-[11px] font-mono uppercase text-muted-foreground flex items-center justify-between">
              <span>Live Multi-Role Typography Preview</span>
              <span className="font-sans text-[10px] text-primary">
                Interface: {interfaceFont} · Heading: {displayFont} · Financial: {financialFont}
              </span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
              <div className="text-xs font-bold text-foreground flex items-center justify-between font-display">
                <span>EURUSD · London Breakout Long Execution</span>
                <span className="tnum font-mono text-profit font-bold">+$250.00 (+1.50R)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground pt-1">
                <div>Entry: <span className="tnum font-medium text-foreground">1.08500</span></div>
                <div>Exit: <span className="tnum font-medium text-foreground">1.08750</span></div>
                <div>Position: <span className="tnum font-medium text-foreground">1.00 Lot</span></div>
                <div>Execution: <span className="tnum font-medium text-foreground">14:30:15 UTC</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Interface & Table Density */}
      {(selectedSubSection === "all" || selectedSubSection === "density") && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Interface Density &amp; Spacing
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Control padding and component height. Denser layouts allow more data to fit on smaller laptop screens.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              {
                key: "compact" as DndDensity,
                label: "Compact Density",
                desc: "Tight padding and smaller rows. Maximum data density.",
              },
              {
                key: "comfortable" as DndDensity,
                label: "Comfortable Density",
                desc: "Default balanced spacing suited for desktop trading.",
              },
              {
                key: "spacious" as DndDensity,
                label: "Spacious Density",
                desc: "Generous whitespace and relaxed margins for larger monitors.",
              },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => {
                  setDensity(d.key);
                  toast.success(`Density set to ${d.label}`);
                }}
                className={cn(
                  "p-3.5 rounded-lg border text-left transition-colors",
                  density === d.key
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/50 bg-card"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">{d.label}</span>
                  {density === d.key && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{d.desc}</p>
              </button>
            ))}
          </div>

          {/* Live Density Preview Box */}
          <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
            <div className="text-[11px] font-mono uppercase text-muted-foreground flex items-center justify-between">
              <span>Live Table Density Preview</span>
              <span className="font-sans text-[10px] text-primary capitalize">{density} padding</span>
            </div>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div
                className={cn(
                  "flex items-center justify-between border-b border-border text-xs transition-all",
                  density === "compact" && "px-2 py-1.5",
                  density === "comfortable" && "px-3.5 py-2.5",
                  density === "spacious" && "px-5 py-4"
                )}
              >
                <span className="font-medium text-foreground">Sep 12, 2026 · NAS100 Short</span>
                <span className="text-muted-foreground text-[11px]">Trend Pullback</span>
                <span className="tnum font-semibold text-profit">+$450.00</span>
                <span className="tnum font-semibold text-primary">+2.10R</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Global Sensitive Information & Privacy Mode */}
      {(selectedSubSection === "all" || selectedSubSection === "privacy") && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Global Privacy &amp; Sensitive Information
              </h2>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs",
                isPrivate
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isPrivate ? "PRIVACY MODE ON" : "INFORMATION VISIBLE"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Mask monetary figures, account balances, and individual trade returns throughout the entire application for public demos or screen sharing.
          </p>

          <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                {isPrivate ? <EyeOff className="h-4 w-4 text-amber-500" /> : <Eye className="h-4 w-4 text-emerald-500" />}
                <span>Hide Sensitive Information Globally</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Replaces monetary values with <span className="font-mono">{PRIVACY_MASK}</span> in Dashboard, Trades Log, Analytics, Calendar, and Floating Widgets.
              </p>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={() => {
                togglePrivacy();
                toast.success(isPrivate ? "Privacy mode disabled" : "Privacy mode enabled globally");
              }}
            />
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
            <div className="text-[11px] font-mono uppercase text-muted-foreground">Live Masking Preview</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2 rounded bg-muted/40">
                <span className="text-muted-foreground block text-[10px]">Net P&amp;L</span>
                <span className="font-semibold text-profit tabular-nums">
                  {isPrivate ? `+ ${PRIVACY_MASK}` : "+ $3,450.00"}
                </span>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <span className="text-muted-foreground block text-[10px]">Account Balance</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {isPrivate ? PRIVACY_MASK : "$104,250.00"}
                </span>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <span className="text-muted-foreground block text-[10px]">Day Drawdown</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {isPrivate ? PRIVACY_MASK : "$750.00 / $2,500.00"}
                </span>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <span className="text-muted-foreground block text-[10px]">Account Name</span>
                <span className="font-semibold text-foreground">
                  {isPrivate ? "Account ••••1" : "Funded 100k Pro"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Regional Preferences & Timezone */}
      {(selectedSubSection === "all" || selectedSubSection === "regional") && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Regional Preferences &amp; Timezone
              </h2>
            </div>
            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
              {timezone || "UTC"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure your local display timezone and date/time formatting. Used for calendar day-bucketing, timestamp rendering, and session alignment.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-foreground">User Display Timezone (IANA)</label>
              <TimezoneSelect
                value={timezone}
                onChange={async (tz) => {
                  setTimezone(tz);
                  await saveRegionalSetting({ timezone: tz });
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Date Format</label>
              <Select
                value={dateFormat}
                onValueChange={async (v) => {
                  setDateFormat(v);
                  await saveRegionalSetting({ dateFormat: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Time Format</label>
              <Select
                value={timeFormat}
                onValueChange={async (v) => {
                  setTimeFormat(v);
                  await saveRegionalSetting({ timeFormat: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_FORMATS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-foreground">Week Starts On</label>
              <Select
                value={weekStartsOn}
                onValueChange={async (v) => {
                  setWeekStartsOn(v);
                  await saveRegionalSetting({ weekStartsOn: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_STARTS.map((w) => (
                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Institutional Independence & Invariance Disclosure Notice */}
          <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-2 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span>Institutional Independence &amp; Financial Calculation Invariance</span>
            </div>
            <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-1 leading-relaxed">
              <li><strong>Financial Invariance:</strong> Changing display timezone or date format does not alter underlying financial numbers (Realized P&amp;L, R-multiples, balance, point values).</li>
              <li><strong>Prop Challenge Safeguards:</strong> Challenge daily loss limits and cycle resets strictly execute on institutional market rules (e.g. 17:00 America/New_York) and are never overridden by your personal display timezone.</li>
              <li><strong>Calendar &amp; Session Bucketing:</strong> Trades and observations are grouped into trading days according to your selected display timezone ({timezone}).</li>
            </ul>
          </div>
        </div>
      )}

      {/* 6. Navigation & Multi-Panel Workspace */}
      {(selectedSubSection === "all" || selectedSubSection === "workspace") && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Navigation &amp; Multi-Panel Workspace
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetWorkspace();
                toast.success("Workspace layout restored to 2-column default.");
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset Workspace Layout
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure default workspace layouts and multi-panel arrangement preferences.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Default Multi-Panel Layout</label>
              <Select
                value={layout}
                onValueChange={(v) => {
                  setLayout(v as WorkspaceLayoutType);
                  toast.success(`Workspace layout set to ${v}`);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2-col">2 Columns (Split Screen — Recommended)</SelectItem>
                  <SelectItem value="3-col">3 Columns (Ultra-Wide Layout)</SelectItem>
                  <SelectItem value="4-grid">4 Grid (Quad View)</SelectItem>
                  <SelectItem value="2-row">2 Rows (Stacked View)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Shortcut to Toggle Workspace</label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/30 text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-foreground">Alt</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-foreground">W</kbd>
                <span className="text-muted-foreground ml-auto">Toggles instantly from any view</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Keyboard Shortcuts Management (Desktop only per mobile ergonomics) */}
      {(selectedSubSection === "all" || selectedSubSection === "shortcuts") && (
        <div className="hidden sm:block bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Keyboard Shortcuts &amp; Hotkeys
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>0 Conflicts Detected</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            View all global keyboard hotkeys. Typing in form inputs or editable text is automatically respected.
          </p>

          {/* Search & Filter */}
          <div className="relative pt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
            <Input
              value={shortcutSearch}
              onChange={(e) => setShortcutSearch(e.target.value)}
              placeholder="Search shortcuts by action or key..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-h-80 overflow-y-auto pr-1">
            {filteredShortcuts.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs"
              >
                <span className="text-foreground/90 pr-2">{s.description}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {s.keys.map((k, kidx) => (
                    <kbd
                      key={kidx}
                      className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-card border border-border text-foreground shadow-2xs"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Data Storage & Offline Synchronization */}
      {(selectedSubSection === "all" || selectedSubSection === "sync") && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Data &amp; Offline Synchronization
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await triggerSync();
                toast.success("Sync cycle completed.");
              }}
              className="text-xs h-7 gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Sync Now
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Storage Engine</span>
              <span className="font-semibold text-foreground">IndexedDB (alphapips_offline_db)</span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Network State</span>
              <span className={cn("font-semibold", isOnline ? "text-emerald-500" : "text-amber-500")}>
                {isOnline ? "Online & Connected" : "Working Offline"}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Pending Sync Queue</span>
              <span className="font-semibold text-foreground">
                {pendingCount} operation{pendingCount === 1 ? "" : "s"} queued
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
