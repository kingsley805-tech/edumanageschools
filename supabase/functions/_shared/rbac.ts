import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function getAuthUser(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function requirePermission(
  supabase: SupabaseClient,
  userId: string,
  permissionCode: string,
  schoolId?: string | null
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _permission_code: permissionCode,
    _school_id: schoolId ?? null,
  });

  if (error || !data) {
    return { ok: false, status: 403, message: "Unauthorized" };
  }
  return { ok: true };
}

export function unauthorizedResponse(
  corsHeaders: Record<string, string>,
  message = "Unauthorized"
) {
  return new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
