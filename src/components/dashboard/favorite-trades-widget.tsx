"use client";

import { useQuery } from "@tanstack/react-query";
import { useFavorites } from "@/lib/favorites-store";
import { useNav } from "@/lib/nav-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatSignedCents, formatR } from "@/lib/money";
import { dToNumber } from "@/lib/decimal";
import { Star, ArrowRight, TrendingUp, TrendingDown, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteTradesWidget() {
  const { navigate } = useNav();
  const { favorites, isFavorite, toggleFavorite, favoriteCount } = useFavorites();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-favorite-trades"],
    queryFn: async () => {
      const res = await fetch("/api/trades?limit=100", { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json();
      return json.items ?? [];
    },
  });

  const allTrades: any[] = data ?? [];
  const favoritedTrades = allTrades.filter((t) => isFavorite(t.id));

  return (
    <Card className="bg-card border border-border rounded-xl shadow-xs p-4 sm:p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Star className="h-3.5 w-3.5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-jakarta text-foreground flex items-center gap-1.5">
                <span>Favorite Trades Spotlight</span>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-600 dark:text-amber-400">
                  {favoriteCount} Starred
                </Badge>
              </h3>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("tradesLog", { favorites: "1" })}
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5"
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        {favoritedTrades.length === 0 ? (
          <div className="p-6 text-center space-y-2.5 rounded-lg border border-dashed border-border/80 bg-muted/20">
            <Star className="h-6 w-6 text-amber-500/40 mx-auto fill-amber-500/10" />
            <div className="text-xs font-semibold text-foreground">No Starred Trades Yet</div>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Bookmark your standout trades by clicking the star icon in the Trades Log or Trade Detail view.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("tradesLog")}
              className="text-xs h-7 mt-1"
            >
              <BookOpen className="h-3 w-3 mr-1" />
              Open Trades Log
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {favoritedTrades.slice(0, 5).map((t) => {
              const pnl = formatSignedCents(t.netPnlCents);
              const rNum = t.actualR ? dToNumber(t.actualR) : null;
              const dateStr = t.entryTime
                ? new Date(t.entryTime).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—";

              return (
                <div
                  key={t.id}
                  onClick={() => navigate("tradeDetail", { id: t.id })}
                  className="py-2.5 flex items-center justify-between hover:bg-muted/30 px-2 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(t.id, t.instrumentSymbol);
                      }}
                      className="text-amber-400 hover:scale-110 transition-transform shrink-0"
                      title="Remove from favorites"
                    >
                      <Star className="h-3.5 w-3.5 fill-current" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-foreground font-mono">
                          {t.instrumentSymbol}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-mono px-1 py-0.2 rounded font-semibold",
                            t.direction === "long" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {t.direction.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {dateStr} {t.setupGrade && `• Grade ${t.setupGrade}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        pnl.sign > 0 ? "text-profit" : pnl.sign < 0 ? "text-loss" : "text-muted-foreground"
                      )}
                    >
                      {pnl.text}
                    </div>
                    {formatR(t.actualR) && (
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {formatR(t.actualR)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {favoritedTrades.length > 5 && (
        <div className="pt-2 text-center border-t border-border mt-2">
          <button
            onClick={() => navigate("tradesLog", { favorites: "1" })}
            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-medium"
          >
            +{favoritedTrades.length - 5} more favorites in Trades Log
          </button>
        </div>
      )}
    </Card>
  );
}
