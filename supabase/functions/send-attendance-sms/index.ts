import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARKESEL_URL = "https://sms.arkesel.com/api/v2/sms/send";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits.length >= 10 ? digits : null;
}

function formatTimeIn(timeIn: string | null): string {
  if (!timeIn) return "--";
  const [h, m] = timeIn.split(":");
  const hour = parseInt(h ?? "0", 10);
  const min = m ?? "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${min}${ampm}`;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

function buildMessage(opts: {
  parentSalutation: string;
  studentName: string;
  className: string;
  status: string;
  dateLabel: string;
  timeIn: string | null;
  schoolName: string;
}): string | null {
  const s = opts.status.toLowerCase();
  const school = opts.schoolName.toUpperCase().slice(0, 11);

  if (s === "absent" || s === "sick") {
    return `Hello ${opts.parentSalutation},

Your child ${opts.studentName} of ${opts.className} was marked ${s === "sick" ? "SICK" : "ABSENT"} today in school.

Date: ${opts.dateLabel}

- ${school}`;
  }
  if (s === "late") {
    return `Hello ${opts.parentSalutation},

Your child ${opts.studentName} of ${opts.className} arrived LATE to school today.

Time In: ${formatTimeIn(opts.timeIn)}

- ${school}`;
  }
  if (s === "present") {
    return `Hello ${opts.parentSalutation},

Your child ${opts.studentName} of ${opts.className} was marked PRESENT today.

Date: ${opts.dateLabel}

- ${school}`;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ARKESEL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ARKESEL_API_KEY is not configured on the server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { registerId } = await req.json();
    if (!registerId) {
      return new Response(JSON.stringify({ error: "registerId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("class_registers")
      .select(
        "id, school_id, class_id, register_date, status, classes(name), schools(name, school_name)",
      )
      .eq("id", registerId)
      .maybeSingle();

    if (regErr || !reg) {
      return new Response(JSON.stringify({ error: "Register not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schoolId = reg.school_id as string;
    const className = (reg.classes as { name?: string })?.name ?? "Class";
    const schoolRow = reg.schools as { name?: string; school_name?: string } | null;
    const schoolName = schoolRow?.name ?? schoolRow?.school_name ?? "School";

    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("sms_sender_id, sms_notify_absent, sms_notify_late, sms_notify_present")
      .eq("school_id", schoolId)
      .maybeSingle();

    const senderId = (
      (settings as { sms_sender_id?: string } | null)?.sms_sender_id?.trim() ||
      schoolName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11) ||
      "School"
    ).slice(0, 11);

    const notifyAbsent = (settings as { sms_notify_absent?: boolean } | null)?.sms_notify_absent !== false;
    const notifyLate = (settings as { sms_notify_late?: boolean } | null)?.sms_notify_late !== false;
    const notifyPresent = (settings as { sms_notify_present?: boolean } | null)?.sms_notify_present === true;

    const { data: entries, error: entErr } = await supabaseAdmin
      .from("register_student_entries")
      .select(
        "student_id, attendance_status, time_in, students(id, gender, guardian_id, profiles(full_name))",
      )
      .eq("register_id", registerId);

    if (entErr) throw entErr;

    const dateLabel = formatDate(reg.register_date as string);
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const entry of entries ?? []) {
      const status = (entry.attendance_status as string)?.toLowerCase() ?? "";
      const shouldNotify =
        (notifyAbsent && (status === "absent" || status === "sick" || status === "excused")) ||
        (notifyLate && status === "late") ||
        (notifyPresent && status === "present");

      if (!shouldNotify) {
        skipped++;
        continue;
      }

      const student = entry.students as {
        id: string;
        guardian_id?: string | null;
        profiles?: { full_name?: string };
      } | null;

      const studentName = student?.profiles?.full_name ?? "Student";

      let parent: {
        id: string;
        phone?: string | null;
        emergency_contact?: string | null;
        profiles?: { full_name?: string };
      } | null = null;

      if (student?.guardian_id) {
        const { data: pRow } = await supabaseAdmin
          .from("parents")
          .select("id, phone, emergency_contact, profiles:user_id(full_name)")
          .eq("id", student.guardian_id)
          .maybeSingle();
        parent = pRow as typeof parent;
      }
      const phoneRaw = parent?.phone ?? parent?.emergency_contact ?? "";
      const phone = normalizePhone(phoneRaw);
      if (!phone) {
        skipped++;
        continue;
      }

      const parentName = parent?.profiles?.full_name ?? "Parent";
      const salutation = parentName.includes(" ") ? `Mr/Mrs ${parentName.split(" ").pop()}` : "Parent";

      const message = buildMessage({
        parentSalutation: salutation,
        studentName,
        className,
        status,
        dateLabel,
        timeIn: entry.time_in as string | null,
        schoolName,
      });

      if (!message) {
        skipped++;
        continue;
      }

      const logRow = {
        school_id: schoolId,
        student_id: student?.id ?? entry.student_id,
        parent_id: parent?.id ?? null,
        register_id: registerId,
        phone_number: phone,
        message,
        sms_status: "queued",
      };

      const { data: logInsert } = await supabaseAdmin.from("sms_logs").insert(logRow).select("id").single();

      try {
        const res = await fetch(ARKESEL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": apiKey },
          body: JSON.stringify({ sender: senderId, message, recipients: [phone] }),
        });
        const body = await res.json().catch(() => ({}));
        const ok = res.ok;
        if (logInsert?.id) {
          await supabaseAdmin
            .from("sms_logs")
            .update({
              sms_status: ok ? "sent" : "failed",
              provider_response: body,
            })
            .eq("id", logInsert.id);
        }
        if (ok) sent++;
        else errors.push(`${studentName}: ${JSON.stringify(body)}`);
      } catch (e) {
        if (logInsert?.id) {
          await supabaseAdmin
            .from("sms_logs")
            .update({ sms_status: "failed", provider_response: { error: String(e) } })
            .eq("id", logInsert.id);
        }
        errors.push(`${studentName}: ${String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ sent, skipped, errors: errors.slice(0, 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-attendance-sms:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
