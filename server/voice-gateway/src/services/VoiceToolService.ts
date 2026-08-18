import { type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger.js";

export type ToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type ToolExecutionContext = {
  db: SupabaseClient;
  schoolId: string;
  callId: string;
  callerPhone?: string;
  verified: boolean;
  verifiedStudentId?: string | null;
  verifiedParentId?: string | null;
};

export type ToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  escalate?: boolean;
  escalationReason?: string;
  actionCreated?: boolean;
  hangUp?: boolean;
  transferNumber?: string;
};

export const STANDARD_VOICE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    name: "verify_caller_identity",
    description: "Verify caller identity against school records using phone or admission number.",
    parameters: {
      type: "object",
      properties: {
        admission_number: { type: "string", description: "Student admission number" },
        student_name: { type: "string", description: "Student name" },
      },
    },
  },
  {
    type: "function",
    name: "get_student_info",
    description: "Get enrolled student class and profile. Requires verification.",
    parameters: {
      type: "object",
      properties: {
        student_id: { type: "string", description: "Optional student ID" },
      },
    },
  },
  {
    type: "function",
    name: "get_attendance_summary",
    description: "Get 30-day attendance rates and absence counts. Requires verification.",
    parameters: {
      type: "object",
      properties: {
        student_id: { type: "string" },
      },
    },
  },
  {
    type: "function",
    name: "get_fee_balance",
    description: "Get outstanding fee balance and invoice status. Requires verification.",
    parameters: {
      type: "object",
      properties: {
        student_id: { type: "string" },
      },
    },
  },
  {
    type: "function",
    name: "get_academic_grades",
    description: "Get recent examination and term grades. Requires verification.",
    parameters: {
      type: "object",
      properties: {
        student_id: { type: "string" },
        subject: { type: "string" },
      },
    },
  },
  {
    type: "function",
    name: "report_student_absence",
    description: "Record student absence or sick note for class teacher.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Reason for absence" },
        expected_date: { type: "string", description: "Date of absence" },
      },
      required: ["reason"],
    },
  },
  {
    type: "function",
    name: "schedule_meeting",
    description: "Request a meeting with class teacher or school administration.",
    parameters: {
      type: "object",
      properties: {
        requested_with: { type: "string" },
        preferred_time: { type: "string" },
        topic: { type: "string" },
      },
      required: ["topic"],
    },
  },
  {
    type: "function",
    name: "search_knowledge_base",
    description: "Search school policy, tuition, uniform, and term date articles.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "transfer_to_human",
    description: "Transfer the caller to a live human representative.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
        urgency: { type: "string" },
      },
      required: ["reason"],
    },
  },
  {
    type: "function",
    name: "end_call",
    description: "Conclude and hang up the phone call politely.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
    },
  },
];

