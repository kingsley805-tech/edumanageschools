import { useMemo } from "react";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";

/**
 * edubill-web-app is org-scoped; school-hub is school-scoped.
 * This hook provides the equivalent scope id for billing queries.
 */
export function useBillingSchoolId(): { schoolId: string; loading: boolean } {
  const { currentSchool, loading } = useSchoolInfo();
  const schoolId = useMemo(() => currentSchool?.id ?? "", [currentSchool?.id]);
  return { schoolId, loading };
}

