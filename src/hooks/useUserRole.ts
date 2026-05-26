import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!error && data?.length) {
        setRoles(data.map((r) => r.role as string));
      } else {
        setRoles([]);
      }
      setLoading(false);
    };

    fetchRoles();
  }, [user]);

  const role = useMemo(() => {
    if (!roles.length) return null;
    for (const r of ROLE_PRIORITY) {
      if (roles.includes(r)) return r;
    }
    return roles[0];
  }, [roles]);

  const hasPortalRole = (r: string) => roles.includes(r);

  return { role, roles, loading, hasPortalRole };
};
