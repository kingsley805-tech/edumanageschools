-- Platform  SMS API key (Super Admin UI + RPC).
-- Run in Supabase SQL Editor after apply-send-attendance-sms-rpc.sql
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.platform_sms_gateway (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_sms_gateway (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_sms_gateway ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admins manage platform sms gateway" ON public.platform_sms_gateway;
CREATE POLICY "super admins manage platform sms gateway" ON public.platform_sms_gateway
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

GRANT SELECT, INSERT, UPDATE ON public.platform_sms_gateway TO authenticated;
GRANT ALL ON public.platform_sms_gateway TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_platform_arkesel_key(p_api_key text)
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

  IF NOT public.is_platform_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Super Admin access required');
  END IF;

  IF coalesce(trim(p_api_key), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'API key is required');
  END IF;

  INSERT INTO public.platform_sms_gateway (id, api_key, updated_at)
  VALUES (true, trim(p_api_key), now())
  ON CONFLICT (id) DO UPDATE
  SET api_key = EXCLUDED.api_key,
      updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_platform_arkesel_key(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_sms_gateway_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_build_object(
        'configured', coalesce(trim(api_key), '') <> '',
        'updated_at', updated_at
      )
      FROM public.platform_sms_gateway
      WHERE id = true
    ),
    jsonb_build_object('configured', false)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_sms_gateway_status() TO authenticated;

NOTIFY pgrst, 'reload schema';
