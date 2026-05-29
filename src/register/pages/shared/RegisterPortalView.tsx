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
import { fetchParentRecordByUserId, fetchStudentsForParent } from "@/lib/parent-students";
import { fetchSchoolId, listRegisters } from "@/register/lib/api";

type PortalRole = "student" | "parent";

export function RegisterPortalView({ role, childStudentId }: { role: PortalRole; childStudentId?: string }) {
  const { user } = useAuth();
  const [classId, setClassId] = useState<string | null>(null);
  const [title, setTitle] = useState("Attendance");
  const [registers, setRegisters] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(childStudentId ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      try {
        const schoolId = await fetchSchoolId(user.id);
        if (!schoolId) return;

        if (role === "student") {
          const { data: st } = await supabase
            .from("students")
            .select("id, class_id, classes(name)")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!st?.class_id) return;
          setClassId(st.class_id);
          setTitle(`${(st.classes as { name?: string })?.name ?? "Class"} attendance`);
          setRegisters(await listRegisters({ schoolId, classId: st.class_id, status: "approved", limit: 40 }));
        } else {
          const parentData = await fetchParentRecordByUserId(user.id);
          if (!parentData) return;
          const kids = await fetchStudentsForParent<{ id: string; class_id: string; profiles: { full_name: string } | null; classes: { name: string } | null }>(
            parentData.id,
            "id, class_id, profiles:user_id(full_name), classes(name)",
          );
          setChildren(kids);
          const sid = selectedChild || kids[0]?.id;
          if (sid) {
            setSelectedChild(sid);
            const kid = kids.find((k) => k.id === sid) ?? kids[0];
            setClassId(kid?.class_id);
            setTitle(`${kid?.profiles?.full_name ?? "Child"} — attendance`);
            if (kid?.class_id) {
              setRegisters(await listRegisters({ schoolId, classId: kid.class_id, status: "approved", limit: 40 }));
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, role, selectedChild, childStudentId]);

  const [attendanceRate, setAttendanceRate] = useState(0);

  useEffect(() => {
    if (!classId || role !== "student" && !selectedChild) return;
    const studentId = role === "student" ? undefined : selectedChild;
    void (async () => {
      if (!studentId && role === "parent") return;
      let sid = studentId;
      if (role === "student" && user) {
        const { data: st } = await supabase.from("students").select("id").eq("user_id", user.id).maybeSingle();
        sid = st?.id;
      }
      if (!sid || !registers.length) {
        setAttendanceRate(0);
        return;
      }
      const ids = registers.map((r) => r.id);
      const { data: lines } = await supabase
        .from("register_student_entries")
        .select("attendance_status")
        .eq("student_id", sid)
        .in("register_id", ids);
      const total = lines?.length ?? 0;
      const present = (lines ?? []).filter((l) => l.attendance_status === "present").length;
      setAttendanceRate(total ? Math.round((present / total) * 100) : 0);
    })();
  }, [registers, classId, role, selectedChild, user]);

  const layoutRole = role === "parent" ? "parent" : "student";

  return (
    <DashboardLayout role={layoutRole}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Approved class registers & attendance</p>
        </div>

        {role === "parent" && children.length > 1 ? (
          <Select value={selectedChild} onValueChange={setSelectedChild}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.profiles?.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={attendanceRate || 0} className="flex-1" />
              <span className="text-lg font-semibold">{attendanceRate}%</span>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : registers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No published registers available yet.
            </CardContent>
          </Card>
        ) : (
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
                    <TableHead>Period</TableHead>
                    <TableHead>Teacher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registers.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.register_date).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell>{r.subjects?.name}</TableCell>
                      <TableCell>{r.period_label}</TableCell>
                      <TableCell>{r.teachers?.profiles?.full_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
