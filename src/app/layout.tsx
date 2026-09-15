import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "DnD — Trading Performance OS",
  description: "Turn every trade into measurable progress. A private trading performance system.",
  icons: { icon: "/logo.svg" },
};

/**
 * Blocking inline script that reads the persisted theme from localStorage and
 * applies the `data-theme` attribute + `dark` class on <html> BEFORE the first
 * paint. This eliminates the flash of the default (light) theme when a dark
 * theme (terminal / institutional) was previously chosen.
 *
 * Runs synchronously in <head>, before any body content or CSS renders.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('dnd-theme')||'nordic';var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.toggle('dark',t!=='nordic');d.style.colorScheme=t==='nordic'?'light':'dark';var den=localStorage.getItem('dnd-density');if(den)d.setAttribute('data-density',den);if(localStorage.getItem('dnd-larger-text')==='true')d.setAttribute('data-larger-text','true');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {/* Blocking inline script: reads persisted theme from localStorage and
            applies data-theme + dark class on <html> BEFORE first paint.
            Placed at the very top of <body> so it runs synchronously before
            any DOM content renders, eliminating the flash of the default
            (light) theme when a dark theme was previously chosen. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster />
            <SonnerToaster richColors position="top-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
