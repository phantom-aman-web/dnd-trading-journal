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
import { useNavStore } from "@/lib/nav-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Database,
  FileJson,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DND_FIELDS = [
  { key: "instrumentSymbol", label: "Instrument / Symbol", required: true },
  { key: "direction", label: "Direction (Long / Short)", required: true },
  { key: "entryPrice", label: "Entry Price", required: true },
  { key: "exitPrice", label: "Exit Price", required: false },
  { key: "entryTime", label: "Entry Date & Time", required: false },
  { key: "exitTime", label: "Exit Date & Time", required: false },
  { key: "quantity", label: "Position Size / Lots", required: false },
  { key: "stopPrice", label: "Stop Loss Price", required: false },
  { key: "targetPrice", label: "Take Profit Price", required: false },
  { key: "feesCents", label: "Fees / Commission", required: false },
  { key: "session", label: "Session", required: false },
];

function autoMapHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (lower.includes("symbol") || lower.includes("pair") || lower.includes("ticker") || lower === "item") {
      map[h] = "instrumentSymbol";
    } else if (lower.includes("direction") || lower.includes("type") || lower.includes("side") || lower === "cmd") {
      map[h] = "direction";
    } else if (lower.includes("open price") || lower.includes("entry price") || lower === "open" || lower === "entry") {
      map[h] = "entryPrice";
    } else if (lower.includes("close price") || lower.includes("exit price") || lower === "close" || lower === "exit") {
      map[h] = "exitPrice";
    } else if (lower.includes("open time") || lower.includes("entry time") || lower === "date" || lower === "time") {
      map[h] = "entryTime";
    } else if (lower.includes("close time") || lower.includes("exit time")) {
      map[h] = "exitTime";
    } else if (lower.includes("volume") || lower.includes("size") || lower.includes("lot") || lower.includes("qty")) {
      map[h] = "quantity";
    } else if (lower.includes("stop") || lower === "sl") {
      map[h] = "stopPrice";
    } else if (lower.includes("target") || lower === "tp") {
      map[h] = "targetPrice";
    } else if (lower.includes("fee") || lower.includes("commission") || lower.includes("swap")) {
      map[h] = "feesCents";
    }
  }
  return map;
}

