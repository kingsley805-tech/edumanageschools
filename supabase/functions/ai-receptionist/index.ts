import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  attendanceSummary,
  buildSystemPrompt,
  detectIntent,
  detectSentiment,
  feesSummary,
  gradesSummary,
  knowledgeAnswer,
  llmReply,
  PRIVATE_INTENTS,
  serviceClient,
  shouldEscalate,
  verifyCaller,
  type Speaker,
  type TurnRequest,
} from "../_shared/aiReceptionist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as TurnRequest;
    const { schoolId, callerPhone, utterance = "", event = "caller_spoke" } = body;

    if (!schoolId) return json({ error: "schoolId is required" }, 400);

    const db = serviceClient();

    const [{ data: school }, { data: agent }, { data: settings }] = await Promise.all([
      db.from("schools").select("name").eq("id", schoolId).maybeSingle(),
      db.from("ai_voice_agents").select("*").eq("school_id", schoolId).maybeSingle(),
      db.from("ai_voice_settings").select("*").eq("school_id", schoolId).maybeSingle(),
    ]);

    const schoolName = school?.name ?? "our school";
    const agentName = agent?.name ?? "Emma";
    const isActive = agent?.is_active ?? true;
    const answersEnabled = settings?.is_enabled ?? true;

    if (!isActive || !answersEnabled) {
      return json({ error: "AI receptionist is not enabled for this school" }, 409);
    }

    const caller = await verifyCaller(db, schoolId, callerPhone);

    /* ------------------------------------------------------------------ */
    /* Call start                                                          */
    /* ------------------------------------------------------------------ */
    if (event === "call_started") {
      const greeting =
        agent?.greeting?.trim() ||
        `Thank you for calling ${schoolName}. My name is ${agentName}, the school's virtual assistant. How may I assist you today?`;

      const { data: call } = await db
        .from("ai_calls")
        .insert({
          school_id: schoolId,
          direction: "inbound",
          status: "in_progress",
          caller_phone: callerPhone ?? null,
          caller_name: caller.callerName,
          student_id: caller.students[0]?.id ?? null,
          is_verified: caller.verified,
          started_at: new Date().toISOString(),
          language: body.language ?? "en",
        })
        .select("id")
        .single();

      if (call?.id) {
        await db.from("ai_call_transcripts").insert({
          call_id: call.id,
          speaker: "ai" as Speaker,
          content: greeting,
          sequence_no: 1,
        });
      }

      return json({
        callId: call?.id ?? null,
        reply: greeting,
        intent: "greeting",
        verified: caller.verified,
        shouldEscalate: false,
        shouldHangUp: false,
      });
    }

    const callId = body.callId;
    if (!callId) return json({ error: "callId is required" }, 400);

    /* ------------------------------------------------------------------ */
    /* Call end                                                            */
    /* ------------------------------------------------------------------ */
    if (event === "call_ended") {
      const { data: lines } = await db
        .from("ai_call_transcripts")
        .select("speaker, content")
        .eq("call_id", callId)
        .order("sequence_no");

      const transcript = (lines ?? [])
        .map((l: { speaker: string; content: string }) => `${l.speaker}: ${l.content}`)
        .join("\n");

      const summary =
        (await llmReply(
          "Summarise this school phone call in two sentences. State the caller's request and any action the school must take.",
          [],
          transcript,
        )) ?? "Call completed.";

      await db
        .from("ai_calls")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          duration_seconds: body.durationSeconds ?? 0,
          summary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", callId);

      return json({ callId, reply: "", intent: "call_ended", verified: caller.verified });
    }

    /* ------------------------------------------------------------------ */
    /* Conversation turn                                                   */
    /* ------------------------------------------------------------------ */
    const intent = detectIntent(utterance);
    const sentiment = detectSentiment(utterance);
    const escalate = shouldEscalate(utterance, agent?.escalation_keywords ?? []);

    const { data: history } = await db
      .from("ai_call_transcripts")
      .select("speaker, content, sequence_no")
      .eq("call_id", callId)
      .order("sequence_no");

    const nextSeq = (history?.length ?? 0) + 1;

    await db.from("ai_call_transcripts").insert({
      call_id: callId,
      speaker: "caller" as Speaker,
      content: utterance,
      sequence_no: nextSeq,
    });

    let reply: string | null = null;
    let hangUp = false;

    if (escalate) {
      reply =
        "I understand this is important. Let me connect you to a member of our school staff right away. Please hold the line.";

      await db.from("ai_escalations").insert({
        school_id: schoolId,
        call_id: callId,
        reason: utterance.slice(0, 500),
        urgency: /emergency|ambulance|accident|suicide|abuse/i.test(utterance) ? "critical" : "high",
        status: "open",
        context_summary: `Caller ${caller.callerName ?? callerPhone ?? "unknown"} requires human assistance.`,
      });

      await db
        .from("ai_calls")
        .update({ status: "escalated", updated_at: new Date().toISOString() })
        .eq("id", callId);
    } else if (PRIVATE_INTENTS.has(intent) && !caller.verified) {
      reply =
        "I can certainly help with that. For the security of our students, I first need to verify your identity. " +
        "Could you please confirm the phone number registered with the school?";
    } else if (PRIVATE_INTENTS.has(intent) && caller.verified) {
      const student = caller.students[0];
      if (!student) {
        reply = "I could not find a student linked to your record. Let me transfer you to the school office.";
      } else if (intent === "attendance_inquiry") {
        reply = await attendanceSummary(db, student.id, student.full_name);
      } else if (intent === "fees_inquiry") {
        reply = await feesSummary(db, student.id, student.full_name);
      } else if (intent === "grades_inquiry" || intent === "report_inquiry") {
        reply = await gradesSummary(db, student.id, student.full_name);
      }
    }

    if (!reply) {
      reply = await knowledgeAnswer(db, schoolId, utterance);
    }

    if (!reply) {
      reply = await llmReply(
        buildSystemPrompt(schoolName, agentName, caller.verified),
        (history ?? []) as { speaker: Speaker; content: string }[],
        utterance,
      );
    }

    if (!reply) {
      reply =
        "I'm sorry, I didn't quite catch that. Could you please rephrase your question, or would you prefer to speak with a member of staff?";
    }

    /* ------------------------------------------------------------------ */
    /* Auto-created follow-up actions                                      */
    /* ------------------------------------------------------------------ */
    if (intent === "absence_report") {
      await db.from("ai_actions").insert({
        school_id: schoolId,
        call_id: callId,
        action_type: "attendance_alert",
        title: `Absence reported for ${caller.students[0]?.full_name ?? "a student"}`,
        description: utterance.slice(0, 500),
        assigned_department: "Class teacher",
        status: "pending",
      });
    } else if (intent === "meeting_request") {
      await db.from("ai_actions").insert({
        school_id: schoolId,
        call_id: callId,
        action_type: "meeting_request",
        title: `Meeting requested by ${caller.callerName ?? callerPhone ?? "a caller"}`,
        description: utterance.slice(0, 500),
        status: "pending",
      });
    }

    await db.from("ai_call_transcripts").insert({
      call_id: callId,
      speaker: "ai" as Speaker,
      content: reply,
      sequence_no: nextSeq + 1,
    });

    await db
      .from("ai_calls")
      .update({
        detected_intent: intent,
        sentiment,
        is_verified: caller.verified,
        student_id: caller.students[0]?.id ?? null,
        caller_name: caller.callerName,
        follow_up_status:
          intent === "absence_report" || intent === "meeting_request" ? "pending" : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", callId);

    return json({
      callId,
      reply,
      intent,
      verified: caller.verified,
      shouldEscalate: escalate,
      shouldHangUp: hangUp,
    });
  } catch (e) {
    console.error("ai-receptionist error", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
