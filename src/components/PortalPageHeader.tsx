import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/** Consistent page title block for portal inner pages */
export function PortalPageHeader({ title, description, actions, className }: Props) {
  return (
    <div
      className={cn(
        "portal-page-header mb-6 flex flex-col gap-4 rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-5 md:mb-8",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground md:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
