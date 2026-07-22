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
      <div className="mingo-content">
        <div className="mingo-page-head">
          <div>
            <h1>Student portal</h1>
            <p>View your timetable, assignments, grades, fees, and exams.</p>
          </div>
          <div className="mingo-head-actions">
            <button type="button" className="mingo-btn mingo-btn-ghost" onClick={() => navigate("/student/grades")}>
              View grades
            </button>
            <button
              type="button"
              className="mingo-btn mingo-btn-primary"
              onClick={() => navigate("/student/online-exams")}
            >
              + Take exam
            </button>
          </div>
        </div>

        <div className="mingo-kpi-row">
          <div className="mingo-kpi">
            <div className="label">My Classes</div>
            <div className="val mono">{stats.classes}</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Assignments</div>
            <div className="val mono">{stats.assignments}</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Attendance</div>
            <div className="val mono">{stats.attendance}</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Grade Average</div>
            <div className="val mono">{stats.average}</div>
          </div>
        </div>

        <div className="mingo-charts-row">
          <div className="mingo-panel mingo-charts-line">
            <div className="mingo-panel-head">
              <h2>Monthly attendance trend</h2>
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
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No attendance history yet.</p>
              )}
            </div>
          </div>

          <div className="mingo-panel mingo-charts-cat">
            <div className="mingo-panel-head">
              <h2>Recent grades by subject</h2>
            </div>
            <div className="mingo-panel-body">
              {gradeItems.length ? (
                <MingoCategoryBars items={gradeItems} bordered={false} />
              ) : (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No grades yet.</p>
              )}
            </div>
          </div>
        </div>

        <StudentPortalSections />

        <ClassSubjectTeachersPanel
          classId={classId}
          title="My subjects & teachers"
          description="Teachers assigned to your class"
        />

        <div style={{ marginTop: 18 }}>
          <div className="mingo-panel-head mingo-table-cap">
            <h2>Attendance analytics</h2>
          </div>
          <div className="mingo-table-wrap" style={{ padding: 18 }}>
            <AttendanceAnalyticsPanel
              summary={attendanceSummary}
              classSummary={classSummary}
              monthlyTrend={monthlyTrend}
              loading={loading || attendanceLoading}
            />
          </div>
        </div>

        <div className="mingo-grid-2b" style={{ marginTop: 18 }}>
          <div className="mingo-panel">
            <div className="mingo-panel-head">
              <h2>Today's schedule</h2>
            </div>
            <div className="mingo-panel-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {todaySchedule.length === 0 ? (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))] py-4">No classes today.</p>
              ) : (
                todaySchedule.map((cls, index) => (
                  <div className="mingo-activity-row" key={index}>
                    <span className="mingo-a-tag exm">CLS</span>
                    <div className="a-desc">
                      {cls.subject?.name} <span className="who">· Room {cls.room}</span>
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
              <h2>Pending assignments</h2>
              <button type="button" className="meta" onClick={() => navigate("/student/assignments")}>
                VIEW ALL →
              </button>
            </div>
            <div className="mingo-panel-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {pendingAssignments.length === 0 ? (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))] py-4">No pending assignments.</p>
              ) : (
                pendingAssignments.map((assignment, index) => (
                  <div className="mingo-activity-row" key={index}>
                    <span className="mingo-a-tag fee">DUE</span>
                    <div className="a-desc">
                      {assignment.title} <span className="who">· {assignment.subject?.name}</span>
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
          <h2>Recent grades</h2>
          <button type="button" className="meta" onClick={() => navigate("/student/grades")}>
            VIEW ALL →
          </button>
        </div>
        <div className="mingo-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th className="num">Score</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {recentGrades.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center" }}>
                    No grades yet
                  </td>
                </tr>
              ) : (
                recentGrades.map((grade) => {
                  const score = Number(grade.score) || 0;
                  const letter = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
                  return (
                    <tr key={grade.id}>
                      <td>{grade.subject?.name}</td>
                      <td className="num">{typeof grade.score === "number" ? `${grade.score}%` : grade.score}</td>
                      <td>
                        <span className={cnGradePill(score)}>{letter}</span>
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

function cnGradePill(score: number) {
  const pill = "mingo-status-pill";
  if (score >= 80) return `${pill} paid`;
  if (score >= 60) return `${pill} pending`;
  return `${pill} overdue`;
}

export default StudentDashboard;
