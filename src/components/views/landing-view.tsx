"use client";

import { useState } from "react";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { useNav } from "@/lib/nav-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  TrendingUp,
  Shield,
  Target,
  BarChart3,
  Layers,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  Sliders,
  Calculator,
  ListTodo,
  Check,
  ChevronRight,
  Lock,
  Zap,
  Activity,
  Award,
  ArrowUpRight,
  Compass,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";

export function LandingView() {
  const { navigate } = useNav();

  return (
    <div className="min-h-screen flex flex-col bg-[#070B18] text-foreground font-inter antialiased selection:bg-purple-500/20 selection:text-purple-300">
      {/* SECTION 1 — NAVIGATION */}
      <PublicHeader />

      <main className="flex-1 w-full">
        {/* SECTION 2 — HERO (Reference 1: Deep Navy + Purple Glow + Floating Glass Cards) */}
        <HeroSection
          onPrimary={() => navigate("signup")}
          onSecondary={() => {
            const el = document.getElementById("platform");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* SECTION 3 — CAPABILITIES STRIP */}
        <CapabilitiesStrip />

        {/* SECTION 4 — PLATFORM INTRODUCTION (Reference 2: Light Lavender, Minimal Grid, Generous Whitespace) */}
        <PlatformIntroSection />

        {/* SECTION 5 — TRADING JOURNAL (Trades Log & Execution Details) */}
        <TradingJournalSection onAction={() => navigate("signup")} />

        {/* SECTION 6 — PERFORMANCE ANALYTICS */}
        <PerformanceAnalyticsSection />

        {/* SECTION 7 — STRATEGY INTELLIGENCE (Setups & Checklists) */}
        <StrategyIntelligenceSection />

        {/* SECTION 8 — TRADING TOOLS (Prop Tracker, Risk Calculator, To-Do) */}
        <TradingToolsSection />

        {/* SECTION 9 — MULTI-MARKET SUPPORT */}
        <MultiMarketSection />

        {/* SECTION 10 — FINAL CTA (Deep Navy & Purple Atmosphere) */}
        <FinalCtaSection
          onPrimary={() => navigate("signup")}
          onSecondary={() => navigate("signin")}
        />
      </main>

      {/* SECTION 11 — FOOTER */}
      <PublicFooter />
    </div>
  );
}

/* ================================================================== */
/* SECTION 2: HERO                                                    */
/* ================================================================== */

function HeroSection({
  onPrimary,
  onSecondary,
}: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <section
      id="hero"
      className="relative flex items-center overflow-hidden bg-[#070B18] text-white pt-12 pb-20 lg:pt-20 lg:pb-28"
    >
      {/* Atmospheric lighting, glowing abstract shapes and radial gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-center soft purple illumination */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-purple-600/20 via-indigo-600/10 to-transparent blur-[140px] rounded-full" />
        
        {/* Right-side atmospheric blue glow behind floating cards */}
        <div className="absolute top-[20%] right-[-5%] w-[650px] h-[650px] bg-gradient-to-br from-indigo-500/25 via-purple-700/20 to-blue-600/10 blur-[130px] rounded-full animate-pulse-glow" />

        {/* Subtle geometric grid backdrop */}
        <div className="absolute inset-0 bg-grid-white opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]" />

        {/* Thin perspective horizon line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Hero Copy */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Tag pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Next-Gen Trading Journal &amp; Analytics OS</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white font-jakarta leading-[1.12]">
              Trade with clarity. <br />
              <span className="bg-gradient-to-r from-purple-300 via-indigo-200 to-white bg-clip-text text-transparent">
                Perform with purpose.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-slate-300/90 leading-relaxed max-w-xl font-normal">
              AlphaPips helps you turn every trade into meaningful performance data.
              Journal your execution, analyze your strategies, understand your risk,
              and build greater consistency.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="lg"
                onClick={onPrimary}
                className="relative group overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 bg-[length:200%_auto] hover:bg-right transition-all duration-300 text-white font-semibold text-sm px-6 h-12 rounded-xl shadow-xl shadow-purple-600/30 border border-purple-400/30"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={onSecondary}
                className="h-12 px-5 text-sm font-medium text-slate-200 border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white rounded-xl backdrop-blur-sm transition-all"
              >
                Explore the Platform
              </Button>
            </div>

            {/* Value Highlights */}
            <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Multi-Market (Forex, Gold, Indices, Crypto)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Prop Firm Challenge Tracking</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Zero Broker Execution Required</span>
              </div>
            </div>
          </div>

          {/* Right Column: Floating Financial Interface Visualization (Reference 1 Glass Design) */}
          <div className="lg:col-span-6 relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[540px]">
              {/* Glow aura directly beneath cards */}
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 via-indigo-600/20 to-blue-500/10 blur-3xl rounded-3xl" />

              {/* Main Financial Glass Interface Card */}
              <div className="relative rounded-2xl border border-white/15 bg-[#0C1224]/90 backdrop-blur-xl p-5 sm:p-7 shadow-2xl shadow-black/60 text-white space-y-5 mt-4 sm:mt-2">
                {/* Interface Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10 pt-2 sm:pt-0">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 font-jakarta">
                        PERFORMANCE SUMMARY
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Active Account • USD ($)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Live Feed
                    </span>
                    <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      Last 30 Days
                    </span>
                  </div>
                </div>

                {/* Big Metric Display */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Net Realized P&amp;L</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white font-mono-num tracking-tight mt-0.5 flex items-baseline gap-2">
                      <span className="text-emerald-400">+$18,450.00</span>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        +24.6%
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Win Rate</div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl sm:text-3xl font-bold text-white font-mono-num tracking-tight">
                        64.2%
                      </span>
                      <span className="text-xs text-slate-400 font-mono">36W / 20L</span>
                    </div>
                    {/* Visual mini progress bar */}
                    <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden flex">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: "64.2%" }} />
                      <div className="bg-rose-400 h-full rounded-full" style={{ width: "35.8%" }} />
                    </div>
                  </div>
                </div>

                {/* SVG Equity Curve Chart */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>Account Equity Progression</span>
                    <span className="text-purple-300 font-mono-num font-medium">+31.2R Total</span>
                  </div>
                  <div className="h-28 w-full rounded-xl bg-gradient-to-b from-purple-950/30 to-indigo-950/10 border border-white/10 p-2 relative overflow-hidden">
                    <svg viewBox="0 0 400 90" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid guideline */}
                      <line x1="0" y1="25" x2="400" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <line x1="0" y1="55" x2="400" y2="55" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      {/* Area Fill */}
                      <path
                        d="M0,75 Q40,65 80,68 T160,45 T240,48 T320,20 T400,12 L400,90 L0,90 Z"
                        fill="url(#chartGradient)"
                      />
                      {/* Main Stroke */}
                      <path
                        d="M0,75 Q40,65 80,68 T160,45 T240,48 T320,20 T400,12"
                        fill="none"
                        stroke="#A78BFA"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {/* Peak dot with pulse marker */}
                      <circle cx="400" cy="12" r="4.5" fill="#10B981" />
                      <circle cx="400" cy="12" r="7" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.6" />
                    </svg>
                  </div>
                </div>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10 text-center">
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Profit Factor</div>
                    <div className="text-sm font-bold text-white font-mono-num mt-0.5">2.41</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Expectancy</div>
                    <div className="text-sm font-bold text-purple-300 font-mono-num mt-0.5">+1.35 R</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Avg Win/Loss</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono-num mt-0.5">2.14 : 1</div>
                  </div>
                </div>
              </div>

              {/* Floating Element 1: Strategy Tag (Top Left) */}
              <div className="hidden sm:flex absolute -top-5 -left-4 z-20 rounded-xl border border-white/20 bg-[#0F162D]/95 backdrop-blur-md px-3 py-2 shadow-xl items-center gap-2.5 animate-float-subtle">
                <div className="h-7 w-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-white">Liquidity Sweep v2.4</div>
                  <div className="text-[10px] text-emerald-400 font-mono-num">71.4% Win Rate • +14.2R</div>
                </div>
              </div>

              {/* Floating Element 2: Prop Firm Risk Safeguard (Bottom Right) */}
              <div className="hidden sm:flex absolute -bottom-5 -right-5 rounded-xl border border-white/20 bg-[#0F162D]/90 backdrop-blur-md p-3 shadow-xl items-center gap-3 animate-float-reverse">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-white">Daily Loss Guard</div>
                  <div className="text-[10px] text-slate-300 font-mono-num">
                    0.8% / 3.0% Max <span className="text-emerald-400 font-semibold">• Safe</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Illustrative data note */}
        <div className="mt-8 text-center lg:text-right">
          <p className="text-[11px] text-slate-400 italic">
            * Illustrative Sample Data — Not Real Customer Trading Results. Demonstrates AlphaPips performance analytics engine.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* SECTION 3: CAPABILITIES STRIP                                      */
/* ================================================================== */

function CapabilitiesStrip() {
  const capabilities = [
    {
      title: "Trade Journal",
      desc: "Full execution & psychology tracking",
      icon: BookOpenIcon,
    },
    {
      title: "Performance Analytics",
      desc: "Expectancy, profit factor & R-metrics",
      icon: BarChart3,
    },
    {
      title: "Strategy Tracking",
      desc: "Rule checklists & version history",
      icon: Layers,
    },
    {
      title: "Risk Management",
      desc: "Dynamic sizing & account guards",
      icon: Shield,
    },
    {
      title: "Prop Firm Tracking",
      desc: "Drawdown & consistency monitoring",
      icon: Target,
    },
  ];

  return (
    <section className="border-y border-white/10 bg-[#080D1D] relative z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          {capabilities.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="group flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 group-hover:bg-purple-500/20 transition-all">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {cap.title}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    {cap.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BookOpenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/* ================================================================== */
/* SECTION 4: PLATFORM INTRODUCTION (Reference 2: Light Lavender)     */
/* ================================================================== */

function PlatformIntroSection() {
  return (
    <section id="platform" className="relative py-24 md:py-32 bg-[#F6F6FC] text-slate-900 overflow-hidden">
      {/* Delicate background grid & soft purple lighting inspired by Reference 2 */}
      <div className="absolute inset-0 bg-grid-purple opacity-70 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-purple-200/40 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Centered Heading Composition */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            <span>The Performance Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 font-jakarta leading-tight">
            Everything you need to <br className="hidden sm:block" />
            <span className="text-purple-600">understand your trading.</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            AlphaPips brings trading records, strategy performance, analytics, and
            trading workflows into one organized platform. Move past fragmented notes
            and basic spreadsheets into a refined system built for precision.
          </p>
        </div>

        {/* 3 Structured Pillars Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Pillar 1 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm mb-5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              01
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-jakarta mb-2">
              Connect Decisions, Not Just Numbers
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              A standard spreadsheet only stores entry, exit, and cash balance.
              AlphaPips links the market context, strategy setup, rulebook compliance,
              chart evidence, and emotional discipline behind every execution.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-purple-700">
              <span>Full trade contextualization</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              02
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-jakarta mb-2">
              True Statistical Edge Analysis
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Uncover what actually generates your profit factor. Filter performance
              by trading session, holding duration, instrument volatility, and setup
              versions with sample-size aware metric distributions.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-indigo-700">
              <span>Expectancy &amp; session heatmaps</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              03
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-jakarta mb-2">
              Iterate Setups Like Versioned Code
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Strategies evolve over time. Track setup rule checklists, compare
              version 1 against version 2, and verify whether a rule alteration
              enhanced your win rate or added unnecessary restriction.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-blue-700">
              <span>Version control &amp; checklist audit</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* SECTION 5: TRADING JOURNAL                                         */
/* ================================================================== */

function TradingJournalSection({ onAction }: { onAction: () => void }) {
  const [selectedFilter, setSelectedFilter] = useState("all");

  const sampleTrades = [
    {
      id: "TRD-842",
      symbol: "EUR/USD",
      market: "Forex",
      type: "LONG",
      setup: "London Open MSS",
      entry: "1.08420",
      exit: "1.08900",
      rMultiple: "+2.40R",
      pnl: "+$1,240.00",
      positive: true,
      rules: "4/4 (100%)",
      emotion: "Disciplined",
    },
    {
      id: "TRD-843",
      symbol: "XAU/USD",
      market: "Gold",
      type: "SHORT",
      setup: "Liquidity Sweep v2.1",
      entry: "2,514.50",
      exit: "2,498.00",
      rMultiple: "+3.30R",
      pnl: "+$1,860.00",
      positive: true,
      rules: "5/5 (100%)",
      emotion: "Focused",
    },
    {
      id: "TRD-844",
      symbol: "US30",
      market: "Indices",
      type: "LONG",
      setup: "NY Breakout",
      entry: "40,820",
      exit: "40,740",
      rMultiple: "-1.00R",
      pnl: "-$500.00",
      positive: false,
      rules: "3/4 (75%)",
      emotion: "Impatience",
    },
    {
      id: "TRD-845",
      symbol: "BTC/USD",
      market: "Crypto",
      type: "LONG",
      setup: "Asian Range Retest",
      entry: "58,400",
      exit: "59,980",
      rMultiple: "+2.70R",
      pnl: "+$1,350.00",
      positive: true,
      rules: "4/4 (100%)",
      emotion: "Calm",
    },
  ];

  return (
    <section id="journal" className="py-24 md:py-32 bg-white text-slate-900 border-t border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Section Narrative */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold tracking-wide">
              <span>TRADES LOG &amp; DETAIL</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-jakarta leading-tight">
              Beyond entry and exit prices. <br />
              <span className="text-purple-600">A journal that records your entire decision process.</span>
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Recording P&amp;L in isolation is like looking at a scoreboard without
              reviewing the game film. AlphaPips connects the pre-trade bias, rule compliance,
              chart screenshots, and psychological mindset behind each trade.
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Pre-Trade Checklists &amp; Rules</h4>
                  <p className="text-xs text-slate-500">
                    Verify every condition is met before risking capital. Measure how rule adherence correlates with profit.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Psychology &amp; Behavioral Tracking</h4>
                  <p className="text-xs text-slate-500">
                    Tag emotional triggers (FOMO, hesitation, overconfidence) to uncover your costliest behavioral leaks.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Chart Evidence &amp; Visual Notes</h4>
                  <p className="text-xs text-slate-500">
                    Store high-resolution chart screenshots for entry, management, and exit with dedicated trade commentary.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={onAction}
                className="bg-slate-900 text-white hover:bg-slate-800 font-medium text-xs px-5 py-2.5 rounded-lg shadow"
              >
                Start Journaling Free
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Right: Interactive / High-Fidelity Trades Log UI Mockup */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 shadow-xl shadow-slate-200/50">
              {/* Mockup Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 font-jakarta">TRADES LOG</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    4 Executions Displayed
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setSelectedFilter("all")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      selectedFilter === "all" ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    All Accounts
                  </button>
                  <button
                    onClick={() => setSelectedFilter("prop")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      selectedFilter === "prop" ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Funded 100K
                  </button>
                </div>
              </div>

              {/* Table Visualization */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-mono text-[11px]">
                      <th className="pb-2 font-medium">SYMBOL</th>
                      <th className="pb-2 font-medium">SETUP</th>
                      <th className="pb-2 font-medium">SIDE</th>
                      <th className="pb-2 font-medium text-right">R-MULTIPLE</th>
                      <th className="pb-2 font-medium text-right">NET P&amp;L</th>
                      <th className="pb-2 font-medium text-center">CHECKLIST</th>
                      <th className="pb-2 font-medium">STATE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sampleTrades.map((t) => (
                      <tr key={t.id} className="hover:bg-white/80 transition-colors">
                        <td className="py-3 font-semibold text-slate-900 font-mono">
                          {t.symbol}
                          <span className="block text-[10px] text-slate-400 font-sans">{t.market}</span>
                        </td>
                        <td className="py-3 text-slate-700">{t.setup}</td>
                        <td className="py-3">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded font-mono text-[10px] font-bold",
                              t.type === "LONG"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            )}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "py-3 font-mono-num font-bold text-right",
                            t.positive ? "text-emerald-600" : "text-rose-600"
                          )}
                        >
                          {t.rMultiple}
                        </td>
                        <td
                          className={cn(
                            "py-3 font-mono-num font-bold text-right",
                            t.positive ? "text-emerald-600" : "text-rose-600"
                          )}
                        >
                          {t.pnl}
                        </td>
                        <td className="py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {t.rules}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {t.emotion}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sample Data Notice */}
              <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Illustrative Sample Data — Not Real Customer Trading Results</span>
                <span className="font-mono text-purple-600 font-medium">Export CSV / JSON / PDF ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* SECTION 6: PERFORMANCE ANALYTICS                                   */
/* ================================================================== */

function PerformanceAnalyticsSection() {
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "instruments">("overview");

  return (
    <section id="analytics" className="py-24 md:py-32 bg-[#F8F8FD] text-slate-900 border-t border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold tracking-wide uppercase">
            <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
            <span>Advanced Analytics</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 font-jakarta leading-tight">
            Data-driven insight, <br className="hidden sm:block" />
            <span className="text-indigo-600">not emotional guesswork.</span>
          </h2>

          <p className="text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Gain clarity on what actually drives your profitability with deep statistical
            breakdowns across instruments, sessions, holding times, and strategy setups.
          </p>
        </div>

        {/* Analytics Switcher Tabs */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300">
            <button
              onClick={() => setActiveTab("overview")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === "overview"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Overview &amp; Expectancy
            </button>
            <button
              onClick={() => setActiveTab("sessions")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === "sessions"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Session &amp; Day-of-Week
            </button>
            <button
              onClick={() => setActiveTab("instruments")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === "instruments"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Instrument Breakdown
            </button>
          </div>
        </div>

        {/* Analytics Interactive Content Card */}
        <div className="mt-10 max-w-5xl mx-auto rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Stat Pillars */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-500 font-medium">Expectancy (R/Trade)</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1 text-purple-600">+1.42 R</div>
                  <div className="text-[11px] text-slate-500 mt-1">Expected return per trade</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-500 font-medium">Profit Factor</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">2.38</div>
                  <div className="text-[11px] text-slate-500 mt-1">Gross wins / Gross losses</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-500 font-medium">Average Win / Loss</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">2.18 : 1</div>
                  <div className="text-[11px] text-slate-500 mt-1">Payoff ratio metric</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-500 font-medium">Avg Holding Duration</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">1h 42m</div>
                  <div className="text-[11px] text-slate-500 mt-1">Intraday execution profile</div>
                </div>
              </div>

              {/* Graphical Expectancy R-Distribution Visualization */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">R-Multiple Outcome Distribution</h4>
                    <p className="text-xs text-slate-500">Distribution of executed trades across risk-reward multiples</p>
                  </div>
                  <span className="text-xs font-mono text-purple-600 font-semibold">56 Sample Trades (Illustrative)</span>
                </div>

                <div className="grid grid-cols-6 gap-2 text-center text-xs">
                  <div className="space-y-2">
                    <div className="h-28 flex items-end justify-center">
                      <div className="w-full bg-rose-400 rounded-t" style={{ height: "35%" }} />
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">-1.0R</div>
                    <div className="font-bold text-slate-700">14 (25%)</div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-28 flex items-end justify-center">
                      <div className="w-full bg-rose-300 rounded-t" style={{ height: "15%" }} />
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">-0.5R</div>
                    <div className="font-bold text-slate-700">6 (11%)</div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-28 flex items-end justify-center">
                      <div className="w-full bg-slate-300 rounded-t" style={{ height: "10%" }} />
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">0.0R (BE)</div>
                    <div className="font-bold text-slate-700">4 (7%)</div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-28 flex items-end justify-center">
                      <div className="w-full bg-emerald-300 rounded-t" style={{ height: "45%" }} />
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">+1.5R</div>
                    <div className="font-bold text-slate-700">18 (32%)</div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-28 flex items-end justify-center">
                      <div className="w-full bg-emerald-400 rounded-t" style={{ height: "25%" }} />
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">+3.0R</div>
                    <div className="font-bold text-slate-700">10 (18%)</div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-28 flex items-end justify-center">
                      <div className="w-full bg-emerald-500 rounded-t" style={{ height: "12%" }} />
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">+5.0R+</div>
                    <div className="font-bold text-slate-700">4 (7%)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "sessions" && (
            <div className="space-y-6">
              <h4 className="text-sm font-bold text-slate-900">Session Profitability &amp; Win Rate</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">London Session</span>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      +18.4R
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    <div>Win Rate: <strong className="text-slate-900">72.4%</strong> (21W / 8L)</div>
                    <div>Avg Win: <strong className="text-slate-900">+2.4R</strong></div>
                    <div>High conviction liquidity cleans</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">New York Session</span>
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                      +12.8R
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    <div>Win Rate: <strong className="text-slate-900">60.0%</strong> (12W / 8L)</div>
                    <div>Avg Win: <strong className="text-slate-900">+2.8R</strong></div>
                    <div>High volatility macro moves</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">Asian Session</span>
                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                      +0.0R (Flat)
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    <div>Win Rate: <strong className="text-slate-900">42.8%</strong> (3W / 4L)</div>
                    <div>Avg Win: <strong className="text-slate-900">+1.2R</strong></div>
                    <div>Range compression environment</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "instruments" && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900">Performance By Asset Class</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono">XAU/USD (Gold)</span>
                    <Badge variant="outline" className="text-[10px]">Precious Metals</Badge>
                  </div>
                  <div className="flex items-center gap-6">
                    <span>22 Trades</span>
                    <span className="font-bold text-emerald-600 font-mono-num">+16.4R (+$9,840)</span>
                    <span className="font-semibold">68% Win</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono">EUR/USD</span>
                    <Badge variant="outline" className="text-[10px]">Forex Major</Badge>
                  </div>
                  <div className="flex items-center gap-6">
                    <span>18 Trades</span>
                    <span className="font-bold text-emerald-600 font-mono-num">+11.2R (+$6,720)</span>
                    <span className="font-semibold">61% Win</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono">NAS100 (Nasdaq)</span>
                    <Badge variant="outline" className="text-[10px]">Indices</Badge>
                  </div>
                  <div className="flex items-center gap-6">
                    <span>16 Trades</span>
                    <span className="font-bold text-emerald-600 font-mono-num">+3.6R (+$1,890)</span>
                    <span className="font-semibold">50% Win</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* SECTION 7: STRATEGY INTELLIGENCE (Setups & Checklists)             */
/* ================================================================== */

function StrategyIntelligenceSection() {
  return (
    <section id="setups" className="py-24 md:py-32 bg-white text-slate-900 border-t border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Strategy Mockup with Checklist & Version History */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-xl space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 font-jakarta">
                      Liquidity Sweep Strategy
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                      v2.2 ACTIVE
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Forex &amp; Gold Intraday Setup</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 font-mono-num">+18.4R Net</div>
                  <div className="text-[10px] text-slate-400">32 Executions Logged</div>
                </div>
              </div>

              {/* Version Comparison Card */}
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/60 text-xs space-y-2">
                <div className="font-semibold text-purple-900 flex items-center justify-between">
                  <span>Version Iteration Comparison</span>
                  <span className="text-[10px] text-purple-600 font-mono">v1.1 vs v2.2</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="p-2.5 rounded bg-white/80 border border-purple-100">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">v1.1 (Legacy)</div>
                    <div className="text-sm font-bold text-slate-700 mt-0.5">52% Win • 1.45 PF</div>
                    <div className="text-[10px] text-slate-500">Without 5m MSS filter</div>
                  </div>
                  <div className="p-2.5 rounded bg-white border border-purple-300 shadow-sm">
                    <div className="text-[10px] text-purple-700 font-bold uppercase font-mono">v2.2 (Current)</div>
                    <div className="text-sm font-bold text-emerald-600 mt-0.5">68% Win • 2.38 PF</div>
                    <div className="text-[10px] text-purple-700 font-medium">+16% Win rate increase</div>
                  </div>
                </div>
              </div>

              {/* Built-in Strategy Checklist */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono">
                  Pre-Execution Checklist Rules
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
                    <div className="h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span className="text-slate-800 font-medium">1. Higher-timeframe liquidity pool swept</span>
                    <span className="ml-auto text-[10px] font-mono text-slate-400">Required</span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
                    <div className="h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span className="text-slate-800 font-medium">2. 5M Market Structure Shift (MSS) candle close</span>
                    <span className="ml-auto text-[10px] font-mono text-slate-400">Required</span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
                    <div className="h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span className="text-slate-800 font-medium">3. Fair Value Gap (FVG) / Orderblock retest entry</span>
                    <span className="ml-auto text-[10px] font-mono text-slate-400">Required</span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
                    <div className="h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span className="text-slate-800 font-medium">4. Maximum risk strict limit &le; 1.0% of account</span>
                    <span className="ml-auto text-[10px] font-mono text-slate-400">Safety Rule</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Narrative Description */}
          <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold tracking-wide">
              <span>SETUPS &amp; CHECKLISTS</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-jakarta leading-tight">
              Treat your trading setups <br />
              <span className="text-purple-600">like living, versioned systems.</span>
            </h2>

            <p className="text-base text-slate-600 leading-relaxed">
              Every experienced trader refines their edge over time. AlphaPips treats
              your trading strategies with the rigour of engineering code: maintain
              custom rulebooks, enforce pre-trade checklists, and compare version history
              to confirm your adjustments actually improved expectancy.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Quantifiable Rule Compliance</h4>
                  <p className="text-xs text-slate-500">
                    See exactly how many trades followed 100% of your rules versus those that deviated.
                    Determine how much money lack of discipline cost you.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Version History &amp; Side-by-Side Audits</h4>
                  <p className="text-xs text-slate-500">
                    Compare performance between v1.0 and v2.0 of any setup. Never wonder again whether
                    your recent rule change was genuinely profitable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* SECTION 8: TRADING TOOLS (Prop Tracker, Risk Calc, Trading To-Do)  */
/* ================================================================== */

function TradingToolsSection() {
  return (
    <section id="tools" className="py-24 md:py-32 bg-[#F6F6FC] text-slate-900 border-t border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold tracking-wide uppercase">
            <Sliders className="h-3.5 w-3.5 text-purple-600" />
            <span>Essential Workflows</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 font-jakarta leading-tight">
            Integrated tools designed for <br className="hidden sm:block" />
            <span className="text-purple-600">capital preservation.</span>
          </h2>

          <p className="text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Professional trading isn't just journaling after the fact—it requires
            proactive risk calculation, rule monitoring, and daily pre-market preparation.
          </p>
        </div>

        {/* 3 Dedicated Trading Tools Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Tool 1: Prop Firm Challenge Tracker */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-5">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-jakarta mb-2">
                Prop Firm Challenge Tracker
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Protect your evaluation accounts with real-time risk guards and threshold alerts.
              </p>

              {/* Visual Demo Pill */}
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 font-medium">Daily Loss Limit (3.0%)</span>
                    <span className="font-mono font-bold text-emerald-600">0.8% used</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "26%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 font-medium">Profit Target ($10,000)</span>
                    <span className="font-mono font-bold text-purple-600">$7,450 / 74.5%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600 rounded-full" style={{ width: "74.5%" }} />
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Consistency rule: &le; 30% day</span>
                  <span className="text-emerald-600 font-semibold">✓ Compliant</span>
                </div>
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span>Daily loss limit warning banners</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span>Trailing &amp; static max drawdown calculation</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span>Minimum trading days tracking</span>
              </li>
            </ul>
          </div>

          {/* Tool 2: Risk & Position Sizing Calculator */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5">
                <Calculator className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-jakarta mb-2">
                Risk &amp; Position Calculator
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Calculate exact position sizing tailored to account equity, stop-loss distance, and instrument ticks.
              </p>

              {/* Visual Demo Pill */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Equity:</span>
                  <span className="font-bold text-slate-900">$100,000.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Risk Allocation:</span>
                  <span className="font-bold text-purple-600">1.0% ($1,000.00)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stop Distance:</span>
                  <span className="font-bold text-slate-900">18.5 Pips</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-sans">
                  <span className="text-xs font-semibold text-slate-700">Calculated Lots:</span>
                  <span className="font-mono font-bold text-sm text-emerald-600">5.40 Standard</span>
                </div>
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>Forex, Gold, Indices &amp; Crypto tick models</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>Instant position sizing recommendations</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>Preset risk thresholds (0.5%, 1%, 2%)</span>
              </li>
            </ul>
          </div>

          {/* Tool 3: Trading To-Do & Research */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
                <ListTodo className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-jakarta mb-2">
                Trading To-Do &amp; Watchlists
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Organize your pre-market routine, watchlist candidates, and session tasks in one distraction-free view.
              </p>

              {/* Visual Demo Pill */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                <div className="flex items-center gap-2 p-1.5 rounded bg-white border border-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-800 font-medium">Check High-Impact Red Folder News</span>
                  <span className="ml-auto text-[10px] text-emerald-600 font-mono">✓</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-white border border-slate-200">
                  <span className="h-2 w-2 rounded-full bg-purple-500" />
                  <span className="text-slate-800 font-medium">EUR/USD 1.0820 Liquidity sweep alert</span>
                  <span className="ml-auto text-[10px] text-purple-600 font-mono">Watch</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-white border border-slate-200">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-slate-600">Daily journal review &amp; tagging</span>
                  <span className="ml-auto text-[10px] text-slate-400 font-mono">Pending</span>
                </div>
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Pre-market ritual checklists</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Session watchlist &amp; key level tagging</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Custom tag &amp; category sorting</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* SECTION 9: MULTI-MARKET SUPPORT                                    */
/* ================================================================== */

function MultiMarketSection() {
  const markets = [
    {
      name: "Forex",
      tag: "Currencies",
      desc: "EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, GBP/JPY",
      formula: "Standard, Mini & Micro pip models",
      icon: "FX",
    },
    {
      name: "Gold (XAU/USD)",
      tag: "Precious Metals",
      desc: "Spot gold bullion with custom point & contract scaling",
      formula: "$10/point standard lot calibration",
      icon: "AU",
    },
    {
      name: "Silver (XAG/USD)",
      tag: "Precious Metals",
      desc: "High-beta silver spot contracts and custom tick calculations",
      formula: "$50/point contract sizing",
      icon: "AG",
    },
    {
      name: "Indices",
      tag: "Equity Benchmarks",
      desc: "US30 (Dow Jones), NAS100 (Nasdaq), SPX500, GER40 (DAX)",
      formula: "Point-based index risk calculation",
      icon: "IX",
    },
    {
      name: "Crypto",
      tag: "Digital Assets",
      desc: "BTC/USD, ETH/USD, SOL/USD 24/7 continuous journaling",
      formula: "Direct USD or satoshi risk mapping",
      icon: "CR",
    },
  ];

  return (
    <section id="markets" className="py-24 md:py-32 bg-white text-slate-900 border-t border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold tracking-wide">
            <span>UNIVERSAL ASSET COVERAGE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 font-jakarta leading-tight">
            Built for active traders <br className="hidden sm:block" />
            <span className="text-purple-600">across global markets.</span>
          </h2>

          <p className="text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Trade what fits your edge. AlphaPips handles pip and point calculations
            accurately across every supported asset class.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {markets.map((m) => (
            <div
              key={m.name}
              className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-8 w-8 rounded-lg bg-purple-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                    {m.icon}
                  </div>
                  <span className="text-[10px] font-mono font-semibold uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {m.tag}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm font-jakarta mb-1.5">
                  {m.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {m.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/80 text-[10px] font-mono text-slate-400">
                {m.formula}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* SECTION 10: FINAL CTA (Deep Navy & Purple Atmosphere)              */
/* ================================================================== */

function FinalCtaSection({
  onPrimary,
  onSecondary,
}: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <section className="relative overflow-hidden bg-[#070B18] text-white py-24 md:py-32 border-t border-white/10">
      {/* Background glow and subtle nebula effects inspired by Reference 1 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-gradient-to-r from-purple-600/25 via-indigo-600/20 to-blue-600/15 blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-grid-white opacity-30" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span>Elevate Your Edge Today</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white font-jakarta leading-tight">
          Your trading data deserves <br />
          <span className="bg-gradient-to-r from-purple-300 via-indigo-200 to-white bg-clip-text text-transparent">
            more than a spreadsheet.
          </span>
        </h2>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Build a clearer picture of your trading performance with AlphaPips.
          Turn every execution into measurable progress and disciplined consistency.
        </p>

        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <Button
            size="lg"
            onClick={onPrimary}
            className="relative group overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white font-semibold text-sm px-8 h-12 rounded-xl shadow-xl shadow-purple-600/30 border border-purple-400/30 transition-all duration-300 hover:scale-[1.02]"
          >
            <span className="relative z-10 flex items-center gap-2">
              <span>Get Started with AlphaPips</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={onSecondary}
            className="h-12 px-6 text-sm font-medium text-slate-200 border-white/20 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white rounded-xl backdrop-blur-sm"
          >
            Sign In to Your Journal
          </Button>
        </div>

        <div className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            Private encrypted journal
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-purple-400" />
            Zero broker connection required
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            Instant browser access
          </span>
        </div>
      </div>
    </section>
  );
}
