"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Maximize,
  Pencil, Undo, Trash2, MousePointer2, Type,
  Square, Circle, Minus, ArrowRight, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  kind: string;
  url?: string;
  caption?: string;
  filename: string;
  annotations?: any[];
}

interface ImageViewerProps {
  mediaItems: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

type Tool = "select" | "line" | "arrow" | "rect" | "circle" | "text";
type DragMode = "none" | "creating" | "moving" | "resizing";

interface Annotation {
  id: string;
  kind: Tool;
  x1: number; y1: number; // normalized 0-1
  x2: number; y2: number;
  text?: string;
  color: string;
  strokeWidth: number;
}

const COLORS = [
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF",
  "#FF9F40", "#C77DFF", "#FFFFFF", "#000000",
];
const STROKE_WIDTHS = [1, 2, 3, 5];

export function ImageViewer({ mediaItems, initialIndex, onClose }: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [showToolbar, setShowToolbar] = useState(true);
  // Toggle to show/hide annotations (show original image without annotations)
  const [showAnnotations, setShowAnnotations] = useState(true);
  // Tracks whether annotations have been modified since the last successful
  // save. When true, navigation away (close / prev / next / arrow keys) is
  // gated behind a confirm() that offers to save first. Reset to false
  // both on initial load and after saveAnnotations succeeds.
  const [dirty, setDirty] = useState(false);
  // Skip the next annotations-effect so the initial load (which calls
  // setAnnotations with the existing list) doesn't mark the viewer dirty.
  const skipDirtyRef = useRef(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const item = mediaItems[index];
  const url = item?.url;

  useEffect(() => {
    // Load existing annotations from media item
    // If annotations are already provided (e.g., from trade detail), use them.
    // Otherwise, fetch from the API.
    const loadAnnotations = async () => {
      let anns = item?.annotations ?? [];
      // If no annotations provided but we have an ID, try fetching from API
      if (anns.length === 0 && item?.id) {
        try {
          const res = await fetch(`/api/media/${item.id}`);
          if (res.ok) {
            const data = await res.json();
            anns = data.annotations ?? [];
          }
        } catch { /* ignore */ }
      }
      const existing = anns.map((a: any) => {
        const payload = typeof a.payloadJson === "string" ? JSON.parse(a.payloadJson) : a.payloadJson ?? {};
        return {
          id: a.id,
          kind: a.kind === "line" ? "line" : a.kind === "arrow" ? "arrow" : a.kind === "rect" ? "rect" : a.kind === "circle" ? "circle" : a.kind === "text" ? "text" : "line",
          x1: payload.x1 ?? 0, y1: payload.y1 ?? 0,
          x2: payload.x2 ?? 0, y2: payload.y2 ?? 0,
          text: payload.text,
          color: payload.color ?? COLORS[0],
          strokeWidth: payload.strokeWidth ?? 2,
        } as Annotation;
      });
      // Suppress the dirty flag for this setAnnotations call (it's the initial
      // load, not a user edit).
      skipDirtyRef.current = true;
      setAnnotations(existing);
      setDirty(false);
      setZoom(1);
      setTool("select");
      setSelectedId(null);
      setDraft(null);
      setHistory([]);
    };
    loadAnnotations();
  }, [index, item]);

  // Mark dirty whenever `annotations` changes, EXCEPT when the change was
  // the initial load (gated by skipDirtyRef). This catches create / move /
  // resize / delete / color / stroke changes uniformly without instrumenting
  // every setAnnotations call site.
  useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setDirty(true);
  }, [annotations]);

