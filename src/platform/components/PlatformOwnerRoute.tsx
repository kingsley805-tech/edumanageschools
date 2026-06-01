import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

type Props = {
  children: React.ReactNode;
};

/**
 * Only the global Super Admin (software owner) may access platform SaaS routes.
 * School admins and staff are blocked even if they guess the URL.
 */
export function PlatformOwnerRoute({ children }: Props) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/platform-admin/login?redirect=${redirect}`, { replace: true });
    }
  }, [user, authLoading, navigate, location]);

  const loading = authLoading || roleLoading;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (role !== "super_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              The Platform Control Center is only for the software owner. Organization administrators
              cannot access tenant licensing or other schools.
            </p>
            <Button variant="outline" size="sm" onClick={() => void signOut().then(() => navigate("/auth"))}>
              Return to organization login
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
