"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, type AuthUser } from "@/lib/auth-store";
import { useNav, ALL_APP_VIEWS, type ViewKey } from "@/lib/nav-store";
import { useOnboarding } from "@/lib/onboarding-store";
import { LandingView } from "@/components/views/landing-view";
import { AuthView } from "@/components/views/auth-view";
import { AppShell } from "@/components/app-shell";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";
import { SetupWizard } from "@/components/onboarding/setup-wizard";
import { Tour, TourCompletion } from "@/components/onboarding/tour";
import { CookieConsent } from "@/components/public/cookie-consent";
import { LegalDocViewer } from "@/components/public/legal-doc-viewer";

const LEGAL_VIEWS: ViewKey[] = ["terms", "privacy", "cookies"];

interface ClientHomeProps {
  initialUser: AuthUser | null;
}

export function ClientHome({ initialUser }: ClientHomeProps) {
  // Synchronize the auth store state synchronously during initial setup
  // so the first hydration render matches the SSR render exactly.
  const [initialUserBound] = useState(() => {
    if (initialUser) {
      useAuth.setState({ user: initialUser, loading: false, authChecked: true });
    } else {
      useAuth.setState({ user: null, loading: false, authChecked: true });
    }
    return true;
  });

  const { user, fetchUser, authChecked } = useAuth();
  const { view, navigate } = useNav();
  const setState = useOnboarding((s) => s.setState);
  const bootstrappedRef = useRef<string | null>(null);

  // Background silent revalidation of session
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Global Keyboard shortcut: Cmd/Ctrl+K for command palette
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

  // When authenticated, if active view is a landing or auth screen, seamlessly transition to dashboard
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
        // On error, leave state alone
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, setState]);

  // Sign-out flag clean up
  const isSigningOut = typeof window !== "undefined" && sessionStorage.getItem("dnd-signing-out") === "1";
  useEffect(() => {
    if (isSigningOut && typeof window !== "undefined") {
      sessionStorage.removeItem("dnd-signing-out");
    }
  }, [isSigningOut]);

  const isLegalView = LEGAL_VIEWS.includes(view);

  // Authenticated user: render the full application AppShell
  if (user && !isSigningOut) {
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

  // During auth check if initialUser was known and not signing out
  if (!authChecked && initialUser && !isSigningOut) {
    return <AppShell />;
  }

  // Unauthenticated user: render AuthView or LandingView
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
