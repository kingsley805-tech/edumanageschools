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
      <div className="mingo-content">
        <div className="mingo-page-head">
          <div>
            <h1>Teacher dashboard</h1>
            <p>Your classes, assignments, registers, and reports in one place.</p>
          </div>
          <div className="mingo-head-actions">
            <button
              type="button"
              className="mingo-btn mingo-btn-ghost"
              onClick={() => navigate("/teacher/attendance")}
            >
              Mark attendance
            </button>
            <button
              type="button"
              className="mingo-btn mingo-btn-primary"
              onClick={() => navigate("/teacher/assignments")}
            >
              + New assignment
            </button>
          </div>
        </div>

        <div className="mingo-kpi-row">
          <div className="mingo-kpi">
            <div className="label">My Classes</div>
            <div className="val mono">{stats.classes}</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Total Students</div>
            <div className="val mono">{stats.students}</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Assignments</div>
            <div className="val mono">{stats.assignments}</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Today's Classes</div>
            <div className="val mono">{stats.today}</div>
          </div>
        </div>

        <div className="mingo-charts-row">
          <div className="mingo-panel mingo-charts-line">
            <div className="mingo-panel-head">
              <h2>Class attendance — last 7 days</h2>
            </div>
            <div className="mingo-panel-body" style={{ paddingTop: 14 }}>
              {trendPoints.length ? (
                <MingoLineChart
                  points={trendPoints}
                  primaryLabel="Present"
                  secondaryLabel="Absent"
                  yMaxLabel={String(Math.max(1, ...trendPoints.map((p) => Math.max(p.primary, p.secondary))))}
                  yMidLabel=""
                  yMinLabel="0"
                />
              ) : (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">
                  No attendance recorded yet for this class.
                </p>
              )}
            </div>
          </div>

          <div className="mingo-panel mingo-charts-cat">
            <div className="mingo-panel-head">
              <h2>Term attendance breakdown</h2>
            </div>
            <div className="mingo-panel-body">
              {categoryItems.length ? (
                <MingoCategoryBars items={categoryItems} bordered={false} />
              ) : (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No data yet.</p>
              )}
            </div>
          </div>
        </div>

        <TeacherAssignmentsPanel teacherId={teacherId} />

        <div className="mingo-grid-2b" style={{ marginTop: 18 }}>
          <div className="mingo-panel">
            <div className="mingo-panel-head">
              <h2>Today's schedule</h2>
            </div>
            <div className="mingo-panel-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {upcomingClasses.length === 0 ? (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))] py-4">No classes today.</p>
              ) : (
                upcomingClasses.map((cls, index) => (
                  <div className="mingo-activity-row" key={index}>
                    <span className="mingo-a-tag exm">CLS</span>
                    <div className="a-desc">
                      {cls.subject?.name} <span className="who">· {cls.class?.name}</span>
                    </div>
                    <span className="a-time">
                      {cls.start_time} - {cls.end_time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mingo-panel">
            <div className="mingo-panel-head">
              <h2>Assignment status</h2>
              <button type="button" className="meta" onClick={() => navigate("/teacher/assignments")}>
                VIEW ALL →
              </button>
            </div>
            <div className="mingo-panel-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {recentAssignments.length === 0 ? (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))] py-4">No assignments yet.</p>
              ) : (
                recentAssignments.slice(0, 5).map((assignment, index) => (
                  <div className="mingo-activity-row" key={index}>
                    <span className="mingo-a-tag hr">DUE</span>
                    <div className="a-desc">
                      {assignment.title} <span className="who">· {assignment.class?.name}</span>
                    </div>
                    <span className="a-time">
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

        <div className="mingo-panel-head mingo-table-cap" style={{ marginTop: 18 }}>
          <h2>Quick actions</h2>
        </div>
        <div className="mingo-table-wrap" style={{ padding: 4 }}>
          <div className="grid gap-3 p-3 sm:grid-cols-3">
            <button
              type="button"
              className={cn("mingo-btn mingo-btn-ghost")}
              style={{ justifyContent: "flex-start" }}
              onClick={() => navigate("/teacher/attendance")}
            >
              Mark attendance
            </button>
            <button
              type="button"
              className={cn("mingo-btn mingo-btn-ghost")}
              style={{ justifyContent: "flex-start" }}
              onClick={() => navigate("/teacher/assignments")}
            >
              Create assignment
            </button>
            <button
              type="button"
              className={cn("mingo-btn mingo-btn-ghost")}
              style={{ justifyContent: "flex-start" }}
              onClick={() => navigate("/teacher/classes")}
            >
              View classes
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
