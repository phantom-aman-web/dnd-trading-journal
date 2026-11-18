"use client";

import { useNav } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { usePrivacyStore } from "@/lib/privacy-store";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Plus,
  Calendar,
  User,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Palette,
  Check,
  Eye,
  EyeOff,
  DatabaseBackup,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

export function MobileNav() {
  const { view, params, navigate } = useNav();
  const { user, signOut } = useAuth();
  const { isPrivate, togglePrivacy } = usePrivacyStore();
  const { theme, setTheme } = useTheme();

  const isHomeActive = view === "dashboard";
  const isTradesActive = view === "tradesLog" || view === "tradeDetail";
  const isAddActive = view === "tradeNew";
  const isCalendarActive = view === "calendar";
  const isProfileActive = view === "settings" || view === "backup";

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

        {/* 5. Profile with Popup Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors relative cursor-pointer",
                isProfileActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Profile and account menu"
              aria-current={isProfileActive ? "page" : undefined}
            >
              <span className={cn("p-1 rounded-lg transition-colors", isProfileActive && "bg-primary/10")}>
                <User className="h-5 w-5" />
              </span>
              <span>Profile</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={14}
            className="w-64 p-1.5 max-h-[85vh] overflow-y-auto mb-1 z-50 shadow-xl border-border bg-card/95 backdrop-blur-md"
          >
            {/* Account Header */}
            <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="font-semibold text-foreground text-sm">{user?.name ?? "Trader"}</span>
              <span className="text-xs text-muted-foreground font-normal truncate">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />

            {/* Account Section */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
              Account
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("settings", { tab: "profile" })} className="cursor-pointer">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              Profile & Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("settings", { tab: "trading" })} className="cursor-pointer">
              <SettingsIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              Trading Preferences
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            {/* Preferences Section */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
              Preferences
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("settings", { tab: "preferences" })} className="cursor-pointer">
              <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
              Preferences Center
            </DropdownMenuItem>

            {/* Direct Themes Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Palette className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="flex-1">Themes</span>
                <span className="text-[10px] font-mono text-muted-foreground capitalize mr-1">
                  {theme === "nordic" ? "Nordic" : theme === "terminal" ? "Terminal" : "Institutional"}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 p-1">
                <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
                  Choose Theme
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setTheme("nordic")}
                  className="flex items-center justify-between cursor-pointer py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-slate-200 border border-slate-300" />
                    <span className="text-xs font-medium">Nordic</span>
                  </div>
                  {theme === "nordic" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("terminal")}
                  className="flex items-center justify-between cursor-pointer py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 border border-emerald-600" />
                    <span className="text-xs font-medium">Terminal</span>
                  </div>
                  {theme === "terminal" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("institutional")}
                  className="flex items-center justify-between cursor-pointer py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-slate-700 border border-slate-800" />
                    <span className="text-xs font-medium">Slate Contrast</span>
                  </div>
                  {theme === "institutional" && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={() => navigate("settings", { tab: "preferences", sub: "themes" })}
                  className="text-xs text-muted-foreground cursor-pointer py-1.5"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-2" />
                  <span>More Theme Settings…</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {/* Note: Keyboard Shortcuts explicitly removed for mobile */}

            <DropdownMenuSeparator className="my-1" />

            {/* Privacy Section */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
              Privacy
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                togglePrivacy();
                toast.success(isPrivate ? "Sensitive information is now visible." : "Sensitive financial information masked globally.");
              }}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isPrivate ? (
                  <Eye className="h-4 w-4 text-emerald-500" />
                ) : (
                  <EyeOff className="h-4 w-4 text-amber-500" />
                )}
                <span className="font-medium text-xs">{isPrivate ? "Show Sensitive Information" : "Hide Sensitive Information"}</span>
              </div>
              <span
                className={cn(
                  "text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold tracking-wide",
                  isPrivate
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isPrivate ? "MASKED" : "VISIBLE"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            {/* Session Section */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
              Session
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("backup")} className="cursor-pointer">
              <DatabaseBackup className="h-4 w-4 mr-2 text-muted-foreground" />
              Backup / Restore
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const res = await fetch("/api/exports?format=json&type=all");
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `alphapips-export-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Export ready.");
              }}
              className="cursor-pointer"
            >
              Export Data (JSON)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-loss focus:text-loss cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
