-- EduManage AI Voice Assistant with Twilio & OpenAI Realtime
-- Migration: 20260811190000_ai_voice_assistant_openai_twilio.sql

-- 1. Extend ai_voice_agents with OpenAI Realtime parameters
ALTER TABLE public.ai_voice_agents
  ADD COLUMN IF NOT EXISTS openai_model text NOT NULL DEFAULT 'gpt-4o-realtime-preview',
  ADD COLUMN IF NOT EXISTS openai_voice text NOT NULL DEFAULT 'alloy',
  ADD COLUMN IF NOT EXISTS system_prompt text,
  ADD COLUMN IF NOT EXISTS temperature numeric(3,2) NOT NULL DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS enabled_tools text[] NOT NULL DEFAULT ARRAY[
    'verify_caller_identity',
    'get_student_info',
    'get_attendance_summary',
    'get_fee_balance',
    'get_academic_grades',
    'report_student_absence',
    'schedule_meeting',
    'search_knowledge_base',
    'transfer_to_human'
  ],
  ADD COLUMN IF NOT EXISTS max_call_duration_seconds integer NOT NULL DEFAULT 600;

-- 2. Extend ai_voice_settings for OpenAI keys and stream URLs
ALTER TABLE public.ai_voice_settings
  ADD COLUMN IF NOT EXISTS openai_api_key_encrypted text,
  ADD COLUMN IF NOT EXISTS media_stream_url text,
  ADD COLUMN IF NOT EXISTS status_callback_url text,
  ADD COLUMN IF NOT EXISTS support_number text;

-- 3. Extend ai_calls for real-time streaming metadata and escalation tracking
ALTER TABLE public.ai_calls
  ADD COLUMN IF NOT EXISTS parent_call_sid text,
  ADD COLUMN IF NOT EXISTS ai_session_id text,
  ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Indexes for fast lookup by Twilio Call SID and Phone Number
CREATE INDEX IF NOT EXISTS idx_ai_calls_provider_call_sid ON public.ai_calls(provider_call_sid);
CREATE INDEX IF NOT EXISTS idx_ai_calls_parent_call_sid ON public.ai_calls(parent_call_sid);
CREATE INDEX IF NOT EXISTS idx_ai_voice_settings_twilio_phone ON public.ai_voice_settings(twilio_phone_number);
CREATE INDEX IF NOT EXISTS idx_ai_voice_settings_school_phone ON public.ai_voice_settings(school_phone_e164);

-- 4. Helper function to look up school & voice configuration by dialed Twilio number
CREATE OR REPLACE FUNCTION public.get_school_by_twilio_phone(p_phone text)
RETURNS TABLE (
  school_id uuid,
  school_name text,
  provider text,
  twilio_account_sid text,
  twilio_phone_number text,
  recording_enabled boolean,
  outbound_enabled boolean,
  verification_mode text,
  is_enabled boolean,
  agent_id uuid,
  agent_name text,
  greeting text,
  voice_style text,
  openai_voice text,
  openai_model text,
  system_prompt text,
  temperature numeric,
  enabled_tools text[],
  handover_phone text,
  escalation_keywords text[],
  max_call_duration_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone text;
BEGIN
  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9+]', '', 'g');

  RETURN QUERY
  SELECT
    s.id AS school_id,
    s.name AS school_name,
    vs.provider,
    vs.twilio_account_sid,
    vs.twilio_phone_number,
    vs.recording_enabled,
    vs.outbound_enabled,
    vs.verification_mode,
    vs.is_enabled,
    va.id AS agent_id,
    COALESCE(va.name, 'Emma') AS agent_name,
    COALESCE(va.greeting, 'Thank you for calling ' || s.name || '. How may I assist you today?') AS greeting,
    COALESCE(va.voice_style, 'warm_professional') AS voice_style,
    COALESCE(va.openai_voice, 'alloy') AS openai_voice,
    COALESCE(va.openai_model, 'gpt-4o-realtime-preview') AS openai_model,
    va.system_prompt,
    COALESCE(va.temperature, 0.8) AS temperature,
    COALESCE(va.enabled_tools, ARRAY[
      'verify_caller_identity',
      'get_student_info',
      'get_attendance_summary',
      'get_fee_balance',
      'get_academic_grades',
      'report_student_absence',
      'schedule_meeting',
      'search_knowledge_base',
      'transfer_to_human'
    ]) AS enabled_tools,
    COALESCE(va.handover_phone, vs.support_number) AS handover_phone,
    COALESCE(va.escalation_keywords, ARRAY['emergency', 'ambulance', 'abuse', 'human', 'manager']) AS escalation_keywords,
    COALESCE(va.max_call_duration_seconds, 600) AS max_call_duration_seconds
  FROM public.ai_voice_settings vs
  JOIN public.schools s ON s.id = vs.school_id
  LEFT JOIN public.ai_voice_agents va ON va.school_id = vs.school_id
  WHERE (
    vs.twilio_phone_number = v_clean_phone
    OR vs.school_phone_e164 = v_clean_phone
    OR right(regexp_replace(COALESCE(vs.twilio_phone_number, ''), '[^0-9]', '', 'g'), 9) = right(regexp_replace(v_clean_phone, '[^0-9]', '', 'g'), 9)
    OR right(regexp_replace(COALESCE(vs.school_phone_e164, ''), '[^0-9]', '', 'g'), 9) = right(regexp_replace(v_clean_phone, '[^0-9]', '', 'g'), 9)
  )
  AND vs.is_enabled = true
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_by_twilio_phone(text) TO service_role, anon, authenticated;

-- 5. Updated dashboard stats RPC
CREATE OR REPLACE FUNCTION public.get_ai_receptionist_dashboard_stats(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  result jsonb;
  day_start timestamptz := date_trunc('day', now());
BEGIN
  IF v_uid IS NOT NULL AND NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR public.get_user_school_id(v_uid) = p_school_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'calls_today', COUNT(*) FILTER (WHERE started_at >= day_start AND NOT is_archived),
    'completed_today', COUNT(*) FILTER (WHERE started_at >= day_start AND status = 'completed' AND NOT is_archived),
    'escalated_today', COUNT(*) FILTER (WHERE started_at >= day_start AND (status = 'escalated' OR escalated = true) AND NOT is_archived),
    'avg_duration_seconds', COALESCE(ROUND(AVG(duration_seconds) FILTER (WHERE started_at >= day_start AND duration_seconds > 0)), 0),
    'pending_followups', (
      SELECT COUNT(*) FROM public.ai_actions a
      WHERE a.school_id = p_school_id AND a.status = 'pending' AND NOT a.is_archived
    ),
    'knowledge_articles', (
      SELECT COUNT(*) FROM public.ai_knowledge_base k
      WHERE k.school_id = p_school_id AND k.is_published AND NOT k.is_archived
    ),
    'avg_satisfaction', COALESCE(ROUND(AVG(satisfaction_score) FILTER (WHERE started_at >= day_start AND satisfaction_score IS NOT NULL), 1), 0),
    'total_calls', COUNT(*) FILTER (WHERE NOT is_archived)
  )
  INTO result
  FROM public.ai_calls
  WHERE school_id = p_school_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_receptionist_dashboard_stats(uuid) TO authenticated, service_role;
