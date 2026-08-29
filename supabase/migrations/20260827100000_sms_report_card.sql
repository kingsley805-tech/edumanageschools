-- SMS Report Card settings + shareable PDF URL on term report cards

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS sms_auto_send_report_card boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_teacher_can_send_report_card boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_report_card_template text;

ALTER TABLE public.term_report_cards
  ADD COLUMN IF NOT EXISTS report_pdf_url text;

COMMENT ON COLUMN public.school_settings.sms_auto_send_report_card IS
  'When true, deliverReportToParents also SMS-es linked parents with a PDF download link.';
COMMENT ON COLUMN public.school_settings.sms_teacher_can_send_report_card IS
  'When true, teachers may manually SMS a student report card to linked parents.';
COMMENT ON COLUMN public.school_settings.sms_report_card_template IS
  'SMS body template. Placeholders: {student_name}, {school_name}, {term}, {pdf_link}';
COMMENT ON COLUMN public.term_report_cards.report_pdf_url IS
  'Public URL to the uploaded report card PDF for SMS/WhatsApp sharing.';