export function BackupView() {
  const qc = useQueryClient();
  const setSelectedAccountId = useNavStore((s) => s.setSelectedAccountId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [importedSummary, setImportedSummary] = useState<{
    accounts: number;
    strategies: number;
    trades: number;
  } | null>(null);

  // CSV Import state
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvValidating, setCsvValidating] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [activeImport, setActiveImport] = useState<{
    id: string;
    filename: string;
    rowCount: number;
    headers: string[];
    sampleRows: Record<string, string>[];
  } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<{
    valid: number;
    invalid: number;
    duplicates: number;
    issues: string[];
  } | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<{ imported: number } | null>(null);

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

  // --- CSV Import with Column Mapping & Duplicate Detection ----------------
  async function handleSelectCsv(file: File) {
    setCsvUploading(true);
    setValidationResult(null);
    setCsvImportResult(null);
    try {
      const content = await file.text();
      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          source: "csv",
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to upload CSV file.");
        return;
      }
      let summary: any = {};
      try { summary = JSON.parse(data.summaryJson); } catch {}
      const headers = summary.headers ?? [];
      const sampleRows = summary.sampleRows ?? [];
      setActiveImport({
        id: data.id,
        filename: data.filename,
        rowCount: data.rowCount,
        headers,
        sampleRows,
      });
      setColumnMapping(autoMapHeaders(headers));
      toast.success(`Uploaded ${file.name} (${data.rowCount} rows detected).`);
    } catch {
      toast.error("Network error uploading CSV.");
    } finally {
      setCsvUploading(false);
    }
  }

  async function handleValidateMapping() {
    if (!activeImport) return;
    setCsvValidating(true);
    try {
      const res = await fetch(`/api/imports/${activeImport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "map", mapping: columnMapping }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Validation failed.");
        return;
      }
      setValidationResult(data);
      toast.info(`Validation: ${data.valid} valid, ${data.duplicates} duplicates, ${data.invalid} invalid.`);
    } catch {
      toast.error("Network error during validation.");
    } finally {
      setCsvValidating(false);
    }
  }

  async function handleConfirmCsvImport() {
    if (!activeImport) return;
    setCsvImporting(true);
    try {
      const res = await fetch(`/api/imports/${activeImport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to import trades.");
        return;
      }
      setCsvImportResult(data);
      toast.success(`Successfully imported ${data.imported} trades!`);
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    } catch {
      toast.error("Network error during trade import.");
    } finally {
      setCsvImporting(false);
    }
  }

  // --- Demo data ----------------------------------------------------------
  async function handleLoadDemoData() {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/demo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to load demo data.");
        return;
      }

      if (data.account?.id) {
        setSelectedAccountId(data.account.id);
      }

      toast.success(
        `Demo data loaded: 1 account, ${data.summary?.strategies ?? 4} trading models, and ${data.summary?.trades ?? 18} realistic trades!`,
      );
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      await qc.invalidateQueries({ queryKey: ["trades"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["analytics"] });
      await qc.invalidateQueries({ queryKey: ["calendar"] });
      await qc.invalidateQueries({ queryKey: ["strategies"] });
      await qc.invalidateQueries();
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

        {/* Card 3 — Import Broker Trades (CSV) */}
        <BackupCard>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <SectionHeading>Import Broker Trades (CSV)</SectionHeading>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload CSV trade histories from MetaTrader (MT4/MT5), TradingView, cTrader, or custom brokers. Map columns visually and inspect duplicate detection before importing.
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSelectCsv(f);
                }}
              />

              {!activeImport ? (
                <div>
                  <Button
                    variant="outline"
                    onClick={() => csvInputRef.current?.click()}
                    disabled={csvUploading}
                    className="border-input text-foreground hover:bg-muted/50 rounded-lg flex items-center gap-2"
                  >
                    {csvUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Select Broker CSV File
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-border">
                  {/* File status */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-foreground">{activeImport.filename}</span>
                    <span className="text-muted-foreground">{activeImport.rowCount} rows detected</span>
                  </div>

                  {/* Column Mapper */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-foreground">Column Mapping</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {DND_FIELDS.map((field) => {
                        const currentMappedCol = Object.entries(columnMapping).find(
                          ([_, val]) => val === field.key,
                        )?.[0] ?? "none";

                        return (
                          <div
                            key={field.key}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border"
                          >
                            <span className="font-medium text-foreground truncate">
                              {field.label} {field.required && <span className="text-rose-500">*</span>}
                            </span>
                            <Select
                              value={currentMappedCol}
                              onValueChange={(csvCol) => {
                                setColumnMapping((prev) => {
                                  const next = { ...prev };
                                  for (const [k, v] of Object.entries(next)) {
                                    if (v === field.key) delete next[k];
                                  }
                                  if (csvCol !== "none") {
                                    next[csvCol] = field.key;
                                  }
                                  return next;
                                });
                                setValidationResult(null);
                              }}
                            >
                              <SelectTrigger className="h-7 w-36 text-[11px] bg-background">
                                <SelectValue placeholder="Unmapped" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Not Mapped —</SelectItem>
                                {activeImport.headers.map((h) => (
                                  <SelectItem key={h} value={h} className="text-xs">
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      size="sm"
                      onClick={handleValidateMapping}
                      disabled={csvValidating || csvImporting}
                      className="bg-primary text-primary-foreground text-xs"
                    >
                      {csvValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                      Validate &amp; Check Duplicates
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActiveImport(null);
                        setValidationResult(null);
                        setCsvImportResult(null);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel / Select Another File
                    </Button>
                  </div>

                  {/* Validation Result & Duplicate Review */}
                  {validationResult && (
                    <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-mono"
                        >
                          ✓ {validationResult.valid} Valid Trades
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono",
                            validationResult.duplicates > 0
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {validationResult.duplicates} Duplicates (Auto-Skipped)
                        </Badge>
                        {validationResult.invalid > 0 && (
                          <Badge
                            variant="outline"
                            className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-mono"
                          >
                            ✕ {validationResult.invalid} Invalid Rows
                          </Badge>
                        )}
                      </div>

                      {validationResult.duplicates > 0 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          ℹ️ {validationResult.duplicates} trades matched existing journal records within ±60 seconds and will be automatically skipped to prevent double-counting.
                        </p>
                      )}

                      {validationResult.issues.length > 0 && (
                        <div className="text-[11px] text-rose-500 space-y-0.5">
                          {validationResult.issues.slice(0, 3).map((iss, i) => (
                            <div key={i}>· {iss}</div>
                          ))}
                        </div>
                      )}

                      {validationResult.valid > 0 && (
                        <div className="pt-2">
                          <Button
                            size="sm"
                            onClick={handleConfirmCsvImport}
                            disabled={csvImporting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          >
                            {csvImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            Confirm &amp; Import {validationResult.valid} Trades
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Import Success */}
                  {csvImportResult && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Successfully imported {csvImportResult.imported} trades into your trading journal!</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </BackupCard>

        {/* Card 4 — Demo Data Generator */}
        <BackupCard>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-200">
              <Database className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <SectionHeading>Demo Data Generator</SectionHeading>
              <p className="text-sm text-muted-foreground mt-1">
                Quickly load a rich institutional dataset: 1 funded prop account ($100k FTMO challenge),
                4 trading models (ICT Silver Bullet, London Judas Swing, Nasdaq Momentum, Crypto Mean Reversion),
                and 17 realistic trades (10 wins, 5 losses, 2 breakevens) with full execution fills and behavioral metrics.
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
