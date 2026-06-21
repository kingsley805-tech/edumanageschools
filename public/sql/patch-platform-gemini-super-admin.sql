-- Patch: platform Gemini key is Super Admin only (shared across all schools)
-- Run in Supabase SQL Editor if AI was set up before this change.

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

-- Re-apply gemini_chat from apply-ai-assistant.sql if the not-configured message should update.

NOTIFY pgrst, 'reload schema';
