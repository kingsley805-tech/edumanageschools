import { supabase } from "@/integrations/supabase/client";
import { isPortalStudentUser } from "@/lib/portalIdentity";

export { isPortalStudentUser };

/** Portal roles that represent school staff (never students or parents). */
export const STAFF_PORTAL_ROLES = ["admin", "accountant", "auditor", "teacher"] as const;

export type StaffPortalRole = (typeof STAFF_PORTAL_ROLES)[number];

export type StaffPortalUser = {
  id: string;
  full_name: string;
  email: string;
  portal_role: StaffPortalRole | string;
};

/**
 * Loads portal users who are school staff only.
 * Excludes anyone with a student/parent portal role or a row in `students`.
 */
export async function fetchStaffPortalUsers(schoolId: string): Promise<StaffPortalUser[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("school_id", schoolId);

  const ids = (profiles ?? []).map((p) => p.id);
  if (!ids.length) return [];

  const [{ data: portalRoles }, { data: studentRows }, { data: nonStaffRoles }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids)
      .in("role", [...STAFF_PORTAL_ROLES]),
    supabase.from("students").select("user_id").eq("school_id", schoolId).not("user_id", "is", null),
    supabase
      .from("user_roles")
      .select("user_id")
      .in("user_id", ids)
      .in("role", ["student", "parent"]),
  ]);

  const excludeIds = new Set<string>([
    ...(studentRows ?? []).map((s) => s.user_id).filter((id): id is string => !!id),
    ...(nonStaffRoles ?? []).map((r) => r.user_id),
  ]);

  const staffByUser = new Map<string, StaffPortalRole>();
  for (const row of portalRoles ?? []) {
    if (excludeIds.has(row.user_id)) continue;
    if (!STAFF_PORTAL_ROLES.includes(row.role as StaffPortalRole)) continue;
    staffByUser.set(row.user_id, row.role as StaffPortalRole);
  }

  return (profiles ?? [])
    .filter((p) => staffByUser.has(p.id))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name ?? "—",
      email: p.email ?? "",
      portal_role: staffByUser.get(p.id)!,
    }));
}

export function isStudentPortalUser(userId: string, studentUserIds: Set<string>): boolean {
  return studentUserIds.has(userId);
}