export class VoiceToolService {
  public static async executeTool(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    const { db, schoolId, callId, callerPhone, verified, verifiedStudentId } = ctx;
    logger.info(`Executing tool: ${name}`, { callId, schoolId, data: args });

    try {
      switch (name) {
        case "verify_caller_identity": {
          const admissionNo = typeof args.admission_number === "string" ? args.admission_number.trim() : null;
          const studentName = typeof args.student_name === "string" ? args.student_name.trim() : null;

          let matchedStudent: { id: string; full_name: string; admission_no: string | null } | null = null;
          let matchedParentId: string | null = null;

          if (callerPhone) {
            const digits = callerPhone.replace(/\D/g, "").slice(-9);
            const { data: profiles } = await db
              .from("profiles")
              .select("id, full_name, phone")
              .eq("school_id", schoolId)
              .not("phone", "is", null);

            const match = (profiles ?? []).find(
              (p: { phone?: string | null }) => (p.phone ?? "").replace(/\D/g, "").slice(-9) === digits,
            );

            if (match) {
              matchedParentId = match.id;
              const { data: links } = await db
                .from("parent_student_links")
                .select("student:students(id, full_name, admission_no)")
                .eq("parent_id", match.id);

              const list = (links ?? []).map((l: { student?: unknown }) => l.student).filter(Boolean) as Array<{
                id: string;
                full_name: string;
                admission_no: string | null;
              }>;

              if (list.length > 0) matchedStudent = list[0];
            }
          }

          if (!matchedStudent && (admissionNo || studentName)) {
            let q = db.from("students").select("id, full_name, admission_no, guardian_id").eq("school_id", schoolId);
            if (admissionNo) q = q.ilike("admission_no", `%${admissionNo}%`);
            else if (studentName) q = q.ilike("full_name", `%${studentName}%`);

            const { data: rows } = await q.limit(1);
            if (rows && rows.length > 0) {
              const r = rows[0] as { id: string; full_name: string; admission_no: string | null; guardian_id?: string | null };
              matchedStudent = { id: r.id, full_name: r.full_name, admission_no: r.admission_no };
              matchedParentId = r.guardian_id ?? null;
            }
          }

          if (matchedStudent) {
            await db
              .from("ai_calls")
              .update({
                is_verified: true,
                student_id: matchedStudent.id,
                parent_id: matchedParentId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", callId);

            return {
              success: true,
              data: {
                verified: true,
                student_name: matchedStudent.full_name,
                admission_number: matchedStudent.admission_no,
              },
            };
          }

          return { success: false, error: "Caller identity could not be verified." };
        }

        case "get_attendance_summary": {
          const studentId = (typeof args.student_id === "string" ? args.student_id : null) || verifiedStudentId;
          if (!studentId || !verified) {
            return { success: false, error: "Caller identity not verified for student records." };
          }

          const since = new Date();
          since.setDate(since.getDate() - 30);

          const { data: rows } = await db
            .from("attendance")
            .select("status, date")
            .eq("student_id", studentId)
            .gte("date", since.toISOString().slice(0, 10));

          const list = rows ?? [];
          const present = list.filter((r: { status: string }) => r.status === "present").length;
          const absent = list.filter((r: { status: string }) => r.status === "absent").length;
          const late = list.filter((r: { status: string }) => r.status === "late").length;
          const rate = list.length ? Math.round((present / list.length) * 100) : 100;

          return {
            success: true,
            data: { present, absent, late, rate, total_days: list.length },
          };
        }

        case "get_fee_balance": {
          const studentId = (typeof args.student_id === "string" ? args.student_id : null) || verifiedStudentId;
          if (!studentId || !verified) {
            return { success: false, error: "Caller identity not verified for fee information." };
          }

          const { data: invoices } = await db
            .from("invoices")
            .select("total_amount, amount_paid, status, due_date")
            .eq("student_id", studentId)
            .neq("status", "cancelled");

          const list = invoices ?? [];
          const billed = list.reduce((a, c: { total_amount?: number }) => a + Number(c.total_amount ?? 0), 0);
          const paid = list.reduce((a, c: { amount_paid?: number }) => a + Number(c.amount_paid ?? 0), 0);
          const balance = Math.max(0, billed - paid);

          return {
            success: true,
            data: { outstanding_balance: balance, is_paid: balance <= 0 },
          };
        }

        case "get_academic_grades": {
          const studentId = (typeof args.student_id === "string" ? args.student_id : null) || verifiedStudentId;
          if (!studentId || !verified) {
            return { success: false, error: "Caller identity not verified for academic grades." };
          }

          const { data: grades } = await db
            .from("grades")
            .select("score, subject:subjects(name)")
            .eq("student_id", studentId)
            .order("created_at", { ascending: false })
            .limit(6);

          const list = (grades ?? []) as Array<{ score?: number; subject?: { name?: string } }>;
          return {
            success: true,
            data: { grades: list.map((g) => ({ subject: g.subject?.name ?? "Subject", score: g.score })) },
          };
        }

        case "report_student_absence": {
          const reason = String(args.reason ?? "Absence reported via phone");
          const date = typeof args.expected_date === "string" ? args.expected_date : new Date().toISOString().slice(0, 10);

          await db.from("ai_actions").insert({
            school_id: schoolId,
            call_id: callId,
            action_type: "attendance_alert",
            title: `Absence reported: ${reason.slice(0, 100)}`,
            description: `Date: ${date}. Reason: ${reason}`,
            assigned_department: "Class teacher",
            status: "pending",
          });

          return { success: true, actionCreated: true, data: { status: "recorded", date } };
        }

        case "schedule_meeting": {
          const topic = String(args.topic ?? "Meeting request");
          const requestedWith = String(args.requested_with ?? "Administration");

          await db.from("ai_actions").insert({
            school_id: schoolId,
            call_id: callId,
            action_type: "meeting_request",
            title: `Meeting requested with ${requestedWith}`,
            description: `Topic: ${topic}`,
            assigned_department: requestedWith,
            status: "pending",
          });

          return { success: true, actionCreated: true, data: { status: "pending_confirmation" } };
        }

        case "search_knowledge_base": {
          const text = String(args.query ?? "").toLowerCase();
          const { data: articles } = await db
            .from("ai_knowledge_base")
            .select("title, content, keywords")
            .eq("school_id", schoolId)
            .eq("is_published", true)
            .eq("is_archived", false);

          const rows = articles ?? [];
          let best: { content: string } | null = null;
          let bestScore = 0;

          for (const row of rows) {
            let score = 0;
            const title = (row.title ?? "").toLowerCase();
            const keywords: string[] = row.keywords ?? [];
            for (const kw of keywords) {
              if (kw && text.includes(kw.toLowerCase())) score += 3;
            }
            if (title && text.includes(title)) score += 2;
            if (score > bestScore) {
              bestScore = score;
              best = { content: row.content };
            }
          }

          if (best && bestScore >= 2) {
            return { success: true, data: { answer: best.content } };
          }
          return { success: true, data: { answer: null, message: "No article found." } };
        }

        case "transfer_to_human": {
          const reason = String(args.reason ?? "Caller requested human assistance");
          const { data: vs } = await db.from("ai_voice_settings").select("support_number").eq("school_id", schoolId).maybeSingle();
          const { data: va } = await db.from("ai_voice_agents").select("handover_phone").eq("school_id", schoolId).maybeSingle();
          const target = va?.handover_phone || vs?.support_number || process.env.VOICE_SUPPORT_NUMBER;

          await db.from("ai_escalations").insert({
            school_id: schoolId,
            call_id: callId,
            reason,
            urgency: "normal",
            status: "open",
          });

          await db.from("ai_calls").update({ status: "escalated", escalated: true, escalation_reason: reason }).eq("id", callId);

          return { success: true, escalate: true, escalationReason: reason, transferNumber: target };
        }

        case "end_call": {
          return { success: true, hangUp: true, data: { status: "ended" } };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      logger.error(`Error in tool execution ${name}`, { error: String(err) });
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
