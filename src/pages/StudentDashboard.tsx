import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useStudentData } from "@/hooks/useStudentData";
import { supabase } from "@/integrations/supabase/client";
import { fetchStudentAttendanceRate } from "@/lib/attendance-queries";
import { StudentPortalSections } from "@/components/student/StudentPortalSections";
import { useCurrentTerm } from "@/report/hooks/use-school-data";
import {
  useAttendanceSummary,
  useClassAttendanceSummary,
  useMonthlyAttendanceTrend,
} from "@/register/hooks/use-attendance-summary";
import { AttendanceAnalyticsPanel } from "@/register/components/AttendanceAnalyticsPanel";
import { ClassSubjectTeachersPanel } from "@/components/class-subjects/ClassSubjectTeachersPanel";
import { MingoLineChart, type MingoLinePoint } from "@/components/charts/MingoLineChart";
import { MingoCategoryBars, type MingoCategoryItem } from "@/components/charts/MingoCategoryBars";

type ScheduleRow = {
  subject?: { name?: string } | null;
  room?: string;
  start_time?: string;
  end_time?: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  due_date: string;
  subject?: { name?: string } | null;
};

type GradeRow = {
  id: string;
  score: number | string;
  subject?: { name?: string } | null;
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { studentId, classId, loading } = useStudentData();
  const { data: term } = useCurrentTerm();
  const { data: attendanceSummary, isLoading: attendanceLoading } = useAttendanceSummary(
    studentId,
    term?.id,
  );
  const { data: classSummary } = useClassAttendanceSummary(classId, term?.id);
  const { data: monthlyTrend } = useMonthlyAttendanceTrend(studentId, term?.id);
  const [stats, setStats] = useState({
    classes: "0",
    assignments: "0",
    attendance: "0%",
    average: "-",
  });
  const [todaySchedule, setTodaySchedule] = useState<ScheduleRow[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<AssignmentRow[]>([]);
  const [recentGrades, setRecentGrades] = useState<GradeRow[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<{ id: string; title: string; exam_date: string }[]>([]);
  const [announcements, setAnnouncements] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (studentId && classId) {
      fetchDashboardData();
    }
  }, [studentId, classId]);

  const fetchDashboardData = async () => {
    if (!studentId || !classId) return;

    const today = new Date().getDay();

    const [schedulesRes, assignmentsRes, attendanceStats, gradesRes, classCount] = await Promise.all([
      supabase
        .from("schedules")
        .select("*, subject:subjects(name), teacher:teachers(user_id)")
        .eq("class_id", classId)
        .eq("day_of_week", today),
      supabase
        .from("assignments")
        .select("*, subject:subjects(name)")
        .eq("class_id", classId)
        .order("due_date", { ascending: true })
        .limit(3),
      fetchStudentAttendanceRate(studentId),
      supabase
        .from("grades")
        .select("*, subject:subjects(name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("status", "active"),
    ]);

    const attendanceRate = attendanceStats.rate.toString();

    const avgGrade =
      gradesRes.data && gradesRes.data.length > 0
        ? (
            gradesRes.data.reduce((sum, g) => sum + (Number(g.score) || 0), 0) / gradesRes.data.length
          ).toFixed(0)
        : "-";

    setStats({
      classes: (classCount.count || 1).toString(),
      assignments: assignmentsRes.data?.length.toString() || "0",
      attendance: `${attendanceRate}%`,
      average: avgGrade,
    });

    setTodaySchedule(schedulesRes.data || []);
    setPendingAssignments(assignmentsRes.data || []);
    setRecentGrades(gradesRes.data || []);

    const todayIso = new Date().toISOString().slice(0, 10);
    const [{ data: examsData }, { data: noticeData }] = await Promise.all([
      supabase
        .from("exams")
        .select("id, title, exam_date")
        .eq("class_id", classId)
        .gte("exam_date", todayIso)
        .order("exam_date", { ascending: true })
        .limit(5),
      supabase
        .from("announcements")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    setUpcomingExams(examsData || []);
    setAnnouncements(noticeData || []);
  };

  const trendPoints: MingoLinePoint[] = (monthlyTrend ?? []).map((row) => ({
    label: row.month,
    primary: row.present,
    secondary: row.absent,
  }));

  const gradeItems: MingoCategoryItem[] = (() => {
    const rows = recentGrades
      .filter((g) => g.subject?.name)
      .slice(0, 7)
      .map((g) => ({ name: g.subject!.name as string, score: Number(g.score) || 0 }));
    if (!rows.length) return [];
    const max = Math.max(...rows.map((r) => r.score), 1);
    return rows.map((r) => ({
      name: r.name,
      value: `${r.score}%`,
      percent: Math.max(8, Math.round((r.score / max) * 82)),
    }));
  })();

  return (
    <DashboardLayout role="student">
      {/* Page head — Metronic page title block */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            View your timetable, assignments, grades, fees, and exams.
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="kt-btn kt-btn-outline"
            onClick={() => navigate("/student/grades")}
          >
            <i className="ki-filled ki-medal-star text-base" />
            View grades
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-primary"
            onClick={() => navigate("/student/online-exams")}
          >
            <i className="ki-filled ki-plus text-base" />
            Take exam
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-7.5 mb-5 lg:mb-7.5">
        {[
          { label: "My Classes", value: stats.classes, icon: "book-open" },
          { label: "Assignments", value: stats.assignments, icon: "document" },
          { label: "Attendance", value: stats.attendance, icon: "calendar-8" },
          { label: "Grade Average", value: stats.average, icon: "medal-star" },
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
            <h3 className="kt-card-title">Monthly attendance trend</h3>
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
              <p className="text-sm text-secondary-foreground">No attendance history yet.</p>
            )}
          </div>
        </div>

        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Recent grades by subject</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5">
            {gradeItems.length ? (
              <MingoCategoryBars items={gradeItems} bordered={false} />
            ) : (
              <p className="text-sm text-secondary-foreground">No grades yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-5 lg:mb-7.5">
        <StudentPortalSections />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Upcoming examinations</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-1">
            {upcomingExams.length === 0 ? (
              <p className="text-sm text-secondary-foreground py-2">No upcoming exams.</p>
            ) : (
              upcomingExams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between gap-3 py-2 border-b border-b-border last:border-b-0"
                >
                  <span className="text-sm truncate">{exam.title}</span>
                  <span className="text-2sm text-muted-foreground shrink-0">
                    {new Date(exam.exam_date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">School notices</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-1">
            {announcements.length === 0 ? (
              <p className="text-sm text-secondary-foreground py-2">No announcements.</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="py-2 border-b border-b-border last:border-b-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mb-5 lg:mb-7.5">
        <ClassSubjectTeachersPanel
          classId={classId}
          title="My subjects & teachers"
          description="Teachers assigned to your class"
        />
      </div>

      <div className="kt-card mb-5 lg:mb-7.5">
        <div className="kt-card-header">
          <h3 className="kt-card-title">Attendance analytics</h3>
        </div>
        <div className="kt-card-content p-5 lg:p-7.5">
          <AttendanceAnalyticsPanel
            summary={attendanceSummary}
            classSummary={classSummary}
            monthlyTrend={monthlyTrend}
            loading={loading || attendanceLoading}
          />
        </div>
      </div>

      {/* Schedule + assignments */}
      <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Today&apos;s schedule</h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-1">
            {todaySchedule.length === 0 ? (
              <p className="text-sm text-secondary-foreground py-4">No classes today.</p>
            ) : (
              todaySchedule.map((cls, index) => (
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
                      <span className="text-secondary-foreground">· Room {cls.room}</span>
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
            <h3 className="kt-card-title">Pending assignments</h3>
            <button
              type="button"
              className="kt-btn kt-btn-ghost kt-btn-sm text-muted-foreground hover:text-primary"
              onClick={() => navigate("/student/assignments")}
            >
              View all
              <i className="ki-filled ki-right text-xs" />
            </button>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-1">
            {pendingAssignments.length === 0 ? (
              <p className="text-sm text-secondary-foreground py-4">No pending assignments.</p>
            ) : (
              pendingAssignments.map((assignment, index) => (
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
                        · {assignment.subject?.name}
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

      {/* Recent grades */}
      <div className="kt-card">
        <div className="kt-card-header">
          <h3 className="kt-card-title">Recent grades</h3>
          <button
            type="button"
            className="kt-btn kt-btn-ghost kt-btn-sm text-muted-foreground hover:text-primary"
            onClick={() => navigate("/student/grades")}
          >
            View all
            <i className="ki-filled ki-right text-xs" />
          </button>
        </div>
        <div className="kt-card-content p-0 overflow-x-auto">
          <table className="kt-table min-w-full">
            <thead>
              <tr>
                <th>Subject</th>
                <th className="text-end">Score</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {recentGrades.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-sm text-secondary-foreground py-6">
                    No grades yet
                  </td>
                </tr>
              ) : (
                recentGrades.map((grade) => {
                  const score = Number(grade.score) || 0;
                  const letter =
                    score >= 90
                      ? "A"
                      : score >= 80
                        ? "B"
                        : score >= 70
                          ? "C"
                          : score >= 60
                            ? "D"
                            : "F";
                  return (
                    <tr key={grade.id}>
                      <td className="text-sm font-medium text-mono">{grade.subject?.name}</td>
                      <td className="text-end text-sm text-foreground">
                        {typeof grade.score === "number" ? `${grade.score}%` : grade.score}
                      </td>
                      <td>
                        <span
                          className={
                            score >= 80
                              ? "kt-badge kt-badge-sm kt-badge-success kt-badge-outline"
                              : score >= 60
                                ? "kt-badge kt-badge-sm kt-badge-warning kt-badge-outline"
                                : "kt-badge kt-badge-sm kt-badge-danger kt-badge-outline"
                          }
                        >
                          {letter}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
