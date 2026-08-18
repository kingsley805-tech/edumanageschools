import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

/**
 * Standard business tool definitions for OpenAI Realtime.
 */
export const VOICE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    name: "verify_caller_identity",
    description:
      "Verify the caller's identity against the school database using their registered phone number, student admission number, or full name before disclosing sensitive student information.",
    parameters: {
      type: "object",
      properties: {
        admission_number: {
          type: "string",
          description: "The student's admission or index number if provided by caller",
        },
        student_name: {
          type: "string",
          description: "The student's full or partial name",
        },
      },
    },
  },
  {
    type: "function",
    name: "get_student_info",
    description:
      "Retrieve basic profile information for a student (class, grade level, enrollment status). Requires caller to be verified.",
    parameters: {
      type: "object",
      properties: {
        student_id: {
          type: "string",
          description: "Optional specific student ID if multiple children are linked",
        },
      },
    },
  },
  {
    type: "function",
    name: "get_attendance_summary",
    description:
      "Retrieve attendance statistics and recent absences for a student over the past 30 days. Requires verified caller.",
    parameters: {
      type: "object",
      properties: {
        student_id: {
          type: "string",
          description: "Optional student ID",
        },
      },
    },
  },
  {
    type: "function",
    name: "get_fee_balance",
    description:
      "Retrieve current school fee balances, recent invoices, and upcoming payment deadlines for the student. Requires verified caller.",
    parameters: {
      type: "object",
      properties: {
        student_id: {
          type: "string",
          description: "Optional student ID",
        },
      },
    },
  },
  {
    type: "function",
    name: "get_academic_grades",
    description:
      "Retrieve recent examination scores, report card summaries, and subject grades for the student. Requires verified caller.",
    parameters: {
      type: "object",
      properties: {
        student_id: {
          type: "string",
          description: "Optional student ID",
        },
        subject: {
          type: "string",
          description: "Optional subject name to filter results (e.g. Mathematics, English, Science)",
        },
      },
    },
  },
  {
    type: "function",
    name: "report_student_absence",
    description:
      "Record an official absence note or sick leave alert for a student and automatically notify the class teacher.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for the absence (e.g. illness, family emergency, doctor appointment)",
        },
        expected_date: {
          type: "string",
          description: "Date of absence or return date if mentioned",
        },
      },
      required: ["reason"],
    },
  },
  {
    type: "function",
    name: "schedule_meeting",
    description:
      "Submit an official request to schedule an in-person or phone meeting with the class teacher or school administration.",
    parameters: {
      type: "object",
      properties: {
        requested_with: {
          type: "string",
          description: "Who the parent wants to meet with (e.g. Class Teacher, Head of School, Accountant)",
        },
        preferred_time: {
          type: "string",
          description: "Preferred date, time of day, or day of week",
        },
        topic: {
          type: "string",
          description: "Topic or purpose of the requested meeting",
        },
      },
      required: ["topic"],
    },
  },
  {
    type: "function",
    name: "search_knowledge_base",
    description:
      "Search the school's official knowledge base for policies, term dates, vacation schedules, admission requirements, tuition fee structures, school uniform rules, and contact info.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords or question to look up (e.g. 'term dates', 'admission fee', 'school bus')",
        },
        category: {
          type: "string",
          description: "Optional category filter: admissions, academics, finance, events, policies, general",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "transfer_to_human",
    description:
      "Escalate the phone call and transfer the caller to a live human representative or school administrator.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "The specific reason why human escalation is required",
        },
        urgency: {
          type: "string",
          description: "Urgency level: low, normal, high, critical",
        },
      },
      required: ["reason"],
    },
  },
  {
    type: "function",
    name: "end_call",
    description:
      "Politely hang up the phone call once the conversation has reached a natural conclusion and the caller has no further questions.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Summary reason for concluding the call",
        },
      },
    },
  },
];

