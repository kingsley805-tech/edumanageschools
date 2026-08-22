import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import OrganizationSubscriptionModal from "@/subscription/components/OrganizationSubscriptionModal";
import AdminPendingApprovalScreen from "@/subscription/components/AdminPendingApprovalScreen";
import type { OrganizationSubscriptionAccess } from "@/subscription/lib/subscriptionAccess";

type Props = {
  access: OrganizationSubscriptionAccess | null | undefined;
  onActivated?: () => void;
};

/** Full-screen lock: subscription modal / pending approval + logout only (no dashboard access). */
export default function SubscriptionLockScreen({ access, onActivated }: Props) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (access?.access_state === "pending_approval") {
    return <AdminPendingApprovalScreen />;
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute right-4 top-4 z-[110]">
        <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
      <OrganizationSubscriptionModal forceOpen access={access} onActivated={onActivated} />
    </div>
  );
}

