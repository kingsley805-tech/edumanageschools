import { supabase } from "@/integrations/supabase/client";

export const TEACHER_DEACTIVATED_MESSAGE =
  "Your teacher account has been deactivated. Please contact your school administrator.";

export type SetTeacherAccountStatusResult = {
  ok: boolean;
  error?: string;
  is_active?: boolean;
  message?: string;
  teacher_name?: string;
};

export async function setTeacherAccountStatus(
  teacherId: string,
  isActive: boolean,
): Promise<SetTeacherAccountStatusResult> {
  const { data, error } = await supabase.functions.invoke("teacher-account-status", {
    body: { teacher_id: teacherId, is_active: isActive },
  });

  if (error) {
    return { ok: false, error: error.message || "Could not update teacher account status." };
  }

  const result = (data ?? {}) as SetTeacherAccountStatusResult;
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not update teacher account status." };
  }

  return result;
}

export async function checkMyTeacherAccountActive(): Promise<{
  ok: boolean;
  active: boolean;
  error?: string;
}> {
  const { data, error } = await supabase.rpc("check_my_teacher_account_active");

  if (error) {
    return { ok: false, active: true, error: error.message };
  }

  const result = (data ?? {}) as { ok?: boolean; active?: boolean; error?: string };
  return {
    ok: result.ok === true,
    active: result.active !== false,
    error: result.error,
  };
}
