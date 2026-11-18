"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNav } from "@/lib/nav-store";
import { useFavorites } from "@/lib/favorites-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatSignedCents, formatR, formatPrice, centsToNumberString } from "@/lib/money";
import { PrivacyMask } from "@/components/common/privacy-mask";
import { dToNumber } from "@/lib/decimal";
import {
  parseChecklistItems,
  parseAnswers,
  parseSnapshotItems,
  extractChecklist,
  type ChecklistItem,
  type ChecklistAnswer,
} from "@/lib/checklist-evaluation";
import { isSyntheticSampleTrade } from "@/lib/prop-firm-engine";
import {
  ArrowLeft,
  Copy,
  Trash2,
  Edit,
  TrendingUp,
  TrendingDown,
  Clock,
  Tag,
  AlertTriangle,
  Image as ImageIcon,
  Check,
  X,
  Sparkles,
  HelpCircle,
  Lock,
  Play,
  Star,
  Archive,
  BookOpen,
  MoreHorizontal,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { ImageViewer } from "@/components/trade/image-viewer";
import { CloseTradeModal } from "@/components/trade/close-trade-modal";
import { ExecuteTradeModal } from "@/components/trade/execute-trade-modal";
import { TradeReplay } from "@/components/trade/trade-replay";
import { useRouter } from "next/navigation";
import { TIMEFRAME_GROUPS, getTimeframeGroup, getTimeframeLabel } from "@/lib/timeframes";
import { extractCustomFields } from "@/lib/strategy-custom-fields";


async function fetchTrade(id: string) {
  const res = await fetch(`/api/trades/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load trade");
  return res.json();
}

export function TradeDetailView({ tradeId, onBack }: { tradeId?: string; onBack?: () => void } = {}) {
  const { params, navigate } = useNav();
  const qc = useQueryClient();
  const id = tradeId || params.id;
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = id ? isFavorite(id) : false;
  const { data: trade, isLoading } = useQuery({
    queryKey: ["trade", id],
    queryFn: () => fetchTrade(id),
    enabled: !!id,
  });
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [closeTradeOpen, setCloseTradeOpen] = useState(false);
  const [executeTradeOpen, setExecuteTradeOpen] = useState(false);
  const [publishingTelegram, setPublishingTelegram] = useState(false);

  const handlePublishTelegram = async () => {
    // Generate one unique request ID for this intentional publishing action
    const requestId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    setPublishingTelegram(true);

    // Reuse the same request ID if an HTTP attempt fails transiently and needs retry
    const executeAttempt = async (attempt = 1): Promise<any> => {
      try {
        const res = await fetch("/api/telegram/publish", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
          },
          body: JSON.stringify({ tradeId: id, requestId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to publish to Telegram");
        return data;
      } catch (err: any) {
        if (
          attempt === 1 &&
          !err.message?.includes("Draft") &&
          !err.message?.includes("not found") &&
          !err.message?.includes("not configured")
        ) {
          await new Promise((r) => setTimeout(r, 600));
          return executeAttempt(2);
        }
        throw err;
      }
    };

    try {
      await executeAttempt(1);
      toast.success("Trade publication queued for Telegram channel!");
      qc.invalidateQueries({ queryKey: ["telegram-deliveries"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPublishingTelegram(false);
    }
  };

  // Latest checklist evaluation for the trade (Fix 3). The trade-detail GET
  // returns `checklistEvaluations` ordered by `evaluatedAt` desc, so the
  // first entry is the most recent. We parse the version's `itemsJson`
  // (for item labels) and the evaluation's `rawAnswersJson` (for the
  // checked/unchecked state of each item) once here so the Setup tab can
  // render the full evaluation breakdown. Declared before the early-return
  // guards so the hook ordering stays stable across renders.
  const setup = useMemo(() => safeJson(trade?.setupJson, {}), [trade?.setupJson]);

  const checklistEvaluation = useMemo(() => {
    if (!trade) return null;
    const evals = Array.isArray(trade.checklistEvaluations)
      ? trade.checklistEvaluations
      : [];
    if (evals.length === 0) return null;
    const latest = evals[0];

    // Priority 1: Snapshot items embedded in evaluation record at trade time
    const snapshotItems = parseSnapshotItems(latest.rawAnswersJson);

    // Priority 2: ChecklistVersion items if separate checklist entity
    const cvItems = latest.checklistVersion ? parseChecklistItems(latest.checklistVersion.itemsJson) : [];

    // Priority 3: Strategy rules items from setup snapshot, or latest strategy version
    const rulesSource = setup?.strategySnapshot?.rulesJson ?? latest.strategyVersion?.rulesJson ?? trade.strategyVersion?.rulesJson;
    const svItems = rulesSource ? extractChecklist(rulesSource) : [];

    const items: ChecklistItem[] = (snapshotItems && snapshotItems.length > 0)
      ? snapshotItems
      : (cvItems.length > 0 ? cvItems : svItems);

    const answers: ChecklistAnswer = parseAnswers(latest.rawAnswersJson);
    const checklistName = latest.checklistVersion?.checklist?.name ?? trade.strategy?.name ?? "Checklist";
    const versionLabel = latest.checklistVersion?.versionLabel ?? setup?.strategySnapshot?.versionLabel ?? latest.strategyVersion?.versionLabel ?? trade.strategyVersion?.versionLabel ?? "1.0";

    return {
      checklistName,
      versionLabel,
      weightedScore: latest.weightedScore,
      finalGrade: latest.finalGrade,
      evaluatedAt: latest.evaluatedAt,
      items,
      answers,
    };
  }, [trade, setup]);

  const strategyCustomFields = useMemo(() => {
    // Prefer snapshot from setupJson if recorded at execution time so historical trades never drift
    const rulesSource = setup?.strategySnapshot?.rulesJson ?? trade?.strategyVersion?.rulesJson;
    return extractCustomFields(rulesSource);
  }, [setup?.strategySnapshot?.rulesJson, trade?.strategyVersion?.rulesJson]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!trade) return null;

  const pnl = formatSignedCents(trade.netPnlCents);
  const thesis = safeJson(trade.thesisJson, {});
  const psychBefore = safeJson(trade.psychBeforeJson, {});
  const psychAfter = safeJson(trade.psychAfterJson, {});
  const behaviorFlags: string[] = safeJson(trade.behaviorFlagsJson, []);
  const tags: string[] = safeJson(trade.tagsJson, []);
  const planAdherence = safeJson(trade.planAdherenceJson, {});

  const media = trade.media ?? [];
  // Evidence timeline renders both images and videos. The ImageViewer modal
  // is image-only by design, but videos get an inline <video controls>
  // player below in the grid (Fix 4 — video playback).
  const images = media.filter((m: any) => m.kind === "image");
  const evidenceMedia = media.filter((m: any) => m.kind === "image" || m.kind === "video");

  // Strategy + version display label (Fix 2). Falls back to just the
  // strategy name if no version is linked, or "-" if neither exists.
  const strategyLabel = trade.strategy?.name
    ? trade.strategyVersion?.versionLabel
      ? `${trade.strategy.name} v${trade.strategyVersion.versionLabel}`
      : trade.strategy.name
    : "-";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => onBack ? onBack() : navigate("tradesLog")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{trade.instrumentSymbol}</h1>
            <button
              type="button"
              onClick={() => id && toggleFavorite(id, trade.instrumentSymbol)}
              className="p-1 rounded-md text-muted-foreground hover:text-amber-400 transition-colors"
              title={isFav ? "Remove from Favorites (F)" : "Add to Favorites (F)"}
            >
              <Star className={cn("h-5 w-5", isFav ? "text-amber-400 fill-amber-400" : "text-muted-foreground/60")} />
            </button>
            <Badge variant="outline" className={cn(trade.direction === "long" ? "text-profit" : "text-loss")}>
              {trade.direction === "long" ? "LONG" : "SHORT"}
            </Badge>
            {trade.setupGrade && (
              <Badge variant="outline" className={cn(gradeClass(trade.setupGrade))}>{trade.setupGrade}</Badge>
            )}
            {trade.strategyVersion?.versionLabel && (
              <Badge variant="outline" className="font-normal">
                v{trade.strategyVersion.versionLabel}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={cn(
                "capitalize",
                trade.status === "planned" && "bg-primary/10 text-primary",
                trade.status === "open" && "bg-warning/15 text-warning",
              )}
            >
              {trade.status}
            </Badge>
            {isSyntheticSampleTrade(trade) && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-semibold">
                DEMO / SAMPLE RECORD
              </Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{trade.entryTime ? new Date(trade.entryTime).toLocaleString() : "Open"} · {trade.session ?? "-"}</span>
            {trade.newsEvent && trade.newsEvent !== "none" && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 h-5">
                {trade.newsEvent.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} News
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={cn("text-xl font-semibold tnum", pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "")}>
            <PrivacyMask value={pnl.text} />
          </div>
          <div className={cn("text-sm tnum", trade.actualR && dToNumber(trade.actualR) > 0 ? "text-profit" : trade.actualR && dToNumber(trade.actualR) < 0 ? "text-loss" : "text-muted-foreground")}>
            {formatR(trade.actualR)}
          </div>
        </div>
      </div>

      {/* Actions */}
      {/* Mobile Action Bar */}
      <div className="flex sm:hidden items-center justify-between gap-1.5 w-full">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={isFav ? "default" : "outline"}
            size="sm"
            onClick={() => id && toggleFavorite(id, trade.instrumentSymbol)}
            className={cn(
              "h-8 px-2.5 text-xs",
              isFav ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600" : "text-muted-foreground"
            )}
            title="Toggle Favorite"
          >
            <Star className={cn("h-3.5 w-3.5 mr-1", isFav && "fill-current")} />
            <span>{isFav ? "Favorited" : "Favorite"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("tradeNew", { id })}
            className="h-8 px-2.5 text-xs"
          >
            <Edit className="h-3.5 w-3.5 mr-1" />
            <span>Edit</span>
          </Button>
          {trade.status === "planned" && !trade.isDraft && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setExecuteTradeOpen(true)}
              className="h-8 px-2.5 text-xs bg-primary"
            >
              <Play className="h-3.5 w-3.5 mr-1" /> Start
            </Button>
          )}
          {trade.status === "open" && !trade.isDraft && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setCloseTradeOpen(true)}
              className="h-8 px-2.5 text-xs bg-primary"
            >
              <Lock className="h-3.5 w-3.5 mr-1" /> Close
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
            <DropdownMenuItem
              onClick={async () => {
                const res = await fetch(`/api/trades/${id}/duplicate`, { method: "POST" });
                if (res.ok) {
                  toast.success("Trade duplicated as draft.");
                  qc.invalidateQueries({ queryKey: ["trades"] });
                } else {
                  toast.error("Failed to duplicate.");
                }
              }}
              className="cursor-pointer text-xs py-2"
            >
              <Copy className="h-3.5 w-3.5 mr-2" />
              <span>Duplicate as Draft</span>
            </DropdownMenuItem>
            {trade.strategyId && (
              <DropdownMenuItem
                onClick={() => navigate("setups", { id: trade.strategyId })}
                className="cursor-pointer text-xs py-2"
              >
                <BookOpen className="h-3.5 w-3.5 mr-2" />
                <span>Setup Dictionary</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={async () => {
                const res = await fetch("/api/archive", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ entityType: "trade", id, action: "archive" }),
                });
                if (res.ok) {
                  toast.success("Trade archived safely. You can restore it anytime in Archived Records.");
                  qc.invalidateQueries({ queryKey: ["trades"] });
                  qc.invalidateQueries({ queryKey: ["prop-challenges"] });
                  navigate("tradesLog");
                } else {
                  toast.error("Failed to archive trade.");
                }
              }}
              className="cursor-pointer text-xs py-2 text-muted-foreground hover:text-amber-500"
            >
              <Archive className="h-3.5 w-3.5 mr-2" />
              <span>Archive Record</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handlePublishTelegram}
              disabled={publishingTelegram}
              className="cursor-pointer text-xs py-2 text-sky-500 hover:text-sky-400"
            >
              <Send className="h-3.5 w-3.5 mr-2" />
              <span>{publishingTelegram ? "Publishing..." : "Publish to Telegram"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                if (!confirm("Delete this trade? This cannot be undone.")) return;
                const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
                if (res.ok) {
                  toast.success("Trade deleted.");
                  qc.invalidateQueries({ queryKey: ["trades"] });
                  qc.invalidateQueries({ queryKey: ["prop-challenges"] });
                  navigate("tradesLog");
                } else {
                  toast.error("Failed to delete.");
                }
              }}
              className="cursor-pointer text-xs py-2 text-loss focus:text-loss"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              <span>Delete Trade</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop Actions */}
      <div className="hidden sm:flex flex-wrap gap-2">
        <Button
          variant={isFav ? "default" : "outline"}
          size="sm"
          onClick={() => id && toggleFavorite(id, trade.instrumentSymbol)}
          className={cn(
            isFav
              ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="Toggle Favorite (F)"
        >
          <Star className={cn("h-4 w-4", isFav && "fill-current")} />
          <span>{isFav ? "Favorited" : "Favorite"}</span>
          <kbd className={cn("text-[10px] font-mono px-1 py-0.2 rounded ml-1", isFav ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
            F
          </kbd>
        </Button>
        {trade.status === "planned" && !trade.isDraft && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setExecuteTradeOpen(true)}
            className="bg-primary"
          >
            <Play className="h-4 w-4" /> Start Trade
          </Button>
        )}
        {trade.status === "open" && !trade.isDraft && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setCloseTradeOpen(true)}
            className="bg-primary"
          >
            <Lock className="h-4 w-4" /> Close Trade
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => navigate("tradeNew", { id })}>
          <Edit className="h-4 w-4" /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={publishingTelegram}
          onClick={handlePublishTelegram}
          className="text-sky-500 border-sky-500/30 hover:bg-sky-500/10 gap-1.5"
          title="Publish or republish this trade to your Telegram channel"
        >
          <Send className="h-4 w-4" /> {publishingTelegram ? "Publishing..." : "Telegram"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const res = await fetch(`/api/trades/${id}/duplicate`, { method: "POST" });
            if (res.ok) {
              toast.success("Trade duplicated as draft.");
              qc.invalidateQueries({ queryKey: ["trades"] });
            } else {
              toast.error("Failed to duplicate.");
            }
          }}
        >
          <Copy className="h-4 w-4" /> Duplicate
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground hover:text-amber-500"
          onClick={async () => {
            const res = await fetch("/api/archive", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ entityType: "trade", id, action: "archive" }),
            });
            if (res.ok) {
              toast.success("Trade archived safely. You can restore it anytime in Archived Records.");
              qc.invalidateQueries({ queryKey: ["trades"] });
              navigate("tradesLog");
            } else {
              toast.error("Failed to archive trade.");
            }
          }}
          title="Safely archive this trade (reversible)"
        >
          <Archive className="h-4 w-4" /> Archive
        </Button>
        {trade.strategyId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("setups", { id: trade.strategyId })}
            className="text-muted-foreground hover:text-foreground"
            title="Inspect setup dictionary and definitions"
          >
            <BookOpen className="h-4 w-4" /> Dictionary
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-loss hover:text-loss"
          onClick={async () => {
            if (!confirm("Delete this trade? This cannot be undone.")) return;
            const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
            if (res.ok) {
              toast.success("Trade deleted.");
              navigate("tradesLog");
            } else {
              toast.error("Failed to delete.");
            }
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Entry" value={trade.entryPriceAvg ? formatPrice(trade.entryPriceAvg, 5) : "-"} />
        <MiniStat label="Exit" value={trade.exitPriceAvg ? formatPrice(trade.exitPriceAvg, 5) : "-"} />
        <MiniStat label="Quantity" value={trade.positionSize ?? "-"} />
        <MiniStat label="Net P&L" value={pnl.text} tone={pnl.sign > 0 ? "profit" : pnl.sign < 0 ? "loss" : "neutral"} />
        <MiniStat label="Gross P&L" value={formatSignedCents(trade.grossPnlCents).text} tone={trade.grossPnlCents > 0 ? "profit" : trade.grossPnlCents < 0 ? "loss" : "neutral"} />
        <MiniStat
          label="Planned R:R"
          value={trade.plannedRR ? formatR(trade.plannedRR) : "—"}
          tone="neutral"
          hint="Target distance ÷ stop distance (planned before entry)"
        />
        <MiniStat
          label="Realized R"
          value={
            trade.status === "open" || trade.status === "planned"
              ? "—"
              : formatR(trade.actualR)
          }
          tone={trade.actualR && dToNumber(trade.actualR) > 0 ? "profit" : trade.actualR && dToNumber(trade.actualR) < 0 ? "loss" : "neutral"}
          hint="Realized result relative to your planned risk"
        />
        <MiniStat label="Costs" value={centsToNumberString(trade.feesCents + trade.commissionCents + trade.swapCents)} />
        <MiniStat label="Strategy" value={strategyLabel} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar h-auto py-1 gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 shrink-0">Overview</TabsTrigger>
          <TabsTrigger value="setup" className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 shrink-0">Setup</TabsTrigger>
          <TabsTrigger value="execution" className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 shrink-0">Execution</TabsTrigger>
          <TabsTrigger value="replay" className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 shrink-0">Replay</TabsTrigger>
          <TabsTrigger value="psychology" className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 shrink-0">Psychology</TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 shrink-0">Evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-3">
          <Card className="p-4">
            <h3 className="font-medium mb-2">Trading Thesis</h3>
            {thesis?.why ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{thesis.why}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No thesis recorded.</p>
            )}
            {thesis?.narrative && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">Narrative:</span> {thesis.narrative}
              </div>
            )}
            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              {thesis?.liquidityTarget && <div><span className="text-muted-foreground">Liquidity target:</span> {thesis.liquidityTarget}</div>}
              {thesis?.target && <div><span className="text-muted-foreground">Target:</span> {thesis.target}</div>}
              {thesis?.earlyExit && <div><span className="text-muted-foreground">Early exit triggers:</span> {thesis.earlyExit}</div>}
            </div>
            {thesis?.confirms && Array.isArray(thesis.confirms) && thesis.confirms.length > 0 && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">Confirmations:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {thesis.confirms.map((c: string) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                </div>
              </div>
            )}
            {thesis?.invalidates && Array.isArray(thesis.invalidates) && thesis.invalidates.length > 0 && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">Invalidations:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {thesis.invalidates.map((c: string) => <Badge key={c} variant="outline" className="text-xs text-loss">{c}</Badge>)}
                </div>
              </div>
            )}
          </Card>

          {trade.account?.name && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
              <span>Account:</span>
              <strong className="text-foreground font-medium">{trade.account.name}</strong>
            </div>
          )}

          {tags.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2"><Tag className="h-4 w-4" /> Tags</h3>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            </Card>
          )}

          {trade.notes && (
            <Card className="p-4">
              <h3 className="font-medium mb-2">Trade Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{trade.notes}</p>
            </Card>
          )}

          {trade.lessons && (
            <Card className="p-4">
              <h3 className="font-medium mb-2">Lessons Learned</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{trade.lessons}</p>
            </Card>
          )}

          {behaviorFlags.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium mb-3">Behavior &amp; Discipline Flags</h3>
              <div className="flex flex-wrap gap-2">
                {behaviorFlags.map(f => (
                  <Badge key={f} variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 capitalize">
                    {f.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="setup" className="space-y-4 mt-3">
          <Card className="p-4">
            <h3 className="font-medium mb-3">
              {trade.strategy?.name ? `${trade.strategy.name} Setup` : "Setup & Trade Context"}
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {/* Dynamic Strategy-Specific Custom Fields */}
              {strategyCustomFields.map((field) => {
                const customVal = setup?.customFields?.[field.id] ?? setup?.[field.id];
                if (customVal === undefined || customVal === null || customVal === "") return null;
                return (
                  <SetupSection
                    key={field.id}
                    title={field.name}
                    data={customVal}
                    isList={Array.isArray(customVal)}
                    hint={field.description}
                  />
                );
              })}

              {/* Legacy setup fields if present and not already displayed */}
              {setup?.htfContext && <SetupSection title="Higher Timeframe Context" data={setup.htfContext} />}
              {setup?.liquidity && <SetupSection title="Liquidity" data={setup.liquidity} isList />}
              {setup?.structure && <SetupSection title="Structure" data={setup.structure} isList />}
              {setup?.entryModel && <SetupSection title="Entry Model" data={setup.entryModel} />}
              <SetupSection title="Market" data={trade.market} />
              <SetupSection title="Session" data={setup?.session ?? trade.session} />
              <SetupSection title="Timeframe" data={setup?.timeframe} />
              <SetupSection
                title="Setup Score"
                data={trade.setupScore ? `${(dToNumber(trade.setupScore) * 100).toFixed(0)}%` : null}
                hint="Calculated from the weighted rules defined by your strategy"
              />
            </div>
          </Card>

          {/* Checklist Evaluation (Fix 3). Shows the snapshot of the A+
              checklist answers + the computed score/grade at the time the
              trade was saved. The evaluation row is created server-side on
              POST/PATCH /api/trades/[id] (see checklist-evaluation.ts). */}
          {checklistEvaluation ? (
            <Card className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h3 className="font-medium flex items-center gap-2">
                    Checklist Evaluation
                    <Sparkles className="h-4 w-4 text-primary" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {checklistEvaluation.checklistName} · v{checklistEvaluation.versionLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(gradeClass(checklistEvaluation.finalGrade))}
                  >
                    {checklistEvaluation.finalGrade}
                  </Badge>
                  <span className="text-sm font-semibold tabular-nums">
                    {(dToNumber(checklistEvaluation.weightedScore) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Evaluated {new Date(checklistEvaluation.evaluatedAt).toLocaleString()}
                </span>
              </div>

              {/* Score progress bar */}
              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      checklistEvaluation.finalGrade === "A+" ? "bg-profit" :
                      checklistEvaluation.finalGrade === "A" ? "bg-profit/80" :
                      checklistEvaluation.finalGrade === "B" ? "bg-warning" :
                      checklistEvaluation.finalGrade === "C" ? "bg-muted-foreground" :
                      "bg-destructive",
                    )}
                    style={{
                      width: `${Math.round(dToNumber(checklistEvaluation.weightedScore) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Per-item answers */}
              {checklistEvaluation.items.length > 0 ? (
                <div className="space-y-1.5">
                  {checklistEvaluation.items.map((item) => {
                    const ans = checklistEvaluation.answers[item.id] ?? { checked: false };
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-md border text-sm",
                          ans.checked
                            ? "bg-profit/5 border-profit/20"
                            : "border-border bg-muted/20",
                        )}
                      >
                        {ans.checked ? (
                          <Check className="h-4 w-4 text-profit shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <span className={cn("flex-1 min-w-0", !ans.checked && "text-muted-foreground line-through")}>
                          {item.text}
                        </span>
                        {item.required && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 shrink-0">
                            Required
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px] py-0 px-1 shrink-0">
                          ×{item.weight}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  This checklist version has no items defined.
                </p>
              )}

              {checklistEvaluation.items.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Score = sum(weights of checked) / sum(weights of all). Required items must all be checked to keep an A+/A/B grade; otherwise the grade is capped at C.
                </p>
              )}
            </Card>
          ) : (
            <Card className="p-4">
              <div className="text-center py-3 space-y-1">
                <p className="text-sm text-muted-foreground">
                  No checklist evaluation recorded for this trade.
                </p>
                <p className="text-xs text-muted-foreground">
                  Evaluations are captured when the A+ Setup Checklist is filled in on the trade form.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="execution" className="space-y-4 mt-3">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Execution Ledger</h3>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right hidden md:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {trade.executions?.map((e: any) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={cn(e.kind === "entry" ? "text-profit" : "text-loss")}>
                          {e.kind}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tnum">{formatPrice(e.price, 5)}</td>
                      <td className="px-3 py-2 text-right tnum">{e.quantity}</td>
                      <td className="px-3 py-2 text-right tnum text-xs text-muted-foreground hidden md:table-cell">
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-medium mb-3">Planned Partial Exits</h3>
            {Array.isArray(trade.targets) && trade.targets.length > 0 ? (
              <div className="space-y-2">
                {trade.targets.map((tp: any, idx: number) => (
                  <div key={tp.id ?? idx} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                    <span className="font-medium text-foreground">{tp.label || `TP${idx + 1}`}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {tp.price ? formatPrice(tp.price, 5) : "-"}
                    </span>
                  </div>
                ))}
                {trade.targets.length > 1 && (() => {
                  // Compute the equal-weighted average of valid prices (same
                  // logic as the trade form's "Weighted Exit Price" preview).
                  const validPrices = trade.targets
                    .map((tp: any) => tp.price)
                    .filter((p: any) => p && dToNumber(String(p)) > 0);
                  if (validPrices.length === 0) return null;
                  const sum = validPrices.reduce(
                    (acc: number, p: any) => acc + dToNumber(String(p)),
                    0,
                  );
                  const avg = sum / validPrices.length;
                  return (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                      <span>Average Exit Price</span>
                      <span className="font-mono tabular-nums">{avg.toFixed(5)}</span>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No planned partial exits recorded.</p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-medium mb-3">Planned vs Actual</h3>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Planned Entry</div>
                <div className="font-medium tnum">{trade.plannedEntryPrice ? formatPrice(trade.plannedEntryPrice, 5) : "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Planned Stop</div>
                <div className="font-medium tnum">{trade.plannedStopPrice ? formatPrice(trade.plannedStopPrice, 5) : "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Planned Target</div>
                <div className="font-medium tnum">{trade.plannedTargetPrice ? formatPrice(trade.plannedTargetPrice, 5) : "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Avg Entry</div>
                <div className="font-medium tnum">{trade.entryPriceAvg ? formatPrice(trade.entryPriceAvg, 5) : "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Avg Exit</div>
                <div className="font-medium tnum">{trade.exitPriceAvg ? formatPrice(trade.exitPriceAvg, 5) : "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risk %</div>
                <div className="font-medium tnum">
                  {trade.plannedRiskPct
                    ? (() => {
                        if (trade.riskAmountCents && trade.accountBalanceCents && trade.accountBalanceCents > 0) {
                          const calc = (trade.riskAmountCents / trade.accountBalanceCents) * 100;
                          return `${calc.toFixed(2)}%`;
                        }
                        const val = dToNumber(trade.plannedRiskPct);
                        if (!Number.isFinite(val) || val <= 0) return "-";
                        const pct = val <= 0.20 ? val * 100 : val;
                        return `${pct.toFixed(2)}%`;
                      })()
                    : "-"}
                </div>
              </div>
            </div>

            {/* Plan Adherence summary */}
            {planAdherence && Object.keys(planAdherence).length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Plan Adherence:</span>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    planAdherence.followedPlan !== false
                      ? "bg-profit/10 text-profit"
                      : "bg-loss/10 text-loss",
                  )}>
                    {planAdherence.followedPlan !== false ? "Followed Plan" : "Deviated"}
                  </span>
                </div>
                {planAdherence.followedPlan === false && (
                  <div className="grid sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Actual Entry</div>
                      <div className="font-medium tnum">{planAdherence.actualEntryPrice ? formatPrice(planAdherence.actualEntryPrice, 5) : "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Actual Stop</div>
                      <div className="font-medium tnum">{planAdherence.actualStopPrice ? formatPrice(planAdherence.actualStopPrice, 5) : "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Actual Target</div>
                      <div className="font-medium tnum">{planAdherence.actualTargetPrice ? formatPrice(planAdherence.actualTargetPrice, 5) : "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Actual Lot</div>
                      <div className="font-medium tnum">{planAdherence.actualLotSize || "-"}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="replay" className="space-y-4 mt-3">
          <TradeReplay trade={trade} />
        </TabsContent>

        <TabsContent value="psychology" className="space-y-4 mt-3">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-medium">Before Execution</h3>
              {psychBefore?.moodTags && psychBefore.moodTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {psychBefore.moodTags.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Confidence:</span> {psychBefore?.confidence ?? "-"}/5</div>
                <div><span className="text-muted-foreground">Energy:</span> {psychBefore?.energy ?? "-"}/5</div>
              </div>
              {psychBefore?.impact && (
                <div className="text-sm"><span className="text-muted-foreground">Impact:</span> {psychBefore.impact}</div>
              )}
              {psychBefore?.notes && (
                <div className="text-sm bg-muted/40 p-2.5 rounded-md border border-border">
                  <span className="text-xs text-muted-foreground block mb-1">Pre-trade Mindset:</span>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{psychBefore.notes}</p>
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-medium">After Execution</h3>
              {psychAfter?.moodTags && psychAfter.moodTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {psychAfter.moodTags.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Confidence:</span> {psychAfter?.confidence ?? "-"}/5</div>
                <div><span className="text-muted-foreground">Energy:</span> {psychAfter?.energy ?? "-"}/5</div>
              </div>
              {psychAfter?.notes && (
                <div className="text-sm bg-muted/40 p-2.5 rounded-md border border-border">
                  <span className="text-xs text-muted-foreground block mb-1">Post-trade Debrief:</span>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{psychAfter.notes}</p>
                </div>
              )}
            </Card>
          </div>

          {behaviorFlags.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium mb-3">Behavior &amp; Discipline Flags</h3>
              <div className="flex flex-wrap gap-2">
                {behaviorFlags.map((f) => (
                  <Badge key={f} variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 capitalize">
                    {f.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4 mt-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Evidence Timeline</h3>
              <Button size="sm" variant="outline" onClick={() => navigate("tradeNew", { id })}>
                <ImageIcon className="h-4 w-4" /> Add Media
              </Button>
            </div>
            {evidenceMedia.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No evidence uploaded yet. Add screenshots or videos to build a chronological story of this trade.
              </div>
            ) : (
              <div className="space-y-6">
                {TIMEFRAME_GROUPS.map((group) => {
                  const groupMedia = evidenceMedia.filter((m: any) => getTimeframeGroup(m.timeframe) === group);
                  if (groupMedia.length === 0) return null;
                  return (
                    <div key={group} className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">{group}</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {groupMedia.map((m: any) => {
                          const isVideo = m.kind === "video";
                          return (
                            <div key={m.id}>
                              <button
                                onClick={() => {
                                  if (isVideo) return;
                                  const imgIdx = images.findIndex((im: any) => im.id === m.id);
                                  if (imgIdx >= 0) {
                                    setViewerIndex(imgIdx);
                                    setViewerOpen(true);
                                  }
                                }}
                                className="aspect-video rounded-md border border-border overflow-hidden bg-muted hover:opacity-80 transition-opacity text-left w-full relative"
                              >
                                {m.timeframe && (
                                  <Badge variant="secondary" className="absolute top-1 right-1 z-10 text-[10px] py-0 px-1.5 opacity-80 backdrop-blur-sm">
                                    {getTimeframeLabel(m.timeframe)}
                                  </Badge>
                                )}
                                {isVideo && m.url ? (
                                  <video src={m.url} className="w-full h-full object-cover" preload="metadata" controls />
                                ) : (
                                  <img src={m.url || `/api/media/file?token=placeholder`} alt={m.caption || "Evidence"} className="w-full h-full object-cover" />
                                )}
                              </button>
                              {m.caption && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.caption}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {/* Media without a timeframe or unknown timeframe */}
                {(() => {
                  const otherMedia = evidenceMedia.filter((m: any) => !getTimeframeGroup(m.timeframe));
                  if (otherMedia.length === 0) return null;
                  return (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Other / Unspecified</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {otherMedia.map((m: any) => {
                          const isVideo = m.kind === "video";
                          return (
                            <div key={m.id}>
                              <button
                                onClick={() => {
                                  if (isVideo) return;
                                  const imgIdx = images.findIndex((im: any) => im.id === m.id);
                                  if (imgIdx >= 0) {
                                    setViewerIndex(imgIdx);
                                    setViewerOpen(true);
                                  }
                                }}
                                className="aspect-video rounded-md border border-border overflow-hidden bg-muted hover:opacity-80 transition-opacity text-left w-full"
                              >
                                {isVideo && m.url ? (
                                  <video src={m.url} className="w-full h-full object-cover" preload="metadata" controls />
                                ) : (
                                  <img src={m.url || `/api/media/file?token=placeholder`} alt={m.caption || "Evidence"} className="w-full h-full object-cover" />
                                )}
                              </button>
                              {m.caption && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.caption}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {viewerOpen && images.length > 0 && (
        <ImageViewer
          mediaItems={images}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Close Trade Modal */}
      <CloseTradeModal
        tradeId={closeTradeOpen ? id : null}
        onClose={() => setCloseTradeOpen(false)}
      />

      {/* Execute Trade Modal */}
      <ExecuteTradeModal
        tradeId={executeTradeOpen ? id : null}
        onClose={() => setExecuteTradeOpen(false)}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  hint,
  isSensitive,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "neutral";
  hint?: string;
  isSensitive?: boolean;
}) {
  const [showHint, setShowHint] = useState(false);
  const sensitive = isSensitive ?? (/p&l|pnl|costs|fee|comm|profit|loss/i.test(label));

  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {label}
        {hint && (
          <span
            className="relative inline-flex"
            onMouseEnter={() => setShowHint(true)}
            onMouseLeave={() => setShowHint(false)}
            onClick={(e) => { e.preventDefault(); setShowHint((s) => !s); }}
          >
            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            {showHint && (
              <span
                className="absolute left-0 top-4 z-50 w-48 rounded-md border border-border bg-popover p-2 text-xs font-normal text-popover-foreground shadow-md"
                role="tooltip"
              >
                {hint}
              </span>
            )}
          </span>
        )}
      </div>
      <div className={cn("font-medium tnum mt-1", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "")}>
        {sensitive ? <PrivacyMask value={value} /> : value}
      </div>
    </Card>
  );
}

function SetupSection({ title, data, isList, hint }: { title: string; data: any; isList?: boolean; hint?: string }) {
  const [showHint, setShowHint] = useState(false);
  if (!data) return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        {title}
        {hint && (
          <span
            className="relative inline-flex normal-case"
            onMouseEnter={() => setShowHint(true)}
            onMouseLeave={() => setShowHint(false)}
            onClick={(e) => { e.preventDefault(); setShowHint((s) => !s); }}
          >
            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            {showHint && (
              <span
                className="absolute left-0 top-4 z-50 w-48 rounded-md border border-border bg-popover p-2 text-xs font-normal normal-case text-popover-foreground shadow-md"
                role="tooltip"
              >
                {hint}
              </span>
            )}
          </span>
        )}
      </div>
      {isList && Array.isArray(data) ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {data.map((d: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>)}
        </div>
      ) : typeof data === "object" ? (
        <div className="mt-1 text-sm">
          {Object.entries(data).map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span> {String(v)}
            </div>
          ))}
        </div>
      ) : (
        <div className="font-medium mt-1">{String(data)}</div>
      )}
    </div>
  );
}

function safeJson(json: string | null | any, fallback: any): any {
  if (!json) return fallback;
  if (typeof json === "object") return json;
  try { return JSON.parse(json); } catch { return fallback; }
}

function gradeClass(g: string): string {
  switch (g) {
    case "A+": return "bg-profit/15 text-profit";
    case "A": return "bg-profit/10 text-profit";
    case "B": return "bg-warning/15 text-warning";
    case "C": return "bg-muted text-muted-foreground";
    case "Invalid": return "bg-loss/15 text-loss";
    default: return "bg-muted text-muted-foreground";
  }
}
