"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-store";
import { syncEngine } from "@/lib/offline-sync-engine";
import {
  BookOpen,
  Plus,
  Search,
  Star,
  Tag,
  Pencil,
  Trash2,
  Lightbulb,
  ExternalLink,
  Filter,
  Check,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DICTIONARY_CATEGORIES = [
  "All",
  "Market Structure",
  "Liquidity",
  "Entry Model",
  "Order Flow",
  "Risk Management",
  "Execution",
  "General",
] as const;

const ALPHABET = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

interface StrategyDictionarySectionProps {
  strategyId?: string;
  strategyName?: string;
}

export function StrategyDictionarySection({ strategyId, strategyName }: StrategyDictionarySectionProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedLetter, setSelectedLetter] = useState<string>("All");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  // Form State
  const [term, setTerm] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [category, setCategory] = useState("Market Structure");
  const [definition, setDefinition] = useState("");
  const [practicalExplanation, setPracticalExplanation] = useState("");
  const [exampleUsage, setExampleUsage] = useState("");
  const [relatedTerms, setRelatedTerms] = useState("");
  const [tags, setTags] = useState("");

  const queryKey = ["dictionary", strategyId, search, selectedCategory, selectedLetter, favoritesOnly];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (strategyId) params.set("strategyId", strategyId);
      if (search) params.set("search", search);
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      if (selectedLetter !== "All") params.set("letter", selectedLetter);
      if (favoritesOnly) params.set("isFavorite", "true");

      const res = await fetch(`/api/dictionary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load dictionary");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!navigator.onLine) {
        return syncEngine.queueCreateDictionary(payload, user?.id || "offline_user");
      }

      const url = editingEntry ? `/api/dictionary/${editingEntry.id}` : "/api/dictionary";
      const method = editingEntry ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save concept");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(editingEntry ? "Concept updated." : "Concept added to dictionary.");
      queryClient.invalidateQueries({ queryKey: ["dictionary"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.message || "Failed to save entry"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dictionary/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete concept");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Concept removed from dictionary.");
      queryClient.invalidateQueries({ queryKey: ["dictionary"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete entry"),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const res = await fetch(`/api/dictionary/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dictionary"] });
    },
  });

  function openCreateModal() {
    setEditingEntry(null);
    setTerm("");
    setAbbreviation("");
    setCategory("Market Structure");
    setDefinition("");
    setPracticalExplanation("");
    setExampleUsage("");
    setRelatedTerms("");
    setTags("");
    setModalOpen(true);
  }

  function openEditModal(entry: any) {
    setEditingEntry(entry);
    setTerm(entry.term);
    setAbbreviation(entry.abbreviation || "");
    setCategory(entry.category || "General");
    setDefinition(entry.definition);
    setPracticalExplanation(entry.practicalExplanation || "");
    setExampleUsage(entry.exampleUsage || "");
    try {
      const parsedRel = entry.relatedTermsJson ? JSON.parse(entry.relatedTermsJson) : [];
      setRelatedTerms(Array.isArray(parsedRel) ? parsedRel.join(", ") : "");
    } catch {
      setRelatedTerms("");
    }
    try {
      const parsedTags = entry.tagsJson ? JSON.parse(entry.tagsJson) : [];
      setTags(Array.isArray(parsedTags) ? parsedTags.join(", ") : "");
    } catch {
      setTags("");
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEntry(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || !definition.trim()) {
      toast.error("Term and Definition are required");
      return;
    }

    const relList = relatedTerms
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tagList = tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    saveMutation.mutate({
      strategyId: strategyId || null,
      term: term.trim(),
      abbreviation: abbreviation.trim() || null,
      category,
      definition: definition.trim(),
      practicalExplanation: practicalExplanation.trim() || null,
      exampleUsage: exampleUsage.trim() || null,
      relatedTerms: relList,
      tags: tagList,
    });
  }

  const items: any[] = data?.items || [];
  const totalCount = data?.total || 0;
  const favoriteCount = data?.favoriteCount || 0;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>Trading Dictionary &amp; Terminology</span>
            {strategyName && (
              <Badge variant="outline" className="text-[10px] font-normal border-primary/30 text-primary">
                {strategyName}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] font-mono">
              {totalCount} Concepts
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Maintain your setup's terminology, abbreviations, definitions, and rules in your own words.
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 gap-1.5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Concept</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-muted/30 p-2.5 rounded-xl border border-border">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search concepts, abbreviations, definitions..."
            className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 shadow-none px-1"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-7 px-2 rounded-md bg-background border border-border text-xs text-foreground focus:outline-hidden"
          >
            {DICTIONARY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={cn(
              "h-7 text-xs gap-1 px-2.5",
              favoritesOnly
                ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold"
                : "text-muted-foreground"
            )}
          >
            <Star className={cn("h-3 w-3", favoritesOnly && "fill-current")} />
            <span>Favorites ({favoriteCount})</span>
          </Button>
        </div>
      </div>

      {/* Alphabet filter strip */}
      <div className="flex items-center gap-1 overflow-x-auto py-1 text-[11px] font-mono scrollbar-none">
        {ALPHABET.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => setSelectedLetter(letter)}
            className={cn(
              "px-2 py-0.5 rounded transition-colors shrink-0",
              selectedLetter === letter
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Concepts Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted/30 rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl space-y-2.5">
          <BookOpen className="h-7 w-7 text-muted-foreground mx-auto" />
          <div className="text-xs font-semibold text-foreground">No concepts found</div>
          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
            {search || selectedCategory !== "All" || favoritesOnly
              ? "No concepts match your filter criteria. Try resetting filters."
              : "Define trading concepts, patterns, or abbreviations specific to this setup."}
          </p>
          <Button onClick={openCreateModal} variant="outline" size="sm" className="text-xs h-7 mt-1">
            <Plus className="h-3 w-3 mr-1" />
            Add First Concept
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((entry) => {
            let related: string[] = [];
            try {
              related = entry.relatedTermsJson ? JSON.parse(entry.relatedTermsJson) : [];
            } catch {}

            return (
              <Card
                key={entry.id}
                className="bg-card border border-border rounded-xl shadow-xs p-4 flex flex-col justify-between hover:border-primary/40 transition-colors group"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm font-jakarta text-foreground">{entry.term}</span>
                        {entry.abbreviation && (
                          <Badge variant="outline" className="text-[10px] font-mono font-bold bg-muted/40 text-primary border-primary/20">
                            {entry.abbreviation}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[9px] uppercase tracking-wide">
                          {entry.category || "General"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          toggleFavoriteMutation.mutate({ id: entry.id, isFavorite: !entry.isFavorite })
                        }
                        className={cn(
                          "p-1 rounded hover:bg-muted/50 text-muted-foreground transition-colors",
                          entry.isFavorite && "text-amber-500 hover:text-amber-600"
                        )}
                        title={entry.isFavorite ? "Remove from favorites" : "Star concept"}
                      >
                        <Star className={cn("h-3.5 w-3.5", entry.isFavorite && "fill-current")} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(entry)}
                        className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit concept"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete concept "${entry.term}"?`)) {
                            deleteMutation.mutate(entry.id);
                          }
                        }}
                        className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                        title="Delete concept"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Definition */}
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {entry.definition}
                  </p>

                  {/* Practical Explanation */}
                  {entry.practicalExplanation && (
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/80 text-[11px] space-y-0.5">
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wide">
                        Practical Application:
                      </span>
                      <p className="text-foreground leading-relaxed">{entry.practicalExplanation}</p>
                    </div>
                  )}

                  {/* Example Usage */}
                  {entry.exampleUsage && (
                    <div className="text-[11px] text-muted-foreground italic bg-background/50 p-2 rounded border border-border/50">
                      <strong className="not-italic text-foreground">Example: </strong>
                      {entry.exampleUsage}
                    </div>
                  )}

                  {/* Related Terms */}
                  {related.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Related:</span>
                      {related.map((rel, idx) => (
                        <span
                          key={idx}
                          onClick={() => setSearch(rel)}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/50 border border-border hover:border-primary/50 cursor-pointer transition-colors"
                        >
                          {rel}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground p-5 shadow-2xl">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-base font-bold font-jakarta">
              {editingEntry ? "Edit Concept" : "Add Trading Concept"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the term according to your strategy rules and methodology.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Term / Concept *
                </label>
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="e.g. Fair Value Gap"
                  className="mt-1 h-8 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Abbreviation
                </label>
                <Input
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                  placeholder="e.g. FVG"
                  className="mt-1 h-8 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full h-8 px-2 rounded-md bg-background border border-border text-xs text-foreground focus:outline-hidden"
              >
                {DICTIONARY_CATEGORIES.filter((c) => c !== "All").map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Custom Definition *
              </label>
              <Textarea
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="Explain this concept in your own words..."
                className="mt-1 min-h-[60px] text-xs resize-y"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Practical Application / How to Spot
              </label>
              <Textarea
                value={practicalExplanation}
                onChange={(e) => setPracticalExplanation(e.target.value)}
                placeholder="Where does it form? What confirms it? What invalidates it?"
                className="mt-1 min-h-[50px] text-xs resize-y"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Example Usage
              </label>
              <Input
                value={exampleUsage}
                onChange={(e) => setExampleUsage(e.target.value)}
                placeholder="e.g. Bullish FVG created after 09:30 sweep"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Related Terms
                </label>
                <Input
                  value={relatedTerms}
                  onChange={(e) => setRelatedTerms(e.target.value)}
                  placeholder="e.g. IFVG, Displacement, OTE"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Tags
                </label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. entry_model, ICT"
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={closeModal} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
              >
                {editingEntry ? "Update Concept" : "Add Concept"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
