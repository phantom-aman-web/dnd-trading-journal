"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  X,
  Plus,
  Trash2,
  Wallet,
  Target,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNav } from "@/lib/nav-store";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOnboarding,
  TOTAL_SETUP_STEPS,
} from "@/lib/onboarding-store";
import { TimezoneSelect } from "@/components/common/timezone-select";
import { InstrumentSelector } from "@/components/common/instrument-selector";
import { INSTRUMENT_CATALOG, type InstrumentDef } from "@/lib/instrument-catalog";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
const SESSIONS = [
  { value: "asian_range", label: "Asian Range" },
  { value: "london_open", label: "London Open" },
  { value: "ny_am", label: "New York AM" },
  { value: "ny_lunch", label: "New York Lunch" },
  { value: "ny_pm", label: "New York PM" },
  { value: "off_hours", label: "Off Hours" },
];
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];

// Strategy templates
const STRATEGY_TEMPLATES = [
  { value: "blank", label: "Blank Strategy" },
  { value: "ict", label: "ICT 2022 Style" },
  { value: "trend", label: "Trend Following" },
  { value: "breakout", label: "Breakout" },
  { value: "custom", label: "Custom" },
];

const ICT_RULES = [
  { title: "HTF bias aligned", required: true, description: "4H/Daily direction confirmed" },
  { title: "Liquidity sweep confirmed", required: true, description: "Asian/London high or low swept" },
  { title: "Market structure shift on LTF", required: true, description: "1m/5m MS break with displacement" },
  { title: "Entry inside FVG", required: false, description: "Fair value gap retest" },
];

const TREND_RULES = [
  { title: "Higher timeframe trend confirmed", required: true, description: "Trade in direction of HTF trend" },
  { title: "Pullback to moving average", required: true, description: "Price retraces to 20/50 EMA" },
  { title: "Trend continuation signal", required: false, description: "Engulfing or pin bar" },
];

const BREAKOUT_RULES = [
  { title: "Range identified", required: true, description: "Clear consolidation zone" },
  { title: "Breakout with volume", required: true, description: "Above-average volume on breakout" },
  { title: "Retest of breakout level", required: false, description: "Wait for pullback to confirm" },
];

/* ------------------------------------------------------------------ */
/* Shared state — lifted to the parent so all steps preserve data     */
/* ------------------------------------------------------------------ */

interface SetupData {
  // Step 1: Profile
  name: string;
  timezone: string;
  currency: string;
  // Step 2: Account + Markets
  accountName: string;
  broker: string;
  accountType: string;
  startingBalance: string;
  selectedInstruments: string[];
  defaultInstrument: string;
  // Step 3: Strategy
  strategyName: string;
  strategyDescription: string;
  strategyTemplate: string;
  rules: { title: string; required: boolean; description: string }[];
  // Step 4: Risk + Defaults
  defaultRiskPct: string;
  defaultSession: string;
  defaultTimeframe: string;
  maxTradesPerDay: string;
  dailyLossLimitPct: string;
  maxRiskPerTradePct: string;
}

const DEFAULT_DATA: SetupData = {
  name: "",
  timezone: "UTC",
  currency: "USD",
  accountName: "Primary",
  broker: "",
  accountType: "live",
  startingBalance: "10000",
  selectedInstruments: [],
  defaultInstrument: "",
  strategyName: "",
  strategyDescription: "",
  strategyTemplate: "blank",
  rules: [{ title: "", required: true, description: "" }],
  defaultRiskPct: "1",
  defaultSession: "ny_am",
  defaultTimeframe: "5m",
  maxTradesPerDay: "",
  dailyLossLimitPct: "",
  maxRiskPerTradePct: "",
};

/* ------------------------------------------------------------------ */
/* Main Setup Wizard 2.0                                              */
/* ------------------------------------------------------------------ */

