import { supabase } from "@/integrations/supabase/client";

export type RegisterSmsSettings = {
  sms_sender_id: string;
  sms_notify_absent: boolean;
  sms_notify_late: boolean;
  sms_notify_present: boolean;
};

const DEFAULT_SMS_SETTINGS: RegisterSmsSettings = {
  sms_sender_id: "",
  sms_notify_absent: true,
  sms_notify_late: true,
  sms_notify_present: false,
};

export async function fetchRegisterSmsSettings(schoolId: string): Promise<RegisterSmsSettings> {
  const { data, error } = await supabase
    .from("school_settings")
    .select("sms_sender_id, sms_notify_absent, sms_notify_late, sms_notify_present")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (error.code === "42703" || msg.includes("sms_")) return DEFAULT_SMS_SETTINGS;
    throw error;
  }
  return {
    sms_sender_id: (data as { sms_sender_id?: string } | null)?.sms_sender_id ?? "",
    sms_notify_absent: (data as { sms_notify_absent?: boolean } | null)?.sms_notify_absent !== false,
    sms_notify_late: (data as { sms_notify_late?: boolean } | null)?.sms_notify_late !== false,
    sms_notify_present: (data as { sms_notify_present?: boolean } | null)?.sms_notify_present === true,
  };
}

export async function saveRegisterSmsSettings(schoolId: string, settings: RegisterSmsSettings) {
  const payload = {
    school_id: schoolId,
    sms_sender_id: settings.sms_sender_id.trim() || null,
    sms_notify_absent: settings.sms_notify_absent,
    sms_notify_late: settings.sms_notify_late,
    sms_notify_present: settings.sms_notify_present,
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
  const { data, error } = await supabase.functions.invoke("send-attendance-sms", {
    body: { registerId },
  });
  if (error) throw error;
  return data as { sent?: number; skipped?: number; errors?: string[] };
}

export async function listSmsLogs(schoolId: string, limit = 50) {
  const { data, error } = await supabase
    .from("sms_logs")
    .select("id, phone_number, message, sms_status, sent_at, students(profiles(full_name))")
    .eq("school_id", schoolId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return data ?? [];
}
