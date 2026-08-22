// @ts-nocheck
import { ReactNode } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import OrganizationSubscriptionModal from "@/subscription/components/OrganizationSubscriptionModal";
import AdminPendingApprovalScreen from "@/subscription/components/AdminPendingApprovalScreen";
import { isSubscriptionAllowedPath } from "@/subscription/lib/subscriptionAccess";
import SubscriptionExpiryBanner from "@/subscription/components/SubscriptionExpiryBanner";

type Props = {
  children: ReactNode;
};

/** Blocks admin portal until organization subscription is active (except allowed paths). */
export default function OrganizationSubscriptionGate({ children }: Props) {
  const location = useLocation();
  const { access, blocked, loading, isSuperAdmin } = useOrganizationSubscription();

  if (loading || isSuperAdmin) {
    return <>{children}</>;
  }

  if (access?.access_state === "pending_approval") {
    return <AdminPendingApprovalScreen />;
  }

  const allowed = isSubscriptionAllowedPath(location.pathname);
  const showModal = blocked && !allowed;

  if (blocked && !allowed) {
    return (
      <>
        <Navigate to="/admin/subscription" replace />
        <OrganizationSubscriptionModal forceOpen access={access} />
      </>
    );
  }

  return (
    <>
      {access?.can_use_platform ? <SubscriptionExpiryBanner access={access} /> : null}
      {showModal ? <OrganizationSubscriptionModal forceOpen access={access} /> : null}
      {children}
    </>
  );
}
