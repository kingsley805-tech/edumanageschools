import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserSchoolId } from "@/lib/schoolFetch";
import { assignTeacherClassSubjects } from "@/lib/teacherClassSubjects";
import { useToast } from "@/hooks/use-toast";

type TeacherRow = {
  id: string;
  employee_no?: string | null;
  profiles?: { full_name?: string | null } | null;
};

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
};

type EnrollmentRow = {
  id: string;
  enrolled_on: string;
  students?: {
    id?: string;
    admission_no?: string | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  } | null;
};

type AssignmentRow = {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  subjects?: { name?: string; code?: string | null } | null;
};

type Props = {
  classId: string;
  className: string;
  classTeacherId?: string | null;
  teachers: TeacherRow[];
  onAssignClassTeacher: (classId: string, teacherId: string, currentTeacherId?: string | null) => Promise<void> | void;
  onClassesChanged?: () => void;
};

export function ClassRosterPanel({
  classId,
  className,
  classTeacherId,
  teachers,
  onAssignClassTeacher,
  onClassesChanged,
}: Props) {
  const { toast } = useToast();
  const [enrolledStudents, setEnrolledStudents] = useState<EnrollmentRow[]>([]);
  const [availableStudents, setAvailableStudents] = useState<
    { id: string; admission_no?: string | null; profiles?: { full_name?: string | null } | null }[]
  >([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [savingEnroll, setSavingEnroll] = useState(false);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [loading, setLoading] = useState(true);

  const teacherOptions = useMemo(
    () =>
      teachers.map((t) => ({
        value: t.id,
        label: t.profiles?.full_name?.trim() || "Teacher",
        description: t.employee_no ? `Emp. ${t.employee_no}` : undefined,
      })),
    [teachers],
  );

  const studentOptions = useMemo(
    () =>
      availableStudents.map((s) => ({
        value: s.id,
        label: s.profiles?.full_name?.trim() || "Student",
        description: s.admission_no || undefined,
      })),
    [availableStudents],
  );

  const assignedSubjectIds = useMemo(() => {
    if (!assignTeacherId) return new Set<string>();
    return new Set(
      assignments
        .filter((a) => a.teacher_id === assignTeacherId && a.class_id === classId)
        .map((a) => a.subject_id),
    );
  }, [assignments, assignTeacherId, classId]);

  const refresh = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const schoolId = await resolveUserSchoolId(user.id);
      if (!schoolId) return;

      const [enrollRes, allStudentsRes, enrolledIdsRes, subjectsRes, assignRes] = await Promise.all([
        supabase
          .from("enrollments")
          .select(`id, enrolled_on, students(id, admission_no, profiles(full_name, email))`)
          .eq("class_id", classId)
          .eq("status", "active"),
        supabase.from("students").select(`id, admission_no, profiles(full_name)`).eq("school_id", schoolId),
        supabase.from("enrollments").select("student_id").eq("class_id", classId).eq("status", "active"),
        supabase.from("subjects").select("id, name, code").eq("school_id", schoolId).order("name"),
        supabase
          .from("class_subjects")
          .select(`id, teacher_id, class_id, subject_id, subjects(name, code)`)
          .eq("class_id", classId),
      ]);

      if (enrollRes.data) setEnrolledStudents(enrollRes.data as EnrollmentRow[]);
      const enrolledIds = new Set((enrolledIdsRes.data ?? []).map((e) => e.student_id));
      setAvailableStudents((allStudentsRes.data ?? []).filter((s) => !enrolledIds.has(s.id)));
      if (subjectsRes.data) setSubjects(subjectsRes.data as SubjectRow[]);
      if (assignRes.data) setAssignments(assignRes.data as AssignmentRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    setSelectedStudent("");
    setAssignTeacherId("");
    setSelectedSubjectIds([]);
  }, [classId]);

  const handleEnroll = async () => {
    if (!selectedStudent) {
      toast({ title: "Select a student", variant: "destructive" });
      return;
    }
    setSavingEnroll(true);
    try {
      const { error } = await supabase.from("enrollments").insert([
        {
          student_id: selectedStudent,
          class_id: classId,
          enrolled_on: new Date().toISOString().split("T")[0],
          status: "active",
        },
      ]);
      if (error) throw error;
      await supabase.from("students").update({ class_id: classId }).eq("id", selectedStudent);
      toast({ title: "Success", description: "Student enrolled successfully" });
      setSelectedStudent("");
      await refresh();
      onClassesChanged?.();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Enrollment failed",
        variant: "destructive",
      });
    } finally {
      setSavingEnroll(false);
    }
  };

  const handleRemoveStudent = async (enrollmentId: string, studentId?: string) => {
    try {
      await supabase.from("enrollments").update({ status: "inactive" }).eq("id", enrollmentId);
      if (studentId) {
        await supabase.from("students").update({ class_id: null }).eq("id", studentId);
      }
      toast({ title: "Success", description: "Student removed from class" });
      await refresh();
      onClassesChanged?.();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Remove failed",
        variant: "destructive",
      });
    }
  };

  const handleAssignSubjects = async () => {
    if (!assignTeacherId) {
      toast({ title: "Select a teacher", variant: "destructive" });
      return;
    }
    if (selectedSubjectIds.length === 0) {
      toast({ title: "Select at least one subject", variant: "destructive" });
      return;
    }
    setSavingSubjects(true);
    try {
      const { assigned, skipped } = await assignTeacherClassSubjects(
        assignTeacherId,
        classId,
        selectedSubjectIds,
      );
      if (assigned === 0 && skipped > 0) {
        toast({
          title: "Already assigned",
          description: "This teacher already has the selected subject(s) for this class",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Success",
        description:
          assigned > 0 && skipped > 0
            ? `Assigned ${assigned} subject(s). ${skipped} already existed.`
            : `Assigned ${assigned} subject(s) successfully`,
      });
      setSelectedSubjectIds([]);
      await refresh();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Assignment failed",
        variant: "destructive",
      });
    } finally {
      setSavingSubjects(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase.from("class_subjects").delete().eq("id", assignmentId);
      if (error) throw error;
      toast({ title: "Success", description: "Subject assignment removed" });
      await refresh();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Remove failed",
        variant: "destructive",
      });
    }
  };

  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((prev) =>
      checked ? [...prev, subjectId] : prev.filter((id) => id !== subjectId),
    );
  };

  return (
    <div className="kt-card">
      <div className="kt-card-header flex flex-wrap gap-2.5 py-4 px-5 justify-between items-center">
        <div>
          <h3 className="kt-card-title">Class Roster & Assignments</h3>
          <p className="text-xs text-secondary-foreground">
            Enrolled students and teacher assignments for {className}
          </p>
        </div>
        <ExportMenu
          filename={`class-roster-${className}`}
          title={`Class Roster — ${className}`}
          headers={["Admission No", "Name", "Email", "Enrolled"]}
          rows={enrolledStudents.map((enrollment) => [
            enrollment.students?.admission_no ?? "",
            enrollment.students?.profiles?.full_name ?? "",
            enrollment.students?.profiles?.email || "—",
            new Date(enrollment.enrolled_on).toLocaleDateString(),
          ])}
          disabled={enrolledStudents.length === 0}
        />
      </div>

      <div className="kt-card-content p-5 space-y-6">
        {/* Assignment forms */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="kt-card channel-stats-bg border border-border/40 p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Class teacher</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Homeroom teacher for this class</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teacher</Label>
              <SearchableSelect
                options={[{ value: "unassigned", label: "Unassigned" }, ...teacherOptions]}
                value={classTeacherId || "unassigned"}
                onChange={(val) => void onAssignClassTeacher(classId, val, classTeacherId)}
                placeholder="Select teacher"
                searchPlaceholder="Search teachers…"
              />
            </div>
          </div>

          <div className="kt-card channel-stats-bg border border-border/40 p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Enroll student</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Add a student to this class roster</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Student</Label>
              <SearchableSelect
                options={studentOptions}
                value={selectedStudent}
                onChange={setSelectedStudent}
                placeholder="Select student"
                searchPlaceholder="Search by name or admission no…"
                emptyText="No available students"
                allowClear
              />
            </div>
            <Button
              type="button"
              className="kt-btn kt-btn-primary w-full"
              disabled={!selectedStudent || savingEnroll}
              onClick={() => void handleEnroll()}
            >
              {savingEnroll ? "Enrolling…" : "Enroll student"}
            </Button>
          </div>

          <div className="kt-card channel-stats-bg border border-border/40 p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Subject teacher</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Assign teacher to subjects in this class</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teacher</Label>
              <SearchableSelect
                options={teacherOptions}
                value={assignTeacherId}
                onChange={(id) => {
                  setAssignTeacherId(id);
                  setSelectedSubjectIds([]);
                }}
                placeholder="Select teacher"
                searchPlaceholder="Search teachers…"
                allowClear
              />
            </div>
            {assignTeacherId ? (
              <div className="max-h-36 overflow-y-auto space-y-2 rounded-lg border border-border/60 bg-card/60 p-2">
                {subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">No subjects configured</p>
                ) : (
                  subjects.map((subject) => {
                    const already = assignedSubjectIds.has(subject.id);
                    const checked = selectedSubjectIds.includes(subject.id);
                    return (
                      <label
                        key={subject.id}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked || already}
                          disabled={already}
                          onCheckedChange={(v) => toggleSubject(subject.id, Boolean(v))}
                        />
                        <span className="min-w-0 truncate">
                          {subject.name}
                          {subject.code ? (
                            <span className="text-muted-foreground text-xs"> ({subject.code})</span>
                          ) : null}
                          {already ? (
                            <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">Assigned</span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Select a teacher to choose subjects</p>
            )}
            <Button
              type="button"
              className="kt-btn kt-btn-primary w-full"
              disabled={!assignTeacherId || selectedSubjectIds.length === 0 || savingSubjects}
              onClick={() => void handleAssignSubjects()}
            >
              {savingSubjects ? "Saving…" : "Save subject assignment"}
            </Button>
          </div>
        </div>

        {/* Current subject assignments */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Current subject assignments</h4>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 rounded-lg border border-dashed border-border text-center">
              No subject teachers assigned yet
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table className="kt-table min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((row) => {
                    const teacherName =
                      teachers.find((t) => t.id === row.teacher_id)?.profiles?.full_name ?? "Teacher";
                    return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{teacherName}</TableCell>
                      <TableCell>{row.subjects?.name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-2sm">{row.subjects?.code || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleRemoveAssignment(row.id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Enrolled students */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Enrolled students</h4>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : enrolledStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 rounded-lg border border-dashed border-border">
              No students enrolled
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table className="kt-table min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledStudents.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-mono text-2sm">
                        {enrollment.students?.id ? (
                          <Link
                            to={`/admin/students/${enrollment.students.id}`}
                            className="text-foreground font-semibold hover:text-primary hover:underline"
                          >
                            {enrollment.students?.admission_no}
                          </Link>
                        ) : (
                          enrollment.students?.admission_no
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {enrollment.students?.id ? (
                          <Link
                            to={`/admin/students/${enrollment.students.id}`}
                            className="text-foreground hover:text-primary hover:underline"
                          >
                            {enrollment.students?.profiles?.full_name}
                          </Link>
                        ) : (
                          enrollment.students?.profiles?.full_name
                        )}
                      </TableCell>
                      <TableCell className="text-secondary-foreground">
                        {enrollment.students?.profiles?.email || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-2sm">
                        {new Date(enrollment.enrolled_on).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            void handleRemoveStudent(enrollment.id, enrollment.students?.id)
                          }
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
