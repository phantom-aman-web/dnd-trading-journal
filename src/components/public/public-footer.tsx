"use client";

import { useNav, type ViewKey } from "@/lib/nav-store";
import { ArrowUpRight, ShieldCheck, Activity, LineChart, BookOpen, Layers } from "lucide-react";

interface FooterCol {
  title: string;
  links: { label: string; view?: ViewKey; targetId?: string }[];
}

export function PublicFooter() {
  const { navigate } = useNav();

  const handleLinkClick = (link: { label: string; view?: ViewKey; targetId?: string }) => {
    if (link.view) {
      navigate(link.view);
      return;
    }
    if (link.targetId) {
      const el = document.getElementById(link.targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const COLUMNS: FooterCol[] = [
    {
      title: "Platform",
      links: [
        { label: "Trading Journal", targetId: "journal" },
        { label: "Performance Analytics", targetId: "analytics" },
        { label: "Strategy Intelligence", targetId: "setups" },
        { label: "Interactive Calendar", targetId: "journal" },
        { label: "Trade Execution Detail", targetId: "journal" },
      ],
    },
    {
      title: "Trading Tools",
      links: [
        { label: "Prop Firm Challenge Tracker", targetId: "tools" },
        { label: "Position Sizing Calculator", targetId: "tools" },
        { label: "Trading To-Do & Watchlists", targetId: "tools" },
        { label: "Multi-Market Coverage", targetId: "markets" },
      ],
    },
    {
      title: "Legal & Privacy",
      links: [
        { label: "Privacy Policy", view: "privacy" },
        { label: "Terms of Service", view: "terms" },
        { label: "Cookie Policy", view: "cookies" },
      ],
    },
    {
      title: "Access",
      links: [
        { label: "Sign In", view: "signin" },
        { label: "Create Account", view: "signup" },
        { label: "Platform Overview", targetId: "platform" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/10 bg-[#060913] text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand Column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 via-cyan-500 to-blue-700 p-0.5 shadow-md shadow-blue-900/30 ring-1 ring-white/20">
                <div className="w-full h-full bg-[#0B1021] rounded-[10px] flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    className="h-5 w-5 text-cyan-300"
                  >
                    <path d="M12 3 L20 20 L15.5 20 L12 11 L8.5 20 L4 20 Z" fill="currentColor" fillOpacity="0.25" />
                    <circle cx="12" cy="8" r="1.6" fill="#10B981" stroke="#10B981" />
                  </svg>
                </div>
              </div>
              <span className="font-bold text-lg tracking-tight text-white font-[family-name:var(--font-jakarta)]">
                AlphaPips
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mb-6">
              A sophisticated trading journal and performance analytics platform. Turn every execution into actionable
              edge, manage risk with precision, and build lasting consistency across markets.
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Zero-Knowledge Privacy
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                Encrypted Journal
              </span>
            </div>
          </div>

          {/* Link Columns */}
          {COLUMNS.map((col) => (
            <div key={col.title} className="col-span-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4 font-mono">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => handleLinkClick(link)}
                      className="text-xs text-slate-400 hover:text-white transition-colors text-left flex items-center gap-1 group"
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Disclaimers */}
        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} AlphaPips. All rights reserved.</p>
          <p className="max-w-2xl text-[11px] leading-relaxed text-slate-400">
            AlphaPips is a trading journaling, analytics and performance-tracking product. AlphaPips does not provide
            brokerage services, execute trades, or offer personalized financial advice. Past performance shown in
            illustrations is for demonstrative purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
}
