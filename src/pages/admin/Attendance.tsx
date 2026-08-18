import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, TrendingUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchSchoolAttendanceList } from "@/lib/attendance-queries";
import { useToast } from "@/hooks/use-toast";

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState<Awaited<ReturnType<typeof fetchSchoolAttendanceList>>>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0 });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    void fetchClasses();
  }, []);

  useEffect(() => {
    void fetchAttendance();
  }, [selectedClass]);

  const fetchClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;

    const { data } = await supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", profileData.school_id)
      .order("name");

    if (data) setClasses(data);
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (!profileData?.school_id) return;

      const data = await fetchSchoolAttendanceList(profileData.school_id, {
        classId: selectedClass === "all" ? undefined : selectedClass,
        limit: 100,
      });

      setAttendanceData(data);

      const total = data.length;
      const present = data.filter((a) => a.status === "present").length;
      const absent = data.filter((a) => a.status === "absent").length;
      const late = data.filter((a) => a.status === "late").length;

      setStats({ total, present, absent, late });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not load attendance";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge variant="success">Present</Badge>
        );
      case "absent":
        return <Badge variant="destructive">Absent</Badge>;
      case "late":
        return <Badge variant="warning">Late</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const attendanceRate = stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : "0.0";

  return (
    <DashboardLayout role="admin">
      {/* Page Header — Metronic toolbar */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Attendance Reports</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Daily registers, student roll calls, and school-wide attendance rates
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Filter by class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-7.5 mb-7.5">
        <div className="kt-card channel-stats-bg">
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-sm font-normal text-secondary-foreground">Total Records</span>
              <span className="flex items-center justify-center size-10 shrink-0 rounded-lg bg-accent/60 border border-border">
                <i className="ki-filled ki-people text-lg text-muted-foreground" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-mono">{stats.total}</span>
          </div>
        </div>
        <div className="kt-card channel-stats-bg">
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-sm font-normal text-secondary-foreground">Present</span>
              <span className="flex items-center justify-center size-10 shrink-0 rounded-lg bg-success/10 border border-success/20">
                <i className="ki-filled ki-check-circle text-lg text-success" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-mono text-success">{stats.present}</span>
          </div>
        </div>
        <div className="kt-card channel-stats-bg">
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-sm font-normal text-secondary-foreground">Absent</span>
              <span className="flex items-center justify-center size-10 shrink-0 rounded-lg bg-danger/10 border border-danger/20">
                <i className="ki-filled ki-cross-circle text-lg text-danger" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-mono text-danger">{stats.absent}</span>
          </div>
        </div>
        <div className="kt-card channel-stats-bg">
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-sm font-normal text-secondary-foreground">Attendance Rate</span>
              <span className="flex items-center justify-center size-10 shrink-0 rounded-lg bg-primary/10 border border-primary/20">
                <i className="ki-filled ki-chart-line text-lg text-primary" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-mono text-primary">{attendanceRate}%</span>
          </div>
        </div>
      </div>

      <div className="kt-card">
        <div className="kt-card-header flex justify-between items-center py-4 px-5">
          <div>
            <h3 className="kt-card-title">Recent Attendance Records</h3>
            <p className="text-xs text-secondary-foreground">From class registers and daily roll calls</p>
          </div>
        </div>
        <div className="kt-card-content p-0 overflow-x-auto">
          {loading ? (
            <p className="text-center text-muted-foreground py-12">Loading attendance…</p>
          ) : attendanceData.length === 0 ? (
            <div className="text-center py-12">
              <i className="ki-filled ki-calendar-8 text-4xl text-muted-foreground mx-auto mb-3 block" />
              <p className="text-base font-medium">No attendance records found</p>
              <p className="text-sm text-muted-foreground">Data appears here when teachers mark attendance or submit registers</p>
            </div>
          ) : (
            <Table className="kt-table min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceData.map((record) => (
                  <TableRow key={`${record.source}-${record.id}`}>
                    <TableCell className="font-mono text-2sm">{new Date(record.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium text-mono">
                      {record.studentId ? (
                        <Link
                          to={`/admin/students/${record.studentId}`}
                          className="text-foreground hover:text-primary hover:underline font-semibold"
                        >
                          {record.studentName}
                        </Link>
                      ) : (
                        record.studentName
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-2sm">
                      {record.studentId ? (
                        <Link
                          to={`/admin/students/${record.studentId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {record.admissionNo || "—"}
                        </Link>
                      ) : (
                        record.admissionNo || "—"
                      )}
                    </TableCell>
                    <TableCell className="text-secondary-foreground">
                      {record.classId ? (
                        <Link
                          to={`/admin/classes/${record.classId}`}
                          className="hover:text-primary hover:underline font-medium text-foreground"
                        >
                          {record.className}
                        </Link>
                      ) : (
                        record.className
                      )}
                    </TableCell>
                    <TableCell className="text-secondary-foreground">{record.subjectName ?? (record.source === "legacy" ? "Daily roll call" : "—")}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
