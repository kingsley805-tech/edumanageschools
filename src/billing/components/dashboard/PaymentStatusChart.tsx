import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  data: { name: string; value: number; color: string }[];
  loading: boolean;
}

export default function PaymentStatusChart({ data, loading }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Payment Status</h3>
      {loading ? (
        <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
      ) : data.every((d) => d.value === 0) ? (
        <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No invoice data yet</div>
      ) : (
        <>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 justify-center mt-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium text-card-foreground">{item.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
