import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { format } from "date-fns";

interface AuditRow {
  id: string;
  action_type: string;
  entity_type: string;
  module: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
}

const AuditLogs = () => {
  const { schoolId } = usePermissions();
  const [logs, setLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from("audit_logs")
      .select("id, action_type, entity_type, module, created_at, profiles(full_name)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setLogs((data as AuditRow[]) ?? []));
  }, [schoolId]);

  return (
    <PermissionGate permission={PERMISSIONS.admin.viewAudit} showDenied>
      <DashboardLayout role="admin">
        <div className="mingo-content">
          <PortalPageHeader title="Audit logs" description="Recent activity across your school" />
          <div className="mingo-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Entity</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      No audit entries yet
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono-cell">
                        {log.created_at ? format(new Date(log.created_at), "PPp") : "—"}
                      </td>
                      <td>
                        <Badge variant="outline">{log.action_type}</Badge>
                      </td>
                      <td>{log.module ?? "—"}</td>
                      <td>{log.entity_type}</td>
                      <td>{log.profiles?.full_name ?? "System"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AuditLogs;
