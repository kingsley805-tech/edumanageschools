import { Search, X } from "lucide-react";
import { MINGO } from "@/lib/designTokens";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/** Sidebar search — mingo search-box */
export function PortalSidebarSearch({ value, onChange }: Props) {
  return (
    <div className="px-5 pb-1.5 pt-2.5">
      <div
        className="relative flex items-center gap-2 px-[11px] py-2 text-[12.5px]"
        style={{
          border: `1px solid ${MINGO.sidebarMute}`,
          color: MINGO.sidebarMutedText,
        }}
      >
        <Search className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Find a page…"
          className="w-full min-w-0 bg-transparent text-[12.5px] outline-none"
          style={{ color: MINGO.sidebarNav }}
          aria-label="Search navigation"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 opacity-80 hover:opacity-100"
            style={{ color: MINGO.sidebarMutedText }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
