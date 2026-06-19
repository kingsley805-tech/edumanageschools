-- Google Meet OAuth without Edge Functions (run in Supabase SQL Editor)
-- Enables Online Learning connect flow via database RPC + school settings.

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.school_google_oauth_config (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  redirect_uri text NOT NULL DEFAULT 'http://localhost:8080/admin/online-learning/oauth/callback',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_google_oauth_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school google oauth admin" ON public.school_google_oauth_config;
CREATE POLICY "school google oauth admin" ON public.school_google_oauth_config
  FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE OR REPLACE FUNCTION public.get_google_oauth_public_config(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  IF p_school_id IS DISTINCT FROM public.get_user_school_id(v_uid)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'School access denied');
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'client_id', c.client_id,
      'redirect_uri', c.redirect_uri,
      'configured', true
    )
    FROM public.school_google_oauth_config c
    WHERE c.school_id = p_school_id
  ) ?? jsonb_build_object('configured', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_google_oauth_public_config(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_google_oauth_config(
  p_school_id uuid,
  p_client_id text,
  p_client_secret text,
  p_redirect_uri text
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
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin access required');
  END IF;

  IF p_school_id IS DISTINCT FROM public.get_user_school_id(v_uid)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'School access denied');
  END IF;

  IF coalesce(trim(p_client_id), '') = '' OR coalesce(trim(p_client_secret), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Client ID and Client Secret are required');
  END IF;

  INSERT INTO public.school_google_oauth_config (school_id, client_id, client_secret, redirect_uri, updated_at)
  VALUES (
    p_school_id,
    trim(p_client_id),
    trim(p_client_secret),
    coalesce(nullif(trim(p_redirect_uri), ''), 'http://localhost:8080/admin/online-learning/oauth/callback'),
    now()
  )
  ON CONFLICT (school_id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    client_secret = EXCLUDED.client_secret,
    redirect_uri = EXCLUDED.redirect_uri,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_google_oauth_config(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.exchange_google_oauth_code(
  p_code text,
  p_redirect_uri text,
  p_state text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := trim(coalesce(p_code, ''));
  v_redirect text := trim(coalesce(p_redirect_uri, ''));
  v_school_id uuid;
  v_cfg record;
  v_http extensions.http_response;
  v_tokens jsonb;
  v_user_http extensions.http_response;
  v_user jsonb;
  v_expires_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  IF v_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing authorization code');
  END IF;

  v_school_id := public.get_user_school_id(v_uid);

  IF p_state IS NOT NULL AND p_state <> '' THEN
    BEGIN
      v_school_id := coalesce(
        (convert_from(decode(p_state, 'base64'), 'utf8')::jsonb ->> 'schoolId')::uuid,
        v_school_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'School context required');
  END IF;

  SELECT * INTO v_cfg
  FROM public.school_google_oauth_config
  WHERE school_id = v_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Google OAuth is not configured. Add Client ID and Secret on the Online Learning page.');
  END IF;

  IF v_redirect = '' THEN
    v_redirect := v_cfg.redirect_uri;
  END IF;

  BEGIN
    SELECT * INTO v_http
    FROM extensions.http((
      'POST',
      'https://oauth2.googleapis.com/token',
      ARRAY[
        extensions.http_header('Content-Type', 'application/x-www-form-urlencoded')
      ],
      'application/x-www-form-urlencoded',
      'code=' || replace(v_code, '&', '%26')
        || '&client_id=' || replace(v_cfg.client_id, '&', '%26')
        || '&client_secret=' || replace(v_cfg.client_secret, '&', '%26')
        || '&redirect_uri=' || replace(v_redirect, '&', '%26')
        || '&grant_type=authorization_code'
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Could not reach Google OAuth. Enable the http extension in Supabase → Database → Extensions.');
  END;

  IF v_http.status IS NULL OR v_http.status < 200 OR v_http.status >= 300 THEN
    BEGIN
      v_tokens := v_http.content::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_tokens := '{}'::jsonb;
    END;
    RETURN jsonb_build_object('ok', false, 'error',
      coalesce(v_tokens ->> 'error_description', v_tokens ->> 'error', 'Google OAuth token exchange failed'));
  END IF;

  v_tokens := v_http.content::jsonb;

  BEGIN
    SELECT * INTO v_user_http
    FROM extensions.http((
      'GET',
      'https://www.googleapis.com/oauth2/v2/userinfo',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || (v_tokens ->> 'access_token'))
      ],
      NULL::text,
      NULL::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Failed to fetch Google profile');
  END;

  IF v_user_http.status IS NULL OR v_user_http.status < 200 OR v_user_http.status >= 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Failed to fetch Google profile');
  END IF;

  v_user := v_user_http.content::jsonb;
  v_expires_at := now() + make_interval(secs => coalesce((v_tokens ->> 'expires_in')::int, 3600));

  INSERT INTO public.google_workspace_connections (
    school_id,
    google_account_id,
    google_email,
    access_token,
    refresh_token,
    token_expires_at,
    scopes,
    connected_by,
    connected_at,
    updated_at
  )
  VALUES (
    v_school_id,
    v_user ->> 'id',
    v_user ->> 'email',
    v_tokens ->> 'access_token',
    v_tokens ->> 'refresh_token',
    v_expires_at,
    ARRAY[
      'https://www.googleapis.com/auth/calendar.events',
      'openid',
      'email',
      'profile'
    ],
    v_uid,
    now(),
    now()
  )
  ON CONFLICT (school_id) DO UPDATE SET
    google_account_id = EXCLUDED.google_account_id,
    google_email = EXCLUDED.google_email,
    access_token = EXCLUDED.access_token,
    refresh_token = coalesce(EXCLUDED.refresh_token, public.google_workspace_connections.refresh_token),
    token_expires_at = EXCLUDED.token_expires_at,
    scopes = EXCLUDED.scopes,
    connected_by = EXCLUDED.connected_by,
    updated_at = now();

  IF to_regclass('public.live_class_audit_logs') IS NOT NULL THEN
    INSERT INTO public.live_class_audit_logs (school_id, actor_id, action, entity_type, metadata)
    VALUES (v_school_id, v_uid, 'google_connected', 'google_workspace_connections',
      jsonb_build_object('email', v_user ->> 'email'));
  END IF;

  RETURN jsonb_build_object('ok', true, 'email', v_user ->> 'email');
END;
$$;

GRANT EXECUTE ON FUNCTION public.exchange_google_oauth_code(text, text, text) TO authenticated;
