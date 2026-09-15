"use client";

import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { useNav } from "@/lib/nav-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowDown,
  ClipboardList,
  Camera,
  Search,
  BarChart3,
  Target,
  Brain,
  Check,
  RotateCcw,
} from "lucide-react";

const WORKFLOW = [
  { name: "PLAN", desc: "Set bias, levels, session and risk before the open.", icon: Target },
  { name: "TRADE", desc: "Take entries against your plan and capture decisions live.", icon: ClipboardList },
  { name: "DOCUMENT", desc: "Record evidence: screenshots, notes and psychology.", icon: Camera },
  { name: "REVIEW", desc: "Examine what worked, what did not, and why.", icon: Search },
  { name: "ANALYZE", desc: "Surface patterns with sample-size-aware metrics.", icon: BarChart3 },
  { name: "IMPROVE", desc: "Turn review into the next strategy version.", icon: Brain },
] as const;

export function LandingView() {
  const { navigate } = useNav();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1">
        {/* 1. HERO */}
        <HeroSection onPrimary={() => navigate("signup")} onSecondary={() => navigate("signin")} />

        {/* 2. WHY DnD */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 md:py-20 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
              Most journals record results.{" "}
              <span className="text-muted-foreground">DnD connects the decisions behind those results.</span>
            </h2>
            <p className="mt-5 text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              A row of trades tells you that you lost money. It does not tell you which behavior cost
              you, which strategy version was active, whether you followed your plan, or what to change
              tomorrow. DnD links every piece — strategy, setup, execution, evidence, psychology,
              review and analytics — so the same data answers questions instead of asking them.
            </p>
          </div>
        </section>

        {/* 3. HOW IT WORKS */}
        <section id="system-section" className="border-b border-border scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 md:py-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Six stages that turn each trade into a unit of learning.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Every trade moves through the same loop — from plan to improvement.
              </p>
            </div>
            <WorkflowFlow />
          </div>
        </section>

        {/* 4. FINAL CTA */}
        <section className="bg-[#1e2330] text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-20 md:py-24 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white">
              Your trading history already contains the answers.{" "}
              <span className="text-slate-400">DnD helps you find them.</span>
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate("signup")}
                className="bg-white text-[#1e2330] hover:bg-slate-100 border-0 font-semibold"
              >
                Start journaling
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("signin")}
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Explore DnD
              </Button>
            </div>
            <p className="mt-6 text-xs text-slate-400">
              Private workspace. Your data stays yours.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroSection({
  onPrimary,
  onSecondary,
}: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <section className="relative overflow-hidden bg-[#1e2330] text-white">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Private trading performance system
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl md:text-[3.25rem] font-semibold tracking-tight leading-[1.1] text-white">
            Connect the decisions behind your results.
          </h1>

          <p className="mt-5 text-base md:text-lg text-slate-300 leading-relaxed">
            DnD turns your trading history into a system for improvement — linking strategy,
            execution, evidence and review into one continuous loop.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={onPrimary}
              className="bg-white text-[#1e2330] hover:bg-slate-100 border-0 font-semibold"
            >
              Start journaling
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onSecondary}
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Explore DnD
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works — visual flow                                          */
/* ------------------------------------------------------------------ */

function WorkflowFlow() {
  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {WORKFLOW.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.name} className="contents">
              <div className="group flex-1 rounded-xl border border-border bg-card p-4 md:p-5 transition-colors hover:border-foreground/20">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-3 text-sm md:text-base font-semibold tracking-tight">
                  {s.name}
                </div>
                <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {s.desc}
                </div>
              </div>

              {i < WORKFLOW.length - 1 && (
                <div className="flex items-center justify-center text-muted-foreground/50">
                  <ArrowRight className="hidden md:block h-4 w-4" />
                  <ArrowDown className="md:hidden h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Loop indicator */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="h-px w-8 bg-border" />
        <RotateCcw className="h-3 w-3" />
        <span>Improvement feeds back into Plan</span>
        <span className="h-px w-8 bg-border" />
      </div>
    </div>
  );
}
