import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "AlphaPips — Trading Journal & Performance Analytics",
  description: "Journal your trades, analyze your strategies, track risk, and understand your trading performance with AlphaPips.",
  keywords: ["trading journal", "trading performance", "forex journal", "crypto analytics", "prop firm challenge tracker", "risk calculator", "trading analytics"],
  authors: [{ name: "AlphaPips Team" }],
  openGraph: {
    title: "AlphaPips — Trading Journal & Performance Analytics",
    description: "Journal your trades, analyze your strategies, track risk, and understand your trading performance with AlphaPips.",
    url: "https://alphapips.com",
    siteName: "AlphaPips",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaPips — Trading Journal & Performance Analytics",
    description: "Journal your trades, analyze your strategies, track risk, and understand your trading performance with AlphaPips.",
  },
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
const themeInitScript = `(function(){try{var t=localStorage.getItem('dnd-theme')||'nordic';var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.toggle('dark',t!=='nordic');d.style.colorScheme=t==='nordic'?'light':'dark';var f=localStorage.getItem('alphapips-font');if(f)d.setAttribute('data-font',f);var den=localStorage.getItem('dnd-density');if(den)d.setAttribute('data-density',den);if(localStorage.getItem('dnd-larger-text')==='true')d.setAttribute('data-larger-text','true');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
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
