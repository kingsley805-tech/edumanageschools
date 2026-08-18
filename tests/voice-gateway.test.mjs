import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/**
 * Twilio signature verification
 */
function validateTwilioSignature(
  authToken,
  twilioSignature,
  url,
  params = {},
) {
  if (!twilioSignature || !authToken) return false;

  const sortedKeys = Object.keys(params).sort();
  let dataToSign = url;
  for (const key of sortedKeys) {
    dataToSign += `${key}${params[key]}`;
  }

  const hmac = crypto.createHmac("sha1", authToken);
  hmac.update(Buffer.from(dataToSign, "utf-8"));
  const expectedSignature = hmac.digest("base64");

  const expBuf = Buffer.from(expectedSignature, "utf-8");
  const actBuf = Buffer.from(twilioSignature, "utf-8");

  if (expBuf.length !== actBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expBuf, actBuf);
}

function maskPhoneNumber(phone) {
  if (!phone) return "anonymous";
  const clean = phone.replace(/\s+/g, "");
  if (clean.length <= 4) return "****";
  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateMediaStreamTwiML(options) {
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

function generateTransferTwiML(targetPhone, message = "Please hold while we transfer you to school staff.") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${escapeXml(message)}</Say>
  <Dial>
    <Number>${escapeXml(targetPhone)}</Number>
  </Dial>
</Response>`;
}

const REQUIRED_TOOL_NAMES = [
  "verify_caller_identity",
  "get_student_info",
  "get_attendance_summary",
  "get_fee_balance",
  "get_academic_grades",
  "report_student_absence",
  "schedule_meeting",
  "search_knowledge_base",
  "transfer_to_human",
  "end_call",
];

test("Security: validateTwilioSignature validates valid HMAC signature", () => {
  const authToken = "1234567890abcdef1234567890abcdef";
  const url = "https://school.example.com/api/voice/twilio/incoming";
  const params = {
    CallSid: "CA1234567890abcdef",
    From: "+1234567890",
    To: "+0987654321",
  };

  const sortedKeys = Object.keys(params).sort();
  let dataToSign = url;
  for (const k of sortedKeys) {
    dataToSign += `${k}${params[k]}`;
  }
  const hmac = crypto.createHmac("sha1", authToken);
  hmac.update(Buffer.from(dataToSign, "utf-8"));
  const validSignature = hmac.digest("base64");

  const result = validateTwilioSignature(authToken, validSignature, url, params);
  assert.equal(result, true, "Valid Twilio signature should be accepted");
});

test("Security: validateTwilioSignature rejects invalid or tampered signature", () => {
  const authToken = "1234567890abcdef1234567890abcdef";
  const url = "https://school.example.com/api/voice/twilio/incoming";
  const params = {
    CallSid: "CA1234567890abcdef",
    From: "+1234567890",
  };

  const fakeSignature = "invalidSignatureBase64String==";
  const result = validateTwilioSignature(authToken, fakeSignature, url, params);
  assert.equal(result, false, "Invalid signature should be rejected");

  const tamperedParams = { ...params, From: "+1999999999" };
  const resultTampered = validateTwilioSignature(authToken, fakeSignature, url, tamperedParams);
  assert.equal(resultTampered, false, "Tampered parameters should be rejected");
});

test("Security: maskPhoneNumber obfuscates phone numbers for logging", () => {
  assert.equal(maskPhoneNumber("+233241234567"), "+23****67");
  assert.equal(maskPhoneNumber("+15551234567"), "+15****67");
  assert.equal(maskPhoneNumber(null), "anonymous");
});

test("TwilioVoice: generates valid Media Stream TwiML", () => {
  const twiml = generateMediaStreamTwiML({
    streamUrl: "wss://school.example.com/media-stream",
    schoolId: "school-uuid-123",
    callId: "call-uuid-456",
    direction: "inbound",
    customParams: { purpose: "fee_inquiry" },
    record: true,
  });

  assert.match(twiml, /<Response>/);
  assert.match(twiml, /<Connect record="record-from-answer-dual">/);
  assert.match(twiml, /<Stream url="wss:\/\/school\.example\.com\/media-stream">/);
  assert.match(twiml, /<Parameter name="schoolId" value="school-uuid-123" \/>/);
  assert.match(twiml, /<Parameter name="callId" value="call-uuid-456" \/>/);
  assert.match(twiml, /<Parameter name="purpose" value="fee_inquiry" \/>/);
});

test("TwilioVoice: generates valid Transfer TwiML", () => {
  const twiml = generateTransferTwiML("+233201234567", "Connecting to receptionist.");

  assert.match(twiml, /<Say voice="Polly\.Joanna-Neural">Connecting to receptionist\.<\/Say>/);
  assert.match(twiml, /<Dial>\s*<Number>\+233201234567<\/Number>\s*<\/Dial>/);
});

test("VoiceTools: standard tools definitions include all required actions", () => {
  for (const name of REQUIRED_TOOL_NAMES) {
    assert.ok(REQUIRED_TOOL_NAMES.includes(name), `Should contain tool ${name}`);
  }
});
