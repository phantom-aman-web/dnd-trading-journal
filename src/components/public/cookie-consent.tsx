"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Cookie, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";
import { useConsent } from "@/lib/consent-store";
import { useNav } from "@/lib/nav-store";

/**
 * Cookie consent banner — shown on first visit (or when the consent version
 * bumps) for anonymous visitors. Matches the DnD dashboard design system:
 * card surfaces, border tokens, muted-foreground copy, primary CTA.
 */
export function CookieConsent() {
  const {
    bannerVisible,
    settingsOpen,
    acceptAll,
    rejectNonEssential,
    openSettings,
    closeSettings,
    preferences,
    savePreferences,
    choice,
    timestamp,
  } = useConsent();

  // SSR guard: only render after mount (localStorage rehydration).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <>
      {/* Banner */}
      {bannerVisible && !settingsOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-banner-title"
          className="fixed bottom-0 left-0 right-0 z-[200] p-3 sm:p-4 animate-in slide-in-from-bottom-4 duration-300"
        >
          <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card text-card-foreground shadow-xl">
            <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
              {/* Icon + text */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Cookie className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="cookie-banner-title" className="text-sm font-semibold tracking-tight">
                    Cookies &amp; Privacy
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    DnD uses essential cookies for authentication and local storage
                    for preferences. No advertising or tracking cookies. See our{" "}
                    <LegalLink>Cookie Policy</LegalLink>.
                  </p>
                </div>
              </div>
              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openSettings}
                  className="text-muted-foreground"
                >
                  Cookie Settings
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={rejectNonEssential}
                >
                  Reject non-essential
                </Button>
                <Button size="sm" onClick={acceptAll}>
                  Accept all
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={(o) => (o ? openSettings() : closeSettings())}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Cookie Settings
            </DialogTitle>
            <DialogDescription>
              Manage how DnD uses cookies and local storage. Essential cookies
              are required for the service to function and cannot be disabled.
            </DialogDescription>
          </DialogHeader>

          <ConsentCategory
            label="Essential"
            description="Authentication, session management and security. Required for sign-in and account access."
            checked={preferences.essential}
            disabled
          />
          <ConsentCategory
            label="Functional"
            description="UI preferences: theme, density, sidebar state. Stored in local storage."
            checked={preferences.functional}
            disabled
          />
          <ConsentCategory
            label="Analytics"
            description="Anonymous usage statistics to help improve DnD. Currently not in use."
            checked={preferences.analytics}
            onCheckedChange={(v) => savePreferences({ analytics: v })}
          />

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {choice !== "undecided" && timestamp
                ? `Last updated ${new Date(timestamp).toLocaleDateString()}`
                : "No choice made yet."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={rejectNonEssential}>
                Reject all
              </Button>
              <Button size="sm" onClick={() => savePreferences({})}>
                Save preferences
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConsentCategory({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

/**
 * Internal link that opens the Cookie Policy document. Because the landing
 * page is a SPA view (not a route), we navigate to the legal view which
 * shows the document in a modal.
 */
function LegalLink({ children }: { children: React.ReactNode }) {
  const { navigate } = useNav();
  return (
    <button
      onClick={() => navigate("cookies")}
      className="inline-flex items-center gap-0.5 text-xs text-primary underline-offset-2 hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </button>
  );
}
