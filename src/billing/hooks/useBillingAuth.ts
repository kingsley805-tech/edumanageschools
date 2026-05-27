import { useMemo } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useBillingSchoolId } from "@/billing/hooks/useBillingSchoolId";

/** Maps edubill org scope to school-hub school scope + finance roles. */
export function useBillingAuth() {
  const { schoolId, loading: schoolLoading } = useBillingSchoolId();
  const { role, loading: roleLoading } = useUserRole();

  const isAdmin = role === "admin" || role === "super_admin";
  const isAccountant = role === "accountant" || isAdmin;

  return useMemo(
    () => ({
      schoolId,
      isAdmin,
      isAccountant,
      loading: schoolLoading || roleLoading,
      role,
    }),
    [schoolId, isAdmin, isAccountant, schoolLoading, roleLoading, role],
  );
}
