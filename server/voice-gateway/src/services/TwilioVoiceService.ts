import { validateTwilioSignature } from "../utils/security.js";
import { logger } from "../utils/logger.js";

export class TwilioVoiceService {
  constructor(
    private accountSid?: string,
    private authToken?: string,
    private defaultPhoneNumber?: string,
  ) {}

  public validateSignature(signature: string | null | undefined, url: string, params: Record<string, string>): boolean {
    if (!this.authToken) return true;
    return validateTwilioSignature(this.authToken, signature, url, params);
  }

  public generateMediaStreamTwiML(options: {
    streamUrl: string;
    schoolId?: string;
    callId?: string;
    direction?: "inbound" | "outbound";
    customParams?: Record<string, string>;
    record?: boolean;
  }): string {
    const { streamUrl, schoolId, callId, direction = "inbound", customParams = {}, record = false } = options;

    let paramsXml = "";
    if (schoolId) paramsXml += `\n      <Parameter name="schoolId" value="${escapeXml(schoolId)}" />`;
    if (callId) paramsXml += `\n      <Parameter name="callId" value="${escapeXml(callId)}" />`;
    if (direction) paramsXml += `\n      <Parameter name="direction" value="${escapeXml(direction)}" />`;

    for (const [k, v] of Object.entries(customParams)) {
      if (v) paramsXml += `\n      <Parameter name="${escapeXml(k)}" value="${escapeXml(v)}" />`;
    }

    const recordAttr = record ? ' record="record-from-answer-dual"' : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect${recordAttr}>
    <Stream url="${escapeXml(streamUrl)}">${paramsXml}
    </Stream>
  </Connect>
</Response>`;
  }

  public generateTransferTwiML(targetPhone: string, message = "Please hold while we transfer you to school staff."): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${escapeXml(message)}</Say>
  <Dial>
    <Number>${escapeXml(targetPhone)}</Number>
  </Dial>
</Response>`;
  }

  public async makeCall(options: {
    to: string;
    from?: string;
    twiml?: string;
    url?: string;
    statusCallback?: string;
    record?: boolean;
  }): Promise<{ ok: boolean; callSid?: string; error?: string }> {
    const from = options.from || this.defaultPhoneNumber;
    if (!this.accountSid || !this.authToken || !from) {
      return { ok: false, error: "Twilio credentials or from phone number not configured." };
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`;
    const params = new URLSearchParams({
      To: options.to,
      From: from,
    });

    if (options.twiml) params.set("Twiml", options.twiml);
    if (options.url) params.set("Url", options.url);
    if (options.statusCallback) params.set("StatusCallback", options.statusCallback);
    if (options.record) params.set("Record", "true");

    try {
      const authHeader = `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = (await res.json()) as { sid?: string; message?: string };
      if (!res.ok) {
        logger.error("Twilio makeCall failed", { error: data.message });
        return { ok: false, error: data.message || `HTTP ${res.status}` };
      }

      return { ok: true, callSid: data.sid };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("Twilio makeCall exception", { error: errorMsg });
      return { ok: false, error: errorMsg };
    }
  }

  public async transferCall(callSid: string, transferTwiml: string): Promise<boolean> {
    if (!this.accountSid || !this.authToken) return false;

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${callSid}.json`;
    const params = new URLSearchParams({ Twiml: transferTwiml });

    try {
      const authHeader = `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      return res.ok;
    } catch (err) {
      logger.error("Twilio transferCall exception", { callSid, error: String(err) });
      return false;
    }
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
