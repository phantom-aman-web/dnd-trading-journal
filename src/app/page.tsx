"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-store";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { useOnboarding } from "@/lib/onboarding-store";
import { LandingView } from "@/components/views/landing-view";
import { AuthView } from "@/components/views/auth-view";
import { AppShell } from "@/components/app-shell";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";
import { SetupWizard } from "@/components/onboarding/setup-wizard";
import { Tour, TourCompletion } from "@/components/onboarding/tour";
import { CookieConsent } from "@/components/public/cookie-consent";
import { LegalDocViewer } from "@/components/public/legal-doc-viewer";

// Views that indicate the user was previously in the authenticated app.
const APP_VIEWS: ViewKey[] = [
  "dashboard", "tradesLog", "tradeDetail", "tradeNew",
  "calendar", "analytics", "setups", "accounts", "settings", "backup",
];

// Views that are public legal documents (rendered as modals over the current view).
const LEGAL_VIEWS: ViewKey[] = ["terms", "privacy", "cookies"];

export default function Home() {
  const { user, fetchUser, authChecked } = useAuth();
  const { view, navigate } = useNav();
  const setState = useOnboarding((s) => s.setState);
  const bootstrappedRef = useRef<string | null>(null);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const { setCommandOpen, commandOpen } = useNav.getState();
        setCommandOpen(!commandOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // If a view was set to landing/auth while authenticated, jump to dashboard.
  // Exception: legal views (terms/privacy/cookies) are valid even when authed.
  useEffect(() => {
    if (user && (view === "landing" || view === "signin" || view === "signup")) {
      navigate("dashboard");
    }
  }, [user, view, navigate]);

  // First-time check: after the user is known, if onboarding hasn't started and
  // the user has no accounts or trades, transition to the welcome screen.
  useEffect(() => {
    if (!user) return;
    if (bootstrappedRef.current === user.id) return;
    bootstrappedRef.current = user.id;

    useOnboarding.getState().bindToUser(user.id);

    const currentState = useOnboarding.getState().state;
    if (currentState !== "not_started") return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const hasAccounts = (data?.accounts?.length ?? 0) > 0;
        const hasTrades = (data?.tradeCount ?? 0) > 0;
        if (!hasAccounts && !hasTrades) {
          setState("welcome");
        } else {
          setState("completed");
        }
      } catch {
        // On error, leave state alone.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, setState]);

  // Optimistic rendering: if the persisted view is an app view, the user was
  // previously authenticated. Render the AppShell immediately while the auth
  // check runs in the background.
  // SKIP this if we just signed out (sessionStorage flag prevents the
  // dashboard flash during the auth check window).
  const hadAppView = APP_VIEWS.includes(view);
  const isSigningOut = typeof window !== "undefined" && sessionStorage.getItem("dnd-signing-out") === "1";

  if (!isSigningOut && !user && !authChecked && hadAppView) {
    return <AppShell />;
  }

  // Clear the sign-out flag once we've passed the optimistic check.
  if (isSigningOut && typeof window !== "undefined") {
    sessionStorage.removeItem("dnd-signing-out");
  }

  // Legal document viewer — renders as a modal overlay on top of whatever
  // view is behind it. Works for both anonymous and authenticated users.
  const isLegalView = LEGAL_VIEWS.includes(view);

  if (!user) {
    if (view === "signin" || view === "signup") {
      return (
        <>
          <AuthView />
          {isLegalView && <LegalDocViewer view={view} />}
          <CookieConsent />
        </>
      );
    }
    return (
      <>
        <LandingView />
        {isLegalView && <LegalDocViewer view={view} />}
        <CookieConsent />
      </>
    );
  }

  return (
    <>
      <AppShell />
      <WelcomeScreen />
      <SetupWizard />
      <Tour />
      <TourCompletion />
      {isLegalView && <LegalDocViewer view={view} />}
    </>
  );
}
