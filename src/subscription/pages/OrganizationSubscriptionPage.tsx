// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import OrganizationSubscriptionModal from "@/subscription/components/OrganizationSubscriptionModal";
import SubscriptionLockScreen from "@/subscription/components/SubscriptionLockScreen";
import OnboardingTransitionScreen from "@/subscription/components/OnboardingTransitionScreen";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import { syncOrganizationSubscriptionModules } from "@/subscription/lib/syncOrganizationSubscriptionModules";
import { isPendingVerificationState } from "@/subscription/lib/subscriptionAccess";
import {
  isAdminPostPaymentTransition,
  setAdminPendingVerificationFlow,
} from "@/subscription/lib/adminOnboardingFlow";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, MessageSquare, RefreshCw } from "lucide-react";

export default function OrganizationSubscriptionPage() {
  const navigate = useNavigate();
  const { access, blocked, invalidate, loading } = useOrganizationSubscription();
  const { currentSchool } = useSchoolInfo();
  const [syncingModules, setSyncingModules] = useState(false);
  const pending = isPendingVerificationState(access);
  const transitioning = isAdminPostPaymentTransition();

  useEffect(() => {
    if (!pending && !transitioning) return;
    setAdminPendingVerificationFlow();
    navigate("/admin/pending-verification", { replace: true });
  }, [pending, transitioning, navigate]);

  const refreshModuleAccess = async () => {
    setSyncingModules(true);
    try {
      const result = await syncOrganizationSubscriptionModules();
      if (result?.ok) {
        toast.success(
          result.enabled_count != null && result.plan_module_count != null
            ? `Module access refreshed (${result.enabled_count} of ${result.plan_module_count} plan pages).`
            : "Module access refreshed from your subscription plan.",
        );
        await invalidate();
        return;
      }
      toast.error(result?.error ?? "Could not refresh module access.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh module access.");
    } finally {
      setSyncingModules(false);
    }
  };

  const { data: subscriptionDetails } = useQuery({
    queryKey: ["school-subscription-details", currentSchool?.id],
    enabled: Boolean(currentSchool?.id) && !blocked && access?.can_use_platform,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_subscriptions")
        .select("sms_balance, sms_enabled, storage_used_mb, storage_limit_mb, subscription_plans(name)")
        .eq("school_id", currentSchool!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading || pending || transitioning) {
    return (
      <OnboardingTransitionScreen
        message={
          pending || transitioning
            ? "Opening account verification…"
            : "Loading subscription…"
        }
      />
    );
  }

  if (blocked || !access?.can_use_platform) {
    return <SubscriptionLockScreen access={access} onActivated={invalidate} />;
  }

  const planName =
    (subscriptionDetails?.subscription_plans as { name?: string } | null)?.name ?? null;
  const smsBalance = subscriptionDetails?.sms_balance ?? null;
  const storageUsed = subscriptionDetails?.storage_used_mb ?? 0;
  const storageLimit = subscriptionDetails?.storage_limit_mb;

  return (
    <DashboardLayout role="admin">
      <div className="min-h-[60vh] space-y-4 p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          Your plan{planName ? ` (${planName})` : ""} is active
          {access?.expires_at
            ? ` until ${new Date(access.expires_at).toLocaleDateString()}`
            : ""}
          . To change plans or renew early, select a plan below.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={syncingModules}
          onClick={() => void refreshModuleAccess()}
        >
          {syncingModules ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh module access
        </Button>

        {subscriptionDetails ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {smsBalance != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4" />
                    SMS credits
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="text-2xl font-bold text-foreground">
                    {Number(smsBalance).toLocaleString()}
                  </p>
                  <p className="mt-1">
                    {subscriptionDetails.sms_enabled
                      ? "Parent SMS notifications are enabled."
                      : "Enable SMS at checkout or contact support to activate notifications."}
                  </p>
                </CardContent>
              </Card>
            ) : null}
            {storageLimit != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Storage</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="text-2xl font-bold text-foreground">
                    {(storageUsed / 1024).toFixed(1)} GB
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / {(storageLimit / 1024).toFixed(1)} GB
                    </span>
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        <OrganizationSubscriptionModal
          inline
          access={access}
          onActivated={invalidate}
        />
      </div>
    </DashboardLayout>
  );
}
