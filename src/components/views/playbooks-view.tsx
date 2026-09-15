"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, ListChecks, ChevronRight, Loader2, Trash2, PencilLine, X, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { FieldLabel } from "@/components/common/field-label";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & helpers                                                     */
/* ------------------------------------------------------------------ */

/** A single checklist rule stored as part of a strategy's rules JSON. */
interface ChecklistItem {
  title: string;
  required?: boolean;
  description?: string;
}

const MARKETS = [
  { value: "forex", label: "Forex" },
  { value: "gold", label: "Gold" },
  { value: "indices", label: "Indices" },
  { value: "futures", label: "Futures" },
  { value: "crypto", label: "Crypto" },
  { value: "stocks", label: "Stocks" },
  { value: "mixed", label: "Mixed" },
  { value: "custom", label: "Custom" },
];

const MARKET_LABELS: Record<string, string> = Object.fromEntries(
  MARKETS.map((m) => [m.value, m.label]),
);

/**
 * Extract a flat checklist from a strategy version's rules JSON.
 *
 * Supports two formats:
 *  - New: a flat array of { title, required, description } objects.
 *  - Legacy: the old category-based object
 *    ({ entry:[{text,weight,required}], stop:[...], ... gradingThresholds }).
 *    We flatten entry/stop/target/management/invalidation, extracting the
 *    `text` field as the title and preserving `required` when present.
 */
function extractChecklist(rulesJson: string | null | undefined): ChecklistItem[] {
  if (!rulesJson) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rulesJson);
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed
      .map((item: any) => ({
        title: String(item?.title ?? item?.text ?? "").trim(),
        required: item?.required ?? true,
        description: item?.description ? String(item.description) : "",
      }))
      .filter((i) => i.title.length > 0);
  }
  if (parsed && typeof parsed === "object") {
    const sections = ["entry", "stop", "target", "management", "invalidation"];
    const items: ChecklistItem[] = [];
    for (const sec of sections) {
      const arr = (parsed as any)[sec];
      if (!Array.isArray(arr)) continue;
      for (const r of arr) {
        const title = typeof r === "string" ? r : String(r?.text ?? "").trim();
        if (!title) continue;
        items.push({
          title,
          required: typeof r === "object" && r ? r.required ?? true : true,
          description: typeof r === "object" && r && r.description ? String(r.description) : "",
        });
      }
    }
    return items;
  }
  return [];
}

async function fetchStrategies() {
  const res = await fetch("/api/strategies", { cache: "no-store" });
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function PlaybooksView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["strategies"], queryFn: fetchStrategies });
  const [editing, setEditing] = useState<{ id?: string; open: boolean }>({ open: false });

  const strategies: any[] = data?.items ?? [];

  if (isLoading) return <div className="p-4 md:p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Setups & Checklists</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define each setup you trade, the market it applies to, and the checklist of rules you follow.
          </p>
        </div>
        <SetupDialog
          open={editing.open && !editing.id}
          onOpenChange={(o) => setEditing({ open: o })}
          onSaved={() => qc.invalidateQueries({ queryKey: ["strategies"] })}
        />
      </div>

      {strategies.length === 0 ? (
        <Card className="p-8 text-center">
          <ListChecks className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium">No setups yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Create your first setup to define a checklist of rules you can score against during a trade.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setEditing({ open: true })}
          >
            <Plus className="h-4 w-4" /> New Setup
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {strategies.map((s) => {
            const versions: any[] = s.versions ?? [];
            const latest = versions[0];
            const checklist = extractChecklist(latest?.rulesJson);
            const requiredCount = checklist.filter((c) => c.required).length;
            return (
              <SetupCard
                key={s.id}
                strategy={s}
                checklistCount={checklist.length}
                requiredCount={requiredCount}
                onEdit={() => setEditing({ id: s.id, open: true })}
                onDeleted={() => qc.invalidateQueries({ queryKey: ["strategies"] })}
              />
            );
          })}
        </div>
      )}

      {/* Hidden dialog instance that opens when editing an existing setup. */}
      {editing.id && (
        <SetupDialog
          open={editing.open}
          onOpenChange={(o) => setEditing({ id: editing.id, open: o })}
          strategyId={editing.id}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["strategies"] });
            setEditing({ open: false });
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Setup card                                                         */
/* ------------------------------------------------------------------ */

