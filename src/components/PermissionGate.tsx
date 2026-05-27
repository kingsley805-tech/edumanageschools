import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

interface PermissionGateProps {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
  showDenied?: boolean;
}

export const PermissionGate = ({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
  showDenied = false,
}: PermissionGateProps) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading, isSuperAdmin } =
    usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  let allowed = isSuperAdmin;
  if (!allowed && permission) allowed = hasPermission(permission);
  if (!allowed && anyOf?.length) allowed = hasAnyPermission(anyOf);
  if (!allowed && allOf?.length) allowed = hasAllPermissions(allOf);

  if (allowed) return <>{children}</>;

  if (showDenied) {
    return (
      <Alert variant="destructive" className="m-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>
          You do not have permission to perform this action. Contact your school administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{fallback}</>;
};
