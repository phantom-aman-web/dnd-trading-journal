"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Collapsed mode (shows only the logo mark, no text) */
  collapsed?: boolean;
  /** Whether to show the PRO badge */
  showBadge?: boolean;
  /** Custom badge text (defaults to "PRO") */
  badgeText?: string;
  /** Subtitle to show under AlphaPips (e.g. "Performance OS") */
  subtitle?: string;
  /** Additional class names for the container */
  className?: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Interactive hover scale effect (default true for clickable logos) */
  interactive?: boolean;
}

export function BrandLogoMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-7 w-7 rounded-lg p-0.5",
    md: "h-9 w-9 rounded-xl p-0.5 shadow-lg shadow-blue-900/30 ring-1 ring-white/20",
    lg: "h-11 w-11 rounded-2xl p-0.5 shadow-xl shadow-blue-900/30 ring-1 ring-white/20",
  }[size];

  const innerRadius = {
    sm: "rounded-[6px]",
    md: "rounded-[10px]",
    lg: "rounded-[14px]",
  }[size];

  const svgSize = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-blue-600 via-cyan-500 to-blue-700 shrink-0 select-none",
        sizeClasses,
        className
      )}
    >
      <div
        className={cn(
          "w-full h-full bg-[#0B1021] flex items-center justify-center",
          innerRadius
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(svgSize, "text-cyan-300")}
          aria-hidden="true"
        >
          <path
            d="M12 3 L20 20 L15.5 20 L12 11 L8.5 20 L4 20 Z"
            fill="currentColor"
            fillOpacity="0.25"
          />
          <circle cx="12" cy="8" r="1.6" fill="#10B981" stroke="#10B981" />
        </svg>
      </div>
    </div>
  );
}

export function BrandLogo({
  size = "md",
  collapsed = false,
  showBadge = true,
  badgeText = "PRO",
  subtitle,
  className,
  onClick,
  interactive = false,
}: BrandLogoProps) {
  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  }[size];

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 shrink-0 select-none",
        interactive && "group cursor-pointer",
        className
      )}
    >
      <div
        className={cn(
          "transition-transform duration-200",
          interactive && "group-hover:scale-105"
        )}
      >
        <BrandLogoMark size={size} />
      </div>

      {!collapsed && (
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={cn(
                "font-bold tracking-tight text-foreground font-jakarta",
                textSizes
              )}
            >
              AlphaPips
            </span>
            {showBadge && (
              <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 dark:text-cyan-300 border border-cyan-500/30">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground/80 leading-none mt-1 font-sans">
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
