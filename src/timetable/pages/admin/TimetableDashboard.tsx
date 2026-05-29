// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  deleteScheduleEntry,
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
  seedDefaultPeriods,
  upsertScheduleEntry,
  upsertTimetableSettings,
} from "@/timetable/lib/api";
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
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    school_open_time: "08:00",
    school_close_time: "15:00",
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
      if (!sid) return;
      setSchoolId(sid);

      const { data: school } = await supabase.from("schools").select("name").eq("id", sid).maybeSingle();
      setSchoolName(school?.name ?? "School");

      const [st, cls, subj, teach, termRows, per] = await Promise.all([
        fetchTimetableStats(sid),
        fetchClasses(sid),
        fetchSubjects(sid),
        fetchTeachers(sid),
        fetchTerms(sid),
        fetchPeriods(sid),
      ]);

      setStats(st);
      setClasses(cls);
      setSubjects(subj);
      setTeachers(teach);
      setTerms(termRows);

      let periodList = per;
      if (periodList.length === 0) {
        periodList = await seedDefaultPeriods(sid);
      }
      setPeriods(periodList);

      if (!classId && cls.length) setClassId(cls[0].id);
      const currentTerm = termRows.find((t) => t.is_current);
      if (currentTerm && termId === "all") setTermId(currentTerm.id);

      const settings = await fetchTimetableSettings(sid);
      if (settings) {
        setSettingsForm({
          school_open_time: settings.school_open_time?.slice(0, 5) ?? "08:00",
          school_close_time: settings.school_close_time?.slice(0, 5) ?? "15:00",
          period_duration_minutes: settings.period_duration_minutes,
          break_duration_minutes: settings.break_duration_minutes,
          lunch_duration_minutes: settings.lunch_duration_minutes,
          periods_per_day: settings.periods_per_day,
          include_saturday: settings.include_saturday,
        });
      }

      const scheds = await fetchSchedules({
        schoolId: sid,
        classId: classId || cls[0]?.id,
        termId: termId !== "all" ? termId : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setEntries(scheds);

      const alloc = await fetchSubjectAllocations(sid, classId || cls[0]?.id);
      setAllocations(alloc);
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
      const scheds = await fetchSchedules({
        schoolId,
        classId,
        termId: termId !== "all" ? termId : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setEntries(scheds);
      setAllocations(await fetchSubjectAllocations(schoolId, classId));
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

  const className = classes.find((c) => c.id === classId)?.name ?? "Class";
  const termLabel = terms.find((t) => t.id === termId)?.name ?? "Term";
  const sessionLabel = terms.find((t) => t.id === termId)?.session ?? sessionFilter;

  const openSlot = (day: number, period: TimetablePeriod, entry?: ScheduleEntry | null) => {
    setSlotDay(day);
    setSlotPeriod(period);
    setEditingEntry(entry ?? null);
    setSlotOpen(true);
  };

  const handleSaveSlot = async (data) => {
    if (!schoolId || !classId || !slotPeriod) return;
    const term = termId !== "all" ? termId : null;
    const termRow = terms.find((t) => t.id === termId);
    await upsertScheduleEntry({
      id: editingEntry?.id,
      schoolId,
      classId,
      subjectId: data.subject_id,
      teacherId: data.teacher_id,
      dayOfWeek: slotDay,
      startTime: slotPeriod.start_time,
      endTime: slotPeriod.end_time,
      room: data.room,
      termId: term,
      academicYearId: termRow?.academic_year_id ?? null,
      periodId: slotPeriod.id,
      status: "draft",
    });
    toast.success(editingEntry ? "Period updated" : "Period added");
    const scheds = await fetchSchedules({ schoolId, classId });
    setEntries(scheds);
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
      toast.error(e instanceof Error ? e.message : "Publish failed");
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

  const saveSettings = async () => {
    if (!schoolId) return;
    await upsertTimetableSettings(schoolId, settingsForm);
    toast.success("Timetable settings saved");
    setSettingsOpen(false);
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
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button size="sm" onClick={() => openSlot(1, periods.find((p) => p.period_type === "period") ?? periods[0])}>
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
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {subjects.map((s) => (
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
                {loading ? (
                  <p className="text-center py-12 text-muted-foreground">Loading timetable…</p>
                ) : (
                  <TimetableGrid
                    periods={periods}
                    entries={filteredEntries}
                    conflicts={conflicts}
                    editable
                    includeSaturday={settingsForm.include_saturday}
                    onCellClick={(day, period) => {
                      const existing = filteredEntries.find(
                        (e) =>
                          e.day_of_week === day &&
                          e.start_time.slice(0, 5) === period.start_time.slice(0, 5),
                      );
                      openSlot(day, period, existing);
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
              periods={periods}
              entries={filteredEntries}
              conflicts={conflicts}
              editable
              includeSaturday={settingsForm.include_saturday}
              onCellClick={(day, period) => {
                const existing = filteredEntries.find(
                  (e) =>
                    e.day_of_week === day && e.start_time.slice(0, 5) === period.start_time.slice(0, 5),
                );
                openSlot(day, period, existing);
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
              periods={periods}
              entries={teacherEntries}
              conflicts={detectTimetableConflicts(teacherEntries)}
              includeSaturday={settingsForm.include_saturday}
            />
          </TabsContent>

          <TabsContent value="student" className="mt-6">
            <TimetableGrid
              periods={periods}
              entries={filteredEntries.filter((e) => e.status === "published")}
              includeSaturday={settingsForm.include_saturday}
            />
            <p className="text-xs text-muted-foreground mt-2">Preview of published timetable as students see it.</p>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>School time settings</CardTitle>
                <CardDescription>Configure periods, breaks, and lunch for your bell schedule.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                <div className="space-y-2">
                  <Label>Opening time</Label>
                  <Input
                    type="time"
                    value={settingsForm.school_open_time}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, school_open_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Closing time</Label>
                  <Input
                    type="time"
                    value={settingsForm.school_close_time}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, school_close_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period duration (min)</Label>
                  <Input
                    type="number"
                    value={settingsForm.period_duration_minutes}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, period_duration_minutes: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Break duration (min)</Label>
                  <Input
                    type="number"
                    value={settingsForm.break_duration_minutes}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, break_duration_minutes: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lunch duration (min)</Label>
                  <Input
                    type="number"
                    value={settingsForm.lunch_duration_minutes}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, lunch_duration_minutes: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Periods per day</Label>
                  <Input
                    type="number"
                    value={settingsForm.periods_per_day}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, periods_per_day: Number(e.target.value) }))}
                  />
                </div>
                <Button onClick={saveSettings} className="sm:col-span-2 w-fit">
                  Save settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <TimetableSlotDialog
          open={slotOpen}
          onOpenChange={setSlotOpen}
          entry={editingEntry}
          dayOfWeek={slotDay}
          period={slotPeriod}
          subjects={subjects}
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
