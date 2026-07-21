import { cn } from "@/lib/utils";
import { MINGO } from "@/lib/designTokens";

export type MingoCategoryItem = {
  name: string;
  /** Display value on the right, e.g. "24.1%" or "4" */
  value: string;
  /** Bar fill width 0–100 */
  percent: number;
};

type Props = {
  items: MingoCategoryItem[];
  className?: string;
  /** When false, omit outer card border (panel already has one) */
  bordered?: boolean;
};

/** Exact mingo horizontal category bars */
export function MingoCategoryBars({
  items,
  className,
  bordered = true,
}: Props) {
  return (
    <div
      className={cn(bordered && "mingo-cat-card", className)}
      style={
        bordered
          ? { border: `1px solid ${MINGO.line}`, padding: 18 }
          : undefined
      }
    >
      {items.map((row) => (
        <div className="mingo-cat-row" key={row.name}>
          <div className="cat-name">{row.name}</div>
          <div className="cat-bar-track">
            <div
              className="cat-bar-fill"
              style={{
                width: `${Math.max(0, Math.min(100, row.percent))}%`,
                background: MINGO.ink,
              }}
            />
          </div>
          <div className="cat-val">{row.value}</div>
        </div>
      ))}
    </div>
  );
}
