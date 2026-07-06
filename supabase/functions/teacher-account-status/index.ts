import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEACTIVATED_BAN_DURATION = "876000h";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !callerData.user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const callerId = callerData.user.id;

    const { data: callerRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    if (rolesError) throw rolesError;

    const roleSet = new Set((callerRoles ?? []).map((r) => String(r.role)));
    const isSuperAdmin = roleSet.has("super_admin");
    const isAdmin = roleSet.has("admin");

    if (!isSuperAdmin && !isAdmin) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: Only administrators can change teacher account status" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("school_id, full_name")
      .eq("id", callerId)
      .single();

    const body = await req.json();
    const teacherId = body?.teacher_id as string | undefined;
    const isActive = body?.is_active as boolean | undefined;

    if (!teacherId || typeof isActive !== "boolean") {
      return new Response(
        JSON.stringify({ ok: false, error: "teacher_id and is_active (boolean) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .select("id, user_id, school_id, employee_no, is_active, profiles(full_name)")
      .eq("id", teacherId)
      .single();

    if (teacherError || !teacher) {
      return new Response(
        JSON.stringify({ ok: false, error: "Teacher not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isSuperAdmin) {
      if (!adminProfile?.school_id || teacher.school_id !== adminProfile.school_id) {
        return new Response(
          JSON.stringify({ ok: false, error: "Teacher not found or belongs to a different school" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (teacher.is_active === isActive) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: isActive ? "Teacher account is already active" : "Teacher account is already inactive",
          is_active: isActive,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const teacherName =
      (teacher.profiles as { full_name?: string } | null)?.full_name?.trim() || "Teacher";
    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("teachers")
      .update({
        is_active: isActive,
        deactivated_at: isActive ? null : now,
        deactivated_by: isActive ? null : callerId,
      })
      .eq("id", teacherId);

    if (updateError) throw updateError;

    const userId = teacher.user_id as string | null;

    if (userId) {
      if (!isActive) {
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: DEACTIVATED_BAN_DURATION,
        });
        if (banError) {
          console.error("Failed to ban teacher user:", banError);
          throw banError;
        }

        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, "global");
        if (signOutError) {
          console.error("Failed to terminate teacher sessions:", signOutError);
        }
      } else {
        const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (unbanError) {
          console.error("Failed to unban teacher user:", unbanError);
          throw unbanError;
        }
      }
    }

    const actionLabel = isActive ? "Activated" : "Deactivated";

    await supabaseAdmin.from("audit_logs").insert({
      school_id: teacher.school_id,
      action_type: isActive ? "teacher_account_activated" : "teacher_account_deactivated",
      entity_type: "teacher",
      entity_id: teacherId,
      performed_by: callerId,
      module: "teachers",
      details: {
        teacher_id: teacherId,
        teacher_name: teacherName,
        teacher_user_id: userId,
        employee_no: teacher.employee_no,
        action: actionLabel,
        performed_by_name: adminProfile?.full_name ?? null,
        timestamp: now,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        is_active: isActive,
        message: `Teacher account ${actionLabel.toLowerCase()} successfully`,
        teacher_name: teacherName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("teacher-account-status error:", errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
