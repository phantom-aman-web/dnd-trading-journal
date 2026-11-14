"use client";

import { useState } from "react";
import {
  useWorkspaceStore,
  SUPPORTED_PANEL_VIEWS,
  type WorkspaceLayoutType,
  type WorkspacePanel,
} from "@/lib/workspace-store";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Columns2,
  Columns3,
  Rows2,
  Grid2X2,
  Plus,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
  Link2,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Views to render inside panels
import { TradesLogView } from "@/components/views/trades-log-view";
import { TradeDetailView } from "@/components/views/trade-detail-view";
import { AnalyticsView } from "@/components/views/analytics-view";
import { NoTradesView } from "@/components/views/no-trades-view";
import { PlaybooksView } from "@/components/views/playbooks-view";
import { CalendarView } from "@/components/views/calendar-view";
import { AccountsView } from "@/components/views/accounts-view";

export function MultiPanelWorkspace() {
  const {
    isActive,
    layout,
    panels,
    linkedTradeId,
    setLayout,
    setPanelView,
    addPanel,
    removePanel,
    resetWorkspace,
    setIsActive,
  } = useWorkspaceStore();

  const [activeMobileTab, setActiveMobileTab] = useState<string>(panels[0]?.id || "panel-1");
  const [maximizedPanelId, setMaximizedPanelId] = useState<string | null>(null);

  if (!isActive) return null;

  const maximizedPanel = panels.find((p) => p.id === maximizedPanelId);

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden select-none">
      {/* Workspace Master Toolbar */}
      <div className="h-11 px-4 border-b border-border bg-card/80 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <LayoutGrid className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold font-jakarta text-foreground hidden sm:inline">
            Multi-Panel Workspace
          </span>
          <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
            {panels.length} Active Panels
          </Badge>
          {maximizedPanelId && (
            <Badge variant="secondary" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
              Maximized: {maximizedPanel?.title}
            </Badge>
          )}
        </div>

        {/* Layout Presets */}
        <div className="flex items-center gap-1.5">
          <div className="hidden md:flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setMaximizedPanelId(null);
                setLayout("2-col");
              }}
              className={cn(
                "p-1.5 rounded transition-colors",
                !maximizedPanelId && layout === "2-col" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              title="2 Columns (Split Screen)"
            >
              <Columns2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setMaximizedPanelId(null);
                setLayout("3-col");
              }}
              className={cn(
                "p-1.5 rounded transition-colors",
                !maximizedPanelId && layout === "3-col" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              title="3 Columns (Pro Analysis)"
            >
              <Columns3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setMaximizedPanelId(null);
                setLayout("2-row");
              }}
              className={cn(
                "p-1.5 rounded transition-colors",
                !maximizedPanelId && layout === "2-row" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              title="2 Rows (Stacked)"
            >
              <Rows2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setMaximizedPanelId(null);
                setLayout("4-grid");
              }}
              className={cn(
                "p-1.5 rounded transition-colors",
                !maximizedPanelId && layout === "4-grid" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              title="4 Grid (Quad Matrix)"
            >
              <Grid2X2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {panels.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPanel("tradesLog")}
              className="h-7 text-xs gap-1 hidden sm:flex"
            >
              <Plus className="h-3 w-3" />
              <span>Add Panel</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMaximizedPanelId(null);
              resetWorkspace();
            }}
            className="h-7 text-xs text-muted-foreground hover:text-foreground hidden sm:flex"
            title="Reset layout to default"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsActive(false)}
            className="h-7 text-xs gap-1 font-medium bg-card hover:bg-muted/50"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit Workspace</span>
          </Button>
        </div>
      </div>

      {/* Mobile Tab Switcher (< 1024px) */}
      <div className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 border-b border-border overflow-x-auto">
        {panels.map((p, idx) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveMobileTab(p.id)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
              activeMobileTab === p.id
                ? "bg-card text-foreground font-semibold shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Panel {idx + 1}: {p.title}
          </button>
        ))}
      </div>

      {/* Maximized Panel View (Single full-size view when maximized) */}
      {maximizedPanel ? (
        <div className="flex-1 overflow-hidden h-full">
          <SinglePanelContainer
            panel={maximizedPanel}
            canClose={false}
            isMaximized={true}
            onToggleMaximize={() => setMaximizedPanelId(null)}
            onChangeView={(view) => setPanelView(maximizedPanel.id, view)}
          />
        </div>
      ) : (
        <>
          {/* Main Desktop Grid with Anti-Shrink Horizontal Scroll Container */}
          <div className="hidden lg:block flex-1 overflow-x-auto overflow-y-hidden h-full w-full">
            <div
              className={cn(
                "h-full min-h-0 w-full",
                layout === "2-col" && "grid grid-cols-2 divide-x divide-border min-w-[760px] lg:min-w-full",
                layout === "3-col" && "grid grid-cols-3 divide-x divide-border min-w-[1080px] xl:min-w-full",
                layout === "2-row" && "grid grid-rows-2 divide-y divide-border min-w-full",
                layout === "4-grid" && "grid grid-cols-2 grid-rows-2 divide-x divide-y divide-border min-w-[760px] lg:min-w-full"
              )}
            >
              {panels.map((panel) => (
                <SinglePanelContainer
                  key={panel.id}
                  panel={panel}
                  canClose={panels.length > 1}
                  isMaximized={false}
                  onToggleMaximize={() => setMaximizedPanelId(panel.id)}
                  onClose={() => removePanel(panel.id)}
                  onChangeView={(view) => setPanelView(panel.id, view)}
                />
              ))}
            </div>
          </div>

          {/* Mobile View: Render only active tab */}
          <div className="lg:hidden flex-1 overflow-hidden h-full">
            {panels
              .filter((p) => p.id === activeMobileTab)
              .map((panel) => (
                <SinglePanelContainer
                  key={panel.id}
                  panel={panel}
                  canClose={false}
                  isMaximized={false}
                  onToggleMaximize={() => {}}
                  onChangeView={(view) => setPanelView(panel.id, view)}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function SinglePanelContainer({
  panel,
  canClose,
  isMaximized,
  onToggleMaximize,
  onClose,
  onChangeView,
}: {
  panel: WorkspacePanel;
  canClose: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  onChangeView: (view: ViewKey) => void;
}) {
  const linkedTradeId = useWorkspaceStore((s) => s.linkedTradeId);

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden min-w-0">
      {/* Panel Local Header */}
      <div className="h-9 px-3 border-b border-border bg-card/60 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <select
            value={panel.view}
            onChange={(e) => onChangeView(e.target.value as ViewKey)}
            className="h-6 px-1.5 rounded bg-transparent hover:bg-muted/50 border-0 text-xs font-semibold text-foreground cursor-pointer focus:outline-hidden"
          >
            {SUPPORTED_PANEL_VIEWS.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>

          {panel.view === "tradeDetail" && linkedTradeId && (
            <Badge variant="outline" className="text-[9px] font-mono border-primary/30 text-primary gap-1 py-0 truncate">
              <Link2 className="h-2.5 w-2.5 shrink-0" />
              Linked trade
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={isMaximized ? "Restore split layout" : "Maximize this panel"}
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {canClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Close this panel"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-auto min-w-0">
        <PanelContentRenderer panel={panel} />
      </div>
    </div>
  );
}

function PanelContentRenderer({ panel }: { panel: WorkspacePanel }) {
  const linkedTradeId = useWorkspaceStore((s) => s.linkedTradeId);
  const tradeId = panel.recordId || linkedTradeId;

  switch (panel.view) {
    case "tradesLog":
      return <TradesLogView />;
    case "tradeDetail":
      if (!tradeId) {
        return (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
            <Link2 className="h-6 w-6 mx-auto text-muted-foreground/60" />
            <div className="font-semibold text-foreground">No Trade Selected</div>
            <p className="max-w-xs mx-auto text-[11px] leading-relaxed">
              Click on any trade in the Trades Log panel to inspect its execution and metrics here.
            </p>
          </div>
        );
      }
      return <TradeDetailView tradeId={tradeId} onBack={() => {}} />;
    case "analytics":
      return <AnalyticsView />;
    case "noTrades":
      return <NoTradesView />;
    case "setups":
      return <PlaybooksView />;
    case "calendar":
      return <CalendarView />;
    case "accounts":
      return <AccountsView />;
    default:
      return <div className="p-4 text-xs text-muted-foreground">Select a view for this panel.</div>;
  }
}
