import { Search, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/** Sidebar search — inherits the themed `--sidebar-*` tokens. */
export function PortalSidebarSearch({ value, onChange }: Props) {
  return (
    <div className="border-b border-sidebar-border px-5 py-3">
      <div className="relative flex items-center gap-2 rounded-md border border-sidebar-border bg-muted/50 px-3 py-2.5 text-[13px] text-sidebar-foreground focus-within:border-sidebar-ring focus-within:ring-1 focus-within:ring-sidebar-ring/30">
        <Search className="h-4 w-4 shrink-0 text-sidebar-foreground/70" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Find a page…"
          className="w-full min-w-0 bg-transparent text-[13px] font-medium text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/55"
          aria-label="Search navigation"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
