import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { executeVoiceTool, VOICE_TOOLS, type ToolDefinition } from "./voiceTools.ts";

export type RealtimeSessionConfig = {
  apiKey: string;
  model?: string;
  voice?: string;
  systemPrompt?: string;
  temperature?: number;
  schoolName: string;
  agentName: string;
  enabledTools?: string[];
  initialGreeting?: string;
  direction?: "inbound" | "outbound";
  outboundPurpose?: string;
  outboundContext?: string;
};

export type RealtimeCallbacks = {
  onAudioDelta: (audioBase64: string) => void;
  onSpeechStarted: () => void;
  onTranscriptTurn: (speaker: "ai" | "caller", text: string) => void;
  onCallEscalated: (reason: string, transferNumber?: string) => void;
  onCallHangUp: (reason: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
};

export class OpenAIRealtimeSession {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private transcriptTurns: Array<{ speaker: "ai" | "caller"; text: string; time: string }> = [];
  private sequenceNo = 0;
  private currentFunctionCall: { callId: string; name: string; args: string } | null = null;
  private isVerified = false;
  private studentId: string | null = null;
  private parentId: string | null = null;

  constructor(
    private config: RealtimeSessionConfig,
    private db: SupabaseClient,
    private schoolId: string,
    private callId: string,
    private callerPhone: string | undefined,
    private callbacks: RealtimeCallbacks,
  ) {}

  public async connect(): Promise<void> {
    const model = this.config.model || "gpt-4o-realtime-preview";
    const url = `wss://api.openai.com/v1/realtime?model=${model}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "OpenAI-Beta": "realtime=v1",
    };

    try {
      // In Deno / standard WebSocket implementations:
      // WebSocket supports headers or subprotocols
      const subprotocols = ["realtime", `openai-insecure-api-key.${this.config.apiKey}`, "openai-beta.realtime-v1"];

      // Try creating WebSocket connection
      try {
        // Deno allows custom headers in WebSocket when available, or protocols
        this.ws = new (WebSocket as unknown as new (u: string, p: string[] | { headers: Record<string, string> }) => WebSocket)(
          url,
          { headers },
        );
      } catch {
        this.ws = new WebSocket(url, subprotocols);
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.initializeSession();
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        try {
          const raw = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
          const message = JSON.parse(raw);
          await this.handleOpenAiMessage(message);
        } catch (err) {
          console.error("Error processing OpenAI Realtime message:", err);
        }
      };

      this.ws.onerror = (evt: Event) => {
        console.error("OpenAI Realtime WebSocket error:", evt);
        this.callbacks.onError(new Error("OpenAI Realtime WebSocket encountered an error"));
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.callbacks.onClose();
      };
    } catch (err) {
      console.error("Failed to connect to OpenAI Realtime:", err);
      this.callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Forwards incoming caller audio payload from Twilio to OpenAI.
   */
  public sendAudioChunk(base64Payload: string): void {
    if (!this.ws || !this.isConnected) return;
    this.send({
      type: "input_audio_buffer.append",
      audio: base64Payload,
    });
  }

  /**
   * Closes the session and saves final transcript and AI summary.
   */
  public async close(): Promise<void> {
    if (this.ws && this.isConnected) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.isConnected = false;
    await this.finalizeCallSummary();
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private initializeSession(): void {
    const { schoolName, agentName, voice = "alloy", temperature = 0.8, enabledTools } = this.config;

    const tools: ToolDefinition[] = enabledTools && enabledTools.length > 0
      ? VOICE_TOOLS.filter((t) => enabledTools.includes(t.name))
      : VOICE_TOOLS;

    const prompt = this.buildSystemPrompt(schoolName, agentName);

    // 1. Configure session
    this.send({
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        instructions: prompt,
        voice,
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        },
        tools,
        tool_choice: "auto",
        temperature,
      },
    });

    // 2. Trigger initial greeting
    if (this.config.direction === "outbound") {
      const purpose = this.config.outboundPurpose || "a school notification";
      const context = this.config.outboundContext ? `Context details: ${this.config.outboundContext}` : "";
      this.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `The parent has just picked up the phone. Greet them warmly and state that you are calling from ${schoolName} regarding ${purpose}. ${context}`,
            },
          ],
        },
      });
      this.send({ type: "response.create" });
    } else if (this.config.initialGreeting) {
      this.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `A caller has just connected to ${schoolName}. Speak this exact greeting naturally: "${this.config.initialGreeting}"`,
            },
          ],
        },
      });
      this.send({ type: "response.create" });
    }
  }

  private buildSystemPrompt(schoolName: string, agentName: string): string {
    if (this.config.systemPrompt && this.config.systemPrompt.trim().length > 20) {
      return this.config.systemPrompt
        .replace(/\{school_name\}/g, schoolName)
        .replace(/\{assistant_name\}/g, agentName)
        .replace(/\{caller_phone\}/g, this.callerPhone ?? "Unknown");
    }

    return [
      `You are ${agentName}, the professional AI voice receptionist and virtual assistant for ${schoolName}.`,
      "You are speaking live on a real telephone call with a parent, student, or visitor.",
      "CONVERSATIONAL GUIDELINES:",
      "- Speak naturally, politely, clearly, and concisely (1-3 sentences per turn).",
      "- Use a warm, professional, human customer service tone.",
      "- Avoid long lists or unnecessary verbosity on the phone.",
      "- Never invent policies, dates, fees, or exam grades. If unsure, look them up using your tools or offer to connect them with staff.",
      "SECURITY & PRIVACY RULES:",
      "- Private student data (attendance, fees, report cards, exam grades) is sensitive. If the caller asks for private records and is not verified, politely ask for the student's admission number or registered details and call the `verify_caller_identity` tool.",
      "- Once identity is verified, you may look up attendance, fee balances, and grades.",
      "TOOL CALLING:",
      "- Always use the designated tools to look up information or perform school actions (report absence, schedule meetings, search policies).",
      "- When an action is recorded, confirm it concisely to the caller.",
      "HUMAN ESCALATION:",
      "- If the caller asks for a human, expresses urgent anger, reports an emergency, or has a complex request you cannot answer, use the `transfer_to_human` tool.",
      "- Never mention internal technical terms like 'JSON', 'API', 'tool call', or 'large language model'.",
    ].join("\n");
  }

  private async handleOpenAiMessage(message: Record<string, unknown>): Promise<void> {
    const type = String(message.type ?? "");

    switch (type) {
      /* Audio chunk generated by OpenAI assistant */
      case "response.audio.delta": {
        const delta = message.delta as string;
        if (delta) {
          this.callbacks.onAudioDelta(delta);
        }
        break;
      }

      /* Caller speech detected (Interruption / Barge-in) */
      case "input_audio_buffer.speech_started": {
        this.callbacks.onSpeechStarted();
        break;
      }

      /* Caller's transcription completed */
      case "conversation.item.input_audio_transcription.completed": {
        const transcript = String(message.transcript ?? "").trim();
        if (transcript) {
          await this.saveTranscriptTurn("caller", transcript);
        }
        break;
      }

      /* Assistant's audio transcription completed */
      case "response.audio_transcript.done": {
        const transcript = String(message.transcript ?? "").trim();
        if (transcript) {
          await this.saveTranscriptTurn("ai", transcript);
        }
        break;
      }

      /* Tool call arguments stream start / delta */
      case "response.function_call_arguments.delta": {
        // Accumulating if necessary
        break;
      }

      /* Tool call execution triggered */
      case "response.function_call_arguments.done": {
        const callId = String(message.call_id ?? "");
        const name = String(message.name ?? "");
        const rawArgs = String(message.arguments ?? "{}");

        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(rawArgs);
        } catch {
          parsedArgs = {};
        }

        await this.handleToolExecution(callId, name, parsedArgs);
        break;
      }

      case "error": {
        console.error("OpenAI Realtime error event:", message.error);
        break;
      }
    }
  }

  private async handleToolExecution(callId: string, toolName: string, args: Record<string, unknown>): Promise<void> {
    // Log tool invocation
    await this.db.from("ai_conversation_logs").insert({
      school_id: this.schoolId,
      call_id: this.callId,
      event_type: "tool_call",
      payload: { tool: toolName, arguments: args, call_id: callId },
    });

    const result = await executeVoiceTool(toolName, args, {
      db: this.db,
      schoolId: this.schoolId,
      callId: this.callId,
      callerPhone: this.callerPhone,
      verified: this.isVerified,
      verifiedStudentId: this.studentId,
      verifiedParentId: this.parentId,
    });

    if (toolName === "verify_caller_identity" && result.success && (result.data as { verified?: boolean })?.verified) {
      this.isVerified = true;
    }

    // Send function call output back to OpenAI
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result.data || { success: result.success, error: result.error }),
      },
    });

    // Request assistant to respond based on tool output
    this.send({
      type: "response.create",
    });

    if (result.escalate) {
      this.callbacks.onCallEscalated(result.escalationReason || "Escalated by assistant", result.transferNumber);
    }

    if (result.hangUp) {
      setTimeout(() => {
        this.callbacks.onCallHangUp("Call concluded naturally.");
      }, 3500);
    }
  }

  private async saveTranscriptTurn(speaker: "ai" | "caller", text: string): Promise<void> {
    this.sequenceNo++;
    this.transcriptTurns.push({ speaker, text, time: new Date().toISOString() });
    this.callbacks.onTranscriptTurn(speaker, text);

    try {
      await this.db.from("ai_call_transcripts").insert({
        school_id: this.schoolId,
        call_id: this.callId,
        speaker,
        content: text,
        sequence_no: this.sequenceNo,
      });
    } catch (err) {
      console.error("Failed to insert transcript turn:", err);
    }
  }

  private async finalizeCallSummary(): Promise<void> {
    if (this.transcriptTurns.length === 0) return;

    const fullTranscript = this.transcriptTurns
      .map((t) => `${t.speaker === "ai" ? "Assistant" : "Caller"}: ${t.text}`)
      .join("\n");

    let summary = "Phone call completed.";

    // Generate concise summary using OpenAI Chat Completion if API key exists
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an assistant summarizing school telephone calls. Provide a concise 2-sentence summary of the caller's request, actions taken, and any required follow-ups.",
            },
            { role: "user", content: fullTranscript },
          ],
          max_tokens: 150,
          temperature: 0.5,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content?.trim();
        if (text) summary = text;
      }
    } catch (err) {
      console.warn("Could not generate summary via OpenAI API:", err);
    }

    try {
      await this.db
        .from("ai_calls")
        .update({
          summary,
          status: "completed",
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", this.callId);
    } catch (err) {
      console.error("Failed to save call summary:", err);
    }
  }
}
