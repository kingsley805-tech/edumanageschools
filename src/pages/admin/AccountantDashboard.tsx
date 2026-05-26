import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, AlertCircle, TrendingUp, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";

const AccountantDashboard = () => {
  const { schoolId } = usePermissions();
  const [stats, setStats] = useState({
    outstanding: 0,
    collectedToday: 0,
    pendingInvoices: 0,
    overdueCount: 0,
  });

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("amount, status, due_date, students!inner(school_id)")
        .eq("students.school_id", schoolId);

      const today = new Date().toISOString().slice(0, 10);
      let outstanding = 0;
      let pending = 0;
      let overdue = 0;
      (invoices ?? []).forEach((inv) => {
        if (inv.status !== "paid") {
          outstanding += Number(inv.amount);
          pending++;
          if (inv.due_date && inv.due_date < today) overdue++;
        }
      });

      const { count } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("created_at", `${today}T00:00:00`);

      setStats({
        outstanding,
        collectedToday: 0,
        pendingInvoices: pending,
        overdueCount: overdue,
      });
    })();
  }, [schoolId]);

  return (
    <PermissionGate
      anyOf={[PERMISSIONS.reports.viewFinancial, PERMISSIONS.payments.view]}
      showDenied
    >
      <DashboardLayout role="accountant">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Finance Dashboard</h1>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.outstanding.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending invoices</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.overdueCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Collections</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">Daily summary</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AccountantDashboard;
