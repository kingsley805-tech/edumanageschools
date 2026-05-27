import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { effectivePortalRoles, isPortalStudentUser } from "@/lib/portalIdentity";

const ROLE_PRIORITY = [
  "super_admin",
  "admin",
  "accountant",
  "auditor",
  "teacher",
  "parent",
  "student",
] as const;

export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [isStudent, setIsStudent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setIsStudent(false);
        setLoading(false);
        return;
      }

      const [{ data, error }, studentAccount] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        isPortalStudentUser(user.id),
      ]);

      const rawRoles = !error && data?.length ? data.map((r) => r.role as string) : [];
      setIsStudent(studentAccount);
      setRoles(effectivePortalRoles(rawRoles, studentAccount));
      setLoading(false);
    };

    fetchRoles();
  }, [user]);

  const role = useMemo(() => {
    if (isStudent) return "student";
    if (!roles.length) return null;
    for (const r of ROLE_PRIORITY) {
      if (roles.includes(r)) return r;
    }
    return roles[0];
  }, [roles, isStudent]);

  const hasPortalRole = (r: string) => roles.includes(r);

  return { role, roles, loading, hasPortalRole, isStudent };
};
