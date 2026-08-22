import { ClipboardCheck, Clock, UserX, Users } from "lucide-react";
import { DashboardStatCard, DashboardStatGrid } from "@/components/metronic/DashboardStatCard";
import type { RegisterDashboardStats } from "@/register/lib/types";

export function RegisterStatsCards({ stats }: { stats: RegisterDashboardStats }) {
  const attendanceSub =
    stats.attendanceTrend >= 0
      ? `↑ ${stats.attendanceTrend}% vs yesterday`
      : `↓ ${Math.abs(stats.attendanceTrend)}% vs yesterday`;

  return (
    <DashboardStatGrid className="xl:grid-cols-4">
      <DashboardStatCard
        label="Today's Attendance"
        value={`${stats.attendanceTodayPercent}%`}
        description={attendanceSub}
        icon={Users}
        tone={stats.attendanceTrend >= 0 ? "emerald" : "amber"}
      />
      <DashboardStatCard
        label="Registers Submitted"
        value={`${stats.registersSubmitted} / ${stats.registersExpected}`}
        description={`${Math.max(0, stats.registersExpected - stats.registersSubmitted)} pending submission`}
        icon={ClipboardCheck}
        tone="primary"
      />
      <DashboardStatCard
        label="Pending Approval"
        value={stats.pendingApproval}
        description="Awaiting admin review"
        icon={Clock}
        tone="amber"
      />
      <DashboardStatCard
        label="Absent Today"
        value={stats.absentToday}
        description={`Across ${stats.totalClasses} classes`}
        icon={UserX}
        tone="rose"
      />
    </DashboardStatGrid>
  );
}
