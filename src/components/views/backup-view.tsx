"use client";

/**
 * Backup, Snapshot & Data Management — reference-aligned rebuild.
 *
 * Cards:
 *   1. EXPORT BACKUP (.JSON)
 *   2. IMPORT BACKUP ARCHIVE (with preview, duplicate detection & atomic rollback)
 *   3. IMPORT BROKER TRADES (CSV) (with broker presets: MT4/MT5, cTrader, NinjaTrader, TradeLocker, IBKR)
 *   4. DEMO DATA GENERATOR
 */

import { useRef, useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavStore } from "@/lib/nav-store";
import { Button } from "@/components/ui/button";
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
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BROKER_PRESETS,
  detectBrokerPreset,
  getPresetMapping,
} from "@/lib/broker-csv-presets";

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
    if (
      lower.includes("symbol") ||
      lower.includes("pair") ||
      lower.includes("ticker") ||
      lower.includes("instrument") ||
      lower.includes("contract") ||
      lower.includes("security") ||
      lower === "item"
    ) {
      map[h] = "instrumentSymbol";
    } else if (
      lower.includes("direction") ||
      lower.includes("type") ||
      lower.includes("side") ||
      lower.includes("action") ||
      lower === "cmd" ||
      lower === "b/s"
    ) {
      map[h] = "direction";
    } else if (
      lower.includes("open price") ||
      lower.includes("entry price") ||
      lower.includes("fill price") ||
      lower.includes("avg price") ||
      lower === "open" ||
      lower === "entry" ||
      lower === "price"
    ) {
      map[h] = "entryPrice";
    } else if (
      lower.includes("close price") ||
      lower.includes("exit price") ||
      lower.includes("cover price") ||
      lower === "close" ||
      lower === "exit"
    ) {
      map[h] = "exitPrice";
    } else if (
      lower.includes("open time") ||
      lower.includes("entry time") ||
      lower.includes("datetime") ||
      lower.includes("filled at") ||
      lower === "date" ||
      lower === "time"
    ) {
      map[h] = "entryTime";
    } else if (
      lower.includes("close time") ||
      lower.includes("exit time") ||
      lower.includes("closed at")
    ) {
      map[h] = "exitTime";
    } else if (
      lower.includes("volume") ||
      lower.includes("size") ||
      lower.includes("lot") ||
      lower.includes("qty") ||
      lower.includes("contracts") ||
      lower.includes("quantity")
    ) {
      map[h] = "quantity";
    } else if (
      lower.includes("stop") ||
      lower === "sl" ||
      lower === "s/l" ||
      lower.includes("stop loss")
    ) {
      map[h] = "stopPrice";
    } else if (
      lower.includes("target") ||
      lower === "tp" ||
      lower === "t/p" ||
      lower.includes("take profit") ||
      lower.includes("limit price")
    ) {
      map[h] = "targetPrice";
    } else if (
      lower.includes("fee") ||
      lower.includes("commission") ||
      lower.includes("comm") ||
      lower.includes("swap") ||
      lower.includes("taxes")
    ) {
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
  const [demoLoading, setDemoLoading] = useState(false);

  // Backup Import & Preview state
  const [previewing, setPreviewing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupPayload, setBackupPayload] = useState<any>(null);
  const [backupPreview, setBackupPreview] = useState<any>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [restoreResult, setRestoreResult] = useState<any>(null);

  // Fetch accounts for CSV import target
  const { data: accountsData } = useQuery<{ items: any[] }>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      return res.json();
    },
  });
  const accounts = accountsData?.items || [];
  const [selectedCsvAccountId, setSelectedCsvAccountId] = useState<string>("");

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
  const [selectedBrokerPreset, setSelectedBrokerPreset] = useState<string>("auto");
  const [selectedBrokerTimezoneOffset, setSelectedBrokerTimezoneOffset] = useState<number | undefined>(2);
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
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        toast.error("Export failed. Please try again.");
        return;
      }
      const backup = await res.json();
      // Fetch full export data for direct download
      const fullRes = await fetch("/api/exports?format=json&type=all");
      const data = await fullRes.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.filename || `alphapips-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Complete institutional backup archive exported successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // --- Backup File Selection & Preview ------------------------------------
  async function handleSelectBackupFile(file: File) {
    setPreviewing(true);
    setBackupPreview(null);
    setRestoreResult(null);
    setBackupPayload(null);
    try {
      const text = await file.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        toast.error("Invalid JSON file. Please select a valid backup archive.");
        return;
      }

      setBackupPayload(data);

      // Call preview endpoint
      const res = await fetch("/api/backups/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: data }),
      });
      const previewData = await res.json();
      if (!res.ok) {
        toast.error(previewData?.error || "Failed to analyze backup archive.");
        return;
      }

      setBackupPreview(previewData);
      toast.info(`Backup analyzed: ${previewData.counts.trades} trades, ${previewData.counts.strategies} setups found.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read backup file.");
    } finally {
      setPreviewing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // --- Execute Transactional Restore --------------------------------------
  async function handleExecuteRestore() {
    if (!backupPayload) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/backups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: backupPayload,
          mode: restoreMode,
          duplicateAction: "skip",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Restore failed. Changes were rolled back safely.");
        return;
      }

      setRestoreResult(data);
      toast.success(
        `Restore completed! Restored ${data.restoredTrades} trades, ${data.restoredStrategies} setups (${data.skippedDuplicates} duplicate trades skipped).`
      );
      qc.invalidateQueries();
    } catch (err) {
      console.error(err);
      toast.error("Network error during restore. Changes were safely rolled back.");
    } finally {
      setRestoring(false);
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

      // Auto-detect broker preset
      const detected = detectBrokerPreset(headers);
      if (detected) {
        setSelectedBrokerPreset(detected.id);
        const presetMapping = getPresetMapping(detected.id, headers);
        setColumnMapping({ ...autoMapHeaders(headers), ...presetMapping });
        if (detected.id === "mt4_mt5") setSelectedBrokerTimezoneOffset(2);
        else if (detected.id === "ninjatrader") setSelectedBrokerTimezoneOffset(-6);
        else if (detected.id === "ibkr") setSelectedBrokerTimezoneOffset(-5);
        else if (detected.id === "ctrader") setSelectedBrokerTimezoneOffset(0);
        toast.success(`Detected ${detected.name} format! Pre-filled column mappings.`);
      } else {
        setSelectedBrokerPreset("custom");
        setColumnMapping(autoMapHeaders(headers));
        toast.success(`Uploaded ${file.name} (${data.rowCount} rows detected).`);
      }
    } catch {
      toast.error("Network error uploading CSV.");
    } finally {
      setCsvUploading(false);
    }
  }

  function handleBrokerPresetChange(presetId: string) {
    if (!activeImport) return;
    setSelectedBrokerPreset(presetId);
    if (presetId === "custom") {
      setColumnMapping(autoMapHeaders(activeImport.headers));
    } else {
      const mapping = getPresetMapping(presetId, activeImport.headers);
      setColumnMapping({ ...autoMapHeaders(activeImport.headers), ...mapping });
      if (presetId === "mt4_mt5") setSelectedBrokerTimezoneOffset(2);
      else if (presetId === "ninjatrader") setSelectedBrokerTimezoneOffset(-6);
      else if (presetId === "ibkr") setSelectedBrokerTimezoneOffset(-5);
      else if (presetId === "ctrader") setSelectedBrokerTimezoneOffset(0);
    }
    setValidationResult(null);
  }

  async function handleValidateMapping() {
    if (!activeImport) return;
    setCsvValidating(true);
    try {
      const res = await fetch(`/api/imports/${activeImport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "map",
          mapping: columnMapping,
          accountId: selectedCsvAccountId || undefined,
          brokerUtcOffset: selectedBrokerTimezoneOffset,
        }),
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
        body: JSON.stringify({
          action: "confirm",
          accountId: selectedCsvAccountId || undefined,
          brokerUtcOffset: selectedBrokerTimezoneOffset,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to import trades.");
        return;
      }
      setCsvImportResult(data);
      toast.success(`Successfully imported ${data.imported} trades into your trading journal!`);
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
            Export complete institutional JSON archives, inspect and preview restore archives with transactional safety, or import CSV histories from your brokers.
          </p>
        </div>

        {/* Card 1 — Export Backup (.JSON) */}
        <BackupCard>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary">
              <FileJson className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <SectionHeading>Export Complete Archive (.JSON)</SectionHeading>
              <p className="text-sm text-muted-foreground mt-1">
                Generates a schema 2.0 institutional snapshot containing all accounts, instruments, versioned strategies, checklists, trades, executions, targets, no-trade observations, prop challenges, tasks, and dictionary entries.
              </p>
              <div className="mt-4">
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
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
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <SectionHeading>Import Backup Archive (Preview &amp; Atomic Restore)</SectionHeading>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload an AlphaPips backup archive. The system performs pre-import validation and confidence-based duplicate detection. All mutations run inside an atomic database transaction.
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSelectBackupFile(f);
                }}
              />

              {!backupPreview ? (
                <div>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={previewing}
                    className="border-input text-foreground hover:bg-muted/50 rounded-lg flex items-center gap-2"
                  >
                    {previewing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Select Backup JSON File
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-3 border-t border-border">
                  {/* Archive Summary Counts */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-xs text-foreground">Archive Contents (Schema {backupPreview.schemaVersion})</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {backupPreview.appName}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded bg-background border border-border">
                        <span className="text-muted-foreground block text-[10px]">Trades</span>
                        <span className="font-mono font-bold text-foreground text-sm">{backupPreview.counts.trades}</span>
                      </div>
                      <div className="p-2 rounded bg-background border border-border">
                        <span className="text-muted-foreground block text-[10px]">Setups / Strategies</span>
                        <span className="font-mono font-bold text-foreground text-sm">{backupPreview.counts.strategies}</span>
                      </div>
                      <div className="p-2 rounded bg-background border border-border">
                        <span className="text-muted-foreground block text-[10px]">Observations</span>
                        <span className="font-mono font-bold text-foreground text-sm">{backupPreview.counts.noTrades}</span>
                      </div>
                      <div className="p-2 rounded bg-background border border-border">
                        <span className="text-muted-foreground block text-[10px]">Prop Trackers</span>
                        <span className="font-mono font-bold text-foreground text-sm">{backupPreview.counts.propChallenges}</span>
                      </div>
                    </div>

                    {/* Duplicate Detection Analysis */}
                    <div className="pt-2 border-t border-border space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">Duplicate Analysis</span>
                        <span className="text-muted-foreground font-mono">
                          {backupPreview.duplicateAnalysis.cleanTradesCount} New / {backupPreview.duplicateAnalysis.exactDuplicatesCount} Exact Duplicates
                        </span>
                      </div>
                      {backupPreview.duplicateAnalysis.exactDuplicatesCount > 0 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          ℹ️ {backupPreview.duplicateAnalysis.exactDuplicatesCount} trades are 100% exact duplicates of existing records and will be safely skipped in Merge mode.
                        </p>
                      )}
                    </div>

                    {/* Mode Selection */}
                    <div className="pt-2 border-t border-border space-y-2">
                      <span className="text-xs font-medium text-foreground block">Restore Execution Mode</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setRestoreMode("merge")}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-colors",
                            restoreMode === "merge"
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background hover:bg-muted text-muted-foreground"
                          )}
                        >
                          <div className="font-semibold text-xs">Merge (Recommended)</div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Appends new records and safely skips exact duplicates without altering current data.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRestoreMode("replace")}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-colors",
                            restoreMode === "replace"
                              ? "border-destructive bg-destructive/10 text-foreground"
                              : "border-border bg-background hover:bg-muted text-muted-foreground"
                          )}
                        >
                          <div className="font-semibold text-xs text-destructive">Replace (Full Overwrite)</div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Takes an automatic pre-restore safety snapshot, then replaces all records with this archive.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Transaction Safety Guarantee */}
                    <div className="p-2.5 rounded-lg bg-background border border-border text-[11px] text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>{backupPreview.safetySummary.atomicityNotice}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        size="sm"
                        onClick={handleExecuteRestore}
                        disabled={restoring}
                        className={cn(
                          "text-xs font-semibold",
                          restoreMode === "replace"
                            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                        Confirm &amp; Execute {restoreMode === "replace" ? "Replace" : "Merge"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBackupPreview(null);
                          setBackupPayload(null);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>

                  {/* Restore Result Card */}
                  {restoreResult && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>Restore successfully committed ({restoreResult.mode} mode)</span>
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                        <div>Trades: {restoreResult.restoredTrades}</div>
                        <div>Setups: {restoreResult.restoredStrategies}</div>
                        <div>Observations: {restoreResult.restoredNoTrades}</div>
                        <div>Duplicates Skipped: {restoreResult.skippedDuplicates}</div>
                      </div>
                    </div>
                  )}
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
                  Upload CSV trade histories from MetaTrader (MT4/MT5), cTrader, NinjaTrader, TradeLocker, or Interactive Brokers. Pre-fills standard column mappings and prevents duplicate entries.
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

                  {/* Broker Preset, Server Timezone & Target Account Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-medium text-foreground">Broker Preset</label>
                      <Select
                        value={selectedBrokerPreset}
                        onValueChange={handleBrokerPresetChange}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="Select broker format..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom / Manual Mapping</SelectItem>
                          {BROKER_PRESETS.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-foreground">Broker Timezone</label>
                      <Select
                        value={selectedBrokerTimezoneOffset != null ? String(selectedBrokerTimezoneOffset) : "none"}
                        onValueChange={(val) => setSelectedBrokerTimezoneOffset(val === "none" ? undefined : parseFloat(val))}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="Select timezone offset..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2" className="text-xs">UTC+2 (EET - Standard MT4/MT5)</SelectItem>
                          <SelectItem value="3" className="text-xs">UTC+3 (EEST - Summer MT4/MT5)</SelectItem>
                          <SelectItem value="0" className="text-xs">UTC+0 (GMT / London / cTrader)</SelectItem>
                          <SelectItem value="-5" className="text-xs">UTC-5 (EST / US Eastern / IBKR)</SelectItem>
                          <SelectItem value="-6" className="text-xs">UTC-6 (CST / NinjaTrader)</SelectItem>
                          <SelectItem value="none" className="text-xs">Unspecified (Parse as Local / ISO)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-foreground">Target Account</label>
                      <Select
                        value={selectedCsvAccountId}
                        onValueChange={setSelectedCsvAccountId}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="Default Trading Account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Default Account</SelectItem>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              {a.name} ({a.currency})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
