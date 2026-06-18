import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RegisterAttendanceChart } from "@/register/components/RegisterAttendanceChart";
import type { AttendanceSummary } from "@/register/lib/attendance";

type MonthlyPoint = { month: string; present: number; absent: number; late: number; rate: number };

type Props = {
  summary: AttendanceSummary | null | undefined;
  classSummary?: AttendanceSummary | null;
  monthlyTrend?: MonthlyPoint[];
  loading?: boolean;
  compact?: boolean;
};

export function AttendanceAnalyticsPanel({
  summary,
  classSummary,
  monthlyTrend = [],
  loading,
  compact,
}: Props) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const studentPct = summary?.attendance_percentage ?? 0;
  const classPct = classSummary?.attendance_percentage ?? 0;
  const present = summary?.present_count ?? 0;
  const absent = summary?.absent_count ?? 0;
  const late = summary?.late_count ?? 0;
  const excused = summary?.excused_count ?? 0;

  const compareData = [
    { name: "Present", value: present, color: "#22c55e" },
    { name: "Absent", value: absent, color: "#ef4444" },
    { name: "Late", value: late, color: "#f97316" },
    { name: "Excused", value: excused, color: "#3b82f6" },
  ].filter((d) => d.value > 0);

  const rateComparison = [
    { label: "Student", rate: studentPct },
    { label: "Class", rate: classPct },
  ].filter((d) => d.rate > 0 || summary || classSummary);

  if (!summary && !classSummary && monthlyTrend.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Attendance statistics will appear here once teachers start recording attendance.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "lg:grid-cols-2"}`}>
      <RegisterAttendanceChart
        percent={Math.round(studentPct)}
        present={present}
        absent={absent}
        late={late}
      />

      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Present vs absent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    compareData.length
                      ? compareData
                      : [{ name: "No data", value: 1, color: "#94a3b8" }]
                  }
                  dataKey="value"
                  innerRadius={48}
                  outerRadius={72}
                  strokeWidth={0}
                >
                  {(compareData.length ? compareData : [{ color: "#94a3b8" }]).map((entry, i) => (
                    <Cell key={i} fill={(entry as { color: string }).color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {monthlyTrend.length > 0 && (
        <Card className="border-border/80 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly attendance trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={false} name="Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {rateComparison.length > 0 && (
        <Card className="border-border/80 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attendance percentage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rateComparison} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="rate" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
