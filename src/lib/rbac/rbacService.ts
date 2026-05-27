import { supabase } from "@/integrations/supabase/client";
import { defaultCodesForRole } from "@/lib/rbac/permissionCatalog";

export type RoleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  school_id: string | null;
};

export async function fetchRoles(schoolId: string | null): Promise<RoleRow[]> {
  const q = schoolId
    ? supabase.from("roles").select("*").or(`school_id.is.null,school_id.eq.${schoolId}`)
    : supabase.from("roles").select("*").is("school_id", null);
  const { data, error } = await q.order("name");
  if (error) throw error;
  return (data ?? []) as RoleRow[];
}

export async function fetchPermissionIdMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("permissions").select("id, code");
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.code, p.id]));
}

export async function fetchRolePermissionCodes(roleId: string): Promise<Set<string>> {
  const { data: rp, error } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);
  if (error) throw error;
  const ids = (rp ?? []).map((r) => r.permission_id);
  if (!ids.length) return new Set();
  const { data: perms } = await supabase.from("permissions").select("code").in("id", ids);
  return new Set((perms ?? []).map((p) => p.code));
}

export async function saveRolePermissions(
  roleId: string,
  codes: Set<string>,
  permissionIdMap: Map<string, string>,
): Promise<void> {
  await supabase.from("role_permissions").delete().eq("role_id", roleId);
  const inserts = [...codes]
    .map((code) => permissionIdMap.get(code))
    .filter((id): id is string => !!id)
    .map((permission_id) => ({ role_id: roleId, permission_id }));
  if (inserts.length) {
    const { error } = await supabase.from("role_permissions").insert(inserts);
    if (error) throw error;
  }
}

export async function logPermissionChange(params: {
  schoolId: string;
  actorId: string;
  actionType: string;
  roleId?: string;
  targetUserId?: string;
  permissionCode?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from("permission_logs").insert({
    school_id: params.schoolId,
    actor_id: params.actorId,
    action_type: params.actionType,
    role_id: params.roleId ?? null,
    target_user_id: params.targetUserId ?? null,
    permission_code: params.permissionCode ?? null,
    details: params.details ?? {},
  });
}

export async function createRole(params: {
  schoolId: string | null;
  name: string;
  description?: string;
  slug?: string;
}): Promise<RoleRow> {
  const slug =
    params.slug ??
    `${params.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36).slice(-4)}`;
  const { data, error } = await supabase
    .from("roles")
    .insert({
      school_id: params.schoolId,
      slug,
      name: params.name,
      description: params.description ?? null,
      is_system: false,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to create role");
  return data as RoleRow;
}

export async function updateRole(
  roleId: string,
  patch: { name?: string; description?: string },
): Promise<void> {
  const { error } = await supabase.from("roles").update(patch).eq("id", roleId);
  if (error) throw error;
}

export async function deleteRole(roleId: string): Promise<void> {
  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) throw error;
}

export async function applyDefaultPermissionsForRole(
  roleId: string,
  slug: string,
  permissionIdMap: Map<string, string>,
): Promise<void> {
  const codes = new Set(defaultCodesForRole(slug));
  await saveRolePermissions(roleId, codes, permissionIdMap);
}

const PORTAL_ROLE_MAP: Record<string, "admin" | "accountant" | "auditor" | "teacher"> = {
  school_admin: "admin",
  accountant: "accountant",
  auditor: "auditor",
  teacher: "teacher",
  examiner: "teacher",
  registrar: "admin",
  parent_support: "admin",
};

export async function assignRoleToUser(params: {
  userId: string;
  roleId: string;
  schoolId: string;
  assignedBy?: string;
  roleSlug: string;
}): Promise<void> {
  await supabase
    .from("user_role_assignments")
    .delete()
    .eq("user_id", params.userId)
    .eq("school_id", params.schoolId);

  const { error } = await supabase.from("user_role_assignments").insert({
    user_id: params.userId,
    role_id: params.roleId,
    school_id: params.schoolId,
    assigned_by: params.assignedBy ?? null,
  });
  if (error) throw error;

  const portalRole = PORTAL_ROLE_MAP[params.roleSlug];
  if (portalRole) {
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", params.userId)
      .in("role", ["admin", "accountant", "auditor", "teacher"]);
    const { error: urError } = await supabase
      .from("user_roles")
      .insert({ user_id: params.userId, role: portalRole });
    if (urError) throw urError;
  }
}
