import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchParentRecordByUserId, fetchStudentsForParent } from "@/lib/parent-students";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchStudentAttendanceRate, fetchStudentDailyAttendance } from "@/lib/attendance-queries";
import { useToast } from "@/hooks/use-toast";

const Attendance = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [children, setChildren] = useState<{ id: string; profiles: { full_name: string } | null }[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [attendanceRecords, setAttendanceRecords] = useState<
    Awaited<ReturnType<typeof fetchStudentDailyAttendance>>
  >([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, rate: "0" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild) void fetchAttendance();
  }, [selectedChild]);

  const fetchChildren = async () => {
    if (!user) return;

    const parentData = await fetchParentRecordByUserId(user.id);
    if (!parentData) return;

    const studentsData = await fetchStudentsForParent<{ id: string; profiles: { full_name: string } | null }>(
      parentData.id,
      "id, profiles:user_id(full_name)",
    );

    if (studentsData.length > 0) {
      setChildren(studentsData);
      setSelectedChild(studentsData[0].id);
    }
  };

  const fetchAttendance = async () => {
    if (!selectedChild) return;
    setLoading(true);
    try {
      const [daily, rateStats] = await Promise.all([
        fetchStudentDailyAttendance(selectedChild, 30),
        fetchStudentAttendanceRate(selectedChild),
      ]);

      setAttendanceRecords(daily);
      setStats({
        total: rateStats.total,
        present: rateStats.present,
        absent: rateStats.total - rateStats.present,
        rate: rateStats.rate.toFixed(1),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not load attendance";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Attendance</h2>
            <p className="text-muted-foreground">View your child's attendance records</p>
          </div>
          {children.length > 0 && (
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.profiles?.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rate}%</div>
              <p className="text-xs text-muted-foreground">Current term / recent sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Days</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.present}</div>
              <p className="text-xs text-muted-foreground">Out of {stats.total} days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent Days</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.absent}</div>
              <p className="text-xs text-muted-foreground">Out of {stats.total} days</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>Recent attendance history</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-12">Loading…</p>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No attendance records yet</p>
                <p className="text-sm text-muted-foreground">Check back once attendance has been recorded</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendanceRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {record.status === "present" ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : record.status === "absent" ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Clock className="h-5 w-5 text-warning" />
                      )}
                      <div>
                        <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.subjectName ? `${record.subjectName} · ` : ""}
                          {record.recordedAt
                            ? `Recorded ${new Date(record.recordedAt).toLocaleString()}`
                            : "From class register"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        record.status === "present"
                          ? "default"
                          : record.status === "absent"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
