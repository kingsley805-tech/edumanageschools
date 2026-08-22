import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  description?: string;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  clearLabel?: string;
};

/** Theme-aware searchable dropdown for class / student / teacher picks. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  disabled,
  className,
  allowClear,
  clearLabel = "Clear selection",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm text-foreground shadow-sm transition hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          {selected ? (
            <span className="min-w-0 truncate">
              <span className="font-medium">{selected.label}</span>
              {selected.description ? (
                <span className="text-muted-foreground"> · {selected.description}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] border-border bg-popover p-0 text-popover-foreground"
      >
        <Command className="bg-transparent">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <CommandInput
              placeholder={searchPlaceholder}
              className="h-10 border-0 bg-transparent text-sm focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[280px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {allowClear && value ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  {clearLabel}
                </CommandItem>
              ) : null}
              {options.map((opt) => {
                const isSel = opt.value === value;
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.description ?? ""} ${opt.value}`}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{opt.label}</div>
                      {opt.description ? (
                        <div className="truncate text-xs text-muted-foreground">{opt.description}</div>
                      ) : null}
                    </div>
                    <Check className={cn("h-4 w-4 shrink-0 text-primary", isSel ? "opacity-100" : "opacity-0")} />
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
