-- EduManage AI Receptionist (virtual school voice assistant)
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Voice agent profile (persona + greeting)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_voice_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Emma',
  display_title text NOT NULL DEFAULT 'Virtual school assistant',
  greeting text NOT NULL DEFAULT 'Good morning. Thank you for calling. How may I assist you today?',
  voice_style text NOT NULL DEFAULT 'warm_professional',
  languages text[] NOT NULL DEFAULT ARRAY['en', 'en-GH'],
  is_active boolean NOT NULL DEFAULT true,
  handover_phone text,
  escalation_keywords text[] NOT NULL DEFAULT ARRAY['emergency', 'ambulance', 'abuse', 'human', 'manager'],
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id)
);

-- ---------------------------------------------------------------------------
-- Telephony / voice settings (Twilio etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_voice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'twilio'
    CHECK (provider IN ('twilio', 'vonage', 'plivo', 'custom', 'none')),
  school_phone_e164 text,
  twilio_account_sid text,
  twilio_auth_token_encrypted text,
  twilio_phone_number text,
  webhook_url text,
  recording_enabled boolean NOT NULL DEFAULT true,
  outbound_enabled boolean NOT NULL DEFAULT false,
  verification_mode text NOT NULL DEFAULT 'registered_phone'
    CHECK (verification_mode IN ('registered_phone', 'parent_pin', 'otp', 'security_questions')),
  is_enabled boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id)
);

-- ---------------------------------------------------------------------------
-- Editable knowledge base
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN (
      'admissions', 'school_info', 'academics', 'student_life',
      'finance', 'events', 'policies', 'general'
    )),
  title text NOT NULL,
  content text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'en',
  is_published boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_kb_school ON public.ai_knowledge_base(school_id);
CREATE INDEX IF NOT EXISTS idx_ai_kb_category ON public.ai_knowledge_base(school_id, category);

-- ---------------------------------------------------------------------------
-- Calls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_voice_agents(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'inbound'
    CHECK (direction IN ('inbound', 'outbound')),
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN (
      'ringing', 'in_progress', 'completed', 'missed',
      'failed', 'escalated', 'voicemail'
    )),
  caller_phone text,
  caller_name text,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  language text,
  detected_intent text,
  sentiment text
    CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  satisfaction_score numeric(3,1),
  summary text,
  follow_up_status text NOT NULL DEFAULT 'none'
    CHECK (follow_up_status IN ('none', 'pending', 'in_progress', 'resolved')),
  provider_call_sid text,
  is_verified boolean NOT NULL DEFAULT false,
  recording_url text,
  recording_storage_path text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_calls_school ON public.ai_calls(school_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_started ON public.ai_calls(school_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_calls_status ON public.ai_calls(school_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_calls_student ON public.ai_calls(student_id);

CREATE TABLE IF NOT EXISTS public.ai_call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES public.ai_calls(id) ON DELETE CASCADE,
  speaker text NOT NULL CHECK (speaker IN ('ai', 'caller', 'staff', 'system')),
  content text NOT NULL,
  spoken_at timestamptz NOT NULL DEFAULT now(),
  sequence_no integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_transcripts_call ON public.ai_call_transcripts(call_id, sequence_no);

CREATE TABLE IF NOT EXISTS public.ai_call_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES public.ai_calls(id) ON DELETE CASCADE,
  storage_path text,
  public_url text,
  duration_seconds integer,
  mime_type text,
  bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_conversation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES public.ai_calls(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_logs_call ON public.ai_conversation_logs(call_id);

-- ---------------------------------------------------------------------------
-- Actions / follow-ups / escalations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  call_id uuid REFERENCES public.ai_calls(id) ON DELETE SET NULL,
  action_type text NOT NULL DEFAULT 'follow_up'
    CHECK (action_type IN (
      'follow_up', 'meeting_request', 'attendance_alert',
      'fee_reminder', 'notify_teacher', 'notify_admin', 'other'
    )),
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_department text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled')),
  due_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_school ON public.ai_actions(school_id, status);

CREATE TABLE IF NOT EXISTS public.ai_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  call_id uuid REFERENCES public.ai_calls(id) ON DELETE SET NULL,
  action_id uuid REFERENCES public.ai_actions(id) ON DELETE SET NULL,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'cancelled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES public.ai_calls(id) ON DELETE CASCADE,
  reason text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  handed_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'resolved', 'cancelled')),
  context_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.caller_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  call_id uuid REFERENCES public.ai_calls(id) ON DELETE SET NULL,
  caller_phone text,
  method text NOT NULL DEFAULT 'registered_phone',
  verified boolean NOT NULL DEFAULT false,
  parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  attempts integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill for databases created before is_verified was introduced.
ALTER TABLE public.ai_calls
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Dashboard stats RPC
-- ---------------------------------------------------------------------------
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR public.get_user_school_id(v_uid) = p_school_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'calls_today', COUNT(*) FILTER (WHERE started_at >= day_start AND NOT is_archived),
    'completed_today', COUNT(*) FILTER (WHERE started_at >= day_start AND status = 'completed' AND NOT is_archived),
    'escalated_today', COUNT(*) FILTER (WHERE started_at >= day_start AND status = 'escalated' AND NOT is_archived),
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

GRANT EXECUTE ON FUNCTION public.get_ai_receptionist_dashboard_stats(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caller_verifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_voice_agents',
    'ai_voice_settings',
    'ai_knowledge_base',
    'ai_calls',
    'ai_call_transcripts',
    'ai_call_recordings',
    'ai_conversation_logs',
    'ai_actions',
    'ai_followups',
    'ai_escalations',
    'caller_verifications'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_school_rw ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_school_rw ON public.%I FOR ALL USING (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      ) WITH CHECK (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      )',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Permissions + platform module (premium)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  act text;
  acts text[] := ARRAY['view', 'create', 'edit', 'delete', 'export', 'manage'];
BEGIN
  FOREACH act IN ARRAY acts LOOP
    INSERT INTO public.permissions (category, module, action, code, description)
    VALUES (
      'communication',
      'portal.ai_receptionist',
      act,
      'portal.ai_receptionist.' || act,
      initcap(act) || ' AI Receptionist'
    )
    ON CONFLICT (code) DO NOTHING;
  END LOOP;
END $$;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('school_admin', 'super_admin')
  AND p.code LIKE 'portal.ai_receptionist.%'
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_modules (key, name, description, category, portal_module_key, is_active)
VALUES (
  'ai_receptionist',
  'AI Receptionist',
  'Virtual school voice receptionist for parent calls, knowledge base, and call management.',
  'communication',
  'ai_receptionist',
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  portal_module_key = EXCLUDED.portal_module_key,
  is_active = true;
