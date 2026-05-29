import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export function RegisterAttendanceChart({
  percent,
  present,
  absent,
  late,
}: {
  percent: number;
  present: number;
  absent: number;
  late: number;
}) {
  const data = [
    { name: "Present", value: present, color: "#22c55e" },
    { name: "Absent", value: absent, color: "#ef4444" },
    { name: "Late", value: late, color: "#f97316" },
  ].filter((d) => d.value > 0);

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Term attendance summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.length ? data : [{ name: "No data", value: 1, color: "#94a3b8" }]} innerRadius={52} outerRadius={72} dataKey="value" strokeWidth={0}>
                {(data.length ? data : [{ color: "#94a3b8" }]).map((entry, i) => (
                  <Cell key={i} fill={(entry as { color: string }).color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold">{percent}%</span>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">
          {present} present · {absent} absent · {late} late
        </p>
      </CardContent>
    </Card>
  );
}
