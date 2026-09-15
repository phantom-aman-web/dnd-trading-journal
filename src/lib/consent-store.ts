"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CURRENT_VERSIONS } from "@/lib/legal-versions";

/**
 * Cookie consent state for anonymous visitors.
 *
 * Authenticated users also get a LegalAcceptance row (docType="cookies")
 * synced via the /api/legal/cookies endpoint — but the banner itself needs
 * to work BEFORE the user signs in, so we persist the choice client-side
 * keyed to the consent version. When the version bumps, the banner shows
 * again.
 *
 * Consent categories:
 *   - essential: always true (auth, security). Not presented as optional.
 *   - functional: UI preferences (theme, sidebar). Not presented as optional.
 *   - analytics:  non-essential. Currently no analytics are loaded, but the
 *                 system is ready — toggling this off would block any future
 *                 analytics script.
 *   - marketing:  non-essential. Currently unused.
 */

export type ConsentChoice = "accepted" | "rejected" | "undecided";

export interface ConsentPreferences {
  essential: boolean;   // always true
  functional: boolean;  // always true
  analytics: boolean;
  marketing: boolean;
}

interface ConsentStore {
  choice: ConsentChoice;
  /** Version of the cookie consent banner/policy when the choice was made. */
  version: string;
  /** ISO timestamp of the choice. */
  timestamp: string | null;
  preferences: ConsentPreferences;
  /** Whether the banner should be visible (undecided or version mismatch). */
  bannerVisible: boolean;
  /** Whether the settings modal is open. */
  settingsOpen: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (prefs: Partial<Pick<ConsentPreferences, "analytics" | "marketing">>) => void;
  openSettings: () => void;
  closeSettings: () => void;
  closeBanner: () => void;
  /** Re-show the banner (used when the consent version bumps). */
  reset: () => void;
}

const DEFAULT_PREFS: ConsentPreferences = {
  essential: true,
  functional: true,
  analytics: false,
  marketing: false,
};

export const useConsent = create<ConsentStore>()(
  persist(
    (set, get) => ({
      choice: "undecided",
      version: CURRENT_VERSIONS.cookieConsent,
      timestamp: null,
      preferences: DEFAULT_PREFS,
      bannerVisible: false,
      settingsOpen: false,
      acceptAll: () =>
        set({
          choice: "accepted",
          version: CURRENT_VERSIONS.cookieConsent,
          timestamp: new Date().toISOString(),
          preferences: { ...DEFAULT_PREFS, analytics: true, marketing: true },
          bannerVisible: false,
        }),
      rejectNonEssential: () =>
        set({
          choice: "rejected",
          version: CURRENT_VERSIONS.cookieConsent,
          timestamp: new Date().toISOString(),
          preferences: { ...DEFAULT_PREFS },
          bannerVisible: false,
        }),
      savePreferences: (prefs) =>
        set((s) => ({
          choice: "accepted",
          version: CURRENT_VERSIONS.cookieConsent,
          timestamp: new Date().toISOString(),
          preferences: {
            ...s.preferences,
            ...prefs,
            essential: true,
            functional: true,
          },
          bannerVisible: false,
          settingsOpen: false,
        })),
      openSettings: () => set({ settingsOpen: true, bannerVisible: false }),
      closeSettings: () => set({ settingsOpen: false }),
      closeBanner: () => set({ bannerVisible: false }),
      reset: () => set({ bannerVisible: true, settingsOpen: false }),
    }),
    {
      name: "dnd-consent",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        choice: s.choice,
        version: s.version,
        timestamp: s.timestamp,
        preferences: s.preferences,
      }),
      // After rehydration, decide whether the banner should show:
      //   - No prior choice → show.
      //   - Version mismatch → show (policy updated).
      //   - Current version + decided → hide.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const needsChoice =
          state.choice === "undecided" ||
          state.version !== CURRENT_VERSIONS.cookieConsent;
        state.bannerVisible = needsChoice;
      },
    },
  ),
);
