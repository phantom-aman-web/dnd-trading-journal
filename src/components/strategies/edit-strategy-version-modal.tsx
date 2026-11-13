"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GitBranch,
  ShieldCheck,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ChecklistItem {
  title: string;
  required?: boolean;
  description?: string;
}

interface EditStrategyVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: {
    id: string;
    name: string;
    market?: string | null;
    description?: string | null;
    versions?: { id: string; versionLabel: string; rulesJson: string }[];
  };
  onSaved: () => void;
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

function extractChecklist(rulesJson: string | null | undefined): ChecklistItem[] {
  if (!rulesJson) return [];
  try {
    const parsed = JSON.parse(rulesJson);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any) => ({
          title: String(item?.title ?? item?.text ?? "").trim(),
          required: item?.required ?? true,
          description: item?.description ? String(item.description) : "",
        }))
        .filter((i) => i.title.length > 0);
    }
  } catch {}
  return [];
}

export function EditStrategyVersionModal({
  open,
  onOpenChange,
  strategy,
  onSaved,
}: EditStrategyVersionModalProps) {
  const qc = useQueryClient();
  const versions = strategy.versions ?? [];
  const latestVersion = versions[0];

  const latestLabel = latestVersion?.versionLabel ?? "1.0";
  const [maj, min] = latestLabel.split(".");
  const suggestedNextLabel = `${maj}.${Number(min ?? 0) + 1}`;

  const [name, setName] = useState(strategy.name || "");
  const [market, setMarket] = useState(strategy.market || "forex");
  const [description, setDescription] = useState(strategy.description || "");
  const [versionLabel, setVersionLabel] = useState(suggestedNextLabel);
  const [changeReason, setChangeReason] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [rules, setRules] = useState<ChecklistItem[]>(() => {
    const extracted = extractChecklist(latestVersion?.rulesJson);
    return extracted.length > 0
      ? extracted
      : [{ title: "", required: true, description: "" }];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function addRule() {
    setRules((prev) => [...prev, { title: "", required: true, description: "" }]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRule(index: number, patch: Partial<ChecklistItem>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function moveRule(index: number, dir: "up" | "down") {
    setRules((prev) => {
      if (dir === "up" && index === 0) return prev;
      if (dir === "down" && index === prev.length - 1) return prev;
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Strategy name is required");
      return;
    }
    if (!versionLabel.trim()) {
      toast.error("Version label is required");
      return;
    }

    const cleanRules = rules
      .map((r) => ({
        title: r.title.trim(),
        required: r.required ?? true,
        description: (r.description ?? "").trim(),
      }))
      .filter((r) => r.title.length > 0);

    if (cleanRules.length === 0) {
      toast.error("At least one checklist rule is required");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update Strategy metadata (name, market, description)
      const patchRes = await fetch(`/api/strategies/${strategy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          market,
          description: description.trim() || null,
        }),
      });

      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => null);
        throw new Error(err?.error || "Failed to update strategy metadata");
      }

      // 2. Create new immutable version record (PUT)
      const putRes = await fetch(`/api/strategies/${strategy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionLabel: versionLabel.trim(),
          changeReason: changeReason.trim() || "Strategy update",
          changeSummary: changeSummary.trim() || `Created version ${versionLabel.trim()}`,
          rules: cleanRules,
        }),
      });

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => null);
        throw new Error(err?.error || "Failed to create strategy version");
      }

      toast.success(`Created version v${versionLabel.trim()} (v${latestLabel} preserved)`);
      await qc.invalidateQueries({ queryKey: ["strategies"] });
      await qc.invalidateQueries({ queryKey: ["strategy", strategy.id] });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save strategy version");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <DialogTitle>Edit Strategy &amp; Create New Version</DialogTitle>
          </div>
          <DialogDescription>
            Historical version <strong>v{latestLabel}</strong> and its attributed trades will remain completely intact. Your edits will be saved as a new version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Strategy Basic Info */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Strategy Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ICT Silver Bullet"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Primary Market</Label>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Strategy setup criteria and edge description..."
              rows={2}
            />
          </div>

          {/* New Version Metadata Card */}
          <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Version Changelog
              </span>
              <span className="text-[11px] text-muted-foreground">
                Current: <strong className="text-foreground">v{latestLabel}</strong>
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>New Version Number</Label>
                <Input
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder={suggestedNextLabel}
                  className="h-8 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Change Reason</Label>
                <Input
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Added 15m confluence check"
                  className="h-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Change Summary</Label>
              <Input
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Detailed summary of rules modified, added, or removed"
                className="h-8"
              />
            </div>
          </div>

          {/* Checklist Rules Editor */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-foreground">
                Setup Checklist Rules ({rules.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRule}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Rule
              </Button>
            </div>

            <div className="space-y-2">
              {rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-card"
                >
                  <div className="flex flex-col gap-1 pt-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveRule(idx, "up")}
                      disabled={idx === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRule(idx, "down")}
                      disabled={idx === rules.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={rule.title}
                        onChange={(e) => updateRule(idx, { title: e.target.value })}
                        placeholder={`Rule ${idx + 1} (e.g. Liquidity sweep on 15m)`}
                        className="h-8 text-xs font-medium"
                      />
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground shrink-0">
                        <Checkbox
                          checked={rule.required ?? true}
                          onCheckedChange={(checked) =>
                            updateRule(idx, { required: Boolean(checked) })
                          }
                        />
                        <span>Required</span>
                      </label>
                    </div>
                    <Input
                      value={rule.description || ""}
                      onChange={(e) => updateRule(idx, { description: e.target.value })}
                      placeholder="Optional rule criteria or notes"
                      className="h-7 text-[11px] text-muted-foreground"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    disabled={rules.length <= 1}
                    className="p-1.5 text-muted-foreground hover:text-rose-500 disabled:opacity-30 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save as Version v{versionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

