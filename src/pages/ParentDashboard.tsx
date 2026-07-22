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
      <div className="mingo-content">
        <div className="mingo-page-head">
          <div>
            <h1>Parent dashboard</h1>
            <p>Track your children's attendance, grades, fees, and school updates.</p>
          </div>
          <div className="mingo-head-actions">
            <button type="button" className="mingo-btn mingo-btn-ghost" onClick={() => navigate("/parent/grades")}>
              View report card
            </button>
            <button
              type="button"
              className="mingo-btn mingo-btn-primary"
              onClick={() => navigate("/parent/payments")}
            >
              + Pay fees
            </button>
          </div>
        </div>

        <div className="mingo-kpi-row">
          <div className="mingo-kpi">
            <div className="label">Children Linked</div>
            <div className="val mono">{children.length}</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Avg Attendance</div>
            <div className="val mono">{avgAttendance}%</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Avg Grade Score</div>
            <div className="val mono">{avgScoreAll || "-"}</div>
          </div>
          <div className="mingo-kpi warn">
            <div className="label">Next Fee Due</div>
            <div className="val mono">{nextFeeChild?.nextFee ?? "N/A"}</div>
          </div>
        </div>

        {children.length === 0 ? (
          <div className="mingo-panel" style={{ marginBottom: 18 }}>
            <div className="mingo-panel-body" style={{ textAlign: "center", padding: 32 }}>
              <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No children linked yet.</p>
              {signupAdmissionNumbers.length > 0 && (
                <p className="text-[12.5px] mt-2">
                  Admission number from signup:{" "}
                  <span className="mono font-semibold">{signupAdmissionNumbers.join(", ")}</span>
                </p>
              )}
              <button
                type="button"
                className="mingo-btn mingo-btn-ghost"
                style={{ margin: "12px auto 0" }}
                onClick={() => navigate("/parent/children")}
              >
                Link a child
              </button>
            </div>
          </div>
        ) : (
          <div className="mingo-charts-row">
            <div className="mingo-panel mingo-charts-line">
              <div className="mingo-panel-head">
                <h2>Monthly attendance — {studentDisplayNameForParent(primaryChild)}</h2>
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
                <h2>{childAttendanceItems.length ? "Attendance by child" : "Recent grades by subject"}</h2>
              </div>
              <div className="mingo-panel-body">
                {(childAttendanceItems.length ? childAttendanceItems : gradeItems).length ? (
                  <MingoCategoryBars
                    items={childAttendanceItems.length ? childAttendanceItems : gradeItems}
                    bordered={false}
                  />
                ) : (
                  <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">No data yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {children.length > 0 && (
          <>
            <div className="mingo-panel-head mingo-table-cap">
              <h2>My children</h2>
            </div>
            <div className="mingo-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th className="num">Attendance</th>
                    <th>Avg Grade</th>
                    <th>Next Fee</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((child, index) => (
                    <tr key={index}>
                      <td>{studentDisplayNameForParent(child)}</td>
                      <td>{child.class?.name || "—"}</td>
                      <td className="num">{child.attendance}%</td>
                      <td>
                        <span className="mingo-status-pill paid">{child.avgGrade}</span>
                      </td>
                      <td className="mono-cell">{child.nextFee}</td>
                      <td className="mono-cell">{child.feeDue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {primaryChild ? (
          <div style={{ marginTop: 18 }}>
            <div className="mingo-panel-head mingo-table-cap">
              <h2>Attendance analytics — {studentDisplayNameForParent(primaryChild)}</h2>
            </div>
            <div className="mingo-table-wrap" style={{ padding: 18 }}>
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
            <ClassSubjectTeachersPanel
              key={child.id}
              classId={child.class_id}
              title={`Subjects & teachers — ${studentDisplayNameForParent(child)}`}
              description="Teachers assigned to your child's class"
            />
          ) : null,
        )}

        <div className="mingo-grid-2b" style={{ marginTop: 18 }}>
          <div className="mingo-panel">
            <div className="mingo-panel-head">
              <h2>Academic performance</h2>
              <button type="button" className="meta" onClick={() => navigate("/parent/grades")}>
                VIEW ALL →
              </button>
            </div>
            <div className="mingo-panel-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {recentGrades.length === 0 ? (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))] py-4">No grades available yet.</p>
              ) : (
                recentGrades.map((grade, index) => (
                  <div className="mingo-activity-row" key={index}>
                    <span className="mingo-a-tag exm">GRD</span>
                    <div className="a-desc">
                      {grade.subject?.name} <span className="who">· Score {grade.score}%</span>
                    </div>
                    <span className="a-time">
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

        <div className="mingo-panel-head mingo-table-cap" style={{ marginTop: 18 }}>
          <h2>Quick actions</h2>
        </div>
        <div className="mingo-table-wrap" style={{ padding: 4 }}>
          <div className="grid gap-3 p-3 sm:grid-cols-3">
            <button
              type="button"
              className="mingo-btn mingo-btn-primary"
              style={{ justifyContent: "flex-start" }}
              onClick={() => navigate("/parent/payments")}
            >
              Pay fees
            </button>
            <button
              type="button"
              className="mingo-btn mingo-btn-ghost"
              style={{ justifyContent: "flex-start" }}
              onClick={() => navigate("/parent/grades")}
            >
              View report card
            </button>
            <button
              type="button"
              className="mingo-btn mingo-btn-ghost"
              style={{ justifyContent: "flex-start" }}
              onClick={() => navigate("/parent/attendance")}
            >
              Check attendance
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ParentDashboard;
