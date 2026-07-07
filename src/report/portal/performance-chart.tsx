import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS,
  CHART_CURRENT_GRADIENT,
  CHART_CURRENT_SOLID,
  CHART_GRID,
  CHART_PREVIOUS_LINE,
} from "@/components/charts/chartTheme";

const PIE_COLORS = [
  "#34d399",
  "#10b981",
  "#059669",
  "#047857",
  "#065f46",
];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(15, 23, 20, 0.95)",
  color: "#f8fafc",
};

export function PerformanceAreaChart({ data }: { data: { name: string; score: number }[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_CURRENT_SOLID} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_CURRENT_SOLID} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: CHART_AXIS, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="score"
          stroke={CHART_CURRENT_SOLID}
          fill="url(#scoreGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SubjectBarChart({ data }: { data: { name: string; average: number }[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <defs>
          <linearGradient id="subjectBarGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={CHART_CURRENT_GRADIENT.start} />
            <stop offset="100%" stopColor={CHART_CURRENT_GRADIENT.end} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis domain={[0, 100]} tick={{ fill: CHART_AXIS, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="average" fill="url(#subjectBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({
  data,
  dataKey = "count",
  compareKey,
}: {
  data: { name: string; count: number; previous?: number }[];
  dataKey?: string;
  compareKey?: string;
}) {
  if (!data.length) return null;

  if (compareKey) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="trendBarGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={CHART_CURRENT_GRADIENT.start} />
              <stop offset="100%" stopColor={CHART_CURRENT_GRADIENT.end} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART_GRID} />
          <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 10 }} />
          <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey={dataKey} fill="url(#trendBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={42} />
          <Line
            type="monotone"
            dataKey={compareKey}
            stroke={CHART_PREVIOUS_LINE}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_PREVIOUS_LINE }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data}>
        <defs>
          <linearGradient id="trendBarGradSimple" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={CHART_CURRENT_GRADIENT.start} />
            <stop offset="100%" stopColor={CHART_CURRENT_GRADIENT.end} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 10 }} />
        <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={dataKey} fill="url(#trendBarGradSimple)" radius={[6, 6, 0, 0]} maxBarSize={42} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