export function SetupWizard() {
  const { state, setupStep, nextSetupStep, prevSetupStep, setState } = useOnboarding();
  const visible = state === "setup";
  const { navigate } = useNav();
  const [data, setData] = useState<SetupData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setState("skipped");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, setState]);

  function update(patch: Partial<SetupData>) {
    setData((d) => ({ ...d, ...patch }));
  }

  function handleSkip() {
    setState("tour");
  }

  if (!visible) return null;

  const progress = ((setupStep + 1) / TOTAL_SETUP_STEPS) * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-xl animate-in zoom-in-95 duration-200">
        {/* Header — minimal, just close button */}
        <button
          aria-label="Close setup"
          onClick={() => setState("skipped")}
          className="absolute top-4 right-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress — subtle, just step numbers */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Step {setupStep + 1} of {TOTAL_SETUP_STEPS}
            </Badge>
            <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step body — all steps stay mounted to preserve state */}
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-4">
          <div className={setupStep === 0 ? "block" : "hidden"}>
            <Step1Profile data={data} update={update} loading={loading} />
          </div>
          <div className={setupStep === 1 ? "block" : "hidden"}>
            <Step2AccountMarkets data={data} update={update} loading={loading} />
          </div>
          <div className={setupStep === 2 ? "block" : "hidden"}>
            <Step3Strategy data={data} update={update} loading={loading} />
          </div>
          <div className={setupStep === 3 ? "block" : "hidden"}>
            <Step4RiskDefaults data={data} update={update} loading={loading} />
          </div>
          <div className={setupStep === 4 ? "block" : "hidden"}>
            <Step5Ready data={data} />
          </div>
        </div>

        {/* Footer — Back / Skip / Next */}
        <div className="flex items-center justify-between gap-2 border-t border-border p-4 px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => prevSetupStep()}
            disabled={setupStep === 0 || loading}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {setupStep < TOTAL_SETUP_STEPS - 1 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                disabled={loading}
                className="text-muted-foreground"
              >
                Skip for now
              </Button>
              <Button
                size="sm"
                onClick={() => nextSetupStep()}
                disabled={loading}
              >
                Continue
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <SaveAndFinish data={data} loading={loading} setLoading={setLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: Welcome + Trading Profile                                  */
/* ------------------------------------------------------------------ */

function Step1Profile({
  data,
  update,
  loading,
}: {
  data: SetupData;
  update: (patch: Partial<SetupData>) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 id="setup-title" className="text-xl font-semibold tracking-tight">
          Let&apos;s set up your workspace.
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          A few details will help DnD organize your trading day, calculations and reports around the way you trade.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Display Name</label>
          <Input
            value={data.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Your name"
            autoFocus
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Timezone</label>
          <TimezoneSelect
            value={data.timezone}
            onChange={(tz) => update({ timezone: tz })}
          />
          <p className="text-[11px] text-muted-foreground">
            Controls your trading dates, sessions, calendar and daily reports.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Base Currency</label>
          <Select value={data.currency} onValueChange={(v) => update({ currency: v })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: Your Markets + Trading Account                             */
/* ------------------------------------------------------------------ */

function Step2AccountMarkets({
  data,
  update,
  loading,
}: {
  data: SetupData;
  update: (patch: Partial<SetupData>) => void;
  loading: boolean;
}) {
  const [showAccount, setShowAccount] = useState(true);
  const markets = INSTRUMENT_CATALOG.reduce((acc, inst) => {
    if (!acc.find((m) => m.market === inst.market)) {
      acc.push({ market: inst.market, label: inst.market.charAt(0).toUpperCase() + inst.market.slice(1) });
    }
    return acc;
  }, [] as { market: string; label: string }[]);

  function toggleInstrument(symbol: string) {
    const current = data.selectedInstruments;
    if (current.includes(symbol)) {
      update({ selectedInstruments: current.filter((s) => s !== symbol) });
    } else {
      update({ selectedInstruments: [...current, symbol] });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">What do you trade?</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          Choose the markets you trade most often. DnD will use this information throughout your trading workflow.
        </p>
      </div>

      {/* Primary Trading Account */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <button
          onClick={() => setShowAccount(!showAccount)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Primary Trading Account</span>
          </div>
          <span className="text-xs text-muted-foreground">{showAccount ? "−" : "+"}</span>
        </button>
        {showAccount && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Account Name</label>
                <Input
                  value={data.accountName}
                  onChange={(e) => update({ accountName: e.target.value })}
                  placeholder="Primary"
                  disabled={loading}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Broker (optional)</label>
                <Input
                  value={data.broker}
                  onChange={(e) => update({ broker: e.target.value })}
                  placeholder="e.g. FTMO, IC Markets"
                  disabled={loading}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Account Type</label>
                <Select value={data.accountType} onValueChange={(v) => update({ accountType: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="prop">Prop Firm</SelectItem>
                    <SelectItem value="funded">Funded</SelectItem>
                    <SelectItem value="backtest">Backtest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Starting Balance</label>
                <Input
                  type="number"
                  value={data.startingBalance}
                  onChange={(e) => update({ startingBalance: e.target.value })}
                  disabled={loading}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Markets You Trade */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Markets You Trade</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Select the instruments you trade. These become your favorites for quick selection.
        </p>

        {markets.map((m) => {
          const instrumentsInMarket = INSTRUMENT_CATALOG.filter((i) => i.market === m.market);
          const selectedInMarket = data.selectedInstruments.filter((s) =>
            instrumentsInMarket.some((i) => i.symbol === s)
          );
          return (
            <div key={m.market} className="rounded-md border border-border">
              <button
                onClick={() => {
                  if (selectedInMarket.length === instrumentsInMarket.length) {
                    update({
                      selectedInstruments: data.selectedInstruments.filter(
                        (s) => !instrumentsInMarket.some((i) => i.symbol === s)
                      ),
                    });
                  } else {
                    update({
                      selectedInstruments: [
                        ...data.selectedInstruments,
                        ...instrumentsInMarket
                          .filter((i) => !data.selectedInstruments.includes(i.symbol))
                          .map((i) => i.symbol),
                      ],
                    });
                  }
                }}
                className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50"
              >
                <span className="text-xs font-semibold uppercase tracking-wide">{m.label}</span>
                <Badge variant="outline" className="text-[10px]">
                  {selectedInMarket.length}/{instrumentsInMarket.length}
                </Badge>
              </button>
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {instrumentsInMarket.map((inst) => {
                  const isSelected = data.selectedInstruments.includes(inst.symbol);
                  return (
                    <button
                      key={inst.symbol}
                      onClick={() => toggleInstrument(inst.symbol)}
                      className={cn(
                        "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      {inst.symbol}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Default Instrument */}
      {data.selectedInstruments.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Default Instrument</label>
          <InstrumentSelector
            value={data.defaultInstrument}
            onChange={(sym) => update({ defaultInstrument: sym })}
            placeholder="Select your most-traded instrument…"
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: Your Strategy                                              */
/* ------------------------------------------------------------------ */

function Step3Strategy({
  data,
  update,
  loading,
}: {
  data: SetupData;
  update: (patch: Partial<SetupData>) => void;
  loading: boolean;
}) {
  function applyTemplate(template: string) {
    update({ strategyTemplate: template });
    let rules: { title: string; required: boolean; description: string }[] = [];
    if (template === "ict") rules = ICT_RULES.map((r) => ({ ...r }));
    else if (template === "trend") rules = TREND_RULES.map((r) => ({ ...r }));
    else if (template === "breakout") rules = BREAKOUT_RULES.map((r) => ({ ...r }));
    else rules = [{ title: "", required: true, description: "" }];
    update({ rules });

    if (template === "ict" && !data.strategyName) update({ strategyName: "ICT Setup" });
    else if (template === "trend" && !data.strategyName) update({ strategyName: "Trend Following" });
    else if (template === "breakout" && !data.strategyName) update({ strategyName: "Breakout" });
  }

  function addRule() {
    update({ rules: [...data.rules, { title: "", required: true, description: "" }] });
  }

  function removeRule(idx: number) {
    update({ rules: data.rules.filter((_, i) => i !== idx) });
  }

  function updateRule(idx: number, patch: Partial<{ title: string; required: boolean; description: string }>) {
    update({ rules: data.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">How do you trade?</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          Create the strategy you want DnD to use when evaluating your setups. These rules become the checklist DnD uses when you evaluate your trades.
        </p>
      </div>

      {/* Template selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Start from a template</label>
        <Select value={data.strategyTemplate} onValueChange={applyTemplate}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STRATEGY_TEMPLATES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Strategy name + description */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Strategy Name</label>
          <Input
            value={data.strategyName}
            onChange={(e) => update({ strategyName: e.target.value })}
            placeholder="e.g. London Breakout"
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Short Description</label>
          <Textarea
            value={data.strategyDescription}
            onChange={(e) => update({ strategyDescription: e.target.value })}
            placeholder="Briefly describe your strategy edge…"
            rows={2}
            disabled={loading}
            className="resize-none"
          />
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">Rules</label>
          <Button type="button" variant="ghost" size="sm" onClick={addRule} disabled={loading} className="h-7 text-xs">
            <Plus className="h-3 w-3" /> Add Rule
          </Button>
        </div>
        {data.rules.map((rule, idx) => (
          <div key={idx} className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                checked={rule.required}
                onCheckedChange={(v) => updateRule(idx, { required: v === true })}
                className="mt-0.5"
              />
              <Input
                value={rule.title}
                onChange={(e) => updateRule(idx, { title: e.target.value })}
                placeholder={`Rule ${idx + 1}`}
                disabled={loading}
                className="h-8 text-sm flex-1"
              />
              <button
                onClick={() => removeRule(idx)}
                disabled={loading || data.rules.length <= 1}
                className="text-muted-foreground hover:text-loss p-1 disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              value={rule.description}
              onChange={(e) => updateRule(idx, { description: e.target.value })}
              placeholder="Optional description…"
              disabled={loading}
              className="h-8 text-xs"
            />
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          Checked = required rule. Unchecked = optional. Required rules cap the grade at &quot;C&quot; if not met.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4: Risk + Trading Defaults                                    */
/* ------------------------------------------------------------------ */

function Step4RiskDefaults({
  data,
  update,
  loading,
}: {
  data: SetupData;
  update: (patch: Partial<SetupData>) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Set your trading defaults</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          These preferences make trade entry faster and help keep your risk visible.
        </p>
      </div>

      {/* Defaults */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Defaults</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Default Risk %</label>
            <Input
              type="number"
              step="0.1"
              value={data.defaultRiskPct}
              onChange={(e) => update({ defaultRiskPct: e.target.value })}
              disabled={loading}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Your normal planned risk for one trade.</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Default Session</label>
            <Select value={data.defaultSession} onValueChange={(v) => update({ defaultSession: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Default Timeframe</label>
            <Select value={data.defaultTimeframe} onValueChange={(v) => update({ defaultTimeframe: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Risk Management */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Risk Management</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Max Trades / Day</label>
            <Input
              type="number"
              value={data.maxTradesPerDay}
              onChange={(e) => update({ maxTradesPerDay: e.target.value })}
              placeholder="Optional"
              disabled={loading}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Helps you keep overtrading visible.</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Daily Loss Limit %</label>
            <Input
              type="number"
              step="0.1"
              value={data.dailyLossLimitPct}
              onChange={(e) => update({ dailyLossLimitPct: e.target.value })}
              placeholder="Optional"
              disabled={loading}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Your maximum planned loss for the day.</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Max Risk / Trade %</label>
            <Input
              type="number"
              step="0.1"
              value={data.maxRiskPerTradePct}
              onChange={(e) => update({ maxRiskPerTradePct: e.target.value })}
              placeholder="Optional"
              disabled={loading}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Hard cap on single-trade risk.</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          All limits are informational warnings by default — they don&apos;t block trade logging.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5: Ready to Trade                                             */
/* ------------------------------------------------------------------ */

function Step5Ready({ data }: { data: SetupData }) {
  const configuredInstruments = data.selectedInstruments.slice(0, 5);
  const extraInstruments = data.selectedInstruments.length - 5;
  const validRules = data.rules.filter((r) => r.title.trim());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Your workspace is ready.</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Here&apos;s what you&apos;ve configured. You can change any of this later in Settings.
        </p>
      </div>

      <div className="space-y-3">
        {/* Profile */}
        <SummarySection title="Profile" items={[
          { label: "Timezone", value: data.timezone },
          { label: "Currency", value: data.currency },
        ]} />

        {/* Account */}
        <SummarySection title="Account" items={[
          { label: "Name", value: data.accountName || "Primary" },
          { label: "Type", value: data.accountType },
          { label: "Balance", value: `$${data.startingBalance || "10000"}` },
        ]} />

        {/* Markets */}
        {configuredInstruments.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Markets</div>
            <div className="flex flex-wrap gap-1.5">
              {configuredInstruments.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
              {extraInstruments > 0 && (
                <Badge variant="outline" className="text-[10px]">+{extraInstruments} more</Badge>
              )}
            </div>
          </div>
        )}

        {/* Strategy */}
        {data.strategyName && (
          <SummarySection title="Strategy" items={[
            { label: "Name", value: data.strategyName },
            { label: "Rules", value: `${validRules.length} rules` },
          ]} />
        )}

        {/* Trading Defaults */}
        <SummarySection title="Trading Defaults" items={[
          { label: "Risk", value: `${data.defaultRiskPct || "1"}%` },
          { label: "Session", value: SESSIONS.find((s) => s.value === data.defaultSession)?.label ?? data.defaultSession },
          { label: "Timeframe", value: data.defaultTimeframe },
        ]} />
      </div>

      <p className="text-sm text-muted-foreground text-center">
        You&apos;re ready to start trading with DnD.
      </p>
    </div>
  );
}

function SummarySection({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Save + Finish — persists all data then launches the tour            */
/* ------------------------------------------------------------------ */

function SaveAndFinish({
  data,
  loading,
  setLoading,
}: {
  data: SetupData;
  loading: boolean;
  setLoading: (b: boolean) => void;
}) {
  const qc = useQueryClient();
  const { setState } = useOnboarding();
  const { navigate } = useNav();

  async function save() {
    setLoading(true);
    try {
      // 1. Save profile + risk defaults to settings
      const settingsPatch: Record<string, unknown> = {
        name: data.name || undefined,
        timezone: data.timezone,
        baseCurrencySymbol: data.currency === "USD" ? "$" : data.currency,
        defaultRiskPct: data.defaultRiskPct,
        defaultSession: data.defaultSession,
        defaultTimeframe: data.defaultTimeframe,
        maxTradesPerDay: data.maxTradesPerDay ? parseInt(data.maxTradesPerDay) : null,
        dailyLossLimitPct: data.dailyLossLimitPct ? parseFloat(data.dailyLossLimitPct) : null,
        maxRiskPerTradePct: data.maxRiskPerTradePct ? parseFloat(data.maxRiskPerTradePct) : null,
      };
      if (data.defaultInstrument) settingsPatch.defaultInstrument = data.defaultInstrument;
      if (data.selectedInstruments.length > 0) {
        settingsPatch.preferredInstruments = JSON.stringify(data.selectedInstruments);
      }

      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsPatch),
      });

      // 2. Create trading account
      const accountRes = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.accountName || "Primary",
          broker: data.broker || undefined,
          accountType: data.accountType,
          currency: data.currency,
          startingBalanceCents: Math.round(parseFloat(data.startingBalance || "10000") * 100),
          isDefault: true,
        }),
      });
      if (accountRes.ok) {
        const account = await accountRes.json();
        // Update defaultAccountId
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultAccountId: account.id }),
        });
      }

      // 3. Create strategy + version
      if (data.strategyName) {
        const cleanRules = data.rules
          .filter((r) => r.title.trim())
          .map((r) => ({ title: r.title.trim(), required: r.required, description: r.description.trim() }));

        const stratRes = await fetch("/api/strategies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.strategyName,
            description: data.strategyDescription || undefined,
            market: "mixed",
            rules: cleanRules,
          }),
        });
        if (!stratRes.ok) {
          toast.error("Failed to create strategy — you can set it up later.");
        }
      }

      // 4. Invalidate everything
      qc.invalidateQueries();

      // 5. Launch tour
      setState("tour");
    } catch {
      toast.error("Something went wrong. Your setup may be incomplete.");
      setLoading(false);
    }
  }

  return (
    <Button size="sm" onClick={save} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      Go to Dashboard
    </Button>
  );
}
