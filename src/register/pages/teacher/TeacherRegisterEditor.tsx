// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Printer, Save, Send } from "lucide-react";
import { DailyRegisterTable } from "@/register/components/DailyRegisterTable";
import { useAuth } from "@/contexts/AuthContext";
import {
  createRegister,
  fetchAttendanceStatusTypes,
  fetchClassStudents,
  fetchClassSubjectsForClass,
  fetchClasses,
  fetchSchoolId,
  fetchSchoolTeachers,
  fetchTeacherAssignments,
  fetchTeacherId,
  fetchTerms,
  finalizeRegisterSubmission,
  getRegister,
  saveRegisterEntries,
  saveRegisterHeader,
  submitRegister,
  syncLegacyAttendance,
} from "@/register/lib/api";
import { RegisterStatusBadge } from "@/register/components/RegisterStatusBadge";

export default function TeacherRegisterEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isNew = id === "new" || !id;
  const isAdminRoute = location.pathname.startsWith("/admin/register");
  const layoutRole = isAdminRoute ? "admin" : "teacher";
  const registerBase = isAdminRoute ? "/admin/register" : "/teacher/register";

  const [schoolId, setSchoolId] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [adminClasses, setAdminClasses] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [schoolTeachers, setSchoolTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [statusTypes, setStatusTypes] = useState([]);
  const [terms, setTerms] = useState([]);
  const [register, setRegister] = useState(null);
  const [lines, setLines] = useState({});
  const [classStudents, setClassStudents] = useState([]);
  const [lessonSummary, setLessonSummary] = useState("");
  const [homework, setHomework] = useState("");
  const [saving, setSaving] = useState(false);

  const [classId, setClassId] = useState(searchParams.get("classId") ?? "");
  const [subjectId, setSubjectId] = useState(searchParams.get("subjectId") ?? "");
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodLabel, setPeriodLabel] = useState("Period 1");
  const [termId, setTermId] = useState("");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const sid = await fetchSchoolId(user.id);
      const tid = await fetchTeacherId(user.id);
      setSchoolId(sid);
      setTeacherId(tid);
      if (sid) {
        setStatusTypes(await fetchAttendanceStatusTypes(sid));
        const t = await fetchTerms(sid);
        setTerms(t);
        const current = t.find((x) => x.is_current);
        if (current) setTermId(current.id);
      }
      if (tid) setAssignments(await fetchTeacherAssignments(tid));
      if (sid && isAdminRoute) {
        setAdminClasses(await fetchClasses(sid));
        setSchoolTeachers(await fetchSchoolTeachers(sid));
      }
    })();
  }, [user, isAdminRoute]);

  useEffect(() => {
    if (!isAdminRoute || !classId) {
      setClassSubjects([]);
      return;
    }
    void fetchClassSubjectsForClass(classId).then((rows) => {
      setClassSubjects(rows);
      if (subjectId) {
        const match = rows.find((r) => r.subject_id === subjectId);
        if (match?.teacher_id) setSelectedTeacherId(match.teacher_id);
      }
    });
  }, [isAdminRoute, classId, subjectId]);

  useEffect(() => {
    if (!id || isNew) return;
    void getRegister(id).then((reg) => {
      if (!reg) return;
      setRegister(reg);
      setLessonSummary(reg.lesson_summary ?? "");
      setHomework(reg.homework ?? "");
      const map = {};
      for (const e of reg.entries) {
        map[e.student_id] = {
          attendance_status: e.attendance_status,
          time_in: e.time_in?.slice(0, 5) ?? "",
          participation: e.participation ?? "",
          remarks: e.remarks ?? "",
        };
      }
      setLines(map);
    });
  }, [id, isNew]);

  useEffect(() => {
    if (!classId || !isNew) return;
    void fetchClassStudents(classId).then((students) => {
      setClassStudents(students);
      const map = {};
      for (const s of students) {
        map[s.id] = lines[s.id] ?? { attendance_status: "present", time_in: "", participation: "", remarks: "" };
      }
      setLines(map);
    });
  }, [classId, isNew]);

  const effectiveTeacherId = isAdminRoute ? selectedTeacherId : teacherId;

  const readOnly =
    register?.locked || register?.status === "approved" || (register?.status === "submitted" && !isAdminRoute);

  const displayStudents = register?.entries?.length
    ? register.entries.map((e) => ({
        id: e.student_id,
        admission_no: e.students?.admission_no,
        gender: (e.students as { gender?: string })?.gender,
        profiles: e.students?.profiles,
      }))
    : classStudents;

  const classDisplayName =
    register?.classes?.name ??
    adminClasses.find((c) => c.id === classId)?.name ??
    assignments.find((a) => a.class_id === classId)?.classes?.name ??
    "";

  const subjectDisplayName =
    register?.subjects?.name ??
    classSubjects.find((s) => s.subject_id === subjectId)?.subjects?.name ??
    assignments.find((a) => a.subject_id === subjectId)?.subjects?.name ??
    "";

  const registerIdRef = useRef<string | null>(register?.id ?? null);
  registerIdRef.current = register?.id ?? registerIdRef.current;

  const persistDraft = useCallback(
    async (silent = false) => {
      if (!schoolId || !effectiveTeacherId || readOnly) return;
      if (isNew && (!classId || !subjectId)) return;

      let registerId = registerIdRef.current ?? register?.id;
      if (!registerId && isNew) {
        const term = terms.find((t) => t.id === termId);
        registerId = await createRegister({
          schoolId,
          classId,
          subjectId,
          teacherId: effectiveTeacherId,
          termId: termId || null,
          academicYearId: term?.academic_year_id ?? null,
          registerDate,
          periodLabel,
          createdBy: user?.id,
        });
        registerIdRef.current = registerId;
        if (!silent) navigate(`${registerBase}/${registerId}`, { replace: true });
      }
      if (!registerId) return;

      await saveRegisterHeader(registerId, { lesson_summary: lessonSummary, homework });
      const entryRows = Object.entries(lines).map(([student_id, v]) => ({
        student_id,
        attendance_status: (v as { attendance_status: string }).attendance_status,
        time_in: (v as { time_in: string }).time_in || null,
        participation: (v as { participation: string }).participation || null,
        remarks: (v as { remarks: string }).remarks || null,
      }));
      if (entryRows.length) await saveRegisterEntries(registerId, entryRows);
      if (!silent) toast.success("Draft saved");
    },
    [
      schoolId,
      effectiveTeacherId,
      readOnly,
      isNew,
      classId,
      subjectId,
      register?.id,
      terms,
      termId,
      registerDate,
      periodLabel,
      user?.id,
      lessonSummary,
      homework,
      lines,
      navigate,
      registerBase,
    ],
  );

  const debouncedAutosave = useDebouncedCallback(() => {
    void persistDraft(true);
  }, 1200);

  const handleLineChange = (studentId: string, patch: Record<string, string>) => {
    setLines((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? { attendance_status: "present", time_in: "", participation: "", remarks: "" }),
        ...patch,
      },
    }));
    debouncedAutosave();
  };

  const markAllPresent = () => {
    setLines((prev) => {
      const next = { ...prev };
      for (const s of displayStudents) {
        next[s.id] = {
          ...(next[s.id] ?? { time_in: "", participation: "", remarks: "" }),
          attendance_status: "present",
        };
      }
      return next;
    });
    debouncedAutosave();
  };

  const handleSave = async (submit = false) => {
    if (!schoolId || !effectiveTeacherId) {
      toast.error(isAdminRoute ? "Select a teacher for this register" : "Teacher profile not found");
      return;
    }
    if (isNew && (!classId || !subjectId)) {
      toast.error("Select class and subject");
      return;
    }
    setSaving(true);
    try {
      await persistDraft(true);
      let registerId = registerIdRef.current ?? register?.id;
      if (!registerId) throw new Error("Could not save register");

      if (submit) {
        await submitRegister(registerId, schoolId);
        const full = await getRegister(registerId);
        if (full) await syncLegacyAttendance(full);
        const sms = await finalizeRegisterSubmission(registerId);
        if (sms?.sent) {
          toast.success(`Submitted — ${sms.sent} parent SMS sent`);
        } else {
          toast.success("Attendance submitted — parents notified when phone numbers are linked");
        }
        navigate(registerBase);
      } else {
        toast.success("Draft saved");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const title = register
    ? `${register.classes?.name} · ${register.subjects?.name}`
    : "New class register";

  return (
    <DashboardLayout role={layoutRole}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <Button variant="ghost" size="sm" asChild>
          <Link to={registerBase}>← Back to registers</Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {registerDate} · {periodLabel}
              {register ? (
                <span className="ml-2">
                  <RegisterStatusBadge status={register.status} />
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            {!readOnly ? (
              <>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => void handleSave(false)}>
                  <Save className="h-4 w-4 mr-1" />
                  Save draft
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void handleSave(true)}>
                  <Send className="h-4 w-4 mr-1" />
                  Submit
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {isNew ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Register details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={registerDate} onChange={(e) => setRegisterDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select
                  value={classId}
                  onValueChange={(v) => {
                    setClassId(v);
                    setSubjectId("");
                    setSelectedTeacherId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdminRoute
                      ? adminClasses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))
                      : [...new Map(assignments.map((a) => [a.classes?.id, a.classes])).values()]
                          .filter(Boolean)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={subjectId}
                  onValueChange={(v) => {
                    setSubjectId(v);
                    if (isAdminRoute) {
                      const match = classSubjects.find((r) => r.subject_id === v);
                      if (match?.teacher_id) setSelectedTeacherId(match.teacher_id);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdminRoute
                      ? classSubjects.map((a) => (
                          <SelectItem key={a.subject_id} value={a.subject_id}>
                            {a.subjects?.name}
                          </SelectItem>
                        ))
                      : assignments
                          .filter((a) => !classId || a.class_id === classId)
                          .map((a) => (
                            <SelectItem key={a.subject_id} value={a.subject_id}>
                              {a.subjects?.name}
                            </SelectItem>
                          ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdminRoute ? (
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label>Teacher</Label>
                  <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolTeachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.profiles?.full_name ?? "Teacher"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {(classId && (displayStudents.length > 0 || register)) ? (
          <DailyRegisterTable
            className={classDisplayName}
            subjectName={subjectDisplayName}
            periodLabel={periodLabel}
            registerDate={registerDate}
            students={displayStudents}
            lines={lines}
            statusTypes={statusTypes}
            readOnly={readOnly}
            onChange={handleLineChange}
            onMarkAllPresent={readOnly ? undefined : markAllPresent}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select class and subject to open today&apos;s attendance register.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lesson summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Topic taught, objectives covered…"
              value={lessonSummary}
              disabled={readOnly}
              onChange={(e) => setLessonSummary(e.target.value)}
              rows={3}
            />
            <div className="space-y-2">
              <Label>Homework</Label>
              <Textarea
                placeholder="Homework given…"
                value={homework}
                disabled={readOnly}
                onChange={(e) => setHomework(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
