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
  employee_no: string | null;
  avatar_url: string | null;
};

/**
 * Loads portal users who are school staff only.
 * Excludes anyone with a student/parent portal role or a row in `students`.
 */
export async function fetchStaffPortalUsers(schoolId: string): Promise<StaffPortalUser[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("school_id", schoolId);

  const ids = (profiles ?? []).map((p) => p.id);
  if (!ids.length) return [];

  const [{ data: allPortalRoles }, { data: studentRows }, { data: teacherRows }] = await Promise.all([
    supabase.from("user_roles").select("user_id, role").in("user_id", ids),
    supabase.from("students").select("user_id").eq("school_id", schoolId).not("user_id", "is", null),
    supabase
      .from("teachers")
      .select("user_id, employee_no")
      .eq("school_id", schoolId)
      .not("user_id", "is", null),
  ]);

  const portalRoles = (allPortalRoles ?? []).filter((r) =>
    STAFF_PORTAL_ROLES.includes(r.role as StaffPortalRole),
  );
  const nonStaffRoles = (allPortalRoles ?? []).filter((r) => r.role === "student" || r.role === "parent");

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

  const employeeNoByUser = new Map<string, string>();
  const teacherUserIds = new Set<string>();
  for (const row of teacherRows ?? []) {
    if (!row.user_id || !row.employee_no) continue;
    employeeNoByUser.set(row.user_id, row.employee_no);
    teacherUserIds.add(row.user_id);
  }
  for (const row of teacherRows ?? []) {
    if (!row.user_id) continue;
    teacherUserIds.add(row.user_id);
  }

  return (profiles ?? [])
    .filter((p) => staffByUser.get(p.id) === "teacher" || teacherUserIds.has(p.id))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name ?? "—",
      email: p.email ?? "",
      portal_role: "teacher",
      employee_no: employeeNoByUser.get(p.id) ?? null,
      avatar_url: p.avatar_url ?? null,
    }));
}

export function isStudentPortalUser(userId: string, studentUserIds: Set<string>): boolean {
  return studentUserIds.has(userId);
}
