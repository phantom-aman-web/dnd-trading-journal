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
  SlidersHorizontal,
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
import {
  extractCustomFields,
  type StrategyCustomField,
  type CustomFieldType,
} from "@/lib/strategy-custom-fields";

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
  const [customFields, setCustomFields] = useState<StrategyCustomField[]>(() => {
    return extractCustomFields(latestVersion?.rulesJson);
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

  function addCustomField() {
    const newField: StrategyCustomField = {
      id: `field_${Date.now()}`,
      name: "",
      description: "",
      type: "text",
      required: false,
      order: customFields.length,
      enabled: true,
      options: [],
    };
    setCustomFields((prev) => [...prev, newField]);
  }

  function removeCustomField(index: number) {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCustomField(index: number, patch: Partial<StrategyCustomField>) {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  function moveCustomField(index: number, dir: "up" | "down") {
    setCustomFields((prev) => {
      if (dir === "up" && index === 0) return prev;
      if (dir === "down" && index === prev.length - 1) return prev;
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, idx) => ({ ...item, order: idx }));
    });
  }

  async function handleSubmit(isUpgrade: boolean) {
    if (!name.trim()) {
      toast.error("Strategy name is required");
      return;
    }
    if (isUpgrade && !versionLabel.trim()) {
      toast.error("Version label is required for upgrading");
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

    const cleanCustomFields = customFields
      .map((f, idx) => ({
        ...f,
        id: f.id || `field_${idx}`,
        name: f.name.trim(),
        description: (f.description ?? "").trim(),
        order: idx,
      }))
      .filter((f) => f.name.length > 0);

    setIsSubmitting(true);
    try {
      if (!isUpgrade) {
        // Save in-place to current version without bumping version number
        const patchRes = await fetch(`/api/strategies/${strategy.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            market,
            description: description.trim() || null,
            updateCurrentVersion: true,
            expectedVersionId: latestVersion?.id,
            expectedUpdatedAt: (latestVersion as any)?.createdAt ? new Date((latestVersion as any).createdAt).toISOString() : undefined,
            rules: cleanRules,
            customFields: cleanCustomFields,
            changeReason: changeReason.trim() || "Updated current version",
            changeSummary: changeSummary.trim() || `Saved in-place edits to v${latestLabel}`,
          }),
        });

        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => null);
          throw new Error(err?.error || "Failed to update strategy");
        }

        toast.success(`Saved changes to current version v${latestLabel}`);
      } else {
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
            customFields: cleanCustomFields,
          }),
        });

        if (!putRes.ok) {
          const err = await putRes.json().catch(() => null);
          throw new Error(err?.error || "Failed to create strategy version");
        }

        toast.success(`Created version v${versionLabel.trim()} (v${latestLabel} preserved)`);
      }

      await qc.invalidateQueries({ queryKey: ["strategies"] });
      await qc.invalidateQueries({ queryKey: ["strategy", strategy.id] });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save strategy");
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

          {/* Dynamic Trade Fields Builder */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                  Dynamic Trade Information Fields ({customFields.length})
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Custom trade inputs shown in Advanced Options when logging trades with this strategy.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomField}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Field
              </Button>
            </div>

            {customFields.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                No custom trade fields defined. The default general fields will be used.
              </div>
            ) : (
              <div className="space-y-3">
                {customFields.map((field, idx) => (
                  <div
                    key={field.id || idx}
                    className="p-3 rounded-lg border border-border bg-card space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveCustomField(idx, "up")}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCustomField(idx, "down")}
                          disabled={idx === customFields.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <span className="text-[11px] font-medium text-muted-foreground ml-1">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
                          <Checkbox
                            checked={field.required ?? false}
                            onCheckedChange={(c) => updateCustomField(idx, { required: Boolean(c) })}
                          />
                          <span>Required</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeCustomField(idx)}
                          className="p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                          aria-label="Remove field"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Field Name</Label>
                        <Input
                          value={field.name}
                          onChange={(e) => updateCustomField(idx, { name: e.target.value })}
                          placeholder="e.g. Weekly Bias, Zone Freshness"
                          className="h-8 text-xs font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Field Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(val: CustomFieldType) => updateCustomField(idx, { type: val })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Short Text</SelectItem>
                            <SelectItem value="textarea">Long Text / Notes</SelectItem>
                            <SelectItem value="number">Numeric Value</SelectItem>
                            <SelectItem value="boolean">Toggle / Checkbox</SelectItem>
                            <SelectItem value="select">Single Select (Dropdown)</SelectItem>
                            <SelectItem value="multiselect">Multi-Select (Chips)</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {(field.type === "select" || field.type === "multiselect") && (
                      <div className="space-y-1">
                        <Label className="text-[11px]">Options (comma-separated)</Label>
                        <Input
                          value={Array.isArray(field.options) ? field.options.join(", ") : ""}
                          onChange={(e) =>
                            updateCustomField(idx, {
                              options: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="e.g. Bullish, Bearish, Neutral"
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Input
                        value={field.description || ""}
                        onChange={(e) => updateCustomField(idx, { description: e.target.value })}
                        placeholder="Optional helper text or description"
                        className="h-7 text-[11px] text-muted-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="gap-1.5 font-medium cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Save Changes to Current Version (v{latestLabel})
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="gap-1.5 bg-primary text-primary-foreground font-semibold cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <GitBranch className="h-3.5 w-3.5" />
            Upgrade to New Version (v{versionLabel})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

