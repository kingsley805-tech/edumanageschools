-- Paystack payment columns (run if confirm succeeds on Paystack but invoice stays unpaid)

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS payer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gateway_config_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_payments_gateway_config_id_fkey'
  ) THEN
    ALTER TABLE public.billing_payments
      ADD CONSTRAINT billing_payments_gateway_config_id_fkey
      FOREIGN KEY (gateway_config_id)
      REFERENCES public.tenant_payment_gateway_configs(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
