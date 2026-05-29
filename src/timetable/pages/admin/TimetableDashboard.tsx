// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calendar, Download, Printer, Plus, Settings, Send, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TimetableStatsCards } from "@/timetable/components/TimetableStatsCards";
import { TimetableGrid } from "@/timetable/components/TimetableGrid";
import { ConflictAlertsPanel } from "@/timetable/components/ConflictAlertsPanel";
import { TeacherWorkloadPanel } from "@/timetable/components/TeacherWorkloadPanel";
import { TimetableSlotDialog } from "@/timetable/components/TimetableSlotDialog";
import { TimetableBellSlotDialog } from "@/timetable/components/TimetableBellSlotDialog";
import { BellScheduleSettings, type BellScheduleForm } from "@/timetable/components/BellScheduleSettings";
import {
  deleteScheduleEntry,
  fetchClassSubjectOptions,
  fetchClasses,
  fetchPeriods,
  fetchSchedules,
  fetchSchoolId,
  fetchSubjects,
  fetchTeachers,
  fetchTerms,
  fetchTimetableSettings,
  fetchTimetableStats,
  fetchSubjectAllocations,
  publishClassTimetable,
  localDefaultPeriods,
  seedDefaultPeriods,
  updateTimetablePeriod,
  upsertScheduleEntry,
  upsertTimetableSettings,
} from "@/timetable/lib/api";
import { durationMinutes, findEntryForPeriod, isValidTimeRange, toTimeInputValue } from "@/timetable/lib/timeUtils";
import { detectTimetableConflicts } from "@/timetable/lib/conflicts";
import { computeTeacherWorkloads } from "@/timetable/lib/workload";
import { exportTimetableExcel, exportTimetablePdf } from "@/timetable/lib/export";
import type { ScheduleEntry, TimetablePeriod } from "@/timetable/lib/types";

