import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import OrganizationSubscriptionModal from "@/subscription/components/OrganizationSubscriptionModal";
import AdminPendingApprovalScreen from "@/subscription/components/AdminPendingApprovalScreen";
import OnboardingTransitionScreen from "@/subscription/components/OnboardingTransitionScreen";
import type { OrganizationSubscriptionAccess } from "@/subscription/lib/subscriptionAccess";
import { isPendingVerificationState } from "@/subscription/lib/subscriptionAccess";
import {
  isAdminPostPaymentTransition,
  setAdminPendingVerificationFlow,
} from "@/subscription/lib/adminOnboardingFlow";

type Props = {
  access: OrganizationSubscriptionAccess | null | undefined;
  onActivated?: () => void;
};

/** Full-screen lock: subscription modal / pending approval (no dashboard flash). */
export default function SubscriptionLockScreen({ access, onActivated }: Props) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const pending = isPendingVerificationState(access);
  const transitioning = isAdminPostPaymentTransition();

  useEffect(() => {
    if (!pending) return;
    setAdminPendingVerificationFlow();
    if (window.location.pathname !== "/admin/pending-verification") {
      navigate("/admin/pending-verification", { replace: true });
    }
  }, [pending, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  // Render verification UI in-place — no blank frame while route changes.
  if (pending || transitioning) {
    if (window.location.pathname === "/admin/pending-verification") {
      return <AdminPendingApprovalScreen />;
    }
    return <OnboardingTransitionScreen message="Opening account verification…" />;
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
