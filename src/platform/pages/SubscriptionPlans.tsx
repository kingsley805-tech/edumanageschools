// @ts-nocheck
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Check, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useSubscriptionPlans,
  usePlatformModulesCatalog,
} from "@/platform/hooks/usePlatformDashboard";
import PlanEditorDialog, { planFormToRow, type PlanFormValues } from "@/platform/components/PlanEditorDialog";
import { moduleLabelsForPlan } from "@/platform/lib/packagePermissionSummary";
import type { SubscriptionPlan } from "@/platform/lib/types";

export default function SubscriptionPlansPage() {
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useSubscriptionPlans(true);
  const { data: modules = [], isLoading: modulesLoading } = usePlatformModulesCatalog();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingPlan(null);
    setEditorOpen(true);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setEditorOpen(true);
  };

  const handleSave = async (values: PlanFormValues, planId?: string) => {
    setSaving(true);
    const row = planFormToRow(values);
    try {
      if (planId) {
        const { error } = await supabase.from("subscription_plans").update(row).eq("id", planId);
        if (error) throw error;

        const { data: reapplyData, error: reapplyError } = await supabase.rpc(
          "reapply_subscription_plan_modules",
          { p_plan_id: planId },
        );
        if (reapplyError && !reapplyError.message?.includes("reapply_subscription_plan_modules")) {
          throw reapplyError;
        }
        const reapply = reapplyData as { ok?: boolean; schools_updated?: number; error?: string } | null;
        if (reapply?.ok && (reapply.schools_updated ?? 0) > 0) {
          toast.success(`Plan updated — permissions synced for ${reapply.schools_updated} school(s)`);
        } else {
          toast.success("Plan updated");
        }
      } else {
        const { error } = await supabase.from("subscription_plans").insert({
          ...row,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
        toast.success("Plan created");
      }
      await queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["school-module-entitlements"] });
      setEditorOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
              <Link to="/platform">
                <ArrowLeft className="mr-1 h-4 w-4" /> Platform
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Subscription plans</h1>
            <p className="text-muted-foreground">Configurable packages for tenant organizations</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create plan
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {(plans ?? []).map((plan) => (
              <Card key={plan.id} className={plan.slug === "premium" ? "border-primary shadow-md" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      {!plan.is_active ? (
                        <Badge variant="outline" className="mt-1">
                          Inactive
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {plan.is_custom ? <Badge variant="secondary">Custom</Badge> : null}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(plan)} title="Edit plan">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-2xl font-bold">
                      GHS {Number(plan.price_monthly).toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground"> / month</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      Students: {plan.max_students == null ? "Unlimited" : plan.max_students.toLocaleString()}
                    </li>
                    <li>
                      Teachers: {plan.max_teachers == null ? "Unlimited" : plan.max_teachers.toLocaleString()}
                    </li>
                    <li>
                      Storage: {plan.max_storage_gb == null ? "Unlimited" : `${plan.max_storage_gb} GB`}
                    </li>
                  </ul>
                  <div className="border-t pt-3">
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Included pages</p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                      {(plan.default_modules ?? []).length === 0 ? (
                        <li className="italic text-muted-foreground">No modules configured</li>
                      ) : (
                        (plan.default_modules as string[]).map((moduleKey) => {
                          const label =
                            moduleLabelsForPlan([moduleKey], modules)[0] ?? moduleKey.replace(/_/g, " ");
                          return (
                            <li key={moduleKey} className="flex items-center gap-1">
                              <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                              {label}
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <PlanEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          plan={editingPlan}
          modules={modules}
          saving={saving || modulesLoading}
          onSave={handleSave}
        />
      </div>
    </DashboardLayout>
  );
}
