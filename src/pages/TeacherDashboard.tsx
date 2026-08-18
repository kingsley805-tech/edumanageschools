import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTerm } from "@/report/hooks/use-school-data";
import { useClassAttendanceSummary } from "@/register/hooks/use-attendance-summary";
import { TeacherAssignmentsPanel } from "@/components/class-subjects/TeacherAssignmentsPanel";
import { cn } from "@/lib/utils";
import { MingoLineChart, type MingoLinePoint } from "@/components/charts/MingoLineChart";
import { MingoCategoryBars, type MingoCategoryItem } from "@/components/charts/MingoCategoryBars";

type ScheduleRow = {
  subject?: { name?: string } | null;
  class?: { name?: string } | null;
  start_time?: string;
  end_time?: string;
  room?: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  due_date: string;
  class?: { name?: string } | null;
};

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    classes: "0",
    students: "0",
    assignments: "0",
    today: "0",
  });
  const [upcomingClasses, setUpcomingClasses] = useState<ScheduleRow[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<AssignmentRow[]>([]);
  const [primaryClassId, setPrimaryClassId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [trendPoints, setTrendPoints] = useState<MingoLinePoint[]>([]);
  const { data: term } = useCurrentTerm();
  const { data: classSummary } = useClassAttendanceSummary(primaryClassId, term?.id);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!primaryClassId) return;
    void fetchClassTrend(primaryClassId);
  }, [primaryClassId]);

  const fetchClassTrend = async (classId: string) => {
    const days = 7;
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().split("T")[0];
    });

    const points = await Promise.all(
      dates.map(async (date) => {
        const { data } = await supabase
          .from("attendance_records")
          .select("attendance_status")
          .eq("class_id", classId)
          .eq("attendance_date", date);
        const rows = data ?? [];
        const present = rows.filter((r) => String(r.attendance_status).toLowerCase() === "present").length;
        const absent = rows.filter((r) => String(r.attendance_status).toLowerCase() === "absent").length;
        return {
          label: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          primary: present,
          secondary: absent,
        };
      }),
    );
    setTrendPoints(points);
  };

  const fetchDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!teacherData) return;

    setTeacherId(teacherData.id);

    const { data: classSubjectsData } = await supabase
      .from("class_subjects")
      .select("id, class:classes(name, id)")
      .eq("teacher_id", teacherData.id);

    const classIds = [...new Set(classSubjectsData?.map((c) => c.class?.id).filter(Boolean) || [])];
    setPrimaryClassId(classIds[0] ?? null);
    const uniqueClasses = classSubjectsData?.filter(
      (item, index, self) => index === self.findIndex((t) => t.class?.id === item.class?.id),
    ) || [];

    const [assignmentsRes, schedulesRes, studentsRes] = await Promise.all([
      supabase.from("assignments").select("id", { count: "exact", head: true }).eq("created_by", user.id),
      supabase
        .from("schedules")
        .select("*, class:classes(name), subject:subjects(name)")
        .eq("day_of_week", new Date().getDay())
        .eq("teacher_id", teacherData.id),
      classIds.length > 0
        ? supabase.from("students").select("id", { count: "exact", head: true }).in("class_id", classIds)
        : Promise.resolve({ count: 0 }),
    ]);

    setStats({
      classes: uniqueClasses.length.toString(),
      students: studentsRes.count?.toString() || "0",
      assignments: assignmentsRes.count?.toString() || "0",
      today: schedulesRes.data?.length.toString() || "0",
    });

    setUpcomingClasses(schedulesRes.data || []);

    const { data: assignmentsData } = await supabase
      .from("assignments")
      .select("*, class:classes(name)")
      .eq("created_by", user.id)
      .order("due_date", { ascending: true })
      .limit(5);

    setRecentAssignments(assignmentsData || []);
  };

  const categoryItems: MingoCategoryItem[] = classSummary && classSummary.total_days > 0
    ? (() => {
        const rows = [
          { name: "Present", count: classSummary.present_count },
          { name: "Absent", count: classSummary.absent_count },
          { name: "Late", count: classSummary.late_count },
          { name: "Excused", count: classSummary.excused_count },
        ].filter((r) => r.count > 0);
        const total = rows.reduce((s, r) => s + r.count, 0) || 1;
        const max = Math.max(...rows.map((r) => r.count), 1);
        return rows.map((r) => ({
          name: r.name,
          value: `${((r.count / total) * 100).toFixed(1)}%`,
          percent: Math.max(8, Math.round((r.count / max) * 82)),
        }));
      })()
    : [];

  return (
    <DashboardLayout role="teacher">
      {/* Page head — Metronic page title block */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Your classes, assignments, registers, and reports in one place.
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="kt-btn kt-btn-outline"
            onClick={() => navigate("/teacher/attendance")}
          >
            <i className="ki-filled ki-calendar-8 text-base" />
            Mark attendance
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-primary"
            onClick={() => navigate("/teacher/assignments")}
          >
            <i className="ki-filled ki-plus text-base" />
            New assignment
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-7.5 mb-5 lg:mb-7.5">
        {[
          { label: "My Classes", value: stats.classes, icon: "book-open" },
          { label: "Total Students", value: stats.students, icon: "users" },
          { label: "Assignments", value: stats.assignments, icon: "document" },
          { label: "Today&apos;s Classes", value: stats.today, icon: "timer" },
        ].map((kpi) => (
          <div className="kt-card channel-stats-bg" key={kpi.label}>
            <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2.5">
                <span className="text-sm font-normal text-secondary-foreground">
                  {kpi.label}
                </span>
                <span className="flex items-center justify-center size-10 shrink-0 rounded-lg bg-accent/60 border border-border">
                  <i className={`ki-filled ki-${kpi.icon} text-lg text-muted-foreground`} />
                </span>
              </div>
              <span className="text-3xl font-semibold text-mono">{kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
        <div className="kt-card lg:col-span-2">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Class attendance — last 7 days</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5">
            {trendPoints.length ? (
              <MingoLineChart
                points={trendPoints}
                primaryLabel="Present"
                secondaryLabel="Absent"
                yMaxLabel={String(
                  Math.max(1, ...trendPoints.map((p) => Math.max(p.primary, p.secondary))),
                )}
                yMidLabel=""
                yMinLabel="0"
              />
            ) : (
              <p className="text-sm text-secondary-foreground">
                No attendance recorded yet for this class.
              </p>
            )}
          </div>
        </div>

        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Term attendance breakdown</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5">
            {categoryItems.length ? (
              <MingoCategoryBars items={categoryItems} bordered={false} />
            ) : (
              <p className="text-sm text-secondary-foreground">No data yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-5 lg:mb-7.5">
        <TeacherAssignmentsPanel teacherId={teacherId} />
      </div>

      {/* Schedule + assignments */}
      <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Today&apos;s schedule</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-1">
            {upcomingClasses.length === 0 ? (
              <p className="text-sm text-secondary-foreground py-4">No classes today.</p>
            ) : (
              upcomingClasses.map((cls, index) => (
                <div
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-b-border last:border-b-0"
                  key={index}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="kt-badge kt-badge-sm kt-badge-info kt-badge-outline shrink-0">
                      CLS
                    </span>
                    <span className="text-sm font-normal text-foreground truncate">
                      {cls.subject?.name}{" "}
                      <span className="text-secondary-foreground">· {cls.class?.name}</span>
                    </span>
                  </div>
                  <span className="shrink-0 text-2sm font-normal text-muted-foreground">
                    {cls.start_time} - {cls.end_time}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Assignment status</h3>
            <button
              type="button"
              className="kt-btn kt-btn-ghost kt-btn-sm text-muted-foreground hover:text-primary"
              onClick={() => navigate("/teacher/assignments")}
            >
              View all
              <i className="ki-filled ki-right text-xs" />
            </button>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-1">
            {recentAssignments.length === 0 ? (
              <p className="text-sm text-secondary-foreground py-4">No assignments yet.</p>
            ) : (
              recentAssignments.slice(0, 5).map((assignment, index) => (
                <div
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-b-border last:border-b-0"
                  key={index}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="kt-badge kt-badge-sm kt-badge-warning kt-badge-outline shrink-0">
                      DUE
                    </span>
                    <span className="text-sm font-normal text-foreground truncate">
                      {assignment.title}{" "}
                      <span className="text-secondary-foreground">
                        · {assignment.class?.name}
                      </span>
                    </span>
                  </div>
                  <span className="shrink-0 text-2sm font-normal text-muted-foreground">
                    {new Date(assignment.due_date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="kt-card">
        <div className="kt-card-header">
          <h3 className="kt-card-title">Quick actions</h3>
        </div>
        <div className="kt-card-content p-5 lg:p-7.5 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="kt-btn kt-btn-outline justify-start"
            onClick={() => navigate("/teacher/attendance")}
          >
            <i className="ki-filled ki-calendar-8 text-base" />
            Mark attendance
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-outline justify-start"
            onClick={() => navigate("/teacher/assignments")}
          >
            <i className="ki-filled ki-document text-base" />
            Create assignment
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-outline justify-start"
            onClick={() => navigate("/teacher/classes")}
          >
            <i className="ki-filled ki-book-open text-base" />
            View classes
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
