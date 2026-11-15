"use client";

import React, { useState } from "react";
import { usePreferences, useTheme, useFont, setFont, setTheme, setDensity, setFontSize, setMonoNumbers, setReducedMotion, type DndTheme, type DndFont, type DndDensity, type DndFontSize } from "@/components/theme-provider";
import { usePrivacyStore, PRIVACY_MASK } from "@/lib/privacy-store";
import { useWorkspaceStore, type WorkspaceLayoutType } from "@/lib/workspace-store";
import { useSyncStore, syncEngine } from "@/lib/offline-sync-engine";
import { SHORTCUTS_LIST } from "@/components/keyboard-shortcuts-dialog";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  {
    key: "nordic" as DndTheme,
    label: "Nordic Clean",
    desc: "Light, calm, balanced contrast and clear typography",
    swatches: ["#FFFFFF", "#0F172A", "#10B981"],
  },
  {
    key: "terminal" as DndTheme,
    label: "Sleek Terminal",
    desc: "Dark, technical aesthetic with cyan and emerald accents",
    swatches: ["#0B0F17", "#1E293B", "#06B6D4"],
  },
  {
    key: "institutional" as DndTheme,
    label: "Slate Contrast",
    desc: "Dark sidebar and high-contrast slate workspace for professional analysis",
    swatches: ["#0F172A", "#1E293B", "#38BDF8"],
  },
];

const FONT_OPTIONS: { key: DndFont; label: string; desc: string; previewFont: string }[] = [
  { key: "default", label: "Default System", desc: "Clean modern sans-serif", previewFont: "system-ui, -apple-system, sans-serif" },
  { key: "jetbrains", label: "JetBrains Mono", desc: "Terminal / Monospace for technical focus", previewFont: "'JetBrains Mono', monospace" },
  { key: "inter", label: "Inter", desc: "Modern Swiss sans-serif typography", previewFont: "'Inter', sans-serif" },
  { key: "jakarta", label: "Plus Jakarta", desc: "Contemporary geometric sans-serif", previewFont: "'Plus Jakarta Sans', sans-serif" },
  { key: "playfair", label: "Playfair Display", desc: "Classic editorial serif", previewFont: "'Playfair Display', Georgia, serif" },
  { key: "cinzel", label: "Cinzel", desc: "Historic Roman typography", previewFont: "'Cinzel', serif" },
];

export function PreferencesCenterTab() {
  const { theme, font, fontSize, density, monoNumbers } = usePreferences();
  const { isPrivate, togglePrivacy } = usePrivacyStore();
  const { layout, setLayout } = useWorkspaceStore();
  const { isOnline, status: syncStatus, pendingCount, triggerSync } = useSyncStore();

  const [shortcutSearch, setShortcutSearch] = useState("");
  const [selectedSubSection, setSelectedSubSection] = useState<string>("all");

  const filteredShortcuts = SHORTCUTS_LIST.filter(
    (s) =>
      s.description.toLowerCase().includes(shortcutSearch.toLowerCase()) ||
      s.keys.join(" ").toLowerCase().includes(shortcutSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(shortcutSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* 1. Appearance & Theme Management */}
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
              toast.success("Theme restored to default Nordic Clean.");
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
                "p-4 rounded-xl border text-left transition-all flex flex-col justify-between group",
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
                        className="h-3 w-3 rounded-full border border-border/60"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {t.desc}
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-border/50 flex items-center justify-between">
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

      {/* 2. Typography & Fonts */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Typography &amp; Readability
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure font family, base interface sizing, and numerical formatting to match your preferred trading ergonomics.
        </p>

        {/* Font Family Grid */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-medium text-foreground">Font Family</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFont(f.key);
                  toast.success(`Font updated to ${f.label}`);
                }}
                className={cn(
                  "p-3 rounded-lg border text-left transition-colors flex flex-col justify-between",
                  font === f.key
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/50 bg-card"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className="text-sm font-medium text-foreground"
                    style={{ fontFamily: f.previewFont }}
                  >
                    {f.label}
                  </span>
                  {font === f.key && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground mt-1">
                  {f.desc}
                </span>
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
              <div className="text-sm font-medium text-foreground">Monospace Financial Digits</div>
              <div className="text-xs text-muted-foreground">
                Format prices and P&amp;L with fixed-width tabular alignment.
              </div>
            </div>
            <Switch
              checked={monoNumbers}
              onCheckedChange={(on) => {
                setMonoNumbers(on);
                toast.success(on ? "Monospace digits enabled" : "Standard numeric font restored");
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. Interface & Table Density */}
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
      </div>

      {/* 4. Global Sensitive Information & Privacy Mode */}
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

      {/* 5. Navigation & Multi-Panel Workspace */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Navigation &amp; Multi-Panel Workspace
          </h2>
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
                <SelectItem value="3-col">3 Columns (Pro Trader Layout)</SelectItem>
                <SelectItem value="2-col">2 Columns (Split Screen)</SelectItem>
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

      {/* 6. Keyboard Shortcuts Management */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
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

      {/* 7. Data Storage & Offline Synchronization */}
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
    </div>
  );
}
