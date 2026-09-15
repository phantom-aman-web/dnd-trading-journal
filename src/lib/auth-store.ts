"use client";

import { create } from "zustand";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  authChecked: boolean;
  setUser: (u: AuthUser | null) => void;
  fetchUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  authChecked: false,
  setUser: (u) => set({ user: u, loading: false, authChecked: true }),
  fetchUser: async () => {
    // Abort if it takes longer than 8s so the skeleton can never get stuck forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch("/api/auth", {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        set({ user: null, loading: false, authChecked: true });
        return;
      }
      const data = await res.json();
      if (data?.user) {
        set({ user: data.user, loading: false, authChecked: true });
      } else {
        set({ user: null, loading: false, authChecked: true });
      }
    } catch {
      clearTimeout(timeout);
      // Network error, abort, or parse failure — never stay stuck on the skeleton.
      set({ user: null, loading: false, authChecked: true });
    }
  },
  signOut: async () => {
    try {
      await fetch("/api/auth", { method: "DELETE", credentials: "include" });
    } catch {
      /* ignore */
    }
    // Clear persisted nav state so the optimistic AppShell render in
    // page.tsx doesn't flash the dashboard on the next load.
    if (typeof window !== "undefined") {
      try {
        const nav = JSON.parse(localStorage.getItem("dnd-nav") || "{}");
        if (nav?.state) {
          nav.state.view = "landing";
          nav.state.params = {};
          localStorage.setItem("dnd-nav", JSON.stringify(nav));
        }
        localStorage.removeItem("dnd-trade-draft");
        // Set a sessionStorage flag so page.tsx knows to skip the
        // optimistic AppShell render on this navigation. This prevents
        // the dashboard flash during the brief window before the auth
        // check resolves.
        sessionStorage.setItem("dnd-signing-out", "1");
      } catch {
        /* ignore */
      }
    }
    set({ user: null, loading: false, authChecked: true });
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  },
}));
