import { useMemo } from "react";
import { BarChart3, BedDouble, DollarSign, Users } from "lucide-react";
import { ChartCard } from "@/components/charts/ChartCard";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { TrendComparisonChart } from "@/components/charts/TrendComparisonChart";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { formatMoney } from "@/lib/currency";
import type {
  HostelAllocation,
  HostelDashboardStats,
  HostelPayment,
  HostelRoom,
} from "@/modules/hostel/lib/types";
type Props = {
  stats: HostelDashboardStats;
  allocations: HostelAllocation[];
  rooms: HostelRoom[];
  payments: HostelPayment[];
  currency?: string | null;
};

export function HostelReportsPanel({ stats, allocations, rooms, payments, currency }: Props) {
  const money = (v: number) => formatMoney(v, currency);

  const occupancyByHostel = useMemo(() => {
    const map = new Map<string, { label: string; occupied: number; available: number }>();
    for (const room of rooms) {
      const label = room.block_name ?? "Hostel";
      const cur = map.get(label) ?? { label, occupied: 0, available: 0 };
      cur.occupied += room.occupied;
      cur.available += Math.max(0, room.capacity - room.occupied);
      map.set(label, cur);
    }
    return [...map.values()].map((r) => ({
      label: r.label,
      occupied: r.occupied,
      available: r.available,
    }));
  }, [rooms]);

  const feeTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const p of payments) {
      const month = p.payment_date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + p.amount);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([label, current]) => ({ label, current }));
  }, [payments]);

  const studentsByHostel = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of allocations.filter((x) => x.allocation_status !== "checked_out")) {
      map.set(a.hostel_name, (map.get(a.hostel_name) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, count]) => ({ label, students: count }));
  }, [allocations]);

  const studentsByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of allocations.filter((x) => x.allocation_status !== "checked_out")) {
      map.set(a.class_name, (map.get(a.class_name) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, students: count }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 10);
  }, [allocations]);

  const availableRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.room_status === "available" && r.occupied < r.capacity)
        .map((r) => ({
          label: `${r.block_name} / ${r.room_number}`,
          available: r.capacity - r.occupied,
        })),
    [rooms],
  );

  const occupancyRows = occupancyByHostel.map((r) => [r.label, r.occupied, r.available]);
  const studentRows = allocations
    .filter((a) => a.allocation_status !== "checked_out")
    .map((a) => [
      a.student_name,
      a.admission_number,
      a.class_name,
      a.hostel_name,
      a.room_number,
      a.allocation_status,
      a.payment_status,
    ]);
  const paymentRows = payments.map((p) => [
    p.payment_date,
    p.receipt_number,
    p.student_name,
    p.hostel_name,
    p.room_number,
    p.amount,
    p.payment_method,
  ]);
  const availableRoomRows = availableRooms.map((r) => [r.label, r.available]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Occupancy by Hostel"
          description={`${stats.occupancy_rate.toFixed(1)}% overall occupancy`}
          icon={<BedDouble className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
          action={
            <ExportMenu
              filename="hostel-occupancy"
              title="Hostel Occupancy"
              headers={["Hostel", "Occupied", "Available"]}
              rows={occupancyRows}
            />
          }
        >
          <AnimatedBarChart
            data={occupancyByHostel}
            categoryKey="label"
            series={[
              { key: "occupied", label: "Occupied", color: "hsl(217, 91%, 60%)" },
              { key: "available", label: "Available", color: "hsl(142, 71%, 45%)" },
            ]}
            stacked
            height={260}
            className="dark:bg-[#0b0f0d]"
          />
        </ChartCard>

        <ChartCard
          title="Fee Collection Trend"
          description={`${money(stats.fee_collected)} collected · ${money(stats.outstanding_fees)} outstanding`}
          icon={<DollarSign className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
          action={
            <ExportMenu
              filename="hostel-payments"
              title="Hostel Payments"
              headers={["Date", "Receipt", "Student", "Hostel", "Room", "Amount", "Method"]}
              rows={paymentRows}
            />
          }
        >
          <TrendComparisonChart
            title=""
            subtitle=""
            data={feeTrend}
            currentLabel="Collected"
            valueFormatter={money}
            height={260}
            className="border-0 bg-transparent shadow-none dark:bg-transparent"
          />
        </ChartCard>

        <ChartCard
          title="Students by Hostel"
          description="Active hostel residents"
          icon={<Users className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
          action={
            <ExportMenu
              filename="hostel-students"
              title="Hostel Students"
              headers={["Student", "Admission", "Class", "Hostel", "Room", "Status", "Payment"]}
              rows={studentRows}
            />
          }
        >
          <AnimatedBarChart
            data={studentsByHostel}
            categoryKey="label"
            series={[{ key: "students", label: "Students", color: "hsl(var(--chart-2))" }]}
            height={260}
            className="dark:bg-[#0b0f0d]"
          />
        </ChartCard>

        <ChartCard
          title="Students by Class"
          description="Top classes in hostel"
          icon={<BarChart3 className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
        >
          <AnimatedBarChart
            data={studentsByClass}
            categoryKey="label"
            series={[{ key: "students", label: "Students", color: "hsl(var(--chart-3))" }]}
            height={260}
            layout="vertical"
            className="dark:bg-[#0b0f0d]"
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Available Rooms"
        description="Rooms with open bed capacity"
        icon={<BedDouble className="h-4 w-4" />}
        className="dark:bg-[#0b0f0d]"
        action={
          <ExportMenu
            filename="hostel-available-rooms"
            title="Available Rooms"
            headers={["Room", "Available Beds"]}
            rows={availableRoomRows}
          />
        }
      >
        <AnimatedBarChart
          data={availableRooms.slice(0, 15)}
          categoryKey="label"
          series={[{ key: "available", label: "Available beds", color: "hsl(142, 71%, 45%)" }]}
          height={240}
          layout="vertical"
          emptyMessage="No available rooms"
          className="dark:bg-[#0b0f0d]"
        />
      </ChartCard>
    </div>
  );
}
