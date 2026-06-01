import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { PORTAL_ROLE_ROUTES } from "@/lib/permissions";
import { requiredViewPermissionForPath } from "@/lib/rbac/routeGuards";
import { useSchoolEntitlements } from "@/platform/hooks/useSchoolEntitlements";
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
  const { hasPermission, hasAnyPermission, loading: permLoading, isSuperAdmin, isSchoolAdmin } =
    usePermissions();
  const { isModuleEnabledForPath, loading: entLoading } = useSchoolEntitlements();
  const navigate = useNavigate();
  const location = useLocation();

  const isPlatformPath = PLATFORM_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

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

  const loading = authLoading || roleLoading || permLoading || entLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
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

  const pathViewPermission = usesPortalPathGuard
    ? requiredViewPermissionForPath(location.pathname)
    : null;

  const moduleNotLicensed =
    !isSuperAdmin &&
    usesPortalPathGuard &&
    !isModuleEnabledForPath(location.pathname);

  const permissionDenied =
    !isSuperAdmin &&
    !isSchoolAdmin &&
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