export default function TimetableDashboard() {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("School");
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState({ totalClasses: 0, totalTeachers: 0, teachersAssigned: 0, activeTimetables: 0, drafts: 0, published: 0 });
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [classSubjectOptions, setClassSubjectOptions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [terms, setTerms] = useState([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sessionFilter, setSessionFilter] = useState("all");
  const [termId, setTermId] = useState("all");
  const [classId, setClassId] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [teacherViewId, setTeacherViewId] = useState("all");

  const [slotOpen, setSlotOpen] = useState(false);
  const [slotDay, setSlotDay] = useState(1);
  const [slotPeriod, setSlotPeriod] = useState<TimetablePeriod | null>(null);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [bellDialogOpen, setBellDialogOpen] = useState(false);
  const [bellPeriod, setBellPeriod] = useState<TimetablePeriod | null>(null);
  const [settingsForm, setSettingsForm] = useState<BellScheduleForm & { break_duration_minutes: number; lunch_duration_minutes: number }>({
    school_open_time: "08:00",
    school_close_time: "15:00",
    break_start_time: "09:20",
    break_end_time: "09:40",
    lunch_start_time: "11:00",
    lunch_end_time: "11:40",
    period_duration_minutes: 40,
    break_duration_minutes: 20,
    lunch_duration_minutes: 40,
    periods_per_day: 8,
    include_saturday: false,
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const sid = await fetchSchoolId(user.id);
      if (!sid) {
        toast.error("Could not determine your school. Check your profile school assignment.");
        setClasses([]);
        return;
      }
      setSchoolId(sid);

      const { data: school } = await supabase.from("schools").select("name").eq("id", sid).maybeSingle();
      setSchoolName(school?.name ?? "School");

      // Load classes first — must not fail if optional timetable tables are missing
      const cls = await fetchClasses(sid);
      setClasses(cls);

      const [stResult, subjResult, teachResult, termResult, perResult] = await Promise.allSettled([
        fetchTimetableStats(sid),
        fetchSubjects(sid),
        fetchTeachers(sid),
        fetchTerms(sid),
        fetchPeriods(sid),
      ]);

      setStats(stResult.status === "fulfilled" ? stResult.value : { totalClasses: cls.length, totalTeachers: 0, teachersAssigned: 0, activeTimetables: 0, drafts: 0, published: 0 });
      setSubjects(subjResult.status === "fulfilled" ? subjResult.value : []);
      setTeachers(teachResult.status === "fulfilled" ? teachResult.value : []);
      const termRows = termResult.status === "fulfilled" ? termResult.value : [];
      setTerms(termRows);

      let periodList = perResult.status === "fulfilled" ? perResult.value : [];
      if (periodList.length === 0) {
        try {
          periodList = await seedDefaultPeriods(sid);
        } catch {
          periodList = localDefaultPeriods(sid);
        }
      }
      if (periodList.length === 0) periodList = localDefaultPeriods(sid);
      setPeriods(periodList);

      const breakRow = periodList.find((p) => p.period_type === "break");
      const lunchRow = periodList.find((p) => p.period_type === "lunch");

      const currentTerm = termRows.find((t) => t.is_current);
      if (currentTerm && termId === "all") setTermId(currentTerm.id);

      const activeClassId = classId || cls[0]?.id || "";
      if (!classId && activeClassId) setClassId(activeClassId);

      try {
        const settings = await fetchTimetableSettings(sid);
        if (settings) {
          setSettingsForm({
            school_open_time: settings.school_open_time?.slice(0, 5) ?? "08:00",
            school_close_time: settings.school_close_time?.slice(0, 5) ?? "15:00",
            break_start_time: breakRow ? toTimeInputValue(breakRow.start_time) : "09:20",
            break_end_time: breakRow ? toTimeInputValue(breakRow.end_time) : "09:40",
            lunch_start_time: lunchRow ? toTimeInputValue(lunchRow.start_time) : "11:00",
            lunch_end_time: lunchRow ? toTimeInputValue(lunchRow.end_time) : "11:40",
            period_duration_minutes: settings.period_duration_minutes,
            break_duration_minutes: settings.break_duration_minutes,
            lunch_duration_minutes: settings.lunch_duration_minutes,
            periods_per_day: settings.periods_per_day,
            include_saturday: settings.include_saturday,
          });
        } else if (breakRow || lunchRow) {
          setSettingsForm((f) => ({
            ...f,
            break_start_time: breakRow ? toTimeInputValue(breakRow.start_time) : f.break_start_time,
            break_end_time: breakRow ? toTimeInputValue(breakRow.end_time) : f.break_end_time,
            lunch_start_time: lunchRow ? toTimeInputValue(lunchRow.start_time) : f.lunch_start_time,
            lunch_end_time: lunchRow ? toTimeInputValue(lunchRow.end_time) : f.lunch_end_time,
          }));
        }
      } catch {
        /* optional table */
      }

      if (activeClassId) {
        setClassSubjectOptions(await fetchClassSubjectOptions(activeClassId, sid));
        const scheds = await fetchSchedules({
          schoolId: sid,
          classId: activeClassId,
          termId: termId !== "all" ? termId : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        });
        setEntries(scheds);
        try {
          setAllocations(await fetchSubjectAllocations(sid, activeClassId));
        } catch {
          setAllocations([]);
        }
      } else {
        setClassSubjectOptions([]);
        setEntries([]);
        setAllocations([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load timetable");
    } finally {
      setLoading(false);
    }
  }, [user, classId, termId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!schoolId || !classId) return;
    void (async () => {
      try {
        const [scheds, alloc, classSubs] = await Promise.all([
          fetchSchedules({
            schoolId,
            classId,
            termId: termId !== "all" ? termId : undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
          }),
          fetchSubjectAllocations(schoolId, classId),
          fetchClassSubjectOptions(classId, schoolId),
        ]);
        setEntries(scheds);
        setAllocations(alloc);
        setClassSubjectOptions(classSubs);
        setSubjectFilter("all");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load class timetable");
      }
    })();
  }, [schoolId, classId, termId, statusFilter]);

  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase
      .channel(`timetable-${schoolId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [schoolId, load]);

  const filteredEntries = useMemo(() => {
    let rows = entries;
    if (subjectFilter !== "all") rows = rows.filter((e) => e.subject_id === subjectFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (e) =>
          e.subjects?.name?.toLowerCase().includes(q) ||
          e.teachers?.profiles?.full_name?.toLowerCase().includes(q) ||
          e.room?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [entries, subjectFilter, search]);

  const teacherEntries = useMemo(() => {
    if (teacherViewId === "all") return entries;
    return entries.filter((e) => e.teacher_id === teacherViewId);
  }, [entries, teacherViewId]);

  const conflicts = useMemo(
    () => detectTimetableConflicts(filteredEntries, allocations),
    [filteredEntries, allocations],
  );

  const workloads = useMemo(() => computeTeacherWorkloads(entries), [entries]);

  const subjectFilterOptions = useMemo(() => {
    const source =
      classSubjectOptions.length > 0
        ? classSubjectOptions.map((s) => ({ id: s.subjectId, name: s.subjectName }))
        : subjects.map((s) => ({ id: s.id, name: s.name }));
    const seen = new Set<string>();
    return source.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [classSubjectOptions, subjects]);

  const className = classes.find((c) => c.id === classId)?.name ?? "Select a class";
  const termLabel = terms.find((t) => t.id === termId)?.name ?? "Term";
  const sessionLabel = terms.find((t) => t.id === termId)?.session ?? sessionFilter;

  const openSlot = (day: number, period: TimetablePeriod, entry?: ScheduleEntry | null) => {
    if (!classId) {
      toast.error("Select a class first");
      return;
    }
    if (period.period_type !== "period") return;
    if (classSubjectOptions.length === 0) {
      toast.error("No subjects assigned to this class. Link subjects in Admin → Teachers first.");
      return;
    }
    setSlotDay(day);
    setSlotPeriod(period);
    setEditingEntry(entry ?? null);
    setSlotOpen(true);
  };

  const handleSaveSlot = async (
    data: {
      subject_id: string;
      teacher_id: string;
      start_time: string;
      end_time: string;
      room?: string;
    },
    entryIdFromDialog?: string,
  ) => {
    if (!schoolId || !classId || !slotPeriod) return;
    const term = termId !== "all" ? termId : null;
    const termRow = terms.find((t) => t.id === termId);

    const existingInCell =
      editingEntry ??
      (entryIdFromDialog ? entries.find((e) => e.id === entryIdFromDialog) : undefined) ??
      findEntryForPeriod(slotDay, slotPeriod, entries) ??
      entries.find((e) => e.day_of_week === slotDay && e.period_id === slotPeriod.id);

    const resolvedId = entryIdFromDialog ?? existingInCell?.id;

    await upsertScheduleEntry({
      id: resolvedId,
      schoolId,
      classId,
      subjectId: data.subject_id,
      teacherId: data.teacher_id,
      dayOfWeek: slotDay,
      startTime: data.start_time,
      endTime: data.end_time,
      room: data.room,
      termId: term,
      academicYearId: termRow?.academic_year_id ?? null,
      periodId: slotPeriod.id,
      status: existingInCell?.status ?? "draft",
    });
    setEditingEntry(null);
    toast.success(resolvedId ? "Period updated" : "Period added");
    setEntries(
      await fetchSchedules({
        schoolId,
        classId,
        termId: termId !== "all" ? termId : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    );
  };

  const handleMoveEntry = async (entryId: string, day: number, period: TimetablePeriod) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || !schoolId) return;
    await upsertScheduleEntry({
      id: entryId,
      schoolId,
      classId: entry.class_id,
      subjectId: entry.subject_id,
      teacherId: entry.teacher_id!,
      dayOfWeek: day,
      startTime: period.start_time,
      endTime: period.end_time,
      room: entry.room ?? undefined,
      termId: entry.term_id,
      periodId: period.id,
      status: entry.status,
    });
    toast.success("Period moved");
    setEntries(await fetchSchedules({ schoolId, classId }));
  };

  const handlePublish = async () => {
    if (!schoolId || !classId) return;
    if (conflicts.some((c) => c.severity === "error")) {
      toast.error("Resolve conflicts before publishing");
      return;
    }
    try {
      await publishClassTimetable(classId, schoolId);
      toast.success("Timetable published — teachers and students notified");
      setEntries(await fetchSchedules({ schoolId, classId }));
      setStats(await fetchTimetableStats(schoolId));
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Publish failed";
      toast.error(msg);
    }
  };

  const handleExportExcel = () => exportTimetableExcel(className, filteredEntries, periods);
  const handleExportPdf = () =>
    exportTimetablePdf({
      schoolName,
      className,
      session: sessionLabel,
      term: termLabel,
      entries: filteredEntries,
      periods,
    });

  const handlePrint = () => window.print();

  const applyBellPeriodTimes = async (
    period: TimetablePeriod,
    startTime: string,
    endTime: string,
  ): Promise<TimetablePeriod> => {
    const next: TimetablePeriod = { ...period, start_time: startTime, end_time: endTime };
    const saved = await updateTimetablePeriod(period.id, { start_time: startTime, end_time: endTime });
    const merged = saved ?? next;
    setPeriods((list) => list.map((p) => (p.id === period.id ? merged : p)));
    if (period.period_type === "break") {
      setSettingsForm((f) => ({
        ...f,
        break_start_time: startTime,
        break_end_time: endTime,
        break_duration_minutes: durationMinutes(startTime, endTime),
      }));
    }
    if (period.period_type === "lunch") {
      setSettingsForm((f) => ({
        ...f,
        lunch_start_time: startTime,
        lunch_end_time: endTime,
        lunch_duration_minutes: durationMinutes(startTime, endTime),
      }));
    }
    return merged;
  };

  const openBellPeriod = (period: TimetablePeriod) => {
    setBellPeriod(period);
    setBellDialogOpen(true);
  };

  const saveSettings = async () => {
    if (!schoolId) return;
    if (!isValidTimeRange(settingsForm.break_start_time, settingsForm.break_end_time)) {
      toast.error("Break end time must be after start time.");
      return;
    }
    if (!isValidTimeRange(settingsForm.lunch_start_time, settingsForm.lunch_end_time)) {
      toast.error("Lunch end time must be after start time.");
      return;
    }
    setSettingsSaving(true);
    try {
      const breakDur = durationMinutes(settingsForm.break_start_time, settingsForm.break_end_time);
      const lunchDur = durationMinutes(settingsForm.lunch_start_time, settingsForm.lunch_end_time);

      await upsertTimetableSettings(schoolId, {
        school_open_time: settingsForm.school_open_time,
        school_close_time: settingsForm.school_close_time,
        period_duration_minutes: settingsForm.period_duration_minutes,
        break_duration_minutes: breakDur,
        lunch_duration_minutes: lunchDur,
        periods_per_day: settingsForm.periods_per_day,
        include_saturday: settingsForm.include_saturday,
      });

      let nextPeriods = [...periods];
      const breakP = periods.find((p) => p.period_type === "break");
      const lunchP = periods.find((p) => p.period_type === "lunch");
      if (breakP) {
        const saved = await updateTimetablePeriod(breakP.id, {
          start_time: settingsForm.break_start_time,
          end_time: settingsForm.break_end_time,
        });
        nextPeriods = nextPeriods.map((p) =>
          p.id === breakP.id
            ? { ...p, start_time: settingsForm.break_start_time, end_time: settingsForm.break_end_time, ...(saved ?? {}) }
            : p,
        );
      }
      if (lunchP) {
        const saved = await updateTimetablePeriod(lunchP.id, {
          start_time: settingsForm.lunch_start_time,
          end_time: settingsForm.lunch_end_time,
        });
        nextPeriods = nextPeriods.map((p) =>
          p.id === lunchP.id
            ? { ...p, start_time: settingsForm.lunch_start_time, end_time: settingsForm.lunch_end_time, ...(saved ?? {}) }
            : p,
        );
      }
      setPeriods(nextPeriods);
      setSettingsForm((f) => ({
        ...f,
        break_duration_minutes: breakDur,
        lunch_duration_minutes: lunchDur,
      }));

      toast.success("Bell schedule saved");
      setTab("dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const gridProps = {
    periods,
    schoolCloseTime: settingsForm.school_close_time,
    includeSaturday: settingsForm.include_saturday,
    onBellPeriodClick: openBellPeriod,
  };

  const sessions = [...new Set(terms.map((t) => t.session).filter(Boolean))];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 print:space-y-4" id="timetable-admin-root">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Timetable Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {schoolName} · Create, review, and publish class schedules
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setTab("settings")}>
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button
              size="sm"
              disabled={!classId || classSubjectOptions.length === 0}
              onClick={() => {
                const firstPeriod = periods.find((p) => p.period_type === "period");
                if (firstPeriod) openSlot(1, firstPeriod);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              New entry
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="print:hidden">
          <TabsList className="bg-muted/50 flex-wrap h-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="builder">Timetable Builder</TabsTrigger>
            <TabsTrigger value="teacher">Teacher View</TabsTrigger>
            <TabsTrigger value="student">Student View</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <TimetableStatsCards stats={stats} conflictCount={conflicts.length} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Session</Label>
                <Select value={sessionFilter} onValueChange={setSessionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sessions</SelectItem>
                    {sessions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Term</Label>
                <Select value={termId} onValueChange={setTermId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All terms</SelectItem>
                    {terms
                      .filter((t) => sessionFilter === "all" || t.session === sessionFilter)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Class</Label>
                {classes.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No classes found for your school.{" "}
                    <Link to="/admin/classes" className="text-primary underline underline-offset-2">
                      Open Classes
                    </Link>{" "}
                    to add one, or{" "}
                    <Link to="/admin/teacher-class-link" className="text-primary underline underline-offset-2">
                      link teachers & subjects
                    </Link>
                    .
                  </p>
                ) : (
                  <Select value={classId || undefined} onValueChange={setClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {subjectFilterOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="border-border/80">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Class Timetables</CardTitle>
                  <CardDescription>
                    {className} · {termLabel}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 print:hidden">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8 w-44 h-9"
                      placeholder="Search…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportExcel}>
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPdf}>
                    PDF
                  </Button>
                  <Button size="sm" onClick={handlePublish}>
                    <Send className="h-4 w-4 mr-1" />
                    Publish
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {classes.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-muted-foreground">No classes available for timetable setup.</p>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/admin/classes">Go to Classes</Link>
                    </Button>
                  </div>
                ) : !classId ? (
                  <p className="text-center py-12 text-muted-foreground">Select a class to view and edit its timetable.</p>
                ) : loading ? (
                  <p className="text-center py-12 text-muted-foreground">Loading timetable…</p>
                ) : (
                  <TimetableGrid
                    {...gridProps}
                    entries={filteredEntries}
                    conflicts={conflicts}
                    editable
                    onCellClick={(day, period, entry) => {
                      openSlot(day, period, entry ?? undefined);
                    }}
                    onMoveEntry={handleMoveEntry}
                  />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2 print:hidden">
              <TeacherWorkloadPanel workloads={workloads} />
              <ConflictAlertsPanel conflicts={conflicts} />
            </div>
          </TabsContent>

          <TabsContent value="builder" className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Drag subjects between cells or click a slot to assign. Changes auto-save as draft.
            </p>
            <TimetableGrid
              {...gridProps}
              entries={filteredEntries}
              conflicts={conflicts}
              editable
              onCellClick={(day, period, entry) => {
                openSlot(day, period, entry ?? undefined);
              }}
              onMoveEntry={handleMoveEntry}
            />
          </TabsContent>

          <TabsContent value="teacher" className="mt-6 space-y-4">
            <Select value={teacherViewId} onValueChange={setTeacherViewId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teachers (school)</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.profiles?.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TimetableGrid
              {...gridProps}
              entries={teacherEntries}
              conflicts={detectTimetableConflicts(teacherEntries)}
            />
          </TabsContent>

          <TabsContent value="student" className="mt-6">
            <TimetableGrid
              {...gridProps}
              entries={filteredEntries.filter((e) => e.status === "published")}
            />
            <p className="text-xs text-muted-foreground mt-2">Preview of published timetable as students see it.</p>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Bell schedule</CardTitle>
                <CardDescription>
                  Set break, lunch, and closing times. These appear on every timetable. You can also click
                  Break or Lunch on the grid to edit quickly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BellScheduleSettings
                  form={settingsForm}
                  onChange={(patch) => setSettingsForm((f) => ({ ...f, ...patch }))}
                  onSave={() => void saveSettings()}
                  saving={settingsSaving}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <TimetableBellSlotDialog
          open={bellDialogOpen}
          onOpenChange={setBellDialogOpen}
          period={bellPeriod}
          onSave={async (startTime, endTime) => {
            if (!bellPeriod) return;
            await applyBellPeriodTimes(bellPeriod, startTime, endTime);
            toast.success(`${bellPeriod.name} updated`);
          }}
        />

        <TimetableSlotDialog
          open={slotOpen}
          onOpenChange={setSlotOpen}
          entry={editingEntry}
          dayOfWeek={slotDay}
          period={slotPeriod}
          className={className}
          classSubjects={classSubjectOptions}
          teachers={teachers}
          onSave={handleSaveSlot}
          onDelete={
            editingEntry
              ? async () => {
                  await deleteScheduleEntry(editingEntry.id);
                  toast.success("Removed");
                  setSlotOpen(false);
                  if (schoolId && classId) setEntries(await fetchSchedules({ schoolId, classId }));
                }
              : undefined
          }
        />
      </div>
    </DashboardLayout>
  );
}
