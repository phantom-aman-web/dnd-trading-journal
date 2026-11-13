"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Plus, Trash2, Check, RotateCcw, Star, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export interface FilterState {
  accountId?: string;
  setupId?: string;
  direction?: string;
  outcome?: string;
  search?: string;
}

export interface FilterPresetItem {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetView: string;
  filtersJson: string;
  isDefault: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SavedFilterPresetsProps {
  targetView?: string;
  currentFilters: FilterState;
  onApplyFilters: (filters: FilterState) => void;
  availableAccountIds?: string[];
  availableStrategyIds?: string[];
}

export function SavedFilterPresets({
  targetView = "tradesLog",
  currentFilters,
  onApplyFilters,
  availableAccountIds = [],
  availableStrategyIds = [],
}: SavedFilterPresetsProps) {
  const queryClient = useQueryClient();
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // Fetch presets
  const { data, isLoading } = useQuery<{ items: FilterPresetItem[] }>({
    queryKey: ["filter-presets", targetView],
    queryFn: async () => {
      const res = await fetch(`/api/filter-presets?targetView=${encodeURIComponent(targetView)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load presets");
      return res.json();
    },
  });

  const presets = data?.items ?? [];

  // Create preset mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; filtersJson: string; isDefault: boolean; isPinned: boolean }) => {
      const res = await fetch("/api/filter-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          targetView,
        }),
      });
      if (!res.ok) throw new Error("Failed to create preset");
      return res.json();
    },
    onSuccess: (newPreset: FilterPresetItem) => {
      queryClient.invalidateQueries({ queryKey: ["filter-presets", targetView] });
      setActivePresetId(newPreset.id);
      setIsSaveModalOpen(false);
      setPresetName("");
      setIsDefault(false);
      setIsPinned(false);
    },
  });

  // Update preset mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FilterPresetItem> }) => {
      const res = await fetch(`/api/filter-presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update preset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filter-presets", targetView] });
    },
  });

  // Delete preset mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/filter-presets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete preset");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["filter-presets", targetView] });
      if (activePresetId === deletedId) {
        setActivePresetId(null);
      }
    },
  });

  const activePreset = presets.find((p) => p.id === activePresetId);

  // Check if current filters match the active preset's filters
  let hasPresetChanged = false;
  if (activePreset) {
    try {
      const savedFilters = JSON.parse(activePreset.filtersJson) as FilterState;
      hasPresetChanged =
        (currentFilters.accountId || "all") !== (savedFilters.accountId || "all") ||
        (currentFilters.setupId || "all") !== (savedFilters.setupId || "all") ||
        (currentFilters.direction || "all") !== (savedFilters.direction || "all") ||
        (currentFilters.outcome || "all") !== (savedFilters.outcome || "all") ||
        (currentFilters.search || "") !== (savedFilters.search || "");
    } catch {
      hasPresetChanged = true;
    }
  }

  function applyPreset(preset: FilterPresetItem) {
    try {
      const raw = JSON.parse(preset.filtersJson) as FilterState;
      // Sanitize: ensure referenced accountId and setupId still exist
      const sanitized: FilterState = {
        accountId:
          raw.accountId && raw.accountId !== "all" && availableAccountIds.length > 0
            ? availableAccountIds.includes(raw.accountId)
              ? raw.accountId
              : "all"
            : raw.accountId || "all",
        setupId:
          raw.setupId && raw.setupId !== "all" && availableStrategyIds.length > 0
            ? availableStrategyIds.includes(raw.setupId)
              ? raw.setupId
              : "all"
            : raw.setupId || "all",
        direction: raw.direction || "all",
        outcome: raw.outcome || "all",
        search: raw.search || "",
      };

      setActivePresetId(preset.id);
      onApplyFilters(sanitized);
    } catch {
      setActivePresetId(null);
    }
  }

  function handleSaveNew() {
    if (!presetName.trim()) return;
    createMutation.mutate({
      name: presetName.trim(),
      filtersJson: JSON.stringify(currentFilters),
      isDefault,
      isPinned,
    });
  }

  function handleUpdateCurrent() {
    if (!activePreset) return;
    updateMutation.mutate({
      id: activePreset.id,
      data: {
        filtersJson: JSON.stringify(currentFilters),
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium border-border"
            >
              <Bookmark className="h-3.5 w-3.5 text-primary" />
              {activePreset ? (
                <span className="flex items-center gap-1">
                  Preset: <strong className="font-semibold text-foreground">{activePreset.name}</strong>
                  {hasPresetChanged && <span className="text-amber-500 text-[10px] ml-1">(modified)</span>}
                </span>
              ) : (
                <span>Filter Presets ({presets.length})</span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Saved Presets
            </div>
            {presets.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No saved presets yet
              </div>
            ) : (
              presets.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {p.isPinned && <Pin className="h-3 w-3 text-primary fill-primary/20 shrink-0" />}
                    {p.isDefault && <Star className="h-3 w-3 text-amber-500 fill-amber-500/20 shrink-0" />}
                    <span className={activePresetId === p.id ? "font-semibold text-primary" : ""}>
                      {p.name}
                    </span>
                  </span>
                  {activePresetId === p.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setIsSaveModalOpen(true)}
              className="text-xs text-primary font-medium cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Save current filters as preset
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick pinned presets pills */}
        {presets
          .filter((p) => p.isPinned)
          .map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                activePresetId === p.id
                  ? "bg-primary/10 border-primary text-primary font-semibold"
                  : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {p.name}
            </button>
          ))}
      </div>

      {/* Action controls when a preset is active */}
      {activePreset && (
        <div className="flex items-center gap-1 text-xs">
          {hasPresetChanged && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpdateCurrent}
              disabled={updateMutation.isPending}
              className="h-7 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 px-2"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Update Preset
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              updateMutation.mutate({
                id: activePreset.id,
                data: { isPinned: !activePreset.isPinned },
              });
            }}
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            title={activePreset.isPinned ? "Unpin preset" : "Pin preset"}
          >
            <Pin className={`h-3 w-3 ${activePreset.isPinned ? "fill-primary text-primary" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(`Delete preset "${activePreset.name}"?`)) {
                deleteMutation.mutate(activePreset.id);
              }
            }}
            disabled={deleteMutation.isPending}
            className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2"
            title="Delete preset"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Save Preset Dialog */}
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Save your current filter configuration to quickly restore it anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Preset Name</label>
              <Input
                placeholder="e.g. Gold London Breakouts, Win Only..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveNew();
                }}
              />
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span>Set as default view for Trades Log</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span>Pin to quick-filter toolbar</span>
              </label>
            </div>

            {/* Preview of active filter tokens */}
            <div className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-1 border border-border">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Included Filters
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                <Badge variant="outline" className="text-[10px]">
                  Account: {currentFilters.accountId || "All"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Setup: {currentFilters.setupId || "All"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Direction: {currentFilters.direction || "All"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Outcome: {currentFilters.outcome || "All"}
                </Badge>
                {currentFilters.search && (
                  <Badge variant="outline" className="text-[10px]">
                    Search: "{currentFilters.search}"
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNew}
              disabled={!presetName.trim() || createMutation.isPending}
            >
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

