import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { useNavigate } from "react-router-dom";

const AuditorDashboard = () => {
  const navigate = useNavigate();
  const { schoolId, hasPermission } = usePermissions();
  const [summary, setSummary] = useState({ invoiceCount: 0, paymentCount: 0, auditEntries: 0 });

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { count: invCount } = await supabase
        .from("invoices")
        .select("id, students!inner(school_id)", { count: "exact", head: true })
        .eq("students.school_id", schoolId);
      const { count: payCount } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true });
      const { count: auditCount } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId);
      setSummary({
        invoiceCount: invCount ?? 0,
        paymentCount: payCount ?? 0,
        auditEntries: auditCount ?? 0,
      });
    })();
  }, [schoolId]);

  return (
    <PermissionGate permission={PERMISSIONS.admin.viewAudit} showDenied>
      <DashboardLayout role="auditor">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Auditor Portal</h1>
          <p className="text-muted-foreground">Read-only financial and compliance overview</p>
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Invoices on record</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{summary.invoiceCount}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Payment transactions</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{summary.paymentCount}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Audit log entries</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{summary.auditEntries}</CardContent>
            </Card>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPermission(PERMISSIONS.invoices.view) && (
              <Button variant="outline" onClick={() => navigate("/admin/fees")}>
                <FileText className="h-4 w-4 mr-2" />
                View invoices
              </Button>
            )}
            {hasPermission(PERMISSIONS.admin.viewAudit) && (
              <Button variant="outline" onClick={() => navigate("/admin/audit-logs")}>
                <Eye className="h-4 w-4 mr-2" />
                Audit logs
              </Button>
            )}
            {hasPermission(PERMISSIONS.reports.exportFinancial) && (
              <Button variant="outline" onClick={() => navigate("/admin/reports")}>
                <Download className="h-4 w-4 mr-2" />
                Export reports
              </Button>
            )}
          </div>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AuditorDashboard;
