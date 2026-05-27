import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { PORTAL_ROLE_ROUTES } from "@/lib/permissions";
import { requiredViewPermissionForPath } from "@/lib/rbac/routeGuards";
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

export const ProtectedRoute = ({
  children,
  allowedRoles,
  requiredPermission,
  requiredAnyPermission,
  skipPathGuard = false,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { role, roles, loading: roleLoading } = useUserRole();
  const { hasPermission, hasAnyPermission, loading: permLoading, isSuperAdmin } =
    usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (roleLoading || !role || !allowedRoles?.length) return;

    const allowed = allowedRoles.some((r) => roles.includes(r));
    if (!allowed) {
      navigate(PORTAL_ROLE_ROUTES[role] || "/");
    }
  }, [role, roles, roleLoading, allowedRoles, navigate]);

  const loading = authLoading || roleLoading || permLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (allowedRoles?.length && !allowedRoles.some((r) => roles.includes(r))) {
    return null;
  }

  const usesPortalPathGuard =
    !skipPathGuard &&
    PORTAL_RBAC_PREFIXES.some((p) => location.pathname.startsWith(p));

  const pathViewPermission = usesPortalPathGuard
    ? requiredViewPermissionForPath(location.pathname)
    : null;

  const permissionDenied =
    !isSuperAdmin &&
    ((pathViewPermission && !hasPermission(pathViewPermission)) ||
      (requiredPermission && !hasPermission(requiredPermission)) ||
      (requiredAnyPermission?.length && !hasAnyPermission(requiredAnyPermission)));

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
