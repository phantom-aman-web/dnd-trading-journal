"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  AlertTriangle,
  Flame,
  Clock,
  Globe,
  TrendingUp,
  Info,
} from "lucide-react";
import {
  SAMPLE_ECONOMIC_EVENTS,
  filterEconomicEvents,
  getCalendarProviderMeta,
  formatEventTimeForTimezone,
  type EconomicEvent,
  type EconomicImpact,
  type EconomicTimezone,
} from "@/lib/economic-calendar";

export function EconomicCalendarTab() {
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [impactFilter, setImpactFilter] = useState<string>("all");
  const [selectedTz, setSelectedTz] = useState<EconomicTimezone>("Local");

  const providerMeta = useMemo(() => getCalendarProviderMeta(), []);

  const filteredEvents = useMemo(() => {
    return filterEconomicEvents(SAMPLE_ECONOMIC_EVENTS, {
      currency: currencyFilter,
      impact: impactFilter,
    });
  }, [currencyFilter, impactFilter]);

  const highImpactCount = SAMPLE_ECONOMIC_EVENTS.filter((e) => e.impact === "high").length;

  return (
    <div className="space-y-5">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Macroeconomic Economic Calendar (Feature 59)
          </h3>
          <p className="text-xs text-muted-foreground">
            Authentic macroeconomic releases, rate decisions, inflation, and employment indicators across major global currencies.
          </p>
        </div>

        {/* Filters & Timezone Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedTz} onValueChange={(v: EconomicTimezone) => setSelectedTz(v)}>
            <SelectTrigger className="h-8 text-xs font-mono w-32 bg-card">
              <Globe className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Local">Local Browser Time</SelectItem>
              <SelectItem value="UTC">UTC (Universal)</SelectItem>
              <SelectItem value="London">London (GMT/BST)</SelectItem>
              <SelectItem value="New York">New York (EST/EDT)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="h-8 text-xs font-mono w-28 bg-card">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Currencies</SelectItem>
              <SelectItem value="USD">USD (Dollar)</SelectItem>
              <SelectItem value="EUR">EUR (Euro)</SelectItem>
              <SelectItem value="GBP">GBP (Pound)</SelectItem>
              <SelectItem value="JPY">JPY (Yen)</SelectItem>
              <SelectItem value="CAD">CAD (Loonie)</SelectItem>
              <SelectItem value="AUD">AUD (Aussie)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={impactFilter} onValueChange={setImpactFilter}>
            <SelectTrigger className="h-8 text-xs font-mono w-28 bg-card">
              <SelectValue placeholder="Impact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Impacts</SelectItem>
              <SelectItem value="high">High Impact 🔴</SelectItem>
              <SelectItem value="medium">Medium Impact 🟡</SelectItem>
              <SelectItem value="low">Low Impact ⚪</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Provider Status Transparency Banner */}
      <div className={cn(
        "p-3 rounded-xl border text-xs flex items-start gap-2.5 shadow-xs",
        providerMeta.isConfigured
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted/40 text-muted-foreground"
      )}>
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground flex items-center gap-2">
            <span>{providerMeta.providerName}</span>
            <Badge variant="outline" className={cn(
              "font-mono text-[10px] uppercase font-bold px-1.5 py-0",
              providerMeta.isConfigured ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/40" : "bg-muted text-muted-foreground"
            )}>
              {providerMeta.isConfigured ? "Live Feed" : "Reference Baseline (Static)"}
            </Badge>
          </div>
          <p className="text-[11px] leading-relaxed">
            {providerMeta.statusNotice} Source: {providerMeta.sourceAttribution}.
          </p>
        </div>
      </div>

      {/* Volatility Warning Banner */}
      <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5 shadow-xs">
        <Flame className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">High-Impact Release Volatility Notice</div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            There are <strong>{highImpactCount} high-impact macroeconomic releases</strong> scheduled this week. Widened broker spreads, order book slippage, and liquidity gaps commonly occur within 2 to 5 minutes of release times.
          </p>
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-[11px] font-mono text-muted-foreground uppercase">
              <tr>
                <th className="py-2.5 px-3">Date &amp; Time ({selectedTz})</th>
                <th className="py-2.5 px-3">Currency</th>
                <th className="py-2.5 px-3">Impact</th>
                <th className="py-2.5 px-3">Economic Event</th>
                <th className="py-2.5 px-3 text-right">Actual</th>
                <th className="py-2.5 px-3 text-right">Forecast</th>
                <th className="py-2.5 px-3 text-right">Previous</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEvents.map((ev) => {
                const { dateStr, timeStr } = formatEventTimeForTimezone(ev.scheduledTime, selectedTz);

                return (
                  <tr key={ev.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                      <span className="font-semibold text-foreground">{dateStr}</span> · {timeStr}
                    </td>

                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="font-mono text-[10px] font-bold px-1.5 py-0 bg-muted/60">
                        {ev.currency}
                      </Badge>
                    </td>

                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[10px] uppercase font-bold px-1.5 py-0",
                          ev.impact === "high"
                            ? "bg-loss/15 text-loss border-loss/30"
                            : ev.impact === "medium"
                            ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        )}
                      >
                        {ev.impact}
                      </Badge>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-foreground">{ev.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        {ev.volatilityGuidance}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {ev.actual ? `${ev.actual} ${ev.unit !== "%" ? ev.unit : ""}` : <span className="text-muted-foreground font-normal">Pending</span>}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {ev.forecast ? `${ev.forecast} ${ev.unit !== "%" ? ev.unit : ""}` : "—"}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {ev.previous ? `${ev.previous} ${ev.unit !== "%" ? ev.unit : ""}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
