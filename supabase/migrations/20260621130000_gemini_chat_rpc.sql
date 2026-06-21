-- Gemini chat RPC (no gemini-chat Edge Function required)

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

  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_role(v_uid, 'admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin access required');
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
      'GEMINI_API_KEY is not configured. In Supabase SQL Editor run: SELECT public.upsert_platform_gemini_key(''your-google-ai-key'');'
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
    'generationConfig', jsonb_build_object('temperature', 0.7, 'maxOutputTokens', 4096)
  );

  v_url := 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' || v_cfg.gemini_api_key;

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

NOTIFY pgrst, 'reload schema';
