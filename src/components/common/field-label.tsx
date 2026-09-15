"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";

interface FieldLabelProps {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  className?: string;
}

/**
 * Form field label with consistent required indicators.
 * - Required fields show a red asterisk (*)
 * - Optional fields show no extra text (just the label)
 * - If a hint is provided, a small help icon appears next to the label.
 *   Clicking it shows a temporary tooltip with the hint text.
 */
export function FieldLabel({ children, required, optional, hint, className }: FieldLabelProps) {
  const [showHint, setShowHint] = useState(false);

  return (
    <label className={cn("flex items-center gap-1.5 text-sm font-medium", className)}>
      {children}
      {required && <span className="text-loss">*</span>}
      {hint && (
        <span
          className="relative inline-flex"
          onMouseEnter={() => setShowHint(true)}
          onMouseLeave={() => setShowHint(false)}
          onClick={(e) => { e.preventDefault(); setShowHint((s) => !s); }}
        >
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          {showHint && (
            <span
              className="absolute left-0 top-5 z-50 w-48 rounded-md border border-border bg-popover p-2 text-xs font-normal text-popover-foreground shadow-md"
              role="tooltip"
            >
              {hint}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
