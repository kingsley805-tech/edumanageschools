import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { checkMyTeacherAccountActive, TEACHER_DEACTIVATED_MESSAGE } from "@/lib/teacherAccountStatus";

/**
 * Signs out teachers whose account was deactivated while they had an active session.
 */
export function useTeacherAccountGuard() {
  const { user, signOut } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!user || role !== "teacher") return;

    let cancelled = false;

    const verify = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const result = await checkMyTeacherAccountActive();
        if (cancelled || result.active) return;

        await signOut();
        toast.error(result.error ?? TEACHER_DEACTIVATED_MESSAGE, { duration: 8000 });
        navigate("/auth?deactivated=teacher", { replace: true });
      } finally {
        checkingRef.current = false;
      }
    };

    void verify();
    const interval = window.setInterval(verify, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, role, signOut, navigate]);
}
