"use client";

import React from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrumbItem {
  label: string;
  view?: ViewKey;
  params?: Record<string, any>;
  isCurrent?: boolean;
}

export function GlobalBreadcrumbs() {
  const { view, params, navigate } = useNav();

  const crumbs: CrumbItem[] = [
    {
      label: "Dashboard",
      view: "dashboard",
    },
  ];

  if (view === "dashboard") {
    crumbs[0].isCurrent = true;
  } else if (view === "propChallenges") {
    const hasChallenge = Boolean(params.challengeId);
    crumbs.push({
      label: "Prop Challenges",
      view: "propChallenges",
      isCurrent: !hasChallenge,
    });

    if (hasChallenge) {
      const challengeName = params.challengeName || "Challenge Detail";
      const hasTab = Boolean(params.tab && params.tab !== "overview");
      crumbs.push({
        label: challengeName,
        view: "propChallenges",
        params: { challengeId: params.challengeId },
        isCurrent: !hasTab,
      });

      if (hasTab) {
        const tabNames: Record<string, string> = {
          overview: "Overview",
          rules: "Rules & Limits",
          performance: "Performance",
          trades: "Trades",
          phases: "Phase History",
          breaches: "Violations & Diagnosis",
          payouts: "Payouts",
          audit: "Lifecycle Events",
        };
        crumbs.push({
          label: tabNames[params.tab] || params.tab,
          isCurrent: true,
        });
      }
    }
  } else if (view === "tradesLog") {
    if (params.propChallengeId || params.propChallengeName) {
      crumbs.push({
        label: "Prop Challenges",
        view: "propChallenges",
      });
      crumbs.push({
        label: params.propChallengeName || "Prop Challenge",
        view: "propChallenges",
        params: { challengeId: params.propChallengeId },
      });
      crumbs.push({
        label: params.phase ? `Trades (${params.phase})` : "Trades Log",
        isCurrent: true,
      });
    } else {
      crumbs.push({
        label: "Trades Log",
        isCurrent: true,
      });
    }
  } else if (view === "tradeDetail") {
    crumbs.push({
      label: "Trades Log",
      view: "tradesLog",
    });
    crumbs.push({
      label: params.id ? `Trade #${String(params.id).slice(-6)}` : "Trade Detail",
      isCurrent: true,
    });
  } else if (view === "tradeNew") {
    crumbs.push({
      label: "Trades Log",
      view: "tradesLog",
    });
    crumbs.push({
      label: "New Trade Execution",
      isCurrent: true,
    });
  } else if (view === "setups") {
    crumbs.push({
      label: "Setups & Checklists",
      isCurrent: !params.strategyId,
      view: "setups",
    });
    if (params.strategyId) {
      crumbs.push({
        label: params.strategyName || "Strategy Detail",
        isCurrent: true,
      });
    }
  } else if (view === "accounts") {
    crumbs.push({
      label: "Trading Accounts",
      isCurrent: true,
    });
  } else if (view === "analytics") {
    crumbs.push({
      label: "Analytics Engine",
      isCurrent: true,
    });
  } else if (view === "calendar") {
    crumbs.push({
      label: "Trading Calendar",
      isCurrent: true,
    });
  } else if (view === "riskCalculator") {
    crumbs.push({
      label: "Risk Calculator",
      isCurrent: true,
    });
  } else if (view === "tradingTodo") {
    crumbs.push({
      label: "Trading To-Do",
      isCurrent: true,
    });
  } else if (view === "settings") {
    crumbs.push({
      label: "Preferences Center",
      isCurrent: true,
    });
  } else if (view === "backup") {
    crumbs.push({
      label: "Preferences",
      view: "settings",
    });
    crumbs.push({
      label: "Backup & Restore",
      isCurrent: true,
    });
  } else if (view === ("noTrades" as ViewKey)) {
    crumbs.push({
      label: "No-Trade Observations",
      isCurrent: true,
    });
  } else if (view === ("archived" as ViewKey)) {
    crumbs.push({
      label: "Archived Records",
      isCurrent: true,
    });
  } else {
    // Fallback for custom views
    crumbs.push({
      label: String(view),
      isCurrent: true,
    });
  }

  return (
    <div
      aria-label="Breadcrumb navigation"
      className="px-4 md:px-6 py-2 border-b border-border/40 bg-card/25 backdrop-blur-xs flex items-center min-h-[38px] overflow-hidden"
    >
      <Breadcrumb className="text-xs">
        <BreadcrumbList className="flex-nowrap sm:flex-wrap items-center gap-1 sm:gap-1.5 text-xs">
          {crumbs.map((crumb, idx) => {
            const isLast = idx === crumbs.length - 1;
            const isFirst = idx === 0;

            // Responsive collapsing for intermediate items on mobile
            const shouldCollapseOnMobile = crumbs.length > 3 && idx > 0 && idx < crumbs.length - 2;

            return (
              <React.Fragment key={`${crumb.label}_${idx}`}>
                {idx > 0 && (
                  <BreadcrumbSeparator
                    className={cn(shouldCollapseOnMobile && "hidden sm:inline-flex")}
                  />
                )}

                {/* Show ellipsis on mobile if items are collapsed */}
                {shouldCollapseOnMobile && idx === 1 && (
                  <React.Fragment>
                    <BreadcrumbItem className="sm:hidden">
                      <BreadcrumbEllipsis className="h-4 w-4" />
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="sm:hidden" />
                  </React.Fragment>
                )}

                <BreadcrumbItem
                  className={cn(
                    "whitespace-nowrap truncate max-w-[160px] sm:max-w-[240px]",
                    shouldCollapseOnMobile && "hidden sm:inline-flex"
                  )}
                >
                  {crumb.isCurrent || isLast || !crumb.view ? (
                    <BreadcrumbPage className="font-semibold text-foreground truncate flex items-center gap-1.5">
                      {isFirst && <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="truncate">{crumb.label}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      asChild
                      className="cursor-pointer hover:text-foreground text-muted-foreground flex items-center gap-1.5 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(crumb.view!, crumb.params)}
                        className="flex items-center gap-1.5 cursor-pointer text-left focus:outline-none"
                      >
                        {isFirst && <LayoutDashboard className="h-3.5 w-3.5" />}
                        <span className="truncate">{crumb.label}</span>
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