  const deleteSelectedRef = useRef<() => void>(() => {});
  const undoRef = useRef<() => void>(() => {});
  const maybeNavigateRef = useRef<(target: number | "close") => Promise<void>>(async () => {});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedId) { setSelectedId(null); return; }
        maybeNavigateRef.current("close");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        maybeNavigateRef.current(Math.max(0, index - 1));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        maybeNavigateRef.current(Math.min(mediaItems.length - 1, index + 1));
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && tool === "select") {
        e.preventDefault();
        deleteSelectedRef.current();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undoRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // Re-bind whenever navigation-relevant state changes: index (so ArrowLeft/
    // Right compute the right target), dirty (so the unsaved-annotations
    // check is current), and the same deps the original handler used.
    // `maybeNavigateRef` is a stable ref so the handler always reads the
    // latest version (assigned below on every render).
  }, [mediaItems.length, onClose, selectedId, tool, index, dirty]);

  function pushHistory() {
    setHistory((h) => [...h, annotations]);
    if (history.length > 50) setHistory((h) => h.slice(-50));
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setAnnotations(prev);
    setSelectedId(null);
    setHistory((h) => h.slice(0, -1));
  }
  undoRef.current = undo;

  function pointerPos(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!url) return;
    const p = pointerPos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (tool === "select") {
      // Check if clicking on a resize handle of selected annotation
      if (selectedId) {
        const sel = annotations.find(a => a.id === selectedId);
        if (sel) {
          const handle = getResizeHandle(sel, p);
          if (handle) {
            setDragMode("resizing");
            setDragStart(p);
            return;
          }
        }
      }
      // Check if clicking on an annotation
      const hit = hitTestAnnotation(p);
      if (hit) {
        setSelectedId(hit.id);
        setDragMode("moving");
        setDragStart(p);
      } else {
        setSelectedId(null);
        setDragMode("none");
      }
      return;
    }

    if (tool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        pushHistory();
        const newAnn: Annotation = {
          id: Math.random().toString(36).slice(2),
          kind: "text",
          x1: p.x, y1: p.y, x2: p.x + 0.1, y2: p.y + 0.03,
          text,
          color,
          strokeWidth,
        };
        setAnnotations((a) => [...a, newAnn]);
        setSelectedId(newAnn.id);
      }
      setTool("select");
      return;
    }

    // Drawing mode
    pushHistory();
    setDragMode("creating");
    setDragStart(p);
    setDraft({
      id: Math.random().toString(36).slice(2),
      kind: tool,
      x1: p.x, y1: p.y, x2: p.x, y2: p.y,
      color,
      strokeWidth,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragMode === "none") return;
    const p = pointerPos(e);

    if (dragMode === "creating" && draft) {
      setDraft({ ...draft, x2: p.x, y2: p.y });
      return;
    }

    if (dragMode === "moving" && selectedId && dragStart) {
      const dx = p.x - dragStart.x;
      const dy = p.y - dragStart.y;
      setAnnotations((arr) => arr.map((a) => {
        if (a.id !== selectedId) return a;
        return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
      }));
      setDragStart(p);
      return;
    }

    if (dragMode === "resizing" && selectedId && dragStart) {
      setAnnotations((arr) => arr.map((a) => {
        if (a.id !== selectedId) return a;
        return { ...a, x2: p.x, y2: p.y };
      }));
      return;
    }
  }

  function onPointerUp() {
    if (dragMode === "creating" && draft) {
      // Only add if the annotation has meaningful size
      const dist = Math.sqrt(Math.pow(draft.x2 - draft.x1, 2) + Math.pow(draft.y2 - draft.y1, 2));
      if (dist > 0.01) {
        setAnnotations((a) => [...a, draft]);
        setSelectedId(draft.id);
      }
      setDraft(null);
    }
    setDragMode("none");
    setDragStart(null);
  }

  function hitTestAnnotation(p: { x: number; y: number }): Annotation | null {
    // Check in reverse order (topmost first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      if (a.kind === "text") {
        if (Math.abs(p.x - a.x1) < 0.1 && Math.abs(p.y - a.y1) < 0.03) return a;
      } else if (a.kind === "rect") {
        const minX = Math.min(a.x1, a.x2), maxX = Math.max(a.x1, a.x2);
        const minY = Math.min(a.y1, a.y2), maxY = Math.max(a.y1, a.y2);
        if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) return a;
      } else if (a.kind === "circle") {
        const r = Math.sqrt(Math.pow(a.x2 - a.x1, 2) + Math.pow(a.y2 - a.y1, 2));
        const d = Math.sqrt(Math.pow(p.x - a.x1, 2) + Math.pow(p.y - a.y1, 2));
        if (d <= r + 0.01) return a;
      } else {
        // line/arrow: check distance to line segment
        const dist = distToSegment(p.x, p.y, a.x1, a.y1, a.x2, a.y2);
        if (dist < 0.015) return a;
      }
    }
    return null;
  }

  function getResizeHandle(a: Annotation, p: { x: number; y: number }): boolean {
    // Check if clicking near the end point (x2,y2)
    const d = Math.sqrt(Math.pow(p.x - a.x2, 2) + Math.pow(p.y - a.y2, 2));
    return d < 0.03;
  }

  function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
  }

  function deleteSelected() {
    if (!selectedId) return;
    pushHistory();
    setAnnotations((a) => a.filter((x) => x.id !== selectedId));
    setSelectedId(null);
  }
  deleteSelectedRef.current = deleteSelected;

  function updateSelectedColor(newColor: string) {
    if (!selectedId) return;
    setAnnotations((a) => a.map((x) => x.id === selectedId ? { ...x, color: newColor } : x));
  }

  function updateSelectedStroke(w: number) {
    if (!selectedId) return;
    setAnnotations((a) => a.map((x) => x.id === selectedId ? { ...x, strokeWidth: w } : x));
  }

  async function saveAnnotations(): Promise<boolean> {
    const payload = annotations.map((a) => ({
      kind: a.kind,
      payload: {
        x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
        text: a.text,
        color: a.color,
        strokeWidth: a.strokeWidth,
      },
    }));
    const res = await fetch(`/api/media/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setAnnotations", annotations: payload }),
    });
    if (res.ok) {
      toast.success("Annotations saved.");
      setDirty(false);
      return true;
    }
    toast.error("Failed to save annotations.");
    return false;
  }

  /**
   * Gate navigation (close / prev / next) behind an unsaved-annotations
   * check. If `dirty`, prompts the user to save before leaving:
   *   - OK (confirm): save first, then navigate.
   *   - Cancel: don't navigate (abort the action).
   * If not dirty, navigate immediately.
   */
  const maybeNavigate = async (target: number | "close") => {
    if (!dirty) {
      if (target === "close") onClose();
      else setIndex(target);
      return;
    }
    const choice = window.confirm(
      "You have unsaved annotations. Save before leaving?",
    );
    if (choice) {
      const saved = await saveAnnotations();
      if (saved) {
        if (target === "close") onClose();
        else setIndex(target);
      }
      // If save failed, do not navigate — the user can retry or discard.
    }
    // else: user cancelled — do nothing.
  };
  // Expose the latest maybeNavigate to the keyboard effect via a ref so the
  // handler always calls the version that closes over the current `dirty`
  // and `index` state.
  maybeNavigateRef.current = maybeNavigate;

  if (!url) return null;

  const tools: { key: Tool; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { key: "select", icon: MousePointer2, label: "Select" },
    { key: "line", icon: Minus, label: "Line" },
    { key: "arrow", icon: ArrowRight, label: "Arrow" },
    { key: "rect", icon: Square, label: "Rectangle" },
    { key: "circle", icon: Circle, label: "Circle" },
    { key: "text", icon: Type, label: "Text" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" role="dialog" aria-label="Image viewer">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 text-white shrink-0">
        <div className="text-sm truncate max-w-md">{item.filename}</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowToolbar(s => !s)}
            className={cn(showToolbar && "bg-white/10")}
            aria-label="Toggle annotation toolbar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {annotations.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAnnotations(s => !s)}
              className="text-white text-xs h-8"
            >
              {showAnnotations ? "Show Original" : "Show Annotated"}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => maybeNavigate("close")} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative min-h-0">
        {index > 0 && (
          <Button variant="ghost" size="icon" className="absolute left-2 text-white z-10" onClick={() => maybeNavigate(index - 1)} aria-label="Previous">
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}
        <div
          ref={canvasRef}
          className="relative max-w-[90%] max-h-full"
          style={{ cursor: tool === "select" ? "default" : "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            src={url}
            alt={item.caption ?? item.filename}
            className="max-w-full max-h-[70vh] object-contain select-none"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
            draggable={false}
          />
          {/* Annotation overlay — hidden when "show original" is toggled */}
          {showAnnotations && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: "none" }}
            >
              {annotations.map((a) => renderAnnotation(a, a.id === selectedId))}
              {draft && renderAnnotation(draft, false)}
            </svg>
          )}
        </div>
        {index < mediaItems.length - 1 && (
          <Button variant="ghost" size="icon" className="absolute right-2 text-white z-10" onClick={() => maybeNavigate(index + 1)} aria-label="Next">
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}
      </div>

      {/* Annotation toolbar */}
      {showToolbar && (
        <div className="bg-white/10 backdrop-blur px-4 py-2 text-white shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tools */}
            <div className="flex items-center gap-1 bg-black/30 rounded-md p-1">
              {tools.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTool(t.key)}
                    className={cn(
                      "h-8 w-8 rounded flex items-center justify-center transition-colors",
                      tool === t.key ? "bg-white/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10",
                    )}
                    title={t.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>

            {/* Color palette */}
            <div className="flex items-center gap-1 bg-black/30 rounded-md p-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    if (selectedId) updateSelectedColor(c);
                  }}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    color === c ? "border-white scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            {/* Stroke width */}
            <div className="flex items-center gap-1 bg-black/30 rounded-md p-1">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => {
                    setStrokeWidth(w);
                    if (selectedId) updateSelectedStroke(w);
                  }}
                  className={cn(
                    "h-8 px-2 rounded flex items-center justify-center transition-colors",
                    strokeWidth === w ? "bg-white/20" : "hover:bg-white/10",
                  )}
                  title={`Width ${w}`}
                >
                  <div className="rounded-full bg-white" style={{ width: 16, height: w }} />
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 h-8"
                onClick={undo}
                disabled={history.length === 0}
              >
                <Undo className="h-3 w-3" /> Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 h-8"
                onClick={deleteSelected}
                disabled={!selectedId}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
              <Button
                size="sm"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveAnnotations}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Status bar */}
          <div className="text-xs text-white/50 mt-1">
            {tool === "select"
              ? selectedId ? "Annotation selected — drag to move, drag end point to resize, or Delete to remove" : "Click an annotation to select it"
              : `Drawing with ${tool} tool — click and drag on the image`}
          </div>
        </div>
      )}
    </div>
  );
}

function renderAnnotation(a: Annotation, selected: boolean): React.ReactNode {
  const x1 = a.x1 * 100, y1 = a.y1 * 100, x2 = a.x2 * 100, y2 = a.y2 * 100;
  const sw = a.strokeWidth / 2;
  const stroke = a.color;
  const filter = selected ? "drop-shadow(0 0 1px #fff)" : undefined;

  if (a.kind === "text") {
    return (
      <g key={a.id} style={{ filter, pointerEvents: "auto" }}>
        <text
          x={x1}
          y={y1}
          fill={a.color}
          fontSize={3}
          fontWeight="600"
          fontFamily="sans-serif"
          style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 0.3, strokeLinejoin: "round" }}
        >
          {a.text}
        </text>
        {selected && (
          <rect x={x1 - 0.5} y={y1 - 3} width={Math.max(3, a.text!.length * 1.5)} height={4} fill="none" stroke="#fff" strokeWidth={0.2} strokeDasharray="0.5 0.5" />
        )}
      </g>
    );
  }

  if (a.kind === "line" || a.kind === "arrow") {
    return (
      <g key={a.id} style={{ filter }}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {a.kind === "arrow" && (
          <polygon
            points={`${x2},${y2} ${x2 - 2 * Math.sign(x2 - x1)},${y2 - 1} ${x2 - 2 * Math.sign(x2 - x1)},${y2 + 1}`}
            fill={stroke}
            transform={`rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI} ${x2} ${y2})`}
          />
        )}
        {selected && (
          <>
            <circle cx={x1} cy={y1} r={1} fill="#fff" stroke="#000" strokeWidth={0.2} />
            <circle cx={x2} cy={y2} r={1.5} fill="#fff" stroke="#000" strokeWidth={0.2} />
          </>
        )}
      </g>
    );
  }

  if (a.kind === "rect") {
    return (
      <g key={a.id} style={{ filter }}>
        <rect
          x={Math.min(x1, x2)}
          y={Math.min(y1, y2)}
          width={Math.abs(x2 - x1)}
          height={Math.abs(y2 - y1)}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {selected && (
          <>
            <circle cx={x1} cy={y1} r={1} fill="#fff" stroke="#000" strokeWidth={0.2} />
            <circle cx={x2} cy={y2} r={1.5} fill="#fff" stroke="#000" strokeWidth={0.2} />
          </>
        )}
      </g>
    );
  }

  if (a.kind === "circle") {
    const r = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    return (
      <g key={a.id} style={{ filter }}>
        <circle cx={x1} cy={y1} r={r} stroke={stroke} strokeWidth={sw} fill="none" vectorEffect="non-scaling-stroke" />
        {selected && (
          <>
            <circle cx={x1} cy={y1} r={1} fill="#fff" stroke="#000" strokeWidth={0.2} />
            <circle cx={x2} cy={y2} r={1.5} fill="#fff" stroke="#000" strokeWidth={0.2} />
          </>
        )}
      </g>
    );
  }

  return null;
}
