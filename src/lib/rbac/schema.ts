/** True when RBAC tables/RPCs are not deployed on Supabase yet. */
export function isRbacSchemaMissing(
  error: { code?: string; message?: string; details?: string; hint?: string } | null,
): boolean {
  if (!error) return false;
  const blob = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    blob.includes("pgrst205") ||
    blob.includes("pgrst204") ||
    blob.includes("42p01") ||
    blob.includes("schema cache") ||
    (blob.includes("does not exist") &&
      (blob.includes("permissions") ||
        blob.includes("roles") ||
        blob.includes("role_permissions") ||
        blob.includes("get_user_permissions")))
  );
}

export function portalRoleToRbacSlug(portalRole: string | null): string {
  if (portalRole === "admin") return "school_admin";
  return portalRole ?? "";
}
