-- EduManage AI Assistant tables (run once in Supabase SQL Editor)
-- https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new
-- Then: Settings → API → Reload schema

-- (same as supabase/migrations/20260621120000_ai_assistant.sql)

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  module_context text,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_school ON public.ai_conversations(school_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  tokens integer NOT NULL DEFAULT 0,
  feedback text CHECK (feedback IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.ai_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  module_context text,
  prompt_preview text,
  tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_school_month ON public.ai_usage_logs(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  prompt text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai conversations own" ON public.ai_conversations;
CREATE POLICY "ai conversations own" ON public.ai_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai messages via conversation" ON public.ai_messages;
CREATE POLICY "ai messages via conversation" ON public.ai_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai favorites own" ON public.ai_favorites;
CREATE POLICY "ai favorites own" ON public.ai_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai usage own read" ON public.ai_usage_logs;
CREATE POLICY "ai usage own read" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR school_id IN (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "ai templates read" ON public.ai_prompt_templates;
CREATE POLICY "ai templates read" ON public.ai_prompt_templates
  FOR SELECT TO authenticated
  USING (is_system = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "ai templates write own" ON public.ai_prompt_templates;
CREATE POLICY "ai templates write own" ON public.ai_prompt_templates
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND is_system = false)
  WITH CHECK (user_id = auth.uid() AND is_system = false);

NOTIFY pgrst, 'reload schema';

-- ========== Gemini RPC (no Edge Function deploy required) ==========

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.platform_ai_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gemini_api_key text,
  monthly_request_limit integer NOT NULL DEFAULT 1000,
  ai_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_ai_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_ai_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform ai config super admin" ON public.platform_ai_config;
CREATE POLICY "platform ai config super admin" ON public.platform_ai_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.upsert_platform_gemini_key(
  p_api_key text,
  p_monthly_limit integer DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Super Admin access required');
  END IF;

  IF coalesce(trim(p_api_key), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'API key is required');
  END IF;

  INSERT INTO public.platform_ai_config (id, gemini_api_key, monthly_request_limit, updated_at)
  VALUES (1, trim(p_api_key), greatest(coalesce(p_monthly_limit, 1000), 1), now())
  ON CONFLICT (id) DO UPDATE
  SET gemini_api_key = EXCLUDED.gemini_api_key,
      monthly_request_limit = EXCLUDED.monthly_request_limit,
      updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_platform_gemini_key(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.gemini_chat(
  p_message text,
  p_history jsonb DEFAULT '[]'::jsonb,
  p_context jsonb DEFAULT '{}'::jsonb,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile record;
  v_cfg record;
  v_school_name text;
  v_system text;
  v_contents jsonb := '[]'::jsonb;
  v_item jsonb;
  v_role text;
  v_body jsonb;
  v_url text;
  v_http extensions.http_response;
  v_resp jsonb;
  v_text text;
  v_tokens integer := 0;
  v_month_start timestamptz;
  v_monthly_count bigint := 0;
  v_limit integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  IF coalesce(trim(p_message), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Message is required');
  END IF;

  SELECT p.school_id, p.full_name INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_profile.school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'School context required');
  END IF;

  SELECT * INTO v_cfg FROM public.platform_ai_config WHERE id = 1;

  IF v_cfg IS NULL OR NOT coalesce(v_cfg.ai_enabled, true) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AI Assistant is disabled for this platform.');
  END IF;

  IF coalesce(trim(v_cfg.gemini_api_key), '') = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Platform AI is not configured yet. The Super Admin must add the shared Gemini API key in AI Assistant.'
    );
  END IF;

  v_limit := coalesce(v_cfg.monthly_request_limit, 1000);
  v_month_start := date_trunc('month', now());

  BEGIN
    SELECT count(*)::bigint INTO v_monthly_count
    FROM public.ai_usage_logs
    WHERE school_id = v_profile.school_id
      AND created_at >= v_month_start;
  EXCEPTION WHEN undefined_table THEN
    v_monthly_count := 0;
  END;

  IF v_monthly_count >= v_limit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      format('Monthly AI request limit (%s) reached for your school.', v_limit)
    );
  END IF;

  SELECT s.name INTO v_school_name FROM public.schools s WHERE s.id = v_profile.school_id;

  v_system := concat_ws(
    E'\n',
    'You are EduManage AI, an expert assistant for school management systems in Ghana and Africa.',
    'Help administrators, teachers, students, parents, and staff with academics, administration, finance, communication, and HR.',
    'Be professional, accurate, and practical. Use clear formatting with headings and bullet lists when helpful.',
    'If you lack specific data, say so and provide a useful template or general guidance.',
    CASE WHEN v_school_name IS NOT NULL THEN 'School: ' || v_school_name ELSE NULL END,
    CASE WHEN v_profile.full_name IS NOT NULL THEN 'User: ' || v_profile.full_name ELSE NULL END,
    CASE WHEN p_context ? 'userRole' THEN 'Role: ' || (p_context ->> 'userRole') ELSE NULL END,
    CASE
      WHEN p_context ? 'moduleLabel' THEN 'Current module: ' || (p_context ->> 'moduleLabel')
      WHEN p_context ? 'module' THEN 'Current module: ' || (p_context ->> 'module')
      ELSE NULL
    END,
    CASE WHEN p_context ? 'pagePath' THEN 'Current page: ' || (p_context ->> 'pagePath') ELSE NULL END
  );

  IF jsonb_typeof(p_history) = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_history)
    LOOP
      v_role := coalesce(v_item ->> 'role', '');
      IF v_role IN ('user', 'assistant') THEN
        v_contents := v_contents || jsonb_build_array(
          jsonb_build_object(
            'role', CASE WHEN v_role = 'assistant' THEN 'model' ELSE 'user' END,
            'parts', jsonb_build_array(jsonb_build_object('text', v_item ->> 'content'))
          )
        );
      END IF;
    END LOOP;
  END IF;

  v_contents := v_contents || jsonb_build_array(
    jsonb_build_object(
      'role', 'user',
      'parts', jsonb_build_array(jsonb_build_object('text', trim(p_message)))
    )
  );

  v_body := jsonb_build_object(
    'systemInstruction', jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text', v_system))),
    'contents', v_contents,
    'generationConfig', jsonb_build_object('temperature', 0.7, 'maxOutputTokens', 2048)
  );

  v_url := 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' || v_cfg.gemini_api_key;

  BEGIN
    PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '120');
    PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '30');

    SELECT * INTO v_http
    FROM extensions.http((
      'POST',
      v_url,
      ARRAY[
        extensions.http_header('Content-Type', 'application/json')
      ],
      'application/json',
      v_body::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%timed out%' OR SQLERRM ILIKE '%timeout%' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Gemini request timed out. Run public/sql/patch-gemini-chat-timeout.sql in Supabase, or try a shorter message.'
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
  END;

  BEGIN
    v_resp := v_http.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_http.content, 'Invalid response from Gemini'));
  END;

  IF v_http.status < 200 OR v_http.status >= 300 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      coalesce(v_resp #>> '{error,message}', v_http.content, 'Gemini API request failed')
    );
  END IF;

  v_text := (
    SELECT string_agg(part ->> 'text', '')
    FROM jsonb_array_elements(coalesce(v_resp #> '{candidates,0,content,parts}', '[]'::jsonb)) AS part
  );

  IF coalesce(trim(v_text), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Empty response from Gemini');
  END IF;

  v_tokens := coalesce((v_resp #>> '{usageMetadata,totalTokenCount}')::integer, 0);

  BEGIN
    INSERT INTO public.ai_usage_logs (
      school_id, user_id, conversation_id, module_context, prompt_preview, tokens
    ) VALUES (
      v_profile.school_id,
      v_uid,
      p_conversation_id,
      coalesce(p_context ->> 'moduleLabel', p_context ->> 'module'),
      left(trim(p_message), 200),
      v_tokens
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'content', trim(v_text), 'tokens', v_tokens);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gemini_chat(text, jsonb, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.gemini_chat_usage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_cfg record;
  v_month_start timestamptz;
  v_total_requests bigint := 0;
  v_total_tokens bigint := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  SELECT p.school_id INTO v_school_id FROM public.profiles p WHERE p.id = v_uid;
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'School context required');
  END IF;

  SELECT * INTO v_cfg FROM public.platform_ai_config WHERE id = 1;
  v_month_start := date_trunc('month', now());

  BEGIN
    SELECT count(*)::bigint, coalesce(sum(tokens), 0)::bigint
    INTO v_total_requests, v_total_tokens
    FROM public.ai_usage_logs
    WHERE school_id = v_school_id AND created_at >= v_month_start;
  EXCEPTION WHEN undefined_table THEN
    v_total_requests := 0;
    v_total_tokens := 0;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'totalRequests', v_total_requests,
    'totalTokens', v_total_tokens,
    'monthlyLimit', coalesce(v_cfg.monthly_request_limit, 1000),
    'remaining', greatest(0, coalesce(v_cfg.monthly_request_limit, 1000) - v_total_requests)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gemini_chat_usage_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_ai_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_build_object(
        'configured', coalesce(trim(gemini_api_key), '') <> '',
        'enabled', coalesce(ai_enabled, true)
      )
      FROM public.platform_ai_config
      WHERE id = 1
    ),
    jsonb_build_object('configured', false, 'enabled', true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_ai_status() TO authenticated;

NOTIFY pgrst, 'reload schema';
