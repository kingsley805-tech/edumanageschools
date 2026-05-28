import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  data: { month: string; online: number; manual: number }[];
  currency: string;
  loading: boolean;
}

export default function CollectionsOverviewChart({ data, currency, loading }: Props) {
  const empty = !loading && data.every((d) => d.online === 0 && d.manual === 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm shadow-black/[0.03]">
      <h3 className="text-base font-semibold text-card-foreground">Collections overview</h3>
      <p className="mt-1 text-xs text-muted-foreground">Online vs manual payments by month</p>
      {loading ? (
        <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : empty ? (
        <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No payment data yet</div>
      ) : (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "13px",
                }}
                formatter={(value: number, name: string) => [`${currency} ${value.toLocaleString()}`, name === "online" ? "Online" : "Manual"]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => (value === "online" ? "Online" : "Manual")}
              />
              <Bar dataKey="online" name="online" fill="hsl(160, 83%, 14%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="manual" name="manual" fill="hsl(173, 80%, 42%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