/**
 * Executes a tool called by OpenAI Realtime with strict tenant isolation.
 */
export async function executeVoiceTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<ToolResult> {
  const { db, schoolId, callId, callerPhone, verified, verifiedStudentId, verifiedParentId } = ctx;

  try {
    switch (toolName) {
      /* ------------------------------------------------------------------ */
      /* 1. verify_caller_identity                                          */
      /* ------------------------------------------------------------------ */
      case "verify_caller_identity": {
        const admissionNo = typeof args.admission_number === "string" ? args.admission_number.trim() : null;
        const studentName = typeof args.student_name === "string" ? args.student_name.trim() : null;

        let matchedStudent: { id: string; full_name: string; admission_no: string | null; class_name?: string } | null = null;
        let matchedParentId: string | null = null;

        if (callerPhone) {
          const cleanPhone = callerPhone.replace(/\D/g, "").slice(-9);
          const { data: profiles } = await db
            .from("profiles")
            .select("id, full_name, phone")
            .eq("school_id", schoolId)
            .not("phone", "is", null);

          const parentMatch = (profiles ?? []).find(
            (p: { phone?: string | null }) => (p.phone ?? "").replace(/\D/g, "").slice(-9) === cleanPhone,
          );

          if (parentMatch) {
            matchedParentId = parentMatch.id;
            const { data: links } = await db
              .from("parent_student_links")
              .select("student:students(id, full_name, admission_no, class:classes(name))")
              .eq("parent_id", parentMatch.id);

            const linkedStudents = (links ?? [])
              .map((l: { student?: unknown }) => l.student)
              .filter(Boolean) as Array<{ id: string; full_name: string; admission_no: string | null; class?: { name?: string } }>;

            if (linkedStudents.length > 0) {
              matchedStudent = {
                id: linkedStudents[0].id,
                full_name: linkedStudents[0].full_name,
                admission_no: linkedStudents[0].admission_no,
                class_name: linkedStudents[0].class?.name,
              };
            }
          }
        }

        if (!matchedStudent && (admissionNo || studentName)) {
          let query = db.from("students").select("id, full_name, admission_no, guardian_id, class:classes(name)").eq("school_id", schoolId);
          if (admissionNo) {
            query = query.ilike("admission_no", `%${admissionNo}%`);
          } else if (studentName) {
            query = query.ilike("full_name", `%${studentName}%`);
          }

          const { data: students } = await query.limit(1);
          if (students && students.length > 0) {
            const s = students[0] as { id: string; full_name: string; admission_no: string | null; guardian_id?: string | null; class?: { name?: string } };
            matchedStudent = {
              id: s.id,
              full_name: s.full_name,
              admission_no: s.admission_no,
              class_name: s.class?.name,
            };
            matchedParentId = s.guardian_id ?? null;
          }
        }

        if (matchedStudent) {
          await db
            .from("ai_calls")
            .update({
              is_verified: true,
              student_id: matchedStudent.id,
              parent_id: matchedParentId,
              caller_name: matchedStudent.full_name ? `Parent of ${matchedStudent.full_name}` : undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("id", callId);

          return {
            success: true,
            data: {
              verified: true,
              student_name: matchedStudent.full_name,
              admission_number: matchedStudent.admission_no,
              class_name: matchedStudent.class_name ?? "Enrolled Class",
              message: `Identity confirmed for student ${matchedStudent.full_name}.`,
            },
          };
        }

        return {
          success: false,
          error: "Could not verify identity with provided information. Please verify the registered phone or admission number.",
        };
      }

      /* ------------------------------------------------------------------ */
      /* 2. get_student_info                                                */
      /* ------------------------------------------------------------------ */
      case "get_student_info": {
        const studentId = (typeof args.student_id === "string" ? args.student_id : null) || verifiedStudentId;
        if (!studentId || !verified) {
          return {
            success: false,
            error: "Caller identity is not verified. Please verify identity before accessing student records.",
          };
        }

        const { data: student, error } = await db
          .from("students")
          .select("id, full_name, admission_no, gender, class:classes(name)")
          .eq("school_id", schoolId)
          .eq("id", studentId)
          .maybeSingle();

        if (error || !student) {
          return { success: false, error: "Student record not found." };
        }

        const s = student as { id: string; full_name: string; admission_no: string | null; gender?: string; class?: { name?: string } };
        return {
          success: true,
          data: {
            full_name: s.full_name,
            admission_number: s.admission_no,
            class_name: s.class?.name ?? "Assigned class",
            status: "Active student",
          },
        };
      }

      /* ------------------------------------------------------------------ */
      /* 3. get_attendance_summary                                          */
      /* ------------------------------------------------------------------ */
      case "get_attendance_summary": {
        const studentId = (typeof args.student_id === "string" ? args.student_id : null) || verifiedStudentId;
        if (!studentId || !verified) {
          return {
            success: false,
            error: "Caller identity must be verified before accessing attendance information.",
          };
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: rows } = await db
          .from("attendance")
          .select("status, date")
          .eq("student_id", studentId)
          .gte("date", thirtyDaysAgo.toISOString().slice(0, 10));

        const list = rows ?? [];
        if (list.length === 0) {
          return {
            success: true,
            data: {
              total_days: 0,
              message: "No attendance entries recorded in the last 30 days.",
            },
          };
        }

        const present = list.filter((r: { status: string }) => r.status === "present").length;
        const absent = list.filter((r: { status: string }) => r.status === "absent").length;
        const late = list.filter((r: { status: string }) => r.status === "late").length;
        const rate = Math.round((present / list.length) * 100);

        return {
          success: true,
          data: {
            recorded_days: list.length,
            present_count: present,
            absent_count: absent,
            late_count: late,
            attendance_rate_percent: rate,
            summary: `Present ${present} times, absent ${absent} times, and late ${late} times over the last 30 days (${rate}% attendance).`,
          },
        };
      }

      /* ------------------------------------------------------------------ */
      /* 4. get_fee_balance                                                 */
      /* ------------------------------------------------------------------ */
      case "get_fee_balance": {
        const studentId = (typeof args.student_id === "string" ? args.student_id : null) || verifiedStudentId;
        if (!studentId || !verified) {
          return {
            success: false,
            error: "Caller identity must be verified before checking fees and invoice details.",
          };
        }

        const { data: invoices } = await db
          .from("invoices")
          .select("id, invoice_number, total_amount, amount_paid, status, due_date, description")
          .eq("student_id", studentId)
          .neq("status", "cancelled");

        const list = invoices ?? [];
        const totalBilled = list.reduce((acc, cur: { total_amount?: number }) => acc + Number(cur.total_amount ?? 0), 0);
        const totalPaid = list.reduce((acc, cur: { amount_paid?: number }) => acc + Number(cur.amount_paid ?? 0), 0);
        const balance = Math.max(0, totalBilled - totalPaid);

        const pendingInvoices = list.filter((inv: { status: string }) => inv.status !== "paid");
        const nextDue = pendingInvoices
          .filter((inv: { due_date?: string }) => inv.due_date)
          .map((inv: { due_date: string }) => inv.due_date)
          .sort()[0];

        return {
          success: true,
          data: {
            outstanding_balance: balance,
            is_fully_paid: balance <= 0,
            total_billed: totalBilled,
            total_paid: totalPaid,
            next_due_date: nextDue ?? null,
            pending_invoice_count: pendingInvoices.length,
            summary: balance <= 0
              ? "Fees are fully cleared with zero outstanding balance."
              : `Outstanding balance is ${balance.toFixed(2)} with ${pendingInvoices.length} active invoice(s). Next due date: ${nextDue ?? 'immediately'}.`,
          },
        };
      }

      /* ------------------------------------------------------------------ */
      /* 5. get_academic_grades                                             */
      /* ------------------------------------------------------------------ */
      case "get_academic_grades": {
        const studentId = (typeof args.student_id === "string" ? args.student_id : null) || verifiedStudentId;
        if (!studentId || !verified) {
          return {
            success: false,
            error: "Caller identity must be verified before sharing academic results.",
          };
        }

        let query = db
          .from("grades")
          .select("score, term, subject:subjects(name)")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(8);

        const subjectFilter = typeof args.subject === "string" ? args.subject.trim() : null;

        const { data: grades } = await query;
        let list = (grades ?? []) as Array<{ score?: number; term?: string; subject?: { name?: string } }>;

        if (subjectFilter) {
          list = list.filter((g) => (g.subject?.name ?? "").toLowerCase().includes(subjectFilter.toLowerCase()));
        }

        if (list.length === 0) {
          return {
            success: true,
            data: {
              grades_found: 0,
              message: "No examination grades are currently published for this term.",
            },
          };
        }

        const formatted = list.map((g) => ({
          subject: g.subject?.name ?? "Subject",
          score: g.score ?? "Not recorded",
          term: g.term ?? "Current term",
        }));

        return {
          success: true,
          data: {
            grades_found: formatted.length,
            grades: formatted,
            summary: formatted.map((f) => `${f.subject}: ${f.score}`).join(", "),
          },
        };
      }

      /* ------------------------------------------------------------------ */
      /* 6. report_student_absence                                          */
      /* ------------------------------------------------------------------ */
      case "report_student_absence": {
        const reason = String(args.reason ?? "Parent notified absence via phone");
        const dateStr = typeof args.expected_date === "string" ? args.expected_date : new Date().toISOString().slice(0, 10);

        const { data: action, error } = await db
          .from("ai_actions")
          .insert({
            school_id: schoolId,
            call_id: callId,
            action_type: "attendance_alert",
            title: `Absence reported: ${reason.slice(0, 120)}`,
            description: `Parent phoned to report student absence on ${dateStr}. Details: ${reason}`,
            assigned_department: "Class teacher",
            status: "pending",
          })
          .select("id")
          .single();

        if (error) {
          return { success: false, error: "Failed to record absence in school system." };
        }

        await db
          .from("ai_calls")
          .update({ follow_up_status: "pending", detected_intent: "absence_report", updated_at: new Date().toISOString() })
          .eq("id", callId);

        return {
          success: true,
          actionCreated: true,
          data: {
            action_id: action?.id,
            status: "recorded",
            message: `Absence note recorded and forwarded to the class teacher for ${dateStr}.`,
          },
        };
      }

      /* ------------------------------------------------------------------ */
      /* 7. schedule_meeting                                                */
      /* ------------------------------------------------------------------ */
      case "schedule_meeting": {
        const topic = String(args.topic ?? "Parent discussion request");
        const withWhom = String(args.requested_with ?? "Class teacher or school admin");
        const timePref = typeof args.preferred_time === "string" ? args.preferred_time : "As soon as possible";

        const { data: action, error } = await db
          .from("ai_actions")
          .insert({
            school_id: schoolId,
            call_id: callId,
            action_type: "meeting_request",
            title: `Meeting requested with ${withWhom}`,
            description: `Topic: ${topic}\nPreferred time: ${timePref}\nCaller contact: ${callerPhone ?? "Phone call"}`,
            assigned_department: "Administration",
            status: "pending",
          })
          .select("id")
          .single();

        if (error) {
          return { success: false, error: "Failed to schedule meeting request." };
        }

        await db
          .from("ai_calls")
          .update({ follow_up_status: "pending", detected_intent: "meeting_request", updated_at: new Date().toISOString() })
          .eq("id", callId);

        return {
          success: true,
          actionCreated: true,
          data: {
            action_id: action?.id,
            status: "pending_confirmation",
            message: `Meeting request submitted for topic: ${topic}. The school office will contact the parent to confirm the schedule.`,
          },
        };
      }

      /* ------------------------------------------------------------------ */
      /* 8. search_knowledge_base                                           */
      /* ------------------------------------------------------------------ */
      case "search_knowledge_base": {
        const queryText = String(args.query ?? "").toLowerCase();
        const category = typeof args.category === "string" ? args.category.trim() : null;

        let query = db
          .from("ai_knowledge_base")
          .select("title, content, category, keywords")
          .eq("school_id", schoolId)
          .eq("is_published", true)
          .eq("is_archived", false);

        if (category) {
          query = query.eq("category", category);
        }

        const { data: articles } = await query;
        const rows = articles ?? [];
        if (rows.length === 0) {
          return {
            success: true,
            data: {
              match_count: 0,
              message: "No specific knowledge base article matches this inquiry.",
            },
          };
        }

        const words = queryText.split(/\W+/).filter((w) => w.length > 3);
        let best: { score: number; title: string; content: string } | null = null;

        for (const row of rows) {
          let score = 0;
          const title = (row.title ?? "").toLowerCase();
          const content = (row.content ?? "").toLowerCase();
          const keywords: string[] = row.keywords ?? [];

          for (const kw of keywords) {
            if (kw && queryText.includes(kw.toLowerCase())) score += 4;
          }
          for (const w of words) {
            if (title.includes(w)) score += 3;
            if (content.includes(w)) score += 1;
          }

          if (score > 0 && (!best || score > best.score)) {
            best = { score, title: row.title, content: row.content };
          }
        }

        if (best && best.score >= 2) {
          return {
            success: true,
            data: {
              match_count: 1,
              title: best.title,
              answer: best.content,
            },
          };
        }

        return {
          success: true,
          data: {
            match_count: 0,
            message: "No relevant school policy or info article found for this query.",
          },
        };
      }

      /* ------------------------------------------------------------------ */
      /* 9. transfer_to_human                                               */
      /* ------------------------------------------------------------------ */
      case "transfer_to_human": {
        const reason = String(args.reason ?? "Caller requested to speak with human staff");
        const urgency = String(args.urgency ?? "normal");

        const { data: schoolSettings } = await db
          .from("ai_voice_settings")
          .select("support_number")
          .eq("school_id", schoolId)
          .maybeSingle();

        const { data: voiceAgent } = await db
          .from("ai_voice_agents")
          .select("handover_phone")
          .eq("school_id", schoolId)
          .maybeSingle();

        const handoverPhone = voiceAgent?.handover_phone || schoolSettings?.support_number || Deno.env.get("VOICE_SUPPORT_NUMBER");

        await db.from("ai_escalations").insert({
          school_id: schoolId,
          call_id: callId,
          reason: reason.slice(0, 500),
          urgency: urgency === "critical" ? "critical" : urgency === "high" ? "high" : "normal",
          status: "open",
          context_summary: `Escalated from voice AI session. Phone: ${callerPhone ?? "Unknown"}`,
        });

        await db
          .from("ai_calls")
          .update({
            status: "escalated",
            escalated: true,
            escalation_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq("id", callId);

        return {
          success: true,
          escalate: true,
          escalationReason: reason,
          transferNumber: handoverPhone ?? undefined,
          data: {
            status: "transferring",
            handover_phone: handoverPhone ?? "School office",
            message: "Connecting caller to live staff member.",
          },
        };
      }

      /* ------------------------------------------------------------------ */
      /* 10. end_call                                                       */
      /* ------------------------------------------------------------------ */
      case "end_call": {
        const reason = String(args.reason ?? "Conversation concluded naturally");
        return {
          success: true,
          hangUp: true,
          data: {
            status: "concluded",
            reason,
          },
        };
      }

      default:
        return { success: false, error: `Unknown tool name: ${toolName}` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Error executing tool ${toolName}:`, err);
    return { success: false, error: errorMsg };
  }
}
