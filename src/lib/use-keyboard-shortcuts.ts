"use client";

import { useEffect, useRef, useState } from "react";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { useFavorites } from "@/lib/favorites-store";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { toast } from "sonner";

export function useGlobalKeyboardShortcuts() {
  const { navigate, view, params, setCommandOpen, commandOpen, setTradeFormOpen, toggleSidebar } = useNav();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pendingChordRef = useRef<string | null>(null);
  const chordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when focusing editable elements
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // Allow Escape always
      if (e.key === "Escape") {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        if (commandOpen) {
          setCommandOpen(false);
          return;
        }
      }

      if (isInput) return;

      // Cmd+K or Ctrl+K handled globally in page.tsx / command-palette

      // Single key: "?" opens shortcuts modal
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      // Single key: "/" opens command palette
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }

      // Single key: "[" toggles sidebar
      if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Alt+W toggles Multi-Panel Workspace mode
      if ((e.key === "w" || e.key === "W") && e.altKey) {
        e.preventDefault();
        useWorkspaceStore.getState().toggleWorkspace();
        return;
      }

      // Single key: "n" or "c" opens New Trade form
      if ((e.key === "n" || e.key === "c") && !e.metaKey && !e.ctrlKey && !pendingChordRef.current) {
        e.preventDefault();
        setTradeFormOpen(true);
        return;
      }

      // Single key: "o" opens Log Observation form
      if (e.key === "o" && !e.metaKey && !e.ctrlKey && !pendingChordRef.current) {
        e.preventDefault();
        useNav.getState().setNoTradeFormOpen(true);
        return;
      }

      // Single key: "f" bookmarks current trade if viewing tradeDetail
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !pendingChordRef.current) {
        if (view === "tradeDetail" && params.id) {
          e.preventDefault();
          useFavorites.getState().toggleFavorite(params.id);
          return;
        }
      }

      // Sequence: "g" followed by another key (Navigation chords)
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        pendingChordRef.current = "g";
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);
        chordTimeoutRef.current = setTimeout(() => {
          pendingChordRef.current = null;
        }, 1200);
        return;
      }

      if (pendingChordRef.current === "g") {
        const chordKey = e.key.toLowerCase();
        pendingChordRef.current = null;
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);

        const chordMap: Record<string, () => void> = {
          d: () => navigate("dashboard"),
          t: () => navigate("tradesLog"),
          f: () => navigate("tradesLog", { favorites: "1" }),
          o: () => navigate("tradesLog", { tab: "observations" }),
          c: () => navigate("calendar"),
          a: () => navigate("analytics"),
          s: () => navigate("setups"),
          p: () => navigate("propChallenges"),
          r: () => navigate("riskCalculator"),
          w: () => navigate("tradingTodo"),
          ",": () => navigate("settings"),
        };

        if (chordMap[chordKey]) {
          e.preventDefault();
          chordMap[chordKey]();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);
    };
  }, [navigate, view, params, setCommandOpen, commandOpen, setTradeFormOpen, toggleSidebar, shortcutsOpen]);

  return {
    shortcutsOpen,
    setShortcutsOpen,
  };
}
