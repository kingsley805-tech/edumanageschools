import { supabase } from "@/integrations/supabase/client";

export type StudentRecoveryRow = {
  student_id: string;
  student_user_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  parent_has_dashboard: boolean;
  reset_status: string;
  reset_requested_at: string | null;
  reset_request_id: string | null;
  parent_notification_sent: boolean;
  sms_sent: boolean;
  processed_at: string | null;
  processed_by_name: string | null;
};

export type ProcessResetResult = {
  ok: boolean;
  message?: string;
  temporary_password?: string;
  student_name?: string;
  admission_number?: string;
  parent_dashboard_delivered?: boolean;
  sms_delivered?: boolean;
};

export async function fetchStudentPasswordRecoveryOverview(
  schoolId: string,
): Promise<StudentRecoveryRow[]> {
  const { data, error } = await supabase.rpc("get_student_password_recovery_overview", {
    p_school_id: schoolId,
  });
  if (error) throw error;
  return (data ?? []) as StudentRecoveryRow[];
}

export async function processStudentPasswordResetRequest(
  requestId: string,
): Promise<ProcessResetResult> {
  const { data, error } = await supabase.functions.invoke("password-reset-otp", {
    body: { action: "admin_process_reset_request", request_id: requestId },
  });
  if (error) throw error;
  return data as ProcessResetResult;
}

export async function adminResetStudentPassword(
  studentUserId: string,
): Promise<ProcessResetResult> {
  const { data, error } = await supabase.functions.invoke("password-reset-otp", {
    body: { action: "admin_reset_student", student_user_id: studentUserId, force_change: true },
  });
  if (error) throw error;
  return data as ProcessResetResult;
}

export async function submitStudentPasswordResetRequest(
  admissionNumber: string,
): Promise<{ ok: boolean; message?: string; rate_limited?: boolean; already_pending?: boolean }> {
  const { data, error } = await supabase.functions.invoke("password-reset-otp", {
    body: { action: "student_request_reset", admission_number: admissionNumber },
  });
  if (error) throw error;
  return data as { ok: boolean; message?: string; rate_limited?: boolean; already_pending?: boolean };
}

export function resetStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "None";
  }
}

export function resetStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "destructive";
    case "processing":
      return "secondary";
    case "completed":
      return "default";
    default:
      return "outline";
  }
}
