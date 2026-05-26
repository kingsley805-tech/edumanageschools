import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        <Card>
          <CardHeader>
            <CardTitle>Audit logs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {log.created_at ? format(new Date(log.created_at), "PPp") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action_type}</Badge>
                    </TableCell>
                    <TableCell>{log.module ?? "—"}</TableCell>
                    <TableCell>{log.entity_type}</TableCell>
                    <TableCell>{log.profiles?.full_name ?? "System"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default AuditLogs;
