"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  Percent,
  Layers,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Bookmark,
  FolderOpen,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INSTRUMENT_CATALOG,
  resolveInstrument,
  unitLabel,
  distanceInUnits,
  getInstrumentQuoteCurrency,
  getInstrumentSizingRules,
  convertCurrency,
  type InstrumentDef,
} from "@/lib/instrument-catalog";
import { formatSignedCents } from "@/lib/money";
import { useNav } from "@/lib/nav-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TradingAccount {
  id: string;
  name: string;
  currency: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
}

export function RiskCalculatorView() {
  const { navigate } = useNav();

  // Fetch user accounts
  const { data: accounts = [] } = useQuery<TradingAccount[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.items ?? [];
    },
  });

  // State
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [customBalance, setCustomBalance] = useState<string>("10000");
  const [currency, setCurrency] = useState<string>("USD");

  const [symbol, setSymbol] = useState<string>("EURUSD");
  const [direction, setDirection] = useState<"long" | "short">("long");

  const [entryPrice, setEntryPrice] = useState<string>("1.08500");
  const [stopPrice, setStopPrice] = useState<string>("1.08200");
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>("1.09400");

  const [riskMode, setRiskMode] = useState<"pct" | "cash">("pct");
  const [riskPct, setRiskPct] = useState<string>("1.0");
  const [riskCash, setRiskCash] = useState<string>("100");

  // Optional execution assumptions
  const [spreadPoints, setSpreadPoints] = useState<string>("0");
  const [commissionPerUnit, setCommissionPerUnit] = useState<string>("0");

  // Saved Scenarios (spec §6.3 — user-controlled lightweight scenario persistence)
  const [savedScenarios, setSavedScenarios] = useState<Array<{
    id: string;
    name: string;
    savedAt: string;
    symbol: string;
    direction: "long" | "short";
    balance: string;
    currency: string;
    riskMode: "pct" | "cash";
    riskPct: string;
    riskCash: string;
    entryPrice: string;
    stopPrice: string;
    takeProfitPrice: string;
    spreadPoints: string;
    commissionPerUnit: string;
  }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("alphapips-risk-scenarios");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [scenarioNameInput, setScenarioNameInput] = useState("");
  const [isSavingScenario, setIsSavingScenario] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);

  // Sync account selection
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const effectiveBalance = useMemo(() => {
    if (selectedAccount) {
      return (selectedAccount.currentBalanceCents || selectedAccount.startingBalanceCents) / 100;
    }
    const val = parseFloat(customBalance);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [selectedAccount, customBalance]);

  const effectiveCurrency = selectedAccount?.currency || currency;

  // Selected Instrument & Sizing Rules
  const instrument: InstrumentDef = useMemo(() => {
    return resolveInstrument(symbol);
  }, [symbol]);

  const sizingRules = useMemo(() => {
    return getInstrumentSizingRules(instrument);
  }, [instrument]);

  const quoteCurrency = useMemo(() => {
    return getInstrumentQuoteCurrency(instrument);
  }, [instrument]);

  const unitsName = unitLabel(instrument.market);

  // Parse price numbers
  const numEntry = parseFloat(entryPrice);
  const numStop = parseFloat(stopPrice);
  const numTP = parseFloat(takeProfitPrice);

  const hasValidPrices = !isNaN(numEntry) && !isNaN(numStop) && numEntry > 0 && numStop > 0;
  const isStopCorrectSide = hasValidPrices && (direction === "long" ? numStop < numEntry : numStop > numEntry);

  // Price distance
  const priceDistance = hasValidPrices ? Math.abs(numEntry - numStop) : 0;
  const stopDistanceInUnits = distanceInUnits(priceDistance, instrument.pipSize);

  // Risk Budget in Account Currency
  const riskBudgetAccount = useMemo(() => {
    if (riskMode === "pct") {
      const pct = parseFloat(riskPct);
      if (isNaN(pct) || pct <= 0) return 0;
      return (effectiveBalance * pct) / 100;
    } else {
      const cash = parseFloat(riskCash);
      return isNaN(cash) || cash <= 0 ? 0 : cash;
    }
  }, [riskMode, riskPct, riskCash, effectiveBalance]);

  // Optional Custom FX Rate Override
  const [customFxRateOverride, setCustomFxRateOverride] = useState<string>("");

  // Currency Conversion between Account Currency and Quote Currency
  const { converted: riskBudgetQuote, rate: fxRate, isConversionNeeded } = useMemo(() => {
    const numOverride = parseFloat(customFxRateOverride);
    const customRates = !isNaN(numOverride) && numOverride > 0 ? { [quoteCurrency]: numOverride } : undefined;
    return convertCurrency(riskBudgetAccount, effectiveCurrency, quoteCurrency, customRates);
  }, [riskBudgetAccount, effectiveCurrency, quoteCurrency, customFxRateOverride]);

  // Financial Sizing calculation (Authoritative: priceDistance * quantity * pointValueCents)
  const calculation = useMemo(() => {
    if (!hasValidPrices || !isStopCorrectSide || priceDistance <= 0 || riskBudgetAccount <= 0) {
      return null;
    }

    const riskBudgetCentsQuote = riskBudgetQuote * 100;
    const centsPerUnit = priceDistance * instrument.pointValueCents;

    if (centsPerUnit <= 0) return null;

    const rawLots = riskBudgetCentsQuote / centsPerUnit;

    // Use instrument-specific quantity step and minimum quantity
    const step = sizingRules.quantityStep;
    let roundedLots = Math.floor(rawLots / step) * step;
    const factor = Math.pow(10, sizingRules.decimals);
    roundedLots = Math.round(roundedLots * factor) / factor;

    // Base Price Risk
    const actualRiskQuoteCents = Math.round(priceDistance * roundedLots * instrument.pointValueCents);
    const actualRiskQuoteDollars = actualRiskQuoteCents / 100;
    const actualRiskAccountDollars = isConversionNeeded
      ? convertCurrency(actualRiskQuoteDollars, quoteCurrency, effectiveCurrency).converted
      : actualRiskQuoteDollars;

    // Execution Cost Assumptions (Spread & Commission)
    const numSpread = parseFloat(spreadPoints) || 0;
    const numComm = parseFloat(commissionPerUnit) || 0;
    const spreadCostQuoteDollars = (numSpread * roundedLots * instrument.pointValueCents) / 100;
    const commCostQuoteDollars = numComm * roundedLots;
    const totalExecutionCostQuote = spreadCostQuoteDollars + commCostQuoteDollars;
    const totalExecutionCostAccount = isConversionNeeded
      ? convertCurrency(totalExecutionCostQuote, quoteCurrency, effectiveCurrency).converted
      : totalExecutionCostQuote;

    // Net Risk Total (Base Price Risk + Execution Costs)
    const totalRiskAccountDollars = actualRiskAccountDollars + totalExecutionCostAccount;
    const actualRiskPct = effectiveBalance > 0 ? (totalRiskAccountDollars / effectiveBalance) * 100 : 0;

    // Take profit calculations
    let rewardDistance = 0;
    let rewardInUnits = 0;
    let rrRatio = 0;
    let rewardDollarsAccount = 0;
    let rewardPct = 0;

    if (!isNaN(numTP) && numTP > 0) {
      const isTPCorrectSide = direction === "long" ? numTP > numEntry : numTP < numEntry;
      if (isTPCorrectSide) {
        rewardDistance = Math.abs(numTP - numEntry);
        rewardInUnits = distanceInUnits(rewardDistance, instrument.pipSize);
        rrRatio = priceDistance > 0 ? rewardDistance / priceDistance : 0;
        const rewardQuoteCents = Math.round(rewardDistance * roundedLots * instrument.pointValueCents);
        const rewardQuoteDollars = rewardQuoteCents / 100;
        rewardDollarsAccount = isConversionNeeded
          ? convertCurrency(rewardQuoteDollars, quoteCurrency, effectiveCurrency).converted
          : rewardQuoteDollars;
        rewardPct = effectiveBalance > 0 ? (rewardDollarsAccount / effectiveBalance) * 100 : 0;
      }
    }

    // Required margin estimate (notional value in quote currency)
    const notionalValueQuote = roundedLots * parseFloat(instrument.contractSize) * numEntry;
    const notionalValueAccount = isConversionNeeded
      ? convertCurrency(notionalValueQuote, quoteCurrency, effectiveCurrency).converted
      : notionalValueQuote;

    return {
      rawLots,
      roundedLots,
      minLot: sizingRules.minQuantity,
      quantityStep: sizingRules.quantityStep,
      quantityUnit: sizingRules.quantityUnit,
      actualRiskAccountDollars,
      totalExecutionCostAccount,
      totalRiskAccountDollars,
      actualRiskPct,
      rewardDistance,
      rewardInUnits,
      rrRatio,
      rewardDollarsAccount,
      rewardPct,
      notionalValueAccount,
      isConversionNeeded,
      fxRate,
      quoteCurrency,
    };
  }, [
    hasValidPrices,
    isStopCorrectSide,
    priceDistance,
    riskBudgetAccount,
    riskBudgetQuote,
    sizingRules,
    instrument,
    effectiveBalance,
    effectiveCurrency,
    quoteCurrency,
    isConversionNeeded,
    fxRate,
    numTP,
    numEntry,
    direction,
    spreadPoints,
    commissionPerUnit,
  ]);

  // Quick preset instruments spanning all 5 market categories
  const popularSymbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "XAGUSD", "NAS100", "US30", "NQ", "ES", "BTCUSD"];

  function handleTransferToTrade() {
    if (!calculation || calculation.roundedLots <= 0) return;

    // Navigate to trade creation form with pre-filled parameters via navigation state
    toast.success("Position sizing transferred to New Trade form");
    navigate("tradeNew", {
      symbol: instrument.symbol,
      direction,
      entry: entryPrice,
      stop: stopPrice,
      target: !isNaN(numTP) && numTP > 0 ? takeProfitPrice : "",
      size: String(calculation.roundedLots),
      accountId: selectedAccountId,
      plannedRiskCents: String(Math.round(calculation.totalRiskAccountDollars * 100)),
      plannedRiskPct: calculation.actualRiskPct.toFixed(2),
    });
  }

  function handleSaveScenario() {
    const defaultName = `${symbol} ${direction.toUpperCase()} (${entryPrice} / ${stopPrice})`;
    const finalName = scenarioNameInput.trim() || defaultName;
    const newScenario = {
      id: "scen_" + Date.now(),
      name: finalName,
      savedAt: new Date().toISOString(),
      symbol,
      direction,
      balance: customBalance,
      currency,
      riskMode,
      riskPct,
      riskCash,
      entryPrice,
      stopPrice,
      takeProfitPrice,
      spreadPoints,
      commissionPerUnit,
    };
    const updated = [newScenario, ...savedScenarios.slice(0, 19)];
    setSavedScenarios(updated);
    try {
      localStorage.setItem("alphapips-risk-scenarios", JSON.stringify(updated));
    } catch {}
    setScenarioNameInput("");
    setIsSavingScenario(false);
    toast.success(`Saved calculation scenario "${finalName}"`);
  }

  function handleRestoreScenario(s: typeof savedScenarios[0]) {
    setSymbol(s.symbol);
    setDirection(s.direction);
    if (s.balance) setCustomBalance(s.balance);
    if (s.currency) setCurrency(s.currency);
    setRiskMode(s.riskMode);
    setRiskPct(s.riskPct);
    setRiskCash(s.riskCash);
    setEntryPrice(s.entryPrice);
    setStopPrice(s.stopPrice);
    setTakeProfitPrice(s.takeProfitPrice);
    if (s.spreadPoints) setSpreadPoints(s.spreadPoints);
    if (s.commissionPerUnit) setCommissionPerUnit(s.commissionPerUnit);
    toast.success(`Restored scenario "${s.name}"`);
  }

  function handleDeleteScenario(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = savedScenarios.filter((s) => s.id !== id);
    setSavedScenarios(updated);
    try {
      localStorage.setItem("alphapips-risk-scenarios", JSON.stringify(updated));
    } catch {}
    toast.info("Scenario removed");
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Saved Scenarios Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Calculator className="h-5 w-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Position &amp; Risk Calculator
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Calculate precise position sizing, stop distances, monetary risk, and risk-to-reward ratios before execution across Forex, Metals, Indices, Futures, and Crypto.
          </p>
        </div>

        {/* Saved Scenarios Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSavedList(!showSavedList)}
            className="text-xs flex items-center gap-1.5 h-8"
          >
            <Bookmark className="h-3.5 w-3.5 text-primary" />
            <span>Scenarios ({savedScenarios.length})</span>
          </Button>

          {!isSavingScenario ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsSavingScenario(true)}
              className="text-xs flex items-center gap-1.5 h-8 bg-primary text-primary-foreground"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Scenario</span>
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                placeholder="Scenario name..."
                value={scenarioNameInput}
                onChange={(e) => setScenarioNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveScenario()}
                className="h-8 text-xs w-40 bg-background"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveScenario} className="h-8 text-xs px-2.5">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsSavingScenario(false)} className="h-8 text-xs px-2">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Saved Scenarios Drawer/List */}
      {showSavedList && (
        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-primary" /> Saved Calculation Scenarios
            </span>
            <span className="text-[10px] text-muted-foreground">Click a scenario to load inputs</span>
          </div>

          {savedScenarios.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 italic">
              No saved scenarios yet. Configure parameters and click "Save Scenario" above.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {savedScenarios.map((scen) => (
                <div
                  key={scen.id}
                  onClick={() => handleRestoreScenario(scen)}
                  className="group flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-foreground truncate">{scen.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                      <span className={scen.direction === "long" ? "text-profit" : "text-loss"}>
                        {scen.direction.toUpperCase()}
                      </span>
                      <span>·</span>
                      <span>{scen.symbol}</span>
                      <span>·</span>
                      <span>Stop: {scen.stopPrice}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteScenario(scen.id, e)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-loss shrink-0 opacity-60 group-hover:opacity-100"
                    title="Remove scenario"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Inputs Form */}
        <div className="xl:col-span-7 space-y-5">
          {/* Account & Capital Selection */}
          <div className="bg-card rounded-xl border border-border p-4 md:p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              1. Account &amp; Capital
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Trading Account</Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={(val) => {
                    setSelectedAccountId(val);
                    const acc = accounts.find((a) => a.id === val);
                    if (acc) setCurrency(acc.currency || "USD");
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select an account or use custom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Capital (No Account)</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency}) · ${(acc.currentBalanceCents / 100).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedAccount && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Custom Balance Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="any"
                      value={customBalance}
                      onChange={(e) => setCustomBalance(e.target.value)}
                      className="pl-7 h-9 text-xs font-mono"
                      placeholder="10000"
                    />
                  </div>
                </div>
              )}

              {selectedAccount && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Settled Balance</Label>
                  <div className="h-9 px-3 flex items-center rounded-md border border-border bg-muted/40 font-mono text-xs font-semibold text-foreground">
                    {effectiveCurrency} {effectiveBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>

            {/* Risk Mode: Percentage vs Cash */}
            <div className="pt-2 border-t border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Risk Allocation Mode</Label>
                <div className="flex rounded-lg border border-border p-0.5 bg-muted/50">
                  <button
                    type="button"
                    onClick={() => setRiskMode("pct")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                      riskMode === "pct"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    % of Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskMode("cash")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                      riskMode === "cash"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Fixed Cash ($)
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 items-center">
                {riskMode === "pct" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Risk Percentage (%)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={riskPct}
                        onChange={(e) => setRiskPct(e.target.value)}
                        className="pr-8 h-9 text-xs font-mono font-semibold"
                        placeholder="1.0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fixed Risk Amount ($)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="any"
                        value={riskCash}
                        onChange={(e) => setRiskCash(e.target.value)}
                        className="pl-7 h-9 text-xs font-mono font-semibold"
                        placeholder="100"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Effective Risk Budget</span>
                  <div className="font-mono font-semibold text-foreground text-sm flex items-center justify-between">
                    <span>{effectiveCurrency} {riskBudgetAccount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {effectiveBalance > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        ({((riskBudgetAccount / effectiveBalance) * 100).toFixed(2)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Instrument & Trade Parameters */}
          <div className="bg-card rounded-xl border border-border p-4 md:p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              2. Instrument &amp; Execution Levels
            </h2>

            {/* Quick Instrument Chips */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Popular Markets</Label>
              <div className="flex flex-wrap gap-1.5">
                {popularSymbols.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSymbol(s);
                      // Set default realistic prices for quick demo
                      if (s === "EURUSD") {
                        setEntryPrice("1.08500");
                        setStopPrice(direction === "long" ? "1.08200" : "1.08800");
                        setTakeProfitPrice(direction === "long" ? "1.09400" : "1.07600");
                      } else if (s === "GBPUSD") {
                        setEntryPrice("1.29500");
                        setStopPrice(direction === "long" ? "1.29100" : "1.29900");
                        setTakeProfitPrice(direction === "long" ? "1.30500" : "1.28500");
                      } else if (s === "USDJPY") {
                        setEntryPrice("154.500");
                        setStopPrice(direction === "long" ? "154.000" : "155.000");
                        setTakeProfitPrice(direction === "long" ? "155.500" : "153.500");
                      } else if (s === "XAUUSD") {
                        setEntryPrice("2650.00");
                        setStopPrice(direction === "long" ? "2640.00" : "2660.00");
                        setTakeProfitPrice(direction === "long" ? "2680.00" : "2620.00");
                      } else if (s === "XAGUSD") {
                        setEntryPrice("31.500");
                        setStopPrice(direction === "long" ? "31.200" : "31.800");
                        setTakeProfitPrice(direction === "long" ? "32.100" : "30.900");
                      } else if (s === "NAS100") {
                        setEntryPrice("20500.0");
                        setStopPrice(direction === "long" ? "20400.0" : "20600.0");
                        setTakeProfitPrice(direction === "long" ? "20700.0" : "20300.0");
                      } else if (s === "US30") {
                        setEntryPrice("43500.0");
                        setStopPrice(direction === "long" ? "43350.0" : "43650.0");
                        setTakeProfitPrice(direction === "long" ? "43800.0" : "43200.0");
                      } else if (s === "NQ") {
                        setEntryPrice("20400.00");
                        setStopPrice(direction === "long" ? "20350.00" : "20450.00");
                        setTakeProfitPrice(direction === "long" ? "20550.00" : "20250.00");
                      } else if (s === "ES") {
                        setEntryPrice("5800.00");
                        setStopPrice(direction === "long" ? "5785.00" : "5815.00");
                        setTakeProfitPrice(direction === "long" ? "5830.00" : "5770.00");
                      } else if (s === "BTCUSD") {
                        setEntryPrice("95000.00");
                        setStopPrice(direction === "long" ? "94000.00" : "96000.00");
                        setTakeProfitPrice(direction === "long" ? "97000.00" : "93000.00");
                      }
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors",
                      symbol === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Symbol / Ticker</Label>
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="h-9 text-xs font-mono font-semibold"
                  placeholder="EURUSD, NQ, XAUUSD, XAGUSD, NAS100, BTCUSD..."
                />
                <span className="text-[11px] text-muted-foreground">
                  {instrument.displayName} · {instrument.market.toUpperCase()} (Min: {sizingRules.minQuantity} {sizingRules.quantityUnit}, Step: {sizingRules.quantityStep})
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Trade Direction</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection("long");
                      if (numEntry && numStop && numStop > numEntry) {
                        const dist = Math.abs(numEntry - numStop);
                        setStopPrice((numEntry - dist).toFixed(instrument.pricePrecision));
                        if (numTP) setTakeProfitPrice((numEntry + dist * 2).toFixed(instrument.pricePrecision));
                      }
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-semibold border transition-colors",
                      direction === "long"
                        ? "bg-profit/15 text-profit border-profit/40"
                        : "border-border hover:bg-muted text-muted-foreground",
                    )}
                  >
                    <TrendingUp className="h-4 w-4" />
                    LONG (Buy)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDirection("short");
                      if (numEntry && numStop && numStop < numEntry) {
                        const dist = Math.abs(numEntry - numStop);
                        setStopPrice((numEntry + dist).toFixed(instrument.pricePrecision));
                        if (numTP) setTakeProfitPrice((numEntry - dist * 2).toFixed(instrument.pricePrecision));
                      }
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-semibold border transition-colors",
                      direction === "short"
                        ? "bg-loss/15 text-loss border-loss/40"
                        : "border-border hover:bg-muted text-muted-foreground",
                    )}
                  >
                    <TrendingDown className="h-4 w-4" />
                    SHORT (Sell)
                  </button>
                </div>
              </div>
            </div>

            {/* Price Levels: Entry, Stop, Take Profit */}
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Entry Price</Label>
                <Input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="h-9 text-xs font-mono"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <Label className="text-xs">Stop Loss</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {direction === "long" ? "< Entry" : "> Entry"}
                  </span>
                </div>
                <Input
                  type="number"
                  step="any"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value)}
                  className={cn(
                    "h-9 text-xs font-mono",
                    !isStopCorrectSide && hasValidPrices && "border-destructive text-destructive focus-visible:ring-destructive",
                  )}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <Label className="text-xs">Take Profit (Optional)</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {direction === "long" ? "> Entry" : "< Entry"}
                  </span>
                </div>
                <Input
                  type="number"
                  step="any"
                  value={takeProfitPrice}
                  onChange={(e) => setTakeProfitPrice(e.target.value)}
                  className="h-9 text-xs font-mono"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Optional Spread & Commission Inputs */}
            <div className="pt-2 border-t border-border/60">
              <div className="text-xs font-medium text-foreground mb-2 flex items-center justify-between">
                <span>Execution Costs &amp; Friction (Optional)</span>
                <span className="text-[10px] text-muted-foreground">Factored into net monetary risk</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Spread ({unitsName})</Label>
                  <Input
                    type="number"
                    step="any"
                    value={spreadPoints}
                    onChange={(e) => setSpreadPoints(e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Commission (${effectiveCurrency} / {sizingRules.quantityUnit.slice(0, -1)})</Label>
                  <Input
                    type="number"
                    step="any"
                    value={commissionPerUnit}
                    onChange={(e) => setCommissionPerUnit(e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Price Side Validation Warning */}
            {!isStopCorrectSide && hasValidPrices && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  For a <strong>{direction.toUpperCase()}</strong> trade, Stop Loss must be {direction === "long" ? "below" : "above"} the Entry Price.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Output & Sizing Summary */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-card rounded-xl border border-border p-5 space-y-5 shadow-sm sticky top-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                Calculated Sizing &amp; Risk
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                  {instrument.market}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                  {quoteCurrency}
                </span>
              </div>
            </div>

            {calculation ? (
              <div className="space-y-5">
                {/* Hero Position Size Display */}
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-center space-y-1">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Recommended Position Size
                  </div>
                  <div className="text-3xl font-extrabold font-mono tracking-tight text-primary">
                    {calculation.roundedLots}{" "}
                    <span className="text-base font-semibold">
                      {calculation.quantityUnit}
                    </span>
                  </div>
                  {calculation.roundedLots === 0 && (
                    <p className="text-xs text-destructive font-medium mt-1">
                      Risk budget is too small for minimum {calculation.minLot} {calculation.quantityUnit} ({calculation.rawLots.toFixed(3)} raw).
                    </p>
                  )}
                  {calculation.roundedLots > 0 && calculation.rawLots !== calculation.roundedLots && (
                    <div className="text-[11px] text-muted-foreground">
                      Exact raw: {calculation.rawLots.toFixed(3)} (rounded down to {calculation.quantityStep} step)
                    </div>
                  )}
                </div>

                {/* Currency Conversion Notice (if quote != account) */}
                {calculation.isConversionNeeded && (
                  <div className="p-3 rounded-lg bg-muted/60 border border-border text-xs text-muted-foreground space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <RefreshCw className="h-3.5 w-3.5 text-primary" />
                        <span>Currency Conversion (Estimate)</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {customFxRateOverride ? "Manual Rate" : "Static Benchmark Model"}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Quote currency <strong>{quoteCurrency}</strong> converted to <strong>{effectiveCurrency}</strong> @ rate <strong>{calculation.fxRate.toFixed(4)}</strong>.
                      Rates are estimated via static reference benchmarks, not live broker quotes.
                    </p>
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Override rate:</span>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder={calculation.fxRate.toFixed(4)}
                        value={customFxRateOverride}
                        onChange={(e) => setCustomFxRateOverride(e.target.value)}
                        className="h-7 w-28 text-xs font-mono"
                      />
                      {customFxRateOverride && (
                        <button
                          type="button"
                          onClick={() => setCustomFxRateOverride("")}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Standard Contract Specifications Transparency Notice */}
                <div className="p-3 rounded-lg border border-border/80 bg-muted/30 text-[11px] text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Standard Contract Specifications</span>
                  </div>
                  <p>
                    Calculated using standard specifications ({instrument.displayName}: 1 lot = {instrument.contractSize} {sizingRules.quantityUnit}, point value = ${(instrument.pointValueCents / 100).toFixed(2)}). Verify with your broker or prop firm if custom micro/mini lots are utilized.
                  </p>
                </div>

                {/* Sizing Breakdown Metrics */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border/60 space-y-1">
                    <span className="text-muted-foreground block text-[11px]">Stop Distance</span>
                    <span className="font-mono font-semibold text-foreground text-sm">
                      {stopDistanceInUnits} {unitsName}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Δ {priceDistance.toFixed(instrument.pricePrecision)} pts
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border/60 space-y-1">
                    <span className="text-muted-foreground block text-[11px]">Net Monetary Risk</span>
                    <span className="font-mono font-semibold text-loss text-sm">
                      {effectiveCurrency} {calculation.totalRiskAccountDollars.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {calculation.actualRiskPct.toFixed(2)}% of capital
                    </span>
                    {calculation.totalExecutionCostAccount > 0 && (
                      <span className="text-[9px] text-muted-foreground block">
                        Includes {effectiveCurrency} {calculation.totalExecutionCostAccount.toFixed(2)} fees/spread
                      </span>
                    )}
                  </div>

                  {calculation.rewardDollarsAccount > 0 && (
                    <>
                      <div className="p-2.5 rounded-lg bg-muted/50 border border-border/60 space-y-1">
                        <span className="text-muted-foreground block text-[11px]">Target Distance</span>
                        <span className="font-mono font-semibold text-foreground text-sm">
                          {calculation.rewardInUnits} {unitsName}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          Δ {calculation.rewardDistance.toFixed(instrument.pricePrecision)} pts
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-muted/50 border border-border/60 space-y-1">
                        <span className="text-muted-foreground block text-[11px]">Potential Profit</span>
                        <span className="font-mono font-semibold text-profit text-sm">
                          +{effectiveCurrency} {calculation.rewardDollarsAccount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          +{calculation.rewardPct.toFixed(2)}% of capital
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Risk to Reward Badge */}
                {calculation.rrRatio > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <span className="text-xs text-muted-foreground font-medium">Risk-to-Reward Ratio</span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      1 : {calculation.rrRatio.toFixed(2)}R
                    </span>
                  </div>
                )}

                {/* Variance Pill */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-[11px] text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Target Risk Budget:</span>
                    <span className="font-mono font-medium text-foreground">
                      {effectiveCurrency} {riskBudgetAccount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual Planned Risk:</span>
                    <span className="font-mono font-medium text-loss">
                      {effectiveCurrency} {calculation.totalRiskAccountDollars.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] pt-1 border-t border-border/40">
                    <span>Variance (Safe Round-down):</span>
                    <span className="font-mono text-profit">
                      {riskBudgetAccount - calculation.totalRiskAccountDollars >= 0 ? "-" : "+"}
                      {effectiveCurrency} {Math.abs(riskBudgetAccount - calculation.totalRiskAccountDollars).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 1-Click Transfer Button */}
                <Button
                  onClick={handleTransferToTrade}
                  disabled={calculation.roundedLots <= 0}
                  className="w-full h-10 gap-2 font-semibold shadow-sm"
                >
                  Transfer Sizing to New Trade
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <Info className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p className="text-xs">
                  Enter valid entry, stop loss, and risk parameters to generate position sizing and risk analytics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}