"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ArrowRight, Sparkles, ChevronRight } from "lucide-react";
import { useNav } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface PublicHeaderProps {
  className?: string;
}

export function PublicHeader({ className }: PublicHeaderProps) {
  const { navigate } = useNav();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Home", target: "hero" },
    { label: "Platform", target: "platform" },
    { label: "Features", target: "journal" },
    { label: "Analytics", target: "analytics" },
    { label: "Tools", target: "tools" },
    { label: "Markets", target: "markets" },
  ];

  function scrollToSection(targetId: string) {
    setMobileOpen(false);
    if (targetId === "hero") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-[#070B18]/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20"
          : "bg-[#070B18]/70 backdrop-blur-md border-b border-white/5",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <button
          onClick={() => scrollToSection("hero")}
          className="flex items-center gap-2.5 shrink-0 group focus:outline-none"
          aria-label="AlphaPips Home"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 p-0.5 shadow-lg shadow-purple-900/30 ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
            <div className="w-full h-full bg-[#0B1021] rounded-[10px] flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-purple-300"
              >
                <path d="M12 3 L20 20 L15.5 20 L12 11 L8.5 20 L4 20 Z" fill="currentColor" fillOpacity="0.25" />
                <circle cx="12" cy="8" r="1.6" fill="#10B981" stroke="#10B981" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-left">
            <span className="font-bold text-lg tracking-tight text-white font-[family-name:var(--font-jakarta)]">
              AlphaPips
            </span>
            <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
              PRO
            </span>
          </div>
        </button>

        {/* Center Desktop Navigation */}
        <nav
          className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 shadow-inner backdrop-blur-sm"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <button
              key={link.target}
              onClick={() => scrollToSection(link.target)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors rounded-full hover:bg-white/[0.08]"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right Authentication Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("signin")}
            className="hidden sm:inline-flex text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            Sign in
          </Button>

          <Button
            size="sm"
            onClick={() => navigate("signup")}
            className="relative group overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-lg shadow-purple-600/25 border border-purple-400/30 transition-all duration-200"
          >
            <span className="relative z-10 flex items-center gap-1.5">
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>

          {/* Mobile hamburger menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-slate-300 hover:text-white hover:bg-white/10 ml-1"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-[#070B18] border-l border-white/10 text-white p-6">
              <SheetHeader className="text-left pb-4 border-b border-white/10">
                <SheetTitle className="flex items-center gap-2 text-white">
                  <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      className="h-4 w-4 text-white"
                    >
                      <path d="M12 3 L20 20 L15.5 20 L12 11 L8.5 20 L4 20 Z" fill="currentColor" fillOpacity="0.25" />
                      <circle cx="12" cy="8" r="1.6" fill="#10B981" stroke="#10B981" />
                    </svg>
                  </div>
                  <span className="font-bold tracking-tight">AlphaPips</span>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1">
                  Navigation
                </div>
                {navLinks.map((link) => (
                  <button
                    key={link.target}
                    onClick={() => scrollToSection(link.target)}
                    className="flex items-center justify-between px-3.5 py-2.5 text-sm text-slate-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
                  >
                    <span>{link.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))}

                <div className="h-px bg-white/10 my-4" />

                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1">
                  Account
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("signin");
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 text-sm text-slate-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <span>Sign in</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("signup");
                  }}
                  className="mt-2 flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg shadow-purple-600/30"
                >
                  <span>Get Started with AlphaPips</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
