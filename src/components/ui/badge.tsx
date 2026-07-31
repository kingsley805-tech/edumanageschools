import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] hover:brightness-95",
        secondary:
          "border-border bg-muted text-muted-foreground hover:bg-muted/80",
        destructive:
          "border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)] hover:brightness-95",
        outline: "border-border text-foreground",
        success:
          "border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] hover:brightness-95",
        warning:
          "border-[var(--badge-warning-bg)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)] hover:brightness-95",
        info:
          "border-[var(--badge-info-bg)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)] hover:brightness-95",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
