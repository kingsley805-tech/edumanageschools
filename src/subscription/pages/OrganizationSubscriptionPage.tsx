// @ts-nocheck
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import OrganizationSubscriptionModal from "@/subscription/components/OrganizationSubscriptionModal";
import SubscriptionLockScreen from "@/subscription/components/SubscriptionLockScreen";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MessageSquare } from "lucide-react";

export default function OrganizationSubscriptionPage() {
  const { access, blocked, invalidate } = useOrganizationSubscription();
  const { currentSchool } = useSchoolInfo();

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
