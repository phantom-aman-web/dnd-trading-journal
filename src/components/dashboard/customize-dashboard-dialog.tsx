"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useDashboardLayout,
  type DashboardWidgetConfig,
  type WidgetSize,
} from "@/lib/dashboard-layout-store";
import {
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CustomizeDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomizeDashboardDialog({
  open,
  onOpenChange,
}: CustomizeDashboardDialogProps) {
  const {
    widgets,
    toggleVisibility,
    setSize,
    moveWidget,
    reorderWidgets,
    resetToDefault,
    getSortedWidgets,
  } = useDashboardLayout();

  const sortedWidgets = getSortedWidgets();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortedWidgets.findIndex((w) => w.id === active.id);
      const newIndex = sortedWidgets.findIndex((w) => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(sortedWidgets, oldIndex, newIndex);
        reorderWidgets(reordered.map((w) => w.id));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card border-border text-foreground p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold font-jakarta">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <span>Customize Dashboard Layout</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Rearrange, show, hide, and resize your widgets. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 max-h-[60vh] overflow-y-auto space-y-2 pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedWidgets.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedWidgets.map((widget, idx) => (
                <SortableWidgetRow
                  key={widget.id}
                  widget={widget}
                  index={idx}
                  total={sortedWidgets.length}
                  onToggleVisibility={() => toggleVisibility(widget.id)}
                  onSetSize={(size) => setSize(widget.id, size)}
                  onMoveUp={() => moveWidget(widget.id, "up")}
                  onMoveDown={() => moveWidget(widget.id, "down")}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex sm:items-center sm:justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to Default
          </Button>

          <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            <Check className="h-3.5 w-3.5 mr-1" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableWidgetRow({
  widget,
  index,
  total,
  onToggleVisibility,
  onSetSize,
  onMoveUp,
  onMoveDown,
}: {
  widget: DashboardWidgetConfig;
  index: number;
  total: number;
  onToggleVisibility: () => void;
  onSetSize: (size: WidgetSize) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border border-border bg-card/60 hover:bg-muted/40 transition-colors gap-3 select-none",
        isDragging && "opacity-60 shadow-lg border-primary/50 bg-muted z-20",
        !widget.visible && "opacity-50 bg-muted/20"
      )}
    >
      {/* Drag handle & title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground truncate">
              {widget.title}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-mono px-1.5 py-0 h-4.5",
                widget.size === "full" ? "border-purple-500/30 text-purple-600 dark:text-purple-400" : "text-muted-foreground"
              )}
            >
              {widget.size === "full" ? "Full Width" : "Half Width"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
            {widget.description}
          </p>
        </div>
      </div>

      {/* Controls: Size pills, Up/Down, Visibility Switch */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Size toggle */}
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onSetSize("half")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              widget.size === "half"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Half Width (1 column on desktop)"
          >
            1/2
          </button>
          <button
            type="button"
            onClick={() => onSetSize("full")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              widget.size === "full"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Full Width (spans 2 columns)"
          >
            Full
          </button>
        </div>

        {/* Up / Down arrows for quick keyboard/touch ordering */}
        <div className="hidden sm:flex items-center">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            title="Move Up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            title="Move Down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Visibility switch */}
        <div className="ml-1 flex items-center gap-1.5">
          <Switch
            checked={widget.visible}
            onCheckedChange={onToggleVisibility}
            aria-label={`Toggle visibility for ${widget.title}`}
          />
        </div>
      </div>
    </div>
  );
}
