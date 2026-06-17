import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function PortalSidebarSearch({ value, onChange }: Props) {
  return (
    <div className="mt-3 border-b border-sidebar-border/60 px-3 pb-3 pt-1">
      <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        Search menu
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/50" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Find a page…"
          className="h-9 w-full border-sidebar-border bg-transparent pl-9 pr-8 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/45 focus-visible:ring-1 focus-visible:ring-sidebar-border"
          aria-label="Search navigation"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
