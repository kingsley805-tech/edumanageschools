import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { validateTwilioSignature, maskPhoneNumber } from "../src/utils/security.js";
import { TwilioVoiceService } from "../src/services/TwilioVoiceService.js";
import { STANDARD_VOICE_TOOLS } from "../src/services/VoiceToolService.js";

test("Security: validateTwilioSignature validates valid HMAC signature", () => {
  const authToken = "1234567890abcdef1234567890abcdef";
  const url = "https://school.example.com/api/voice/twilio/incoming";
  const params = {
    CallSid: "CA1234567890abcdef",
    From: "+1234567890",
    To: "+0987654321",
  };

  // Compute valid signature
  const sortedKeys = Object.keys(params).sort();
  let dataToSign = url;
  for (const k of sortedKeys) {
    dataToSign += `${k}${params[k as keyof typeof params]}`;
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

test("TwilioVoiceService: generates valid Media Stream TwiML", () => {
  const service = new TwilioVoiceService("AC_TEST", "AUTH_TOKEN", "+1234567890");
  const twiml = service.generateMediaStreamTwiML({
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

test("TwilioVoiceService: generates valid Transfer TwiML", () => {
  const service = new TwilioVoiceService();
  const twiml = service.generateTransferTwiML("+233201234567", "Connecting to receptionist.");

  assert.match(twiml, /<Say voice="Polly\.Joanna-Neural">Connecting to receptionist\.<\/Say>/);
  assert.match(twiml, /<Dial>\s*<Number>\+233201234567<\/Number>\s*<\/Dial>/);
});

test("VoiceTools: standard tools definitions include all required actions", () => {
  const toolNames = STANDARD_VOICE_TOOLS.map((t) => t.name);

  assert.ok(toolNames.includes("verify_caller_identity"), "Should have verify_caller_identity tool");
  assert.ok(toolNames.includes("get_student_info"), "Should have get_student_info tool");
  assert.ok(toolNames.includes("get_attendance_summary"), "Should have get_attendance_summary tool");
  assert.ok(toolNames.includes("get_fee_balance"), "Should have get_fee_balance tool");
  assert.ok(toolNames.includes("get_academic_grades"), "Should have get_academic_grades tool");
  assert.ok(toolNames.includes("report_student_absence"), "Should have report_student_absence tool");
  assert.ok(toolNames.includes("schedule_meeting"), "Should have schedule_meeting tool");
  assert.ok(toolNames.includes("search_knowledge_base"), "Should have search_knowledge_base tool");
  assert.ok(toolNames.includes("transfer_to_human"), "Should have transfer_to_human tool");
  assert.ok(toolNames.includes("end_call"), "Should have end_call tool");

  // Validate parameters object for each tool
  for (const tool of STANDARD_VOICE_TOOLS) {
    assert.equal(tool.type, "function");
    assert.ok(tool.description.length > 5);
    assert.equal(tool.parameters.type, "object");
    assert.ok(typeof tool.parameters.properties === "object");
  }
});
