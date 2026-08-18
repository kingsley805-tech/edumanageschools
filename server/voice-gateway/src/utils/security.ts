import crypto from "crypto";

/**
 * Validates a Twilio request signature using standard HMAC-SHA1.
 */
export function validateTwilioSignature(
  authToken: string,
  twilioSignature: string | null | undefined,
  url: string,
  params: Record<string, string> = {},
): boolean {
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

/**
 * Masks sensitive phone numbers or IDs in logs for privacy.
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "anonymous";
  const clean = phone.replace(/\s+/g, "");
  if (clean.length <= 4) return "****";
  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
}
