"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePrivacyStore, PRIVACY_MASK } from "@/lib/privacy-store";
import { useNav } from "@/lib/nav-store";
import {
  INSTRUMENT_CATALOG,
  resolveInstrument,
  unitLabel,
  distanceInUnits,
  type InstrumentDef,
} from "@/lib/instrument-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calculator, ArrowRight, RotateCcw, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountItem {
  id: string;
  name: string;
  currency: string;
  startingBalanceCents: number;
  currentBalanceCents: number;
}

const TOP_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "US30", "NAS100"];

export function QuickRiskCalculatorWidgetContent() {
  const isPrivate = usePrivacyStore((s) => s.isPrivate);
  const { navigate } = useNav();

  const { data: accounts = [] } = useQuery<AccountItem[]>({
    queryKey: ["accounts-quick-calc"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      const json = await res.json();
      return Array.isArray(json) ? json : json.items || [];
    },
  });

  // State
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("EURUSD");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [riskMode, setRiskMode] = useState<"pct" | "cash">("pct");
  const [riskPct, setRiskPct] = useState<string>("1.0");
  const [riskCash, setRiskCash] = useState<string>("100");
  const [customBalance, setCustomBalance] = useState<string>("10000");

  const [entryPrice, setEntryPrice] = useState<string>("1.08500");
  const [stopPrice, setStopPrice] = useState<string>("1.08200");

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const effectiveBalance = useMemo(() => {
    if (selectedAccount) {
      return (selectedAccount.currentBalanceCents || selectedAccount.startingBalanceCents) / 100;
    }
    const val = parseFloat(customBalance);
    return isNaN(val) || val <= 0 ? 10000 : val;
  }, [selectedAccount, customBalance]);

  const instrument: InstrumentDef = useMemo(() => {
    return resolveInstrument(symbol);
  }, [symbol]);

  const unitsName = unitLabel(instrument.market);

  // Price validation
  const numEntry = parseFloat(entryPrice);
  const numStop = parseFloat(stopPrice);
  const hasValidPrices = !isNaN(numEntry) && !isNaN(numStop) && numEntry > 0 && numStop > 0;
  const isStopCorrectSide = hasValidPrices && (direction === "long" ? numStop < numEntry : numStop > numEntry);
  const priceDistance = hasValidPrices ? Math.abs(numEntry - numStop) : 0;
  const stopDistanceInUnits = distanceInUnits(priceDistance, instrument.pipSize);

  // Risk budget
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

  // Authoritative Position Sizing Calculation
  const calculation = useMemo(() => {
    if (!hasValidPrices || !isStopCorrectSide || priceDistance <= 0 || riskBudgetDollars <= 0) {
      return null;
    }

    const riskBudgetCents = riskBudgetDollars * 100;
    const centsPerUnit = priceDistance * instrument.pointValueCents;
    if (centsPerUnit <= 0) return null;

    const rawLots = riskBudgetCents / centsPerUnit;

    // Conservative floor rounding to prevent over-risking:
    let roundedLots: number;
    if (instrument.market === "futures") {
      roundedLots = Math.floor(rawLots); // Whole contracts
    } else if (instrument.market === "crypto") {
      roundedLots = Math.floor(rawLots * 1000) / 1000;
    } else {
      roundedLots = Math.floor(rawLots * 100) / 100; // 0.01 lot step
    }

    const actualRiskCents = Math.round(priceDistance * roundedLots * instrument.pointValueCents);
    const actualRiskDollars = actualRiskCents / 100;
    const actualRiskPct = effectiveBalance > 0 ? (actualRiskDollars / effectiveBalance) * 100 : 0;

    return {
      lots: roundedLots,
      actualRiskDollars,
      actualRiskPct,
      pipDistance: stopDistanceInUnits,
    };
  }, [hasValidPrices, isStopCorrectSide, priceDistance, riskBudgetDollars, instrument, stopDistanceInUnits, effectiveBalance]);

  function handleReset() {
    setEntryPrice("1.08500");
    setStopPrice("1.08200");
    setRiskPct("1.0");
    setRiskCash("100");
  }

  return (
    <div className="space-y-2 flex flex-col justify-between h-full">
      {/* Account & Instrument Bar */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-medium">Account</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full h-6 px-1.5 rounded bg-muted/50 border border-border text-[11px] text-foreground focus:outline-hidden"
          >
            <option value="">Manual Balance</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({isPrivate ? PRIVACY_MASK : `$${((a.currentBalanceCents || a.startingBalanceCents) / 100).toLocaleString()}`})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-medium">Instrument</label>
          <select
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              const inst = resolveInstrument(e.target.value);
              if (inst.market === "forex") {
                setEntryPrice(inst.symbol === "USDJPY" ? "154.50" : "1.08500");
                setStopPrice(inst.symbol === "USDJPY" ? "154.20" : "1.08200");
              } else if (inst.market === "gold") {
                setEntryPrice("2350.00");
                setStopPrice("2342.00");
              } else if (inst.market === "crypto") {
                setEntryPrice("65000.00");
                setStopPrice("64200.00");
              }
            }}
            className="w-full h-6 px-1.5 rounded bg-muted/50 border border-border text-[11px] text-foreground focus:outline-hidden font-mono"
          >
            {INSTRUMENT_CATALOG.map((inst) => (
              <option key={inst.symbol} value={inst.symbol}>
                {inst.symbol} ({inst.market})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Instrument Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {TOP_SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSymbol(s)}
            className={cn(
              "px-1.5 py-0.5 text-[9px] font-mono rounded transition-colors whitespace-nowrap",
              symbol === s ? "bg-primary text-primary-foreground font-bold" : "bg-muted/40 hover:bg-muted text-muted-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Direction & Risk Mode */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex rounded-md border border-border overflow-hidden p-0.5 bg-muted/40 text-[10px]">
          <button
            type="button"
            onClick={() => setDirection("long")}
            className={cn("flex-1 py-0.5 text-center font-semibold rounded", direction === "long" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}
          >
            Long
          </button>
          <button
            type="button"
            onClick={() => setDirection("short")}
            className={cn("flex-1 py-0.5 text-center font-semibold rounded", direction === "short" ? "bg-rose-500/20 text-rose-600 dark:text-rose-400" : "text-muted-foreground")}
          >
            Short
          </button>
        </div>

        <div className="flex rounded-md border border-border overflow-hidden p-0.5 bg-muted/40 text-[10px]">
          <button
            type="button"
            onClick={() => setRiskMode("pct")}
            className={cn("flex-1 py-0.5 text-center font-semibold rounded", riskMode === "pct" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            % Risk
          </button>
          <button
            type="button"
            onClick={() => setRiskMode("cash")}
            className={cn("flex-1 py-0.5 text-center font-semibold rounded", riskMode === "cash" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            $ Fixed
          </button>
        </div>
      </div>

      {/* Inputs: Risk & Prices */}
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="text-[10px] text-muted-foreground">
            {riskMode === "pct" ? "Risk %" : "Risk $"}
          </label>
          <Input
            value={riskMode === "pct" ? riskPct : riskCash}
            onChange={(e) => (riskMode === "pct" ? setRiskPct(e.target.value) : setRiskCash(e.target.value))}
            className="h-6 text-xs font-mono px-1.5"
            placeholder={riskMode === "pct" ? "1.0" : "100"}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Entry Price</label>
          <Input
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className="h-6 text-xs font-mono px-1.5"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Stop Loss</label>
          <Input
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            className={cn("h-6 text-xs font-mono px-1.5", !isStopCorrectSide && hasValidPrices && "border-rose-500")}
          />
        </div>
      </div>

      {/* Validation Warning if SL is on wrong side */}
      {!isStopCorrectSide && hasValidPrices && (
        <div className="flex items-center gap-1 text-[10px] text-rose-500 font-medium">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Stop Loss must be {direction === "long" ? "below" : "above"} Entry for {direction}.</span>
        </div>
      )}

      {/* Output Results Box */}
      {calculation && (
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-foreground space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
              Position Size
            </span>
            <div className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {calculation.lots.toFixed(instrument.market === "futures" ? 0 : instrument.market === "crypto" ? 3 : 2)}{" "}
              <span className="text-[10px] font-normal text-muted-foreground uppercase">
                {instrument.market === "futures" ? "contracts" : "lots"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-emerald-500/20">
            <span>
              Risk:{" "}
              <strong className="text-foreground">
                {isPrivate ? PRIVACY_MASK : `$${calculation.actualRiskDollars.toFixed(2)}`}
              </strong>{" "}
              ({calculation.actualRiskPct.toFixed(2)}%)
            </span>
            <span>
              Dist: <strong className="text-foreground">{calculation.pipDistance}</strong> {unitsName}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Bar: Reset & Full Calculator link */}
      <div className="flex items-center justify-between text-[10px] pt-1">
        <button
          type="button"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          <span>Reset</span>
        </button>
        <button
          type="button"
          onClick={() => navigate("riskCalculator")}
          className="text-primary hover:underline flex items-center gap-1 font-medium"
        >
          <span>Full Risk Calculator</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
