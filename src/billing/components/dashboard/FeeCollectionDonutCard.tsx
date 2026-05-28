import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  collected: number;
  outstanding: number;
  collectionRatePercent: number;
  defaulterCount: number;
  currency: string;
  loading: boolean;
}

const COLLECTED = "hsl(173, 80%, 42%)";
const OUTSTANDING = "hsl(38, 92%, 50%)";

export default function FeeCollectionDonutCard({
  collected,
  outstanding,
  collectionRatePercent,
  defaulterCount,
  currency,
  loading,
}: Props) {
  const data = [
    { name: "Collected", value: collected, color: COLLECTED },
    { name: "Outstanding", value: outstanding, color: OUTSTANDING },
  ];
  const total = collected + outstanding;
  const empty = !loading && total <= 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm shadow-black/[0.03]">
      <h3 className="text-base font-semibold text-card-foreground">Fee collection status</h3>
      <p className="mt-1 text-xs text-muted-foreground">Collected vs outstanding balance</p>
      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : empty ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No invoice data yet</div>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-56 w-full max-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={92}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
              <span className="text-3xl font-bold tabular-nums text-card-foreground">{Math.round(collectionRatePercent)}%</span>
              <span className="text-xs font-medium text-muted-foreground">collected</span>
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLLECTED }} />
                Collected
              </span>
              <span className="font-semibold tabular-nums text-card-foreground">
                {currency} {collected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: OUTSTANDING }} />
                Outstanding
              </span>
              <span className="font-semibold tabular-nums text-card-foreground">
                {currency} {outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Defaulters
              </span>
              <span className="font-semibold tabular-nums text-card-foreground">
                {defaulterCount} student{defaulterCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
