"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivacyStore } from "@/lib/privacy-store";
import { useNav } from "@/lib/nav-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Save,
  Check,
  RotateCcw,
  Trash2,
  Pin,
  Search,
  Plus,
  BookOpen,
  Link2,
  History,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StoredQuickNote {
  id: string;
  title: string;
  content: string;
  destination: "draft" | "journal" | "instrument" | "session" | "strategy";
  linkedEntity?: string;
  isPinned: boolean;
  updatedAt: string;
}

const STORAGE_KEY = "alphapips-quick-notes-list";
const DRAFT_KEY = "alphapips-quick-notes-active-draft";

const TOP_INSTRUMENTS = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "US30", "NAS100"];
const SESSIONS = ["London", "New York", "Asian", "Overlap"];

export function QuickNotesWidgetContent() {
  const qc = useQueryClient();
  const { navigate } = useNav();

  // Active note state
  const [activeNoteId, setActiveNoteId] = useState<string>("active-draft");
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [destination, setDestination] = useState<StoredQuickNote["destination"]>("draft");
  const [linkedEntity, setLinkedEntity] = useState<string>("EURUSD");
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Status
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [viewMode, setViewMode] = useState<"edit" | "list">("edit");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [savedNotes, setSavedNotes] = useState<StoredQuickNote[]>([]);

  // Fetch strategies for strategy-linked destination
  const { data: strategies = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["strategies-quick-notes"],
    queryFn: async () => {
      const res = await fetch("/api/strategies");
      const json = await res.json();
      return Array.isArray(json) ? json : json.items || [];
    },
  });

  // Load saved notes and initial draft from localStorage
  useEffect(() => {
    try {
      const storedNotes = localStorage.getItem(STORAGE_KEY);
      if (storedNotes) {
        setSavedNotes(JSON.parse(storedNotes));
      }
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        setTitle(parsed.title || "");
        setContent(parsed.content || "");
        setDestination(parsed.destination || "draft");
        setLinkedEntity(parsed.linkedEntity || "EURUSD");
        setIsPinned(parsed.isPinned || false);
      }
    } catch {}
  }, []);

  // Autosave draft with 500ms debounce
  useEffect(() => {
    if (activeNoteId !== "active-draft") return;
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      setSaveStatus("saving");
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            title,
            content,
            destination,
            linkedEntity,
            isPinned,
            updatedAt: new Date().toISOString(),
          })
        );
        setTimeout(() => setSaveStatus("saved"), 200);
      } catch {
        setSaveStatus("unsaved");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [title, content, destination, linkedEntity, isPinned, activeNoteId]);

  // Save note to permanent list
  function handleSaveToList() {
    if (!content.trim() && !title.trim()) {
      toast.error("Please enter some note content first.");
      return;
    }

    const noteToSave: StoredQuickNote = {
      id: activeNoteId === "active-draft" ? `note-${Date.now()}` : activeNoteId,
      title: title.trim() || (content.slice(0, 30) + "..."),
      content: content.trim(),
      destination,
      linkedEntity: destination === "draft" ? undefined : linkedEntity,
      isPinned,
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = savedNotes.findIndex((n) => n.id === noteToSave.id);
    let updated: StoredQuickNote[];
    if (existingIdx !== -1) {
      updated = [...savedNotes];
      updated[existingIdx] = noteToSave;
    } else {
      updated = [noteToSave, ...savedNotes];
    }

    setSavedNotes(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    toast.success("Quick note saved!");
  }

  // Push to Journal as an Observation
  async function handleSendToJournal() {
    if (!content.trim()) {
      toast.error("Note content is empty.");
      return;
    }

    try {
      const payload = {
        instrumentSymbol: destination === "instrument" ? linkedEntity : "GENERAL",
        market: "Forex",
        bias: "neutral",
        session: destination === "session" ? linkedEntity : "London",
        timeframe: "15m",
        observation: `${title ? `[${title}] ` : ""}${content}`,
        decisionType: "deliberate_avoidance",
        reasonCategory: "Market Note / Reflection",
        reasonNotes: "Recorded via Floating Quick Notes",
      };

      const res = await fetch("/api/no-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Note saved directly to your Journal!");
        qc.invalidateQueries({ queryKey: ["no-trades"] });
        // Clear draft after journal save
        setTitle("");
        setContent("");
      } else {
        toast.error("Failed to save to journal API");
      }
    } catch (e) {
      toast.error("Error saving note to journal");
    }
  }

  function handleNewNote() {
    setActiveNoteId("active-draft");
    setTitle("");
    setContent("");
    setDestination("draft");
    setIsPinned(false);
    setViewMode("edit");
  }

  function handleSelectNote(note: StoredQuickNote) {
    setActiveNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setDestination(note.destination);
    setLinkedEntity(note.linkedEntity || "EURUSD");
    setIsPinned(note.isPinned);
    setViewMode("edit");
  }

  function handleDeleteNote(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = savedNotes.filter((n) => n.id !== id);
    setSavedNotes(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    if (activeNoteId === id) {
      handleNewNote();
    }
    toast.success("Note removed");
  }

  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const filteredNotes = savedNotes.filter((n) =>
    searchQuery ? n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Top Switcher: Edit Note vs Recent Notes */}
      <div className="flex items-center justify-between text-[10px] flex-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className={cn(
              "px-2 py-0.5 rounded font-semibold transition-colors",
              viewMode === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1",
              viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-2.5 w-2.5" />
            <span>Notes ({savedNotes.length})</span>
          </button>
        </div>

        {viewMode === "edit" ? (
          <div className="flex items-center gap-1 text-[9px] font-mono">
            {saveStatus === "saving" && <span className="text-amber-500">Saving…</span>}
            {saveStatus === "saved" && (
              <span className="text-emerald-500 flex items-center gap-0.5">
                <Check className="h-2.5 w-2.5" /> Saved
              </span>
            )}
            {saveStatus === "unsaved" && <span className="text-muted-foreground">Unsaved</span>}
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={handleNewNote} className="h-5 px-1.5 text-[10px] gap-0.5">
            <Plus className="h-2.5 w-2.5" /> New Note
          </Button>
        )}
      </div>

      {viewMode === "edit" ? (
        <>
          {/* Note Destination Selector */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <label className="text-muted-foreground shrink-0">Type:</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as any)}
              className="h-6 px-1.5 rounded bg-muted/50 border border-border text-[10px] text-foreground focus:outline-hidden"
            >
              <option value="draft">Temporary Draft</option>
              <option value="journal">Journal Note</option>
              <option value="instrument">Instrument-Linked</option>
              <option value="session">Session-Linked</option>
              <option value="strategy">Strategy-Linked</option>
            </select>

            {destination === "instrument" && (
              <select
                value={linkedEntity}
                onChange={(e) => setLinkedEntity(e.target.value)}
                className="h-6 px-1.5 rounded bg-muted/50 border border-border text-[10px] text-foreground focus:outline-hidden font-mono"
              >
                {TOP_INSTRUMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {destination === "session" && (
              <select
                value={linkedEntity}
                onChange={(e) => setLinkedEntity(e.target.value)}
                className="h-6 px-1.5 rounded bg-muted/50 border border-border text-[10px] text-foreground focus:outline-hidden"
              >
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {destination === "strategy" && (
              <select
                value={linkedEntity}
                onChange={(e) => setLinkedEntity(e.target.value)}
                className="h-6 px-1.5 rounded bg-muted/50 border border-border text-[10px] text-foreground focus:outline-hidden max-w-[110px] truncate"
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={cn("p-1 rounded ml-auto transition-colors", isPinned ? "text-amber-500" : "text-muted-foreground/60 hover:text-foreground")}
              title={isPinned ? "Unpin note" : "Pin note"}
            >
              <Pin className="h-3 w-3" />
            </button>
          </div>

          {/* Title Input */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title or setup idea…"
            className="h-6 text-xs px-2"
          />

          {/* Content Textarea */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Capture market observation, key price levels, psychological check, or reminder…"
            rows={4}
            className="text-xs p-2 resize-none leading-relaxed flex-1 min-h-[90px]"
          />

          {/* Bottom Controls */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground flex-none">
            <span className="font-mono">
              {wordCount} words · {charCount} chars
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToList}
                className="h-6 px-2 text-[10px] gap-1"
              >
                <Save className="h-2.5 w-2.5" />
                <span>Save</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSendToJournal}
                className="h-6 px-2 text-[10px] gap-1 bg-primary text-primary-foreground"
              >
                <BookOpen className="h-2.5 w-2.5" />
                <span>To Journal</span>
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* Saved Notes List / Search */
        <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2 top-2 text-muted-foreground/60" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quick notes…"
              className="h-7 text-xs pl-7"
            />
          </div>

          {filteredNotes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-4">No saved quick notes yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {filteredNotes.map((note) => (
                <li
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className="p-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 font-medium text-foreground text-xs truncate">
                      {note.isPinned && <Pin className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                      <span className="truncate">{note.title}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                      {note.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNote(note.id, e)}
                    className="p-1 text-muted-foreground hover:text-rose-500 rounded shrink-0"
                    title="Delete note"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
