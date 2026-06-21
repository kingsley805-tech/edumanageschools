import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  iconClassName?: string;
  size?: "xs" | "sm" | "md" | "lg";
  rounded?: "lg" | "xl" | "2xl" | "full";
};

const SIZE: Record<
  NonNullable<Props["size"]>,
  { box: string; icon: string }
> = {
  xs: { box: "h-7 w-7", icon: "h-3.5 w-3.5" },
  sm: { box: "h-8 w-8", icon: "h-4 w-4" },
  md: { box: "h-10 w-10", icon: "h-5 w-5" },
  lg: { box: "h-14 w-14", icon: "h-7 w-7" },
};

const ROUNDED: Record<NonNullable<Props["rounded"]>, string> = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

/** Distinct AI mark — uses portal primary/accent gradient from index.css */
export function AiBrandIcon({
  className,
  iconClassName,
  size = "sm",
  rounded = "lg",
}: Props) {
  const s = SIZE[size];
  return (
    <div
      className={cn(
        "ai-brand-icon flex shrink-0 items-center justify-center shadow-sm",
        s.box,
        ROUNDED[rounded],
        className,
      )}
      aria-hidden
    >
      <BrainCircuit className={cn(s.icon, iconClassName)} />
    </div>
  );
}
