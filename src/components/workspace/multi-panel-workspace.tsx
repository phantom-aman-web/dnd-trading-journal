"use client";

import React, { useState, useEffect } from "react";
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
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
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
  LayoutGrid,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Views to render inside panels
import { DashboardView } from "@/components/views/dashboard-view";
import { TradesLogView } from "@/components/views/trades-log-view";
import { TradeDetailView } from "@/components/views/trade-detail-view";
import { AnalyticsView } from "@/components/views/analytics-view";
import { RiskCalculatorView } from "@/components/views/risk-calculator-view";
import { PlaybooksView } from "@/components/views/playbooks-view";
import { CalendarView } from "@/components/views/calendar-view";
import { AccountsView } from "@/components/views/accounts-view";
import { PropChallengesView } from "@/components/views/prop-challenges-view";
import { TradingTodoView } from "@/components/views/trading-todo-view";
import { SettingsView } from "@/components/views/settings-view";
import { ArchivedView } from "@/components/views/archived-view";
import { BackupView } from "@/components/views/backup-view";

export function MultiPanelWorkspace() {
  const {
    isActive,
    layout,
    panels,
    setLayout,
    setPanelView,
    addPanel,
    removePanel,
    resetWorkspace,
    setIsActive,
  } = useWorkspaceStore();

  const [activeMobileTab, setActiveMobileTab] = useState<string>(panels[0]?.id || "panel-1");
  const [maximizedPanelId, setMaximizedPanelId] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (panels.length > 0 && !panels.some((p) => p.id === activeMobileTab)) {
      setActiveMobileTab(panels[0]?.id || "panel-1");
    }
  }, [panels, activeMobileTab]);

  if (!isActive) return null;

  const isMobile = viewportWidth < 768;
  const maximizedPanel = panels.find((p) => p.id === maximizedPanelId);
  const isWidthCrampedFor3Col = layout === "3-col" && viewportWidth < 1300;

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
          {isWidthCrampedFor3Col && (
            <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px]">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Width &lt; 1300px: 2 Panels Recommended</span>
              <button
                type="button"
                onClick={() => setLayout("2-col")}
                className="ml-1 underline font-bold hover:text-amber-700 dark:hover:text-amber-300"
              >
                Switch
              </button>
            </div>
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
                "p-1.5 rounded transition-colors cursor-pointer",
                !maximizedPanelId && layout === "2-col" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              title="2 Columns (Split Screen - Recommended)"
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
                "p-1.5 rounded transition-colors cursor-pointer",
                !maximizedPanelId && layout === "3-col" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              title="3 Columns (Wide Displays 1400px+)"
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
                "p-1.5 rounded transition-colors cursor-pointer",
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
                "p-1.5 rounded transition-colors cursor-pointer",
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
              className="h-7 text-xs gap-1 hidden sm:flex cursor-pointer"
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
            className="h-7 text-xs text-muted-foreground hover:text-foreground hidden sm:flex cursor-pointer"
            title="Reset layout to default 2-panel"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsActive(false)}
            className="h-7 text-xs gap-1 font-medium bg-card hover:bg-muted/50 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit Workspace</span>
          </Button>
        </div>
      </div>

      {/* Mobile Tab Switcher (< 768px) */}
      {isMobile && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 border-b border-border overflow-x-auto shrink-0">
          {panels.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveMobileTab(p.id)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                activeMobileTab === p.id
                  ? "bg-card text-foreground font-semibold shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Panel {idx + 1}: {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Maximized Panel View (Single full-size view when maximized) */}
      {maximizedPanel ? (
        <div className="flex-1 overflow-hidden h-full min-w-0 min-h-0">
          <SinglePanelContainer
            panel={maximizedPanel}
            canClose={false}
            isMaximized={true}
            onToggleMaximize={() => setMaximizedPanelId(null)}
            onChangeView={(view) => setPanelView(maximizedPanel.id, view)}
          />
        </div>
      ) : isMobile ? (
        /* Mobile View: Render only active tab at full width & height */
        <div className="flex-1 overflow-hidden h-full min-w-0 min-h-0">
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
      ) : (
        /* Desktop & Tablet Resizable Layouts (>= 768px) */
        <div className="flex-1 overflow-hidden h-full w-full min-w-0 min-h-0">
          {layout === "2-col" && (
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
              {panels.slice(0, 2).map((panel, idx) => (
                <React.Fragment key={panel.id}>
                  {idx > 0 && <ResizableHandle withHandle />}
                  <ResizablePanel defaultSize={panel.sizePct || 50} minSize={15} className="min-w-0 min-h-0">
                    <SinglePanelContainer
                      panel={panel}
                      canClose={panels.length > 1}
                      isMaximized={false}
                      onToggleMaximize={() => setMaximizedPanelId(panel.id)}
                      onClose={() => removePanel(panel.id)}
                      onChangeView={(view) => setPanelView(panel.id, view)}
                    />
                  </ResizablePanel>
                </React.Fragment>
              ))}
            </ResizablePanelGroup>
          )}

          {layout === "3-col" && (
            viewportWidth < 1100 ? (
              /* Tablet Adaptive 3-Panel: 2 panels on top, 1 panel on bottom */
              <ResizablePanelGroup direction="vertical" className="h-full w-full">
                <ResizablePanel defaultSize={55} minSize={20} className="min-w-0 min-h-0">
                  <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                    {panels.slice(0, 2).map((panel, idx) => (
                      <React.Fragment key={panel.id}>
                        {idx > 0 && <ResizableHandle withHandle />}
                        <ResizablePanel defaultSize={panel.sizePct || 50} minSize={15} className="min-w-0 min-h-0">
                          <SinglePanelContainer
                            panel={panel}
                            canClose={panels.length > 1}
                            isMaximized={false}
                            onToggleMaximize={() => setMaximizedPanelId(panel.id)}
                            onClose={() => removePanel(panel.id)}
                            onChangeView={(view) => setPanelView(panel.id, view)}
                          />
                        </ResizablePanel>
                      </React.Fragment>
                    ))}
                  </ResizablePanelGroup>
                </ResizablePanel>
                <ResizableHandle withHandle />
                {panels[2] && (
                  <ResizablePanel defaultSize={45} minSize={20} className="min-w-0 min-h-0">
                    <SinglePanelContainer
                      panel={panels[2]}
                      canClose={panels.length > 1}
                      isMaximized={false}
                      onToggleMaximize={() => setMaximizedPanelId(panels[2].id)}
                      onClose={() => removePanel(panels[2].id)}
                      onChangeView={(view) => setPanelView(panels[2].id, view)}
                    />
                  </ResizablePanel>
                )}
              </ResizablePanelGroup>
            ) : (
              /* Desktop 3-Column: 3 side-by-side resizable columns */
              <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                {panels.slice(0, 3).map((panel, idx) => (
                  <React.Fragment key={panel.id}>
                    {idx > 0 && <ResizableHandle withHandle />}
                    <ResizablePanel defaultSize={panel.sizePct || 33} minSize={15} className="min-w-0 min-h-0">
                      <SinglePanelContainer
                        panel={panel}
                        canClose={panels.length > 1}
                        isMaximized={false}
                        onToggleMaximize={() => setMaximizedPanelId(panel.id)}
                        onClose={() => removePanel(panel.id)}
                        onChangeView={(view) => setPanelView(panel.id, view)}
                      />
                    </ResizablePanel>
                  </React.Fragment>
                ))}
              </ResizablePanelGroup>
            )
          )}

          {layout === "2-row" && (
            <ResizablePanelGroup direction="vertical" className="h-full w-full">
              {panels.slice(0, 2).map((panel, idx) => (
                <React.Fragment key={panel.id}>
                  {idx > 0 && <ResizableHandle withHandle />}
                  <ResizablePanel defaultSize={panel.sizePct || 50} minSize={15} className="min-w-0 min-h-0">
                    <SinglePanelContainer
                      panel={panel}
                      canClose={panels.length > 1}
                      isMaximized={false}
                      onToggleMaximize={() => setMaximizedPanelId(panel.id)}
                      onClose={() => removePanel(panel.id)}
                      onChangeView={(view) => setPanelView(panel.id, view)}
                    />
                  </ResizablePanel>
                </React.Fragment>
              ))}
            </ResizablePanelGroup>
          )}

          {layout === "4-grid" && (
            <ResizablePanelGroup direction="vertical" className="h-full w-full">
              <ResizablePanel defaultSize={50} minSize={15} className="min-w-0 min-h-0">
                <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                  {panels.slice(0, 2).map((panel, idx) => (
                    <React.Fragment key={panel.id}>
                      {idx > 0 && <ResizableHandle withHandle />}
                      <ResizablePanel defaultSize={50} minSize={15} className="min-w-0 min-h-0">
                        <SinglePanelContainer
                          panel={panel}
                          canClose={panels.length > 1}
                          isMaximized={false}
                          onToggleMaximize={() => setMaximizedPanelId(panel.id)}
                          onClose={() => removePanel(panel.id)}
                          onChangeView={(view) => setPanelView(panel.id, view)}
                        />
                      </ResizablePanel>
                    </React.Fragment>
                  ))}
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={15} className="min-w-0 min-h-0">
                <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                  {panels.slice(2, 4).map((panel, idx) => (
                    <React.Fragment key={panel.id}>
                      {idx > 0 && <ResizableHandle withHandle />}
                      <ResizablePanel defaultSize={50} minSize={15} className="min-w-0 min-h-0">
                        <SinglePanelContainer
                          panel={panel}
                          canClose={panels.length > 1}
                          isMaximized={false}
                          onToggleMaximize={() => setMaximizedPanelId(panel.id)}
                          onClose={() => removePanel(panel.id)}
                          onChangeView={(view) => setPanelView(panel.id, view)}
                        />
                      </ResizablePanel>
                    </React.Fragment>
                  ))}
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
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
    <div className="flex flex-col h-full w-full bg-background overflow-hidden min-w-0 min-h-0">
      {/* Panel Local Header */}
      <div className="h-9 px-2.5 sm:px-3 border-b border-border bg-card/60 flex items-center justify-between gap-1.5 shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <select
            value={panel.view}
            onChange={(e) => onChangeView(e.target.value as ViewKey)}
            className="h-6 px-1.5 rounded bg-transparent hover:bg-muted/50 border-0 text-xs font-semibold text-foreground cursor-pointer focus:outline-hidden max-w-[130px] sm:max-w-[190px] truncate shrink"
          >
            {SUPPORTED_PANEL_VIEWS.map((v) => (
              <option key={v.key} value={v.key} className="bg-card text-foreground">
                {v.label}
              </option>
            ))}
          </select>

          {panel.view === "tradeDetail" && linkedTradeId && (
            <Badge variant="outline" className="text-[9px] font-mono border-primary/30 text-primary gap-1 py-0 truncate shrink">
              <Link2 className="h-2.5 w-2.5 shrink-0" />
              Linked trade
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
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
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              title="Close this panel"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Scrollable Content with Container Query Scope */}
      <div className="flex-1 overflow-y-auto overflow-x-auto min-w-0 min-h-0 @container">
        <PanelContentRenderer panel={panel} />
      </div>
    </div>
  );
}

function PanelContentRenderer({ panel }: { panel: WorkspacePanel }) {
  const linkedTradeId = useWorkspaceStore((s) => s.linkedTradeId);
  const tradeId = panel.recordId || linkedTradeId;

  switch (panel.view) {
    case "dashboard":
      return <DashboardView />;
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
    case "riskCalculator":
      return <RiskCalculatorView />;
    case "setups":
      return <PlaybooksView />;
    case "calendar":
      return <CalendarView />;
    case "accounts":
      return <AccountsView />;
    case "propChallenges":
      return <PropChallengesView />;
    case "tradingTodo":
      return <TradingTodoView />;
    case "settings":
      return <SettingsView />;
    case "archived":
      return <ArchivedView />;
    case "backup":
      return <BackupView />;
    default:
      return <div className="p-4 text-xs text-muted-foreground">Select a view for this panel.</div>;
  }
}
