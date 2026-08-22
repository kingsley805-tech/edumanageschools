-- POS receipt numbering, WhatsApp delivery tracking on payments, extended payment methods

DO $$
BEGIN
  ALTER TYPE public.billing_payment_method ADD VALUE IF NOT EXISTS 'cheque';
  ALTER TYPE public.billing_payment_method ADD VALUE IF NOT EXISTS 'bank_deposit';
  ALTER TYPE public.billing_payment_method ADD VALUE IF NOT EXISTS 'other';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS sent_via_whatsapp_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_delivery_id uuid REFERENCES public.whatsapp_deliveries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_status text NOT NULL DEFAULT 'not_sent';

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payments_receipt_number
  ON public.billing_payments (school_id, receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payments_whatsapp_delivery
  ON public.billing_payments (whatsapp_delivery_id)
  WHERE whatsapp_delivery_id IS NOT NULL;

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS pos_enabled_payment_methods jsonb NOT NULL DEFAULT '["cash","mobile_money","bank_transfer","bank_deposit","card","cheque","pos_terminal","other"]'::jsonb,
  ADD COLUMN IF NOT EXISTS pos_auto_print_receipt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_receipt_paper_width_mm integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS whatsapp_send_receipt_pdf boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.billing_payments.whatsapp_status IS 'not_sent | queued | sending | sent | failed | retry_pending';

NOTIFY pgrst, 'reload schema';
