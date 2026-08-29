-- SMS Report Card settings (run in Supabase SQL editor if needed)

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS sms_auto_send_report_card boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_teacher_can_send_report_card boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_report_card_template text;

ALTER TABLE public.term_report_cards
  ADD COLUMN IF NOT EXISTS report_pdf_url text;
