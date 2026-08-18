import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Wallet,
  CalendarCheck,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Printer,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { fetchSchoolAttendanceStats, fetchSchoolAttendanceTrend } from "@/lib/attendance-queries";
import { formatMoney } from "@/lib/currency";
import { exportGenericTableToExcel, exportGenericTableToPDF } from "@/lib/exportUtils";
import { exportTable } from "@/modules/lib/exportTable";
import { getDesktopAPI, isElectronDesktop, unwrapIpc } from "@/desktop/electronBridge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type RangeKey = "7" | "30" | "90";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

type PaymentRow = {
  id: string;
  created_at: string;
  amount: number;
  status: string;
  studentName: string;
  className: string;
  invoiceNo: string;
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function rangeBounds(days: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  return { start, prevStart, end: now };
}

function TrendPill({ delta, suffix = "%", invert = false }: { delta: number | null; suffix?: string; invert?: boolean }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> New
      </span>
    );
  }
  const rounded = Math.round(delta * 10) / 10;
  const isFlat = Math.abs(rounded) < 0.05;
  const isUp = rounded > 0;
  const good = isFlat ? null : invert ? !isUp : isUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
        isFlat
          ? "bg-muted text-muted-foreground"
          : good
            ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
            : "bg-[hsl(var(--critical-bg))] text-[hsl(var(--critical))]",
      )}
    >
      {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isFlat ? "No change" : `${isUp ? "+" : ""}${rounded}${suffix}`}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaSuffix,
  invert,
  helper,
  index,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  delta?: number | null;
  deltaSuffix?: string;
  invert?: boolean;
  helper?: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="h-full"
    >
      <div className="kt-card channel-stats-bg h-full">
        <div className="kt-card-content p-5 lg:p-6 flex flex-col justify-between gap-4 h-full">
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-sm font-normal text-secondary-foreground">{label}</span>
            <span className="flex items-center justify-center size-10 shrink-0 rounded-lg bg-accent/60 border border-border">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-2xl lg:text-3xl font-semibold text-mono">{value}</span>
            <div className="flex items-center gap-2 flex-wrap">
              {delta !== undefined && <TrendPill delta={delta} suffix={deltaSuffix} invert={invert} />}
              {helper && <span className="text-xs text-muted-foreground">{helper}</span>}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const Reports = () => {
  const { currentSchool } = useSchoolInfo();
  const { toast } = useToast();
  const currency = currentSchool?.currency;

  const [range, setRange] = useState<RangeKey>("30");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "excel" | "word" | "csv" | "print" | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [stats, setStats] = useState({
    totalStudents: 0,
    newStudents: 0,
    prevNewStudents: 0,
    totalRevenue: 0,
    revenueThisRange: 0,
    prevRevenueRange: 0,
    averageAttendance: 0,
    prevAverageAttendance: 0,
    activeClasses: 0,
  });
  const [attendanceTrendData, setAttendanceTrendData] = useState<
    { date: string; present: number; absent: number; previousPresent: number }[]
  >([]);
  const [gradeData, setGradeData] = useState<{ range: string; count: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ name: string; value: number }[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentRow[]>([]);
  const [currentRangeRatePct, setCurrentRangeRatePct] = useState(0);

  const days = Number(range);
  const COLORS = ["hsl(var(--success))", "hsl(var(--critical))"];

  const fetchClasses = useCallback(async (schoolId: string) => {
    const { data } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name");
    if (data) setClasses(data);
  }, []);

  const fetchAnalytics = useCallback(
    async (schoolId: string) => {
      setLoading(true);
      try {
        const { start, prevStart } = rangeBounds(days);
        const startIso = start.toISOString();
        const prevStartIso = prevStart.toISOString();

        const classFilter = selectedClass !== "all" ? selectedClass : undefined;

        const [
          { count: studentCount },
          { count: newStudentsCount },
          { count: prevNewStudentsCount },
          { count: classCount },
          attendanceStats,
          currentTrend,
          previousTrend,
          gradesRes,
          invoicesRes,
          paymentsCurrentRes,
          paymentsPrevRes,
          recentPaymentsRes,
        ] = await Promise.all([
          supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
          supabase
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .gte("created_at", startIso),
          supabase
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .gte("created_at", prevStartIso)
            .lt("created_at", startIso),
          supabase.from("classes").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
          fetchSchoolAttendanceStats(schoolId),
          fetchSchoolAttendanceTrend(schoolId, days, 0),
          fetchSchoolAttendanceTrend(schoolId, days, days),
          supabase.from("grades").select("score, students!inner(school_id, class_id)").eq("students.school_id", schoolId),
          supabase
            .from("invoices")
            .select("status, amount, created_at, students!inner(school_id, class_id)")
            .eq("students.school_id", schoolId)
            .gte("created_at", startIso),
          supabase
            .from("payments")
            .select("amount, invoices!inner(students!inner(school_id))")
            .eq("status", "completed")
            .eq("invoices.students.school_id", schoolId)
            .gte("created_at", startIso),
          supabase
            .from("payments")
            .select("amount, invoices!inner(students!inner(school_id))")
            .eq("status", "completed")
            .eq("invoices.students.school_id", schoolId)
            .gte("created_at", prevStartIso)
            .lt("created_at", startIso),
          supabase
            .from("payments")
            .select(
              "id, created_at, amount, status, invoices!inner(invoice_no, students!inner(school_id, class_id, admission_no, profiles:profile_id(full_name)))",
            )
            .eq("invoices.students.school_id", schoolId)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        // --- Attendance rate (overall + trend-period comparison) ---
        const currentRateNum = currentTrend.reduce((a, r) => a + r.present, 0);
        const currentRateDen = currentTrend.reduce((a, r) => a + r.present + r.absent, 0);
        const previousRateNum = previousTrend.reduce((a, r) => a + r.present, 0);
        const previousRateDen = previousTrend.reduce((a, r) => a + r.present + r.absent, 0);
        const currentRangeRate = currentRateDen ? (currentRateNum / currentRateDen) * 100 : 0;
        const previousRangeRate = previousRateDen ? (previousRateNum / previousRateDen) * 100 : 0;

        setAttendanceTrendData(
          currentTrend.map((row, i) => ({
            date: row.date,
            present: row.present,
            absent: row.absent,
            previousPresent: previousTrend[i]?.present ?? 0,
          })),
        );

        // --- Grade distribution (school + class scoped) ---
        const gradeRanges = [
          { range: "90-100", count: 0 },
          { range: "80-89", count: 0 },
          { range: "70-79", count: 0 },
          { range: "60-69", count: 0 },
          { range: "Below 60", count: 0 },
        ];
        (gradesRes.data ?? [])
          .filter((g: any) => !classFilter || g.students?.class_id === classFilter)
          .forEach((g: any) => {
            const score = Number(g.score);
            if (score >= 90) gradeRanges[0].count++;
            else if (score >= 80) gradeRanges[1].count++;
            else if (score >= 70) gradeRanges[2].count++;
            else if (score >= 60) gradeRanges[3].count++;
            else gradeRanges[4].count++;
          });
        setGradeData(gradeRanges);

        // --- Revenue breakdown (paid vs unpaid, scoped + class filter) ---
        const invoiceRows = (invoicesRes.data ?? []).filter(
          (i: any) => !classFilter || i.students?.class_id === classFilter,
        );
        const paid = invoiceRows.filter((i: any) => i.status === "paid").reduce((a: number, i: any) => a + Number(i.amount), 0);
        const unpaid = invoiceRows
          .filter((i: any) => i.status === "unpaid")
          .reduce((a: number, i: any) => a + Number(i.amount), 0);
        setRevenueData(
          (paymentStatus === "all" || paymentStatus === "paid" ? [{ name: "Paid", value: paid }] : []).concat(
            paymentStatus === "all" || paymentStatus === "unpaid" ? [{ name: "Unpaid", value: unpaid }] : [],
          ),
        );

        // --- Revenue totals & trend ---
        const revenueThisRange = (paymentsCurrentRes.data ?? []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
        const prevRevenueRange = (paymentsPrevRes.data ?? []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
        const totalRevenueAllTime = paid + unpaid; // within-range total shown; see "helper" copy on the card

        // --- Recent payments table ---
        const rows: PaymentRow[] = (recentPaymentsRes.data ?? [])
          .filter((p: any) => !classFilter || p.invoices?.students?.class_id === classFilter)
          .filter((p: any) => paymentStatus === "all" || p.status === paymentStatus)
          .map((p: any) => ({
            id: p.id,
            created_at: p.created_at,
            amount: Number(p.amount || 0),
            status: p.status,
            invoiceNo: p.invoices?.invoice_no || "-",
            studentName:
              (Array.isArray(p.invoices?.students?.profiles)
                ? p.invoices?.students?.profiles[0]?.full_name
                : p.invoices?.students?.profiles?.full_name) ||
              p.invoices?.students?.admission_no ||
              "-",
            className: "-",
          }));
        setRecentPayments(rows.slice(0, 20));

        setStats({
          totalStudents: studentCount || 0,
          newStudents: newStudentsCount || 0,
          prevNewStudents: prevNewStudentsCount || 0,
          totalRevenue: totalRevenueAllTime,
          revenueThisRange,
          prevRevenueRange,
          averageAttendance: Math.round(attendanceStats.rate),
          activeClasses: classCount || 0,
          prevAverageAttendance: Math.round(previousRangeRate),
        });
        // stash the finer-grained current range rate for the trend pill
        setCurrentRangeRatePct(currentRangeRate);
        setLastUpdated(new Date());
      } catch (err: any) {
        toast({ title: "Could not load reports", description: err?.message || "Unknown error" });
      } finally {
        setLoading(false);
      }
    },
    [days, selectedClass, paymentStatus, toast],
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profileData } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
      if (!profileData?.school_id) return;
      await fetchClasses(profileData.school_id);
      await fetchAnalytics(profileData.school_id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, selectedClass, paymentStatus]);

  const handleRefresh = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profileData } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
    if (profileData?.school_id) await fetchAnalytics(profileData.school_id);
  };

  const activeExport = useMemo(() => {
    const summary = [
      { label: "Total Students", value: String(stats.totalStudents) },
      { label: "Revenue (range)", value: formatMoney(stats.revenueThisRange, currency) },
      { label: "Avg Attendance", value: `${stats.averageAttendance}%` },
      { label: "Active Classes", value: String(stats.activeClasses) },
    ];

    if (activeTab === "attendance") {
      return {
        title: "Attendance Report",
        subtitle: `${currentSchool?.school_name ?? "School"} · ${RANGE_OPTIONS.find((r) => r.value === range)?.label}`,
        summary,
        headers: ["Date", "Present", "Absent", "Previous Period"],
        rows: attendanceTrendData.map((r) => [r.date, r.present, r.absent, r.previousPresent]),
      };
    }
    if (activeTab === "finance") {
      return {
        title: "Finance Report",
        subtitle: `${currentSchool?.school_name ?? "School"} · ${RANGE_OPTIONS.find((r) => r.value === range)?.label}`,
        summary,
        headers: ["Date", "Student", "Invoice #", "Amount", "Status"],
        rows: recentPayments.map((p) => [
          new Date(p.created_at).toLocaleDateString(),
          p.studentName,
          p.invoiceNo,
          formatMoney(p.amount, currency),
          p.status,
        ]),
      };
    }
    if (activeTab === "academics") {
      return {
        title: "Academic Performance Report",
        subtitle: `${currentSchool?.school_name ?? "School"} · ${RANGE_OPTIONS.find((r) => r.value === range)?.label}`,
        summary,
        headers: ["Score Range", "Students"],
        rows: gradeData.map((g) => [g.range, g.count]),
      };
    }
    return {
      title: "Reports & Analytics — Overview",
      subtitle: `${currentSchool?.school_name ?? "School"} · ${RANGE_OPTIONS.find((r) => r.value === range)?.label}`,
      summary,
      headers: ["Metric", "Value"],
      rows: summary.map((s) => [s.label, s.value]),
    };
  }, [activeTab, stats, currency, range, currentSchool, attendanceTrendData, recentPayments, gradeData]);

  const handleExportExcel = () => {
    setExporting("excel");
    try {
      exportGenericTableToExcel(activeExport);
      toast({ title: "Excel export ready", description: `${activeExport.title}.xlsx downloaded` });
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = () => {
    setExporting("csv");
    try {
      exportTable({
        filename: activeExport.title.toLowerCase().replace(/\s+/g, "-"),
        title: activeExport.title,
        headers: activeExport.headers,
        rows: activeExport.rows,
        format: "csv",
      });
      toast({ title: "CSV export ready", description: `${activeExport.title}.csv downloaded` });
    } finally {
      setExporting(null);
    }
  };

  const handleExportWord = () => {
    setExporting("word");
    try {
      exportTable({
        filename: activeExport.title.toLowerCase().replace(/\s+/g, "-"),
        title: activeExport.title,
        headers: activeExport.headers,
        rows: activeExport.rows,
        format: "word",
      });
      toast({ title: "Word export ready", description: `${activeExport.title}.doc downloaded` });
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      if (isElectronDesktop()) {
        const api = getDesktopAPI()!;
        const result = await unwrapIpc(
          api.printer.report(
            "custom",
            {
              schoolName: currentSchool?.school_name,
              title: activeExport.title,
              subtitle: activeExport.subtitle,
              headers: activeExport.headers,
              rows: activeExport.rows.map((r) => ({ cells: r })),
            },
            { toPdf: true },
          ),
        );
        toast({ title: "PDF exported", description: (result as { path?: string })?.path || "Saved to exports folder" });
      } else {
        await exportGenericTableToPDF(activeExport);
        toast({ title: "PDF export ready", description: `${activeExport.title}.pdf downloaded` });
      }
    } catch (err: any) {
      toast({ title: "PDF export failed", description: err?.message || "Unknown error" });
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = async () => {
    setExporting("print");
    try {
      if (isElectronDesktop()) {
        const api = getDesktopAPI()!;
        await unwrapIpc(
          api.printer.report(
            "custom",
            {
              schoolName: currentSchool?.school_name,
              title: activeExport.title,
              subtitle: activeExport.subtitle,
              headers: activeExport.headers,
              rows: activeExport.rows.map((r) => ({ cells: r })),
            },
            { preview: true },
          ),
        );
      } else {
        window.print();
      }
    } catch (err: any) {
      toast({ title: "Print failed", description: err?.message || "Unknown error" });
    } finally {
      setExporting(null);
    }
  };

  const revenueTrendPct = pctChange(stats.revenueThisRange, stats.prevRevenueRange);
  const studentsTrendPct = pctChange(stats.newStudents, stats.prevNewStudents);
  const attendanceTrendPts = currentRangeRatePct - stats.prevAverageAttendance;

  return (
    <DashboardLayout role="admin">
      {/* Page Header — Metronic toolbar */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5 print:hidden">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Reports &amp; Analytics</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Comprehensive insights into school performance
            {lastUpdated && <span className="text-muted-foreground/70"> · Updated {lastUpdated.toLocaleTimeString()}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="kt-btn kt-btn-outline h-9 w-9 p-0"
            onClick={handleRefresh}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="kt-btn kt-btn-primary h-9 gap-1.5 px-3">
                <i className="ki-filled ki-file-down text-base" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF} disabled={exporting === "pdf"}>
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportWord} disabled={exporting === "word"}>
                Word doc
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} disabled={exporting === "excel"}>
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv} disabled={exporting === "csv"}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} disabled={exporting === "print"}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            index={0}
            label="Total Students"
            value={stats.totalStudents.toLocaleString()}
            icon={Users}
            delta={studentsTrendPct}
            deltaSuffix="%"
            helper="new admissions vs prior period"
          />
          <KpiCard
            index={1}
            label={`Revenue (${RANGE_OPTIONS.find((r) => r.value === range)?.label.toLowerCase()})`}
            value={formatMoney(stats.revenueThisRange, currency)}
            icon={Wallet}
            delta={revenueTrendPct}
            deltaSuffix="%"
            helper="vs prior period"
          />
          <KpiCard
            index={2}
            label="Avg Attendance"
            value={`${stats.averageAttendance}%`}
            icon={CalendarCheck}
            delta={attendanceTrendPts}
            deltaSuffix=" pts"
            helper="vs prior period"
          />
          <KpiCard index={3} label="Active Classes" value={stats.activeClasses.toLocaleString()} icon={GraduationCap} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
            <TabsTrigger value="academics">Academics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Attendance Trend" subtitle="Present vs. previous period">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={attendanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="present" name="Present" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive />
                    <Line
                      type="monotone"
                      dataKey="previousPresent"
                      name="Previous period"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Revenue Breakdown" subtitle="Paid vs. unpaid invoices">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={revenueData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${formatMoney(Number(value), currency)}`}
                      isAnimationActive
                    >
                      {revenueData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMoney(v, currency)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <ChartCard title="Attendance Trend" subtitle="Daily present / absent counts">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={attendanceTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="present" name="Present" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} isAnimationActive />
                  <Bar dataKey="absent" name="Absent" fill="hsl(var(--critical))" radius={[4, 4, 0, 0]} isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            <ChartCard title="Recent Payments" subtitle="Latest transactions for this school">
              <div className="overflow-hidden rounded-none border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No transactions in this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-[12.5px]">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-[12.5px] font-medium">{p.studentName}</TableCell>
                          <TableCell className="text-[12.5px] font-mono">{p.invoiceNo}</TableCell>
                          <TableCell className="text-right text-[12.5px] font-medium">{formatMoney(p.amount, currency)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={p.status === "completed" ? "default" : "secondary"}
                              className={cn(
                                "rounded-none",
                                p.status === "completed" && "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
                              )}
                            >
                              {p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </ChartCard>
          </TabsContent>

          <TabsContent value="academics" className="space-y-4">
            <ChartCard title="Grade Distribution" subtitle="Student performance overview">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={gradeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>
        </Tabs>
      </DashboardLayout>
    );
  };

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="kt-card">
        <div className="kt-card-header pb-2">
          <h3 className="kt-card-title text-base">{title}</h3>
          {subtitle && <p className="text-xs text-secondary-foreground">{subtitle}</p>}
        </div>
        <div className="kt-card-content p-5">{children}</div>
      </div>
    </motion.div>
  );
}

export default Reports;
