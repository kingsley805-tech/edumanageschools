import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger.js";

export type SchoolVoiceProfile = {
  schoolId: string;
  schoolName: string;
  agentName: string;
  greeting: string;
  voice: string;
  model: string;
  systemPrompt?: string;
  temperature: number;
  enabledTools: string[];
  handoverPhone?: string;
  recordingEnabled: boolean;
};

export class VoiceCallService {
  private db: SupabaseClient;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.db = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }

  public getDb(): SupabaseClient {
    return this.db;
  }

  public async getSchoolByPhone(phone: string): Promise<SchoolVoiceProfile | null> {
    const cleanPhone = phone.replace(/[^0-9+]/g, "");

    const { data: rows } = await this.db.rpc("get_school_by_twilio_phone", {
      p_phone: cleanPhone,
    });

    if (Array.isArray(rows) && rows.length > 0) {
      const r = rows[0];
      return {
        schoolId: r.school_id,
        schoolName: r.school_name,
        agentName: r.agent_name || "Emma",
        greeting: r.greeting || `Thank you for calling ${r.school_name}. How may I assist you today?`,
        voice: r.openai_voice || "alloy",
        model: r.openai_model || "gpt-4o-realtime-preview",
        systemPrompt: r.system_prompt,
        temperature: Number(r.temperature ?? 0.8),
        enabledTools: r.enabled_tools || [],
        handoverPhone: r.handover_phone,
        recordingEnabled: r.recording_enabled !== false,
      };
    }

    // Fallback: query schools directly
    const { data: vs } = await this.db
      .from("ai_voice_settings")
      .select("school_id, recording_enabled, schools(id, name), ai_voice_agents(*)")
      .eq("is_enabled", true)
      .limit(1)
      .maybeSingle();

    if (!vs) return null;

    const schoolObj = vs.schools as { id?: string; name?: string } | null;
    const agentObj = vs.ai_voice_agents as {
      name?: string;
      greeting?: string;
      openai_voice?: string;
      openai_model?: string;
      system_prompt?: string;
      temperature?: number;
      enabled_tools?: string[];
      handover_phone?: string;
    } | null;

    return {
      schoolId: vs.school_id,
      schoolName: schoolObj?.name || "School",
      agentName: agentObj?.name || "Emma",
      greeting: agentObj?.greeting || "Thank you for calling. How may I assist you?",
      voice: agentObj?.openai_voice || "alloy",
      model: agentObj?.openai_model || "gpt-4o-realtime-preview",
      systemPrompt: agentObj?.system_prompt,
      temperature: agentObj?.temperature ?? 0.8,
      enabledTools: agentObj?.enabled_tools || [],
      handoverPhone: agentObj?.handover_phone,
      recordingEnabled: vs.recording_enabled !== false,
    };
  }

  public async createCallRecord(params: {
    schoolId: string;
    direction: "inbound" | "outbound";
    callerPhone: string;
    providerCallSid?: string;
    parentCallSid?: string;
    recipientName?: string;
    studentId?: string;
    purpose?: string;
  }): Promise<string | null> {
    const { data, error } = await this.db
      .from("ai_calls")
      .insert({
        school_id: params.schoolId,
        direction: params.direction,
        status: "ringing",
        caller_phone: params.callerPhone,
        caller_name: params.recipientName,
        student_id: params.studentId || null,
        provider_call_sid: params.providerCallSid,
        parent_call_sid: params.parentCallSid,
        started_at: new Date().toISOString(),
        detected_intent: params.purpose,
      })
      .select("id")
      .single();

    if (error) {
      logger.error("Failed to insert call record", { error: error.message });
      return null;
    }
    return data?.id || null;
  }

  public async updateCallStatus(callId: string, updates: Record<string, unknown>): Promise<void> {
    await this.db
      .from("ai_calls")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", callId);
  }

  public async addTranscriptTurn(params: {
    schoolId: string;
    callId: string;
    speaker: "ai" | "caller" | "staff" | "system";
    content: string;
    sequenceNo: number;
  }): Promise<void> {
    await this.db.from("ai_call_transcripts").insert({
      school_id: params.schoolId,
      call_id: params.callId,
      speaker: params.speaker,
      content: params.content,
      sequence_no: params.sequenceNo,
    });
  }
}
