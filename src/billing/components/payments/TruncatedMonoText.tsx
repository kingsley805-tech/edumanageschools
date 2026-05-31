import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null | undefined;
  className?: string;
  emptyLabel?: string;
  maxWidthClass?: string;
};

export function TruncatedMonoText({
  value,
  className,
  emptyLabel = "—",
  maxWidthClass = "max-w-[140px]",
}: Props) {
  const display = value?.trim() || emptyLabel;
  if (display === emptyLabel) {
    return <span className={cn("font-mono text-xs text-muted-foreground", className)}>{emptyLabel}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "block cursor-default truncate font-mono text-xs text-muted-foreground",
            maxWidthClass,
            className,
          )}
        >
          {display}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md break-all font-mono text-xs">
        {display}
      </TooltipContent>
    </Tooltip>
  );
}
