"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shuffle,
  Star,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Bookmark,
  CheckCircle2,
  Lightbulb,
  Compass,
} from "lucide-react";
import {
  ALL_TRADING_TIPS,
  TRADING_TIP_CATEGORIES,
  type TradingTipCategory,
  type TradingTip,
  getSmartRandomTip,
  generateFreshTip,
} from "@/lib/trading-tips-data";
import { cn } from "@/lib/utils";

const FAVORITES_KEY = "alphapips-favorite-trading-tips";
const MAX_HISTORY_QUEUE = 25;

export function RandomTradingTipWidgetContent() {
  const [selectedCategory, setSelectedCategory] = useState<TradingTipCategory | "All">("All");
  const [activeTip, setActiveTip] = useState<TradingTip | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [viewFavoritesOnly, setViewFavoritesOnly] = useState<boolean>(false);
  const [recentTipIds, setRecentTipIds] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState<boolean>(true);

  // Load favorites & initialize first tip on mount
  useEffect(() => {
    let savedFavs: string[] = [];
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        savedFavs = JSON.parse(stored);
        setFavorites(savedFavs);
      }
    } catch {}

    const initialTip = getSmartRandomTip("All", [], false, savedFavs);
    if (initialTip) {
      setActiveTip(initialTip);
      setRecentTipIds([initialTip.id]);
    }
  }, []);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {}
  }

  function handleNextTip() {
    const next = getSmartRandomTip(
      selectedCategory,
      recentTipIds,
      viewFavoritesOnly,
      favorites
    );
    if (next) {
      setActiveTip(next);
      setRecentTipIds((prev) => [next.id, ...prev.filter((id) => id !== next.id)].slice(0, MAX_HISTORY_QUEUE));
    }
  }

  function handleGenerateFresh() {
    const fresh = generateFreshTip(selectedCategory);
    setActiveTip(fresh);
    setRecentTipIds((prev) => [fresh.id, ...prev].slice(0, MAX_HISTORY_QUEUE));
  }

  function handleCategoryChange(cat: string) {
    const nextCat = cat as TradingTipCategory | "All";
    setSelectedCategory(nextCat);
    const next = getSmartRandomTip(nextCat, recentTipIds, viewFavoritesOnly, favorites);
    if (next) {
      setActiveTip(next);
      setRecentTipIds((prev) => [next.id, ...prev.filter((id) => id !== next.id)].slice(0, MAX_HISTORY_QUEUE));
    }
  }

  const currentPoolSize = ALL_TRADING_TIPS.filter((t) => {
    if (viewFavoritesOnly && !favorites.includes(t.id)) return false;
    if (selectedCategory !== "All" && t.category !== selectedCategory) return false;
    return true;
  }).length;

  return (
    <div className="flex flex-col h-full space-y-2.5">
      {/* Category Filter & Saved Header Bar */}
      <div className="flex items-center justify-between text-[10px] gap-1.5 flex-none">
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="h-6 px-1.5 rounded bg-muted/60 border border-border text-[10px] font-medium text-foreground focus:outline-hidden max-w-[170px] truncate"
        >
          <option value="All">All Topics (460+ Tips)</option>
          {TRADING_TIP_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              const nextFavOnly = !viewFavoritesOnly;
              setViewFavoritesOnly(nextFavOnly);
              const next = getSmartRandomTip(selectedCategory, recentTipIds, nextFavOnly, favorites);
              if (next) setActiveTip(next);
            }}
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors flex items-center gap-1",
              viewFavoritesOnly
                ? "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Toggle saved favorite tips"
          >
            <Bookmark className="h-2.5 w-2.5" />
            <span>Saved ({favorites.length})</span>
          </button>
        </div>
      </div>

      {/* Tip Card Content Container */}
      {activeTip ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 rounded-lg bg-muted/30 border border-border/60 flex flex-col justify-between space-y-2">
          <div className="space-y-1.5">
            {/* Title & Category Badge Row */}
            <div className="flex items-start justify-between gap-1.5">
              <span className="text-[11px] font-bold font-jakarta text-foreground leading-tight">
                {activeTip.title}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {activeTip.isGenerated && (
                  <Badge
                    variant="outline"
                    className="text-[8px] font-mono py-0 h-4 px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/30 gap-0.5"
                  >
                    <Sparkles className="h-2 w-2" />
                    <span>SYNTHESIZED</span>
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-[8px] font-mono py-0 h-4 px-1.5 bg-primary/10 text-primary border-primary/20 max-w-[120px] truncate"
                >
                  {activeTip.category}
                </Badge>
              </div>
            </div>

            {/* Core Wisdom Quote */}
            <p className="text-[11px] text-foreground/90 font-medium leading-relaxed italic bg-background/50 p-2 rounded border border-border/40">
              "{activeTip.tip}"
            </p>

            {/* Expandable Explanation & Practical Action */}
            {showDetails && (
              <div className="space-y-2 pt-1 text-[10px]">
                {/* Why It Matters */}
                <div className="bg-muted/40 p-1.5 rounded border border-border/30">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-amber-400 mb-0.5">
                    <Lightbulb className="h-2.5 w-2.5" />
                    <span>WHY IT MATTERS</span>
                  </div>
                  <p className="text-muted-foreground leading-normal">
                    {activeTip.whyItMatters}
                  </p>
                </div>

                {/* Practical Action */}
                <div className="bg-primary/5 p-1.5 rounded border border-primary/15">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-primary mb-0.5">
                    <Compass className="h-2.5 w-2.5" />
                    <span>PRACTICAL ACTION</span>
                  </div>
                  <p className="text-foreground/80 leading-normal">
                    {activeTip.practicalAction}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Principle & Favorite Footer */}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[9px] flex-none">
            <div className="flex items-center gap-1">
              <span className="font-mono text-primary font-semibold truncate max-w-[170px]">
                {activeTip.principle}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1 rounded transition-colors"
                title={showDetails ? "Collapse detailed breakdown" : "Expand detailed breakdown"}
              >
                <span>{showDetails ? "Less" : "Details"}</span>
                {showDetails ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(activeTip.id)}
                className={cn(
                  "p-1 rounded transition-colors",
                  favorites.includes(activeTip.id)
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted-foreground/50 hover:text-amber-400"
                )}
                title={favorites.includes(activeTip.id) ? "Bookmarked in Favorites" : "Add to Favorites"}
              >
                <Star className={cn("h-3 w-3", favorites.includes(activeTip.id) && "fill-current")} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground rounded-lg bg-muted/20 border border-border/40">
          <Bookmark className="h-5 w-5 mb-1 text-muted-foreground/40" />
          <p>No saved tips found in this category.</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewFavoritesOnly(false)}
            className="mt-2 h-6 text-[10px]"
          >
            Show All Tips
          </Button>
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="flex items-center justify-between pt-0.5 flex-none text-[9px]">
        <span className="font-mono text-muted-foreground">
          {viewFavoritesOnly ? `${favorites.length} saved` : `${currentPoolSize} in pool`}
        </span>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateFresh}
            className="h-6 text-[10px] gap-1 px-2 font-medium hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
            title="Synthesize fresh custom trading principle on-demand"
          >
            <Sparkles className="h-2.5 w-2.5 text-amber-400" />
            <span>Generate Fresh</span>
          </Button>

          <Button
            size="sm"
            variant="default"
            onClick={handleNextTip}
            className="h-6 text-[10px] gap-1 px-2.5 font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            title="Draw another tip from the curated library"
          >
            <Shuffle className="h-2.5 w-2.5" />
            <span>Next Tip</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
