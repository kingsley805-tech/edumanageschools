import { useMemo } from "react";
import { TrendComparisonChart } from "@/components/charts/TrendComparisonChart";
import { formatMoney } from "@/lib/currency";

interface Props {
  data: { month: string; revenue: number }[];
  currency: string;
  loading: boolean;
}

export default function RevenueChart({ data, currency, loading }: Props) {
  const trendData = useMemo(() => {
    let previous = 0;
    return data.map((row) => {
      const point = {
        label: row.month,
        current: row.revenue,
        previous,
      };
      previous = row.revenue;
      return point;
    });
  }, [data]);

  return (
    <TrendComparisonChart
      title="Revenue overview"
      subtitle="Monthly revenue — current vs prior month"
      data={trendData}
      currentLabel="Revenue"
      previousLabel="Previous"
      loading={loading}
      emptyMessage="No payment data yet"
      valueFormatter={(v) => formatMoney(v, currency, { maximumFractionDigits: 0 })}
      height={288}
    />
  );
}
