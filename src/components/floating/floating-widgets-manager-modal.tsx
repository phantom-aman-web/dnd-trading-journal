"use client";

import { useState } from "react";
import {
  useFloatingWidgetsStore,
  type FloatingWidgetId,
  type FloatingWidgetConfig,
} from "@/lib/floating-widgets-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  X,
  Sliders,
  RotateCcw,
  Minus,
  Maximize2,
  Grid2X2,
  Search,
  ShieldAlert,
  Calculator,
  Clock,
  FileText,
  Timer,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WIDGET_ICONS: Record<FloatingWidgetId, React.ComponentType<{ className?: string }>> = {
  drawdown_monitor: ShieldAlert,
  quick_risk_calculator: Calculator,
  daily_risk_limit: Clock,
  quick_notes: FileText,
  focus_timer: Timer,
  trading_tip: Sparkles,
  sticky_notes: StickyNote,
};

const CATEGORY_COLORS = {
  risk: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  journal: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  productivity: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  education: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export function FloatingWidgetsManagerModal({ onClose }: { onClose: () => void }) {
  const {
    widgets,
    toggleWidget,
    setWidgetVisible,
    resetAll,
    repositionAll,
    minimizeAll,
    restoreAll,
  } = useFloatingWidgetsStore();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filtered = widgets.filter((w) => {
    if (selectedCategory !== "all" && w.category !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
    }
    return true;
  });

  const visibleCount = widgets.filter((w) => w.visible).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs select-none">
      <Card className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-jakarta text-foreground">Floating Mini Widgets</h2>
              <p className="text-[10px] text-muted-foreground">
                {visibleCount} of {widgets.length} widgets active on workspace
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar: Search & Category Filter */}
        <div className="p-3 border-b border-border bg-muted/10 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search floating widgets…"
                className="h-8 pl-8 text-xs"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 px-2 rounded-md bg-muted/50 border border-border text-xs text-foreground focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              <option value="risk">Risk Management</option>
              <option value="journal">Journaling</option>
              <option value="productivity">Productivity</option>
              <option value="education">Education</option>
            </select>
          </div>

          {/* Quick Layout Actions */}
          <div className="flex items-center justify-between text-[11px] pt-1">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={repositionAll}
                className="h-6 text-[10px] px-2 gap-1"
                title="Arrange all open widgets neatly across the screen"
              >
                <Grid2X2 className="h-2.5 w-2.5" />
                <span>Neat Arrange</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={minimizeAll}
                className="h-6 text-[10px] px-2 gap-1"
              >
                <Minus className="h-2.5 w-2.5" />
                <span>Minimize All</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={restoreAll}
                className="h-6 text-[10px] px-2 gap-1"
              >
                <Maximize2 className="h-2.5 w-2.5" />
                <span>Restore All</span>
              </Button>
            </div>

            <button
              type="button"
              onClick={resetAll}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Widgets List */}
        <div className="p-3 max-h-[50vh] overflow-y-auto space-y-2">
          {filtered.map((widget) => {
            const Icon = WIDGET_ICONS[widget.id] || Sliders;
            return (
              <div
                key={widget.id}
                className={cn(
                  "p-3 rounded-xl border transition-all flex items-start justify-between gap-3",
                  widget.visible
                    ? "bg-primary/5 border-primary/30 shadow-xs"
                    : "bg-card border-border hover:border-border/80"
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-muted/80 border border-border/80 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {widget.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] font-mono py-0 h-4 capitalize", CATEGORY_COLORS[widget.category])}
                      >
                        {widget.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {widget.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-1">
                  <Switch
                    checked={widget.visible}
                    onCheckedChange={(checked) => setWidgetVisible(widget.id, checked)}
                    aria-label={`Toggle ${widget.title}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs">
          <span className="text-muted-foreground text-[11px]">
            Tip: Drag widgets around the screen by their header handle.
          </span>
          <Button size="sm" onClick={onClose} className="h-7 text-xs px-3">
            Done
          </Button>
        </div>
      </Card>
    </div>
  );
}
