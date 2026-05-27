import { useCurrentTerm } from "@/report/hooks/use-school-data";
import { formatTermLabel } from "@/report/lib/terms";
import { CalendarRange } from "lucide-react";

export function ActiveTermBanner({ className }: { className?: string }) {
  const { data: term, isLoading } = useCurrentTerm();

  if (isLoading || !term) return null;

  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm"
      }
    >
      <CalendarRange className="h-4 w-4 text-primary shrink-0" />
      <span className="text-muted-foreground">Active term for new reports:</span>
      <span className="font-semibold text-foreground">{formatTermLabel(term)}</span>
      {term.is_current && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
          Current
        </span>
      )}
    </div>
  );
}
