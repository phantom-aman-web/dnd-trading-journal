"use client";

/**
 * Settings — reorganised into four focused tabs.
 *
 *   1. Profile    — Personal (display name + email) · Regional preferences
 *                   (timezone, date format, time format, week starts on).
 *   2. Trading    — Defaults (account, instrument, risk %, session, timeframe)
 *                   · Risk management (max trades/day, daily loss limit %,
 *                   max risk per trade %, Normal/Warning/Critical banners)
 *                   · Instrument preferences (multi-select favourites).
 *   3. Appearance — Theme picker, density, larger text, reduced motion.
 *   4. Legal      — Terms / Privacy / Cookies + cookie consent management.
 *
 * Visual identity is unchanged: bg-background wrapper, bg-card sections with
 * border-border, primary CTA, semantic tokens only.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InstrumentSelector } from "@/components/common/instrument-selector";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  setTheme,
  setDensity,
  setLargerText,
  setReducedMotion,
  useTheme,
} from "@/components/theme-provider";
import { useConsent } from "@/lib/consent-store";
import { useAuth } from "@/lib/auth-store";
import { TimezoneSelect } from "@/components/common/timezone-select";
import { toast } from "sonner";
import {
  LogOut,
  Save,
  Shield,
  Palette,
  User,
  Sliders,
  Check,
  AlertTriangle,
  X,
  Trash2,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldLabel } from "@/components/common/field-label";

// ---------------------------------------------------------------------------
// Constants shared with the trade form for consistent option lists.
// ---------------------------------------------------------------------------

const SESSIONS = [
  { value: "asia", label: "Asia" },
  { value: "london", label: "London" },
  { value: "ny_am", label: "New York AM" },
  { value: "ny_pm", label: "New York PM" },
];

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];

const DATE_FORMATS = [
  { value: "MMM D, YYYY", label: "Sep 9, 2025" },
  { value: "D MMM YYYY", label: "9 Sep 2025" },
  { value: "YYYY-MM-DD", label: "2025-09-09" },
  { value: "MM/DD/YYYY", label: "09/09/2025 (US)" },
  { value: "DD/MM/YYYY", label: "09/09/2025 (EU)" },
];

const TIME_FORMATS = [
  { value: "HH:mm", label: "14:30 (24h)" },
  { value: "hh:mm A", label: "02:30 PM (12h)" },
];

const WEEK_STARTS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
];

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchSettings() {
  const res = await fetch("/api/settings", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

async function fetchMeta() {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch meta");
  return res.json();
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function SettingsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });
  const { data: meta } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeta,
  });

  // Personal (Profile)
  const [name, setName] = useState("");
  const { user } = useAuth();
  const email = user?.email ?? "";

  // Regional preferences (Profile)
  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState("MMM D, YYYY");
  const [timeFormat, setTimeFormat] = useState("HH:mm");
  const [weekStartsOn, setWeekStartsOn] = useState("monday");

  // Trading defaults
  const [defaultAccountId, setDefaultAccountId] = useState<string>("__none");
  const [defaultInstrument, setDefaultInstrument] = useState("");
  const [defaultRiskPct, setDefaultRiskPct] = useState("1");
  const [defaultSession, setDefaultSession] = useState("ny_am");
  const [defaultTimeframe, setDefaultTimeframe] = useState("5m");

  // Risk management
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number | "">("");
  const [dailyLossLimitPct, setDailyLossLimitPct] = useState("");
  const [maxRiskPerTradePct, setMaxRiskPerTradePct] = useState("");
  const [normalRiskMaxPct, setNormalRiskMaxPct] = useState("1.5");
  const [warningRiskMaxPct, setWarningRiskMaxPct] = useState("3");
  const [criticalRiskMaxPct, setCriticalRiskMaxPct] = useState("5");

  // Instrument preferences (multi-select from existing instruments)
  const [preferredInstruments, setPreferredInstruments] = useState<string[]>([]);
  const [preferredCustom, setPreferredCustom] = useState("");

  // Appearance
  const [density, setDensityState] = useState("comfortable");
  const [largerText, setLargerTextState] = useState(false);
  const [reducedMotion, setReducedMotionState] = useState(false);
  const { theme, setTheme: applyTheme } = useTheme();

  // Auth (Sign Out).
  const { signOut } = useAuth();

  // Dialog state for Clear Data / Delete Account (website-built popups,
  // not browser confirm() dialogs).
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearDataConfirmOpen, setClearDataConfirmOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false);

  // Hydrate state from the settings GET response once data arrives.
  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setTimezone(s.timezone ?? "UTC");
    setDateFormat(s.dateFormat ?? "MMM D, YYYY");
    setTimeFormat(s.timeFormat ?? "HH:mm");
    setWeekStartsOn(s.weekStartsOn ?? "monday");
    setDefaultAccountId(s.defaultAccountId ?? "__none");
    setDefaultInstrument(s.defaultInstrument ?? "");
    setDefaultRiskPct(s.defaultRiskPct ?? "1");
    setDefaultSession(s.defaultSession ?? "ny_am");
    setDefaultTimeframe(s.defaultTimeframe ?? "5m");
    setMaxTradesPerDay(s.maxTradesPerDay ?? s.dailyTradeLimit ?? "");
    setDailyLossLimitPct(s.dailyLossLimitPct ?? "");
    setMaxRiskPerTradePct(s.maxRiskPerTradePct != null ? String(s.maxRiskPerTradePct) : "");
    setNormalRiskMaxPct(String(s.normalRiskMaxPct ?? 1.5));
    setWarningRiskMaxPct(String(s.warningRiskMaxPct ?? 3));
    setCriticalRiskMaxPct(String(s.criticalRiskMaxPct ?? 5));
    setDensityState(s.density || "comfortable");
    setLargerTextState(s.largerText ?? false);
    setReducedMotionState(s.reducedMotion ?? false);
    // Preferred instruments is a JSON array of symbols.
    try {
      const parsed = s.preferredInstruments ? JSON.parse(s.preferredInstruments) : [];
      if (Array.isArray(parsed)) setPreferredInstruments(parsed);
    } catch {
      setPreferredInstruments([]);
    }
  }, [data]);

  useEffect(() => {
    if (data?.user?.name != null) setName(data.user.name);
  }, [data]);

  // Derived: account options + instrument options from /api/me.
  const accounts = useMemo<any[]>(() => meta?.accounts ?? [], [meta]);
  const instruments = useMemo<any[]>(() => meta?.instruments ?? [], [meta]);

  function togglePreferred(symbol: string) {
    setPreferredInstruments((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );
  }

  function addCustomPreferred() {
    const sym = preferredCustom.trim().toUpperCase();
    if (!sym) return;
    if (!preferredInstruments.includes(sym)) {
      setPreferredInstruments((prev) => [...prev, sym]);
    }
    setPreferredCustom("");
  }

  function removePreferred(symbol: string) {
    setPreferredInstruments((prev) => prev.filter((s) => s !== symbol));
  }

  async function saveSettings() {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        theme,
        density,
        largerText,
        reducedMotion,
        defaultRiskPct,
        defaultSession,
        defaultTimeframe,
        timezone,
        dateFormat,
        timeFormat,
        weekStartsOn,
        // Use __none sentinel as null on the API side.
        defaultAccountId: defaultAccountId === "__none" ? null : defaultAccountId,
        defaultInstrument: defaultInstrument.trim() || null,
        maxTradesPerDay: maxTradesPerDay === "" ? null : maxTradesPerDay,
        dailyLossLimitPct: dailyLossLimitPct.trim() === "" ? null : dailyLossLimitPct,
        maxRiskPerTradePct:
          maxRiskPerTradePct.trim() === "" ? null : Number(maxRiskPerTradePct),
        preferredInstruments: JSON.stringify(preferredInstruments),
        normalRiskMaxPct: Number(normalRiskMaxPct),
        warningRiskMaxPct: Number(warningRiskMaxPct),
        criticalRiskMaxPct: Number(criticalRiskMaxPct),
      }),
    });
    if (res.ok) {
      toast.success("Settings saved.");
      setTheme(theme as any);
      setDensity(density as any);
      setLargerText(largerText);
      setReducedMotion(reducedMotion);
      qc.invalidateQueries({ queryKey: ["settings"] });
    } else {
      toast.error("Failed to save settings.");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-background p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8 lg:px-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Profile, trading defaults, appearance &amp; legal preferences.
          </p>
        </div>

        <Tabs defaultValue="profile">
          <div className="border-b border-border overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 rounded-none gap-0 w-auto">
              <SettingsTabTrigger value="profile" icon={User}>Profile</SettingsTabTrigger>
              <SettingsTabTrigger value="trading" icon={Sliders}>Trading</SettingsTabTrigger>
              <SettingsTabTrigger value="appearance" icon={Palette}>Appearance</SettingsTabTrigger>
              <SettingsTabTrigger value="legal" icon={Shield}>Legal</SettingsTabTrigger>
            </TabsList>
          </div>

          {/* PROFILE TAB ------------------------------------------------- */}
          <TabsContent value="profile" className="mt-6 space-y-6 focus-visible:outline-none">
            {/* Personal */}
            <SettingsCard>
              <SettingsSectionHeading>Personal</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                How DnD addresses you. Email is read-only — used for sign-in and audit.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <div className="space-y-1.5">
                  <FieldLabel hint="Display name shown across the app">Display Name</FieldLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel hint="Email is read-only">Email</FieldLabel>
                  <Input
                    value={email}
                    readOnly
                    disabled
                    placeholder="you@example.com"
                    className="border-input rounded-lg bg-muted/40 text-muted-foreground"
                  />
                </div>
              </div>
            </SettingsCard>

            {/* Regional Preferences */}
            <SettingsCard>
              <SettingsSectionHeading>Regional Preferences</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                Used for calendar day bucketing, date/time rendering and weekly aggregation.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel required hint="IANA timezone for calendar bucketing">Timezone</FieldLabel>
                  <TimezoneSelect value={timezone} onChange={setTimezone} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel hint="How dates are rendered across the app">Date Format</FieldLabel>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground">
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
                  <FieldLabel hint="How times are rendered">Time Format</FieldLabel>
                  <Select value={timeFormat} onValueChange={setTimeFormat}>
                    <SelectTrigger className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_FORMATS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel hint="First day of the week in calendars">Week Starts On</FieldLabel>
                  <Select value={weekStartsOn} onValueChange={setWeekStartsOn}>
                    <SelectTrigger className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEK_STARTS.map((w) => (
                        <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground italic">
                    The New York market clock in the navbar automatically handles DST (EDT/EST). No manual configuration needed.
                  </p>
                </div>
              </div>
            </SettingsCard>

            <div className="flex justify-end">
              <Button
                onClick={saveSettings}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm"
              >
                <Save className="h-4 w-4" /> Save Profile
              </Button>
            </div>
          </TabsContent>

          {/* TRADING TAB -------------------------------------------------- */}
          <TabsContent value="trading" className="mt-6 space-y-6 focus-visible:outline-none">
            {/* Defaults */}
            <SettingsCard>
              <SettingsSectionHeading>Defaults</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                Pre-filled when you create a new trade. Pick the account and instrument you
                trade most often to skip a step every time.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <div className="space-y-1.5">
                  <FieldLabel hint="Pre-selected account in the trade form">Default Trading Account</FieldLabel>
                  <Select value={defaultAccountId} onValueChange={setDefaultAccountId}>
                    <SelectTrigger className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No default</SelectItem>
                      {accounts.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}{a.currency ? ` · ${a.currency}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {accounts.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      No accounts yet — add one from Accounts.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <FieldLabel hint="Symbol pre-filled in the trade form">Default Instrument</FieldLabel>
                  <InstrumentSelector
                    value={defaultInstrument}
                    onChange={(sym) => setDefaultInstrument(sym)}
                    placeholder="Select instrument…"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel hint="Default risk per trade (as % of equity)">Default Risk %</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={defaultRiskPct}
                    onChange={(e) => setDefaultRiskPct(e.target.value)}
                    className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel hint="Default session for new trades">Default Session</FieldLabel>
                  <Select value={defaultSession} onValueChange={setDefaultSession}>
                    <SelectTrigger className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel hint="Default chart timeframe for new trades">Default Timeframe</FieldLabel>
                  <Select value={defaultTimeframe} onValueChange={setDefaultTimeframe}>
                    <SelectTrigger className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEFRAMES.map((tf) => (
                        <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SettingsCard>

            {/* Risk Management */}
            <SettingsCard>
              <SettingsSectionHeading>Risk Management</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                Hard limits DnD will flag during trade entry. Leave blank to disable a guardrail.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mt-5">
                <div className="space-y-1.5">
                  <FieldLabel hint="Maximum number of trades per day">Max Trades / Day</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={maxTradesPerDay}
                    onChange={(e) =>
                      setMaxTradesPerDay(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="—"
                    className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel hint="Max daily loss as % of equity">Daily Loss Limit %</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={dailyLossLimitPct}
                    onChange={(e) => setDailyLossLimitPct(e.target.value)}
                    placeholder="—"
                    className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel hint="Maximum risk allowed on any single trade">Max Risk / Trade %</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={maxRiskPerTradePct}
                    onChange={(e) => setMaxRiskPerTradePct(e.target.value)}
                    placeholder="—"
                    className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground"
                  />
                </div>
              </div>

              <Separator className="bg-border my-5" />

              {/* Compact risk threshold banners */}
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                Risk Threshold Banners (compact)
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                DnD flags a trade&apos;s planned risk against these thresholds.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <CompactThreshold
                  label="Normal"
                  value={normalRiskMaxPct}
                  onChange={setNormalRiskMaxPct}
                  tone="profit"
                />
                <CompactThreshold
                  label="Warning"
                  value={warningRiskMaxPct}
                  onChange={setWarningRiskMaxPct}
                  tone="warning"
                />
                <CompactThreshold
                  label="Critical"
                  value={criticalRiskMaxPct}
                  onChange={setCriticalRiskMaxPct}
                  tone="loss"
                />
              </div>
            </SettingsCard>

            {/* Instrument Preferences */}
            <SettingsCard>
              <SettingsSectionHeading>Instrument Preferences</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                Favourite the instruments you trade most. They appear first in selectors,
                quick-add menus and analytics filters.
              </p>

              {preferredInstruments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {preferredInstruments.map((sym) => (
                    <span
                      key={sym}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium"
                    >
                      {sym}
                      <button
                        aria-label={`Remove ${sym}`}
                        onClick={() => removePreferred(sym)}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel hint="Tick instruments to mark them as favourites">
                    Available Instruments
                  </FieldLabel>
                  {instruments.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No instruments yet — add some from Accounts.
                    </p>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/20 p-3 max-h-56 overflow-y-auto scroll-thin">
                      <div className="grid sm:grid-cols-2 gap-2">
                        {instruments.map((i: any) => {
                          const checked = preferredInstruments.includes(i.symbol);
                          return (
                            <label
                              key={i.id}
                              className={cn(
                                "flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors",
                                checked
                                  ? "border-foreground/30 bg-card"
                                  : "border-border bg-card hover:bg-muted/50",
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => togglePreferred(i.symbol)}
                                aria-label={`Toggle favourite ${i.symbol}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            <span className="flex flex-col min-w-0">
                              <span className="text-sm font-medium tracking-tight truncate">
                                {i.symbol}
                              </span>
                              {i.name && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {i.name} · {i.market}
                                </span>
                              )}
                            </span>
                          </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel hint="Add a symbol not listed above">Add Custom Symbol</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. NAS100, SPX500"
                      value={preferredCustom}
                      onChange={(e) => setPreferredCustom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomPreferred();
                        }
                      }}
                      className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomPreferred}
                      className="border-input rounded-lg shrink-0"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </SettingsCard>

            {/* Save Preferences */}
            <div className="flex justify-end">
              <Button
                onClick={saveSettings}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm"
              >
                <Save className="h-4 w-4" /> Save Trading
              </Button>
            </div>

            {/* Account & Session */}
            <SettingsCard>
              <SettingsSectionHeading>Account &amp; Session</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                Manage your active session and account. Signing out will return you to the landing page.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => signOut()}
                  className="bg-red-50 text-loss hover:bg-loss/15 border-red-200 rounded-lg"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setClearDataOpen(true)}
                  className="bg-red-50 text-loss hover:bg-loss/15 border-red-200 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear User Data
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                "Clear User Data" permanently deletes all your trades, strategies, accounts, media, and settings. This action cannot be undone.
              </p>
            </SettingsCard>

            {/* Danger Zone — Delete Account */}
            <SettingsCard>
              <SettingsSectionHeading className="text-loss">Danger Zone</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                Permanently delete your entire account, including all data, credentials, and settings. This action is irreversible.
              </p>
              <div className="mt-5">
                <Button
                  variant="outline"
                  onClick={() => setDeleteAccountOpen(true)}
                  className="bg-red-50 text-loss hover:bg-loss/15 border-red-200 rounded-lg"
                >
                  <UserX className="h-4 w-4" />
                  Delete Account
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  "Delete Account" removes your user record entirely. You will need to sign up again to use DnD. All data is permanently lost.
                </p>
              </div>
            </SettingsCard>

            {/* Clear User Data Confirmation Dialog */}
            <AlertDialog open={clearDataOpen} onOpenChange={setClearDataOpen}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-loss" />
                    Clear All User Data?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                    This will permanently delete ALL your data — trades, strategies, accounts, media, settings, and everything else.
                    <br /><br />
                    <span className="font-semibold text-foreground">This cannot be undone.</span> Are you sure you want to continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      setClearDataOpen(false);
                      setClearDataConfirmOpen(true);
                    }}
                    className="rounded-lg bg-loss text-white hover:bg-loss/90"
                  >
                    Yes, continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Clear User Data — Final Warning */}
            <AlertDialog open={clearDataConfirmOpen} onOpenChange={setClearDataConfirmOpen}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-loss" />
                    Final Warning
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                    ALL your trading data will be permanently deleted. This includes every trade, strategy, account, screenshot, and setting.
                    <br /><br />
                    <span className="font-semibold text-foreground">There is no recovery from this action.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      setClearDataConfirmOpen(false);
                      try {
                        const res = await fetch("/api/clear-data", { method: "DELETE" });
                        if (res.ok) {
                          toast.success("All user data has been cleared.");
                          qc.invalidateQueries();
                        } else {
                          toast.error("Failed to clear data. Please try again.");
                        }
                      } catch {
                        toast.error("Network error while clearing data.");
                      }
                    }}
                    className="rounded-lg bg-loss text-white hover:bg-loss/90"
                  >
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete Account Confirmation Dialog */}
            <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <UserX className="h-5 w-5 text-loss" />
                    Delete Your Account?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                    This will PERMANENTLY DELETE your entire account — your user record, all trades, strategies, accounts, media, settings, and legal consent records.
                    <br /><br />
                    <span className="font-semibold text-foreground">This is completely irreversible.</span> Are you absolutely sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setDeleteAccountOpen(false);
                      setDeleteAccountConfirmOpen(true);
                    }}
                    className="rounded-lg bg-loss text-white hover:bg-loss/90"
                  >
                    Yes, continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete Account — Final Warning */}
            <AlertDialog open={deleteAccountConfirmOpen} onOpenChange={setDeleteAccountConfirmOpen}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <UserX className="h-5 w-5 text-loss" />
                    Final Warning
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                    Your account and ALL associated data will be permanently deleted. You will need to create a new account to use DnD again.
                    <br /><br />
                    <span className="font-semibold text-foreground">All data is permanently lost.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      setDeleteAccountConfirmOpen(false);
                      try {
                        const res = await fetch("/api/delete-account", { method: "DELETE" });
                        if (res.ok) {
                          toast.success("Account deleted. Redirecting...");
                          localStorage.clear();
                          sessionStorage.clear();
                          window.location.href = "/";
                        } else {
                          const data = await res.json().catch(() => null);
                          toast.error(data?.error ?? "Failed to delete account.");
                        }
                      } catch {
                        toast.error("Network error while deleting account.");
                      }
                    }}
                    className="rounded-lg bg-loss text-white hover:bg-loss/90"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          {/* APPEARANCE TAB --------------------------------------------- */}
          <TabsContent value="appearance" className="mt-6 space-y-6 focus-visible:outline-none">
            <SettingsCard>
              <SettingsSectionHeading>Theme</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                Choose how DnD looks. Each theme is a complete visual system.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                {[
                  { key: "nordic", label: "Nordic Clean", desc: "Light, quiet, precise" },
                  { key: "terminal", label: "Sleek Terminal", desc: "Dark, technical" },
                  { key: "institutional", label: "Institutional", desc: "Premium, analytical" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => applyTheme(t.key as any)}
                    className={cn(
                      "p-4 rounded-lg border text-left transition-colors",
                      theme === t.key
                        ? "border-foreground ring-2 ring-foreground/20 bg-card"
                        : "border-border hover:bg-muted/50 bg-card",
                    )}
                  >
                    <div className="font-medium text-sm text-foreground">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                    {theme === t.key && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary uppercase tracking-wide">
                        <Check className="h-3 w-3" /> Active
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </SettingsCard>

            <SettingsCard>
              <SettingsSectionHeading>Display</SettingsSectionHeading>
              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <FieldLabel required>Density</FieldLabel>
                  <Select
                    value={density}
                    onValueChange={(v) => {
                      setDensityState(v);
                      setDensity(v as any);
                    }}
                  >
                    <SelectTrigger className="border-input rounded-lg focus-visible:ring-foreground focus-visible:border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">Larger Text</div>
                    <div className="text-xs text-muted-foreground">
                      Increase base font size for readability.
                    </div>
                  </div>
                  <Switch
                    checked={largerText}
                    onCheckedChange={(v) => {
                      setLargerTextState(v);
                      setLargerText(v);
                    }}
                  />
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">Reduced Motion</div>
                    <div className="text-xs text-muted-foreground">
                      Minimize animations and transitions.
                    </div>
                  </div>
                  <Switch
                    checked={reducedMotion}
                    onCheckedChange={(v) => {
                      setReducedMotionState(v);
                      setReducedMotion(v);
                    }}
                  />
                </div>
              </div>
            </SettingsCard>

            <div className="flex justify-end">
              <Button
                onClick={saveSettings}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm"
              >
                <Save className="h-4 w-4" /> Save Appearance
              </Button>
            </div>
          </TabsContent>

          {/* LEGAL TAB -------------------------------------------------- */}
          <TabsContent value="legal" className="mt-6 space-y-6 focus-visible:outline-none">
            <SettingsCard>
              <SettingsSectionHeading>Legal Documents</SettingsSectionHeading>
              <p className="text-xs text-muted-foreground mt-1">
                Review the policies that govern your use of DnD. Acceptance is recorded against
                the version shown.
              </p>
              <div className="mt-5 space-y-2">
                <LegalDoc doc="terms" label="Terms of Service" />
                <LegalDoc doc="privacy" label="Privacy Policy" />
                <LegalDoc doc="cookies" label="Cookie Policy" />
              </div>
              <Separator className="bg-border my-4" />
              <CookieConsentManagement />
              <Separator className="bg-border my-4" />
              <p className="text-xs text-muted-foreground">
                DnD is a trading journaling, analytics and performance-management product. It is
                not financial advice, not investment advice, and does not guarantee profit.
              </p>
            </SettingsCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational primitives (premium navy/white-card aesthetic)
// ---------------------------------------------------------------------------

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      {children}
    </div>
  );
}

function SettingsSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
      {children}
    </h2>
  );
}

