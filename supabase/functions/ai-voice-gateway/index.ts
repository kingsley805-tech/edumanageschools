/// <reference path="../deno-shim.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  generateStreamTwiML,
  generateTransferTwiML,
  makeTwilioOutboundCall,
  updateTwilioCall,
  validateTwilioSignature,
} from "../_shared/twilioVoice.ts";
import { OpenAIRealtimeSession } from "../_shared/openAIRealtime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function getDbClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

function xmlResponse(twiml: string, status = 200): Response {
  return new Response(twiml, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const db = getDbClient();
  const defaultOpenAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const defaultTwilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

  /* ======================================================================== */
  /* 1. WebSocket Upgrade for Twilio Media Streams                             */
  /* ======================================================================== */
  if (req.headers.get("upgrade") === "websocket") {
    try {
      const { socket, response } = Deno.upgradeWebSocket(req);

      let streamSid = "";
      let callSid = "";
      let schoolId = url.searchParams.get("schoolId") || "";
      let callId = url.searchParams.get("callId") || "";
      let direction: "inbound" | "outbound" = (url.searchParams.get("direction") as "inbound" | "outbound") || "inbound";
      let callerPhone = url.searchParams.get("from") || "";
      let realtimeSession: OpenAIRealtimeSession | null = null;

      socket.onopen = () => {
        console.log(`[MediaStream] Twilio WebSocket opened for callId: ${callId}`);
      };

      socket.onmessage = async (e: MessageEvent) => {
        try {
          const raw = typeof e.data === "string" ? e.data : await (e.data as Blob).text();
          const msg = JSON.parse(raw);

          switch (msg.event) {
            /* Twilio Stream Start */
            case "start": {
              streamSid = msg.start.streamSid;
              callSid = msg.start.callSid;
              const customParams = msg.start.customParameters || {};

              schoolId = schoolId || customParams.schoolId || "";
              callId = callId || customParams.callId || "";
              direction = (customParams.direction as "inbound" | "outbound") || direction;

              console.log(`[MediaStream] Stream started. streamSid=${streamSid}, callSid=${callSid}, schoolId=${schoolId}`);

              // Fetch school settings and voice persona
              let schoolName = "our school";
              let agentName = "Emma";
              let voice = "alloy";
              let model = Deno.env.get("OPENAI_REALTIME_MODEL") || "gpt-4o-realtime-preview";
              let systemPrompt: string | undefined;
              let greeting = "Thank you for calling. How may I assist you today?";
              let enabledTools: string[] | undefined;

              if (schoolId) {
                const [{ data: school }, { data: agent }, { data: settings }] = await Promise.all([
                  db.from("schools").select("name").eq("id", schoolId).maybeSingle(),
                  db.from("ai_voice_agents").select("*").eq("school_id", schoolId).maybeSingle(),
                  db.from("ai_voice_settings").select("*").eq("school_id", schoolId).maybeSingle(),
                ]);

                schoolName = school?.name || schoolName;
                if (agent) {
                  agentName = agent.name || agentName;
                  voice = agent.openai_voice || agent.voice_style || voice;
                  model = agent.openai_model || model;
                  systemPrompt = agent.system_prompt;
                  greeting = agent.greeting || greeting;
                  enabledTools = agent.enabled_tools;
                }
              }

              // Initialize OpenAI Realtime session
              realtimeSession = new OpenAIRealtimeSession(
                {
                  apiKey: defaultOpenAiKey,
                  model,
                  voice,
                  systemPrompt,
                  schoolName,
                  agentName,
                  enabledTools,
                  initialGreeting: greeting,
                  direction,
                  outboundPurpose: customParams.purpose,
                  outboundContext: customParams.context,
                },
                db,
                schoolId,
                callId,
                callerPhone,
                {
                  onAudioDelta: (audioBase64) => {
                    // Stream audio back to Twilio
                    if (socket.readyState === WebSocket.OPEN && streamSid) {
                      socket.send(
                        JSON.stringify({
                          event: "media",
                          streamSid,
                          media: { payload: audioBase64 },
                        }),
                      );
                    }
                  },
                  onSpeechStarted: () => {
                    // Barge-in / Interruption: clear pending Twilio audio buffer
                    if (socket.readyState === WebSocket.OPEN && streamSid) {
                      socket.send(
                        JSON.stringify({
                          event: "clear",
                          streamSid,
                        }),
                      );
                    }
                  },
                  onTranscriptTurn: (speaker, text) => {
                    console.log(`[Transcript] ${speaker}: ${text}`);
                  },
                  onCallEscalated: async (reason, transferNumber) => {
                    console.log(`[Escalation] Call escalated: ${reason}`);
                    if (transferNumber && callSid) {
                      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
                      const authToken = defaultTwilioAuthToken;
                      if (accountSid && authToken) {
                        const transferTwiml = generateTransferTwiML({
                          targetPhone: transferNumber,
                          transferMessage: "Please hold while we transfer your call to a staff member.",
                        });
                        await updateTwilioCall({ accountSid, authToken, callSid, twiml: transferTwiml });
                      }
                    }
                  },
                  onCallHangUp: async (reason) => {
                    console.log(`[HangUp] Ending call: ${reason}`);
                    if (callSid) {
                      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
                      const authToken = defaultTwilioAuthToken;
                      if (accountSid && authToken) {
                        await updateTwilioCall({ accountSid, authToken, callSid, status: "completed" });
                      }
                    }
                  },
                  onError: (err) => {
                    console.error("[Realtime Error]", err);
                  },
                  onClose: () => {
                    console.log("[Realtime Closed]");
                  },
                },
              );

              await realtimeSession.connect();

              // Update call status to in_progress
              if (callId) {
                await db
                  .from("ai_calls")
                  .update({
                    status: "in_progress",
                    provider_call_sid: callSid,
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", callId);
              }
              break;
            }

            /* Twilio Media Audio Chunk */
            case "media": {
              if (realtimeSession && msg.media?.payload) {
                realtimeSession.sendAudioChunk(msg.media.payload);
              }
              break;
            }

            /* Twilio Stream Stop */
            case "stop": {
              console.log(`[MediaStream] Stream stopped: ${streamSid}`);
              if (realtimeSession) {
                await realtimeSession.close();
                realtimeSession = null;
              }
              break;
            }
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };

      socket.onclose = async () => {
        console.log(`[MediaStream] WebSocket closed for callId: ${callId}`);
        if (realtimeSession) {
          await realtimeSession.close();
          realtimeSession = null;
        }
      };

      return response;
    } catch (err) {
      console.error("Failed to upgrade WebSocket:", err);
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
  }

  /* ======================================================================== */
  /* 2. Inbound Voice Webhook (POST / or POST /incoming)                       */
  /* ======================================================================== */
  if (req.method === "POST" && (pathname.endsWith("/incoming") || pathname.endsWith("/ai-voice-gateway") || pathname === "/")) {
    try {
      const formData = await req.formData();
      const params: Record<string, string> = {};
      for (const [k, v] of formData.entries()) {
        params[k] = typeof v === "string" ? v : v.name;
      }

      const twilioSignature = req.headers.get("x-twilio-signature");
      const callSid = params.CallSid || "";
      const toPhone = params.To || "";
      const fromPhone = params.From || "";

      // Optional signature verification
      if (defaultTwilioAuthToken && twilioSignature) {
        const isValid = await validateTwilioSignature(defaultTwilioAuthToken, twilioSignature, req.url, params);
        if (!isValid) {
          console.warn("Twilio signature validation failed for URL:", req.url);
        }
      }

      // Resolve school from dialed phone number
      const { data: schoolMatch } = await db.rpc("get_school_by_twilio_phone", { p_phone: toPhone });
      const matched = Array.isArray(schoolMatch) && schoolMatch.length > 0 ? schoolMatch[0] : null;

      let schoolId = matched?.school_id || url.searchParams.get("schoolId");

      if (!schoolId) {
        // Fallback: lookup first school with voice settings enabled
        const { data: fallback } = await db
          .from("ai_voice_settings")
          .select("school_id")
          .eq("is_enabled", true)
          .limit(1)
          .maybeSingle();
        schoolId = fallback?.school_id || null;
      }

      // Create new call record in database
      let callId: string | null = null;
      if (schoolId) {
        const { data: callRecord } = await db
          .from("ai_calls")
          .insert({
            school_id: schoolId,
            direction: "inbound",
            status: "ringing",
            caller_phone: fromPhone,
            provider_call_sid: callSid,
            started_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        callId = callRecord?.id || null;
      }

      // Determine WebSocket stream URL
      const host = req.headers.get("host") || url.host;
      const proto = req.headers.get("x-forwarded-proto") === "http" ? "ws" : "wss";
      const streamWsUrl = `${proto}://${host}${pathname}?schoolId=${schoolId ?? ""}&callId=${callId ?? ""}&from=${encodeURIComponent(fromPhone)}`;

      const recordingEnabled = matched?.recording_enabled ?? true;

      const twiml = generateStreamTwiML({
        streamUrl: streamWsUrl,
        schoolId: schoolId ?? undefined,
        callId: callId ?? undefined,
        direction: "inbound",
        record: recordingEnabled,
      });

      return xmlResponse(twiml);
    } catch (err) {
      console.error("Error processing inbound call webhook:", err);
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Thank you for calling. Our virtual assistant is currently unavailable. Please call back shortly.</Say>
</Response>`;
      return xmlResponse(fallbackTwiml, 500);
    }
  }

  /* ======================================================================== */
  /* 3. Twilio Status Callback (POST /status)                                  */
  /* ======================================================================== */
  if (req.method === "POST" && pathname.endsWith("/status")) {
    try {
      const formData = await req.formData();
      const params: Record<string, string> = {};
      for (const [k, v] of formData.entries()) {
        params[k] = typeof v === "string" ? v : v.name;
      }

      const callSid = params.CallSid;
      const callStatus = params.CallStatus;
      const durationSeconds = parseInt(params.CallDuration || "0", 10);
      const recordingUrl = params.RecordingUrl;

      if (callSid) {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (callStatus === "completed") {
          updates.status = "completed";
          updates.ended_at = new Date().toISOString();
        } else if (callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed") {
          updates.status = callStatus === "no-answer" ? "missed" : "failed";
          updates.ended_at = new Date().toISOString();
        }

        if (durationSeconds > 0) updates.duration_seconds = durationSeconds;
        if (recordingUrl) updates.recording_url = recordingUrl;

        await db.from("ai_calls").update(updates).eq("provider_call_sid", callSid);
      }

      return jsonResponse({ ok: true });
    } catch (err) {
      console.error("Error handling Twilio status callback:", err);
      return jsonResponse({ error: String(err) }, 500);
    }
  }

  /* ======================================================================== */
  /* 4. Trigger Outbound AI Call (POST /outbound)                              */
  /* ======================================================================== */
  if (req.method === "POST" && pathname.endsWith("/outbound")) {
    try {
      const body = await req.json();
      const {
        schoolId,
        toPhone,
        studentId,
        purpose = "general_notification",
        context = "",
        recipientName = "",
      } = body;

      if (!schoolId || !toPhone) {
        return jsonResponse({ error: "schoolId and toPhone are required" }, 400);
      }

      const [{ data: settings }, { data: agent }] = await Promise.all([
        db.from("ai_voice_settings").select("*").eq("school_id", schoolId).maybeSingle(),
        db.from("ai_voice_agents").select("*").eq("school_id", schoolId).maybeSingle(),
      ]);

      const accountSid = settings?.twilio_account_sid || Deno.env.get("TWILIO_ACCOUNT_SID") || "";
      const authToken = defaultTwilioAuthToken;
      const fromPhone = settings?.twilio_phone_number || Deno.env.get("TWILIO_PHONE_NUMBER") || "";

      if (!accountSid || !authToken || !fromPhone) {
        return jsonResponse({ error: "Twilio telephony is not configured for outbound calls." }, 400);
      }

      // Create outbound call record in database
      const { data: callRecord, error: callErr } = await db
        .from("ai_calls")
        .insert({
          school_id: schoolId,
          direction: "outbound",
          status: "ringing",
          caller_phone: fromPhone,
          caller_name: recipientName || "Parent",
          student_id: studentId || null,
          started_at: new Date().toISOString(),
          detected_intent: purpose,
          metadata: { outbound_purpose: purpose, context },
        })
        .select("id")
        .single();

      if (callErr || !callRecord) {
        return jsonResponse({ error: "Failed to initialize call record" }, 500);
      }

      const host = req.headers.get("host") || url.host;
      const proto = req.headers.get("x-forwarded-proto") === "http" ? "ws" : "wss";
      const streamWsUrl = `${proto}://${host}${pathname.replace(/\/outbound$/, "")}?schoolId=${schoolId}&callId=${callRecord.id}&direction=outbound&from=${encodeURIComponent(toPhone)}`;

      const twiml = generateStreamTwiML({
        streamUrl: streamWsUrl,
        schoolId,
        callId: callRecord.id,
        direction: "outbound",
        customParams: { purpose, context, recipientName },
        record: settings?.recording_enabled ?? true,
      });

      const result = await makeTwilioOutboundCall({
        accountSid,
        authToken,
        from: fromPhone,
        to: toPhone,
        twiml,
        statusCallback: `https://${host}${pathname.replace(/\/outbound$/, "/status")}`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        record: settings?.recording_enabled ?? true,
      });

      if (!result.ok) {
        await db.from("ai_calls").update({ status: "failed" }).eq("id", callRecord.id);
        return jsonResponse({ error: result.error }, 502);
      }

      await db
        .from("ai_calls")
        .update({ provider_call_sid: result.callSid })
        .eq("id", callRecord.id);

      return jsonResponse({
        ok: true,
        callId: callRecord.id,
        callSid: result.callSid,
        message: "Outbound call initiated successfully.",
      });
    } catch (err) {
      console.error("Error triggering outbound call:", err);
      return jsonResponse({ error: String(err) }, 500);
    }
  }

  /* ======================================================================== */
  /* 5. Health check / status                                                  */
  /* ======================================================================== */
  return jsonResponse({
    service: "EduManage AI Voice Gateway",
    version: "2.0.0",
    openai_realtime: "enabled",
    twilio_media_streams: "enabled",
    status: "healthy",
  });
});
