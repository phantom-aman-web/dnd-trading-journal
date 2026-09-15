"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus, Loader2, Trash2, Pencil, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FieldLabel } from "@/components/common/field-label";
import { EmptyState } from "@/components/common/empty-state";
import { useNav } from "@/lib/nav-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyPlan {
  id: string;
  date: string;
  weeklyBias?: string | null;
  dailyBias?: string | null;
  instruments?: string | null;
  pwh?: string | null;
  pwl?: string | null;
  pdh?: string | null;
  pdl?: string | null;
  htfLevelsJson?: string | null;
  liquidityTargets?: string | null;
  session?: string | null;
  setupConditions?: string | null;
  invalidation?: string | null;
  maxTrades?: number | null;
  maxDailyRiskPct?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlanFormState {
  date: string;
  weeklyBias: string;
  dailyBias: string;
  instruments: string;
  pwh: string;
  pwl: string;
  pdh: string;
  pdl: string;
  htfLevelsJson: string;
  liquidityTargets: string;
  session: string;
  setupConditions: string;
  invalidation: string;
  maxTrades: string;
  maxDailyRiskPct: string;
  notes: string;
}

const EMPTY_FORM: PlanFormState = {
  date: new Date().toISOString().slice(0, 10),
  weeklyBias: "",
  dailyBias: "",
  instruments: "",
  pwh: "",
  pwl: "",
  pdh: "",
  pdl: "",
  htfLevelsJson: "",
  liquidityTargets: "",
  session: "",
  setupConditions: "",
  invalidation: "",
  maxTrades: "",
  maxDailyRiskPct: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchPlans() {
  const res = await fetch("/api/daily-plans", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load daily plans");
  return res.json();
}

function planToForm(plan: DailyPlan): PlanFormState {
  // The date stored in the DB is a UTC ISO string. We extract the YYYY-MM-DD
  // portion to populate the <input type="date"> control without timezone
  // shifting it back/forward a day.
  const dateStr = plan.date ? plan.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return {
    date: dateStr,
    weeklyBias: plan.weeklyBias ?? "",
    dailyBias: plan.dailyBias ?? "",
    instruments: plan.instruments ?? "",
    pwh: plan.pwh ?? "",
    pwl: plan.pwl ?? "",
    pdh: plan.pdh ?? "",
    pdl: plan.pdl ?? "",
    htfLevelsJson: plan.htfLevelsJson ?? "",
    liquidityTargets: plan.liquidityTargets ?? "",
    session: plan.session ?? "__none",
    setupConditions: plan.setupConditions ?? "",
    invalidation: plan.invalidation ?? "",
    maxTrades: plan.maxTrades != null ? String(plan.maxTrades) : "",
    maxDailyRiskPct: plan.maxDailyRiskPct ?? "",
    notes: plan.notes ?? "",
  };
}

function formToPayload(form: PlanFormState) {
  // Numbers / decimals are sent as null when blank to keep the schema
  // optional (no zero-defaulting surprises).
  return {
    date: form.date,
    weeklyBias: form.weeklyBias || undefined,
    dailyBias: form.dailyBias || undefined,
    instruments: form.instruments || undefined,
    pwh: form.pwh || undefined,
    pwl: form.pwl || undefined,
    pdh: form.pdh || undefined,
    pdl: form.pdl || undefined,
    htfLevelsJson: form.htfLevelsJson || undefined,
    liquidityTargets: form.liquidityTargets || undefined,
    session: form.session && form.session !== "__none" ? form.session : undefined,
    setupConditions: form.setupConditions || undefined,
    invalidation: form.invalidation || undefined,
    maxTrades: form.maxTrades === "" ? undefined : Number(form.maxTrades),
    maxDailyRiskPct: form.maxDailyRiskPct || undefined,
    notes: form.notes || undefined,
  };
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function PlansView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["daily-plans"], queryFn: fetchPlans });
  const { params } = useNav();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DailyPlan | null>(null);
  // When the user deep-links in with a `?date=YYYY-MM-DD` (e.g. from the
  // calendar's "Create Plan" button), we open the create dialog with that
  // date pre-filled. The value is cleared after the dialog opens to avoid
  // re-opening it on every render.
  const [initialDate, setInitialDate] = useState<string | null>(null);

  const plans: DailyPlan[] = data?.items ?? [];

  // Allow deep-linking into a specific plan: when the calendar's day-detail
  // dialog navigates to "plans" with `{ id: <planId> }`, auto-select that
  // plan in the list.
  useEffect(() => {
    if (params?.id && plans.some((p) => p.id === params.id)) {
      setSelectedId(params.id);
    }
  }, [params?.id, plans]);

  // Deep-link from the calendar's "Create Plan" CTA: when arriving with a
  // `date` param, open the create dialog with that date pre-filled.
  useEffect(() => {
    if (params?.date && !dialogOpen) {
      setEditingPlan(null);
      setInitialDate(params.date);
      setDialogOpen(true);
    }
  }, [params?.date, dialogOpen]);

  // Sort newest first. The API already returns desc by date, but be defensive
  // and also group by month for visual scanability.
  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [plans]);

  // Group plans by "Month Year" label for the list display.
  const grouped = useMemo(() => {
    const map = new Map<string, DailyPlan[]>();
    for (const p of sortedPlans) {
      const d = new Date(p.date);
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const arr = map.get(label) ?? [];
      arr.push(p);
      map.set(label, arr);
    }
    return Array.from(map.entries());
  }, [sortedPlans]);

  const selected = selectedId ? plans.find((p) => p.id === selectedId) ?? null : null;

  function openCreate() {
    setEditingPlan(null);
    setInitialDate(null);
    setDialogOpen(true);
  }

  function openEdit(plan: DailyPlan) {
    setEditingPlan(plan);
    setInitialDate(null);
    setDialogOpen(true);
  }

  function onSaved() {
    qc.invalidateQueries({ queryKey: ["daily-plans"] });
    setDialogOpen(false);
    setEditingPlan(null);
    setInitialDate(null);
  }

  return (
    <div className="p-4 md:p-6 grid lg:grid-cols-3 gap-4">
      {/* List */}
      <Card className="p-3 lg:col-span-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-semibold">Daily Plans</h1>
            <p className="text-xs text-muted-foreground">Pre-market bias, levels &amp; limits.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingPlan(null); setInitialDate(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <PlanFormDialog
              key={editingPlan?.id ?? (initialDate ? `new-${initialDate}` : "new")}
              plan={editingPlan}
              initialDate={initialDate}
              onClose={() => { setDialogOpen(false); setEditingPlan(null); setInitialDate(null); }}
              onSaved={onSaved}
            />
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : sortedPlans.length === 0 ? (
          <EmptyState
            title="No daily plans yet"
            description="Create your first daily plan to record pre-market bias, key levels, session focus and risk limits for each trading day."
            icon={ClipboardList}
            action={{ label: "New Daily Plan", onClick: openCreate }}
          />
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto scroll-thin pr-1">
            {grouped.map(([label, items]) => (
              <div key={label} className="space-y-1">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 sticky top-0 bg-card py-1">
                  {label}
                </div>
                {items.map((p) => {
                  const d = new Date(p.date);
                  const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  const isBullish = p.dailyBias === "bullish" || p.weeklyBias === "bullish";
                  const isBearish = p.dailyBias === "bearish" || p.weeklyBias === "bearish";
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "w-full text-left p-2 rounded-md border border-border hover:bg-muted/40 transition-colors",
                        selectedId === p.id && "ring-2 ring-primary border-primary/30",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{dateLabel}</span>
                        {p.session && (
                          <Badge variant="outline" className="text-[10px] uppercase">{p.session.replace("_", " ")}</Badge>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          {isBullish && <Badge variant="outline" className="text-[10px] text-profit border-profit/40">Bull</Badge>}
                          {isBearish && <Badge variant="outline" className="text-[10px] text-loss border-loss/40">Bear</Badge>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {p.instruments || "No instruments"} · {p.setupConditions || "No setup conditions"}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail */}
      <div className="lg:col-span-2 space-y-4">
        {!selected ? (
          <Card className="p-8 text-center">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium">Select a daily plan</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Daily plans capture your pre-market work: bias, key HTF levels, liquidity targets, session focus, and the rules that invalidate the thesis.
            </p>
          </Card>
        ) : (
          <PlanDetail
            plan={selected}
            onEdit={() => openEdit(selected)}
            onDeleted={() => { setSelectedId(null); qc.invalidateQueries({ queryKey: ["daily-plans"] }); }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function PlanDetail({ plan, onEdit, onDeleted }: { plan: DailyPlan; onEdit: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const { navigate } = useNav();
  const d = new Date(plan.date);
  const dateLabel = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  async function handleDelete() {
    if (!confirm("Delete this daily plan? Trades linked to it will be unlinked but kept.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/daily-plans/${plan.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Daily plan deleted.");
        onDeleted();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Failed to delete plan.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Daily Plan</div>
          <h2 className="text-xl font-semibold tracking-tight">{dateLabel}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {plan.weeklyBias && <BiasBadge label="Weekly" value={plan.weeklyBias} />}
            {plan.dailyBias && <BiasBadge label="Daily" value={plan.dailyBias} />}
            {plan.session && (
              <Badge variant="outline" className="uppercase text-xs">
                {plan.session.replace("_", " ")}
              </Badge>
            )}
            {plan.maxTrades != null && (
              <Badge variant="outline" className="text-xs">Max {plan.maxTrades} trades</Badge>
            )}
            {plan.maxDailyRiskPct && (
              <Badge variant="outline" className="text-xs">Risk {(Number(plan.maxDailyRiskPct) * 100).toFixed(1)}%</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={() => navigate("tradeNew", { dailyPlanId: plan.id })}
          >
            <TrendingUp className="h-3.5 w-3.5" /> Create Trade From Plan
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-loss"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete plan"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Instruments" value={plan.instruments} />
        <Field label="Session Focus" value={plan.session ? plan.session.replace("_", " ").toUpperCase() : null} />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Key Levels</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <LevelField label="PWH" value={plan.pwh} />
          <LevelField label="PWL" value={plan.pwl} />
          <LevelField label="PDH" value={plan.pdh} />
          <LevelField label="PDL" value={plan.pdl} />
        </div>
      </div>

      {plan.liquidityTargets && (
        <div>
          <h3 className="text-sm font-medium mb-1">Liquidity Targets</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.liquidityTargets}</p>
        </div>
      )}

      {plan.htfLevelsJson && (
        <div>
          <h3 className="text-sm font-medium mb-1">HTF Levels</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.htfLevelsJson}</p>
        </div>
      )}

      {plan.setupConditions && (
        <div>
          <h3 className="text-sm font-medium mb-1">Setup Conditions</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.setupConditions}</p>
        </div>
      )}

      {plan.invalidation && (
        <div>
          <h3 className="text-sm font-medium mb-1">Invalidation</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.invalidation}</p>
        </div>
      )}

      {plan.notes && (
        <div>
          <h3 className="text-sm font-medium mb-1">Notes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.notes}</p>
        </div>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        Created {new Date(plan.createdAt).toLocaleString()} · Updated {new Date(plan.updatedAt).toLocaleString()}
      </div>
    </Card>
  );
}

function BiasBadge({ label, value }: { label: string; value: string }) {
  const v = value.toLowerCase();
  const tone = v === "bullish" ? "text-profit border-profit/40" : v === "bearish" ? "text-loss border-loss/40" : "";
  return (
    <Badge variant="outline" className={cn("text-xs", tone)}>
      {label}: <span className="capitalize ml-1">{value}</span>
    </Badge>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function LevelField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="p-2 rounded-md border border-border bg-muted/20">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tnum mt-0.5">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

// ---------------------------------------------------------------------------
// Create / edit dialog
// ---------------------------------------------------------------------------

function PlanFormDialog({
  plan,
  initialDate,
  onClose,
  onSaved,
}: {
  plan: DailyPlan | null;
  initialDate?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setForm(planToForm(plan));
    } else {
      // Pre-fill the date with the deep-linked `initialDate` (e.g. when the
      // calendar's "Create Plan" button passes `?date=YYYY-MM-DD`); fall
      // back to today's date when none was provided.
      const date = initialDate ?? new Date().toISOString().slice(0, 10);
      setForm({ ...EMPTY_FORM, date });
    }
  }, [plan, initialDate]);

  function setField<K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.date) {
      toast.error("Date is required.");
      setTimeout(() => document.getElementById("field-plan-date")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/daily-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      });
      if (res.ok) {
        toast.success(plan ? "Daily plan updated." : "Daily plan created.");
        onSaved();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Failed to save plan.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
      <DialogHeader>
        <DialogTitle>{plan ? "Edit Daily Plan" : "New Daily Plan"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Basics */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2" id="field-plan-date">
            <FieldLabel required>Date</FieldLabel>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Plans are keyed by date — saving on an existing date will update it.
            </p>
          </div>
          <div className="space-y-2">
            <FieldLabel hint="Primary trading session">Session Focus</FieldLabel>
            <Select value={form.session || "__none"} onValueChange={(v) => setField("session", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Any</SelectItem>
                <SelectItem value="asia">Asia</SelectItem>
                <SelectItem value="london">London</SelectItem>
                <SelectItem value="ny_am">New York AM</SelectItem>
                <SelectItem value="ny_pm">New York PM</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <FieldLabel hint="Overall weekly direction">Weekly Bias</FieldLabel>
            <Select value={form.weeklyBias || "__none"} onValueChange={(v) => setField("weeklyBias", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                <SelectItem value="bullish">Bullish</SelectItem>
                <SelectItem value="bearish">Bearish</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel hint="Today expected direction">Daily Bias</FieldLabel>
            <Select value={form.dailyBias || "__none"} onValueChange={(v) => setField("dailyBias", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                <SelectItem value="bullish">Bullish</SelectItem>
                <SelectItem value="bearish">Bearish</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel hint="Comma-separated symbols">Instruments</FieldLabel>
          <Input
            value={form.instruments}
            onChange={(e) => setField("instruments", e.target.value)}
           
          />
        </div>

        {/* Key levels */}
        <div>
          <Label className="mb-2 block">Key Levels (prices)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">PWH</Label>
              <Input value={form.pwh} onChange={(e) => setField("pwh", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">PWL</Label>
              <Input value={form.pwl} onChange={(e) => setField("pwl", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">PDH</Label>
              <Input value={form.pdh} onChange={(e) => setField("pdh", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">PDL</Label>
              <Input value={form.pdl} onChange={(e) => setField("pdl", e.target.value)} />
            </div>
          </div>
        </div>

        {/* HTF levels */}
        <div className="space-y-2">
          <FieldLabel hint="One level per line (e.g. D1 supply: 2015)">HTF Levels</FieldLabel>
          <Textarea
            value={form.htfLevelsJson}
            onChange={(e) => setField("htfLevelsJson", e.target.value)}
           
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground">Optional. Enter one level per line (e.g. "D1 supply: 2015").</p>
        </div>

        {/* Liquidity targets */}
        <div className="space-y-2">
          <FieldLabel hint="Key liquidity levels">Liquidity Targets</FieldLabel>
          <Textarea
            value={form.liquidityTargets}
            onChange={(e) => setField("liquidityTargets", e.target.value)}
           
            rows={3}
          />
        </div>

        {/* Setup conditions */}
        <div className="space-y-2">
          <FieldLabel hint="What setup are you waiting for">Setup Conditions</FieldLabel>
          <Textarea
            value={form.setupConditions}
            onChange={(e) => setField("setupConditions", e.target.value)}
           
            rows={3}
          />
        </div>

        {/* Invalidation */}
        <div className="space-y-2">
          <FieldLabel hint="What invalidates the plan">Invalidation</FieldLabel>
          <Textarea
            value={form.invalidation}
            onChange={(e) => setField("invalidation", e.target.value)}
           
            rows={2}
          />
        </div>

        {/* Risk limits */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <FieldLabel hint="Maximum trades for the day">Max Trades</FieldLabel>
            <Input
              type="number"
              min={0}
              value={form.maxTrades}
              onChange={(e) => setField("maxTrades", e.target.value)}
             
            />
          </div>
          <div className="space-y-2">
            <FieldLabel hint="Maximum risk as decimal (0.01 = 1%)">Max Daily Risk %</FieldLabel>
            <Input
              value={form.maxDailyRiskPct}
              onChange={(e) => setField("maxDailyRiskPct", e.target.value)}
             
            />
            <p className="text-[11px] text-muted-foreground">Decimal fraction (0.01 = 1%).</p>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <FieldLabel hint="Additional notes">Notes</FieldLabel>
          <Textarea
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
           
            rows={3}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {plan ? "Save Changes" : "Create Plan"}
        </Button>
      </div>
    </DialogContent>
  );
}
