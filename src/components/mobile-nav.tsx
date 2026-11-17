"use client";

import { useNav, type ViewKey } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Plus,
  Calendar,
  User,
} from "lucide-react";

export function MobileNav() {
  const { view, params, navigate } = useNav();
  const { user } = useAuth();

  // Profile is ONLY active when explicitly visiting the Profile destination
  const isProfileActive = view === "settings" && params.tab === "profile";
  const isHomeActive = view === "dashboard";
  const isTradesActive = view === "tradesLog" || view === "tradeDetail";
  const isAddActive = view === "tradeNew";
  const isCalendarActive = view === "calendar";

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-md pb-safe shadow-lg"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 h-14 items-center">
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => navigate("dashboard")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors relative cursor-pointer",
            isHomeActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-current={isHomeActive ? "page" : undefined}
        >
          <span className={cn("p-1 rounded-lg transition-colors", isHomeActive && "bg-primary/10")}>
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <span>Home</span>
        </button>

        {/* 2. Trades */}
        <button
          type="button"
          onClick={() => navigate("tradesLog")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors relative cursor-pointer",
            isTradesActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-current={isTradesActive ? "page" : undefined}
        >
          <span className={cn("p-1 rounded-lg transition-colors", isTradesActive && "bg-primary/10")}>
            <BookOpen className="h-5 w-5" />
          </span>
          <span>Trades</span>
        </button>

        {/* 3. Add (Prominent Quick-Action) */}
        <button
          type="button"
          onClick={() => navigate("tradeNew")}
          className="flex flex-col items-center justify-center py-1 -mt-3.5 relative group cursor-pointer"
          aria-label="Log new trade"
          aria-current={isAddActive ? "page" : undefined}
        >
          <span className="flex items-center justify-center h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-active:scale-95 border-2 border-background">
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </span>
          <span className={cn("text-[10px] mt-0.5 transition-colors font-medium", isAddActive ? "text-primary font-semibold" : "text-muted-foreground")}>
            Add
          </span>
        </button>

        {/* 4. Calendar */}
        <button
          type="button"
          onClick={() => navigate("calendar")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors relative cursor-pointer",
            isCalendarActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-current={isCalendarActive ? "page" : undefined}
        >
          <span className={cn("p-1 rounded-lg transition-colors", isCalendarActive && "bg-primary/10")}>
            <Calendar className="h-5 w-5" />
          </span>
          <span>Calendar</span>
        </button>

        {/* 5. Profile (Dedicated Personal Account Destination) */}
        <button
          type="button"
          onClick={() => navigate("settings", { tab: "profile" })}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors relative cursor-pointer",
            isProfileActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-current={isProfileActive ? "page" : undefined}
          aria-label="Account Profile"
        >
          <span className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
            isProfileActive
              ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
              : "bg-muted text-foreground/80 hover:bg-muted/80"
          )}>
            {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? <User className="h-4 w-4" />}
          </span>
          <span>Profile</span>
        </button>
      </div>
    </nav>
  );
}
