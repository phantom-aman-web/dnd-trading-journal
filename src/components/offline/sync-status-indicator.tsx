"use client";

import { useState } from "react";
import { useSyncStore } from "@/lib/offline-sync-engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  CloudOff,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncStatusIndicator() {
  const { isOnline, status, pendingCount, lastSyncedAt, conflicts, triggerSync, resolveConflict } = useSyncStore();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const isSyncing = status === "synchronizing";
  const hasConflict = status === "conflict" || conflicts.length > 0;
  const isOffline = !isOnline;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setPopoverOpen(!popoverOpen)}
        className={cn(
          "h-7 px-2.5 rounded-lg border flex items-center gap-1.5 text-[11px] font-mono transition-colors focus:outline-hidden",
          hasConflict
            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold"
            : isOffline
              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-medium"
              : isSyncing
                ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-medium"
                : "bg-card border-border/80 text-muted-foreground hover:text-foreground"
        )}
        title="Offline Mode & Synchronization Status"
      >
        {isSyncing ? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
            <span className="hidden sm:inline">Syncing...</span>
          </>
        ) : hasConflict ? (
          <>
            <AlertTriangle className="h-3 w-3 text-rose-500" />
            <span>Conflict ({conflicts.length})</span>
          </>
        ) : isOffline ? (
          <>
            <CloudOff className="h-3 w-3 text-amber-500" />
            <span>
              {pendingCount > 0 ? `Saved Locally (${pendingCount})` : "Offline Mode"}
            </span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <Cloud className="h-3 w-3 text-amber-500" />
            <span>Pending ({pendingCount})</span>
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            <span className="hidden sm:inline">Synced</span>
          </>
        )}
      </button>

      {/* Popover Card */}
      {popoverOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopoverOpen(false)} />
          <Card className="absolute right-0 top-9 w-80 z-50 bg-card/95 backdrop-blur-md border border-border p-4 shadow-2xl rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-1.5 font-bold font-jakarta text-foreground">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span>Local Offline &amp; Sync Engine</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] uppercase font-mono py-0",
                  isOnline
                    ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/30 text-amber-600 dark:text-amber-400"
                )}
              >
                {isOnline ? "Online" : "Offline"}
              </Badge>
            </div>

            <div className="space-y-1 text-muted-foreground text-[11px]">
              <div className="flex items-center justify-between">
                <span>Pending local queue:</span>
                <strong className="text-foreground font-mono">{pendingCount} operations</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Last server sync:</span>
                <span className="text-foreground font-mono">
                  {lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : "Just now"}
                </span>
              </div>
            </div>

            {/* Conflicts List */}
            {conflicts.length > 0 && (
              <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 space-y-2">
                <div className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Sync Conflict Detected</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Record was edited both offline and on server. Choose which version to retain:
                </p>
                {conflicts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 pt-1 border-t border-rose-500/20">
                    <span className="text-[10px] font-mono truncate">{c.recordId}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveConflict(c.id, "local")}
                        className="h-5 text-[9px] px-1.5"
                      >
                        Keep Local
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveConflict(c.id, "server")}
                        className="h-5 text-[9px] px-1.5"
                      >
                        Keep Server
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">IndexedDB cache active</span>
              <Button
                size="sm"
                variant="outline"
                disabled={isSyncing || !isOnline}
                onClick={() => triggerSync()}
                className="h-7 text-xs gap-1"
              >
                <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                <span>Sync Now</span>
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
