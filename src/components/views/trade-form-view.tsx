"use client";

/**
 * TradeFormView — 5-step wizard trade form.
 *
 * Steps (tabs):
 *   1. Trade Info        — account, strategy, symbol, direction, status,
 *                          date/time, session, timeframe, news impact,
 *                          thesis, evidence uploads, advanced (ICT setup,
 *                          psychology, behavior flags, tags).
 *   2. Setup Checklist   — items extracted from the selected strategy's
 *                          rulesJson, each with checkbox + REQUIRED badge,
 *                          live adherence %, immutable-snapshot note.
 *   3. Risk & Sizing     — planned entry/stop/target (required), lot size,
 *                          risk %, auto-calculated stop distance, R:R,
 *                          risk amount, planned profit.
 *   4. Partial Exits     — add/remove named exit levels; weighted exit
 *                          price + total R derived from planned stop/entry.
 *   5. Review & Save     — summary cards + Save as Draft / Save Trade.
 *
 * Defensive fetching (fetchAccounts / fetchStrategies) returns plain arrays
 * regardless of whether the API wraps its response in `{ items: [...] }` or
 * returns a bare array. Query keys include accountId so per-account
 * invalidation works as expected.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNav } from "@/lib/nav-store";
import { calculatePlanAdherence, calculatePositionSize } from "@/lib/financial-engine";
import { Decimal } from "decimal.js";
import {
  evaluateChecklist,
  parseAnswers,
  extractChecklist,
  type ChecklistItem,
  type ChecklistAnswerValue,
  type GradingThresholds,
  DEFAULT_GRADING_THRESHOLDS,
} from "@/lib/checklist-evaluation";
import { NEWS_EVENTS, getNewsEventLabel } from "@/lib/news-events";
import {
  TIMEFRAMES as MEDIA_TIMEFRAMES,
  TIMEFRAME_GROUPS,
  getTimeframeGroup,
  getTimeframeLabel,
} from "@/lib/timeframes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldLabel } from "@/components/common/field-label";
import { ImageAnnotator, type ImageAnnotation } from "@/components/common/image-annotator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  Lock,
  X,
  CheckCircle2,
} from "lucide-react";
import { InstrumentSelector } from "@/components/common/instrument-selector";
import {
  findInstrument,
  normalizeSymbol,
  resolveInstrument,
  unitLabel,
  distanceInUnits,
  type InstrumentDef,
} from "@/lib/instrument-catalog";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DRAFT_KEY = "dnd-trade-draft-5step";

const SESSIONS = [
  { value: "asian_range", label: "Asian Range" },
  { value: "london_open", label: "London Open" },
  { value: "ny_am", label: "New York AM" },
  { value: "ny_lunch", label: "New York Lunch" },
  { value: "ny_pm", label: "New York PM" },
  { value: "off_hours", label: "Off Hours" },
] as const;

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "planned", label: "Planned" },
] as const;

const PSYCH_BEFORE = [
  "calm", "confident", "hesitant", "fearful", "FOMO",
  "impatient", "distracted", "excited", "tired", "focused",
];
const PSYCH_AFTER = [
  "satisfied", "frustrated", "regret", "relief",
  "overconfident", "disappointed", "calm", "confused", "angry",
];
const BEHAVIOR_FLAGS = [
  "entered_early", "broke_rules", "moved_stop", "moved_target",
  "exited_early", "revenge_trade", "overtraded", "increased_size",
  "chased_price", "ignored_plan",
];

const ACCEPTED_MEDIA =
  "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

const STEP_ORDER = ["trade-info", "checklist", "risk", "exits", "review"] as const;
type StepKey = (typeof STEP_ORDER)[number];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function fetchMe() {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

/** Fetch the user's accounts as a plain array (defensive). Returns [] on
 *  any error or unexpected shape. */
