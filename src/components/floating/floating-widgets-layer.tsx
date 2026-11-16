"use client";

import { useState, useEffect, useRef } from "react";
import {
  useFloatingWidgetsStore,
  type FloatingWidgetId,
  type FloatingWidgetConfig,
  WIDGET_SIZE_CONSTRAINTS,
} from "@/lib/floating-widgets-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GripHorizontal,
  Minus,
  Maximize2,
  X,
  Sliders,
  Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";

// 7 Approved Widgets
import { DrawdownMonitorWidgetContent } from "@/components/floating/drawdown-monitor-widget";
import { QuickRiskCalculatorWidgetContent } from "@/components/floating/quick-risk-calculator-widget";
import { DailyRiskLimitWidgetContent } from "@/components/floating/daily-risk-limit-widget";
import { QuickNotesWidgetContent } from "@/components/floating/quick-notes-widget";
import { FocusTimerWidgetContent } from "@/components/floating/focus-timer-widget";
import { RandomTradingTipWidgetContent } from "@/components/floating/random-trading-tip-widget";
import { StickyNotesWidgetContent } from "@/components/floating/sticky-notes-widget";
import { FloatingWidgetsManagerModal } from "@/components/floating/floating-widgets-manager-modal";

export function FloatingWidgetsLayer() {
  const [mounted, setMounted] = useState(false);
  const { widgets, managerOpen, setManagerOpen } = useFloatingWidgetsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const activeWidgets = widgets.filter((w) => w.visible);

  return (
    <>
      {/* Desktop Draggable Layer (Hidden on tiny mobile screens to avoid obscuring UI) */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden hidden sm:block">
        {activeWidgets.map((w) => (
          <FloatingWidgetContainer key={w.id} config={w} />
        ))}
      </div>

      {/* Mobile Docked Bar (when widgets are active on small screens) */}
      {activeWidgets.length > 0 && (
        <div className="fixed bottom-14 left-2 right-2 z-40 sm:hidden pointer-events-auto">
          <div className="bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-xl p-2.5 max-h-72 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-border text-xs font-semibold">
              <span className="text-[11px] font-bold text-foreground">Active Mini Widgets</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManagerOpen(true)}
                className="h-5 px-1.5 text-[10px]"
              >
                Manage
              </Button>
            </div>
            {activeWidgets.map((w) => (
              <div key={w.id} className="p-2 rounded-lg bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-foreground">{w.title}</span>
                  <button
                    type="button"
                    onClick={() => useFloatingWidgetsStore.getState().setWidgetVisible(w.id, false)}
                    className="text-muted-foreground hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <FloatingWidgetContent id={w.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Widgets Manager Dialog */}
      {managerOpen && <FloatingWidgetsManagerModal onClose={() => setManagerOpen(false)} />}
    </>
  );
}

function FloatingWidgetContainer({ config }: { config: FloatingWidgetConfig }) {
  const { toggleMinimize, setWidgetVisible, setPosition, setSize, bringToFront, togglePin } =
    useFloatingWidgetsStore();

  const constraints = WIDGET_SIZE_CONSTRAINTS[config.id] || {
    minWidth: 260,
    maxWidth: 600,
    minHeight: 180,
    maxHeight: 600,
    defaultWidth: 320,
    defaultHeight: 260,
  };

  const [pos, setPos] = useState({ x: config.x, y: config.y });
  const [size, setSizeState] = useState({
    width: config.width || constraints.defaultWidth,
    height: config.height || constraints.defaultHeight,
  });

  // Sync state if config changes externally (e.g. repositionAll / resetAll)
  useEffect(() => {
    setPos({ x: config.x, y: config.y });
  }, [config.x, config.y]);

  useEffect(() => {
    setSizeState({
      width: config.width || constraints.defaultWidth,
      height: config.height || constraints.defaultHeight,
    });
  }, [config.width, config.height, constraints.defaultWidth, constraints.defaultHeight]);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const isResizing = useRef(false);
  const resizeDir = useRef<"se" | "e" | "s" | null>(null);
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Separate Drag-to-Move (Header Only)
  function handleDragStart(e: React.MouseEvent | React.TouchEvent) {
    if (config.isPinned) return; // Pinned widgets don't move
    bringToFront(config.id);
    isDragging.current = true;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    dragStart.current = {
      x: clientX - pos.x,
      y: clientY - pos.y,
    };

    function handleDragMove(ev: MouseEvent | TouchEvent) {
      if (!isDragging.current) return;
      const curX = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const curY = "touches" in ev ? ev.touches[0].clientY : ev.clientY;

      let rawX = curX - dragStart.current.x;
      let rawY = curY - dragStart.current.y;

      const snapMargin = 16;
      const snapThreshold = 24;
      const widgetW = config.minimized ? 180 : size.width;
      const widgetH = config.minimized ? 32 : size.height;

      // Snap to left or right viewport edge
      if (rawX < snapThreshold) {
        rawX = snapMargin;
      } else if (rawX + widgetW > window.innerWidth - snapThreshold) {
        rawX = window.innerWidth - widgetW - snapMargin;
      }

      // Snap to top (below top bar) or bottom edge
      if (rawY < 48 + snapThreshold) {
        rawY = 48 + snapMargin;
      } else if (rawY + widgetH > window.innerHeight - snapThreshold) {
        rawY = window.innerHeight - widgetH - snapMargin;
      }

      const nextX = Math.max(snapMargin, Math.min(rawX, window.innerWidth - 60));
      const nextY = Math.max(48, Math.min(rawY, window.innerHeight - 36));
      setPos({ x: nextX, y: nextY });
    }

    function handleDragEnd() {
      if (isDragging.current) {
        isDragging.current = false;
        // Collision mitigation: nudge if exactly overlapping another active widget header
        const allWidgets = useFloatingWidgetsStore.getState().widgets;
        let finalX = pos.x;
        let finalY = pos.y;
        for (const other of allWidgets) {
          if (other.id !== config.id && other.visible) {
            if (Math.abs(other.x - finalX) < 18 && Math.abs(other.y - finalY) < 18) {
              finalY = Math.min(window.innerHeight - 80, finalY + 32);
              setPos({ x: finalX, y: finalY });
              break;
            }
          }
        }
        setPosition(config.id, finalX, finalY);
      }
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    }

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove);
    window.addEventListener("touchend", handleDragEnd);
  }

  // Separate Drag-to-Resize (Handles Only)
  function handleResizeStart(direction: "se" | "e" | "s", e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation(); // Never trigger drag-to-move
    bringToFront(config.id);
    isResizing.current = true;
    resizeDir.current = direction;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    resizeStart.current = {
      x: clientX,
      y: clientY,
      width: size.width,
      height: size.height,
    };

    let currentW = size.width;
    let currentH = size.height;

    function handleResizeMove(ev: MouseEvent | TouchEvent) {
      if (!isResizing.current) return;
      const curX = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const curY = "touches" in ev ? ev.touches[0].clientY : ev.clientY;

      const deltaX = curX - resizeStart.current.x;
      const deltaY = curY - resizeStart.current.y;

      let nextWidth = resizeStart.current.width;
      let nextHeight = resizeStart.current.height;

      if (resizeDir.current === "se" || resizeDir.current === "e") {
        nextWidth = Math.max(
          constraints.minWidth,
          Math.min(constraints.maxWidth, resizeStart.current.width + deltaX)
        );
      }

      if (resizeDir.current === "se" || resizeDir.current === "s") {
        nextHeight = Math.max(
          constraints.minHeight,
          Math.min(constraints.maxHeight, resizeStart.current.height + deltaY)
        );
      }

      currentW = nextWidth;
      currentH = nextHeight;
      setSizeState({ width: nextWidth, height: nextHeight });
    }

    function handleResizeEnd() {
      if (isResizing.current) {
        isResizing.current = false;
        resizeDir.current = null;
        setSize(config.id, currentW, currentH);
      }
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("touchmove", handleResizeMove);
      window.removeEventListener("touchend", handleResizeEnd);
    }

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    window.addEventListener("touchmove", handleResizeMove);
    window.addEventListener("touchend", handleResizeEnd);
  }

  return (
    <div
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        width: config.minimized ? "auto" : `${size.width}px`,
        height: config.minimized ? "auto" : `${size.height}px`,
      }}
      className="absolute pointer-events-auto transition-shadow duration-150 select-none flex flex-col"
    >
      <Card
        className={cn(
          "bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-xl overflow-hidden transition-all flex flex-col h-full relative",
          config.isPinned && "ring-1 ring-primary/40"
        )}
      >
        {/* Widget Header with Drag Handle & Keyboard Movement */}
        <div
          tabIndex={0}
          onFocus={() => bringToFront(config.id)}
          onKeyDown={(e) => {
            if (config.isPinned) return;
            const step = 16;
            let newX = pos.x;
            let newY = pos.y;
            if (e.key === "ArrowLeft") { newX -= step; e.preventDefault(); }
            else if (e.key === "ArrowRight") { newX += step; e.preventDefault(); }
            else if (e.key === "ArrowUp") { newY -= step; e.preventDefault(); }
            else if (e.key === "ArrowDown") { newY += step; e.preventDefault(); }
            else if (e.key === "m" || e.key === "M") { toggleMinimize(config.id); e.preventDefault(); }
            else if (e.key === "p" || e.key === "P") { togglePin(config.id); e.preventDefault(); }
            else if (e.key === "Escape") { (e.target as HTMLElement)?.blur(); }

            if (newX !== pos.x || newY !== pos.y) {
              const widgetW = config.minimized ? 180 : size.width;
              const widgetH = config.minimized ? 32 : size.height;
              const clampedX = Math.max(16, Math.min(newX, window.innerWidth - widgetW - 16));
              const clampedY = Math.max(48, Math.min(newY, window.innerHeight - widgetH - 16));
              setPos({ x: clampedX, y: clampedY });
              setPosition(config.id, clampedX, clampedY);
            }
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          role="region"
          aria-label={`${config.title} widget header`}
          className={cn(
            "h-8 px-2.5 bg-muted/60 border-b border-border flex items-center justify-between text-xs font-semibold text-foreground group flex-none select-none focus:outline-none focus:ring-1 focus:ring-primary/60",
            config.isPinned ? "cursor-default" : "cursor-move"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {!config.isPinned && (
              <GripHorizontal className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
            )}
            {config.isPinned && (
              <Pin className="h-2.5 w-2.5 text-primary shrink-0 fill-current" />
            )}
            <span className="truncate text-[11px] font-bold font-jakarta">{config.title}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-label={config.isPinned ? `Unpin ${config.title} position` : `Pin ${config.title} position`}
              onClick={(e) => {
                e.stopPropagation();
                togglePin(config.id);
              }}
              className={cn(
                "p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                config.isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              title={config.isPinned ? "Unpin widget position" : "Pin widget position"}
            >
              <Pin className={cn("h-2.5 w-2.5", config.isPinned && "fill-current")} />
            </button>

            <button
              type="button"
              aria-label={config.minimized ? `Restore ${config.title}` : `Minimize ${config.title}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleMinimize(config.id);
              }}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title={config.minimized ? "Restore" : "Minimize"}
            >
              {config.minimized ? <Maximize2 className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
            </button>

            <button
              type="button"
              aria-label={`Close ${config.title} widget`}
              onClick={(e) => {
                e.stopPropagation();
                setWidgetVisible(config.id, false);
              }}
              className="p-0.5 rounded text-muted-foreground hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="Close widget"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>

        {/* Widget Content (Hidden when minimized; Scrollable flex area when open) */}
        {!config.minimized && (
          <div className="flex-1 min-h-0 overflow-y-auto p-3 text-xs">
            <FloatingWidgetContent id={config.id} />
          </div>
        )}

        {/* Visible Subtle Resize Handles (Active only when not minimized) */}
        {!config.minimized && (
          <>
            {/* Right edge width handle */}
            <div
              onMouseDown={(e) => handleResizeStart("e", e)}
              onTouchStart={(e) => handleResizeStart("e", e)}
              className="absolute top-8 bottom-3 right-0 w-2.5 cursor-ew-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-20"
              title="Drag horizontally to resize width"
            />

            {/* Bottom edge height handle */}
            <div
              onMouseDown={(e) => handleResizeStart("s", e)}
              onTouchStart={(e) => handleResizeStart("s", e)}
              className="absolute bottom-0 left-0 right-3.5 h-2.5 cursor-ns-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-20"
              title="Drag vertically to resize height"
            />

            {/* Bottom-right corner handle */}
            <div
              onMouseDown={(e) => handleResizeStart("se", e)}
              onTouchStart={(e) => handleResizeStart("se", e)}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 text-muted-foreground/40 hover:text-primary active:text-primary transition-colors z-30 group"
              title="Drag corner to resize widget"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" className="fill-current opacity-70 group-hover:opacity-100">
                <circle cx="6.5" cy="1.5" r="0.75" />
                <circle cx="6.5" cy="4.5" r="0.75" />
                <circle cx="3.5" cy="4.5" r="0.75" />
                <circle cx="6.5" cy="7.5" r="0.75" />
                <circle cx="3.5" cy="7.5" r="0.75" />
                <circle cx="0.5" cy="7.5" r="0.75" />
              </svg>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function FloatingWidgetContent({ id }: { id: FloatingWidgetId }) {
  switch (id) {
    case "drawdown_monitor":
      return <DrawdownMonitorWidgetContent />;
    case "quick_risk_calculator":
      return <QuickRiskCalculatorWidgetContent />;
    case "daily_risk_limit":
      return <DailyRiskLimitWidgetContent />;
    case "quick_notes":
      return <QuickNotesWidgetContent />;
    case "focus_timer":
      return <FocusTimerWidgetContent />;
    case "trading_tip":
      return <RandomTradingTipWidgetContent />;
    case "sticky_notes":
      return <StickyNotesWidgetContent />;
    default:
      return <div className="text-xs text-muted-foreground">Widget unavailable.</div>;
  }
}
