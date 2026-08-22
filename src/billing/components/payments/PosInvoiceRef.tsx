import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  invoiceRefNeedsTooltip,
  shortInvoiceRef,
} from "@/billing/lib/posInvoiceFees";

type Props = {
  value: string | null | undefined;
  className?: string;
  emptyLabel?: string;
  length?: number;
};

export function PosInvoiceRef({
  value,
  className,
  emptyLabel = "—",
  length = 5,
}: Props) {
  if (!value?.trim()) {
    return <span className={cn("text-muted-foreground", className)}>{emptyLabel}</span>;
  }

  const full = value.trim();
  const short = shortInvoiceRef(full, length);
  const showTip = invoiceRefNeedsTooltip(full, length);

  if (!showTip) {
    return <span className={cn("font-mono font-medium uppercase", className)}>{short}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "cursor-default font-mono font-medium uppercase tracking-wide",
            className,
          )}
          title={full}
        >
          {short}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm break-all font-mono text-xs">
        {full}
      </TooltipContent>
    </Tooltip>
  );
}
