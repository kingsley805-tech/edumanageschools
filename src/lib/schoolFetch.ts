import { supabase } from "@/integrations/supabase/client";

export type SchoolRow = {
  id: string;
  school_name: string;
  school_code: string;
  logo_url: string | null;
  theme_primary?: string | null;
  theme_secondary?: string | null;
  theme_accent?: string | null;
  name?: string | null;
  motto?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  principal_name?: string | null;
  stamp_url?: string | null;
};

/** Resolve the current user's school id from profile, roles, or super-admin assignments. */
export async function resolveUserSchoolId(userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.school_id) return profile.school_id;

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("school_id")
    .eq("user_id", userId)
    .not("school_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (roleRow?.school_id) return roleRow.school_id;

  const { data: superRow } = await supabase
    .from("super_admin_schools")
    .select("school_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return superRow?.school_id ?? null;
}

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    msg.includes("column") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

/** Load school row with fallback when optional theme/branding columns are not migrated yet. */
export async function fetchSchoolById(schoolId: string): Promise<SchoolRow | null> {
  const fullSelect =
    "id, school_name, school_code, logo_url, theme_primary, theme_secondary, theme_accent, name, motto, address, phone, email, principal_name, stamp_url";

  let result = await supabase.from("schools").select(fullSelect).eq("id", schoolId).maybeSingle();

  if (isMissingColumnError(result.error)) {
    result = await supabase
      .from("schools")
      .select("id, school_name, school_code, logo_url")
      .eq("id", schoolId)
      .maybeSingle();
  }

  if (result.error) throw result.error;
  return (result.data as SchoolRow | null) ?? null;
}

export async function fetchSchoolForUser(userId: string): Promise<SchoolRow | null> {
  const schoolId = await resolveUserSchoolId(userId);
  if (!schoolId) return null;
  return fetchSchoolById(schoolId);
}
