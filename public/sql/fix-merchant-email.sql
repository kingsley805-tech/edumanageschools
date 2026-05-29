-- Set Paystack merchant email for student checkout (run in Supabase SQL Editor)
-- Replace the email and school_id if needed.

UPDATE public.tenant_payment_gateway_configs
SET
  merchant_email = 'kingsleyyeboah805@gmail.com',
  is_enabled = true,
  updated_at = now()
WHERE provider = 'paystack';

-- Verify (should show your email):
SELECT school_id, provider, is_enabled, merchant_email, public_key IS NOT NULL AS has_public_key
FROM public.tenant_payment_gateway_configs
WHERE provider = 'paystack';

NOTIFY pgrst, 'reload schema';
