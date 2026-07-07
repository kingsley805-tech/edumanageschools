import { useMemo } from "react";
import { TrendComparisonChart } from "@/components/charts/TrendComparisonChart";
import { formatMoney } from "@/lib/currency";

interface Props {
  data: { month: string; online: number; manual: number }[];
  currency: string;
  loading: boolean;
}

export default function CollectionsOverviewChart({
  data,
  currency,
  loading,
}: Props) {
  const trendData = useMemo(() => {
    let previousTotal = 0;
    return data.map((row) => {
      const current = row.online + row.manual;
      const point = {
        label: row.month,
        current,
        previous: previousTotal,
        secondary: row.manual,
      };
      previousTotal = current;
      return point;
    });
  }, [data]);

  return (
    <TrendComparisonChart
      title="Collections trend"
      subtitle="Monthly collections — current vs prior month"
      data={trendData}
      currentLabel="Collections"
      previousLabel="Previous"
      secondaryLabel="Manual"
      loading={loading}
      emptyMessage="No payment data yet"
      valueFormatter={(v) => formatMoney(v, currency, { maximumFractionDigits: 0 })}
      height={300}
    />
  );
}
