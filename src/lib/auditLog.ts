// @ts-nocheck
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
  const { error } = await supabase.rpc("log_login_activity_event", {
    p_email: email ?? user?.email ?? null,
    p_success: success,
    p_failure_reason: failureReason ?? null,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });

  // Fall back to direct insert when RPC is not migrated yet.
  if (error && success && user) {
    let schoolId: string | null = null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();
    schoolId = profile?.school_id ?? null;

    await supabase.from("login_activity").insert({
      user_id: user.id,
      school_id: schoolId,
      email: email ?? user.email ?? null,
      success,
      failure_reason: failureReason ?? null,
      ip_address: null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  }
}

/** System owner portal login — separate from tenant /auth (audited). */
export async function logPlatformOwnerLogin(
  success: boolean,
  email?: string,
  failureReason?: string,
) {
  const { data: { user } } = await supabase.auth.getUser();
  let ip: string | null = null;
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    const json = (await res.json()) as { ip?: string };
    ip = json.ip ?? null;
  } catch {
    /* optional */
  }
  await supabase.from("login_activity").insert({
    user_id: user?.id ?? null,
    school_id: null,
    email: email ?? user?.email ?? null,
    success,
    failure_reason: failureReason
      ? `[platform_owner] ${failureReason}`
      : success
        ? "[platform_owner] success"
        : null,
    ip_address: ip,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
}