function SetupCard({
  strategy,
  checklistCount,
  requiredCount,
  onEdit,
  onDeleted,
}: {
  strategy: any;
  checklistCount: number;
  requiredCount: number;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const marketLabel = strategy.market ? MARKET_LABELS[strategy.market] ?? strategy.market : null;
  return (
    <Card className="p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm truncate">{strategy.name}</h3>
            {marketLabel && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {marketLabel}
              </Badge>
            )}
          </div>
          {strategy.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {strategy.description}
            </p>
          )}
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Edit setup"
        >
          <PencilLine className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ListChecks className="h-3.5 w-3.5" />
          <span className="tnum">{checklistCount}</span>
          <span className="hidden sm:inline">checklist {checklistCount === 1 ? "item" : "items"}</span>
        </span>
        {requiredCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="tnum">{requiredCount}</span>
            required
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border mt-auto">
        <button
          onClick={onEdit}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Edit <ChevronRight className="h-3 w-3" />
        </button>
        <button
          onClick={async () => {
            if (!confirm("Delete this setup? Trades that reference it will keep their data, but the setup itself will be removed.")) return;
            const res = await fetch(`/api/strategies/${strategy.id}`, { method: "DELETE" });
            if (res.ok) {
              toast.success("Setup deleted.");
              onDeleted();
            } else {
              toast.error("Failed to delete setup.");
            }
          }}
          className="text-xs text-muted-foreground hover:text-loss inline-flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Setup create / edit dialog                                         */
/* ------------------------------------------------------------------ */

interface SetupDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  strategyId?: string;
  onSaved: () => void;
}

function SetupDialog({ open, onOpenChange, strategyId, onSaved }: SetupDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!strategyId;

  // Fetch the full strategy (with versions) only in edit mode.
  const { data: fullStrategy } = useQuery({
    queryKey: ["strategy", strategyId],
    queryFn: async () => {
      const res = await fetch(`/api/strategies/${strategyId}`, { cache: "no-store" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!strategyId && open,
  });

  const [name, setName] = useState("");
  const [market, setMarket] = useState("forex");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>([
    { title: "", required: true, description: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed from the fetched strategy (edit mode).
  const versions: any[] = fullStrategy?.versions ?? [];
  const latest = versions[0];
  if (!seeded && latest) {
    const checklist = extractChecklist(latest.rulesJson);
    if (checklist.length > 0) {
      setItems(checklist);
    }
    setName(fullStrategy?.name ?? "");
    setMarket(fullStrategy?.market ?? "forex");
    setDescription(fullStrategy?.description ?? "");
    setSeeded(true);
  }

  // Reset state when the dialog closes.
  const handleClose = (next: boolean) => {
    if (!next) {
      // Delay reset so the closing animation can run.
      setTimeout(() => {
        setName("");
        setMarket("forex");
        setDescription("");
        setItems([{ title: "", required: true, description: "" }]);
        setSeeded(false);
      }, 150);
    }
    onOpenChange(next);
  };

  function addItem() {
    setItems((arr) => [...arr, { title: "", required: true, description: "" }]);
  }

  function removeItem(idx: number) {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<ChecklistItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function moveItem(idx: number, dir: "up" | "down") {
    setItems((arr) => {
      if (dir === "up" && idx === 0) return arr;
      if (dir === "down" && idx === arr.length - 1) return arr;
      const next = [...arr];
      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("Setup name is required");
      return;
    }
    // Filter out empty-title items — they're not useful as checklist rules.
    const cleanItems = items
      .map((it) => ({
        title: it.title.trim(),
        required: it.required ?? true,
        description: (it.description ?? "").trim(),
      }))
      .filter((it) => it.title.length > 0);

    setLoading(true);
    try {
      if (isEdit && strategyId) {
        // For edits, create a new version (v1.1, v1.2, ...) that carries the
        // updated checklist. The strategy row is also updated with name/market/
        // description via PATCH first, so the list view stays consistent.
        const patchRes = await fetch(`/api/strategies/${strategyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            market,
            description: description.trim() || null,
          }),
        });
        if (!patchRes.ok) {
          toast.error("Failed to update setup.");
          setLoading(false);
          return;
        }
        // Compute the next version label by bumping the minor of the latest.
        const latestLabel = latest?.versionLabel ?? "1.0";
        const [maj, min] = latestLabel.split(".");
        const nextLabel = `${maj}.${Number(min ?? 0) + 1}`;
        const versionRes = await fetch(`/api/strategies/${strategyId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionLabel: nextLabel,
            changeReason: "Updated checklist",
            changeSummary: "Edited setup checklist from the Setups view.",
            rules: cleanItems,
          }),
        });
        if (!versionRes.ok) {
          toast.error("Failed to save checklist.");
          setLoading(false);
          return;
        }
        toast.success("Setup updated.");
        qc.invalidateQueries({ queryKey: ["strategies"] });
        qc.invalidateQueries({ queryKey: ["strategy", strategyId] });
        onSaved();
      } else {
        // Create new strategy with a flat-array rules JSON (v1.0).
        const res = await fetch("/api/strategies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            market,
            rules: cleanItems,
          }),
        });
        if (!res.ok) {
          toast.error("Failed to create setup.");
          setLoading(false);
          return;
        }
        toast.success("Setup created.");
        qc.invalidateQueries({ queryKey: ["strategies"] });
        onSaved();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="h-4 w-4" /> New Setup
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Setup" : "New Setup"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Basics */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <FieldLabel required>Setup Name</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. London Breakout"
                autoFocus={!isEdit}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel hint="Which market this setup targets">Market</FieldLabel>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel hint="Short summary of the edge">Description / Edge Summary</FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this setup do, and why does it work?"
            />
          </div>

          {/* Checklist */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Checklist Rules</div>
                <p className="text-xs text-muted-foreground">
                  The rules DnD will score against during a trade. Mark a rule as
                  required to gate the A+ grade on it.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={addItem} className="shrink-0">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>

            <div className="space-y-2">
              {items.length === 0 && (
                <div className="text-xs text-muted-foreground italic py-2">
                  No checklist items yet. Click "Add" to create one.
                </div>
              )}
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border bg-background p-2 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-0.5 mt-1.5 shrink-0">
                      <button
                        onClick={() => moveItem(idx, "up")}
                        disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move rule up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveItem(idx, "down")}
                        disabled={idx === items.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move rule down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Checkbox
                      checked={it.required ?? true}
                      onCheckedChange={(v) => updateItem(idx, { required: v === true })}
                      className="mt-2"
                      aria-label="Required rule"
                    />
                    <Input
                      value={it.title}
                      onChange={(e) => updateItem(idx, { title: e.target.value })}
                      placeholder={`Checklist rule #${idx + 1}`}
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeItem(idx)}
                      className="mt-2 text-muted-foreground hover:text-loss shrink-0"
                      aria-label="Remove rule"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Input
                    value={it.description ?? ""}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="Optional description / context"
                    className="text-xs ml-8"
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={submit} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Save Changes" : "Create Setup"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
