import { supabase } from "@/integrations/supabase/client";

const STAFF_ROLES = new Set(["admin", "accountant", "auditor", "teacher", "super_admin"]);

/** True when the user is a student account (not staff/employee). Staff portal roles take precedence. */
export async function isPortalStudentUser(userId: string): Promise<boolean> {
  const [{ data: roleRows }, { data: studentRow }, { data: studentRole }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("students")
      .select("id")
      .or(`user_id.eq.${userId},profile_id.eq.${userId}`)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "student").maybeSingle(),
  ]);

  const hasStaffPortalRole = (roleRows ?? []).some((r) => STAFF_ROLES.has(r.role as string));
  if (hasStaffPortalRole) return false;

  return !!studentRow || !!studentRole;
}

/** Portal roles effective for routing — students never inherit staff roles. */
export function effectivePortalRoles(rawRoles: string[], isStudent: boolean): string[] {
  if (!isStudent) return rawRoles;
  return rawRoles.filter((r) => !STAFF_ROLES.has(r));
}
