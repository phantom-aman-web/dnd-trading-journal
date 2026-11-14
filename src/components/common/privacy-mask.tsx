"use client";

import React, { useState } from "react";
import { usePrivacyStore, PRIVACY_MASK } from "@/lib/privacy-store";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

interface PrivacyMaskProps {
  children?: React.ReactNode;
  value?: React.ReactNode;
  revealId?: string;
  className?: string;
  mask?: string;
  allowPeek?: boolean;
}

export function PrivacyMask({
  children,
  value,
  revealId,
  className,
  mask = PRIVACY_MASK,
  allowPeek = true,
}: PrivacyMaskProps) {
  const content = children ?? value;
  const isPrivate = usePrivacyStore((s) => s.isPrivate);
  const [hoverPeek, setHoverPeek] = useState(false);
  const [clickPeek, setClickPeek] = useState(false);

  if (!isPrivate) {
    return <span className={className}>{content}</span>;
  }

  const isRevealed = hoverPeek || clickPeek;

  if (isRevealed) {
    return (
      <span
        className={cn(className, "cursor-pointer select-none underline decoration-dashed decoration-primary/40")}
        onClick={() => setClickPeek(false)}
        onMouseLeave={() => setHoverPeek(false)}
        title="Click to hide"
      >
        {content}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono tracking-widest select-none opacity-80",
        allowPeek && "cursor-pointer hover:opacity-100 hover:text-primary transition-opacity",
        className
      )}
      onClick={(e) => {
        if (allowPeek) {
          e.stopPropagation();
          setClickPeek(true);
        }
      }}
      onMouseEnter={() => {
        if (allowPeek) setHoverPeek(true);
      }}
      title={allowPeek ? "Click or hover to reveal temporarily" : "Sensitive information hidden"}
    >
      {mask}
    </span>
  );
}
