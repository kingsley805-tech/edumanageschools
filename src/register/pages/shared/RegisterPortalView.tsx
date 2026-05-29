// @ts-nocheck
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchParentRecordByUserId,
  fetchStudentsForParent,
  studentDisplayNameForParent,
} from "@/lib/parent-students";
import { fetchSchoolId, listRegisters } from "@/register/lib/api";
import { fetchAttendanceSummary, fetchStudentAttendanceRecords } from "@/register/lib/attendance";
import { fetchStudentDailyAttendance } from "@/lib/attendance-queries";
import { AttendanceStatusBadge } from "@/register/components/AttendanceStatusBadge";
import { fetchAttendanceStatusTypes } from "@/register/lib/api";

type PortalRole = "student" | "parent";

export function RegisterPortalView({ role, childStudentId }: { role: PortalRole; childStudentId?: string }) {
  const { user } = useAuth();
  const [classId, setClassId] = useState<string | null>(null);
  const [title, setTitle] = useState("Attendance");
  const [registers, setRegisters] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(childStudentId ?? "");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [statusTypes, setStatusTypes] = useState([]);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [currentTermId, setCurrentTermId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      try {
        const schoolId = await fetchSchoolId(user.id);
        if (!schoolId) return;
        setStatusTypes(await fetchAttendanceStatusTypes(schoolId));

        const { data: term } = await supabase
          .from("terms")
          .select("id")
          .eq("school_id", schoolId)
          .eq("is_current", true)
          .maybeSingle();
        setCurrentTermId(term?.id ?? null);

        if (role === "student") {
          const { data: st } = await supabase
            .from("students")
            .select("id, class_id, full_name, classes(name)")
            .eq("user_id", user.id)
            .maybeSingle();
          const studentName = st?.full_name?.trim() || "Class";
          if (!st?.class_id) return;
          setActiveStudentId(st.id);
          setClassId(st.class_id);
          setTitle(`${studentName} — ${(st.classes as { name?: string })?.name ?? "Class"} attendance`);
          setRegisters(await listRegisters({ schoolId, classId: st.class_id, status: "approved", limit: 40 }));
          setSummary(await fetchAttendanceSummary(st.id, term?.id));
          const registerRecords = await fetchStudentAttendanceRecords(st.id, 30);
          setRecords(
            registerRecords.length > 0
              ? registerRecords
              : (await fetchStudentDailyAttendance(st.id, 30)).map((r) => ({
                  id: r.id,
                  attendance_date: r.date,
                  attendance_status: r.status,
                  time_in: null,
                  remark: null,
                  subjects: r.subjectName ? { name: r.subjectName } : null,
                })),
          );
        } else {
          const parentData = await fetchParentRecordByUserId(user.id);
          if (!parentData) return;
          const kids = await fetchStudentsForParent<{
            id: string;
            class_id: string;
            full_name?: string | null;
            profiles: { full_name: string } | null;
            classes: { name: string } | null;
          }>(parentData.id, "id, class_id, full_name, profiles:user_id(full_name), classes(name)");
          setChildren(kids);
          const sid = selectedChild || kids[0]?.id;
          if (sid) {
            setSelectedChild(sid);
            setActiveStudentId(sid);
            const kid = kids.find((k) => k.id === sid) ?? kids[0];
            setClassId(kid?.class_id);
            setTitle(`${studentDisplayNameForParent(kid ?? {})} — attendance`);
            if (kid?.class_id) {
              setRegisters(await listRegisters({ schoolId, classId: kid.class_id, status: "approved", limit: 40 }));
            }
            setSummary(await fetchAttendanceSummary(sid, term?.id));
            const registerRecords = await fetchStudentAttendanceRecords(sid, 30);
            setRecords(
              registerRecords.length > 0
                ? registerRecords
                : (await fetchStudentDailyAttendance(sid, 30)).map((r) => ({
                    id: r.id,
                    attendance_date: r.date,
                    attendance_status: r.status,
                    time_in: null,
                    remark: null,
                    subjects: r.subjectName ? { name: r.subjectName } : null,
                  })),
            );
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, role, selectedChild, childStudentId]);

  const attendanceRate = summary?.attendance_percentage ?? 0;

  const layoutRole = role === "parent" ? "parent" : "student";

  return (
    <DashboardLayout role={layoutRole}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Term attendance from daily class registers</p>
        </div>

        {role === "parent" && children.length > 1 ? (
          <Select value={selectedChild} onValueChange={setSelectedChild}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {studentDisplayNameForParent(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Progress value={Number(attendanceRate) || 0} className="flex-1" />
              <span className="text-lg font-semibold">{attendanceRate}%</span>
            </div>
            {summary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Total sessions</p>
                  <p className="font-bold text-lg">{summary.total_days}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Present</p>
                  <p className="font-bold text-lg text-green-600">{summary.present_count}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Absent</p>
                  <p className="font-bold text-lg text-red-600">{summary.absent_count}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Late</p>
                  <p className="font-bold text-lg text-orange-600">{summary.late_count}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Summary builds automatically when teachers submit daily registers.
              </p>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : records.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent attendance</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.attendance_date).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell>{r.subjects?.name ?? "—"}</TableCell>
                      <TableCell>
                        <AttendanceStatusBadge code={r.attendance_status} statuses={statusTypes} />
                      </TableCell>
                      <TableCell className="text-sm">{r.remark ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : registers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No attendance records published yet.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
