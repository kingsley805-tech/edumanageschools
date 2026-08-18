import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { keeniconFor, KEENICONS, type KeeniconName } from "./keeniconMap";

type KiIconProps = {
  /** A keenicon glyph name (e.g. "element-11") — the ki- prefix is added. */
  name?: KeeniconName;
  /** A lucide icon to translate to its keenicon equivalent. */
  icon?: LucideIcon;
  /** Which keenicon set to render. `filled` is what the demo sidebar uses. */
  set?: "filled" | "outline" | "duotone";
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

/**
 * Renders a Metronic keenicon glyph. Prefer `name`; pass `icon` (a lucide
 * component) and it will be mapped to the closest keenicon so existing nav
 * configs keep working without changes.
 */
export function KiIcon({
  name,
  icon,
  set = "filled",
  className,
  ...rest
}: KiIconProps) {
  const resolved: string =
    name ?? (icon ? keeniconFor(icon) : KEENICONS.dashboard);
  return (
    <i
      className={cn(`ki-${set} ki-${resolved}`, className)}
      aria-hidden={rest["aria-hidden"] ?? true}
    />
  );
}

/** Convenience: `<Ki name="element-11" />`. */
export function Ki({ name, set = "filled", className }: Omit<KiIconProps, "icon">) {
  return <i className={cn(`ki-${set} ki-${name}`, className)} aria-hidden />;
}
