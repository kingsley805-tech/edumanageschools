// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export async function logAudit(
  schoolId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    school_id: schoolId,
    user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: (details ?? null) as never,
  });
}