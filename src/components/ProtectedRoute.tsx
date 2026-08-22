import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { PORTAL_ROLE_ROUTES } from "@/lib/permissions";
import { requiredViewPermissionForPath } from "@/lib/rbac/routeGuards";
import { useSchoolEntitlements } from "@/platform/hooks/useSchoolEntitlements";
import {
  ADMIN_PENDING_VERIFICATION_PATH,
  isPendingVerificationState,
  isPortalStaffRole,
  isSubscriptionAllowedPath,
  isSubscriptionGatedPortalPath,
} from "@/subscription/lib/subscriptionAccess";
import {
  clearAdminPendingVerificationFlow,
  isAdminPendingVerificationFlag,
  isAdminPostPaymentTransition,
} from "@/subscription/lib/adminOnboardingFlow";
import SubscriptionLockScreen from "@/subscription/components/SubscriptionLockScreen";
import OnboardingTransitionScreen from "@/subscription/components/OnboardingTransitionScreen";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  /** When true, skip automatic path-based portal.view guard (e.g. nested layouts) */
  skipPathGuard?: boolean;
}

const PORTAL_RBAC_PREFIXES = ["/admin", "/accountant", "/auditor"];
const PLATFORM_PREFIXES = ["/platform"];

const SUBSCRIPTION_DENIED =
  "Access Denied. This module is not included in your organization's subscription package.";

export const ProtectedRoute = ({
  children,
  allowedRoles,
  requiredPermission,
  requiredAnyPermission,
  skipPathGuard = false,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { role, roles, loading: roleLoading, isStudent } = useUserRole();
  const { hasPermission, hasAnyPermission, loading: permLoading, isSuperAdmin } = usePermissions();
  const {
    isModuleEnabledForPath,
    loading: entLoading,
    subscriptionBlocked,
    access: subscriptionAccess,
    invalidate: invalidateSubscription,
  } = useSchoolEntitlements();
  const subSuperBypass = isSuperAdmin;
  const navigate = useNavigate();
  const location = useLocation();

  const isPlatformPath = PLATFORM_PREFIXES.some((p) => location.pathname.startsWith(p));
  const portalStaff = isPortalStaffRole(roles);
  const onSubscriptionAllowedPath = isSubscriptionAllowedPath(location.pathname);
  const onPendingVerificationPath = location.pathname === ADMIN_PENDING_VERIFICATION_PATH;
  const touchesGatedPortal =
    isSubscriptionGatedPortalPath(location.pathname) ||
    (location.pathname === "/settings" && portalStaff);
  const orgSubscriptionLocked =
    !subSuperBypass &&
    !isSuperAdmin &&
    portalStaff &&
    subscriptionBlocked &&
    touchesGatedPortal;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (authLoading || roleLoading || !user) return;
    if (subSuperBypass || isSuperAdmin) return;
    if (!portalStaff) return;

    const postPayment = isAdminPostPaymentTransition() || isAdminPendingVerificationFlag();

    // Unpaid admins on verification → subscription (skip during post-payment settle).
    if (
      onPendingVerificationPath &&
      !entLoading &&
      !postPayment &&
      (subscriptionAccess?.access_state === "pending_payment" ||
        (subscriptionAccess != null && !subscriptionAccess.plan_id))
    ) {
      clearAdminPendingVerificationFlow();
      navigate("/admin/subscription", { replace: true });
      return;
    }

    if (isPendingVerificationState(subscriptionAccess) && !onPendingVerificationPath) {
      navigate(ADMIN_PENDING_VERIFICATION_PATH, { replace: true });
    }
  }, [
    authLoading,
    roleLoading,
    user,
    subSuperBypass,
    isSuperAdmin,
    portalStaff,
    entLoading,
    onPendingVerificationPath,
    subscriptionAccess,
    navigate,
  ]);

  const usesPortalPathGuardEarly =
    !skipPathGuard &&
    PORTAL_RBAC_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (roleLoading || !role) return;

    if (
      isStudent &&
      PORTAL_RBAC_PREFIXES.some((p) => location.pathname.startsWith(p))
    ) {
      navigate(PORTAL_ROLE_ROUTES.student);
      return;
    }

    if (!allowedRoles?.length) return;

    const allowed = allowedRoles.some((r) => roles.includes(r));
    if (!allowed) {
      navigate(PORTAL_ROLE_ROUTES[role] || "/");
    }
  }, [role, roles, roleLoading, allowedRoles, navigate, isStudent, location.pathname]);

  /** Wait for subscription access before opening gated portal routes (prevents flash of dashboard after signup). */
  const mustResolveSubscription =
    portalStaff &&
    !subSuperBypass &&
    !isSuperAdmin &&
    touchesGatedPortal &&
    !onSubscriptionAllowedPath;

  const postPaymentTransition = isAdminPostPaymentTransition();
  const loading =
    authLoading ||
    roleLoading ||
    (mustResolveSubscription && entLoading) ||
    (onPendingVerificationPath && entLoading && !postPaymentTransition);

  if (loading) {
    return (
      <OnboardingTransitionScreen
        message={
          postPaymentTransition
            ? "Confirming your payment…"
            : "Loading your account…"
        }
      />
    );
  }

  if (!user) return null;

  if (isPlatformPath && !roles.includes("super_admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            Organization administrators cannot access the Platform Control Center.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (allowedRoles?.length && !allowedRoles.some((r) => roles.includes(r))) {
    return null;
  }

  const usesPortalPathGuard =
    !skipPathGuard &&
    PORTAL_RBAC_PREFIXES.some((p) => location.pathname.startsWith(p));

  // Pending verification: keep children mounted (no blank redirect frame).
  if (
    onPendingVerificationPath &&
    portalStaff &&
    !subSuperBypass &&
    (isPendingVerificationState(subscriptionAccess) ||
      postPaymentTransition ||
      isAdminPendingVerificationFlag())
  ) {
    return <>{children}</>;
  }

  if (orgSubscriptionLocked && !onSubscriptionAllowedPath) {
    if (isPendingVerificationState(subscriptionAccess) || postPaymentTransition) {
      return <OnboardingTransitionScreen message="Opening account verification…" />;
    }
    return (
      <SubscriptionLockScreen
        access={subscriptionAccess}
        onActivated={invalidateSubscription}
      />
    );
  }

  const pathViewPermission = usesPortalPathGuard
    ? requiredViewPermissionForPath(location.pathname)
    : null;

  const moduleNotLicensed =
    !isSuperAdmin &&
    usesPortalPathGuard &&
    !isSubscriptionAllowedPath(location.pathname) &&
    !isModuleEnabledForPath(location.pathname);

  const permissionDenied =
    !isSuperAdmin &&
    ((pathViewPermission && !hasPermission(pathViewPermission)) ||
      (requiredPermission && !hasPermission(requiredPermission)) ||
      (requiredAnyPermission?.length && !hasAnyPermission(requiredAnyPermission)));

  if (moduleNotLicensed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Module not available</AlertTitle>
          <AlertDescription>{SUBSCRIPTION_DENIED}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Unauthorized</AlertTitle>
          <AlertDescription>
            You do not have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};
