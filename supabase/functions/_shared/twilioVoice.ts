// Twilio Programmable Voice helper utilities for signature verification, TwiML generation, and outbound dispatch.

/**
 * Validates a Twilio request signature using standard HMAC-SHA1.
 * Matches Twilio's official signature algorithm:
 * 1. Takes the full URL (including query string if present).
 * 2. Sorts POST parameters alphabetically by key.
 * 3. Concatenates key + value for each param onto the URL.
 * 4. Computes HMAC-SHA1 with the Auth Token and base64 encodes it.
 */
export async function validateTwilioSignature(
  authToken: string,
  twilioSignature: string | null,
  url: string,
  params: Record<string, string> = {},
): Promise<boolean> {
  if (!twilioSignature || !authToken) return false;

  // Sort keys alphabetically
  const keys = Object.keys(params).sort();
  let dataToSign = url;
  for (const key of keys) {
    dataToSign += `${key}${params[key]}`;
  }

  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(authToken);
  const dataBuffer = encoder.encode(dataToSign);

  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
    const signatureBytes = new Uint8Array(signatureBuffer);
    
    // Base64 encode
    let binary = "";
    for (let i = 0; i < signatureBytes.byteLength; i++) {
      binary += String.fromCharCode(signatureBytes[i]);
    }
    const computedSignature = btoa(binary);

    return computedSignature === twilioSignature;
  } catch (err) {
    console.error("Error validating Twilio signature:", err);
    return false;
  }
}

/**
 * Generates TwiML connecting the phone call to a bidirectional WebSocket Media Stream.
 */
export function generateStreamTwiML(options: {
  streamUrl: string;
  schoolId?: string;
  callId?: string;
  direction?: "inbound" | "outbound";
  customParams?: Record<string, string>;
  record?: boolean;
}): string {
  const { streamUrl, schoolId, callId, direction = "inbound", customParams = {}, record = false } = options;

  let customXml = "";
  if (schoolId) customXml += `\n      <Parameter name="schoolId" value="${escapeXml(schoolId)}" />`;
  if (callId) customXml += `\n      <Parameter name="callId" value="${escapeXml(callId)}" />`;
  if (direction) customXml += `\n      <Parameter name="direction" value="${escapeXml(direction)}" />`;

  for (const [k, v] of Object.entries(customParams)) {
    if (v) customXml += `\n      <Parameter name="${escapeXml(k)}" value="${escapeXml(v)}" />`;
  }

  const recordAttr = record ? ' record="record-from-answer-dual"' : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect${recordAttr}>
    <Stream url="${escapeXml(streamUrl)}">${customXml}
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Generates TwiML to transfer the caller to a live human representative.
 */
export function generateTransferTwiML(options: {
  targetPhone: string;
  transferMessage?: string;
  callerId?: string;
}): string {
  const { targetPhone, transferMessage = "Please hold while we transfer you to a member of our school staff.", callerId } = options;
  const callerIdAttr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${escapeXml(transferMessage)}</Say>
  <Dial${callerIdAttr}>
    <Number>${escapeXml(targetPhone)}</Number>
  </Dial>
</Response>`;
}

/**
 * Initiates an outbound telephone call via Twilio REST API.
 */
export async function makeTwilioOutboundCall(options: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  twiml?: string;
  url?: string;
  statusCallback?: string;
  statusCallbackEvent?: string[];
  record?: boolean;
}): Promise<{ ok: boolean; callSid?: string; error?: string; raw?: unknown }> {
  const { accountSid, authToken, from, to, twiml, url, statusCallback, statusCallbackEvent, record } = options;

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

  const bodyParams = new URLSearchParams();
  bodyParams.set("From", from);
  bodyParams.set("To", to);

  if (twiml) {
    bodyParams.set("Twiml", twiml);
  } else if (url) {
    bodyParams.set("Url", url);
  } else {
    return { ok: false, error: "Either 'twiml' or 'url' must be provided for outbound call." };
  }

  if (statusCallback) {
    bodyParams.set("StatusCallback", statusCallback);
    bodyParams.set("StatusCallbackMethod", "POST");
  }

  if (statusCallbackEvent && statusCallbackEvent.length > 0) {
    for (const evt of statusCallbackEvent) {
      bodyParams.append("StatusCallbackEvent", evt);
    }
  }

  if (record) {
    bodyParams.set("Record", "true");
  }

  try {
    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error: data.message || `Twilio HTTP Error ${response.status}`,
        raw: data,
      };
    }

    return {
      ok: true,
      callSid: data.sid,
      raw: data,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Updates an active Twilio call (e.g. to transfer or hang up) via Twilio REST API.
 */
export async function updateTwilioCall(options: {
  accountSid: string;
  authToken: string;
  callSid: string;
  twiml?: string;
  status?: "completed" | "canceled";
}): Promise<{ ok: boolean; error?: string }> {
  const { accountSid, authToken, callSid, twiml, status } = options;
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;

  const bodyParams = new URLSearchParams();
  if (twiml) bodyParams.set("Twiml", twiml);
  if (status) bodyParams.set("Status", status);

  try {
    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.message || `Twilio HTTP Error ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
