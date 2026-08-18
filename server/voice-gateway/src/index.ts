import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseUrl } from "url";
import { loadConfig } from "./config.js";
import { TwilioVoiceService } from "./services/TwilioVoiceService.js";
import { VoiceCallService } from "./services/VoiceCallService.js";
import { OpenAIRealtimeService } from "./services/OpenAIRealtimeService.js";
import { logger } from "./utils/logger.js";

const config = loadConfig();
const twilioService = new TwilioVoiceService(
  config.TWILIO_ACCOUNT_SID,
  config.TWILIO_AUTH_TOKEN,
  config.TWILIO_PHONE_NUMBER,
);
const callService = new VoiceCallService(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

const server = http.createServer(async (req, res) => {
  const parsed = parseUrl(req.url || "/", true);
  const pathname = parsed.pathname || "/";
  const method = req.method || "GET";

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Twilio-Signature");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse body helper
  const getBody = (): Promise<string> =>
    new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
    });

  const getFormData = async (): Promise<Record<string, string>> => {
    const raw = await getBody();
    const params = new URLSearchParams(raw);
    const result: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      result[k] = v;
    }
    return result;
  };

  /* ======================================================================== */
  /* 1. Inbound Twilio Webhook (POST /api/voice/twilio/incoming)              */
  /* ======================================================================== */
  if (method === "POST" && (pathname === "/api/voice/twilio/incoming" || pathname === "/incoming" || pathname === "/")) {
    try {
      const form = await getFormData();
      const callSid = form.CallSid || "";
      const toPhone = form.To || "";
      const fromPhone = form.From || "";

      logger.info("Incoming call webhook received", { callSid, data: { toPhone, fromPhone } });

      const profile = await callService.getSchoolByPhone(toPhone);
      const schoolId = profile?.schoolId || "";

      let callId: string | null = null;
      if (schoolId) {
        callId = await callService.createCallRecord({
          schoolId,
          direction: "inbound",
          callerPhone: fromPhone,
          providerCallSid: callSid,
        });
      }

      const host = req.headers.host || `localhost:${config.PORT}`;
      const proto = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
      const mediaWsUrl = `${proto}://${host}/media-stream?schoolId=${schoolId}&callId=${callId || ""}&from=${encodeURIComponent(fromPhone)}`;

      const twiml = twilioService.generateMediaStreamTwiML({
        streamUrl: mediaWsUrl,
        schoolId,
        callId: callId || undefined,
        direction: "inbound",
        record: profile?.recordingEnabled ?? config.VOICE_RECORDING_ENABLED,
      });

      res.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
      res.end(twiml);
    } catch (err) {
      logger.error("Error processing inbound webhook", { error: String(err) });
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please call back later.</Say></Response>`;
      res.writeHead(500, { "Content-Type": "text/xml" });
      res.end(errorTwiml);
    }
    return;
  }

  /* ======================================================================== */
  /* 2. Twilio Status Callback (POST /api/voice/twilio/status)                */
  /* ======================================================================== */
  if (method === "POST" && (pathname === "/api/voice/twilio/status" || pathname === "/status")) {
    try {
      const form = await getFormData();
      const callSid = form.CallSid;
      const callStatus = form.CallStatus;
      const duration = parseInt(form.CallDuration || "0", 10);
      const recordingUrl = form.RecordingUrl;

      if (callSid) {
        const updates: Record<string, unknown> = {};
        if (callStatus === "completed") {
          updates.status = "completed";
          updates.ended_at = new Date().toISOString();
        } else if (callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed") {
          updates.status = callStatus === "no-answer" ? "missed" : "failed";
          updates.ended_at = new Date().toISOString();
        }
        if (duration > 0) updates.duration_seconds = duration;
        if (recordingUrl) updates.recording_url = recordingUrl;

        await callService.getDb().from("ai_calls").update(updates).eq("provider_call_sid", callSid);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  /* ======================================================================== */
  /* 3. Outbound AI Call (POST /api/voice/outbound)                           */
  /* ======================================================================== */
  if (method === "POST" && pathname === "/api/voice/outbound") {
    try {
      const raw = await getBody();
      const body = JSON.parse(raw || "{}");
      const { schoolId, toPhone, studentId, purpose = "notification", context = "", recipientName = "" } = body;

      if (!schoolId || !toPhone) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "schoolId and toPhone are required" }));
        return;
      }

      const profile = await callService.getSchoolByPhone(toPhone);

      const callId = await callService.createCallRecord({
        schoolId,
        direction: "outbound",
        callerPhone: config.TWILIO_PHONE_NUMBER || "",
        recipientName,
        studentId,
        purpose,
      });

      const host = req.headers.host || `localhost:${config.PORT}`;
      const proto = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
      const mediaWsUrl = `${proto}://${host}/media-stream?schoolId=${schoolId}&callId=${callId || ""}&direction=outbound&from=${encodeURIComponent(toPhone)}`;

      const twiml = twilioService.generateMediaStreamTwiML({
        streamUrl: mediaWsUrl,
        schoolId,
        callId: callId || undefined,
        direction: "outbound",
        customParams: { purpose, context, recipientName },
        record: profile?.recordingEnabled ?? config.VOICE_RECORDING_ENABLED,
      });

      const result = await twilioService.makeCall({
        to: toPhone,
        twiml,
        statusCallback: `https://${host}/api/voice/twilio/status`,
      });

      if (!result.ok) {
        if (callId) await callService.updateCallStatus(callId, { status: "failed" });
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: result.error }));
        return;
      }

      if (callId && result.callSid) {
        await callService.updateCallStatus(callId, { provider_call_sid: result.callSid });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, callId, callSid: result.callSid }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  /* ======================================================================== */
  /* 4. Health check                                                           */
  /* ======================================================================== */
  if (pathname === "/health" || pathname === "/api/voice/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        uptime: process.uptime(),
        model: config.OPENAI_REALTIME_MODEL,
        voice: config.OPENAI_VOICE,
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found" }));
});

