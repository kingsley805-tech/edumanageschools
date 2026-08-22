// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PlatformLayout from "@/platform/components/PlatformLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FeaturePermissionMatrix from "@/platform/components/FeaturePermissionMatrix";
import { useTenantEntitlementsEditor } from "@/platform/hooks/useSchoolEntitlements";
import { usePlatformTenants, useSubscriptionPlans } from "@/platform/hooks/usePlatformDashboard";
import { isTenantAwaitingApproval } from "@/platform/lib/tenantSubscription";
import type { ModuleEntitlementRow } from "@/platform/lib/types";
import { useQueryClient } from "@tanstack/react-query";

export default function TenantDetail() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const queryClient = useQueryClient();
  const { data: tenants } = usePlatformTenants();
  const { data: plans } = useSubscriptionPlans(false);
  const tenant = tenants?.find((t) => t.school_id === schoolId);
  const { data: rows, isLoading, save, applyPlan, grantComplimentary, grantAllModules } =
    useTenantEntitlementsEditor(schoolId!);
  const [matrix, setMatrix] = useState<ModuleEntitlementRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [subStatus, setSubStatus] = useState("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [compBillingCycle, setCompBillingCycle] = useState<"monthly" | "annual">("annual");
  const [showAdvancedCrud, setShowAdvancedCrud] = useState(false);

  useEffect(() => {
    if (rows) setMatrix(rows);
  }, [rows]);

  useEffect(() => {
    if (tenant?.plan_name && plans?.length) {
      const match = plans.find((p) => p.name === tenant.plan_name || p.slug === tenant.plan_slug);
      if (match) setSelectedPlan(match.id);
    }
    if (tenant?.subscription_status) setSubStatus(tenant.subscription_status);
    if (tenant?.expires_at) setExpiresAt(String(tenant.expires_at).slice(0, 10));
  }, [tenant?.plan_name, tenant?.plan_slug, tenant?.subscription_status, tenant?.expires_at, plans]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
  };

  const awaiting = tenant ? isTenantAwaitingApproval(tenant) : false;

  const handleSaveMatrix = async () => {
    setSaving(true);
    try {
      await save(matrix);
      toast.success("Modules saved");
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
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply plan");
    } finally {
      setSaving(false);
    }
  };

  const handleGrantComplimentary = async () => {
    if (!selectedPlan) {
      toast.error("Select a plan first");
      return;
    }
    setSaving(true);
    try {
      await grantComplimentary(
        selectedPlan,
        compBillingCycle,
        expiresAt ? new Date(expiresAt).toISOString() : null,
      );
      toast.success("Complimentary access granted");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Grant failed");
    } finally {
      setSaving(false);
    }
  };

  const handleGrantAllModules = async () => {
    setSaving(true);
    try {
      await grantAllModules();
      setMatrix((prev) =>
        prev.map((row) => ({
          ...row,
          enabled: true,
          can_read: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
          can_export: true,
        })),
      );
      toast.success("All modules enabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to grant all modules");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!schoolId) return;
    const { error } = await supabase
      .from("school_subscriptions")
      .upsert(
        { school_id: schoolId, status: "suspended", updated_at: new Date().toISOString() },
        { onConflict: "school_id" },
      );
    if (error) toast.error(error.message);
    else {
      toast.success("Organization suspended");
      refresh();
    }
  };

  const handleReactivate = async () => {
    if (!schoolId) return;
    const { error } = await supabase
      .from("school_subscriptions")
      .upsert(
        { school_id: schoolId, status: "active", updated_at: new Date().toISOString() },
        { onConflict: "school_id" },
      );
    if (error) toast.error(error.message);
    else {
      toast.success("Organization reactivated");
      refresh();
    }
  };

  const handleApprovePending = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("approve_organization_subscription", {
        p_school_id: schoolId,
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Approve failed");
      toast.success("Account approved");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRejectPending = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("reject_organization_subscription", {
        p_school_id: schoolId,
        p_reason: "Rejected by Super Admin",
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Reject failed");
      toast.success("Account rejected and locked");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setSaving(false);
    }
  };

  if (!schoolId) {
    return (
      <PlatformLayout title="Tenant">
        <p className="text-muted-foreground">Invalid tenant</p>
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout
      title={tenant?.school_name ?? "Organization"}
      description={tenant?.school_code}
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/platform/tenants">
            <ArrowLeft className="mr-1 h-4 w-4" /> Tenants
          </Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {awaiting ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Awaiting administrator verification</p>
                  <p className="text-sm text-muted-foreground">
                    Payment was completed. Approve to grant portal access, or reject to keep the account blocked.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button disabled={saving} onClick={() => void handleApprovePending()}>
                    Approve administrator
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive"
                    disabled={saving}
                    onClick={() => void handleRejectPending()}
                  >
                    Reject
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                  <p className="font-medium">{tenant?.primary_admin_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{tenant?.primary_admin_email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment status</p>
                  <p className="font-medium">{tenant?.payment_completed ? "Successful" : "Pending"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account status</p>
                  <p className="font-medium capitalize">
                    {(tenant?.admin_approval_status ?? "pending_verification").replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Plan", tenant?.plan_name ?? "—"],
                ["Status", tenant?.subscription_status ?? "legacy"],
                ["Students", String(tenant?.student_count ?? 0)],
                ["Teachers", String(tenant?.teacher_count ?? 0)],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardDescription>{label}</CardDescription>
                    <CardTitle className="text-xl capitalize">{value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Usage</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="flex justify-between border-b border-border/50 py-2">
                  <span className="text-muted-foreground">Parents</span>
                  <span className="font-medium">{tenant?.parent_count ?? 0}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 py-2">
                  <span className="text-muted-foreground">Users</span>
                  <span className="font-medium">{tenant?.user_count ?? 0}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 py-2">
                  <span className="text-muted-foreground">Expiry</span>
                  <span className="font-medium">
                    {tenant?.expires_at && !awaiting
                      ? new Date(tenant.expires_at).toLocaleDateString()
                      : awaiting
                        ? "Starts after approval"
                        : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/50 py-2">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="capitalize">
                    {tenant?.subscription_status ?? "legacy"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void handleSuspend()}>
                  Suspend
                </Button>
                <Button variant="outline" onClick={() => void handleReactivate()}>
                  Reactivate
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assign plan</CardTitle>
                <CardDescription>
                  Pick a plan, set status / expiry, then apply. Use complimentary for demos.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
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
                      <SelectItem value="pending">Pending approval</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="locked">Locked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Expiry date</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Complimentary cycle</Label>
                  <Select
                    value={compBillingCycle}
                    onValueChange={(v) => setCompBillingCycle(v as "monthly" | "annual")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                      <SelectItem value="annual">Yearly (365 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                  <Button className="flex-1" onClick={() => void handleApplyPlan()} disabled={saving}>
                    Apply plan & modules
                  </Button>
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => void handleGrantComplimentary()}
                    disabled={saving}
                  >
                    Grant complimentary
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">Module access</CardTitle>
                  <CardDescription>
                    Toggle modules for this school. Plan apply sets the baseline.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvancedCrud((v) => !v)}
                  >
                    {showAdvancedCrud ? "Simple on/off" : "Advanced CRUD"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleGrantAllModules()}
                  >
                    Enable all
                  </Button>
                  <Button size="sm" onClick={() => void handleSaveMatrix()} disabled={saving || isLoading}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <FeaturePermissionMatrix
                    rows={matrix}
                    onChange={setMatrix}
                    simple={!showAdvancedCrud}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PlatformLayout>
  );
}
