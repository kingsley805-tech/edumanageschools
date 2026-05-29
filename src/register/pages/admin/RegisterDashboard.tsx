// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Eye, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { RegisterStatsCards } from "@/register/components/RegisterStatsCards";
import { RegisterAttendanceChart } from "@/register/components/RegisterAttendanceChart";
import { RegisterAlertsPanel } from "@/register/components/RegisterAlertsPanel";
import { RegisterCompletionGrid } from "@/register/components/RegisterCompletionGrid";
import { RegisterStatusBadge } from "@/register/components/RegisterStatusBadge";
import { fetchRegisterDashboardStats, fetchSchoolId, listRegisters } from "@/register/lib/api";
import { buildCompletionGrid, buildRegisterAlerts } from "@/register/lib/stats";
import { RegisterApprovalQueue } from "@/register/pages/admin/RegisterApprovalQueue";
import { RegisterArchive } from "@/register/pages/admin/RegisterArchive";
import { RegisterSettings } from "@/register/pages/admin/RegisterSettings";

export default function RegisterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("School");
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayLabel = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const todayIso = today.toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const sid = await fetchSchoolId(user.id);
      if (!sid) return;
      setSchoolId(sid);
      const { data: school } = await supabase.from("schools").select("name").eq("id", sid).maybeSingle();
      setSchoolName(school?.name ?? "School");
      const [st, regs] = await Promise.all([
        fetchRegisterDashboardStats(sid, todayIso),
        listRegisters({ schoolId: sid, dateFrom: todayIso, dateTo: todayIso, limit: 50 }),
      ]);
      setStats(st);
      setRegisters(regs);
    } finally {
      setLoading(false);
    }
  }, [user, todayIso]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase
      .channel(`registers-${schoolId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_registers" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [schoolId, load]);

  const alerts = useMemo(() => buildRegisterAlerts(registers, stats?.totalClasses ?? 0), [registers, stats]);
  const completion = useMemo(() => buildCompletionGrid(registers), [registers]);
  const recent = useMemo(() => registers.slice(0, 8), [registers]);

  const chartData = useMemo(
    () => ({
      percent: stats?.attendanceTodayPercent ?? 0,
      present: stats?.presentToday ?? 0,
      absent: stats?.absentToday ?? 0,
      late: stats?.lateToday ?? 0,
    }),
    [stats],
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Register Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {schoolName} · Digital class registers & attendance
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button size="sm" onClick={() => navigate("/admin/register/new")}>
              <Plus className="h-4 w-4 mr-1" />
              New register
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="approval">Approval queue</TabsTrigger>
            <TabsTrigger value="archive">Archive</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {loading || !stats ? (
              <p className="text-muted-foreground py-12 text-center">Loading register dashboard…</p>
            ) : (
              <>
                <RegisterStatsCards stats={stats} />

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-xl border border-border bg-card">
                      <div className="p-4 border-b border-border flex items-center justify-between">
                        <h2 className="font-semibold">Recent registers</h2>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/admin/register/archive">View all</Link>
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Class</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recent.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                No registers today. Teachers can create registers from their portal.
                              </TableCell>
                            </TableRow>
                          ) : (
                            recent.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">{r.classes?.name}</TableCell>
                                <TableCell>{r.subjects?.name}</TableCell>
                                <TableCell>{new Date(r.register_date).toLocaleDateString("en-GB")}</TableCell>
                                <TableCell>
                                  <RegisterStatusBadge status={r.status} />
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" asChild>
                                    <Link to={`/admin/register/${r.id}`}>
                                      <Eye className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <RegisterAttendanceChart {...chartData} />
                    <RegisterAlertsPanel alerts={alerts} />
                  </div>
                </div>

                <RegisterCompletionGrid
                  title="Today's class register completion"
                  subtitle={todayLabel}
                  items={completion}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="approval" className="mt-6">
            {schoolId ? <RegisterApprovalQueue schoolId={schoolId} embedded /> : null}
          </TabsContent>

          <TabsContent value="archive" className="mt-6">
            {schoolId ? <RegisterArchive schoolId={schoolId} embedded /> : null}
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            {schoolId ? <RegisterSettings schoolId={schoolId} embedded /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