/* ========================================================================== */
/* WebSocket Server for Twilio Media Streams                                   */
/* ========================================================================== */
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const parsed = parseUrl(req.url || "/", true);
  if (parsed.pathname === "/media-stream" || parsed.pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  const parsed = parseUrl(req.url || "/", true);
  let streamSid = "";
  let callSid = "";
  let schoolId = String(parsed.query.schoolId || "");
  let callId = String(parsed.query.callId || "");
  let direction: "inbound" | "outbound" = (parsed.query.direction as "inbound" | "outbound") || "inbound";
  const callerPhone = String(parsed.query.from || "");
  let realtimeService: OpenAIRealtimeService | null = null;

  logger.info("Twilio Media Stream WebSocket client connected", { callId });

  ws.on("message", async (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString("utf-8"));

      switch (msg.event) {
        case "start": {
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          const custom = msg.start.customParameters || {};

          schoolId = schoolId || custom.schoolId || "";
          callId = callId || custom.callId || "";
          direction = (custom.direction as "inbound" | "outbound") || direction;

          logger.info("Twilio media stream started", { callSid, data: { streamSid, schoolId, callId } });

          // Load profile
          let schoolName = "our school";
          let agentName = "Emma";
          let voice = config.OPENAI_VOICE;
          let model = config.OPENAI_REALTIME_MODEL;
          let systemPrompt: string | undefined;
          let greeting = "Thank you for calling. How may I assist you today?";
          let enabledTools: string[] = [];

          if (schoolId) {
            const { data: school } = await callService.getDb().from("schools").select("name").eq("id", schoolId).maybeSingle();
            const { data: agent } = await callService.getDb().from("ai_voice_agents").select("*").eq("school_id", schoolId).maybeSingle();

            schoolName = school?.name || schoolName;
            if (agent) {
              agentName = agent.name || agentName;
              voice = agent.openai_voice || voice;
              model = agent.openai_model || model;
              systemPrompt = agent.system_prompt;
              greeting = agent.greeting || greeting;
              enabledTools = agent.enabled_tools || [];
            }
          }

          realtimeService = new OpenAIRealtimeService(
            {
              apiKey: config.OPENAI_API_KEY,
              model,
              voice,
              systemPrompt,
              temperature: 0.8,
              schoolName,
              agentName,
              enabledTools,
              initialGreeting: greeting,
              direction,
              outboundPurpose: custom.purpose,
              outboundContext: custom.context,
            },
            callService.getDb(),
            schoolId,
            callId,
            callerPhone,
            {
              onAudioDelta: (payloadBase64) => {
                if (ws.readyState === WebSocket.OPEN && streamSid) {
                  ws.send(JSON.stringify({ event: "media", streamSid, media: { payload: payloadBase64 } }));
                }
              },
              onSpeechStarted: () => {
                if (ws.readyState === WebSocket.OPEN && streamSid) {
                  ws.send(JSON.stringify({ event: "clear", streamSid }));
                }
              },
              onTranscriptTurn: (speaker, text) => {
                logger.debug("Transcript turn", { callId, data: { speaker, text } });
              },
              onCallEscalated: async (reason, transferNumber) => {
                logger.info("Escalating call to human", { callSid, data: { reason, transferNumber } });
                if (transferNumber && callSid) {
                  const twiml = twilioService.generateTransferTwiML(transferNumber);
                  await twilioService.transferCall(callSid, twiml);
                }
              },
              onCallHangUp: async () => {
                logger.info("Hanging up call naturally", { callSid });
              },
              onError: (err) => {
                logger.error("Realtime service error", { error: err.message });
              },
              onClose: () => {
                logger.info("Realtime session closed", { callId });
              },
            },
          );

          await realtimeService.connect();

          if (callId) {
            await callService.updateCallStatus(callId, {
              status: "in_progress",
              provider_call_sid: callSid,
              started_at: new Date().toISOString(),
            });
          }
          break;
        }

        case "media": {
          if (realtimeService && msg.media?.payload) {
            realtimeService.sendAudioChunk(msg.media.payload);
          }
          break;
        }

        case "stop": {
          logger.info("Twilio media stream stopped", { streamSid });
          if (realtimeService) {
            await realtimeService.close();
            realtimeService = null;
          }
          break;
        }
      }
    } catch (err) {
      logger.error("Error processing stream message", { error: String(err) });
    }
  });

  ws.on("close", async () => {
    logger.info("WebSocket closed", { callId });
    if (realtimeService) {
      await realtimeService.close();
      realtimeService = null;
    }
  });
});

server.listen(config.PORT, config.HOST, () => {
  logger.info(`EduManage Voice Gateway listening on http://${config.HOST}:${config.PORT}`);
});
