import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { fetchSchoolAttendanceStats } from "@/lib/attendance-queries";
import { useSchoolCurrency } from "@/hooks/useSchoolCurrency";
import { cn } from "@/lib/utils";
import { MingoLineChart } from "@/components/charts/MingoLineChart";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MingoCategoryBars,
  type MingoCategoryItem,
} from "@/components/charts/MingoCategoryBars";

type FeeRow = {
  receipt: string;
  student: string;
  studentId?: string;
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
        fees: format(totalFees),
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
          studentId: (p as any).student_id || (student as any)?.id,
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

  const statusPill = (status: FeeRow["status"]) => {
    const variant =
      status === "paid"
        ? "success"
        : status === "overdue"
          ? "destructive"
          : "warning";
    return <Badge variant={variant}>{status === "paid" ? "Paid" : status === "overdue" ? "Overdue" : "Pending"}</Badge>;
  };

  const kpis = [
    {
      label: "Total Students",
      value: stats.students,
      delta: "+12.5%",
      up: true,
      icon: "users" as const,
    },
    {
      label: "Active Teachers",
      value: stats.teachers,
      delta: "+3.2%",
      up: true,
      icon: "teacher" as const,
    },
    {
      label: "Fees Collected",
      value: stats.fees,
      delta: "+18.7%",
      up: true,
      icon: "wallet" as const,
    },
    {
      label: "Attendance Rate",
      value: stats.attendance,
      delta: "+2.1%",
      up: true,
      icon: "calendar-8" as const,
    },
  ];

  const [timeRange, setTimeRange] = useState("7 Days");

  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <DashboardLayout role="admin">
      {/* Page head — Metronic page title block from reference */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-medium leading-none text-mono">Dashboard</h1>
            <span className="kt-badge kt-badge-outline kt-badge-primary kt-badge-sm px-2 py-0.5 font-medium">
              Live Portal
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-normal text-secondary-foreground">
            <i className="ki-filled ki-time text-sm text-muted-foreground" />
            <span>{currentDateFormatted} • Africa/Accra</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            className="kt-btn kt-btn-outline gap-2"
            onClick={() => navigate("/admin/reports")}
          >
            <i className="ki-filled ki-chart-simple text-base text-muted-foreground" />
            Daily Summary
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-outline gap-2"
            onClick={() => navigate("/admin/billing/invoices")}
          >
            <i className="ki-filled ki-document text-base text-muted-foreground" />
            New Invoice
          </button>
          <button
            type="button"
            className="kt-btn kt-btn-primary gap-2"
            onClick={() => navigate("/admin/students")}
          >
            <i className="ki-filled ki-plus text-base" />
            Add Student
          </button>
        </div>
      </div>

      {/* KPI row — School Management Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-7.5 mb-6">
        {/* Card 1: Fees Collected */}
        <div className="kt-card channel-stats-bg p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-foreground">
              <i className="ki-filled ki-shop text-xl" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
              ↑ +18.4%
            </span>
          </div>
          <div>
            <div className="text-[1.375rem] font-medium tracking-tight text-foreground leading-none">
              {stats.fees}
            </div>
            <div className="text-sm font-semibold text-foreground mt-1.5">Fees Collected</div>
            <div className="text-xs text-muted-foreground mt-0.5">Term collections to date</div>
          </div>
        </div>

        {/* Card 2: Attendance Rate */}
        <div className="kt-card channel-stats-bg p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-primary">
              <i className="ki-filled ki-chart-line text-xl" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
              {stats.attendance}
            </span>
          </div>
          <div>
            <div className="text-[1.375rem] font-medium tracking-tight text-foreground leading-none">
              {stats.attendance}
            </div>
            <div className="text-sm font-semibold text-foreground mt-1.5">Attendance Rate</div>
            <div className="text-xs text-muted-foreground mt-0.5">Term student presence</div>
          </div>
        </div>

        {/* Card 3: Receivables (A/R) */}
        <div className="kt-card channel-stats-bg p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center justify-center size-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <i className="ki-filled ki-document text-base" />
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border",
                openAlerts > 0
                  ? "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/50 dark:border-rose-800/30"
                  : "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30",
              )}
            >
              {openAlerts > 0 ? (
                <>
                  <i className="ki-filled ki-information-2 text-[10px]" /> {openAlerts} Overdue
                </>
              ) : (
                "Clean"
              )}
            </span>
          </div>
          <div>
            <div className="text-[1.375rem] font-medium tracking-tight text-foreground leading-none">
              {feeAlerts.length > 0 ? feeAlerts[0].val : format(0)}
            </div>
            <div className="text-sm font-semibold text-foreground mt-1.5">Receivables (A/R)</div>
            <div className="text-xs text-muted-foreground mt-0.5">Outstanding student invoices</div>
          </div>
        </div>

        {/* Card 4: Enrolled Students */}
        <div className="kt-card channel-stats-bg p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-foreground">
              <i className="ki-filled ki-user-square text-xl" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
              Active
            </span>
          </div>
          <div>
            <div className="text-[1.375rem] font-medium tracking-tight text-foreground leading-none">
              {stats.students}
            </div>
            <div className="text-sm font-semibold text-foreground mt-1.5">Enrolled Students</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stats.teachers} Teachers assigned</div>
          </div>
        </div>
      </div>

      {/* Middle Section: Performance Chart (Left) + School Hub Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7.5 mb-6">
        {/* Left Card: 8 cols (~67%) */}
        <div className="lg:col-span-8 kt-card flex flex-col justify-between">
          <div className="kt-card-header flex flex-wrap items-center justify-between gap-4 p-5 pb-3 border-b border-border/40">
            <div>
              <h3 className="kt-card-title">Revenue & Fee Performance</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tuition collection and revenue trends over time</p>
            </div>
            {/* Filter pills */}
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
              {["7 Days", "This Month", "6 Months", "Year"].map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setTimeRange(pill)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    timeRange === pill
                      ? "bg-foreground text-background shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
          <div className="kt-card-content p-5 pt-4">
            {/* Blue Spline Area Chart matching Metronic reference */}
            <div className="w-full overflow-hidden">
              <svg
                viewBox="0 0 700 240"
                className="w-full h-[220px]"
                style={{ overflow: "visible" }}
                role="img"
                aria-label="Fee Performance Chart"
              >
                <defs>
                  <linearGradient id="splineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Dotted horizontal grid lines */}
                <line x1="60" y1="20" x2="680" y2="20" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" />
                <line x1="60" y1="65" x2="680" y2="65" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" />
                <line x1="60" y1="110" x2="680" y2="110" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" />
                <line x1="60" y1="155" x2="680" y2="155" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" />
                <line x1="60" y1="200" x2="680" y2="200" stroke="currentColor" strokeOpacity="0.15" />

                {/* Y-axis labels */}
                <text x="50" y="24" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">{currency}4k</text>
                <text x="50" y="69" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">{currency}3k</text>
                <text x="50" y="114" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">{currency}2k</text>
                <text x="50" y="159" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">{currency}1k</text>
                <text x="50" y="204" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">0</text>

                {/* Spline Area Fill */}
                <path
                  d="M 60 200 L 140 200 L 220 200 L 300 200 L 380 200 L 460 200 C 510 200 530 140 570 110 C 610 80 640 40 680 40 L 680 200 Z"
                  fill="url(#splineAreaGrad)"
                />

                {/* Spline Blue Line Curve */}
                <path
                  d="M 60 200 L 140 200 L 220 200 L 300 200 L 380 200 L 460 200 C 510 200 530 140 570 110 C 610 80 640 40 680 40"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data point dots */}
                <circle cx="60" cy="200" r="3.5" fill="#3B82F6" stroke="#fff" strokeWidth="1.5" />
                <circle cx="460" cy="200" r="3.5" fill="#3B82F6" stroke="#fff" strokeWidth="1.5" />
                <circle cx="570" cy="110" r="3.5" fill="#3B82F6" stroke="#fff" strokeWidth="1.5" />
                <circle cx="680" cy="40" r="4.5" fill="#3B82F6" stroke="#fff" strokeWidth="2" />

                {/* X-axis labels */}
                <text x="60" y="222" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">Mon</text>
                <text x="160" y="222" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">Tue</text>
                <text x="260" y="222" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">Wed</text>
                <text x="360" y="222" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">Thu</text>
                <text x="460" y="222" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">Fri</text>
                <text x="570" y="222" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">Sat</text>
                <text x="670" y="222" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">Sun</text>
              </svg>
            </div>
          </div>
        </div>

        {/* Right Card: 4 cols (~33%) */}
        <div className="lg:col-span-4 kt-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="kt-badge kt-badge-outline kt-badge-primary kt-badge-sm px-2 py-0.5 font-medium">
                Academic Station
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {stats.teachers} Staff Configured
              </span>
            </div>
            <h3 className="text-base font-semibold text-mono">Academic Operations Hub</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              Streamline student admissions, fee collections, academic registers, grade reporting, and parent communications in real-time.
            </p>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-muted/40 border border-border/80">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-3">
              <span>Active Portal Session:</span>
              <span className="text-primary font-semibold">Online</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground">Admin Portal</span>
              </div>
              <span className="font-mono text-muted-foreground font-medium">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity + Alerts */}
      <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-stretch mb-5 lg:mb-7.5">
        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Recent activity</h3>
            <button
              type="button"
              className="kt-btn kt-btn-ghost kt-btn-sm text-muted-foreground hover:text-primary"
              onClick={() => navigate("/admin/attendance")}
            >
              View all
              <i className="ki-filled ki-right text-xs" />
            </button>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5">
            {activities.map((a, i) => (
              <div className="mingo-activity-row" key={`${a.label}-${i}`}>
                <span className={`mingo-a-tag ${a.tag}`}>{a.label}</span>
                <div className="a-desc truncate">
                  {a.desc} <span className="who">{a.who}</span>
                </div>
                <span className="a-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="kt-card">
          <div className="kt-card-header">
            <h3 className="kt-card-title">Alerts</h3>
            <Badge variant="warning">{openAlerts} open</Badge>
          </div>
          <div className="kt-card-content p-5 lg:p-7.5">
            {feeAlerts.length > 0 ? (
              <div className="mingo-alert-block fee">
                <h3>
                  <span className="dot" />
                  Fees overdue
                </h3>
                {feeAlerts.map((a) => (
                  <div className="alert-line" key={a.name + a.val}>
                    <div className="min-w-0">
                      <div className="p-name truncate">{a.name}</div>
                      <div className="p-sub truncate">{a.sub}</div>
                    </div>
                    <span className="p-val shrink-0">{a.val}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {attAlerts.length > 0 ? (
              <div className="mingo-alert-block att">
                <h3>
                  <span className="dot" />
                  Attendance concern
                </h3>
                {attAlerts.map((a) => (
                  <div className="alert-line" key={a.name + a.val}>
                    <div className="min-w-0">
                      <div className="p-name truncate">{a.name}</div>
                      <div className="p-sub truncate">{a.sub}</div>
                    </div>
                    <span className="p-val shrink-0">{a.val}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {openAlerts === 0 ? (
              <p className="text-sm text-secondary-foreground">No open alerts right now.</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Recent fee payments */}
      <div className="kt-card">
        <div className="kt-card-header">
          <h3 className="kt-card-title">Recent fee payments</h3>
          <button
            type="button"
            className="kt-btn kt-btn-ghost kt-btn-sm text-muted-foreground hover:text-primary"
            onClick={() => navigate("/admin/billing/payments")}
          >
            View all
            <i className="ki-filled ki-right text-xs" />
          </button>
        </div>
        <div className="kt-card-content p-0 overflow-x-auto">
          <Table className="kt-table min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                <TableRow key={row.receipt + row.student}>
                  <TableCell className="font-mono text-2sm">{row.receipt}</TableCell>
                  <TableCell className="text-sm font-medium text-mono">
                    {row.studentId ? (
                      <Link
                        to={`/admin/students/${row.studentId}`}
                        className="text-foreground hover:text-primary hover:underline"
                      >
                        {row.student}
                      </Link>
                    ) : (
                      row.student
                    )}
                  </TableCell>
                  <TableCell className="text-2sm text-secondary-foreground">{row.className}</TableCell>
                  <TableCell className="text-sm font-medium text-mono">{row.amount}</TableCell>
                  <TableCell>{statusPill(row.status)}</TableCell>
                  <TableCell className="font-mono text-2sm text-secondary-foreground">{row.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