function SettingsTabTrigger({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium whitespace-nowrap gap-1.5",
        "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-foreground data-[state=active]:text-foreground",
        "text-muted-foreground hover:text-foreground",
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </TabsTrigger>
  );
}

// Compact threshold input used in the Risk Management card.

function CompactThreshold({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tone: "profit" | "warning" | "loss";
}) {
  const toneRing =
    tone === "profit"
      ? "focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
      : tone === "warning"
        ? "focus-visible:ring-amber-500 focus-visible:border-amber-500"
        : "focus-visible:ring-red-500 focus-visible:border-red-500";
  const toneChip =
    tone === "profit"
      ? "border-emerald-200 bg-emerald-50 text-profit"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-warning"
        : "border-red-200 bg-red-50 text-loss";
  return (
    <div className="space-y-1.5">
      <FieldLabel hint={`Up to this % is ${label.toLowerCase()}`}>{label} Max %</FieldLabel>
      <Input
        type="number"
        min="0"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("border-input rounded-lg", toneRing)}
      />
      <div className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium", toneChip)}>
        {tone === "profit" && <Check className="h-3 w-3" />}
        {tone !== "profit" && <AlertTriangle className="h-3 w-3" />}
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LegalDoc — preserved from prior task (reads /api/legal/[doc], allows
// acceptance / re-acceptation on version changes).
// ---------------------------------------------------------------------------

function LegalDoc({ doc, label }: { doc: string; label: string }) {
  const [state, setState] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/legal/${doc}`).then((r) => r.json()).then(setState);
  }, [doc]);

  async function accept() {
    const res = await fetch(`/api/legal/${doc}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      toast.success(`${label} accepted.`);
      const data = await res.json();
      setState({
        ...state,
        accepted: true,
        acceptedAt: data.acceptedAt,
        isCurrent: true,
        version: data.version,
      });
    }
  }

  const needsAccept = state && (!state.accepted || state.isCurrent === false);

  return (
    <div className="flex items-center justify-between gap-3 py-2 rounded-lg hover:bg-muted/50 px-2 -mx-2">
      <div className="min-w-0">
        <div className="font-medium text-sm text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">
          {state ? (
            <>
              Version {state.version}
              {" · "}
              {state.accepted
                ? `Accepted ${new Date(state.acceptedAt).toLocaleDateString()}`
                : "Not yet accepted"}
              {state.isCurrent === false && (
                <span className="text-warning"> · outdated (v{state.acceptedVersion || "?"})</span>
              )}
            </>
          ) : (
            "Loading…"
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground hover:bg-background"
        >
          View
        </Button>
        {needsAccept && (
          <Button
            size="sm"
            onClick={accept}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Accept
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            {state && <DialogDescription>Version {state.version}</DialogDescription>}
          </DialogHeader>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {state?.content ?? "Document text."}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Cookie consent management — lets the user review and change their cookie
 * preferences from Settings → Legal. Reads from / writes to the same
 * consent-store used by the public banner.
 */
function CookieConsentManagement() {
  const { choice, timestamp, version, preferences, openSettings, reset } = useConsent();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-foreground uppercase tracking-wide">
        Cookie Consent
      </div>
      <div className="flex items-center justify-between gap-3 py-1">
        <div>
          <div className="text-sm text-foreground">
            {choice === "undecided"
              ? "No choice made yet."
              : choice === "accepted"
                ? `Accepted · ${timestamp ? new Date(timestamp).toLocaleDateString() : ""}`
                : `Rejected non-essential · ${timestamp ? new Date(timestamp).toLocaleDateString() : ""}`}
          </div>
          <div className="text-xs text-muted-foreground">consent v{version}</div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={openSettings}
            className="border-input text-foreground hover:bg-muted/50"
          >
            Manage
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            className="text-muted-foreground hover:bg-background"
          >
            Re-show banner
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-profit">
          Essential: on
        </span>
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-profit">
          Functional: on
        </span>
        <span
          className={cn(
            "rounded border px-2 py-1 font-medium",
            preferences.analytics
              ? "border-emerald-200 bg-emerald-50 text-profit"
              : "border-border bg-muted/50 text-muted-foreground",
          )}
        >
          Analytics: {preferences.analytics ? "on" : "off"}
        </span>
        <span
          className={cn(
            "rounded border px-2 py-1 font-medium",
            preferences.marketing
              ? "border-emerald-200 bg-emerald-50 text-profit"
              : "border-border bg-muted/50 text-muted-foreground",
          )}
        >
          Marketing: {preferences.marketing ? "on" : "off"}
        </span>
      </div>
    </div>
  );
}
