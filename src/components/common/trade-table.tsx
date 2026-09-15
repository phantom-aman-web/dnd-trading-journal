"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatSignedCents, formatR, formatPct } from "@/lib/money";
import { dToNumber } from "@/lib/decimal";

interface Row {
  id: string;
  instrumentSymbol: string;
  direction: "long" | "short";
  status: string;
  session: string | null;
  setupGrade: string | null;
  entryTime: string | null;
  exitTime: string | null;
  netPnlCents: number;
  actualR: string | null;
  tagsJson: string;
}

interface TradeTableProps {
  trades: Row[];
  onRowClick?: (id: string) => void;
}

export function TradeTable({ trades, onRowClick }: TradeTableProps) {
  if (trades.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No trades match the current filters.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Instrument</th>
              <th className="px-3 py-2 font-medium">Dir</th>
              <th className="px-3 py-2 font-medium hidden md:table-cell">Session</th>
              <th className="px-3 py-2 font-medium hidden lg:table-cell">Grade</th>
              <th className="px-3 py-2 font-medium text-right">P&L</th>
              <th className="px-3 py-2 font-medium text-right">R</th>
              <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => {
              const pnl = formatSignedCents(t.netPnlCents);
              return (
                <tr
                  key={t.id}
                  className={cn(
                    "border-t border-border cursor-pointer hover:bg-muted/40",
                    onRowClick && "transition-colors",
                  )}
                  onClick={() => onRowClick?.(t.id)}
                >
                  <td className="px-3 py-2 tnum text-xs text-muted-foreground">
                    {t.entryTime ? new Date(t.entryTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
                  </td>
                  <td className="px-3 py-2 font-medium">{t.instrumentSymbol}</td>
                  <td className="px-3 py-2">
                    <span className={cn("text-xs font-medium", t.direction === "long" ? "text-profit" : "text-loss")}>
                      {t.direction === "long" ? "L" : "S"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs hidden md:table-cell text-muted-foreground">
                    {sessionLabel(t.session)}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    {t.setupGrade && (
                      <span className={cn("inline-block px-1.5 py-0.5 rounded text-xs font-medium", gradeClass(t.setupGrade))}>
                        {t.setupGrade}
                      </span>
                    )}
                  </td>
                  <td className={cn("px-3 py-2 text-right tnum font-medium", pnl.sign < 0 ? "text-loss" : pnl.sign > 0 ? "text-profit" : "")}>
                    {pnl.text}
                  </td>
                  <td className={cn("px-3 py-2 text-right tnum", t.actualR && dToNumber(t.actualR) > 0 ? "text-profit" : t.actualR && dToNumber(t.actualR) < 0 ? "text-loss" : "text-muted-foreground")}>
                    {formatR(t.actualR)}
                  </td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell text-xs text-muted-foreground">
                    {t.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sessionLabel(s: string | null): string {
  if (!s) return "-";
  const map: Record<string, string> = {
    asia: "Asia",
    london: "London",
    ny_am: "NY AM",
    ny_pm: "NY PM",
    custom: "Custom",
  };
  return map[s] ?? s;
}

function gradeClass(g: string): string {
  switch (g) {
    case "A+": return "bg-profit/15 text-profit";
    case "A": return "bg-profit/10 text-profit";
    case "B": return "bg-warning/15 text-warning";
    case "C": return "bg-muted text-muted-foreground";
    case "Invalid": return "bg-loss/15 text-loss";
    default: return "bg-muted text-muted-foreground";
  }
}
