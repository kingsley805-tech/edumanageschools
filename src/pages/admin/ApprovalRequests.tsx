import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/auditLog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface RequestRow {
  id: string;
  request_type: string;
  module: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
  profiles: { full_name: string } | null;
}

const ApprovalRequests = () => {
  const { schoolId, hasPermission } = usePermissions();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    if (!schoolId) return;
    const { data: raw } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (!raw?.length) {
      setRequests([]);
      return;
    }
    const userIds = [...new Set(raw.map((r) => r.requested_by))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    setRequests(
      raw.map((r) => ({
        ...r,
        profiles: { full_name: nameMap.get(r.requested_by) ?? "Unknown" },
      })) as RequestRow[]
    );
  };

  useEffect(() => {
    load();
  }, [schoolId]);

  const review = async (id: string, approved: boolean) => {
    if (!hasPermission(PERMISSIONS.admin.approveRequests)) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: approved ? "approved" : "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes[id] ?? null,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    if (schoolId) {
      await writeAuditLog({
        schoolId,
        actionType: approved ? "approval_granted" : "approval_rejected",
        entityType: "approval_request",
        entityId: id,
        module: "approvals",
      });
    }
    toast({ title: approved ? "Approved" : "Rejected" });
    load();
  };

  return (
    <PermissionGate
      anyOf={[PERMISSIONS.admin.approveRequests, PERMISSIONS.admin.viewAudit]}
      showDenied
    >
      <DashboardLayout role="admin">
        <Card>
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.filter((r) => r.status === "pending").length === 0 && (
              <p className="text-muted-foreground">No pending requests.</p>
            )}
            {requests
              .filter((r) => r.status === "pending")
              .map((req) => (
                <div key={req.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge>{req.request_type}</Badge>
                      <span className="ml-2 text-sm text-muted-foreground">{req.module}</span>
                      <p className="text-sm mt-1">
                        Requested by {req.profiles?.full_name} ·{" "}
                        {format(new Date(req.created_at), "PPp")}
                      </p>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Review notes (optional)"
                    value={notes[req.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                  />
                  {hasPermission(PERMISSIONS.admin.approveRequests) && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(req.id, true)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => review(req.id, false)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      </DashboardLayout>
    </PermissionGate>
  );
};

export default ApprovalRequests;

export async function submitApprovalRequest(
  schoolId: string,
  requestType: string,
  module: string,
  recordId: string | null,
  payload: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("approval_requests")
    .insert({
      school_id: schoolId,
      request_type: requestType,
      module,
      record_id: recordId,
      payload,
      requested_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
