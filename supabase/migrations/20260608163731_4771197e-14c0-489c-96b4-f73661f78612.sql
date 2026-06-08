
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  identifier text NOT NULL,
  code_hash text NOT NULL,
  delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_otps_user_id_idx ON public.password_reset_otps(user_id);
CREATE INDEX IF NOT EXISTS password_reset_otps_expires_at_idx ON public.password_reset_otps(expires_at);

GRANT ALL ON public.password_reset_otps TO service_role;

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (which bypasses RLS) can access OTP rows.
-- Users interact via the password-reset-otp edge function only.