async function fetchAccounts(accountId?: string) {
  try {
    const qs = new URLSearchParams({ ...(accountId ? { accountId } : {}) }).toString();
    const url = `/api/accounts${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const arr = data?.items ?? data?.accounts ?? (Array.isArray(data) ? data : []);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Fetch the user's strategies as a plain array (defensive). Returns [] on
 *  any error or unexpected shape. */
async function fetchStrategies() {
  try {
    const res = await fetch("/api/strategies", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const arr = data?.items ?? data?.strategies ?? (Array.isArray(data) ? data : []);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function safeJsonParse(json: string | null | undefined | any, fallback: any): any {
  if (!json) return fallback;
  if (typeof json === "object") return json;
  try { return JSON.parse(json); } catch { return fallback; }
}

/** Format a numeric price with the given decimal precision (default 5,
 *  matching the historical forex-major behaviour). Returns "—" when the
 *  value is missing or non-finite. Pass the selected instrument's
 *  `pricePrecision` to render prices with the right number of decimals
 *  (e.g. 2 for gold, 1 for indices, 0 for YM). */
function fmtPrice(
  value: number | string | null | undefined,
  precision: number = 5,
): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  const p =
    Number.isFinite(precision) && precision >= 0 && precision <= 8
      ? Math.round(precision)
      : 5;
  return n.toFixed(p);
}

/** Format a money amount given a dollars-number (NOT cents). */
function fmtMoney(dollars: number | null | undefined, currency = "USD"): string {
  if (dollars == null || !Number.isFinite(dollars)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
}

/** Generate a short random id for client-side list items. */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function TradeFormView() {
  const { params, navigate } = useNav();
  const qc = useQueryClient();
  const editingId = params.id;

  /* ---------- Fetch metadata ---------- */
  const { data: meta } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const { data: accountsData } = useQuery({
    queryKey: ["accounts-form", meta?.user?.id ?? "anon"],
    queryFn: () => fetchAccounts(),
  });
  const { data: strategiesData } = useQuery({
    queryKey: ["strategies-form"],
    queryFn: fetchStrategies,
  });

  // Defensive: pick arrays whether the API returns a bare array or an
  // `{ items: [...] }` envelope. Falls back to /api/me lists too.
  const accounts: any[] = (Array.isArray(accountsData)
    ? accountsData
    : Array.isArray((accountsData as any)?.items)
      ? (accountsData as any).items
      : Array.isArray(meta?.accounts)
        ? meta.accounts
        : []) as any[];
  const strategies: any[] = (Array.isArray(strategiesData)
    ? strategiesData
    : Array.isArray((strategiesData as any)?.items)
      ? (strategiesData as any).items
      : Array.isArray(meta?.strategies)
        ? meta.strategies
        : []) as any[];
  const tags: any[] = Array.isArray(meta?.tags)
    ? meta.tags
    : Array.isArray((meta as any)?.tags?.items)
      ? (meta as any).tags.items
      : [];

  /* ---------- Existing trade (edit mode) ---------- */
  const { data: existing } = useQuery({
    queryKey: ["trade", editingId],
    queryFn: async () => {
      const res = await fetch(`/api/trades/${editingId}`, { cache: "no-store" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!editingId,
  });

  /* ---------- Form state ---------- */
  const today = new Date();
  const [form, setForm] = useState<any>({
    accountId: "",
    strategyId: "",
    instrumentSymbol: "",
    direction: "long",
    status: "open",
    tradeDate: today.toISOString().slice(0, 10),
    tradeTime: today.toTimeString().slice(0, 5),
    session: "ny_am",
    timeframe: "5m",
    newsEvent: "none",
    thesisWhy: "",
    checklistAnswers: {} as Record<string, ChecklistAnswerValue>,
    plannedEntryPrice: "",
    plannedStopPrice: "",
    plannedTargetPrice: "",
    lotSize: "1",
    riskPct: "0.005",
    // Exit price for P&L calculation. When the user follows the plan,
    // this is auto-set to the planned target. When they deviate, they
    // enter the actual exit price in the Plan Adherence section.
    actualExitPrice: "",
    // Plan adherence: did the trader follow the plan?
    followedPlan: true,
    actualEntryPrice: "",
    actualStopPrice: "",
    actualTargetPrice: "",
    actualLotSize: "",
    partialExits: [] as Array<{ id: string; name: string; price: string }>,
    behaviorFlags: [] as string[],
    tags: [] as string[],
    notes: "",
    lessons: "",
    psychBefore: { moodTags: [], confidence: 3, energy: 3, impact: "moderate" },
    psychAfter: { moodTags: [], confidence: 3, energy: 3, impact: "moderate" },
    setup: {
      htfContext: { weeklyBias: "bullish", dailyBias: "bullish" },
      liquidity: [],
      structure: [],
      entryModel: "FVG",
      session: "ny_am",
      timeframe: "5m",
    },
    thesis: {
      narrative: "",
      liquidityTarget: "",
      confirms: [],
      invalidates: [],
      target: "",
      earlyExit: "",
    },
    uploadedMedia: [] as any[],
    isDraft: false,
  });

  const [activeStep, setActiveStep] = useState<StepKey>("trade-info");
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Per-upload File + XHR refs, keyed by each placeholder's tempId. Keeping
  // these in a ref Map (not React state) means progress ticks don't trigger
  // re-renders of the File objects, and Cancel can abort the in-flight XHR
  // while Retry can re-send the stored File without the user re-selecting it.
  const fileRefs = useRef<
    Map<string, { file: File; xhr: XMLHttpRequest | null }>
  >(new Map());

  /* ---------- Strategy detail (versions + rulesJson) ---------- */
  const { data: strategyDetail } = useQuery({
    queryKey: ["strategy-for-form", form.strategyId],
    queryFn: async () => {
      if (!form.strategyId) return null;
      const res = await fetch(`/api/strategies/${form.strategyId}`, { cache: "no-store" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!form.strategyId,
  });

  const selectedStrategyVersion = useMemo(() => {
    const versions: any[] = strategyDetail?.versions ?? [];
    if (versions.length === 0) return null;
    if (form.strategyVersionId) {
      return (
        versions.find((v: any) => v.id === form.strategyVersionId) ?? versions[0]
      );
    }
    return versions[0];
  }, [strategyDetail, form.strategyVersionId]);

  const checklistItems: ChecklistItem[] = useMemo(
    () => extractChecklist(selectedStrategyVersion?.rulesJson),
    [selectedStrategyVersion?.rulesJson],
  );

  const checklistThresholds: GradingThresholds | null = useMemo(() => {
    if (!selectedStrategyVersion?.rulesJson) return DEFAULT_GRADING_THRESHOLDS;
    try {
      const parsed = JSON.parse(selectedStrategyVersion.rulesJson);
      if (parsed?.gradingThresholds && typeof parsed.gradingThresholds === "object") {
        return { ...DEFAULT_GRADING_THRESHOLDS, ...parsed.gradingThresholds };
      }
    } catch {
      // fall through
    }
    return DEFAULT_GRADING_THRESHOLDS;
  }, [selectedStrategyVersion?.rulesJson]);

  const evaluation = useMemo(
    () =>
      evaluateChecklist(
        checklistItems,
        (form.checklistAnswers ?? {}) as Record<string, ChecklistAnswerValue>,
        checklistThresholds,
      ),
    [checklistItems, form.checklistAnswers, checklistThresholds],
  );

  /* ---------- Instrument catalog lookup ---------- */
  // Resolve the selected symbol against the static instrument catalog so
  // the form can drive price-precision formatting, unit labels (pips /
  // points / ticks), and the per-instrument risk preview without an API
  // roundtrip. Falls back to a synthetic `custom` def for unknown symbols
  // so the form always has a usable InstrumentDef.
  const selectedInstrument: InstrumentDef = useMemo(
    () => resolveInstrument(form.instrumentSymbol),
    [form.instrumentSymbol],
  );
  const isKnownInstrument = !!findInstrument(form.instrumentSymbol);
  const pricePrecision = selectedInstrument.pricePrecision;
  const unitWord = unitLabel(selectedInstrument.market);

  /* ---------- Effects: defaults, edits, drafts ---------- */

  // Default account (first or marked-isDefault) once /api/me resolves.
  useEffect(() => {
    if (form.accountId) return;
    if (accounts.length === 0) return;
    const def = accounts.find((a: any) => a.isDefault) ?? accounts[0];
    if (def) setForm((f: any) => ({ ...f, accountId: def.id }));
  }, [accounts, form.accountId]);

  // Reset checklist answers + versionId when strategy changes (new trades).
  // When editing, skipStrategyResetRef prevents the load effect's restored
  // values from being clobbered on the very next strategy-change tick.
  const skipStrategyResetRef = useRef(false);
  useEffect(() => {
    if (skipStrategyResetRef.current) {
      skipStrategyResetRef.current = false;
      return;
    }
    setForm((f: any) => ({
      ...f,
      checklistAnswers: {},
      strategyVersionId: "",
    }));
  }, [form.strategyId]);

  // Default the strategy version to the latest (`versions[0]`) when the
  // detail loads and no version is currently selected.
  useEffect(() => {
    if (!strategyDetail) return;
    const versions: any[] = strategyDetail.versions ?? [];
    if (versions.length === 0) return;
    const matches = versions.some((v: any) => v.id === form.strategyVersionId);
    if (!matches) {
      setForm((f: any) => ({ ...f, strategyVersionId: versions[0].id }));
    }
  }, [strategyDetail, form.strategyVersionId]);

  // Load existing trade for editing.
  useEffect(() => {
    if (!existing) return;
    skipStrategyResetRef.current = true;

    const evals = Array.isArray(existing.checklistEvaluations)
      ? [...existing.checklistEvaluations].sort(
          (a: any, b: any) =>
            new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime(),
        )
      : [];
    const latestEval = evals[0];
    const restoredAnswers = latestEval?.rawAnswersJson
      ? parseAnswers(latestEval.rawAnswersJson)
      : {};

    const entryTime = existing.entryTime ? new Date(existing.entryTime) : null;
    const exitTime = existing.exitTime ? new Date(existing.exitTime) : null;

    const setup = safeJsonParse(existing.setupJson, {
      htfContext: { weeklyBias: "bullish", dailyBias: "bullish" },
      liquidity: [],
      structure: [],
      entryModel: "FVG",
      session: existing.session ?? "ny_am",
      timeframe: "5m",
    });
    const thesis = safeJsonParse(existing.thesisJson, {
      narrative: "",
      liquidityTarget: "",
      confirms: [],
      invalidates: [],
      target: "",
      earlyExit: "",
      why: existing.notes ?? "",
    });

    setForm((f: any) => ({
      ...f,
      accountId: existing.accountId,
      instrumentSymbol: existing.instrumentSymbol,
      direction: existing.direction,
      status: existing.isDraft ? "draft" : (existing.status ?? "open"),
      tradeDate: entryTime ? entryTime.toISOString().slice(0, 10) : f.tradeDate,
      tradeTime: entryTime ? entryTime.toTimeString().slice(0, 5) : f.tradeTime,
      session: existing.session ?? "ny_am",
      timeframe: setup?.timeframe ?? "5m",
      newsEvent: (existing as any).newsEvent ?? "none",
      thesisWhy: thesis?.why ?? "",
      strategyId: existing.strategyId ?? "",
      strategyVersionId: existing.strategyVersionId ?? "",
      checklistAnswers: restoredAnswers,
      plannedEntryPrice: existing.plannedEntryPrice ?? "",
      plannedStopPrice: existing.plannedStopPrice ?? "",
      plannedTargetPrice: existing.plannedTargetPrice ?? "",
      lotSize: existing.positionSize ?? "1",
      // Restore actual exit price from existing trade data.
      actualExitPrice: existing.exitPriceAvg ?? "",
      riskPct: existing.plannedRiskPct ?? "0.005",
      partialExits: (() => {
        // Prefer the TradeTarget rows returned by the server (Fix #3 —
        // persisted partial exits). Map them back into the form's
        // {id, name, price} shape.
        const targets = Array.isArray(existing.targets) ? existing.targets : [];
        if (targets.length > 0) {
          return targets.map((t: any, idx: number) => ({
            id: t.id || `tp_${idx}`,
            name: t.label || `TP${idx + 1}`,
            price: t.price ?? "",
          }));
        }
        // Fallback: legacy trades that stored partial exits inline.
        const inline = Array.isArray(existing.partialExits) ? existing.partialExits : [];
        return inline;
      })(),
      behaviorFlags: safeJsonParse(existing.behaviorFlagsJson, []),
      tags: safeJsonParse(existing.tagsJson, []),
      notes: existing.notes ?? "",
      lessons: existing.lessons ?? "",
      psychBefore: safeJsonParse(existing.psychBeforeJson, f.psychBefore),
      psychAfter: safeJsonParse(existing.psychAfterJson, f.psychAfter),
      // Load plan adherence from the stored JSON blob
      followedPlan: safeJsonParse(existing.planAdherenceJson, {}).followedPlan !== false,
      actualEntryPrice: safeJsonParse(existing.planAdherenceJson, {}).actualEntryPrice ?? "",
      actualStopPrice: safeJsonParse(existing.planAdherenceJson, {}).actualStopPrice ?? "",
      actualTargetPrice: safeJsonParse(existing.planAdherenceJson, {}).actualTargetPrice ?? "",
      actualLotSize: safeJsonParse(existing.planAdherenceJson, {}).actualLotSize ?? "",
      setup,
      thesis,
      uploadedMedia: [],
      isDraft: existing.isDraft ?? false,
    }));

    // Fetch signed URLs for existing media in parallel (Fix 3 — N+1 query).
    if (existing.media?.length > 0) {
      Promise.all(
        existing.media.map(async (m: any) => {
          try {
            const res = await fetch(`/api/media/${m.id}`);
            if (res.ok) {
              const detail = await res.json();
              // Deserialize the MediaAnnotation rows back into the
              // ImageAnnotation shape the ImageAnnotator expects
              // ({ id, kind, x1, y1, x2, y2, text?, color }). The API stores
              // each row as { id, mediaId, kind, payloadJson }. The payload
              // is the geometry + style JSON written by either this form or
              // the trade-detail ImageViewer.
              const annotations: ImageAnnotation[] = (detail.annotations ?? [])
                .map((row: any): ImageAnnotation | null => {
                  let p: any = {};
                  try { p = row.payloadJson ? JSON.parse(row.payloadJson) : {}; } catch {}
                  if (!row.kind || typeof p.x1 !== "number") return null;
                  return {
                    id: row.id,
                    kind: row.kind,
                    x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2,
                    text: typeof p.text === "string" ? p.text : undefined,
                    color: typeof p.color === "string" ? p.color : "#EF4444",
                  };
                })
                .filter((a: ImageAnnotation | null): a is ImageAnnotation => a !== null);
              return {
                ...m,
                url: detail.url,
                caption: detail.caption ?? m.caption ?? "",
                timeframe: detail.timeframe ?? m.timeframe ?? "",
                annotations,
              };
            }
          } catch {
            // ignore
          }
          return m;
        }),
      ).then((mediaWithUrls) => {
        setForm((f: any) => ({ ...f, uploadedMedia: mediaWithUrls }));
      });
    }
  }, [existing]);

  // Deep-link pre-fills: ?date=YYYY-MM-DD (from calendar), ?dailyPlanId=...
  useEffect(() => {
    if (editingId) return;
    if (!params.date && !params.dailyPlanId) return;
    setForm((f: any) => {
      const next = { ...f };
      if (params.date) {
        next.tradeDate = params.date;
        if (!next.tradeTime) next.tradeTime = "09:00";
      }
      return next;
    });
  }, [params.date, params.dailyPlanId, editingId]);

  // Autosave draft (new trades only).
  useEffect(() => {
    if (editingId) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {
        // ignore quota errors
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form, editingId]);

  // Restore draft on mount (new trades only).
  useEffect(() => {
    if (editingId) return;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      // Any media that was mid-upload when the page closed can't be resumed
      // (the XHR is gone and File objects aren't serializable) — mark them
      // as failed so the user can retry or remove them, rather than leaving
      // them stuck at 0% forever.
      if (Array.isArray(parsed.uploadedMedia)) {
        parsed.uploadedMedia = parsed.uploadedMedia.map((m: any) =>
          m?.status === "uploading" ? { ...m, status: "failed" } : m,
        );
      }
      setForm((f: any) => ({ ...f, ...parsed }));
      toast.info("Restored autosaved draft.");
    } catch {
      // ignore
    }
  }, [editingId]);

  // Warn before navigating away while media uploads are in-flight. The
  // uploads use XHR (not service workers / background sync), so closing or
  // refreshing the tab would abort them and the placeholder items would
  // never complete.
  useEffect(() => {
    const hasUploading = form.uploadedMedia?.some(
      (m: any) => m.status === "uploading",
    );
    if (!hasUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.uploadedMedia]);

  /* ---------- Field helpers ---------- */

  function setField(path: string, value: any) {
    setForm((f: any) => {
      const next = { ...f };
      const parts = path.split(".");
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...cur[parts[i]] };
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }

  function toggleArrayField(path: string, value: string) {
    setForm((f: any) => {
      const next = { ...f };
      const parts = path.split(".");
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...cur[parts[i]] };
        cur = cur[parts[i]];
      }
      const key = parts[parts.length - 1];
      const arr = Array.isArray(cur[key]) ? [...cur[key]] : [];
      const idx = arr.indexOf(value);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(value);
      cur[key] = arr;
      return next;
    });
  }

  function updateChecklistAnswer(itemId: string, checked: boolean) {
    setForm((f: any) => {
      const cur = f.checklistAnswers?.[itemId] ?? { checked: false };
      const nextAnswers = {
        ...f.checklistAnswers,
        [itemId]: { ...cur, checked },
      };
      // Drop note when unchecked so storage stays clean.
      if (!checked && nextAnswers[itemId].note) {
        delete nextAnswers[itemId].note;
      }
      return { ...f, checklistAnswers: nextAnswers };
    });
  }

  /* ---------- File upload (non-blocking, concurrent, with progress) ----------
   *
   * Each selected file is added to `form.uploadedMedia` immediately as a
   * placeholder with `status: "uploading"` and a per-item `progress` (0-100).
   * Uploads run concurrently via XMLHttpRequest so progress events fire per
   * file without blocking the form (the old implementation awaited each
   * upload in a sequential for-loop). The File + XHR for each tempId live in
   * the `fileRefs` ref Map (not state), so Cancel can abort and Retry can
   * re-send without storing heavy File objects in React state.
   */

  function handleFileUpload(files: FileList | File[]) {
    const fileList = Array.from(files);
    for (const file of fileList) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      // Detect kind from MIME type so the form immediately knows whether to
      // render an <img> (annotation-able) or a <video controls> element.
      const clientKind = file.type.startsWith("video/") ? "video" : "image";
      const mediaItem: any = {
        tempId,
        filename: file.name,
        originalName: file.name,
        kind: clientKind,
        status: "uploading",
        progress: 0,
        fileSize: file.size,
        annotations: [],
        caption: "",
        timeframe: "",
      };
      // Add the placeholder immediately so the user sees progress right
      // away, then kick off the upload in the background (non-blocking).
      setForm((f: any) => ({
        ...f,
        uploadedMedia: [...(f.uploadedMedia ?? []), mediaItem],
      }));
      uploadFile(file, tempId);
    }
  }

  function uploadFile(file: File, tempId: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (editingId) formData.append("tradeId", editingId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    fileRefs.current.set(tempId, { file, xhr });

    // Real upload progress — only XMLHttpRequest exposes this; fetch()
    // ReadableStream request bodies don't have progress events yet.
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        setForm((f: any) => ({
          ...f,
          uploadedMedia: f.uploadedMedia.map((m: any) =>
            m.tempId === tempId ? { ...m, progress } : m,
          ),
        }));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          // Fetch the signed URL so the preview can render immediately.
          fetch(`/api/media/${data.id}`)
            .then((r) => r.json())
            .then((detail) => {
              setForm((f: any) => ({
                ...f,
                uploadedMedia: f.uploadedMedia.map((m: any) =>
                  m.tempId === tempId
                    ? {
                        ...m,
                        ...data,
                        id: data.id,
                        url: detail.url,
                        status: "uploaded",
                        progress: 100,
                      }
                    : m,
                ),
              }));
            })
            .catch(() => {
              // Signed-URL fetch failed — still mark uploaded with raw data.
              setForm((f: any) => ({
                ...f,
                uploadedMedia: f.uploadedMedia.map((m: any) =>
                  m.tempId === tempId
                    ? {
                        ...m,
                        ...data,
                        id: data.id,
                        status: "uploaded",
                        progress: 100,
                      }
                    : m,
                ),
              }));
            });
          // Upload finished — drop the File/XHR ref (Retry not needed).
          fileRefs.current.delete(tempId);
          toast.success(`${file.name} uploaded.`);
        } catch {
          markUploadFailed(tempId, file.name);
        }
      } else {
        // Surface the server's error message when present (e.g. "File too
        // large. Max 20 MB.").
        let msg = `Failed to upload ${file.name}`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err?.error) msg = err.error;
        } catch {}
        markUploadFailed(tempId, file.name, msg);
      }
    };

    xhr.onerror = () => markUploadFailed(tempId, file.name);
    // onabort is fired when cancelUpload calls xhr.abort(); cancelUpload
    // already removes the item from state and clears the ref, so this is
    // a no-op kept for completeness.
    xhr.onabort = () => {};

    xhr.send(formData);
  }

  function markUploadFailed(tempId: string, filename: string, msg?: string) {
    setForm((f: any) => ({
      ...f,
      uploadedMedia: f.uploadedMedia.map((m: any) =>
        m.tempId === tempId ? { ...m, status: "failed" } : m,
      ),
    }));
    // Keep the File in the ref (clear the xhr) so Retry can re-send it.
    const entry = fileRefs.current.get(tempId);
    if (entry) fileRefs.current.set(tempId, { file: entry.file, xhr: null });
    toast.error(msg ?? `Failed to upload ${filename}`);
  }

  function cancelUpload(tempId: string) {
    const entry = fileRefs.current.get(tempId);
    if (entry?.xhr) {
      try { entry.xhr.abort(); } catch {}
    }
    fileRefs.current.delete(tempId);
    setForm((f: any) => ({
      ...f,
      uploadedMedia: f.uploadedMedia.filter((m: any) => m.tempId !== tempId),
    }));
  }

  function retryUpload(tempId: string) {
    const entry = fileRefs.current.get(tempId);
    if (!entry?.file) {
      toast.error("This file is no longer available to retry. Please re-select it.");
      return;
    }
    setForm((f: any) => ({
      ...f,
      uploadedMedia: f.uploadedMedia.map((m: any) =>
        m.tempId === tempId ? { ...m, status: "uploading", progress: 0 } : m,
      ),
    }));
    uploadFile(entry.file, tempId);
  }

  function removeMedia(idx: number) {
    setForm((f: any) => ({
      ...f,
      uploadedMedia: f.uploadedMedia.filter((_: any, i: number) => i !== idx),
    }));
  }

  function setMediaCaption(idx: number, caption: string) {
    setForm((f: any) => ({
      ...f,
      uploadedMedia: f.uploadedMedia.map((m: any, i: number) =>
        i === idx ? { ...m, caption } : m,
      ),
    }));
  }

  function setMediaTimeframe(idx: number, timeframe: string) {
    setForm((f: any) => ({
      ...f,
      uploadedMedia: f.uploadedMedia.map((m: any, i: number) =>
        i === idx ? { ...m, timeframe } : m,
      ),
    }));
  }

  function setMediaAnnotations(idx: number, annotations: ImageAnnotation[]) {
    setForm((f: any) => ({
      ...f,
      uploadedMedia: f.uploadedMedia.map((m: any, i: number) =>
        i === idx ? { ...m, annotations } : m,
      ),
    }));
  }

  /* ---------- Partial exits ---------- */

  function addExit() {
    setForm((f: any) => ({
      ...f,
      partialExits: [
        ...f.partialExits,
        { id: uid(), name: `TP${f.partialExits.length + 1}`, price: "" },
      ],
    }));
  }

  function updateExit(id: string, field: "name" | "price", value: string) {
    setForm((f: any) => ({
      ...f,
      partialExits: f.partialExits.map((e: any) =>
        e.id === id ? { ...e, [field]: value } : e,
      ),
    }));
  }

  function removeExit(id: string) {
    setForm((f: any) => ({
      ...f,
      partialExits: f.partialExits.filter((e: any) => e.id !== id),
    }));
  }

  /* ---------- Risk & sizing calculations ---------- */

  const account = accounts.find((a: any) => a.id === form.accountId);
  const accountCurrency = account?.currency ?? "USD";
  const balanceCents = account?.currentBalanceCents ?? account?.startingBalanceCents ?? 0;

  const effEntry = form.followedPlan ? form.plannedEntryPrice : (form.actualEntryPrice || form.plannedEntryPrice);
  const effStop = form.followedPlan ? form.plannedStopPrice : (form.actualStopPrice || form.plannedStopPrice);
  const effTarget = form.followedPlan ? form.plannedTargetPrice : (form.actualExitPrice || form.actualTargetPrice || form.plannedTargetPrice);
  const effLot = form.followedPlan ? form.lotSize : (form.actualLotSize || form.lotSize);

  const entryNum = Number(effEntry);
  const stopNum = Number(effStop);
  const targetNum = Number(effTarget);
  const lotNum = Number(effLot) || 1;
  const riskPctNum = Number(form.riskPct);

  const hasEntry = Number.isFinite(entryNum) && effEntry !== "";
  const hasStop = Number.isFinite(stopNum) && effStop !== "";
  const hasTarget = Number.isFinite(targetNum) && effTarget !== "";

  // Stop distance (always positive).
  const stopDistance = hasEntry && hasStop ? Math.abs(entryNum - stopNum) : null;

  // Risk per unit / reward per unit (per 1 lot).
  const riskPerUnit = hasEntry && hasStop ? Math.abs(entryNum - stopNum) : null;
  const rewardPerUnit =
    hasEntry && hasTarget ? Math.abs(targetNum - entryNum) : null;

  // Planned R:R = reward / risk (1.0 = breakeven, 2.0 = 2R for 1R).
  const plannedRR =
    riskPerUnit && rewardPerUnit && riskPerUnit > 0
      ? rewardPerUnit / riskPerUnit
      : null;

  // Risk amount ($) = balance * riskPct.
  const riskAmountDollars =
    Number.isFinite(riskPctNum) && balanceCents > 0
      ? (balanceCents / 100) * riskPctNum
      : null;

  // Planned profit ($) = riskAmount * RR (if RR is known).
  const plannedProfitDollars =
    riskAmountDollars != null && plannedRR != null
      ? riskAmountDollars * plannedRR
      : null;

  /* ---------- Instrument-aware risk preview (spec §1, §9) ---------- */
  // AUTHORITATIVE formula (matches FinancialEngine):
  //   riskCents = stopDistance × quantity(lots) × pointValueCents
  //   riskDollars = riskCents / 100
  //
  // CRITICAL: pointValueCents is ALREADY the full per-lot economic multiplier
  // (e.g., XAUUSD: $100/lot = 10000 cents). Do NOT multiply by contractSize
  // again — that would double-count (the 100x bug).
  //
  // This is a "temporary presentation value" per spec §1 — the server
  // recomputes authoritatively on save.
  const stopDistanceUnits = stopDistance != null
    ? distanceInUnits(stopDistance, selectedInstrument.pipSize)
    : 0;
  const pointValueCents = selectedInstrument.pointValueCents;
  const instrumentRiskCents =
    stopDistance != null
      ? Math.round(stopDistance * lotNum * pointValueCents)
      : 0;
  const instrumentRiskDollars = instrumentRiskCents / 100;
  // Planned profit = stopDistance × qty × pointValueCents × plannedRR
  const plannedProfitCents =
    instrumentRiskCents > 0 && plannedRR != null
      ? Math.round(instrumentRiskCents * plannedRR)
      : 0;
  const plannedProfitDollarsPreview = plannedProfitCents / 100;
  // Risk utilization = instrumentRisk / riskBudget
  const riskUtilizationPct =
    riskAmountDollars != null && instrumentRiskDollars > 0
      ? instrumentRiskDollars / riskAmountDollars
      : null;

  /* ---------- Partial exits calculations ---------- */

  const validExits = form.partialExits.filter(
    (e: any) => e.price !== "" && Number.isFinite(Number(e.price)),
  );
  const weightedExitPrice =
    validExits.length > 0
      ? validExits.reduce((sum: number, e: any) => sum + Number(e.price), 0) /
        validExits.length
      : null;
  const totalRExits =
    weightedExitPrice != null && riskPerUnit != null && riskPerUnit > 0
      ? form.direction === "long"
        ? (weightedExitPrice - entryNum) / riskPerUnit
        : (entryNum - weightedExitPrice) / riskPerUnit
      : null;

  /* ---------- Evidence grouping (by chart timeframe) ---------- */

  // Bucket each uploaded media item into a timeframe group so the user can
  // see at a glance whether their HTF context, execution chart, and entry
  // trigger are all captured. Items with no timeframe selected land in an
  // "Unassigned" bucket first to nudge the user toward picking one.
  const groupedMedia = useMemo(() => {
    const items: Array<{ m: any; i: number }> = (form.uploadedMedia ?? []).map(
      (m: any, i: number) => ({ m, i }),
    );
    const buckets: Record<string, Array<{ m: any; i: number }>> = {};
    for (const entry of items) {
      const g = entry.m.timeframe ? getTimeframeGroup(entry.m.timeframe) : null;
      const key = g ?? "__unassigned";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(entry);
    }
    const ordered: Array<{ group: string; items: Array<{ m: any; i: number }> }> = [];
    if (buckets["__unassigned"]) {
      ordered.push({ group: "Unassigned", items: buckets["__unassigned"] });
    }
    for (const g of TIMEFRAME_GROUPS) {
      if (buckets[g]) ordered.push({ group: g, items: buckets[g] });
    }
    // Any leftover custom groups (shouldn't normally happen, but defensive).
    for (const key of Object.keys(buckets)) {
      if (key === "__unassigned") continue;
      if (TIMEFRAME_GROUPS.includes(key)) continue;
      ordered.push({ group: key, items: buckets[key] });
    }
    return ordered;
  }, [form.uploadedMedia]);


  /* ---------- Plan Adherence Preview ---------- */
  const planAdherencePreview = useMemo(() => {
    const actEntry = form.followedPlan ? form.plannedEntryPrice : (form.actualEntryPrice || form.plannedEntryPrice);
    const actExit = form.followedPlan ? form.plannedTargetPrice : form.actualExitPrice;
    const actQty = form.followedPlan ? form.lotSize : (form.actualLotSize || form.lotSize);
    
    // Naive actualR calculation for preview
    let actualR: any = null;
    if (actEntry && actExit && form.plannedEntryPrice && form.plannedStopPrice) {
       const riskDist = Math.abs(Number(form.plannedEntryPrice) - Number(form.plannedStopPrice));
       if (riskDist > 0) {
         const pnlDist = form.direction === "long" 
           ? Number(actExit) - Number(actEntry) 
           : Number(actEntry) - Number(actExit);
         actualR = pnlDist / riskDist;
       }
    }
    
    return calculatePlanAdherence({
      session: form.session,
      plannedSession: form.setup.session,
      plannedEntryPrice: form.plannedEntryPrice,
      plannedStopPrice: form.plannedStopPrice,
      plannedTargetPrice: form.plannedTargetPrice,
      plannedRiskPct: form.riskPct,
      entryPriceAvg: actEntry,
      exitPriceAvg: actExit,
      actualR,
      riskAmountCents: riskAmountDollars != null ? riskAmountDollars * 100 : null,
      accountBalanceCents: balanceCents,
    });
  }, [form, riskAmountDollars, balanceCents]);

  /* ---------- Submit ---------- */

  async function submit(asDraft: boolean = false) {
    if (!form.accountId) {
      toast.error("Please select an account.");
      setActiveStep("trade-info");
      setTimeout(
        () => document.getElementById("field-account")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80,
      );
      return;
    }
    if (!form.instrumentSymbol) {
      toast.error("Please enter a symbol / pair.");
      setActiveStep("trade-info");
      setTimeout(
        () => document.getElementById("field-symbol")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80,
      );
      return;
    }
    if (!hasEntry || !hasStop || !hasTarget) {
      // For planned trades, entry/stop/target are still required (they ARE the plan)
      // but executions should not be sent — the trade is not executed yet.
      toast.error("Planned entry, stop, and target are required.");
      setActiveStep("risk");
      setTimeout(
        () => document.getElementById("field-entry")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80,
      );
      return;
    }

    // For closed trades, an exit price is required to calculate P&L.
    // When following the plan, the exit price is the planned target.
    // When deviating, the user must enter an actual exit price.
    if (form.status === "closed" && !asDraft) {
      const exitPrice = form.followedPlan
        ? form.plannedTargetPrice
        : form.actualExitPrice;
      if (!exitPrice) {
        toast.error(
          form.followedPlan
            ? "Planned target price is required for closed trades (used as exit price when following plan)."
            : "Actual exit price is required for closed trades to calculate P&L.",
        );
        setActiveStep("risk");
        return;
      }
    }

    const isPlanned = form.status === "planned" && !asDraft;

    setSaving(true);
    try {
      const entryDateTime = new Date(`${form.tradeDate}T${form.tradeTime || "09:00"}`);

      // Determine the actual entry price and quantity to use for the entry fill:
      // - Followed plan: use planned entry + planned lot size
      // - Deviated: use actual entry (if provided) + actual lot size (if provided),
      //   falling back to planned values
      const entryPrice = form.followedPlan
        ? form.plannedEntryPrice
        : (form.actualEntryPrice || form.plannedEntryPrice);
      const entryQty = form.followedPlan
        ? (form.lotSize || "1")
        : (form.actualLotSize || form.lotSize || "1");

      const executions: any[] = [
        {
          kind: "entry",
          price: String(entryPrice),
          quantity: String(entryQty),
          timestamp: entryDateTime.toISOString(),
        },
      ];

      // Build the exit execution when the trade is closed (not planned/draft).
      // - Followed plan: exit price = planned target
      // - Deviated: exit price = actual exit price (validated above)
      let exitDateTime: Date | null = null;
      if (form.status === "closed" && !isPlanned && !asDraft) {
        const exitPrice = form.followedPlan
          ? form.plannedTargetPrice
          : form.actualExitPrice;
        if (exitPrice) {
          exitDateTime = new Date(`${form.tradeDate}T${form.tradeTime || "16:00"}`);
          executions.push({
            kind: "exit",
            price: String(exitPrice),
            quantity: String(entryQty), // full close
            timestamp: exitDateTime.toISOString(),
          });
        }
      }

      const payload: any = {
        accountId: form.accountId,
        instrumentSymbol: normalizeSymbol(form.instrumentSymbol),
        // Derive market from the static catalog when possible (covers
        // forex / gold / indices / futures / crypto). Falls back to
        // "custom" so unknown symbols still get persisted with a sane
        // market tag rather than a null.
        market: selectedInstrument.market ?? "custom",
        direction: form.direction,
        status: asDraft ? "open" : form.status,
        session: form.session,
        newsEvent: form.newsEvent ?? "none",
        strategyId: form.strategyId || null,
        strategyVersionId: form.strategyId ? (form.strategyVersionId || null) : null,
        // checklistVersionId must reference a ChecklistVersion (from
        // ChecklistConfig), NOT a StrategyVersion. The strategy's rules
        // live in StrategyVersion.rulesJson and are evaluated inline —
        // there is no separate ChecklistVersion for strategy-based rules.
        // Send null so the server doesn't try to validate a wrong FK.
        checklistVersionId: null,
        checklistAnswers:
          form.strategyId && form.strategyVersionId ? form.checklistAnswers : null,
        setupGrade:
          form.strategyId && checklistItems.length > 0 ? evaluation.grade : null,
        setupScore:
          form.strategyId && checklistItems.length > 0 ? String(evaluation.score) : null,
        tags: form.tags,
        plannedEntryPrice: form.plannedEntryPrice || null,
        plannedStopPrice: form.plannedStopPrice || null,
        plannedTargetPrice: form.plannedTargetPrice || null,
        plannedRiskPct: form.riskPct || null,
        // For planned trades, don't send executions — the trade is not executed yet.
        // The server will keep P&L as 0 and status as "planned".
        executions: isPlanned ? [] : executions,
        feesCents: 0,
        commissionCents: 0,
        swapCents: 0,
        slippageCents: 0,
        entryTime: isPlanned ? null : entryDateTime.toISOString(),
        // Exit time set when exit execution exists.
        exitTime: exitDateTime ? exitDateTime.toISOString() : null,
        tradingTimezone: "UTC",
        setup: {
          ...form.setup,
          session: form.session,
          timeframe: form.timeframe,
        },
        thesis: {
          ...form.thesis,
          why: form.thesisWhy,
        },
        notes: form.notes || null,
        lessons: form.lessons || null,
        psychBefore: form.psychBefore,
        psychAfter: form.psychAfter,
        behaviorFlags: form.behaviorFlags,
        partialExits: form.partialExits,
        planAdherence: {
          followedPlan: form.followedPlan,
          ...(form.followedPlan ? {} : {
            actualEntryPrice: form.actualEntryPrice || null,
            actualStopPrice: form.actualStopPrice || null,
            actualExitPrice: form.actualExitPrice || null,
            actualTargetPrice: form.actualTargetPrice || null,
            actualLotSize: form.actualLotSize || null,
          }),
        },
        isDraft: asDraft,
      };

      const url = editingId ? `/api/trades/${editingId}` : "/api/trades";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to save trade.");
        setSaving(false);
        return;
      }

      // Attach orphaned uploaded media to the newly created trade + save captions.
      // BUG-EVID-2 fix: wait for any in-flight uploads to finish before attaching,
      // so media uploaded during trade creation actually gets its tradeId set.
      // Previously, the form navigated away while uploads were still in-flight,
      // leaving the media orphaned (tradeId=null) forever.
      if (form.uploadedMedia?.length > 0) {
        // Wait up to 30 seconds for any still-uploading media to complete.
        const waitForUploads = async () => {
          const deadline = Date.now() + 30_000;
          while (Date.now() < deadline) {
            const stillUploading = form.uploadedMedia.some(
              (m: any) => m.status === "uploading",
            );
            if (!stillUploading) break;
            await new Promise((r) => setTimeout(r, 500));
          }
        };
        await waitForUploads();

        // Re-read the latest media state (form.uploadedMedia is React state;
        // we need to use the closure value but check for completion via the
        // XHR refs). For any media that now has an id, attach it to the trade.
        for (const m of form.uploadedMedia) {
          if (m.id && m.status !== "uploading" && m.status !== "failed") {
            const patchBody: any = {};
            if (!editingId) patchBody.tradeId = data.id;
            // Caption is the form's "Description" textarea value (see Evidence section).
            if (m.caption !== undefined && m.caption !== null) patchBody.caption = m.caption;
            // Per-screenshot timeframe (5m / 1H / 1D / ...) for chart screenshots.
            if (m.timeframe) patchBody.timeframe = m.timeframe;
            if (Object.keys(patchBody).length > 0) {
              await fetch(`/api/media/${m.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patchBody),
              }).catch(() => {});
            }

            // Persist non-destructive SVG annotations (lines, arrows, rects,
            // circles, text) to the MediaAnnotation table via the PUT
            // "setAnnotations" action. Without this, drawings made in the
            // ImageAnnotator were lost on save because they only lived in
            // client state (`m.annotations`). The API stores each annotation
            // as `{ kind, payloadJson }`; we follow the same payload shape
            // used by the ImageViewer (x1/y1/x2/y2/text/color) so the two
            // viewers can read each other's drawings.
            if (Array.isArray(m.annotations) && m.annotations.length > 0) {
              await fetch(`/api/media/${m.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "setAnnotations",
                  annotations: m.annotations.map((a: ImageAnnotation) => ({
                    kind: a.kind,
                    payload: {
                      x1: a.x1,
                      y1: a.y1,
                      x2: a.x2,
                      y2: a.y2,
                      text: a.text,
                      color: a.color,
                    },
                  })),
                }),
              }).catch(() => {});
            }
          }
        }
      }

      // If some uploads are STILL in-flight after the 30s wait (very large
      // files or slow connection), flag them honestly. For new trades these
      // will be orphaned; for edits the formData already carries tradeId.
      const stillUploading = form.uploadedMedia?.some(
        (m: any) => m.status === "uploading",
      );
      if (stillUploading) {
        toast.info("Some media is still uploading and will be attached when complete.");
      }

      toast.success(asDraft ? "Draft saved." : "Trade saved.");
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("tradesLog");
    } catch (err: any) {
      toast.error(err?.message ?? "Network error — please check your connection and try again.");
      setSaving(false);
    }
  }

  /* ---------- Step navigation ---------- */

  function goPrev() {
    const idx = STEP_ORDER.indexOf(activeStep);
    if (idx > 0) setActiveStep(STEP_ORDER[idx - 1]);
  }
  function goNext() {
    const idx = STEP_ORDER.indexOf(activeStep);
    if (idx < STEP_ORDER.length - 1) setActiveStep(STEP_ORDER[idx + 1]);
  }

  const checkedCount = checklistItems.filter(
    (it) => form.checklistAnswers?.[it.id]?.checked === true,
  ).length;
  const adherencePct =
    checklistItems.length > 0
      ? Math.round((checkedCount / checklistItems.length) * 100)
      : 0;

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("tradesLog")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {editingId ? "Edit Trade" : "New Trade"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Walk through the 5 steps to log a structured trade with checklist
            scoring, risk sizing, and partial exits.
          </p>
        </div>
      </div>

      <Tabs value={activeStep} onValueChange={(v) => setActiveStep(v as StepKey)} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar h-auto">
          <TabsTrigger value="trade-info">1. Trade Info</TabsTrigger>
          <TabsTrigger value="checklist">2. Setup Checklist</TabsTrigger>
          <TabsTrigger value="risk">3. Risk &amp; Sizing</TabsTrigger>
          <TabsTrigger value="exits">4. Partial Exits</TabsTrigger>
          <TabsTrigger value="review">5. Review &amp; Save</TabsTrigger>
        </TabsList>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* STEP 1 — Trade Info                                          */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="trade-info" className="space-y-4 mt-3">
          <Card className="p-4 md:p-6 space-y-4 bg-background">
            <div>
              <h2 className="text-lg font-medium">Trade Basics</h2>
              <p className="text-sm text-muted-foreground">
                The who/what/when of the trade. Required fields are marked{" "}
                <span className="text-loss">*</span>.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2" id="field-account">
                <FieldLabel required>Trading Account</FieldLabel>
                <Select value={form.accountId || "__none"} onValueChange={(v) => setField("accountId", v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {accounts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel hint="The strategy this trade follows (optional).">Trading Setup</FieldLabel>
                <Select
                  value={form.strategyId || "__none"}
                  onValueChange={(v) => setField("strategyId", v === "__none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="No strategy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {strategies.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2" id="field-symbol">
                <FieldLabel
                  required
                  hint="Search by symbol (EURUSD) or name (Euro / US Dollar). Symbols not in the catalog can be used as custom instruments."
                >
                  Symbol / Pair
                </FieldLabel>
                <InstrumentSelector
                  value={form.instrumentSymbol}
                  onChange={(sym) => setField("instrumentSymbol", sym)}
                  placeholder="Select instrument…"
                />
                {/* Instrument metadata preview — helps the user confirm the
                    catalog hit and shows the spec that will drive price
                    precision / unit labels / risk calc downstream. */}
                {form.instrumentSymbol && (
                  <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase px-1.5 py-0"
                    >
                      {selectedInstrument.market}
                    </Badge>
                    {isKnownInstrument ? (
                      <>
                        <span className="truncate">
                          {selectedInstrument.displayName}
                        </span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="tnum">
                          {selectedInstrument.contractSize} units/lot
                        </span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="tnum">
                          {selectedInstrument.pipSize} pip
                        </span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="tnum">{pricePrecision} dp</span>
                      </>
                    ) : (
                      <span className="italic">
                        Custom instrument — defaults applied (0.01 pip, 1 unit,
                        2 dp).
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <FieldLabel required>Direction</FieldLabel>
                <RadioGroup
                  className="grid grid-cols-2 gap-2"
                  value={form.direction}
                  onValueChange={(v) => setField("direction", v)}
                >
                  <label className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors",
                    form.direction === "long"
                      ? "border-profit bg-profit/10"
                      : "border-border hover:bg-muted/50",
                  )}>
                    <RadioGroupItem value="long" id="dir-long" />
                    <span className="text-sm font-medium">Long</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors",
                    form.direction === "short"
                      ? "border-loss bg-loss/10"
                      : "border-border hover:bg-muted/50",
                  )}>
                    <RadioGroupItem value="short" id="dir-short" />
                    <span className="text-sm font-medium">Short</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <FieldLabel required hint="Draft, open, closed, or planned.">Trade Status</FieldLabel>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel hint="Trading session (asian_range, london_open, ny_am, ny_lunch, ny_pm, off_hours).">Session</FieldLabel>
                <Select value={form.session} onValueChange={(v) => setField("session", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SESSIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel hint="Chart timeframe used for the entry.">Timeframe</FieldLabel>
                <Select value={form.timeframe} onValueChange={(v) => setField("timeframe", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEFRAMES.map((tf) => (
                      <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel hint="Specific news event the trade was taken around (none for no news / non-news setups).">News Event</FieldLabel>
                <Select value={form.newsEvent ?? "none"} onValueChange={(v) => setField("newsEvent", v)}>
                  <SelectTrigger><SelectValue placeholder="Select a news event" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {NEWS_EVENTS.map((n) => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel required>Date</FieldLabel>
                <Input
                  type="date"
                  value={form.tradeDate}
                  onChange={(e) => setField("tradeDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel required>Time</FieldLabel>
                <Input
                  type="time"
                  value={form.tradeTime}
                  onChange={(e) => setField("tradeTime", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel hint="Why are you taking this trade? What's the core thesis?">Trade Thesis</FieldLabel>
              <Textarea
                value={form.thesisWhy}
                onChange={(e) => setField("thesisWhy", e.target.value)}
                rows={4}
                placeholder="Bias, structure, liquidity target, entry trigger…"
              />
            </div>
          </Card>

          {/* Trade Evidence — supports file upload, drag-drop, AND paste (Ctrl+V) */}
          <Card
            className="p-4 md:p-6 space-y-4 bg-background"
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              const files: File[] = [];
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === "file") {
                  const file = item.getAsFile();
                  if (file) files.push(file);
                }
              }
              if (files.length > 0) {
                e.preventDefault();
                handleFileUpload(files);
              }
            }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-medium">Trade Evidence</h2>
                <p className="text-sm text-muted-foreground">
                  Upload screenshots, annotated charts, or video clips. You can also paste (Ctrl+V) directly into this card.
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_MEDIA}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFileUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload
                </Button>
              </div>
            </div>

            {form.uploadedMedia.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click Upload, drag &amp; drop, or paste (Ctrl+V) to add screenshots or video clips.
                </p>
              </div>
            )}

            {form.uploadedMedia.length > 0 && (
              <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
                <p className="text-xs text-muted-foreground">
                  Group each screenshot by the chart timeframe it captures. A
                  complete trade record usually has at least one Higher
                  Timeframe chart, one Execution Timeframe chart, and the Entry
                  / Trigger chart.
                </p>
                {groupedMedia.map(({ group, items }) => (
                  <div key={group} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-background/95 backdrop-blur px-1 py-1 border-b border-border">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group}
                      </h3>
                      <span className="text-[10px] text-muted-foreground tnum">
                        {items.length} {items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                    {items.map(({ m, i }) => {
                      const status: "uploading" | "uploaded" | "failed" =
                        m.status ?? "uploaded";

                      // ── Uploading: spinner + per-file progress bar + Cancel ──
                      if (status === "uploading") {
                        const pct = typeof m.progress === "number" ? m.progress : 0;
                        return (
                          <div
                            key={m.tempId ?? m.id ?? i}
                            className="rounded-lg border border-border overflow-hidden bg-background"
                          >
                            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
                              <div className="min-w-0 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-medium truncate">
                                    {m.originalName ?? m.filename ?? `Media ${i + 1}`}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground tnum">
                                    Uploading {pct}%
                                    {m.fileSize ? ` · ${(m.fileSize / 1024).toFixed(0)} KB` : ""}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-loss flex-shrink-0"
                                onClick={() => cancelUpload(m.tempId)}
                                aria-label="Cancel upload"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="p-3">
                              <div
                                className="h-1.5 bg-muted rounded-full overflow-hidden w-full"
                                role="progressbar"
                                aria-valuenow={pct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`Uploading ${m.originalName ?? m.filename ?? `Media ${i + 1}`}`}
                              >
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="h-full bg-primary transition-all duration-150"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // ── Failed: alert icon + Retry + Remove ──
                      if (status === "failed") {
                        return (
                          <div
                            key={m.tempId ?? m.id ?? i}
                            className="rounded-lg border border-loss/40 overflow-hidden bg-background"
                          >
                            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-loss/30 bg-loss/5">
                              <div className="min-w-0 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-loss flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-medium truncate">
                                    {m.originalName ?? m.filename ?? `Media ${i + 1}`}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Upload failed
                                    {m.fileSize ? ` · ${(m.fileSize / 1024).toFixed(0)} KB` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => retryUpload(m.tempId)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-loss"
                                  onClick={() => cancelUpload(m.tempId)}
                                  aria-label="Remove failed upload"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // ── Uploaded: full preview + timeframe + caption + delete ──
                      return (
                        <div key={m.tempId ?? m.id ?? i} className="rounded-lg border border-border overflow-hidden bg-background">
                          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{m.originalName ?? m.filename ?? `Media ${i + 1}`}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {(m.kind ?? "image").toUpperCase()}
                                {m.sizeBytes ? ` · ${(m.sizeBytes / 1024).toFixed(0)} KB` : ""}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-loss"
                              onClick={() => removeMedia(i)}
                              aria-label="Delete evidence"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {m.kind === "video" ? (
                            <video
                              src={m.url}
                              controls
                              className="w-full max-h-80 bg-black"
                            />
                          ) : (
                            <ImageAnnotator
                              src={m.url}
                              alt={m.originalName ?? `Evidence ${i + 1}`}
                              annotations={m.annotations ?? []}
                              onChange={(next) => setMediaAnnotations(i, next)}
                            />
                          )}

                          <div className="p-3 space-y-2">
                            <div className="grid sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Timeframe {group === "Unassigned" && <span className="text-warning">*</span>}
                                </Label>
                                <Select
                                  value={m.timeframe ?? "__none"}
                                  onValueChange={(v) => setMediaTimeframe(i, v === "__none" ? "" : v)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select timeframe" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    <SelectItem value="__none">— None —</SelectItem>
                                    {TIMEFRAME_GROUPS.map((g) => {
                                      const groupOptions = MEDIA_TIMEFRAMES.filter((t) => t.group === g);
                                      if (groupOptions.length === 0) return null;
                                      return (
                                        <SelectGroup key={g}>
                                          <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {g}
                                          </SelectLabel>
                                          {groupOptions.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                              {t.label}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Caption (optional)
                                </Label>
                                <Input
                                  value={m.caption ?? ""}
                                  onChange={(e) => setMediaCaption(i, e.target.value)}
                                  placeholder="What does this evidence show?"
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            {m.timeframe && (
                              <p className="text-[10px] text-muted-foreground">
                                {getTimeframeLabel(m.timeframe)} · {getTimeframeGroup(m.timeframe)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Advanced — collapsible */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <Card className="p-4 md:p-6 space-y-4 bg-background">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full text-left"
                >
                  <div>
                    <h2 className="text-lg font-medium">Advanced</h2>
                    <p className="text-sm text-muted-foreground">
                      ICT setup, psychology, behavior flags, tags.
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform",
                      advancedOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-4">
                {/* ICT Setup */}
                <div className="rounded-md border border-border p-3 space-y-3">
                  <h3 className="text-sm font-medium">ICT Setup</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Weekly Bias</Label>
                      <Select
                        value={form.setup.htfContext.weeklyBias}
                        onValueChange={(v) => setField("setup.htfContext.weeklyBias", v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bullish">Bullish</SelectItem>
                          <SelectItem value="bearish">Bearish</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Daily Bias</Label>
                      <Select
                        value={form.setup.htfContext.dailyBias}
                        onValueChange={(v) => setField("setup.htfContext.dailyBias", v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bullish">Bullish</SelectItem>
                          <SelectItem value="bearish">Bearish</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Liquidity Targets</Label>
                    <div className="flex flex-wrap gap-2">
                      {["PDH", "PDL", "PWH", "PWL", "equal highs", "equal lows", "buy-side", "sell-side", "session liquidity"].map((opt) => {
                        const active = (form.setup.liquidity ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleArrayField("setup.liquidity", opt)}
                            className={cn(
                              "px-2 py-1 rounded-md text-xs border transition-colors",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Market Structure</Label>
                    <div className="flex flex-wrap gap-2">
                      {["BOS", "MSS", "displacement", "protected high", "protected low", "structure shift"].map((opt) => {
                        const active = (form.setup.structure ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleArrayField("setup.structure", opt)}
                            className={cn(
                              "px-2 py-1 rounded-md text-xs border transition-colors",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Entry Model</Label>
                    <Select
                      value={form.setup.entryModel}
                      onValueChange={(v) => setField("setup.entryModel", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["liquidity sweep", "displacement", "FVG", "Order Block", "Breaker", "Mitigation", "SMT", "retracement"].map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Psychology — before */}
                <div className="rounded-md border border-border p-3 space-y-3">
                  <h3 className="text-sm font-medium">Psychology — Before</h3>
                  <div className="space-y-2">
                    <Label>Mood Before</Label>
                    <div className="flex flex-wrap gap-2">
                      {PSYCH_BEFORE.map((opt) => {
                        const active = (form.psychBefore.moodTags ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleArrayField("psychBefore.moodTags", opt)}
                            className={cn(
                              "px-2 py-1 rounded-md text-xs border transition-colors",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Confidence (1-5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={form.psychBefore.confidence}
                        onChange={(e) => setField("psychBefore.confidence", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Energy (1-5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={form.psychBefore.energy}
                        onChange={(e) => setField("psychBefore.energy", Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Psychology — after */}
                <div className="rounded-md border border-border p-3 space-y-3">
                  <h3 className="text-sm font-medium">Psychology — After</h3>
                  <div className="space-y-2">
                    <Label>Mood After</Label>
                    <div className="flex flex-wrap gap-2">
                      {PSYCH_AFTER.map((opt) => {
                        const active = (form.psychAfter.moodTags ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleArrayField("psychAfter.moodTags", opt)}
                            className={cn(
                              "px-2 py-1 rounded-md text-xs border transition-colors",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Behavior flags */}
                <div className="rounded-md border border-border p-3 space-y-3">
                  <h3 className="text-sm font-medium">Behavior Flags</h3>
                  <div className="flex flex-wrap gap-2">
                    {BEHAVIOR_FLAGS.map((opt) => {
                      const active = (form.behaviorFlags ?? []).includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleArrayField("behaviorFlags", opt)}
                          className={cn(
                            "px-2 py-1 rounded-md text-xs border transition-colors",
                            active
                              ? "bg-loss text-white border-loss"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          {opt.replace(/_/g, " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tags */}
                <div className="rounded-md border border-border p-3 space-y-3">
                  <h3 className="text-sm font-medium">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No tags configured. Add some in the Tags view.
                      </p>
                    )}
                    {tags.map((t: any) => {
                      const name = typeof t === "string" ? t : (t.name ?? t.label);
                      const active = (form.tags ?? []).includes(name);
                      return (
                        <button
                          key={typeof t === "string" ? t : t.id}
                          type="button"
                          onClick={() => toggleArrayField("tags", name)}
                          className={cn(
                            "px-2 py-1 rounded-md text-xs border transition-colors",
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes / Lessons */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lessons</Label>
                    <Textarea
                      value={form.lessons}
                      onChange={(e) => setField("lessons", e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* STEP 2 — Setup Checklist                                      */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="checklist" className="space-y-4 mt-3">
          <Card className="p-4 md:p-6 space-y-4 bg-background">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2">
                  Setup Checklist
                  <Sparkles className="h-4 w-4 text-primary" />
                </h2>
                <p className="text-sm text-muted-foreground">
                  {form.strategyId && selectedStrategyVersion
                    ? `${strategyDetail?.name ?? "Strategy"} · v${selectedStrategyVersion.versionLabel}`
                    : "Select a strategy in Step 1 to load its checklist."}
                </p>
              </div>
              {checklistItems.length > 0 && (
                <div className="text-right">
                  <div className={cn(
                    "text-2xl font-bold tnum",
                    evaluation.grade === "A+" || evaluation.grade === "A"
                      ? "text-profit"
                      : evaluation.grade === "B"
                        ? "text-warning"
                        : evaluation.grade === "C"
                          ? "text-muted-foreground"
                          : "text-loss",
                  )}>
                    {evaluation.grade}
                  </div>
                  <div className="text-xs text-muted-foreground tnum">
                    {(evaluation.score * 100).toFixed(1)}% score
                  </div>
                </div>
              )}
            </div>

            {/* Immutable snapshot banner */}
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Immutable historical snapshot.</span>{" "}
                Checklist answers are stored once on save and never silently
                re-evaluated. Future edits to this strategy's rules will not
                change this trade's recorded grade.
              </p>
            </div>

            {checklistItems.length > 0 ? (
              <>
                {/* Adherence summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {checkedCount}/{checklistItems.length} Checked
                    </span>
                    <span className="font-medium tnum">{adherencePct}% Adherence</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        adherencePct >= 90
                          ? "bg-profit"
                          : adherencePct >= 75
                            ? "bg-profit"
                            : adherencePct >= 60
                              ? "bg-warning"
                              : adherencePct >= 40
                                ? "bg-muted-foreground"
                                : "bg-loss",
                      )}
                      style={{ width: `${adherencePct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Required: {evaluation.requiredCheckedCount}/{evaluation.requiredTotalCount} met
                    </span>
                    <span>× weight applies to score</span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                  {checklistItems.map((item) => {
                    const ans = form.checklistAnswers?.[item.id] ?? { checked: false };
                    return (
                      <label
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                          ans.checked
                            ? "bg-profit/10 border-profit/30"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <Checkbox
                          checked={ans.checked}
                          onCheckedChange={(v) => updateChecklistAnswer(item.id, !!v)}
                        />
                        <span className={cn(
                          "text-sm flex-1",
                          ans.checked && "text-profit font-medium",
                        )}>
                          {item.text}
                        </span>
                        {item.required && (
                          <Badge variant="destructive" className="text-[10px] uppercase">
                            Required
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground tnum">
                          ×{item.weight}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">
                  Score = sum(weights of checked items) / sum(weights of all
                  items). If any required item is unchecked, the grade is
                  capped at C.
                </p>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                {form.strategyId ? (
                  <>
                    <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No setup checklist configured for this strategy version.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add rules with weights when creating or versioning the
                      strategy to enable setup-grade scoring.
                    </p>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Select a strategy in Step 1 to load its setup checklist.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The checklist is derived from the strategy's versioned
                      rules and stored as an immutable snapshot when the trade
                      is saved.
                    </p>
                  </>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* STEP 3 — Risk & Sizing                                       */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="risk" className="space-y-4 mt-3">
          <Card className="p-4 md:p-6 space-y-4 bg-background">
            <div>
              <h2 className="text-lg font-medium">Risk &amp; Sizing</h2>
              <p className="text-sm text-muted-foreground">
                Planned entry, stop, and target are required. The rest is
                auto-derived from your account balance and risk %.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2" id="field-entry">
                <FieldLabel required hint="The price you planned to enter at.">Planned Entry</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.plannedEntryPrice}
                  onChange={(e) => setField("plannedEntryPrice", e.target.value)}
                />
              </div>
              <div className="space-y-2" id="field-stop">
                <FieldLabel required hint="The stop loss you planned.">Planned Stop</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.plannedStopPrice}
                  onChange={(e) => setField("plannedStopPrice", e.target.value)}
                />
              </div>
              <div className="space-y-2" id="field-target">
                <FieldLabel required hint="The take profit you planned.">Planned Target</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.plannedTargetPrice}
                  onChange={(e) => {
                    setField("plannedTargetPrice", e.target.value);
                    // When following plan, keep exit price in sync with target
                    if (form.followedPlan) {
                      setField("actualExitPrice", e.target.value);
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel hint="Position size (e.g. 0.5 lots, 1 contract).">Lot Size</FieldLabel>
                
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={form.lotSize}
                    onChange={(e) => setField("lotSize", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (form.plannedEntryPrice && form.plannedStopPrice && riskAmountDollars != null && pointValueCents > 0) {
                        const sizeRes = calculatePositionSize({
                          instrument: selectedInstrument as any,
                          accountBalanceCents: balanceCents,
                          riskPct: form.riskPct,
                          entryPrice: form.plannedEntryPrice,
                          stopPrice: form.plannedStopPrice
                        });
                        if (sizeRes && sizeRes.roundedQuantity) setField("lotSize", sizeRes.roundedQuantity);
                      }
                    }}
                    title="Calculate size based on risk amount"
                  >
                    Auto
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel hint="Risk as a decimal (0.005 = 0.5% of account balance).">Risk %</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.riskPct}
                  onChange={(e) => setField("riskPct", e.target.value)}
                />
              </div>
            </div>

            {/* Auto-calculated panel */}
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-medium mb-3">Auto-calculated</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Stop Distance
                    <span className="ml-1 text-muted-foreground/70">
                      ({unitWord})
                    </span>
                  </div>
                  <div className="text-base font-medium tnum">
                    {stopDistance != null
                      ? `${fmtPrice(stopDistance, pricePrecision)}`
                      : "—"}
                  </div>
                  {stopDistance != null && stopDistanceUnits > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 tnum">
                      {stopDistanceUnits} {unitWord}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Planned R:R</div>
                  <div className={cn(
                    "text-base font-medium tnum",
                    plannedRR != null && plannedRR >= 2
                      ? "text-profit"
                      : plannedRR != null && plannedRR >= 1
                        ? "text-warning"
                        : "",
                  )}>
                    {plannedRR != null ? `${plannedRR.toFixed(2)}R` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Risk Amount
                    <span className="ml-1 text-muted-foreground/70">({form.lotSize || 1} {unitWord === "pips" ? "lot" : "ctr"})</span>
                  </div>
                  <div className="text-base font-medium tnum text-loss">
                    {instrumentRiskDollars != null
                      ? fmtMoney(instrumentRiskDollars, accountCurrency)
                      : riskAmountDollars != null
                        ? fmtMoney(riskAmountDollars, accountCurrency)
                        : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Planned Profit</div>
                  <div className="text-base font-medium tnum text-profit">
                    {plannedProfitCents > 0
                      ? fmtMoney(plannedProfitDollarsPreview, accountCurrency)
                      : plannedProfitDollars != null
                        ? fmtMoney(plannedProfitDollars, accountCurrency)
                        : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Risk per trade
                    <span className="ml-1 text-muted-foreground/70">(preview)</span>
                  </div>
                  <div className="text-base font-medium tnum">
                    {instrumentRiskDollars > 0
                      ? fmtMoney(instrumentRiskDollars, accountCurrency)
                      : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 tnum">
                    stop × {form.lotSize || 1} {unitWord === "pips" ? "lot" : "ctr"} ×{" "}
                    ${(pointValueCents / 100).toFixed(2)}/{unitWord === "pips" ? "lot" : "ctr"}/$1 move
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Account Balance</div>
                  <div className="text-base font-medium tnum">
                    {balanceCents > 0
                      ? fmtMoney(balanceCents / 100, accountCurrency)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Lot × Risk</div>
                  <div className="text-base font-medium tnum">
                    {riskAmountDollars != null
                      ? fmtMoney(riskAmountDollars * lotNum, accountCurrency)
                      : "—"}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Risk Budget = Account Balance × Risk %. Risk per trade =
                stop distance × quantity × point value (per the authoritative
                FinancialEngine). Planned Profit = Risk per trade × Planned R:R.
                Stop Distance is |entry − stop| in price units. All values
                shown here are preview-only; the server recomputes
                authoritatively on save (spec §1).
              </p>
            </div>

            {/* Plan Adherence — did the trader follow the plan?
                When "Followed Plan": exit price = planned target (auto-set).
                When "Deviated": user enters actual entry, stop, exit, lot size.
                The exit price is used to build the exit execution → P&L, R, outcome. */}
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">Plan Adherence &amp; Exit</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.followedPlan
                      ? "Exit price is set to your planned target. P&amp;L, R-multiple, and outcome will be calculated from it."
                      : "Enter the actual values you used. P&amp;L, R-multiple, and outcome will be calculated from your actual exit."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setField("followedPlan", true);
                      // Auto-set exit price = planned target when following plan
                      if (form.plannedTargetPrice) {
                        setField("actualExitPrice", form.plannedTargetPrice);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      form.followedPlan
                        ? "bg-profit text-white"
                        : "bg-background border border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    Followed Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("followedPlan", false)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      !form.followedPlan
                        ? "bg-loss text-white"
                        : "bg-background border border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    Deviated
                  </button>
                </div>
              </div>

              {/* Plan Adherence Inputs */}
            {(form.status === "closed" || !form.followedPlan) && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {form.followedPlan ? (
                  form.status === "closed" && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Exit Price (= Planned Target)</label>
                      <div className="text-sm font-medium tnum px-3 py-2 rounded-md border border-profit/30 bg-profit/5 text-profit">
                        {form.plannedTargetPrice || "—"}
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Actual Entry</label>
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={form.actualEntryPrice}
                        onChange={(e) => setField("actualEntryPrice", e.target.value)}
                        placeholder={form.plannedEntryPrice || "—"}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Actual Stop</label>
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={form.actualStopPrice}
                        onChange={(e) => setField("actualStopPrice", e.target.value)}
                        placeholder={form.plannedStopPrice || "—"}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Actual Lot Size</label>
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={form.actualLotSize}
                        onChange={(e) => setField("actualLotSize", e.target.value)}
                        placeholder={form.lotSize || "—"}
                        className="text-sm"
                      />
                    </div>
                    {form.status === "closed" && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Actual Exit Price</label>
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          value={form.actualExitPrice}
                          onChange={(e) => setField("actualExitPrice", e.target.value)}
                          placeholder={form.plannedTargetPrice || "—"}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              )}

              {/* Plan Adherence Live Preview */}
              {form.status === "closed" && (
                <div className="mt-4 border-t border-border pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Live Adherence Preview</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {planAdherencePreview.checks.map((check: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm bg-background/50 p-2 rounded-md border border-border/50">
                        {check.passed === true ? (
                          <CheckCircle2 className="w-4 h-4 text-profit shrink-0 mt-0.5" />
                        ) : check.passed === false ? (
                          <X className="w-4 h-4 text-loss shrink-0 mt-0.5" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-foreground leading-tight">{check.label}</div>
                          <div className="text-xs text-muted-foreground leading-snug">{check.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* STEP 4 — Partial Exits                                        */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="exits" className="space-y-4 mt-3">
          <Card className="p-4 md:p-6 space-y-4 bg-background">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-medium">Partial Exits</h2>
                <p className="text-sm text-muted-foreground">
                  Plan multiple take-profit levels. The weighted average exit
                  price and total R are derived below.
                </p>
              </div>
              <Button variant="outline" onClick={addExit}>
                <Plus className="h-4 w-4" /> Add Exit Level
              </Button>
            </div>

            {form.partialExits.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No exit levels planned.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Add Exit Level" to define partial take-profit targets.
                </p>
              </div>
            )}

            {form.partialExits.length > 0 && (
              <div className="space-y-3">
                {form.partialExits.map((exit: any) => (
                  <div
                    key={exit.id}
                    className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end p-3 rounded-md border border-border bg-muted/20"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs">Level Name</Label>
                      <Input
                        value={exit.name}
                        onChange={(e) => updateExit(exit.id, "name", e.target.value)}
                        placeholder="TP1, TP2, runner…"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Exit Price</Label>
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={exit.price}
                        onChange={(e) => updateExit(exit.id, "price", e.target.value)}
                        placeholder="0.00000"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-loss"
                      onClick={() => removeExit(exit.id)}
                      aria-label="Remove exit level"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Calculated panel */}
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-medium mb-3">Calculated</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Weighted Exit Price</div>
                  <div className="text-base font-medium tnum">
                    {weightedExitPrice != null
                      ? fmtPrice(weightedExitPrice, pricePrecision)
                      : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Equal-weighted average of all valid exit prices.
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total R (planned)</div>
                  <div className={cn(
                    "text-base font-medium tnum",
                    totalRExits != null && totalRExits >= 1
                      ? "text-profit"
                      : totalRExits != null && totalRExits > 0
                        ? "text-warning"
                        : totalRExits != null
                          ? "text-loss"
                          : "",
                  )}>
                    {totalRExits != null ? `${totalRExits.toFixed(2)}R` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Derived from entry, stop, and the weighted exit price.
                  </div>
                </div>
              </div>
              {!hasEntry || !hasStop ? (
                <p className="text-xs text-warning mt-3 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Enter a planned entry
                  and stop in Step 3 to compute Total R.
                </p>
              ) : null}
            </div>
          </Card>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* STEP 5 — Review & Save                                        */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="review" className="space-y-4 mt-3">
          <Card className="p-4 md:p-6 space-y-4 bg-background">
            <div>
              <h2 className="text-lg font-medium">Review &amp; Save</h2>
              <p className="text-sm text-muted-foreground">
                Confirm the trade details below, then save as a draft or as a
                finalized trade record.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-md border border-border p-4 bg-background">
                <div className="text-xs text-muted-foreground mb-1">Symbol / Direction</div>
                <div className="text-base font-medium truncate">
                  {form.instrumentSymbol || "—"}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1",
                    form.direction === "long"
                      ? "border-profit text-profit"
                      : "border-loss text-loss",
                  )}
                >
                  {form.direction === "long" ? "Long" : "Short"}
                </Badge>
              </div>

              <div className="rounded-md border border-border p-4 bg-background">
                <div className="text-xs text-muted-foreground mb-1">Adherence %</div>
                <div className="text-base font-medium tnum">
                  {checklistItems.length > 0 ? `${adherencePct}%` : "—"}
                </div>
                {checklistItems.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {checkedCount}/{checklistItems.length} checked ·{" "}
                    <span className="font-medium">{evaluation.grade}</span>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-border p-4 bg-background">
                <div className="text-xs text-muted-foreground mb-1">Planned R:R</div>
                <div className={cn(
                  "text-base font-medium tnum",
                  plannedRR != null && plannedRR >= 2
                    ? "text-profit"
                    : plannedRR != null && plannedRR >= 1
                      ? "text-warning"
                      : "",
                )}>
                  {plannedRR != null ? `${plannedRR.toFixed(2)}R` : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Entry {fmtPrice(form.plannedEntryPrice, pricePrecision)} · Stop {fmtPrice(form.plannedStopPrice, pricePrecision)}
                </div>
              </div>

              <div className="rounded-md border border-border p-4 bg-background">
                <div className="text-xs text-muted-foreground mb-1">Setup / Status</div>
                <div className="text-base font-medium truncate">
                  {form.strategyId
                    ? (strategyDetail?.name ?? "Selected strategy")
                    : "—"}
                </div>
                <Badge variant="outline" className="mt-1 capitalize">
                  {form.status}
                </Badge>
              </div>
            </div>

            {/* Summary detail */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <h3 className="text-sm font-medium">Summary</h3>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Account</dt>
                  <dd className="font-medium truncate">
                    {account ? `${account.name} (${account.currency})` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Session</dt>
                  <dd className="font-medium capitalize">{form.session.replace(/_/g, " ")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Timeframe</dt>
                  <dd className="font-medium">{form.timeframe}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">News Event</dt>
                  <dd className="font-medium">{getNewsEventLabel(form.newsEvent ?? "none")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Date / Time</dt>
                  <dd className="font-medium">
                    {form.tradeDate} {form.tradeTime}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Lot Size</dt>
                  <dd className="font-medium tnum">{form.lotSize}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Risk %</dt>
                  <dd className="font-medium tnum">
                    {Number(form.riskPct).toFixed(3)}%
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Risk Amount</dt>
                  <dd className="font-medium tnum text-loss">
                    {instrumentRiskCents > 0
                      ? fmtMoney(instrumentRiskDollars, accountCurrency)
                      : riskAmountDollars != null
                        ? fmtMoney(riskAmountDollars, accountCurrency)
                        : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Planned Profit</dt>
                  <dd className="font-medium tnum text-profit">
                    {plannedProfitCents > 0
                      ? fmtMoney(plannedProfitDollarsPreview, accountCurrency)
                      : plannedProfitDollars != null
                        ? fmtMoney(plannedProfitDollars, accountCurrency)
                        : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Partial Exits</dt>
                  <dd className="font-medium tnum">
                    {form.partialExits.length}{" "}
                    {weightedExitPrice != null
                      ? `· avg ${fmtPrice(weightedExitPrice, pricePrecision)}`
                      : ""}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Evidence</dt>
                  <dd className="font-medium tnum">{form.uploadedMedia.length} files</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Behavior Flags</dt>
                  <dd className="font-medium">
                    {form.behaviorFlags.length === 0
                      ? "None"
                      : form.behaviorFlags.join(", ")}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Thesis preview */}
            {form.thesisWhy && (
              <div className="rounded-md border border-border p-4 space-y-1">
                <h3 className="text-sm font-medium">Thesis</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {form.thesisWhy}
                </p>
              </div>
            )}

            {/* Save actions */}
            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => submit(true)}
                disabled={saving}
                className="order-2 sm:order-1"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save as Draft
              </Button>
              <Button
                onClick={() => submit(false)}
                disabled={saving}
                className="order-1 sm:order-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Save Trade
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Navigation bar */}
      <div className="sticky bottom-0 left-0 right-0 z-20 flex gap-2 justify-between bg-background/95 backdrop-blur p-3 border-t border-border md:rounded-md md:border">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={activeStep === STEP_ORDER[0]}
        >
          <ArrowLeft className="h-4 w-4" /> Previous Step
        </Button>
        {activeStep !== STEP_ORDER[STEP_ORDER.length - 1] ? (
          <Button onClick={goNext}>
            Next Step <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => submit(true)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save as Draft
            </Button>
            <Button onClick={() => submit(false)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save Trade
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
