import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { month: string; revenue: number }[];
  currency: string;
  loading: boolean;
}

export default function RevenueChart({ data, currency, loading }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Revenue Overview</h3>
      {loading ? (
        <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
      ) : data.every((d) => d.revenue === 0) ? (
        <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">No payment data yet</div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(172, 66%, 40%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(172, 66%, 40%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(220, 13%, 90%)", borderRadius: "8px", fontSize: "13px" }}
                formatter={(value: number) => [`${currency} ${value.toLocaleString()}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(172, 66%, 40%)" strokeWidth={2} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
