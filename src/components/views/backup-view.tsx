"use client";

/**
 * Backup, Snapshot & Data Management — reference-aligned rebuild.
 *
 * Premium navy-blue + white-card aesthetic (matches
 * https://ae-tradingjournal.vercel.app/):
 *   - App background: bg-background
 *   - Cards: bg-card border border-border rounded-xl shadow-sm p-6
 *   - Section heading: text-sm font-semibold text-foreground uppercase tracking-wide
 *   - Description: text-sm text-muted-foreground
 *   - Export button: bg-primary text-primary-foreground hover:bg-primary/90
 *   - Import button: border-input (outline)
 *   - Demo button: bg-amber-50 text-warning border-amber-200
 *
 * Three cards stacked vertically:
 *   1. EXPORT BACKUP (.JSON)
 *   2. IMPORT BACKUP ARCHIVE
 *   3. DEMO DATA GENERATOR
 */

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Database,
  FileJson,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function BackupView() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [importedSummary, setImportedSummary] = useState<{
    accounts: number;
    strategies: number;
    trades: number;
  } | null>(null);

  // --- Export -------------------------------------------------------------
  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/exports?format=json&type=all", {
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("Export failed. Please try again.");
        return;
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dnd-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup JSON exported.");
    } catch (err) {
      console.error(err);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // --- Import -------------------------------------------------------------
  async function handleImportFile(file: File) {
    setImporting(true);
    setImportedSummary(null);
    try {
      const text = await file.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        toast.error("Invalid JSON file. Please select a valid backup archive.");
        return;
      }

      // Restore by POSTing each entity through the existing APIs. This is a
      // best-effort client-side restore: we create new records (with new IDs)
      // for accounts, strategies, and trades. Instruments are skipped because
      // they require an existing Instrument row to reference (the trade POST
      // accepts an instrumentSymbol, so we don't need an Instrument record).
      const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
      const strategies = Array.isArray(data?.strategies) ? data.strategies : [];
      const trades = Array.isArray(data?.trades) ? data.trades : [];

      if (accounts.length === 0 && strategies.length === 0 && trades.length === 0) {
        toast.error("Backup archive is empty or has an unrecognized format.");
        return;
      }

      // 1) Restore accounts. Track the old-ID → new-ID mapping so trades
      // can be re-linked to their original account.
      const accountIdMap = new Map<string, string>();
      let accountsCreated = 0;
      for (const a of accounts) {
        try {
          const res = await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: a.name ?? "Restored Account",
              broker: a.broker ?? null,
              accountType: a.accountType ?? "personal",
              currency: a.currency ?? "USD",
              startingBalanceCents: a.startingBalanceCents ?? 0,
              isDefault: false,
              consistencyRate: a.consistencyRate ?? null,
              dailyLossLimitPct: a.dailyLossLimitPct ?? null,
              maxDrawdownPct: a.maxDrawdownPct ?? null,
            }),
          });
          if (res.ok) {
            const created = await res.json();
            accountIdMap.set(a.id, created.id);
            accountsCreated++;
          }
        } catch {
          // skip on error
        }
      }

      // 2) Restore strategies. Track old-ID → new-ID mapping for trades.
      const strategyIdMap = new Map<string, string>();
      let strategiesCreated = 0;
      for (const s of strategies) {
        try {
          const res = await fetch("/api/strategies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: s.name ?? "Restored Setup",
              description: s.description ?? null,
              purpose: s.purpose ?? null,
              instruments: s.instruments ?? null,
              market: s.market ?? null,
              timeframe: s.timeframe ?? null,
              session: s.session ?? null,
              rules: null,
            }),
          });
          if (res.ok) {
            const created = await res.json();
            strategyIdMap.set(s.id, created.id);
            strategiesCreated++;
          }
        } catch {
          // skip on error
        }
      }

      // 3) Restore trades. We need a valid accountId — fall back to the
      // first restored account if the trade's original account isn't in the
      // backup (or wasn't restored). The trade POST runs server-side P&L
      // calculation, so we send a minimal payload (entry/exit/stop/qty).
      const fallbackAccountId = accountIdMap.values().next().value;
      let tradesCreated = 0;
      for (const t of trades) {
        const accountId =
          (t.accountId && accountIdMap.get(t.accountId)) || fallbackAccountId;
        if (!accountId) continue;

        // Build executions from the trade's stored entry/exit price/qty, or
        // skip if essential fields are missing.
        const executions: any[] = [];
        if (t.entryPriceAvg && t.positionSize) {
          executions.push({
            kind: "entry",
            price: String(t.entryPriceAvg),
            quantity: String(t.positionSize),
            ...(t.entryTime ? { timestamp: new Date(t.entryTime).toISOString() } : {}),
          });
        }
        if (t.exitPriceAvg && t.positionSize) {
          executions.push({
            kind: "exit",
            price: String(t.exitPriceAvg),
            quantity: String(t.positionSize),
            ...(t.exitTime ? { timestamp: new Date(t.exitTime).toISOString() } : {}),
          });
        }

        try {
          const res = await fetch("/api/trades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountId,
              instrumentSymbol: t.instrumentSymbol ?? "UNKNOWN",
              market: t.market ?? null,
              direction: t.direction ?? "long",
              session: t.session ?? null,
              strategyId:
                (t.strategyId && strategyIdMap.get(t.strategyId)) || null,
              setupGrade: t.setupGrade ?? null,
              tags: Array.isArray(t.tagsJson) ? t.tagsJson : [],
              plannedEntryPrice: t.plannedEntryPrice ?? null,
              plannedStopPrice: t.plannedStopPrice ?? null,
              plannedTargetPrice: t.plannedTargetPrice ?? null,
              executions,
              feesCents: t.feesCents ?? 0,
              commissionCents: t.commissionCents ?? 0,
              swapCents: t.swapCents ?? 0,
              entryTime: t.entryTime ? new Date(t.entryTime).toISOString() : null,
              exitTime: t.exitTime ? new Date(t.exitTime).toISOString() : null,
              tradingTimezone: "UTC",
              notes: t.notes ?? null,
              lessons: t.lessons ?? null,
              behaviorFlags: Array.isArray(t.behaviorFlagsJson)
                ? t.behaviorFlagsJson
                : [],
              status: t.status ?? "open",
            }),
          });
          if (res.ok) tradesCreated++;
        } catch {
          // skip on error
        }
      }

      setImportedSummary({
        accounts: accountsCreated,
        strategies: strategiesCreated,
        trades: tradesCreated,
      });
      toast.success(
        `Imported ${accountsCreated} account(s), ${strategiesCreated} setup(s), ${tradesCreated} trade(s).`,
      );
      // Invalidate everything we might have touched.
      qc.invalidateQueries();
    } catch (err) {
      console.error(err);
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // --- Demo data ----------------------------------------------------------
  async function handleLoadDemoData() {
    setDemoLoading(true);
    try {
      // 1) Create a sample account.
      const accountRes = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Demo Prop Account",
          broker: "FTMO",
          accountType: "prop",
          currency: "USD",
          startingBalanceCents: 1_000_000, // $10,000
          isDefault: false,
        }),
      });
      if (!accountRes.ok) {
        toast.error("Failed to create demo account.");
        return;
      }
      const account = await accountRes.json();

      // 2) Create a sample setup (strategy v1.0).
      const strategyRes = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Demo Liquidity Sweep",
          description:
            "Wait for a liquidity grab above/below a prior session high/low, then enter on the retest.",
          purpose: "Capture reversals after stop hunts.",
          instruments: "XAUUSD, EURUSD",
          market: "forex",
          timeframe: "5m - 15m",
          session: "london",
          rules: [
            { title: "Liquidity sweep above prior high", required: true, description: "Price wicks above the prior session high then closes back below." },
            { title: "Displacement candle", required: true, description: "A strong impulse candle in the opposite direction confirms the reversal." },
            { title: "Retest entry", required: false, description: "Enter on the retest of the swept level." },
          ],
        }),
      });
      const strategy = strategyRes.ok ? await strategyRes.json() : null;

      // 3) Create a sample trade referencing the account (and the setup, if
      // created successfully). Server-side calc will compute P&L.
      const now = new Date();
      const entryTime = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4h ago
      const exitTime = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3h ago
      const tradeRes = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          instrumentSymbol: "XAUUSD",
          market: "gold",
          direction: "long",
          session: "london",
          strategyId: strategy?.id ?? null,
          setupGrade: "A",
          tags: ["demo"],
          plannedEntryPrice: "2350.00",
          plannedStopPrice: "2347.50",
          plannedTargetPrice: "2357.50",
          executions: [
            {
              kind: "entry",
              price: "2350.00",
              quantity: "0.5",
              timestamp: entryTime.toISOString(),
            },
            {
              kind: "exit",
              price: "2357.00",
              quantity: "0.5",
              timestamp: exitTime.toISOString(),
            },
          ],
          feesCents: 0,
          commissionCents: 0,
          swapCents: 0,
          entryTime: entryTime.toISOString(),
          exitTime: exitTime.toISOString(),
          tradingTimezone: "UTC",
          notes: "Demo trade — clean liquidity sweep below Asia low, displacement candle confirmed.",
          behaviorFlags: [],
          status: "win",
        }),
      });

      if (tradeRes.ok) {
        toast.success("Demo data loaded: 1 account, 1 setup, 1 trade.");
      } else {
        toast.success("Demo data loaded: 1 account, 1 setup. (Trade creation skipped.)");
      }
      qc.invalidateQueries();
    } catch (err) {
      console.error(err);
      toast.error("Failed to load demo data.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 lg:px-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Backup, Snapshot &amp; Data Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Export portable JSON snapshots of your records or restore previous
            backups.
          </p>
        </div>

        {/* Card 1 — Export Backup (.JSON) */}
        <BackupCard>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary">
              <FileJson className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <SectionHeading>Export Backup (.JSON)</SectionHeading>
              <p className="text-sm text-muted-foreground mt-1">
                Generates a JSON snapshot containing accounts, setups, trades,
                journal entries, and trading days for offline archiving.
              </p>
              <div className="mt-4">
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export Backup JSON
                </Button>
              </div>
            </div>
          </div>
        </BackupCard>

        {/* Card 2 — Import Backup Archive */}
        <BackupCard>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <SectionHeading>Import Backup Archive</SectionHeading>
              <p className="text-sm text-muted-foreground mt-1">
                Restore your trading journal records from a previous{" "}
                <span className="font-mono text-xs bg-background px-1 py-0.5 rounded">
                  .json
                </span>{" "}
                backup file. This will create new records (with new IDs) for
                accounts, setups, and trades.
              </p>

              {/* Hidden file input — the visible button triggers it */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                }}
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="border-input text-foreground hover:bg-muted/50 rounded-lg"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Select Backup JSON
                </Button>
                {importing && (
                  <span className="text-xs text-muted-foreground">
                    Restoring records…
                  </span>
                )}
              </div>

              {/* Imported summary */}
              {importedSummary && !importing && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-profit mt-0.5 shrink-0" />
                    <div className="text-xs text-emerald-800">
                      <div className="font-semibold mb-1">Restore complete</div>
                      <ul className="space-y-0.5 tabular-nums">
                        <li>· {importedSummary.accounts} account(s) created</li>
                        <li>· {importedSummary.strategies} setup(s) created</li>
                        <li>· {importedSummary.trades} trade(s) created</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </BackupCard>

        {/* Card 3 — Demo Data Generator */}
        <BackupCard>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-200">
              <Database className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <SectionHeading>Demo Data Generator</SectionHeading>
              <p className="text-sm text-muted-foreground mt-1">
                Quickly load a sample dataset (Account, Setup, Trade) directly
                into the database. Useful for testing the app without manually
                creating records.
              </p>
              <div className="mt-4">
                <Button
                  onClick={handleLoadDemoData}
                  disabled={demoLoading}
                  variant="outline"
                  className="bg-amber-50 text-warning border-amber-200 hover:bg-warning/15 rounded-lg"
                >
                  {demoLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  Load Sample Demo Data
                </Button>
              </div>
            </div>
          </div>
        </BackupCard>

        {/* Footnote */}
        <p className="text-xs text-muted-foreground/70 text-center pt-2">
          Backups are stored locally in your browser session. Always keep an
          offline copy of your export JSON for long-term archiving.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational primitives (slate/white aesthetic)
// ---------------------------------------------------------------------------

function BackupCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
      {children}
    </h2>
  );
}
