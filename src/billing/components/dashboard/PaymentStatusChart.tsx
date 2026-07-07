import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";

interface Props {
  data: { name: string; value: number; color: string }[];
  loading: boolean;
}

export default function PaymentStatusChart({ data, loading }: Props) {
  const chartData = [
    data.reduce<Record<string, string | number>>(
      (acc, item) => {
        acc[item.name] = item.value;
        return acc;
      },
      { name: "Status" },
    ),
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">
        Payment Status
      </h3>
      <AnimatedBarChart
        data={chartData}
        categoryKey="name"
        layout="vertical"
        height={208}
        loading={loading}
        emptyMessage="No invoice data yet"
        valueFormatter={(v) => `${v}%`}
        series={data.map((item) => ({
          key: item.name,
          label: item.name,
          color: item.color,
        }))}
      />
    </div>
  );
}
