// @ts-nocheck
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchParentRecordByUserId,
  fetchStudentsForParent,
  getParentSignupAdmissionNumbers,
  studentDisplayNameForParent,
} from "@/lib/parent-students";
import { fetchStudentAttendanceRate } from "@/lib/attendance-queries";
import { linkParentToStudents } from "@/lib/auth-api";
import { EventsCalendar } from "@/components/EventsCalendar";
import { useCurrentTerm } from "@/report/hooks/use-school-data";
import {
  useAttendanceSummary,
  useClassAttendanceSummary,
  useMonthlyAttendanceTrend,
} from "@/register/hooks/use-attendance-summary";
import { AttendanceAnalyticsPanel } from "@/register/components/AttendanceAnalyticsPanel";
import { ClassSubjectTeachersPanel } from "@/components/class-subjects/ClassSubjectTeachersPanel";
import { MingoLineChart } from "@/components/charts/MingoLineChart";
import { MingoCategoryBars } from "@/components/charts/MingoCategoryBars";

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: term } = useCurrentTerm();
  const [children, setChildren] = useState([]);
  const [recentGrades, setRecentGrades] = useState([]);
  const [signupAdmissionNumbers, setSignupAdmissionNumbers] = useState([]);

  const primaryChild = children[0];
  const { data: attendanceSummary, isLoading: attendanceLoading } = useAttendanceSummary(
    primaryChild?.id,
    term?.id,
  );
  const { data: classSummary } = useClassAttendanceSummary(primaryChild?.class_id, term?.id);
  const { data: monthlyTrend } = useMonthlyAttendanceTrend(primaryChild?.id, term?.id);

  useEffect(() => {
    if (user) {
      fetchChildrenData();
    }
  }, [user]);

  const fetchChildrenData = async () => {
    if (!user) return;

    const parent = await fetchParentRecordByUserId(user.id);
    if (!parent) return;

    const signupNums = getParentSignupAdmissionNumbers(user, parent);
    setSignupAdmissionNumbers(signupNums);

    let studentsData = await fetchStudentsForParent(
      parent.id,
      "id, full_name, admission_no, admission_number, class_id, class:classes(name), profiles:user_id(full_name)"
    );

    if (studentsData.length === 0 && signupNums.length > 0) {
      await linkParentToStudents(parent.id, parent.school_id, signupNums);
      studentsData = await fetchStudentsForParent(
        parent.id,
        "id, full_name, admission_no, admission_number, class_id, class:classes(name), profiles:user_id(full_name)"
      );
    }

    if (studentsData.length > 0) {
      const childrenWithStats = await Promise.all(
        studentsData.map(async (student) => {
          const [attendanceStats, gradesRes, invoiceRes] = await Promise.all([
            fetchStudentAttendanceRate(student.id),
            supabase.from("grades").select("score").eq("student_id", student.id),
            supabase.from("invoices").select("amount, due_date, status").eq("student_id", student.id).eq("status", "unpaid").order("due_date").limit(1)
          ]);

          const attendance = attendanceStats.rate;

          const avgScore = gradesRes.data && gradesRes.data.length > 0
            ? gradesRes.data.reduce((sum, g) => sum + (Number(g.score) || 0), 0) / gradesRes.data.length
            : 0;

          const avgGrade = avgScore >= 90 ? "A" : avgScore >= 80 ? "B" : avgScore >= 70 ? "C" : avgScore >= 60 ? "D" : "F";

          return {
            ...student,
            attendance: Number(attendance),
            avgScore: Math.round(avgScore),
            avgGrade,
            nextFee: invoiceRes.data?.[0]?.amount ? `$${invoiceRes.data[0].amount}` : "N/A",
            feeDue: invoiceRes.data?.[0]?.due_date
              ? new Date(invoiceRes.data[0].due_date).toLocaleDateString()
              : "N/A"
          };
        })
      );

      setChildren(childrenWithStats);

      if (studentsData[0]) {
        const { data: gradesData } = await supabase
          .from("grades")
          .select("*, subject:subjects(name)")
          .eq("student_id", studentsData[0].id)
          .order("created_at", { ascending: false })
          .limit(6);

        setRecentGrades(gradesData || []);
      }
    }
  };

  const trendPoints = (monthlyTrend ?? []).map((row) => ({
    label: row.month,
    primary: row.present,
    secondary: row.absent,
  }));

  const childAttendanceItems = (() => {
    if (children.length < 2) return [];
    const rows = children.map((c) => ({ name: studentDisplayNameForParent(c), value: c.attendance }));
    const max = Math.max(...rows.map((r) => r.value), 1);
    return rows.map((r) => ({
      name: r.name,
      value: `${r.value}%`,
      percent: Math.max(8, Math.round((r.value / max) * 82)),
    }));
  })();

  const gradeItems = (() => {
    const rows = recentGrades
      .filter((g) => g.subject?.name)
      .slice(0, 7)
      .map((g) => ({ name: g.subject.name, score: Number(g.score) || 0 }));
    if (!rows.length) return [];
    const max = Math.max(...rows.map((r) => r.score), 1);
    return rows.map((r) => ({
      name: r.name,
      value: `${r.score}%`,
      percent: Math.max(8, Math.round((r.score / max) * 82)),
    }));
  })();

  const avgAttendance = children.length
    ? Math.round(children.reduce((s, c) => s + c.attendance, 0) / children.length)
    : 0;
  const avgScoreAll = children.length
    ? Math.round(children.reduce((s, c) => s + (c.avgScore || 0), 0) / children.length)
    : 0;
  const nextFeeChild = children.find((c) => c.nextFee && c.nextFee !== "N/A");

  return (
    <DashboardLayout role="parent">
      {/* Page head — Metronic page title block */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Track your children&apos;s attendance, grades, fees, and school updates.
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="kt-btn kt-btn-outline"
            onClick={() => navigate("/parent/grades")}
          >
            <i className="ki-filled ki-document text-base" />
            View report card
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-primary"
            onClick={() => navigate("/parent/payments")}
          >
            <i className="ki-filled ki-plus text-base" />
            Pay fees
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-7.5 mb-5 lg:mb-7.5">
        {[
          { label: "Children Linked", value: String(children.length), icon: "users" },
          { label: "Avg Attendance", value: `${avgAttendance}%`, icon: "calendar-8" },
          { label: "Avg Grade Score", value: String(avgScoreAll || "-"), icon: "medal-star" },
          { label: "Next Fee Due", value: nextFeeChild?.nextFee ?? "N/A", icon: "wallet" },
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

      {children.length === 0 ? (
        <div className="kt-card mb-5 lg:mb-7.5">
          <div className="kt-card-content p-8 flex flex-col items-center gap-3 text-center">
            <span className="flex items-center justify-center size-12 rounded-full bg-accent/60 border border-border">
              <i className="ki-filled ki-users text-xl text-muted-foreground" />
            </span>
            <p className="text-sm text-secondary-foreground">No children linked yet.</p>
            {signupAdmissionNumbers.length > 0 && (
              <p className="text-2sm text-secondary-foreground">
                Admission number from signup:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {signupAdmissionNumbers.join(", ")}
                </span>
              </p>
            )}
            <button
              type="button"
              className="kt-btn kt-btn-outline"
              onClick={() => navigate("/parent/children")}
            >
              Link a child
            </button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
          <div className="kt-card lg:col-span-2">
            <div className="kt-card-header">
              <h3 className="kt-card-title">
                Monthly attendance — {studentDisplayNameForParent(primaryChild)}
              </h3>
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
              <h3 className="kt-card-title">
                {childAttendanceItems.length ? "Attendance by child" : "Recent grades by subject"}
              </h3>
            </div>
            <div className="kt-card-content p-5 lg:p-7.5">
              {(childAttendanceItems.length ? childAttendanceItems : gradeItems).length ? (
                <MingoCategoryBars
                  items={childAttendanceItems.length ? childAttendanceItems : gradeItems}
                  bordered={false}
                />
              ) : (
                <p className="text-sm text-secondary-foreground">No data yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {children.length > 0 ? (
        <div className="kt-card mb-5 lg:mb-7.5">
          <div className="kt-card-header">
            <h3 className="kt-card-title">My children</h3>
          </div>
          <div className="kt-card-content p-0 overflow-x-auto">
            <table className="kt-table min-w-full">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th className="text-end">Attendance</th>
                  <th>Avg Grade</th>
                  <th>Next Fee</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {children.map((child, index) => (
                  <tr key={index}>
                    <td className="text-sm font-medium text-mono">
                      {studentDisplayNameForParent(child)}
                    </td>
                    <td className="text-2sm text-secondary-foreground">
                      {child.class?.name || "—"}
                    </td>
                    <td className="text-end text-sm text-foreground">{child.attendance}%</td>
                    <td>
                      <span className="kt-badge kt-badge-sm kt-badge-success kt-badge-outline">
                        {child.avgGrade}
                      </span>
                    </td>
                    <td className="font-mono text-2sm">{child.nextFee}</td>
                    <td className="font-mono text-2sm text-secondary-foreground">
                      {child.feeDue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {primaryChild ? (
        <div className="kt-card mb-5 lg:mb-7.5">
          <div className="kt-card-header">
            <h3 className="kt-card-title">
              Attendance analytics — {studentDisplayNameForParent(primaryChild)}
            </h3>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5">
            <AttendanceAnalyticsPanel
              summary={attendanceSummary}
              classSummary={classSummary}
              monthlyTrend={monthlyTrend}
              loading={attendanceLoading}
              compact
            />
          </div>
        </div>
      ) : null}

      {children.map((child) =>
        child.class_id ? (
          <div className="mb-5 lg:mb-7.5" key={child.id}>
            <ClassSubjectTeachersPanel
              classId={child.class_id}
              title={`Subjects & teachers — ${studentDisplayNameForParent(child)}`}
              description="Teachers assigned to your child's class"
            />
          </div>
        ) : null,
      )}

      <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Academic performance</h3>
            <button
              type="button"
              className="kt-btn kt-btn-ghost kt-btn-sm text-muted-foreground hover:text-primary"
              onClick={() => navigate("/parent/grades")}
            >
              View all
              <i className="ki-filled ki-right text-xs" />
            </button>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5 flex flex-col gap-1">
            {recentGrades.length === 0 ? (
              <p className="text-sm text-secondary-foreground py-4">No grades available yet.</p>
            ) : (
              recentGrades.map((grade, index) => (
                <div
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-b-border last:border-b-0"
                  key={index}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="kt-badge kt-badge-sm kt-badge-info kt-badge-outline shrink-0">
                      GRD
                    </span>
                    <span className="text-sm font-normal text-foreground truncate">
                      {grade.subject?.name}{" "}
                      <span className="text-secondary-foreground">· Score {grade.score}%</span>
                    </span>
                  </div>
                  <span className="shrink-0 text-2sm font-semibold text-mono">
                    {Number(grade.score) >= 90
                      ? "A"
                      : Number(grade.score) >= 80
                        ? "B"
                        : Number(grade.score) >= 70
                          ? "C"
                          : "D"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <EventsCalendar />
      </div>

      {/* Quick actions */}
      <div className="kt-card">
        <div className="kt-card-header">
          <h3 className="kt-card-title">Quick actions</h3>
        </div>
        <div className="kt-card-content p-5 lg:p-7.5 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="kt-btn kt-btn-primary justify-start"
            onClick={() => navigate("/parent/payments")}
          >
            <i className="ki-filled ki-wallet text-base" />
            Pay fees
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-outline justify-start"
            onClick={() => navigate("/parent/grades")}
          >
            <i className="ki-filled ki-document text-base" />
            View report card
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-outline justify-start"
            onClick={() => navigate("/parent/attendance")}
          >
            <i className="ki-filled ki-calendar-8 text-base" />
            Check attendance
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ParentDashboard;
