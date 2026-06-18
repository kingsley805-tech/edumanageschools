-- Teacher attendance page: parent SMS logs, settings, templates
-- Run after apply-attendance-sms-system.sql and apply-sms-subscription-billing.sql
--
-- Also required (Supabase Dashboard):
--   1. Edge Functions → send-attendance-sms → paste supabase/functions/send-attendance-sms/index.ts
--   2. JWT verification OFF for send-attendance-sms
--   3. Secrets: ARKESEL_API_KEY (same key used for other SMS)

CREATE TABLE IF NOT EXISTS public.attendance_sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  register_id uuid REFERENCES public.class_registers(id) ON DELETE SET NULL,
  attendance_date date NOT NULL,
  attendance_status text NOT NULL,
  phone_number text,
  message text,
  sms_status text NOT NULL DEFAULT 'queued',
  error_message text,
  source text NOT NULL DEFAULT 'teacher_attendance',
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_attendance_sms_logs_school_created
  ON public.attendance_sms_logs (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_sms_logs_student_date
  ON public.attendance_sms_logs (student_id, class_id, attendance_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_sms_logs_dedupe_sent
  ON public.attendance_sms_logs (student_id, class_id, attendance_date, attendance_status)
  WHERE sms_status = 'sent';

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS sms_attendance_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_template_present text,
  ADD COLUMN IF NOT EXISTS sms_template_absent text,
  ADD COLUMN IF NOT EXISTS sms_template_late text,
  ADD COLUMN IF NOT EXISTS sms_template_default text;

ALTER TABLE public.attendance_sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance sms logs school read" ON public.attendance_sms_logs;
CREATE POLICY "attendance sms logs school read" ON public.attendance_sms_logs
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "attendance sms logs service all" ON public.attendance_sms_logs;
CREATE POLICY "attendance sms logs service all" ON public.attendance_sms_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.attendance_sms_logs TO authenticated;
GRANT ALL ON public.attendance_sms_logs TO service_role;

NOTIFY pgrst, 'reload schema';
