"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { useOnboarding, TOTAL_TOUR_STEPS } from "@/lib/onboarding-store";

interface TourStepDef {
  title: string;
  description: string;
  /** Selector for the element to highlight. Empty means "centered, explanation-only". */
  selector?: string;
  /** View to navigate to before showing the step. */
  view?: ViewKey;
}

const TOUR_STEPS: TourStepDef[] = [
  {
    title: "Dashboard",
    description:
      "Your trading command center. See performance, equity and recent activity here.",
    selector: '[data-tour="dashboard"]',
    view: "dashboard",
  },
  {
    title: "Trades Log",
    description:
      "Every trade you record lives here. Filter and review your history.",
    selector: '[data-tour="trades-log"]',
    view: "dashboard",
  },
  {
    title: "Add Trade",
    description:
      "Record the trade as you planned it, then compare it with what actually happened.",
    selector: '[data-tour="add-trade"]',
    view: "dashboard",
  },
  {
    title: "Instrument Selection",
    description:
      "Choose your market. DnD uses the instrument definition for the correct pricing and risk behavior.",
  },
  {
    title: "Strategy + Checklist",
    description:
      "Your strategy determines the rules used to evaluate this setup. Rules become the checklist scored on every trade.",
  },
  {
    title: "Evidence",
    description:
      "Attach chart evidence and organize it by timeframe so you can reconstruct your analysis later.",
  },
  {
    title: "Calendar",
    description:
      "See your trading activity day by day. Click any day to view its trades.",
    selector: '[data-tour="calendar"]',
    view: "dashboard",
  },
  {
    title: "Analytics",
    description:
      "Find patterns in your performance by instrument, strategy, session, behavior and other dimensions.",
    selector: '[data-tour="analytics"]',
    view: "dashboard",
  },
  {
    title: "Settings",
    description:
      "Control your defaults, preferences, appearance and account settings.",
    selector: '[data-tour="settings"]',
    view: "dashboard",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Tour() {
  const { state, tourStep, setTourStep, nextTourStep, prevTourStep, skipTour, finishTour } =
    useOnboarding();
  const { navigate } = useNav();
  const visible = state === "tour";
  const stepDef = TOUR_STEPS[tourStep];
  const [rect, setRect] = useState<Rect | null>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom" | "left" | "right" | "center";
  }>({ top: 0, left: 0, placement: "center" });
  const rafRef = useRef<number | null>(null);

  // Reset to step 0 when tour starts
  useEffect(() => {
    if (visible && tourStep >= TOTAL_TOUR_STEPS) setTourStep(0);
  }, [visible, tourStep, setTourStep]);

  // Navigate to the appropriate view before measuring
  useEffect(() => {
    if (!visible || !stepDef) return;
    if (stepDef.view) navigate(stepDef.view);
  }, [visible, stepDef, navigate]);

  const measure = useCallback(() => {
    if (!visible || !stepDef) return;
    const panelW = Math.min(360, window.innerWidth - 24);
    const panelH = 220;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const margin = 12;

    // Helper to produce a true viewport-centered position.
    const centered = () => ({
      top: Math.max(margin, Math.min(viewportH - panelH - margin, (viewportH - panelH) / 2)),
      left: Math.max(margin, (viewportW - panelW) / 2),
      placement: "center" as const,
    });

    if (!stepDef.selector) {
      setRect(null);
      setPanelPos(centered());
      return;
    }
    const el = document.querySelector(stepDef.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      setPanelPos(centered());
      return;
    }
    // If the element is hidden (mobile sidebar, collapsed drawer, etc.),
    // fall back to a centered explanation so we never highlight a 0x0 box.
    const pre = el.getBoundingClientRect();
    const visibleEl = pre.width > 1 && pre.height > 1;
    if (!visibleEl) {
      setRect(null);
      setPanelPos(centered());
      return;
    }
    // Scroll the element into view first so it's actually measurable.
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    // Give the scroll a tick to settle.
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const pad = 6;
      const newRect = {
        top: r.top - pad,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      };
      setRect(newRect);

      const spaceBelow = viewportH - (r.bottom + pad);
      const spaceAbove = r.top - pad;
      const spaceRight = viewportW - (r.right + pad);
      const spaceLeft = r.left - pad;

      // Detect a sidebar target: element lives in the left ~320px column.
      // When so, prefer placing the panel to the RIGHT of the target so we
      // don't cover the other sidebar tabs below the highlighted one.
      const isSidebarTarget = r.right < 320 && spaceRight >= panelW + margin;

      let placement: "top" | "bottom" | "left" | "right" | "center";
      let top: number = 0;
      let left: number = 0;

      if (isSidebarTarget) {
        placement = "right";
        left = r.right + pad + margin;
        // Vertically center the panel against the target, clamped into view.
        top = r.top + r.height / 2 - panelH / 2;
        top = Math.max(margin, Math.min(viewportH - panelH - margin, top));
      } else if (spaceBelow >= panelH + margin) {
        placement = "bottom";
        top = r.bottom + pad + margin;
      } else if (spaceAbove >= panelH + margin) {
        placement = "top";
        top = r.top - pad - panelH - margin;
      } else if (spaceRight >= panelW + margin) {
        placement = "right";
        left = r.right + pad + margin;
        top = Math.max(margin, Math.min(viewportH - panelH - margin, r.top + r.height / 2 - panelH / 2));
      } else if (spaceLeft >= panelW + margin) {
        placement = "left";
        left = r.left - pad - panelW - margin;
        top = Math.max(margin, Math.min(viewportH - panelH - margin, r.top + r.height / 2 - panelH / 2));
      } else {
        setPanelPos(centered());
        return;
      }

      // Horizontal alignment for top/bottom placements: center on the
      // element, then clamp into the viewport.
      if (placement === "bottom" || placement === "top") {
        const centerX = r.left + r.width / 2;
        left = centerX - panelW / 2;
        if (left < margin) left = margin;
        if (left + panelW > viewportW - margin) left = viewportW - panelW - margin;
      }

      setPanelPos({ top, left, placement });
    });
  }, [visible, stepDef]);

  // Re-measure on step change, scroll, resize.
  useEffect(() => {
    if (!visible) return;
    measure();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, measure]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipTour();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (tourStep === TOTAL_TOUR_STEPS - 1) finishTour();
        else nextTourStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevTourStep();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, tourStep, nextTourStep, prevTourStep, skipTour, finishTour]);

  if (!visible || !stepDef) return null;

  const isLast = tourStep === TOTAL_TOUR_STEPS - 1;

  // Spotlight overlay: clip-path with a "hole" around rect (if any).
  const overlayStyle: React.CSSProperties = rect
    ? {
        clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.left}px 0, ${rect.left}px ${rect.top + rect.height}px, ${rect.left + rect.width}px ${rect.top + rect.height}px, ${rect.left + rect.width}px ${rect.top}px, ${rect.left}px ${rect.top}px)`,
      }
    : {};

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-[100] pointer-events-none"
    >
      {/* Spotlight overlay */}
      <div
        className="absolute inset-0 bg-black/55 transition-[clip-path] duration-200"
        style={overlayStyle}
        aria-hidden="true"
      />

      {/* Highlight ring */}
      {rect && (
        <div
          className="absolute rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background pointer-events-none transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          aria-hidden="true"
        />
      )}

      {/* Floating panel — positioned with absolute coordinates (no translate
          tricks) so every placement, including center, lands inside the viewport. */}
      <div
        className="absolute pointer-events-auto w-[min(360px,calc(100vw-24px))] rounded-xl border border-border bg-card text-card-foreground shadow-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
        style={{
          top: panelPos.top,
          left: panelPos.left,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {tourStep + 1} of {TOTAL_TOUR_STEPS}
              </Badge>
              {stepDef.selector && (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {stepDef.view ? stepDef.view : "info"}
                </Badge>
              )}
              {!stepDef.selector && (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  info
                </Badge>
              )}
            </div>
            <h3 id="tour-title" className="mt-1.5 text-base font-semibold tracking-tight">
              {stepDef.title}
            </h3>
          </div>
          <button
            aria-label="Skip tour"
            onClick={skipTour}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {stepDef.description}
          </p>
        </div>

        {/* Footer — compact progress bar instead of 11 dots so the Next
            button can never overflow the panel on narrow widths. */}
        <div className="flex items-center gap-3 border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevTourStep}
            disabled={tourStep === 0}
            className="text-muted-foreground shrink-0"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {/* Flexible progress track that absorbs leftover width. */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${((tourStep + 1) / TOTAL_TOUR_STEPS) * 100}%`,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
              {tourStep + 1}/{TOTAL_TOUR_STEPS}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" onClick={skipTour} className="text-muted-foreground">
              Skip
            </Button>
            {isLast ? (
              <Button size="sm" onClick={finishTour}>
                <Check className="h-4 w-4" /> Finish
              </Button>
            ) : (
              <Button size="sm" onClick={nextTourStep}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Completion screen — shown ONLY in the instant after finishTour() runs,
// using the non-persisted tourJustFinished flag. On refresh the flag is
// false, so this modal never re-appears for users who already finished.
export function TourCompletion() {
  const { tourJustFinished, dismissCompletion } = useOnboarding();
  const { navigate } = useNav();
  const visible = tourJustFinished;

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissCompletion();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, dismissCompletion]);

  if (!visible) return null;

  const WORKFLOW = [
    "PLAN",
    "TRADE",
    "DOCUMENT",
    "REVIEW",
    "ANALYZE",
    "IMPROVE",
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-done-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-xl animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-profit/10 text-profit">
            <Check className="h-6 w-6" />
          </div>
          <h3 id="tour-done-title" className="text-xl font-semibold tracking-tight">
            You are ready to trade with DnD
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The DnD workflow connects every part of your trading:
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {WORKFLOW.map((w, i) => (
              <span key={w} className="inline-flex items-center gap-1.5">
                <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-mono">
                  {w}
                </span>
                {i < WORKFLOW.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 border-t border-border p-4">
          <Button
            className="flex-1"
            onClick={() => {
              dismissCompletion();
              navigate("dashboard");
            }}
          >
            Create Your First Daily Plan
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => dismissCompletion()}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
