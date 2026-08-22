// @ts-nocheck
import { ReactNode, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import OrganizationSubscriptionModal from "@/subscription/components/OrganizationSubscriptionModal";
import OnboardingTransitionScreen from "@/subscription/components/OnboardingTransitionScreen";
import {
  ADMIN_PENDING_VERIFICATION_PATH,
  isPendingVerificationState,
  isSubscriptionAllowedPath,
} from "@/subscription/lib/subscriptionAccess";
import { setAdminPendingVerificationFlow } from "@/subscription/lib/adminOnboardingFlow";
import SubscriptionExpiryBanner from "@/subscription/components/SubscriptionExpiryBanner";

type Props = {
  children: ReactNode;
};

/** Blocks admin portal until organization subscription is active (except allowed paths). */
export default function OrganizationSubscriptionGate({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { access, blocked, loading, isSuperAdmin } = useOrganizationSubscription();
  const pending = isPendingVerificationState(access);

  useEffect(() => {
    if (!pending) return;
    setAdminPendingVerificationFlow();
    if (location.pathname !== ADMIN_PENDING_VERIFICATION_PATH) {
      navigate(ADMIN_PENDING_VERIFICATION_PATH, { replace: true });
    }
  }, [pending, location.pathname, navigate]);

  if (loading || isSuperAdmin) {
    return <>{children}</>;
  }

  if (pending) {
    return <OnboardingTransitionScreen message="Opening account verification…" />;
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
