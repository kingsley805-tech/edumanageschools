import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export type RegisterSmsSettings = {
  sms_sender_id: string;
  sms_attendance_enabled: boolean;
  sms_notify_absent: boolean;
  sms_notify_late: boolean;
  sms_notify_present: boolean;
  sms_template_present: string;
  sms_template_absent: string;
  sms_template_late: string;
  sms_template_default: string;
};

export type AttendanceSmsStats = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
};

const DEFAULT_SMS_SETTINGS: RegisterSmsSettings = {
  sms_sender_id: "",
  sms_attendance_enabled: true,
  sms_notify_absent: true,
  sms_notify_late: true,
  sms_notify_present: false,
  sms_template_present: "{school_name}: {student_name} was marked PRESENT on {date}.",
  sms_template_absent:
    "{school_name}: {student_name} was marked {status} on {date}. Please contact the school if necessary.",
  sms_template_late: "{school_name}: {student_name} was marked LATE on {date}.",
  sms_template_default: "{school_name}: {student_name} was marked {status} on {date}.",
};

export async function fetchRegisterSmsSettings(schoolId: string): Promise<RegisterSmsSettings> {
  const { data, error } = await supabase
    .from("school_settings")
    .select(
      "sms_sender_id, sms_attendance_enabled, sms_notify_absent, sms_notify_late, sms_notify_present, sms_template_present, sms_template_absent, sms_template_late, sms_template_default",
    )
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (error.code === "42703" || msg.includes("sms_")) return DEFAULT_SMS_SETTINGS;
    throw error;
  }
  const row = data as Record<string, unknown> | null;
  return {
    sms_sender_id: (row?.sms_sender_id as string | undefined) ?? "",
    sms_attendance_enabled: row?.sms_attendance_enabled !== false,
    sms_notify_absent: row?.sms_notify_absent !== false,
    sms_notify_late: row?.sms_notify_late !== false,
    sms_notify_present: row?.sms_notify_present === true,
    sms_template_present:
      (row?.sms_template_present as string | undefined)?.trim() || DEFAULT_SMS_SETTINGS.sms_template_present,
    sms_template_absent:
      (row?.sms_template_absent as string | undefined)?.trim() || DEFAULT_SMS_SETTINGS.sms_template_absent,
    sms_template_late:
      (row?.sms_template_late as string | undefined)?.trim() || DEFAULT_SMS_SETTINGS.sms_template_late,
    sms_template_default:
      (row?.sms_template_default as string | undefined)?.trim() || DEFAULT_SMS_SETTINGS.sms_template_default,
  };
}

export async function saveRegisterSmsSettings(schoolId: string, settings: RegisterSmsSettings) {
  const payload = {
    school_id: schoolId,
    sms_sender_id: settings.sms_sender_id.trim() || null,
    sms_attendance_enabled: settings.sms_attendance_enabled,
    sms_notify_absent: settings.sms_notify_absent,
    sms_notify_late: settings.sms_notify_late,
    sms_notify_present: settings.sms_notify_present,
    sms_template_present: settings.sms_template_present.trim() || null,
    sms_template_absent: settings.sms_template_absent.trim() || null,
    sms_template_late: settings.sms_template_late.trim() || null,
    sms_template_default: settings.sms_template_default.trim() || null,
  };

  const { data: existing } = await supabase
    .from("school_settings")
    .select("id")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("school_settings").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("school_settings").insert(payload);
    if (error) throw error;
  }
}

export async function sendAttendanceSmsNotifications(registerId: string) {
  return invokeEdgeFunction<{ ok?: boolean; sent?: number; skipped?: number; errors?: string[] }>(
    "send-attendance-sms",
    { registerId },
  );
}

/** Fire-and-forget parent SMS after teacher attendance page save. */
export async function sendTeacherAttendanceSmsNotifications(classId: string, date: string) {
  return invokeEdgeFunction<{ ok?: boolean; sent?: number; skipped?: number; errors?: string[] }>(
    "send-attendance-sms",
    { classId, date: date.slice(0, 10) },
  );
}

export async function listSmsLogs(schoolId: string, limit = 50) {
  const { data, error } = await supabase
    .from("sms_logs")
    .select("id, phone_number, message, sms_status, sent_at, students(full_name, profiles:profile_id(full_name))")
    .eq("school_id", schoolId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return data ?? [];
}

export async function listAttendanceSmsLogs(schoolId: string, limit = 50) {
  const { data, error } = await supabase
    .from("attendance_sms_logs")
    .select(
      "id, phone_number, message, sms_status, error_message, attendance_date, attendance_status, source, created_at, sent_at, students(full_name, profiles:profile_id(full_name))",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") return [];
    throw error;
  }
  return data ?? [];
}

export async function fetchAttendanceSmsStats(schoolId: string): Promise<AttendanceSmsStats> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data, error } = await supabase
    .from("attendance_sms_logs")
    .select("sms_status")
    .eq("school_id", schoolId)
    .gte("created_at", since.toISOString());
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") {
      return { sent: 0, failed: 0, skipped: 0, total: 0 };
    }
    throw error;
  }
  const rows = data ?? [];
  const sent = rows.filter((r) => r.sms_status === "sent").length;
  const failed = rows.filter((r) => r.sms_status === "failed").length;
  const skipped = rows.filter((r) => r.sms_status === "skipped").length;
  return { sent, failed, skipped, total: rows.length };
}
