// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  assignClassTeacherToProgram,
  enrollStudentInProgram,
  fetchProgramClassAssignments,
  fetchProgramEnrollments,
  removeProgramClassAssignment,
  removeProgramEnrollment,
  type ProgramClassAssignmentRow,
  type ProgramEnrollmentRow,
} from "@/modules/programs/lib/api";
import { toast } from "sonner";

type Props = {
  schoolId: string;
  programId: string;
  programName: string;
  userId?: string | null;
  canEdit: boolean;
};

export function ProgramEnrollmentPanel({
  schoolId,
  programId,
  programName,
  userId,
  canEdit,
}: Props) {
  const [enrollments, setEnrollments] = useState<ProgramEnrollmentRow[]>([]);
  const [assignments, setAssignments] = useState<ProgramClassAssignmentRow[]>([]);
  const [students, setStudents] = useState<
    { id: string; admission_no?: string | null; profiles?: { full_name?: string | null } | null }[]
  >([]);
  const [classes, setClasses] = useState<{ id: string; name: string; level?: string | null }[]>([]);
  const [teachers, setTeachers] = useState<
    { id: string; employee_no?: string | null; profiles?: { full_name?: string | null } | null }[]
  >([]);
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingStudent, setSavingStudent] = useState(false);
  const [savingClass, setSavingClass] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [enr, asn, stuRes, clsRes, teaRes] = await Promise.all([
        fetchProgramEnrollments(programId),
        fetchProgramClassAssignments(programId),
        supabase
          .from("students")
          .select("id, admission_no, profiles(full_name)")
          .eq("school_id", schoolId)
          .order("admission_no"),
        supabase.from("classes").select("id, name, level").eq("school_id", schoolId).order("name"),
        supabase
          .from("teachers")
          .select("id, employee_no, profiles(full_name)")
          .eq("school_id", schoolId),
      ]);
      setEnrollments(enr);
      setAssignments(asn);
      if (!stuRes.error) setStudents(stuRes.data ?? []);
      if (!clsRes.error) setClasses(clsRes.data ?? []);
      if (!teaRes.error) setTeachers(teaRes.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  }, [programId, schoolId]);

  useEffect(() => {
    void refresh();
    setStudentId("");
    setClassId("");
    setTeacherId("");
  }, [refresh]);

  const enrolledIds = useMemo(() => new Set(enrollments.map((e) => e.student_id)), [enrollments]);
  const assignedClassIds = useMemo(() => new Set(assignments.map((a) => a.class_id)), [assignments]);

  const studentOptions = useMemo(
    () =>
      students
        .filter((s) => !enrolledIds.has(s.id))
        .map((s) => ({
          value: s.id,
          label: s.profiles?.full_name?.trim() || "Student",
          description: s.admission_no || undefined,
        })),
    [students, enrolledIds],
  );

  const classOptions = useMemo(
    () =>
      classes
        .filter((c) => !assignedClassIds.has(c.id))
        .map((c) => ({
          value: c.id,
          label: c.name,
          description: c.level || undefined,
        })),
    [classes, assignedClassIds],
  );

  const teacherOptions = useMemo(
    () =>
      teachers.map((t) => ({
        value: t.id,
        label: t.profiles?.full_name?.trim() || "Teacher",
        description: t.employee_no ? `Emp. ${t.employee_no}` : undefined,
      })),
    [teachers],
  );

  const handleEnrollStudent = async () => {
    if (!studentId) {
      toast.error("Select a student");
      return;
    }
    setSavingStudent(true);
    try {
      await enrollStudentInProgram({
        schoolId,
        programId,
        studentId,
        userId,
      });
      toast.success("Student enrolled in program");
      setStudentId("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setSavingStudent(false);
    }
  };

  const handleAssignClass = async () => {
    if (!classId) {
      toast.error("Select a class");
      return;
    }
    if (!teacherId) {
      toast.error("Select a teacher for this class");
      return;
    }
    setSavingClass(true);
    try {
      await assignClassTeacherToProgram({
        schoolId,
        programId,
        classId,
        teacherId,
        userId,
      });
      toast.success("Class enrolled for teacher on this program");
      setClassId("");
      setTeacherId("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setSavingClass(false);
    }
  };

  return (
    <div className="space-y-5 border-t pt-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">Program enrollments</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enroll students or assign classes with teachers to {programName}
        </p>
      </div>

      {canEdit ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="kt-card channel-stats-bg border border-border/60 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <h5 className="text-sm font-semibold">Enroll student</h5>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Student</Label>
              <SearchableSelect
                options={studentOptions}
                value={studentId}
                onChange={setStudentId}
                placeholder="Select student"
                searchPlaceholder="Search by name or admission no…"
                emptyText="No available students"
                allowClear
              />
            </div>
            <Button
              type="button"
              className="kt-btn kt-btn-primary w-full"
              disabled={!studentId || savingStudent}
              onClick={() => void handleEnrollStudent()}
            >
              {savingStudent ? "Enrolling…" : "Enroll student"}
            </Button>
          </div>

          <div className="kt-card channel-stats-bg border border-border/60 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <h5 className="text-sm font-semibold">Enroll class for teacher</h5>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Class</Label>
              <SearchableSelect
                options={classOptions}
                value={classId}
                onChange={setClassId}
                placeholder="Select class"
                searchPlaceholder="Search classes…"
                emptyText="No available classes"
                allowClear
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teacher</Label>
              <SearchableSelect
                options={teacherOptions}
                value={teacherId}
                onChange={setTeacherId}
                placeholder="Select teacher"
                searchPlaceholder="Search teachers…"
                emptyText="No teachers found"
                allowClear
              />
            </div>
            <Button
              type="button"
              className="kt-btn kt-btn-primary w-full"
              disabled={!classId || !teacherId || savingClass}
              onClick={() => void handleAssignClass()}
            >
              {savingClass ? "Saving…" : "Enroll class for teacher"}
            </Button>
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" />
          Enrolled students ({enrollments.length})
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground py-3">Loading…</p>
        ) : enrollments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 rounded-lg border border-dashed text-center">
            No students enrolled yet
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Enrolled</TableHead>
                  {canEdit ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">
                      {row.students?.admission_no ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.students?.profiles?.full_name ?? "Student"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(row.enrolled_on).toLocaleDateString()}
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() =>
                            void removeProgramEnrollment(row.id)
                              .then(() => {
                                toast.success("Student removed");
                                return refresh();
                              })
                              .catch((e) =>
                                toast.error(e instanceof Error ? e.message : "Remove failed"),
                              )
                          }
                        >
                          Remove
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="h-4 w-4" />
          Class / teacher assignments ({assignments.length})
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground py-3">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 rounded-lg border border-dashed text-center">
            No classes assigned yet
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Assigned</TableHead>
                  {canEdit ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.classes?.name ?? "Class"}
                      {row.classes?.level ? (
                        <span className="text-muted-foreground text-xs"> · {row.classes.level}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {row.teachers?.profiles?.full_name ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(row.assigned_on).toLocaleDateString()}
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() =>
                            void removeProgramClassAssignment(row.id)
                              .then(() => {
                                toast.success("Assignment removed");
                                return refresh();
                              })
                              .catch((e) =>
                                toast.error(e instanceof Error ? e.message : "Remove failed"),
                              )
                          }
                        >
                          Remove
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
