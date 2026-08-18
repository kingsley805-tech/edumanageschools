# Production Setup: AI Voice Assistant with Twilio & OpenAI Realtime

This guide details how to configure, test, and deploy the **EduManage AI Voice Assistant Phone System** using **Twilio Programmable Voice & Media Streams** and **OpenAI Realtime Voice API** (`gpt-4o-realtime-preview`).

---

## 1. Architecture Overview

```text
Parent / Caller Phone
        │ (PSTN / Mobile Network)
        ▼
Twilio Programmable Voice
        │ (Bidirectional Media Stream - μ-law 8000Hz)
        ▼
Voice Gateway (Supabase Edge Function or Node Microservice)
        │ (WebSocket wss://api.openai.com/v1/realtime)
        ▼
OpenAI Realtime API (gpt-4o-realtime-preview)
        │ (Function Calling / Tool Execution)
        ▼
EduManage Services & Supabase Database (Multi-Tenant Scoped)
```

### Key Technical Advantages
* **Native Speech-to-Speech**: Audio is streamed directly as `g711_ulaw` without text-to-speech transcoding latency.
* **Instant Barge-In (Interruption)**: When the caller speaks while the assistant is responding, an instant `clear` event clears Twilio's audio buffer immediately.
* **Multi-Tenant Security**: Incoming calls are mapped to the school by the dialed Twilio number. Student data is locked behind identity verification.

---

## 2. Environment Variables

Add the following keys to your `.env` or cloud secret manager:

```env
# OpenAI Realtime Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_VOICE=alloy

# Twilio Programmable Voice
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Escalation & Defaults
VOICE_SUPPORT_NUMBER=+233201234567
VOICE_MAX_CALL_DURATION=600
VOICE_RECORDING_ENABLED=true
VOICE_GATEWAY_PORT=8088
```

---

## 3. Twilio Console Setup

1. Log in to the [Twilio Console](https://console.twilio.com/).
2. Navigate to **Phone Numbers → Manage → Active Numbers**.
3. Click your active phone number.
4. Under **Voice Configuration**:
   * **A Call Comes In**: Select **Webhook**.
   * **URL**: Enter your Voice Gateway URL (e.g. `https://<YOUR_SUPABASE_PROJECT>.supabase.co/functions/v1/ai-voice-gateway` or `https://<YOUR_TUNNEL_URL>/api/voice/twilio/incoming`).
   * **HTTP Method**: `HTTP POST`.
   * **Call Status Changes**: Enter `https://<YOUR_SUPABASE_PROJECT>.supabase.co/functions/v1/ai-voice-gateway/status` (HTTP POST).
5. Click **Save Configuration**.

---

## 4. Local Development & Tunneling

For local testing with live telephone calls, expose your local voice server using **ngrok** or **Cloudflare Tunnel**:

### Option A: Using ngrok
```bash
# In terminal 1: Start the Voice Gateway
npm run voice:server

# In terminal 2: Expose port 8088
ngrok http 8088
```
Copy the `https://xxxx.ngrok-free.app` URL and update your Twilio phone number webhook:
`https://xxxx.ngrok-free.app/api/voice/twilio/incoming`

### Option B: Using Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:8088
```

---

## 5. Deployment Options

### Option 1: Supabase Edge Functions (Recommended)
Deploy the serverless Edge Function with zero infrastructure maintenance:

```bash
# 1. Apply database migration
npm run db:push
# OR run public/sql/apply-ai-voice-assistant.sql in Supabase SQL Editor

# 2. Set Supabase secrets
supabase secrets set OPENAI_API_KEY="sk-..." TWILIO_AUTH_TOKEN="..." TWILIO_ACCOUNT_SID="..."

# 3. Deploy the Edge Function
supabase functions deploy ai-voice-gateway
```

The public webhook URL is:
`https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/ai-voice-gateway`

### Option 2: Standalone Microservice (Docker / Node)
You can run the microservice inside `server/voice-gateway/`:

```bash
cd server/voice-gateway
npm install
npm run build
npm start
```

Deployable to Railway, Render, Fly.io, or AWS ECS.

---

## 6. Admin Dashboard Configuration

1. Log into EduManage as a School Admin or Super Admin.
2. Navigate to **AI Voice Receptionist → Telephony & Voice AI Settings**.
3. Choose your preferred **AI Voice Persona** (`alloy`, `echo`, `shimmer`, `ash`, `ballad`, `coral`, `sage`, `verse`).
4. Select active **Business Tools**:
   * *Caller Identity Verification*
   * *Student Profile Lookup*
   * *Attendance Statistics*
   * *Fee & Invoice Balance*
   * *Academic Grades*
   * *Record Student Absence*
   * *Schedule Meeting*
   * *School Knowledge Base*
   * *Human Staff Transfer*
5. Enter your **Twilio Phone Number** and **Human Handover Number**.
6. Click **Save Settings**.

---

## 7. Testing Calls

* **Simulated Web Testing**: Click **Test Assistant** in the top navigation of the AI Receptionist module to test conversation turns in the browser.
* **Outbound Phone Call**: Click **Launch Outbound Call**, input your phone number, choose a notification campaign (e.g. *Fee Reminder* or *Attendance Alert*), and verify that the AI calls your phone and speaks in real time.
* **Inbound Call**: Dial the school's Twilio phone number from any mobile or landline phone to experience real-time natural conversation with instant barge-in.
