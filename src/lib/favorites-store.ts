"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";

interface FavoritesState {
  favorites: Record<string, boolean>; // tradeId -> true
  toggleFavorite: (tradeId: string, tradeSymbol?: string) => boolean;
  isFavorite: (tradeId: string) => boolean;
  clearFavorites: () => void;
  getFavoriteIds: () => string[];
  favoriteCount: number;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: {},
      favoriteCount: 0,

      isFavorite: (tradeId: string) => {
        return !!get().favorites[tradeId];
      },

      toggleFavorite: (tradeId: string, tradeSymbol?: string) => {
        const current = get().favorites;
        const willBeFavorite = !current[tradeId];
        const next = { ...current };

        if (willBeFavorite) {
          next[tradeId] = true;
          toast.success(
            tradeSymbol ? `Added ${tradeSymbol} to Favorites` : "Added to Favorites",
            { description: "Accessible from your Favorite Trades view." }
          );
        } else {
          delete next[tradeId];
          toast.info(
            tradeSymbol ? `Removed ${tradeSymbol} from Favorites` : "Removed from Favorites"
          );
        }

        const count = Object.keys(next).length;
        set({ favorites: next, favoriteCount: count });
        return willBeFavorite;
      },

      clearFavorites: () => {
        set({ favorites: {}, favoriteCount: 0 });
      },

      getFavoriteIds: () => {
        return Object.keys(get().favorites);
      },
    }),
    {
      name: "alphapips-favorite-trades",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.favoriteCount = Object.keys(state.favorites || {}).length;
        }
      },
    }
  )
);
