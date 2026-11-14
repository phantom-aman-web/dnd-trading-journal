"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { Keyboard, Command, Compass, Plus, Star, Search, Sliders, PanelLeftClose } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Navigation" | "Actions" | "General";
}

export const SHORTCUTS_LIST: ShortcutItem[] = [
  // Navigation
  { keys: ["G", "D"], description: "Go to Dashboard", category: "Navigation" },
  { keys: ["G", "T"], description: "Go to Trades Log", category: "Navigation" },
  { keys: ["G", "F"], description: "Go to Favorite Trades", category: "Navigation" },
  { keys: ["G", "O"], description: "Go to Observations (in Log)", category: "Navigation" },
  { keys: ["G", "C"], description: "Go to Trading Calendar", category: "Navigation" },
  { keys: ["G", "A"], description: "Go to Analytics Engine", category: "Navigation" },
  { keys: ["G", "S"], description: "Go to Setups & Checklists", category: "Navigation" },
  { keys: ["G", "P"], description: "Go to Prop Challenges", category: "Navigation" },
  { keys: ["G", "R"], description: "Go to Risk Calculator", category: "Navigation" },
  { keys: ["G", "W"], description: "Go to Trading To-Do", category: "Navigation" },
  { keys: ["G", ","], description: "Go to Settings", category: "Navigation" },

  // Actions
  { keys: ["N"], description: "Log New Trade", category: "Actions" },
  { keys: ["O"], description: "Log No-Trade Observation", category: "Actions" },
  { keys: ["Alt", "W"], description: "Toggle Multi-Panel Workspace", category: "Actions" },
  { keys: ["F"], description: "Bookmark / Favorite Trade (in Detail)", category: "Actions" },
  { keys: ["[ "], description: "Toggle Sidebar Rail", category: "Actions" },

  // General
  { keys: ["⌘ / Ctrl", "K"], description: "Open Command Palette & Search", category: "General" },
  { keys: ["/"], description: "Quick Search", category: "General" },
  { keys: ["?"], description: "Open Keyboard Shortcuts Help", category: "General" },
  { keys: ["Esc"], description: "Close Modal or Drawer", category: "General" },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const categories = ["Navigation", "Actions", "General"] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold font-jakarta">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Keyboard className="h-4 w-4" />
            </div>
            <span>Keyboard Shortcuts</span>
            <Badge variant="outline" className="ml-auto text-[10px] font-mono">
              Pro Workflow
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Speed up your trading workflow with instant keyboard controls.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-6 max-h-[65vh] overflow-y-auto pr-1">
          {categories.map((cat) => {
            const items = SHORTCUTS_LIST.filter((s) => s.category === cat);
            return (
              <div key={cat} className="space-y-2.5">
                <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground/80 px-1">
                  {cat}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-foreground/90 font-medium pr-2">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, kidx) => (
                          <kbd
                            key={kidx}
                            className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-muted text-foreground border border-border shadow-xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">?</kbd> anytime to open this guide</span>
          <span className="text-[11px] font-mono">AlphaPips OS</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
