"use client";

/**
 * ImageAnnotator — inline drawing annotation tool for trade evidence images.
 *
 * Renders an image with an SVG overlay on top. Supports:
 * - Select
 * - Freehand pen
 * - Highlighter
 * - Line
 * - Arrow
 * - Rectangle
 * - Circle
 * - Text
 * - Color selection (6 colors)
 * - Stroke width selection (1px, 2px, 4px, 8px)
 * - Undo & Redo
 * - Zoom in, Zoom out, Reset
 * - Clear all with confirmation
 *
 * Coordinates are normalized to 0..1 relative to the image natural dimensions
 * so annotations scale responsively across all screen sizes.
 */

import { useRef, useState } from "react";
import {
  Minus,
  ArrowRight,
  Square,
  Circle,
  Type,
  Undo,
  Redo,
  Trash2,
  MousePointer2,
  PenLine,
  Highlighter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type AnnotationKind =
  | "line"
  | "arrow"
  | "rect"
  | "circle"
  | "text"
  | "pen"
  | "highlighter";

export interface ImageAnnotation {
  id: string;
  kind: AnnotationKind;
  /** Normalized 0..1 coordinates relative to the image's natural size. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  color: string;
  strokeWidth?: number;
}

interface ImageAnnotatorProps {
  src: string;
  alt?: string;
  annotations: ImageAnnotation[];
  onChange: (next: ImageAnnotation[]) => void;
  className?: string;
}

type Tool = "select" | AnnotationKind;

const TOOLS: { key: Tool; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { key: "select", icon: MousePointer2, label: "Select / Move" },
  { key: "pen", icon: PenLine, label: "Freehand Pen" },
  { key: "highlighter", icon: Highlighter, label: "Highlighter" },
  { key: "line", icon: Minus, label: "Line" },
  { key: "arrow", icon: ArrowRight, label: "Arrow" },
  { key: "rect", icon: Square, label: "Rectangle" },
  { key: "circle", icon: Circle, label: "Circle" },
  { key: "text", icon: Type, label: "Text Label" },
];

/** Standard high-contrast annotation colors */
const COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#A855F7", "#FFFFFF"];
const STROKE_WIDTHS = [1, 2, 4, 8];

interface Draft {
  id: string;
  kind: AnnotationKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
}

interface TextDraft {
  id: string;
  x: number;
  y: number;
  color: string;
  value: string;
}

function pointsToSvgPath(points?: Array<{ x: number; y: number }>): string {
  if (!points || points.length === 0) return "";
  const first = points[0];
  let d = `M ${first.x * 100} ${first.y * 100}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x * 100} ${points[i].y * 100}`;
  }
  return d;
}

export function ImageAnnotator({
  src,
  alt = "Trade evidence",
  annotations,
  onChange,
  className,
}: ImageAnnotatorProps) {
  const confirm = useConfirm();
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [zoom, setZoom] = useState<number>(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [history, setHistory] = useState<ImageAnnotation[][]>([]);
  const [redoHistory, setRedoHistory] = useState<ImageAnnotation[][]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  function commit(next: ImageAnnotation[]) {
    setHistory((h) => [...h, annotations]);
    setRedoHistory([]);
    onChange(next);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRedoHistory((r) => [...r, annotations]);
    onChange(prev);
    setSelectedId(null);
  }

  function redo() {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setRedoHistory((r) => r.slice(0, -1));
    setHistory((h) => [...h, annotations]);
    onChange(next);
    setSelectedId(null);
  }

  async function clearAll() {
    if (annotations.length === 0) return;
    const ok = await confirm({
      title: "Clear Annotations",
      description: "Clear all annotations from this image?",
      confirmText: "Clear All",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setHistory((h) => [...h, annotations]);
    setRedoHistory([]);
    onChange([]);
    setSelectedId(null);
  }

  function removeAnnotation(id: string) {
    commit(annotations.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function pointerPos(e: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    const p = pointerPos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (tool === "select") {
      const hit = hitTest(p);
      setSelectedId(hit ? hit.id : null);
      return;
    }

    if (tool === "text") {
      setTextDraft({
        id: Math.random().toString(36).slice(2),
        x: p.x,
        y: p.y,
        color,
        value: "",
      });
      setTool("select");
      return;
    }

    setDraft({
      id: Math.random().toString(36).slice(2),
      kind: tool,
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      points: [{ x: p.x, y: p.y }],
      color,
      strokeWidth,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draft) return;
    const p = pointerPos(e);
    if (draft.kind === "pen" || draft.kind === "highlighter") {
      setDraft((d) =>
        d
          ? {
              ...d,
              x2: p.x,
              y2: p.y,
              points: [...(d.points || []), { x: p.x, y: p.y }],
            }
          : null,
      );
    } else {
      setDraft((d) => (d ? { ...d, x2: p.x, y2: p.y } : null));
    }
  }

  function onPointerUp() {
    if (draft) {
      const dist = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1);
      const isPath = draft.kind === "pen" || draft.kind === "highlighter";
      if (dist > 0.005 || (isPath && (draft.points?.length ?? 0) > 1)) {
        commit([
          ...annotations,
          {
            id: draft.id,
            kind: draft.kind,
            x1: draft.x1,
            y1: draft.y1,
            x2: draft.x2,
            y2: draft.y2,
            points: draft.points,
            color: draft.color,
            strokeWidth: draft.strokeWidth,
          },
        ]);
        setSelectedId(draft.id);
      }
      setDraft(null);
    }
  }

  function hitTest(p: { x: number; y: number }): ImageAnnotation | null {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      if (a.kind === "text") {
        if (Math.abs(p.x - a.x1) < 0.1 && Math.abs(p.y - a.y1) < 0.03) return a;
      } else if (a.kind === "rect") {
        const minX = Math.min(a.x1, a.x2);
        const maxX = Math.max(a.x1, a.x2);
        const minY = Math.min(a.y1, a.y2);
        const maxY = Math.max(a.y1, a.y2);
        if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) return a;
      } else if (a.kind === "circle") {
        const r = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
        const d = Math.hypot(p.x - a.x1, p.y - a.y1);
        if (d <= r + 0.02) return a;
      } else if (a.kind === "pen" || a.kind === "highlighter") {
        if (a.points) {
          for (const pt of a.points) {
            if (Math.hypot(p.x - pt.x, p.y - pt.y) < 0.03) return a;
          }
        }
      } else {
        const d = distToSegment(p, a.x1, a.y1, a.x2, a.y2);
        if (d < 0.02) return a;
      }
    }
    return null;
  }

  function distToSegment(p: { x: number; y: number }, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - x1, p.y - y1);
    let t = ((p.x - x1) * dx + (p.y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  }

  function commitTextDraft() {
    if (!textDraft) return;
    const val = textDraft.value.trim();
    if (val) {
      commit([
        ...annotations,
        {
          id: textDraft.id,
          kind: "text",
          x1: textDraft.x,
          y1: textDraft.y,
          x2: textDraft.x + 0.1,
          y2: textDraft.y + 0.03,
          text: val,
          color: textDraft.color,
          strokeWidth,
        },
      ]);
    }
    setTextDraft(null);
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap rounded-md border border-border bg-muted/40 p-1.5">
        {/* Drawing Tools */}
        <div className="flex items-center gap-0.5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTool(t.key)}
                className={cn(
                  "h-7 w-7 rounded flex items-center justify-center transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted",
                )}
                title={t.label}
                aria-label={t.label}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-border/60 mx-1" />

        {/* Colors */}
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
                if (selectedId) {
                  commit(annotations.map((a) => (a.id === selectedId ? { ...a, color: c } : a)));
                }
              }}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform",
                color === c ? "border-foreground scale-110 shadow-xs" : "border-transparent hover:scale-105",
              )}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>

        <div className="h-4 w-px bg-border/60 mx-1" />

        {/* Stroke Width Selector */}
        <div className="flex items-center gap-1">
          {STROKE_WIDTHS.map((sw) => (
            <button
              key={sw}
              type="button"
              onClick={() => {
                setStrokeWidth(sw);
                if (selectedId) {
                  commit(annotations.map((a) => (a.id === selectedId ? { ...a, strokeWidth: sw } : a)));
                }
              }}
              className={cn(
                "h-6 px-1.5 rounded text-[10px] font-mono border transition-colors",
                strokeWidth === sw
                  ? "bg-foreground text-background border-foreground font-bold"
                  : "bg-background text-muted-foreground border-border hover:bg-muted",
              )}
              title={`${sw}px stroke`}
            >
              {sw}px
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] font-mono w-9 text-center text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          {zoom !== 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(1)}
              title="Reset Zoom"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}

          <div className="h-4 w-px bg-border/60 mx-1" />

          {/* Undo / Redo */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={undo}
            disabled={history.length === 0}
            title="Undo"
          >
            <Undo className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={redo}
            disabled={redoHistory.length === 0}
            title="Redo"
          >
            <Redo className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-loss hover:text-loss"
            onClick={clearAll}
            disabled={annotations.length === 0}
            title="Clear All"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Canvas Container with Zoom/Pan */}
      <div className="overflow-auto border border-border rounded-md bg-muted/10 max-h-[70vh]">
        <div
          ref={containerRef}
          className={cn(
            "relative w-full overflow-hidden select-none touch-none",
            className,
          )}
          style={{
            cursor: tool === "select" ? "default" : "crosshair",
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: "top left",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            src={src}
            alt={alt}
            className="block w-full h-auto pointer-events-none select-none"
            draggable={false}
          />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: "none" }}
          >
            {annotations.map((a) => renderAnnotation(a, a.id === selectedId))}
            {draft && renderDraft(draft)}
          </svg>

          {/* Inline text-input overlay */}
          {textDraft && (
            <div
              className="absolute z-10"
              style={{
                left: `${textDraft.x * 100}%`,
                top: `${textDraft.y * 100}%`,
                transform: "translateY(-100%)",
              }}
            >
              <Input
                autoFocus
                value={textDraft.value}
                onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                onBlur={commitTextDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTextDraft();
                  } else if (e.key === "Escape") {
                    setTextDraft(null);
                  }
                }}
                className="h-7 w-40 text-xs bg-background shadow-md"
                style={{ color: textDraft.color, borderColor: textDraft.color }}
                placeholder="Type text…"
              />
            </div>
          )}

          {/* Delete button for selected annotation */}
          {selectedId && (
            <button
              type="button"
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors shadow-sm"
              onClick={() => removeAnnotation(selectedId)}
              aria-label="Delete annotation"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Annotation rendering helpers
// ---------------------------------------------------------------------------

function renderAnnotation(a: ImageAnnotation, selected: boolean): React.ReactNode {
  const x1 = a.x1 * 100;
  const y1 = a.y1 * 100;
  const x2 = a.x2 * 100;
  const y2 = a.y2 * 100;
  const baseWidth = a.strokeWidth ?? 2;
  const sw = Math.max(0.4, baseWidth * 0.3);
  const stroke = a.color;
  const filter = selected ? "drop-shadow(0 0 1px #fff)" : undefined;

  if (a.kind === "text") {
    return (
      <g key={a.id} style={{ filter }}>
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
          <rect
            x={x1 - 0.5}
            y={y1 - 3}
            width={Math.max(3, (a.text?.length ?? 0) * 1.5)}
            height={4}
            fill="none"
            stroke="#fff"
            strokeWidth={0.2}
            strokeDasharray="0.5 0.5"
          />
        )}
      </g>
    );
  }

  if (a.kind === "pen") {
    return (
      <g key={a.id} style={{ filter }}>
        <path
          d={pointsToSvgPath(a.points)}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {selected && (
          <circle cx={x1} cy={y1} r={1} fill="#fff" stroke="#000" strokeWidth={0.2} />
        )}
      </g>
    );
  }

  if (a.kind === "highlighter") {
    return (
      <g key={a.id} style={{ filter }}>
        <path
          d={pointsToSvgPath(a.points)}
          stroke={stroke}
          strokeWidth={sw * 3}
          strokeOpacity={0.35}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {selected && (
          <circle cx={x1} cy={y1} r={1} fill="#fff" stroke="#000" strokeWidth={0.2} />
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
            transform={`rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI} ${x2} ${y2})`}
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
    const r = Math.hypot(x2 - x1, y2 - y1);
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

function renderDraft(d: Draft): React.ReactNode {
  return renderAnnotation(
    {
      id: d.id,
      kind: d.kind,
      x1: d.x1,
      y1: d.y1,
      x2: d.x2,
      y2: d.y2,
      points: d.points,
      color: d.color,
      strokeWidth: d.strokeWidth,
    },
    false,
  );
}
