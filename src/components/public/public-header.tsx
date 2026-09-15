"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ArrowRight } from "lucide-react";
import { useNav } from "@/lib/nav-store";

/**
 * Public navigation header — minimal, elegant, matches the DnD dashboard.
 * Used only on the public landing page (not the authenticated app).
 */
export function PublicHeader() {
  const { navigate } = useNav();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "System", target: "system" as const },
    { label: "Capabilities", target: "capabilities" as const },
    { label: "Previews", target: "previews" as const },
  ];

  function scrollToSection(section: string) {
    setMobileOpen(false);
    if (section === "system") {
      document.getElementById("system-section")?.scrollIntoView({ behavior: "smooth" });
    } else if (section === "capabilities") {
      document.getElementById("capabilities-section")?.scrollIntoView({ behavior: "smooth" });
    } else if (section === "previews") {
      document.getElementById("previews-section")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1e2330]/95 backdrop-blur supports-[backdrop-filter]:bg-[#1e2330]/80">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate("landing")}
          className="flex items-center gap-2 shrink-0"
          aria-label="DnD home"
        >
          <div className="h-8 w-8 rounded bg-white flex items-center justify-center text-[#1e2330] font-bold text-sm">
            D
          </div>
          <span className="font-semibold tracking-tight text-white">DnD</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Main navigation">
          {navLinks.map((link) => (
            <button
              key={link.target}
              onClick={() => scrollToSection(link.target)}
              className="px-3 py-1.5 text-sm text-slate-300 hover:text-white transition-colors rounded-md"
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => navigate("terms")}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white transition-colors rounded-md"
          >
            Legal
          </button>
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("signin")} className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-white/10">
            Sign in
          </Button>
          <Button size="sm" onClick={() => navigate("signup")} className="bg-white text-[#1e2330] hover:bg-slate-100 border-0 font-semibold">
            Start journaling
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-slate-300 hover:text-white hover:bg-white/10" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-[#1e2330] border-white/10 text-white">
              <SheetHeader>
                <SheetTitle className="text-white">Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <button
                    key={link.target}
                    onClick={() => scrollToSection(link.target)}
                    className="px-3 py-2 text-left text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
                <button
                  onClick={() => { setMobileOpen(false); navigate("terms"); }}
                  className="px-3 py-2 text-left text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                >
                  Legal
                </button>
                <div className="h-px bg-white/10 my-2" />
                <button
                  onClick={() => { setMobileOpen(false); navigate("signin"); }}
                  className="px-3 py-2 text-left text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={() => { setMobileOpen(false); navigate("signup"); }}
                  className="px-3 py-2 text-left text-sm font-medium text-white hover:bg-white/10 rounded-md transition-colors"
                >
                  Start journaling
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
