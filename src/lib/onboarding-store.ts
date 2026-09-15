"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type OnboardingState =
  | "not_started"
  | "welcome"
  | "setup"
  | "tour"
  | "completed"
  | "skipped";

export type SetupStep =
  | "account"
  | "instrument"
  | "strategy"
  | "plan"
  | "trade";

interface OnboardingStore {
  state: OnboardingState;
  setupStep: number; // 0-4
  tourStep: number; // 0-9
  completedSteps: SetupStep[];
  /** Record of the last created strategy id, used to attach rules in step 4. */
  lastStrategyId: string | null;
  /**
   * The user id this onboarding state belongs to. localStorage is shared
   * across all accounts on the same browser, so we stamp the owning user
   * here and reset whenever the signed-in user changes — ensuring every
   * new account gets its own first-run walkthrough.
   */
  userId: string | null;
  /**
   * Non-persisted flag: true only in the instant after finishTour() runs.
   * Lets TourCompletion show once, then never again on refresh (since this
   * flag is NOT in partialize, it resets to false on page load).
   */
  tourJustFinished: boolean;
  setState: (s: OnboardingState) => void;
  setSetupStep: (n: number) => void;
  nextSetupStep: () => void;
  prevSetupStep: () => void;
  completeStep: (step: SetupStep) => void;
  setTourStep: (n: number) => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  skipTour: () => void;
  finishTour: () => void;
  /** Dismiss the TourCompletion celebration modal. */
  dismissCompletion: () => void;
  setLastStrategyId: (id: string | null) => void;
  /**
   * Replay the interactive tour only — skips the welcome screen and setup
   * wizard. Used by the "Learn DnD" menu item for users who already
   * configured their workspace.
   */
  replayTour: () => void;
  /** Restart the full flow for the current user (via the "Learn DnD" menu). */
  reset: () => void;
  /**
   * Claim the onboarding state for the given user. If the persisted state
   * belongs to a different user, wipe it and start fresh. Called once per
   * session right after the auth check resolves.
   */
  bindToUser: (userId: string) => void;
}

export const TOTAL_TOUR_STEPS = 9;
export const TOTAL_SETUP_STEPS = 5;

export const useOnboarding = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      state: "not_started",
      setupStep: 0,
      tourStep: 0,
      completedSteps: [],
      lastStrategyId: null,
      userId: null,
      tourJustFinished: false,
      setState: (s) => set({ state: s }),
      setSetupStep: (n) =>
        set({ setupStep: Math.max(0, Math.min(TOTAL_SETUP_STEPS - 1, n)) }),
      nextSetupStep: () =>
        set((s) => ({
          setupStep: Math.min(TOTAL_SETUP_STEPS - 1, s.setupStep + 1),
        })),
      prevSetupStep: () =>
        set((s) => ({ setupStep: Math.max(0, s.setupStep - 1) })),
      completeStep: (step) =>
        set((s) =>
          s.completedSteps.includes(step)
            ? s
            : { completedSteps: [...s.completedSteps, step] },
        ),
      setTourStep: (n) =>
        set({ tourStep: Math.max(0, Math.min(TOTAL_TOUR_STEPS - 1, n)) }),
      nextTourStep: () =>
        set((s) => ({
          tourStep: Math.min(TOTAL_TOUR_STEPS - 1, s.tourStep + 1),
        })),
      prevTourStep: () =>
        set((s) => ({ tourStep: Math.max(0, s.tourStep - 1) })),
      skipTour: () => set({ state: "skipped", tourStep: 0, tourJustFinished: false }),
      finishTour: () =>
        set({ state: "completed", tourStep: 0, tourJustFinished: true }),
      dismissCompletion: () => set({ tourJustFinished: false }),
      setLastStrategyId: (id) => set({ lastStrategyId: id }),
      replayTour: () =>
        set({ state: "tour", tourStep: 0, tourJustFinished: false }),
      reset: () =>
        set({
          state: "welcome",
          setupStep: 0,
          tourStep: 0,
          completedSteps: [],
          lastStrategyId: null,
          tourJustFinished: false,
        }),
      bindToUser: (userId) => {
        const current = get();
        // Same user as before — keep their progress untouched.
        if (current.userId === userId) return;
        // Different (or first-time) user — wipe the borrowed state so this
        // account starts from a clean "not_started" slate. The bootstrap
        // in page.tsx will then decide whether to show the welcome screen
        // based on this user's actual data.
        set({
          userId,
          state: "not_started",
          setupStep: 0,
          tourStep: 0,
          completedSteps: [],
          lastStrategyId: null,
        });
      },
    }),
    {
      name: "dnd-onboarding",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        state: s.state,
        setupStep: s.setupStep,
        tourStep: s.tourStep,
        completedSteps: s.completedSteps,
        lastStrategyId: s.lastStrategyId,
        userId: s.userId,
      }),
    },
  ),
);
