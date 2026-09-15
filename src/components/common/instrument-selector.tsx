"use client";

/**
 * InstrumentSelector — searchable, categorized instrument picker.
 *
 * Built on shadcn/ui's Popover + Command (cmdk) primitives, mirroring the
 * structure of `TimezoneSelect`. The catalog is `INSTRUMENT_CATALOG` from
 * `@/lib/instrument-catalog`, so the list is static, deterministic, and
 * available client-side without an API roundtrip.
 *
 * Behaviour:
 *   - Search input filters by symbol OR display name (case-insensitive).
 *   - Results are grouped by `market` → `category` (e.g. Forex → Major
 *     Pairs, Metals → Metals, Indices → US Indices, …).
 *   - Keyboard navigation: ArrowUp/ArrowDown to move, Enter to select —
 *     this is handled natively by cmdk.
 *   - If the user types a symbol that isn't in the catalog, a
 *     "Use 'XYZ' as custom instrument" option appears at the top so they
 *     can still log trades on symbols we don't pre-register.
 *   - `onChange` is always called with the UPPERCASE, trimmed symbol.
 *
 * Props:
 *   - `value`: currently selected symbol (string).
 *   - `onChange(symbol)`: callback with the uppercase symbol.
 *   - `placeholder`: trigger placeholder when no value is set.
 */

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INSTRUMENT_CATALOG,
  findInstrument,
  normalizeSymbol,
  type InstrumentDef,
  type InstrumentMarket,
} from "@/lib/instrument-catalog";

interface InstrumentSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Optional id forwarded to the trigger button for label association. */
  id?: string;
}

/* ------------------------------------------------------------------ */
/* Grouping helpers                                                    */
/* ------------------------------------------------------------------ */

interface MarketGroup {
  market: InstrumentMarket;
  category: string;
  items: InstrumentDef[];
}

/**
 * Group the flat catalog into `[{ market, category, items }]` triples so
 * we can render two-level headings (market → category) inside the
 * CommandList. Stable ordering: markets appear in the order they first
 * occur in the catalog, categories within a market likewise.
 */
function groupCatalog(): MarketGroup[] {
  const groups: MarketGroup[] = [];
  const index = new Map<string, number>();
  for (const def of INSTRUMENT_CATALOG) {
    const key = `${def.market}|${def.category}`;
    let pos = index.get(key);
    if (pos == null) {
      pos = groups.length;
      index.set(key, pos);
      groups.push({ market: def.market, category: def.category, items: [] });
    }
    groups[pos].items.push(def);
  }
  return groups;
}

/** Human-readable label for each market, used as the top-level group heading. */
function marketLabel(market: InstrumentMarket): string {
  switch (market) {
    case "forex":
      return "Forex";
    case "gold":
      return "Metals";
    case "indices":
      return "Indices";
    case "futures":
      return "Futures";
    case "crypto":
      return "Crypto";
    case "stocks":
      return "Stocks";
    default:
      return "Other";
  }
}

/** Stable, lowercased sort key for markets — keeps Forex first, etc. */
const MARKET_ORDER: InstrumentMarket[] = [
  "forex",
  "gold",
  "indices",
  "futures",
  "crypto",
  "stocks",
  "custom",
];

function marketSortKey(market: InstrumentMarket): number {
  const i = MARKET_ORDER.indexOf(market);
  return i === -1 ? MARKET_ORDER.length : i;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

const GROUPS = groupCatalog();

export function InstrumentSelector({
  value,
  onChange,
  placeholder = "Select instrument…",
  className,
  disabled,
  id,
}: InstrumentSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Build a normalized trigger label: "EURUSD — Euro / US Dollar" if known,
  // or just the uppercase symbol for custom/unknown values.
  const selected = findInstrument(value);
  const triggerLabel = (() => {
    const sym = normalizeSymbol(value);
    if (!sym) return placeholder;
    if (selected) return `${selected.symbol} — ${selected.displayName}`;
    return sym;
  })();

  // Should we offer the "Use as custom" option? Only when the query is
  // non-empty, doesn't exactly match a known symbol, and looks like a
  // plausible ticker (letters/digits, length ≥ 1).
  const normalizedQuery = normalizeSymbol(query);
  const trimmedQuery = query.trim();
  const showCustomOption =
    trimmedQuery.length > 0 &&
    normalizedQuery.length > 0 &&
    !findInstrument(normalizedQuery) &&
    /^[A-Z0-9.\-/]+$/.test(normalizedQuery);

  // Sort groups by market order so Forex always appears before Futures, etc.
  const sortedGroups = React.useMemo(
    () =>
      [...GROUPS].sort((a, b) => {
        const ka = marketSortKey(a.market);
        const kb = marketSortKey(b.market);
        if (ka !== kb) return ka - kb;
        return a.category.localeCompare(b.category);
      }),
    [],
  );

  function handleSelect(symbol: string) {
    onChange(symbol);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select instrument"
          disabled={disabled}
          data-slot="instrument-selector-trigger"
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[min(28rem,var(--radix-popover-trigger-width,28rem))]"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search symbol or name…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {trimmedQuery.length === 0
                ? "No instruments available."
                : `No instrument matches “${trimmedQuery}”.`}
            </CommandEmpty>

            {/* Custom-symbol fallback: appears only when the query is a
                non-empty, plausible ticker that doesn't match a catalog
                entry. Lets users log trades on symbols we don't pre-register. */}
            {showCustomOption && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={`__custom__ ${normalizedQuery}`}
                  onSelect={() => handleSelect(normalizedQuery)}
                >
                  <Plus className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                  <span className="flex-1 truncate">
                    Use <span className="font-semibold">{normalizedQuery}</span> as custom instrument
                  </span>
                </CommandItem>
              </CommandGroup>
            )}

            {showCustomOption && <CommandSeparator />}

            {/* Catalog results, grouped by market → category. The cmdk
                filter matches against each item's `value`, which we set to
                "symbol displayName" so searches hit either field. */}
            {sortedGroups.map((group) => (
              <CommandGroup
                key={`${group.market}-${group.category}`}
                heading={`${marketLabel(group.market)} · ${group.category}`}
              >
                {group.items.map((def) => {
                  const isSelected = normalizeSymbol(value) === def.symbol;
                  return (
                    <CommandItem
                      key={def.symbol}
                      value={`${def.symbol} ${def.displayName}`}
                      onSelect={() => handleSelect(def.symbol)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="font-medium w-20 shrink-0">{def.symbol}</span>
                      <span className="truncate text-muted-foreground">
                        {def.displayName}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
