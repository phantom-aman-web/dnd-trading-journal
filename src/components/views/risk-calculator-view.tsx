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
  type InstrumentDef,
} from "@/lib/instrument-catalog";
import { formatSignedCents } from "@/lib/money";
import { useNav } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

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

  // Selected Instrument
  const instrument: InstrumentDef = useMemo(() => {
    return resolveInstrument(symbol);
  }, [symbol]);

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

  // Risk Budget in Dollars
  const riskBudgetDollars = useMemo(() => {
    if (riskMode === "pct") {
      const pct = parseFloat(riskPct);
      if (isNaN(pct) || pct <= 0) return 0;
      return (effectiveBalance * pct) / 100;
    } else {
      const cash = parseFloat(riskCash);
      return isNaN(cash) || cash <= 0 ? 0 : cash;
    }
  }, [riskMode, riskPct, riskCash, effectiveBalance]);

  // Financial Sizing calculation (Authoritative: priceDistance * quantity * pointValueCents)
  // riskCents = priceDistance * quantity * pointValueCents
  // => quantity = riskCents / (priceDistance * pointValueCents)
  const calculation = useMemo(() => {
    if (!hasValidPrices || !isStopCorrectSide || priceDistance <= 0 || riskBudgetDollars <= 0) {
      return null;
    }

    const riskBudgetCents = riskBudgetDollars * 100;
    const centsPerUnit = priceDistance * instrument.pointValueCents;

    if (centsPerUnit <= 0) return null;

    let rawLots = riskBudgetCents / centsPerUnit;

    // Determine lot increment / rounding
    let roundedLots: number;
    let minLot: number;
    if (instrument.market === "futures") {
      minLot = 1;
      roundedLots = Math.floor(rawLots); // Futures: whole contracts
    } else if (instrument.market === "crypto") {
      minLot = 0.001;
      roundedLots = Math.floor(rawLots * 1000) / 1000;
    } else {
      minLot = 0.01;
      roundedLots = Math.floor(rawLots * 100) / 100; // Forex & Gold: 0.01 lots
    }

    const actualRiskCents = Math.round(priceDistance * roundedLots * instrument.pointValueCents);
    const actualRiskDollars = actualRiskCents / 100;
    const actualRiskPct = effectiveBalance > 0 ? (actualRiskDollars / effectiveBalance) * 100 : 0;

    // Take profit calculations
    let rewardDistance = 0;
    let rewardInUnits = 0;
    let rrRatio = 0;
    let rewardDollars = 0;
    let rewardPct = 0;

    if (!isNaN(numTP) && numTP > 0) {
      const isTPCorrectSide = direction === "long" ? numTP > numEntry : numTP < numEntry;
      if (isTPCorrectSide) {
        rewardDistance = Math.abs(numTP - numEntry);
        rewardInUnits = distanceInUnits(rewardDistance, instrument.pipSize);
        rrRatio = priceDistance > 0 ? rewardDistance / priceDistance : 0;
        const rewardCents = Math.round(rewardDistance * roundedLots * instrument.pointValueCents);
        rewardDollars = rewardCents / 100;
        rewardPct = effectiveBalance > 0 ? (rewardDollars / effectiveBalance) * 100 : 0;
      }
    }

    // Required margin estimate (notional value / leverage approx)
    const notionalValue = roundedLots * parseFloat(instrument.contractSize) * numEntry;

    return {
      rawLots,
      roundedLots,
      minLot,
      actualRiskDollars,
      actualRiskPct,
      rewardDistance,
      rewardInUnits,
      rrRatio,
      rewardDollars,
      rewardPct,
      notionalValue,
    };
  }, [
    hasValidPrices,
    isStopCorrectSide,
    priceDistance,
    riskBudgetDollars,
    instrument,
    effectiveBalance,
    numTP,
    numEntry,
    direction,
  ]);

  // Quick preset instruments
  const popularSymbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NQ", "ES", "BTCUSD"];

  function handleTransferToTrade() {
    if (!calculation || calculation.roundedLots <= 0) return;

    // Navigate to trade creation form with pre-filled parameters via query params or navigation state
    navigate("tradeNew", {
      symbol: instrument.symbol,
      direction,
      entry: entryPrice,
      stop: stopPrice,
      target: !isNaN(numTP) && numTP > 0 ? takeProfitPrice : "",
      size: String(calculation.roundedLots),
      accountId: selectedAccountId,
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
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
          Calculate precise position sizing, stop distances, monetary risk, and risk-to-reward ratios before execution.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Inputs Form (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
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
                  onValueChange={(v) => {
                    setSelectedAccountId(v);
                    const acc = accounts.find((a) => a.id === v);
                    if (acc) {
                      setCurrency(acc.currency || "USD");
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Custom Capital (No Account)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Custom Capital (Manual)</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.name} ({formatSignedCents(acc.currentBalanceCents || acc.startingBalanceCents, acc.currency).text})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedAccount && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Account Balance ({currency})</Label>
                  <Input
                    type="number"
                    value={customBalance}
                    onChange={(e) => setCustomBalance(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="10000"
                  />
                </div>
              )}
            </div>

            {/* Risk Sizing Mode */}
            <div className="pt-2 border-t border-border/60">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Risk Budgeting</Label>
                <div className="flex bg-muted p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setRiskMode("pct")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                      riskMode === "pct"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Percentage %
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskMode("cash")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                      riskMode === "cash"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Cash Amount $
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 items-center">
                {riskMode === "pct" ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Risk Percent</span>
                      <span className="font-medium text-foreground">
                        ${riskBudgetDollars.toFixed(2)} {effectiveCurrency}
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        value={riskPct}
                        onChange={(e) => setRiskPct(e.target.value)}
                        className="h-9 text-xs pr-8"
                      />
                      <Percent className="h-3.5 w-3.5 absolute right-2.5 top-3 text-muted-foreground" />
                    </div>
                    {/* Quick Risk Buttons */}
                    <div className="flex gap-1.5 pt-1">
                      {["0.25", "0.5", "1.0", "1.5", "2.0"].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRiskPct(r)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] border transition-colors",
                            riskPct === r
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted text-muted-foreground",
                          )}
                        >
                          {r}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Risk Cash Amount</span>
                      <span className="font-medium text-foreground">
                        {effectiveBalance > 0 ? ((riskBudgetDollars / effectiveBalance) * 100).toFixed(2) : 0}% of capital
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        value={riskCash}
                        onChange={(e) => setRiskCash(e.target.value)}
                        className="h-9 text-xs pl-7"
                      />
                      <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">$</span>
                    </div>
                  </div>
                )}
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
                      } else if (s === "XAUUSD") {
                        setEntryPrice("2650.00");
                        setStopPrice(direction === "long" ? "2640.00" : "2660.00");
                        setTakeProfitPrice(direction === "long" ? "2680.00" : "2620.00");
                      } else if (s === "NQ") {
                        setEntryPrice("20400.00");
                        setStopPrice(direction === "long" ? "20350.00" : "20450.00");
                        setTakeProfitPrice(direction === "long" ? "20550.00" : "20250.00");
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
                  placeholder="EURUSD, NQ, XAUUSD, BTCUSD..."
                />
                <span className="text-[11px] text-muted-foreground">
                  {instrument.displayName} · {instrument.market.toUpperCase()}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Trade Direction</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection("long");
                      // Adjust stop/target if needed
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

        {/* Right Output & Sizing Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-card rounded-xl border border-border p-5 space-y-5 shadow-sm sticky top-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                Calculated Sizing &amp; Risk
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {instrument.market.toUpperCase()}
              </span>
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
                      {instrument.market === "futures" ? "contracts" : "lots"}
                    </span>
                  </div>
                  {calculation.roundedLots === 0 && (
                    <p className="text-xs text-destructive font-medium mt-1">
                      Risk budget is too small for 1 minimum contract ({calculation.rawLots.toFixed(3)} raw).
                    </p>
                  )}
                  {calculation.roundedLots > 0 && calculation.rawLots !== calculation.roundedLots && (
                    <div className="text-[11px] text-muted-foreground">
                      Exact raw: {calculation.rawLots.toFixed(3)} (clamped to lot step)
                    </div>
                  )}
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
                    <span className="text-muted-foreground block text-[11px]">Monetary Risk</span>
                    <span className="font-mono font-semibold text-loss text-sm">
                      ${calculation.actualRiskDollars.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {calculation.actualRiskPct.toFixed(2)}% of capital
                    </span>
                  </div>

                  {calculation.rewardDollars > 0 && (
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
                          +${calculation.rewardDollars.toFixed(2)}
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
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-muted text-muted-foreground">
                        <Percent className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-medium text-foreground">Risk / Reward Ratio</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-foreground">
                        1 : {calculation.rrRatio.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {calculation.rrRatio >= 2 ? "High Quality (≥ 2R)" : calculation.rrRatio >= 1 ? "Acceptable" : "Sub-1R"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Transfer to Trade Action */}
                <Button
                  onClick={handleTransferToTrade}
                  disabled={calculation.roundedLots <= 0}
                  className="w-full h-10 gap-2 font-semibold"
                >
                  Transfer Sizing to New Trade
                  <ArrowRight className="h-4 w-4" />
                </Button>

                {/* Economics Metadata note */}
                <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 space-y-1">
                  <div className="flex items-center gap-1 font-medium text-foreground">
                    <Info className="h-3 w-3 text-primary" />
                    <span>Contract Specifications</span>
                  </div>
                  <div>Point Value: ${(instrument.pointValueCents / 100).toLocaleString()}/pt</div>
                  <div>Contract Size: {Number(instrument.contractSize).toLocaleString()} units/lot</div>
                  <div>Pip / Tick Size: {instrument.pipSize}</div>
                </div>
              </div>
            ) : (
              <div className="py-12 px-4 text-center space-y-3 text-muted-foreground">
                <Calculator className="h-8 w-8 mx-auto opacity-30" />
                <div className="text-xs">
                  Enter valid entry and stop price levels to view calculated lot sizing, stop distance, and risk amounts.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

