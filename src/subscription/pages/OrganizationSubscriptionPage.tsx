// @ts-nocheck
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import OrganizationSubscriptionModal from "@/subscription/components/OrganizationSubscriptionModal";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function OrganizationSubscriptionPage() {
  const { access, blocked, invalidate } = useOrganizationSubscription();

  return (
    <DashboardLayout role="admin" hideSidebar={blocked}>
      <div className="min-h-[60vh]">
        {!blocked && access?.can_use_platform ? (
          <div className="space-y-4 p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin">
                <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Subscription</h1>
            <p className="text-muted-foreground">
              Your plan is active
              {access?.expires_at
                ? ` until ${new Date(access.expires_at).toLocaleDateString()}`
                : ""}
              . To change plans or renew early, select a plan below.
            </p>
          </div>
        ) : null}
        <OrganizationSubscriptionModal
          forceOpen={blocked || access?.access_state === "locked"}
          access={access}
          onActivated={invalidate}
        />
      </div>
    </DashboardLayout>
  );
}
