import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("8088").transform((v) => parseInt(v, 10)),
  HOST: z.string().default("0.0.0.0"),
  PUBLIC_URL: z.string().optional(),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(10),
  OPENAI_REALTIME_MODEL: z.string().default("gpt-4o-realtime-preview"),
  OPENAI_VOICE: z.string().default("alloy"),
  
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  
  // Support & Escalation
  VOICE_SUPPORT_NUMBER: z.string().optional(),
  VOICE_MAX_CALL_DURATION: z.string().default("600").transform((v) => parseInt(v, 10)),
  VOICE_RECORDING_ENABLED: z.string().default("true").transform((v) => v.toLowerCase() === "true"),
});

export type VoiceGatewayConfig = z.infer<typeof envSchema>;

export function loadConfig(): VoiceGatewayConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("Environment configuration warning:", parsed.error.format());
  }
  return (
    parsed.data || {
      PORT: 8088,
      HOST: "0.0.0.0",
      SUPABASE_URL: process.env.SUPABASE_URL || "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-key",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || "mock-openai-key",
      OPENAI_REALTIME_MODEL: "gpt-4o-realtime-preview",
      OPENAI_VOICE: "alloy",
      VOICE_MAX_CALL_DURATION: 600,
      VOICE_RECORDING_ENABLED: true,
    }
  );
}
