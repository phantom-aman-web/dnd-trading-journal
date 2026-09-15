"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding-store";
import { ArrowRight, X } from "lucide-react";

export function WelcomeScreen() {
  const { state, setState } = useOnboarding();
  const visible = state === "welcome";

  // Escape key dismisses to "skipped".
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setState("skipped");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, setState]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-subtitle"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300"
    >
      <button
        aria-label="Close welcome screen"
        onClick={() => setState("skipped")}
        className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-xl animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center px-6 py-10">
          {/* Brand mark */}
          <div className="flex items-center gap-2 mb-5">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
              D
            </div>
            <span className="font-semibold tracking-tight text-xl">DnD</span>
          </div>

          <h1 id="welcome-title" className="text-2xl md:text-3xl font-semibold tracking-tight">
            Let&apos;s set up your workspace.
          </h1>
          <p
            id="welcome-subtitle"
            className="mt-2 text-sm md:text-base text-muted-foreground"
          >
            Trade less emotionally. Review more intelligently.
          </p>

          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            A few quick steps will personalize DnD around how you trade.
          </p>
        </div>

        {/* Action */}
        <div className="flex justify-center px-6 pb-8">
          <Button
            size="lg"
            onClick={() => setState("setup")}
            className="w-full sm:w-auto"
          >
            Get Started
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
