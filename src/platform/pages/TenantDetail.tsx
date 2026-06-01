// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FeaturePermissionMatrix from "@/platform/components/FeaturePermissionMatrix";
import { useTenantEntitlementsEditor } from "@/platform/hooks/useSchoolEntitlements";
import { usePlatformTenants, useSubscriptionPlans } from "@/platform/hooks/usePlatformDashboard";
import type { ModuleEntitlementRow } from "@/platform/lib/types";

export default function TenantDetail() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { data: tenants } = usePlatformTenants();
  const { data: plans } = useSubscriptionPlans();
  const tenant = tenants?.find((t) => t.school_id === schoolId);
  const { data: rows, isLoading, save, applyPlan } = useTenantEntitlementsEditor(schoolId!);
  const [matrix, setMatrix] = useState<ModuleEntitlementRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [subStatus, setSubStatus] = useState("active");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (rows) setMatrix(rows);
  }, [rows]);

  const handleSaveMatrix = async () => {
    setSaving(true);
    try {
      await save(matrix);
      toast.success("Feature permissions saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!selectedPlan) {
      toast.error("Select a plan first");
      return;
    }
    setSaving(true);
    try {
      await applyPlan(selectedPlan, subStatus, expiresAt || null);
      toast.success("Plan applied — modules updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply plan");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!schoolId) return;
    const { error } = await supabase
      .from("school_subscriptions")
      .upsert({ school_id: schoolId, status: "suspended", updated_at: new Date().toISOString() }, { onConflict: "school_id" });
    if (error) toast.error(error.message);
    else toast.success("Organization suspended");
  };

  const handleReactivate = async () => {
    if (!schoolId) return;
    const { error } = await supabase
      .from("school_subscriptions")
      .upsert({ school_id: schoolId, status: "active", updated_at: new Date().toISOString() }, { onConflict: "school_id" });
    if (error) toast.error(error.message);
    else toast.success("Organization reactivated");
  };

  if (!schoolId) {
    return (
      <DashboardLayout role="super_admin">
        <p className="text-muted-foreground">Invalid tenant</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link to="/platform/tenants">
              <ArrowLeft className="mr-1 h-4 w-4" /> Tenants
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{tenant?.school_name ?? "Organization"}</h1>
          <p className="font-mono text-sm text-muted-foreground">{tenant?.school_code}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscription</CardTitle>
              <CardDescription>Assign or change plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {(plans ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={subStatus} onValueChange={setSubStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expiry date</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => void handleApplyPlan()} disabled={saving}>
                Apply plan & modules
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Students</span>
                <span className="font-medium">{tenant?.student_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Teachers</span>
                <span className="font-medium">{tenant?.teacher_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parents</span>
                <span className="font-medium">{tenant?.parent_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Users</span>
                <span className="font-medium">{tenant?.user_count ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => void handleSuspend()}>
                Suspend organization
              </Button>
              <Button variant="outline" onClick={() => void handleReactivate()}>
                Reactivate
              </Button>
              <Button variant="outline" asChild>
                <Link to="/admin/audit-logs">View audit logs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Feature permission matrix</CardTitle>
              <CardDescription>
                Enable modules and CRUD permissions for this organization only
              </CardDescription>
            </div>
            <Button onClick={() => void handleSaveMatrix()} disabled={saving || isLoading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save permissions
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <FeaturePermissionMatrix rows={matrix} onChange={setMatrix} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
