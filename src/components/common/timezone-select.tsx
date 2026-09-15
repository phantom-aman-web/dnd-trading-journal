"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getIanaTimezones, formatTimezoneLabel } from "@/lib/timezones";

interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * A searchable IANA timezone selector.
 *
 * Implemented as a Popover + cmdk combobox. The list is generated from
 * `Intl.supportedValuesOf('timeZone')` when available (with a curated
 * fallback), and each option shows "City (IANA/Identifier)".
 */
export function TimezoneSelect({
  value,
  onChange,
  placeholder = "Select timezone",
  className,
  disabled,
}: TimezoneSelectProps) {
  const [open, setOpen] = React.useState(false);
  // Compute the list once. `Intl.supportedValuesOf` is synchronous and
  // stable for the lifetime of the page, so we memoize the result.
  const timezones = React.useMemo(() => getIanaTimezones(), []);

  const triggerLabel = value ? formatTimezoneLabel(value) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
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
      <PopoverContent className="p-0 w-[min(28rem,var(--radix-popover-trigger-width,28rem))]" align="start">
        <Command>
          <CommandInput placeholder="Search timezone or city…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {timezones.map((tz) => {
                const label = formatTimezoneLabel(tz);
                const selected = value === tz;
                return (
                  <CommandItem
                    key={tz}
                    value={label}
                    onSelect={() => {
                      onChange(tz);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

