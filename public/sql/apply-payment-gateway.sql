-- Payment gateway config (school-scoped, ported from edubill org_id model)

CREATE TABLE IF NOT EXISTS public.tenant_payment_gateway_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN (
    'paystack', 'flutterwave', 'stripe', 'paypal', 'mobile_money', 'bank_transfer'
  )),
  is_enabled boolean NOT NULL DEFAULT true,
  is_test_mode boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('disconnected', 'connected', 'error')),
  last_validated_at timestamptz,
  merchant_email text,
  callback_url text,
  public_key text,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paystack_secret_key text,
  CONSTRAINT uq_tenant_gateway_provider UNIQUE (school_id, provider)
);

ALTER TABLE public.tenant_payment_gateway_configs
  ADD COLUMN IF NOT EXISTS paystack_secret_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_one_default_gateway_school
  ON public.tenant_payment_gateway_configs (school_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateway_school
  ON public.tenant_payment_gateway_configs (school_id, provider, is_enabled);

ALTER TABLE public.tenant_payment_gateway_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school admins view payment gateway configs" ON public.tenant_payment_gateway_configs;
CREATE POLICY "school admins view payment gateway configs"
  ON public.tenant_payment_gateway_configs
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.tenant_payment_gateway_secrets (
  gateway_config_id uuid PRIMARY KEY
    REFERENCES public.tenant_payment_gateway_configs(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_payment_gateway_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_payment_gateway_secrets FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.tenant_payment_gateway_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  provider text NOT NULL,
  gateway_config_id uuid REFERENCES public.tenant_payment_gateway_configs(id) ON DELETE SET NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateway_audit_school
  ON public.tenant_payment_gateway_audit (school_id, created_at DESC);

ALTER TABLE public.tenant_payment_gateway_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school admins view payment gateway audit" ON public.tenant_payment_gateway_audit;
CREATE POLICY "school admins view payment gateway audit"
  ON public.tenant_payment_gateway_audit
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.payment_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_type text,
  reference text,
  signature_valid boolean,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'verified', 'ignored', 'processed', 'failed')),
  payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_school_created
  ON public.payment_webhook_logs (school_id, created_at DESC);

ALTER TABLE public.payment_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance read payment webhook logs" ON public.payment_webhook_logs;
CREATE POLICY "finance read payment webhook logs"
  ON public.payment_webhook_logs
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.payment_checkout_sessions (
  reference text PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  gateway_config_id uuid REFERENCES public.tenant_payment_gateway_configs(id) ON DELETE SET NULL,
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_checkout_sessions_school
  ON public.payment_checkout_sessions (school_id, created_at DESC);

ALTER TABLE public.payment_checkout_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_checkout_sessions FROM anon, authenticated;

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS gateway_config_id uuid
    REFERENCES public.tenant_payment_gateway_configs(id) ON DELETE SET NULL;

-- Billing settings on schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'GHS',
  ADD COLUMN IF NOT EXISTS billing_receipt_footer text,
  ADD COLUMN IF NOT EXISTS billing_invoice_prefix text DEFAULT 'INV';

-- Dashboard member counts RPC
CREATE OR REPLACE FUNCTION public.school_dashboard_billing_counts(_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_students int;
  v_parents int;
  v_teachers int;
  v_accountants int;
BEGIN
  IF _school_id IS NULL THEN
    RETURN jsonb_build_object('students', 0, 'parents', 0, 'teachers', 0, 'accountants', 0);
  END IF;

  SELECT count(*)::int INTO v_students FROM public.students s WHERE s.school_id = _school_id;
  SELECT count(*)::int INTO v_parents FROM public.parents p WHERE p.school_id = _school_id;
  SELECT count(*)::int INTO v_teachers
    FROM public.user_roles ur
    WHERE ur.school_id = _school_id AND ur.role = 'teacher'::app_role;
  SELECT count(*)::int INTO v_accountants
    FROM public.user_roles ur
    WHERE ur.school_id = _school_id AND ur.role = 'accountant'::app_role;

  RETURN jsonb_build_object(
    'students', coalesce(v_students, 0),
    'parents', coalesce(v_parents, 0),
    'teachers', coalesce(v_teachers, 0),
    'accountants', coalesce(v_accountants, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.school_dashboard_billing_counts(uuid) TO authenticated;
