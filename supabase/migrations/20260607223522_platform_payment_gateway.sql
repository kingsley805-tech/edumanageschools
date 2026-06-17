
CREATE TABLE IF NOT EXISTS public.platform_payment_gateway (
  provider text PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT true,
  is_test_mode boolean NOT NULL DEFAULT true,
  public_key text,
  secret_key text,
  webhook_secret text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_payment_gateway TO authenticated;
GRANT ALL ON public.platform_payment_gateway TO service_role;

ALTER TABLE public.platform_payment_gateway ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admins manage platform gateway" ON public.platform_payment_gateway;
CREATE POLICY "super admins manage platform gateway"
  ON public.platform_payment_gateway
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- RPC: edge function fetches secret keys via service role
CREATE OR REPLACE FUNCTION public.get_platform_paystack_config()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_enabled', is_enabled,
    'is_test_mode', is_test_mode,
    'public_key', public_key,
    'secret_key', secret_key,
    'webhook_secret', webhook_secret
  )
  FROM public.platform_payment_gateway
  WHERE provider = 'paystack'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_paystack_config() TO service_role;
