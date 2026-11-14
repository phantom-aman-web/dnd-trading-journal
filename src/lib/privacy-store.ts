"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrivacyState {
  isPrivate: boolean;
  revealedKeys: Record<string, boolean>;
  togglePrivacy: () => void;
  setPrivacy: (isPrivate: boolean) => void;
  peekKey: (key: string, durationMs?: number) => void;
  isKeyRevealed: (key: string) => boolean;
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set, get) => ({
      isPrivate: false,
      revealedKeys: {},

      togglePrivacy: () => {
        const next = !get().isPrivate;
        set({ isPrivate: next, revealedKeys: {} });
        if (typeof window !== "undefined") {
          // Sync with server if logged in
          fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ privacyModeEnabled: next }),
          }).catch(() => {});
        }
      },

      setPrivacy: (isPrivate: boolean) => {
        set({ isPrivate, revealedKeys: {} });
        if (typeof window !== "undefined") {
          fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ privacyModeEnabled: isPrivate }),
          }).catch(() => {});
        }
      },

      peekKey: (key: string, durationMs = 3000) => {
        set((s) => ({
          revealedKeys: { ...s.revealedKeys, [key]: true },
        }));
        if (durationMs > 0) {
          setTimeout(() => {
            set((s) => {
              const updated = { ...s.revealedKeys };
              delete updated[key];
              return { revealedKeys: updated };
            });
          }, durationMs);
        }
      },

      isKeyRevealed: (key: string) => {
        const s = get();
        if (!s.isPrivate) return true;
        return !!s.revealedKeys[key];
      },
    }),
    {
      name: "alphapips-privacy",
      partialize: (s) => ({ isPrivate: s.isPrivate }),
    }
  )
);

/** Mask format constant */
export const PRIVACY_MASK = "••••••";

/** Helper function to mask numeric or currency values */
export function maskSensitive(
  value: string | number | null | undefined,
  isPrivate: boolean,
  peekKeyId?: string
): string {
  if (value == null) return "—";
  if (!isPrivate) return String(value);

  if (peekKeyId && usePrivacyStore.getState().isKeyRevealed(peekKeyId)) {
    return String(value);
  }

  return PRIVACY_MASK;
}

/** Helper to mask signed monetary return objects */
export function maskSignedCents(
  pnl: { text: string; sign: -1 | 0 | 1 },
  isPrivate: boolean,
  peekKeyId?: string
): { text: string; sign: -1 | 0 | 1 } {
  if (!isPrivate) return pnl;
  if (peekKeyId && usePrivacyStore.getState().isKeyRevealed(peekKeyId)) {
    return pnl;
  }
  const prefix = pnl.sign > 0 ? "+ " : pnl.sign < 0 ? "- " : "";
  return {
    text: `${prefix}${PRIVACY_MASK}`,
    sign: pnl.sign,
  };
}

/** Helper to mask account name */
export function maskAccountName(
  accountName: string | null | undefined,
  isPrivate: boolean,
  fallbackIndex = 1
): string {
  if (!accountName) return "Account";
  if (!isPrivate) return accountName;
  return `Account ••••${fallbackIndex}`;
}
