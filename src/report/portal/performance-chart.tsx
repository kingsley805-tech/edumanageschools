import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function PerformanceAreaChart({ data }: { data: { name: string; score: number }[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-4)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-chart-4)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--color-chart-4)"
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
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ borderRadius: 8 }} />
        <Bar dataKey="average" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
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
        <Tooltip contentStyle={{ borderRadius: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({
  data,
  dataKey = "count",
}: {
  data: { name: string; count: number }[];
  dataKey?: string;
}) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8 }} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="var(--color-chart-4)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
