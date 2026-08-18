import WebSocket from "ws";
import { type SupabaseClient } from "@supabase/supabase-js";
import { VoiceToolService, STANDARD_VOICE_TOOLS } from "./VoiceToolService.js";
import { logger } from "../utils/logger.js";

export type RealtimeConfig = {
  apiKey: string;
  model: string;
  voice: string;
  systemPrompt?: string;
  temperature: number;
  schoolName: string;
  agentName: string;
  enabledTools: string[];
  initialGreeting?: string;
  direction: "inbound" | "outbound";
  outboundPurpose?: string;
  outboundContext?: string;
};

export type SessionCallbacks = {
  onAudioDelta: (payloadBase64: string) => void;
  onSpeechStarted: () => void;
  onTranscriptTurn: (speaker: "ai" | "caller", text: string) => void;
  onCallEscalated: (reason: string, transferNumber?: string) => void;
  onCallHangUp: (reason: string) => void;
  onError: (err: Error) => void;
  onClose: () => void;
};

export class OpenAIRealtimeService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private sequenceNo = 0;
  private turns: Array<{ speaker: "ai" | "caller"; text: string }> = [];
  private isVerified = false;

  constructor(
    private config: RealtimeConfig,
    private db: SupabaseClient,
    private schoolId: string,
    private callId: string,
    private callerPhone: string | undefined,
    private callbacks: SessionCallbacks,
  ) {}

  public async connect(): Promise<void> {
    const model = this.config.model || "gpt-4o-realtime-preview";
    const url = `wss://api.openai.com/v1/realtime?model=${model}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "OpenAI-Beta": "realtime=v1",
          },
        });

        this.ws.on("open", () => {
          this.isConnected = true;
          logger.info("Connected to OpenAI Realtime API", { callId: this.callId });
          this.initializeSession();
          resolve();
        });

        this.ws.on("message", async (data: WebSocket.RawData) => {
          try {
            const raw = data.toString("utf-8");
            const msg = JSON.parse(raw);
            await this.handleMessage(msg);
          } catch (err) {
            logger.error("Error parsing OpenAI message", { error: String(err) });
          }
        });

        this.ws.on("error", (err: Error) => {
          logger.error("OpenAI WebSocket error", { error: err.message });
          this.callbacks.onError(err);
          reject(err);
        });

        this.ws.on("close", (code, reason) => {
          this.isConnected = false;
          logger.info("OpenAI WebSocket closed", { callId: this.callId, data: { code, reason: reason.toString() } });
          this.callbacks.onClose();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public sendAudioChunk(base64Payload: string): void {
    if (!this.ws || !this.isConnected) return;
    this.send({
      type: "input_audio_buffer.append",
      audio: base64Payload,
    });
  }

  public async close(): Promise<void> {
    if (this.ws && this.isConnected) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.isConnected = false;
    await this.generateCallSummary();
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private initializeSession(): void {
    const { schoolName, agentName, voice = "alloy", temperature = 0.8, enabledTools } = this.config;

    const tools = enabledTools && enabledTools.length > 0
      ? STANDARD_VOICE_TOOLS.filter((t) => enabledTools.includes(t.name))
      : STANDARD_VOICE_TOOLS;

    const prompt = this.buildPrompt(schoolName, agentName);

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

    if (this.config.direction === "outbound") {
      const purpose = this.config.outboundPurpose || "a school notification";
      const context = this.config.outboundContext ? `Details: ${this.config.outboundContext}` : "";
      this.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `The parent answered the phone. Greet them and explain you are calling from ${schoolName} regarding ${purpose}. ${context}`,
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
              text: `Speak this opening greeting naturally: "${this.config.initialGreeting}"`,
            },
          ],
        },
      });
      this.send({ type: "response.create" });
    }
  }

  private buildPrompt(schoolName: string, agentName: string): string {
    if (this.config.systemPrompt && this.config.systemPrompt.trim().length > 20) {
      return this.config.systemPrompt
        .replace(/\{school_name\}/g, schoolName)
        .replace(/\{assistant_name\}/g, agentName)
        .replace(/\{caller_phone\}/g, this.callerPhone || "Unknown");
    }

    return [
      `You are ${agentName}, the virtual voice receptionist for ${schoolName}.`,
      "You are on a live phone call. Speak in natural, warm, and concise spoken sentences (1-3 sentences).",
      "Protect private student data by requiring identity verification using `verify_caller_identity` before sharing grades, attendance, or fees.",
      "Execute tools for queries and confirm actions smoothly.",
      "If the caller asks for a human or the issue is urgent, call `transfer_to_human`.",
    ].join("\n");
  }

  private async handleMessage(msg: Record<string, unknown>): Promise<void> {
    const type = String(msg.type ?? "");

    switch (type) {
      case "response.audio.delta": {
        const delta = msg.delta as string;
        if (delta) this.callbacks.onAudioDelta(delta);
        break;
      }

      case "input_audio_buffer.speech_started": {
        this.callbacks.onSpeechStarted();
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const text = String(msg.transcript ?? "").trim();
        if (text) await this.recordTurn("caller", text);
        break;
      }

      case "response.audio_transcript.done": {
        const text = String(msg.transcript ?? "").trim();
        if (text) await this.recordTurn("ai", text);
        break;
      }

      case "response.function_call_arguments.done": {
        const callId = String(msg.call_id ?? "");
        const toolName = String(msg.name ?? "");
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(String(msg.arguments ?? "{}"));
        } catch {
          args = {};
        }

        const result = await VoiceToolService.executeTool(toolName, args, {
          db: this.db,
          schoolId: this.schoolId,
          callId: this.callId,
          callerPhone: this.callerPhone,
          verified: this.isVerified,
        });

        if (toolName === "verify_caller_identity" && result.success) {
          this.isVerified = true;
        }

        this.send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(result.data || { success: result.success, error: result.error }),
          },
        });
        this.send({ type: "response.create" });

        if (result.escalate) {
          this.callbacks.onCallEscalated(result.escalationReason || "Escalated", result.transferNumber);
        }
        if (result.hangUp) {
          setTimeout(() => this.callbacks.onCallHangUp("Concluded naturally"), 3500);
        }
        break;
      }
    }
  }

  private async recordTurn(speaker: "ai" | "caller", text: string): Promise<void> {
    this.sequenceNo++;
    this.turns.push({ speaker, text });
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
      logger.error("Failed to save transcript turn", { error: String(err) });
    }
  }

  private async generateCallSummary(): Promise<void> {
    if (this.turns.length === 0) return;

    const transcript = this.turns.map((t) => `${t.speaker === "ai" ? "AI" : "Caller"}: ${t.text}`).join("\n");
    let summary = "Call completed.";

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
            { role: "system", content: "Summarize this phone conversation in 2 concise sentences." },
            { role: "user", content: transcript },
          ],
          max_tokens: 150,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content?.trim();
        if (text) summary = text;
      }
    } catch {
      // fallback
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
      logger.error("Failed to update call summary", { error: String(err) });
    }
  }
}
