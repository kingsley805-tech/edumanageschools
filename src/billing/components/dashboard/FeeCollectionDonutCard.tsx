import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { StatCounter } from "@/components/charts/StatCounter";
import { formatMoney } from "@/lib/currency";

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
  const data = [{ name: "Fees", collected, outstanding }];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm shadow-black/[0.03] transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-card-foreground">
            Fee collection status
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Collected vs outstanding balance
          </p>
        </div>
        {!loading ? (
          <div className="text-right">
            <StatCounter
              value={collectionRatePercent}
              formatter={(v) => `${Math.round(v)}%`}
              className="text-2xl font-bold tabular-nums text-primary"
            />
            <p className="text-[11px] text-muted-foreground">collected</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <AnimatedBarChart
          data={data}
          categoryKey="name"
          layout="vertical"
          height={160}
          loading={loading}
          emptyMessage="No invoice data yet"
          valueFormatter={(v) =>
            formatMoney(v, currency, { maximumFractionDigits: 0 })
          }
          series={[
            { key: "collected", label: "Collected", color: COLLECTED },
            { key: "outstanding", label: "Outstanding", color: OUTSTANDING },
          ]}
        />
      </div>

      {!loading ? (
        <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: COLLECTED }}
              />
              Collected
            </span>
            <span className="font-semibold tabular-nums text-card-foreground">
              {formatMoney(collected, currency, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: OUTSTANDING }}
              />
              Outstanding
            </span>
            <span className="font-semibold tabular-nums text-card-foreground">
              {formatMoney(outstanding, currency, { maximumFractionDigits: 0 })}
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
      ) : null}
    </div>
  );
}
