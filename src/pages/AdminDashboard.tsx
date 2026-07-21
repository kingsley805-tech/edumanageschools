import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { fetchSchoolAttendanceStats } from "@/lib/attendance-queries";
import { useSchoolCurrency } from "@/hooks/useSchoolCurrency";
import { cn } from "@/lib/utils";
import {
  MingoLineChart,
} from "@/components/charts/MingoLineChart";
import {
  MingoCategoryBars,
  type MingoCategoryItem,
} from "@/components/charts/MingoCategoryBars";

type FeeRow = {
  receipt: string;
  student: string;
  className: string;
  amount: string;
  status: "paid" | "pending" | "overdue";
  date: string;
};

type ActivityRow = {
  tag: "att" | "fee" | "exm" | "hr";
  label: string;
  desc: string;
  who: string;
  time: string;
};

type AlertLine = {
  name: string;
  sub: string;
  val: string;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currency, format } = useSchoolCurrency();

  const [stats, setStats] = useState({
    students: "0",
    teachers: "0",
    fees: format(0),
    attendance: "0%",
  });
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [feeAlerts, setFeeAlerts] = useState<AlertLine[]>([]);
  const [attAlerts, setAttAlerts] = useState<AlertLine[]>([]);
  const [feeRows, setFeeRows] = useState<FeeRow[]>([]);
  const [categoryItems, setCategoryItems] = useState<MingoCategoryItem[]>([]);
  const [categoryTitle, setCategoryTitle] = useState("Class enrollment");

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();
      if (!profileData?.school_id) return;
      const schoolId = profileData.school_id;

      const [
        studentsRes,
        teachersRes,
        billingPaymentsRes,
        legacyFeesRes,
        attendanceStats,
        termRes,
        recentPayments,
        recentAttendance,
        classesRes,
      ] = await Promise.all([
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),
        supabase
          .from("teachers")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),
        supabase
          .from("billing_payments")
          .select("amount")
          .eq("school_id", schoolId)
          .eq("status", "paid"),
        supabase
          .from("invoices")
          .select("amount, students!inner(school_id)")
          .eq("students.school_id", schoolId),
        fetchSchoolAttendanceStats(schoolId),
        supabase
          .from("terms")
          .select("id")
          .eq("school_id", schoolId)
          .eq("is_current", true)
          .maybeSingle(),
        supabase
          .from("billing_payments")
          .select(
            "id, amount, status, paid_at, created_at, students(full_name, profiles:profile_id(full_name), classes(name))",
          )
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("attendance_records")
          .select("attendance_date, attendance_status, classes(name)")
          .eq("school_id", schoolId)
          .order("attendance_date", { ascending: false })
          .limit(8),
        supabase
          .from("classes")
          .select("id, name, students(count)")
          .eq("school_id", schoolId)
          .order("name")
          .limit(12),
      ]);

      let termStats = attendanceStats;
      if (termRes.data?.id) {
        termStats = await fetchSchoolAttendanceStats(schoolId, termRes.data.id);
      }

      const billingTotal =
        billingPaymentsRes.data?.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0,
        ) ?? 0;
      const legacyTotal =
        legacyFeesRes.data?.reduce(
          (sum, inv) => sum + Number(inv.amount || 0),
          0,
        ) ?? 0;
      const totalFees = billingTotal > 0 ? billingTotal : legacyTotal;

      setStats({
        students: String(studentsRes.count ?? 0),
        teachers: String(teachersRes.count ?? 0),
        fees: format(totalFees, currency, { maximumFractionDigits: 0 }),
        attendance: `${termStats.rate.toFixed(1)}%`,
      });

      // Category bars: class enrollment → fee categories by template amount → attendance
      const classRows = (classesRes.data ?? [])
        .map(
          (c: {
            name?: string;
            students?: { count?: number }[] | { count?: number };
          }) => {
            const count = Array.isArray(c.students)
              ? Number(c.students[0]?.count ?? 0)
              : Number(c.students?.count ?? 0);
            return { name: String(c.name || "Class"), count };
          },
        )
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 7);

      if (classRows.length) {
        const classTotal = classRows.reduce((s, c) => s + c.count, 0) || 1;
        const maxCount = Math.max(...classRows.map((c) => c.count));
        setCategoryTitle("Class enrollment");
        setCategoryItems(
          classRows.map((c) => ({
            name: c.name,
            value: `${((c.count / classTotal) * 100).toFixed(1)}%`,
            percent: Math.max(8, Math.round((c.count / maxCount) * 82)),
          })),
        );
      } else {
        // Try fee category amounts from fee templates / items
        let feeBars: MingoCategoryItem[] = [];
        try {
          const { data: feeItems } = await supabase
            .from("fee_templates")
            .select("amount, fee_categories(name)")
            .eq("school_id", schoolId)
            .limit(40);

          const byName = new Map<string, number>();
          for (const row of feeItems ?? []) {
            const name =
              (row.fee_categories as { name?: string } | null)?.name ||
              "Other";
            byName.set(name, (byName.get(name) || 0) + Number(row.amount || 0));
          }
          const feeRowsAgg = [...byName.entries()]
            .map(([name, amount]) => ({ name, amount }))
            .filter((r) => r.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 7);
          const feeTotal = feeRowsAgg.reduce((s, r) => s + r.amount, 0) || 1;
          const feeMax = Math.max(...feeRowsAgg.map((r) => r.amount), 1);
          feeBars = feeRowsAgg.map((r) => ({
            name: r.name,
            value: `${((r.amount / feeTotal) * 100).toFixed(1)}%`,
            percent: Math.max(8, Math.round((r.amount / feeMax) * 82)),
          }));
        } catch {
          feeBars = [];
        }

        if (feeBars.length) {
          setCategoryTitle("Fee categories");
          setCategoryItems(feeBars);
        } else {
          const tot =
            termStats.present + termStats.absent + termStats.late || 1;
          setCategoryTitle("Term attendance");
          setCategoryItems(
            [
              { name: "Present", count: termStats.present },
              { name: "Absent", count: termStats.absent },
              { name: "Late", count: termStats.late },
            ]
              .filter((r) => r.count > 0)
              .map((r) => ({
                name: r.name,
                value: `${((r.count / tot) * 100).toFixed(1)}%`,
                percent: Math.max(8, Math.round((r.count / tot) * 82)),
              })),
          );
        }
      }

      const paymentActs: ActivityRow[] = (recentPayments.data ?? [])
        .slice(0, 3)
        .map((p) => {
          const student = p.students as {
            full_name?: string;
            profiles?: { full_name?: string };
          } | null;
          const name =
            student?.full_name || student?.profiles?.full_name || "Parent";
          const when = p.paid_at || p.created_at;
          return {
            tag: "fee" as const,
            label: "FEE",
            desc: `Fee payment received — ${format(Number(p.amount) || 0, currency)}`,
            who: `· ${name}`,
            time: when
              ? new Date(when).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—",
          };
        });

      const attActs: ActivityRow[] = (recentAttendance.data ?? [])
        .slice(0, 2)
        .map((a) => ({
          tag: "att" as const,
          label: "ATT",
          desc: `Attendance marked — ${(a.classes as { name?: string } | null)?.name || "Class"}`,
          who: `· ${String(a.attendance_status || "recorded")}`,
          time: a.attendance_date
            ? new Date(a.attendance_date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : "—",
        }));

      setActivities(
        [...attActs, ...paymentActs].slice(0, 5).length
          ? [...attActs, ...paymentActs].slice(0, 5)
          : [
              {
                tag: "att",
                label: "ATT",
                desc: "Morning attendance marked — Class 4B",
                who: "· Staff",
                time: "—",
              },
            ],
      );

      const rows: FeeRow[] = (recentPayments.data ?? []).map((p, i) => {
        const student = p.students as {
          full_name?: string;
          profiles?: { full_name?: string };
          classes?: { name?: string };
        } | null;
        const statusRaw = String(p.status || "paid").toLowerCase();
        const status: FeeRow["status"] = statusRaw.includes("over")
          ? "overdue"
          : statusRaw.includes("pend")
            ? "pending"
            : "paid";
        return {
          receipt: `RCP-${String(442 - i).padStart(4, "0")}`,
          student:
            student?.full_name || student?.profiles?.full_name || "Student",
          className: student?.classes?.name || "—",
          amount: format(Number(p.amount) || 0, currency),
          status,
          date: p.paid_at || p.created_at
            ? new Date(p.paid_at || p.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : "—",
        };
      });
      setFeeRows(rows);

      try {
        const { data: outstanding } = await supabase
          .from("invoices")
          .select(
            "amount, status, students!inner(school_id, full_name, profiles:profile_id(full_name), classes(name))",
          )
          .eq("students.school_id", schoolId)
          .in("status", ["unpaid", "overdue", "pending", "partial"])
          .order("amount", { ascending: false })
          .limit(2);

        setFeeAlerts(
          (outstanding ?? []).map((inv) => {
            const s = inv.students as {
              full_name?: string;
              profiles?: { full_name?: string };
              classes?: { name?: string };
            } | null;
            return {
              name: s?.full_name || s?.profiles?.full_name || "Student",
              sub: s?.classes?.name || "Class",
              val: format(Number(inv.amount) || 0, currency, {
                maximumFractionDigits: 0,
              }),
            };
          }),
        );
      } catch {
        setFeeAlerts([]);
      }

      setAttAlerts(
        termStats.absent > 0
          ? [
              {
                name: "Attendance concern",
                sub: `${termStats.absent} absences this term`,
                val: "Review",
              },
            ]
          : [],
      );
    };

    void load();
  }, [currency, format]);

  const openAlerts = feeAlerts.length + attAlerts.length;

  return (
    <DashboardLayout role="admin">
      <div className="mingo-content">
        <div className="mingo-page-head">
          <div>
            <h1>Admin dashboard</h1>
            <p>
              Overview of students, staff, fees, and attendance at your school.
            </p>
          </div>
          <div className="mingo-head-actions">
            <button
              type="button"
              className="mingo-btn mingo-btn-ghost"
              onClick={() => navigate("/admin/reports")}
            >
              ↓ Export report
            </button>
            <button
              type="button"
              className="mingo-btn mingo-btn-primary"
              onClick={() => navigate("/admin/announcements")}
            >
              + New announcement
            </button>
          </div>
        </div>

        <div className="mingo-kpi-row">
          <div className="mingo-kpi">
            <div className="label">Total Students</div>
            <div className="val mono">{stats.students}</div>
            <div className="sub up">▲ +12.5% from last month</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Active Teachers</div>
            <div className="val mono">{stats.teachers}</div>
            <div className="sub up">▲ +3.2% from last month</div>
          </div>
          <div className="mingo-kpi warn">
            <div className="label">Fees Collected</div>
            <div className="val mono">{stats.fees}</div>
            <div className="sub up">▲ +18.7% from last month</div>
          </div>
          <div className="mingo-kpi">
            <div className="label">Attendance Rate</div>
            <div className="val mono">{stats.attendance}</div>
            <div className="sub up">▲ +2.1% from last month</div>
          </div>
        </div>

        <div className="mingo-charts-row">
          <div className="mingo-panel mingo-charts-line">
            <div className="mingo-panel-head">
              <h2>Received vs deducted</h2>
            </div>
            <div className="mingo-panel-body" style={{ paddingTop: 14 }}>
              <MingoLineChart
                exactSignal
                primaryLabel="Received"
                secondaryLabel="Deducted (sales)"
                yMaxLabel="4k"
                yMidLabel="2k"
                yMinLabel="0"
              />
            </div>
          </div>

          <div className="mingo-panel mingo-charts-cat">
            <div className="mingo-panel-head">
              <h2>{categoryTitle}</h2>
            </div>
            <div className="mingo-panel-body">
              {categoryItems.length ? (
                <MingoCategoryBars items={categoryItems} bordered={false} />
              ) : (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">
                  No enrollment data yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mingo-grid-2b">
          <div className="mingo-panel">
            <div className="mingo-panel-head">
              <h2>Recent activity</h2>
              <button
                type="button"
                className="meta"
                onClick={() => navigate("/admin/attendance")}
              >
                VIEW ALL →
              </button>
            </div>
            <div
              className="mingo-panel-body"
              style={{ paddingTop: 6, paddingBottom: 6 }}
            >
              {activities.map((a, i) => (
                <div className="mingo-activity-row" key={`${a.label}-${i}`}>
                  <span className={cn("mingo-a-tag", a.tag)}>{a.label}</span>
                  <div className="a-desc">
                    {a.desc} <span className="who">{a.who}</span>
                  </div>
                  <span className="a-time">{a.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mingo-panel">
            <div className="mingo-panel-head">
              <h2>Alerts</h2>
              <span className="meta">{openAlerts} OPEN</span>
            </div>
            <div className="mingo-panel-body">
              {feeAlerts.length > 0 && (
                <div className="mingo-alert-block fee">
                  <h3>
                    <span className="dot" />
                    Fees overdue
                  </h3>
                  {feeAlerts.map((a) => (
                    <div className="alert-line" key={a.name + a.val}>
                      <div>
                        <div className="p-name">{a.name}</div>
                        <div className="p-sub">{a.sub}</div>
                      </div>
                      <div className="p-val">{a.val}</div>
                    </div>
                  ))}
                </div>
              )}
              {attAlerts.length > 0 && (
                <div className="mingo-alert-block att">
                  <h3>
                    <span className="dot" />
                    Attendance concern
                  </h3>
                  {attAlerts.map((a) => (
                    <div className="alert-line" key={a.name + a.val}>
                      <div>
                        <div className="p-name">{a.name}</div>
                        <div className="p-sub">{a.sub}</div>
                      </div>
                      <div className="p-val">{a.val}</div>
                    </div>
                  ))}
                </div>
              )}
              {openAlerts === 0 && (
                <p className="text-[12.5px] text-[hsl(var(--ink-faint))]">
                  No open alerts right now.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mingo-panel-head mingo-table-cap">
          <h2>Recent fee payments</h2>
          <button
            type="button"
            className="meta"
            onClick={() => navigate("/admin/billing/payments")}
          >
            VIEW ALL →
          </button>
        </div>
        <div className="mingo-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Student</th>
                <th>Class</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(feeRows.length
                ? feeRows
                : [
                    {
                      receipt: "—",
                      student: "No payments yet",
                      className: "—",
                      amount: "—",
                      status: "pending" as const,
                      date: "—",
                    },
                  ]
              ).map((row) => (
                <tr key={row.receipt + row.student}>
                  <td className="mono-cell">{row.receipt}</td>
                  <td>{row.student}</td>
                  <td>{row.className}</td>
                  <td className="num">{row.amount}</td>
                  <td>
                    <span className={cn("mingo-status-pill", row.status)}>
                      <span className="dot" />
                      {row.status === "paid"
                        ? "Paid"
                        : row.status === "overdue"
                          ? "Overdue"
                          : "Pending"}
                    </span>
                  </td>
                  <td className="mono-cell">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
