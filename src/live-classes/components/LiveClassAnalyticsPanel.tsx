import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LiveClassAnalytics } from "@/live-classes/lib/types";

type Props = {
  analytics: LiveClassAnalytics | null;
  loading?: boolean;
};

export function LiveClassAnalyticsPanel({ analytics, loading }: Props) {
  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!analytics) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Online classes", value: analytics.totalClasses },
        { label: "Sessions (30d)", value: analytics.totalSessions },
        { label: "Attendance rate", value: `${analytics.attendanceRate}%` },
        { label: "Avg duration", value: `${analytics.avgDurationMinutes} min` },
      ].map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stat.value}</p>
          </CardContent>
        </Card>
      ))}

      {analytics.dailyActivity.length > 0 && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily online activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="sessions" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {analytics.topTeachers.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Most active teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {analytics.topTeachers.map((t) => (
                <li key={t.name} className="flex justify-between">
                  <span>{t.name}</span>
                  <span className="font-medium">{t.sessions} sessions</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
