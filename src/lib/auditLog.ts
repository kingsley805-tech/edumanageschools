import { supabase } from "@/integrations/supabase/client";

export interface AuditLogPayload {
  schoolId: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  module?: string;
  recordId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export async function writeAuditLog(payload: AuditLogPayload) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("audit_logs").insert({
    school_id: payload.schoolId,
    action_type: payload.actionType,
    entity_type: payload.entityType,
    entity_id: payload.entityId ?? null,
    performed_by: user?.id ?? null,
    module: payload.module ?? null,
    record_id: payload.recordId ?? null,
    old_values: payload.oldValues ?? null,
    new_values: payload.newValues ?? null,
    details: payload.details ?? {},
  });
  if (error) console.error("Audit log failed:", error);
  return { error };
}

export async function logLoginActivity(
  success: boolean,
  email?: string,
  failureReason?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  let schoolId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();
    schoolId = profile?.school_id ?? null;
  }
  await supabase.from("login_activity").insert({
    user_id: user?.id ?? null,
    school_id: schoolId,
    email: email ?? user?.email ?? null,
    success,
    failure_reason: failureReason ?? null,
    ip_address: null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
}
