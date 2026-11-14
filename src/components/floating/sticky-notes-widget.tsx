"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pin, Palette, Check, Layers, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StickyNoteItem {
  id: string;
  text: string;
  color: "amber" | "emerald" | "sky" | "purple" | "slate";
  isPinned: boolean;
  updatedAt: string;
}

const COLOR_MAP = {
  amber: "bg-amber-100/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100",
  emerald: "bg-emerald-100/90 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100",
  sky: "bg-sky-100/90 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-100",
  purple: "bg-purple-100/90 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-100",
  slate: "bg-slate-100/90 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100",
};

const COLOR_SWATCH = {
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  purple: "bg-purple-400",
  slate: "bg-slate-500",
};

const STICKY_STORAGE_KEY = "alphapips-sticky-notes-data";

const DEFAULT_NOTES: StickyNoteItem[] = [
  {
    id: "sticky-1",
    text: "• NY Open: Look for 15m liquidity sweep\n• Risk Max: 1% per trade\n• No trades after 11:30 AM NY",
    color: "amber",
    isPinned: true,
    updatedAt: new Date().toISOString(),
  },
];

export function StickyNotesWidgetContent() {
  const [notes, setNotes] = useState<StickyNoteItem[]>(DEFAULT_NOTES);
  const [activeNoteId, setActiveNoteId] = useState<string>("sticky-1");

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STICKY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          setActiveNoteId(parsed[0].id);
        }
      }
    } catch {}
  }, []);

  // Save to localStorage
  function saveNotes(updated: StickyNoteItem[]) {
    setNotes(updated);
    try {
      localStorage.setItem(STICKY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  function handleTextChange(val: string) {
    if (!activeNote) return;
    const updated = notes.map((n) =>
      n.id === activeNote.id ? { ...n, text: val, updatedAt: new Date().toISOString() } : n
    );
    saveNotes(updated);
  }

  function handleColorChange(color: StickyNoteItem["color"]) {
    if (!activeNote) return;
    const updated = notes.map((n) =>
      n.id === activeNote.id ? { ...n, color, updatedAt: new Date().toISOString() } : n
    );
    saveNotes(updated);
  }

  function handleTogglePin() {
    if (!activeNote) return;
    const updated = notes.map((n) =>
      n.id === activeNote.id ? { ...n, isPinned: !n.isPinned } : n
    );
    saveNotes(updated);
  }

  function handleAddNote() {
    const newNote: StickyNoteItem = {
      id: `sticky-${Date.now()}`,
      text: "",
      color: "amber",
      isPinned: false,
      updatedAt: new Date().toISOString(),
    };
    const updated = [...notes, newNote];
    saveNotes(updated);
    setActiveNoteId(newNote.id);
  }

  function handleDeleteNote(id: string) {
    if (notes.length <= 1) {
      toast.info("Keeping one note canvas.");
      handleTextChange("");
      return;
    }
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
    setActiveNoteId(updated[0]?.id || "");
    toast.success("Sticky note deleted");
  }

  if (!activeNote) return null;

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Sticky Top Bar: Note selector tabs & Add */}
      <div className="flex items-center justify-between text-[10px] flex-none">
        <div className="flex items-center gap-1 overflow-x-auto max-w-[190px] pb-0.5">
          {notes.map((n, idx) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setActiveNoteId(n.id)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold transition-colors flex items-center gap-1 whitespace-nowrap",
                n.id === activeNote.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_SWATCH[n.color])} />
              <span>#{idx + 1}</span>
              {n.isPinned && <Pin className="h-2 w-2" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddNote}
            className="h-5 px-1.5 text-[9px] gap-0.5 font-semibold text-primary hover:bg-primary/10"
            title="Create another sticky note"
          >
            <Plus className="h-2.5 w-2.5" />
            <span>Add</span>
          </Button>
        </div>
      </div>

      {/* Note Canvas Container */}
      <div
        className={cn(
          "rounded-lg border p-2 transition-colors flex-1 flex flex-col justify-between min-h-[110px]",
          COLOR_MAP[activeNote.color]
        )}
      >
        <Textarea
          value={activeNote.text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Sticky reminder, key support/resistance levels, discipline rule…"
          rows={4}
          className="bg-transparent border-0 resize-none text-xs p-0 focus-visible:ring-0 shadow-none leading-relaxed text-inherit placeholder:opacity-50 flex-1 min-h-[60px]"
        />

        {/* Color Palette & Actions Bar */}
        <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-black/10 dark:border-white/10 text-[10px] flex-none">
          {/* Swatches */}
          <div className="flex items-center gap-1">
            {(["amber", "emerald", "sky", "purple", "slate"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleColorChange(c)}
                className={cn(
                  "h-3.5 w-3.5 rounded-full border border-black/20 dark:border-white/20 transition-transform flex items-center justify-center",
                  COLOR_SWATCH[c],
                  activeNote.color === c && "scale-115 ring-1 ring-primary"
                )}
                title={c}
              >
                {activeNote.color === c && <Check className="h-2 w-2 text-white stroke-[3]" />}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleTogglePin}
              className={cn(
                "p-1 rounded transition-colors",
                activeNote.isPinned ? "text-amber-500 fill-amber-500" : "text-muted-foreground/60 hover:text-foreground"
              )}
              title={activeNote.isPinned ? "Unpin note" : "Pin note"}
            >
              <Pin className={cn("h-3 w-3", activeNote.isPinned && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteNote(activeNote.id)}
              className="p-1 rounded text-muted-foreground/60 hover:text-rose-500 transition-colors"
              title="Delete sticky note"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
