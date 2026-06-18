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

export type AttendanceSmsSendResult = {
  ok?: boolean;
  sent?: number;
  skipped?: number;
  errors?: string[] | unknown;
  error?: string;
  message?: string;
};

async function sendAttendanceSmsViaRpc(registerId: string): Promise<AttendanceSmsSendResult | null> {
  const { data, error } = await supabase.rpc("send_attendance_sms_for_register", {
    p_register_id: registerId,
  });
  if (error) {
    const missing =
      error.code === "42883" ||
      error.code === "PGRST202" ||
      (error.message ?? "").includes("send_attendance_sms_for_register");
    if (missing) return null;
    throw error;
  }
  const result = (data ?? {}) as AttendanceSmsSendResult;
  if (result.error) throw new Error(result.error);
  return result;
}

export async function sendAttendanceSmsNotifications(registerId: string) {
  const rpc = await sendAttendanceSmsViaRpc(registerId);
  if (rpc) return rpc;
  return invokeEdgeFunction<AttendanceSmsSendResult>("send-attendance-sms", { registerId });
}

const TEACHER_ATTENDANCE_PERIOD = "Teacher Attendance";

async function prepareTeacherAttendanceSmsRegisterClient(classId: string, dateStr: string): Promise<string> {
  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("school_id, class_teacher_id")
    .eq("id", classId)
    .single();
  if (clsErr || !cls) throw new Error("Class not found");

  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Please sign in again");

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .eq("school_id", cls.school_id)
    .maybeSingle();

  let teacherId = teacherRow?.id ?? cls.class_teacher_id;
  if (!teacherId) {
    const { data: anyTeacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("school_id", cls.school_id)
      .limit(1)
      .maybeSingle();
    teacherId = anyTeacher?.id ?? null;
  }
  if (!teacherId) throw new Error("No teacher profile found for SMS");

  const { data: classSubject } = await supabase
    .from("class_subjects")
    .select("subject_id")
    .eq("class_id", classId)
    .limit(1)
    .maybeSingle();

  let subjectId = classSubject?.subject_id;
  if (!subjectId) {
    const { data: attSubject } = await supabase
      .from("subjects")
      .select("id")
      .eq("school_id", cls.school_id)
      .eq("code", "_ATT_SMS")
      .maybeSingle();
    subjectId = attSubject?.id;
  }
  if (!subjectId) {
    const { data: anySubject } = await supabase
      .from("subjects")
      .select("id")
      .eq("school_id", cls.school_id)
      .limit(1)
      .maybeSingle();
    subjectId = anySubject?.id;
  }
  if (!subjectId) {
    throw new Error("No subject found for this class. Assign a subject to the class or contact your admin.");
  }

  const { data: registerId, error: regErr } = await supabase.rpc("create_or_get_class_register", {
    p_school_id: cls.school_id,
    p_class_id: classId,
    p_subject_id: subjectId,
    p_teacher_id: teacherId,
    p_register_date: dateStr,
    p_period_label: TEACHER_ATTENDANCE_PERIOD,
  });
  if (regErr) throw regErr;
  if (!registerId) throw new Error("Could not prepare SMS register");

  const { data: attendanceRows, error: attErr } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("class_id", classId)
    .eq("date", dateStr);
  if (attErr) throw attErr;

  const entries = (attendanceRows ?? []).map((row) => ({
    student_id: row.student_id,
    attendance_status: row.status,
  }));

  if (entries.length > 0) {
    const { error: upsertErr } = await supabase.rpc("upsert_register_entries", {
      p_register_id: registerId,
      p_entries: entries,
    });
    if (upsertErr) throw upsertErr;
  }

  return String(registerId);
}

export function describeAttendanceSmsResult(result: AttendanceSmsSendResult): {
  variant: "success" | "destructive" | "default";
  title: string;
  description: string;
} | null {
  const sent = result?.sent ?? 0;
  const rawErrors = result?.errors ?? [];
  const errors = Array.isArray(rawErrors) ? rawErrors.map(String) : [];
  const skipped = result?.skipped ?? 0;

  if (errors.length > 0) {
    return {
      variant: "destructive",
      title: sent > 0 ? "Attendance saved — SMS partially failed" : "Attendance saved — SMS failed",
      description: errors.slice(0, 3).join("; "),
    };
  }
  if (sent > 0) {
    return {
      variant: "success",
      title: "Parent SMS sent",
      description: `${sent} notification${sent === 1 ? "" : "s"} sent to parents.`,
    };
  }
  if (result?.message) {
    return {
      variant: "default",
      title: "Attendance saved — no SMS sent",
      description: String(result.message),
    };
  }
  if (skipped > 0) {
    return {
      variant: "default",
      title: "Attendance saved — no SMS sent",
      description:
        "No parent SMS was sent. Mark absent/late (or enable Present in Register Settings), and ensure the parent phone is linked.",
    };
  }
  return null;
}

/** Fire-and-forget parent SMS after teacher attendance page save. */
export async function sendTeacherAttendanceSmsNotifications(classId: string, date: string) {
  const dateStr = date.slice(0, 10);

  const { data, error } = await supabase.rpc("send_teacher_attendance_sms", {
    p_class_id: classId,
    p_date: dateStr,
  });

  if (!error && data) {
    const result = data as AttendanceSmsSendResult;
    if (result.error) throw new Error(result.error);
    return result;
  }

  const missingTeacherRpc =
    error &&
    (error.code === "42883" ||
      error.code === "PGRST202" ||
      (error.message ?? "").includes("send_teacher_attendance_sms"));

  if (!missingTeacherRpc && error) throw error;

  let registerId: string;

  const { data: rpcRegisterId, error: prepError } = await supabase.rpc(
    "prepare_teacher_attendance_sms_register",
    { p_class_id: classId, p_date: dateStr },
  );

  if (!prepError && rpcRegisterId) {
    registerId = String(rpcRegisterId);
  } else {
    const missingRpc =
      !prepError ||
      prepError.code === "42883" ||
      prepError.code === "PGRST202" ||
      (prepError.message ?? "").includes("prepare_teacher_attendance_sms_register");
    if (!missingRpc) throw prepError;
    registerId = await prepareTeacherAttendanceSmsRegisterClient(classId, dateStr);
  }

  const rpc = await sendAttendanceSmsViaRpc(registerId);
  if (rpc) return rpc;
  return invokeEdgeFunction<AttendanceSmsSendResult>("send-attendance-sms", { registerId });
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
    if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") {
      return listSmsLogsAsAttendanceRows(schoolId, limit);
    }
    throw error;
  }
  if ((data ?? []).length > 0) return data ?? [];
  return listSmsLogsAsAttendanceRows(schoolId, limit);
}

async function listSmsLogsAsAttendanceRows(schoolId: string, limit: number) {
  const { data, error } = await supabase
    .from("sms_logs")
    .select(
      "id, phone_number, message, sms_status, sent_at, register_id, students(full_name, profiles:profile_id(full_name))",
    )
    .eq("school_id", schoolId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    ...row,
    attendance_status: "—",
    attendance_date: row.sent_at?.slice(0, 10) ?? null,
    created_at: row.sent_at,
    error_message: null,
    source: "sms_logs",
  }));
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
