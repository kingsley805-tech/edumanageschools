import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Metronic page head — mirrors the demo's page title block:
 * `<div class="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">`
 */
export function PortalPageHeader({ title, description, actions, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col justify-center gap-2">
        <h1 className="text-xl font-medium leading-none text-mono">{title}</h1>
        {description ? (
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      ) : null}
    </div>
  );
}
