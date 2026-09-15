"use client";

import { useNav, type ViewKey } from "@/lib/nav-store";

interface FooterCol {
  title: string;
  links: { label: string; view?: ViewKey; href?: string }[];
}

const COLUMNS: FooterCol[] = [
  {
    title: "Product",
    links: [
      { label: "Dashboard", view: "signup" },
      { label: "Journal", view: "signup" },
      { label: "Daily Plans", view: "signup" },
      { label: "Analytics", view: "signup" },
      { label: "Setups", view: "signup" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", view: "privacy" },
      { label: "Terms of Service", view: "terms" },
      { label: "Cookie Policy", view: "cookies" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", view: "signin" },
      { label: "Start journaling", view: "signup" },
    ],
  },
];

/**
 * Public footer — minimal, premium, matches the DnD dashboard design.
 * Legal links open the legal document viewer (no auth required).
 */
export function PublicFooter() {
  const { navigate } = useNav();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                D
              </div>
              <span className="font-semibold tracking-tight">DnD</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              A private trading performance system. Connect strategy,
              execution, evidence and review into one process.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => link.view && navigate(link.view)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} DnD. Not financial advice.
          </p>
          <p className="text-xs text-muted-foreground">
            A trading journaling, analytics and performance-management product.
          </p>
        </div>
      </div>
    </footer>
  );
}
