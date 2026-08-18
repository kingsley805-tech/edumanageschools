import { cn } from "@/lib/utils";
import { MINGO } from "@/lib/designTokens";

export type MingoLinePoint = {
  /** X-axis label (shown at start / mid / end when provided) */
  label?: string;
  primary: number;
  secondary: number;
};

type Props = {
  primaryLabel?: string;
  secondaryLabel?: string;
  points?: MingoLinePoint[];
  /** Y-axis top label, e.g. "4k" */
  yMaxLabel?: string;
  yMidLabel?: string;
  yMinLabel?: string;
  className?: string;
  height?: number;
  /**
   * Use the exact mingo mock polylines (Received / Deducted zigzag).
   * When true, `points` are ignored so the signal matches the reference SVG.
   */
  exactSignal?: boolean;
};

const W = 640;
const H = 160;
const PAD_B = 30; // room for x labels → total svg ~190

/** Exact coordinates from the mingo chart HTML mock */
const EXACT_PRIMARY =
  "0,150 40,130 80,140 120,95 160,110 200,70 240,90 280,50 320,75 360,40 400,60 440,30 480,55 520,35 560,58 600,25 640,45";
const EXACT_SECONDARY =
  "0,110 40,120 80,95 120,130 160,105 200,140 240,118 280,150 320,128 360,100 400,135 440,112 480,145 520,120 560,138 600,108 640,124";
const EXACT_X_LABELS = [
  { x: 0, text: "Jun 16" },
  { x: 290, text: "Jun 30" },
  { x: 595, text: "Jul 15" },
];

function toPolyline(values: number[], max: number): string {
  const n = Math.max(values.length, 2);
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * W;
      const y = H - (Math.max(0, v) / max) * (H - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
}

function lastPoint(points: string): { x: number; y: number } {
  const parts = points.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.split(",") ?? ["640", "45"];
  return { x: Number(last[0]), y: Number(last[1]) };
}

/** Exact mingo dual-line chart (black + gray polylines) */
export function MingoLineChart({
  primaryLabel = "Received",
  secondaryLabel = "Deducted (sales)",
  points = [],
  yMaxLabel = "4k",
  yMidLabel = "2k",
  yMinLabel = "0",
  className,
  height = 190,
  exactSignal = false,
}: Props) {
  let primaryPts: string;
  let secondaryPts: string;
  let endPrimary: { x: number; y: number };
  let endSecondary: { x: number; y: number };
  let xLabels: { x: number; text: string }[];

  if (exactSignal || points.length < 2) {
    primaryPts = EXACT_PRIMARY;
    secondaryPts = EXACT_SECONDARY;
    endPrimary = lastPoint(EXACT_PRIMARY);
    endSecondary = lastPoint(EXACT_SECONDARY);
    xLabels = EXACT_X_LABELS;
  } else {
    const max = Math.max(
      1,
      ...points.map((p) => Math.max(p.primary, p.secondary)),
    );
    const primary = points.map((p) => p.primary);
    const secondary = points.map((p) => p.secondary);
    primaryPts = toPolyline(primary, max);
    secondaryPts = toPolyline(secondary, max);
    const last = points.length - 1;
    endPrimary = {
      x: W,
      y: H - (Math.max(0, primary[last]) / max) * (H - 8) - 4,
    };
    endSecondary = {
      x: W,
      y: H - (Math.max(0, secondary[last]) / max) * (H - 8) - 4,
    };
    const mid = Math.floor(points.length / 2);
    xLabels = [
      { x: 0, text: points[0]?.label ?? "" },
      { x: 290, text: points[mid]?.label ?? "" },
      { x: 595, text: points[last]?.label ?? "" },
    ];
  }

  return (
    <div className={cn("mingo-line-chart-card", className)}>
      <div className="mingo-legend">
        <div className="mingo-legend-item">
          <span className="sw" style={{ background: MINGO.ink }} />
          {primaryLabel}
        </div>
        <div className="mingo-legend-item">
          <span className="sw" style={{ background: "#d4d4d8" }} />
          {secondaryLabel}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H + PAD_B}`}
        width="100%"
        height={height}
        style={{ overflow: "visible" }}
        role="img"
        aria-label={`${primaryLabel} vs ${secondaryLabel}`}
      >
        <line x1={0} y1={0} x2={0} y2={H} stroke={MINGO.line} />
        <line x1={0} y1={H} x2={W} y2={H} stroke={MINGO.line} />

        <text
          x={-8}
          y={8}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontSize={9}
          fill={MINGO.inkFaint}
          textAnchor="end"
        >
          {yMaxLabel}
        </text>
        <text
          x={-8}
          y={84}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontSize={9}
          fill={MINGO.inkFaint}
          textAnchor="end"
        >
          {yMidLabel}
        </text>
        <text
          x={-8}
          y={164}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontSize={9}
          fill={MINGO.inkFaint}
          textAnchor="end"
        >
          {yMinLabel}
        </text>

        <line x1={0} y1={4} x2={W} y2={4} stroke="#f4f4f5" />
        <line x1={0} y1={80} x2={W} y2={80} stroke="#f4f4f5" />

        <polyline
          fill="none"
          stroke="#d4d4d8"
          strokeWidth={2}
          points={secondaryPts}
        />
        <polyline
          fill="none"
          stroke={MINGO.ink}
          strokeWidth={2.25}
          points={primaryPts}
        />

        <circle cx={endPrimary.x} cy={endPrimary.y} r={3.5} fill={MINGO.ink} />
        <circle
          cx={endSecondary.x}
          cy={endSecondary.y}
          r={3.5}
          fill="#d4d4d8"
          stroke={MINGO.ink}
          strokeWidth={1}
        />

        {xLabels.map((l) =>
          l.text ? (
            <text
              key={`${l.x}-${l.text}`}
              x={l.x}
              y={178}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
              fontSize={9}
              fill={MINGO.inkFaint}
            >
              {l.text}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

/** Exact category rows from the mingo mock (bar widths are intentional, not %scaled) */
export const MINGO_EXACT_CATEGORY_SIGNAL = [
  { name: "Beverages", value: "24.1%", percent: 82 },
  { name: "Dairy", value: "18.6%", percent: 64 },
  { name: "Produce", value: "15.2%", percent: 53 },
  { name: "Bakery", value: "11.4%", percent: 39 },
  { name: "Household", value: "9.8%", percent: 31 },
  { name: "Frozen", value: "7.3%", percent: 22 },
  { name: "Other", value: "13.6%", percent: 15 },
] as const;
