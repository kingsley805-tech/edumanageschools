-- WhatsApp delivery, weekly student attention, POS terminal payment method

-- ---------------------------------------------------------------------------
-- 1. POS Terminal as a first-class billing payment method
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'billing_payment_method'
      AND e.enumlabel = 'pos_terminal'
  ) THEN
    ALTER TYPE public.billing_payment_method ADD VALUE 'pos_terminal';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Parent WhatsApp number (optional; falls back to phone / emergency)
-- ---------------------------------------------------------------------------
ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

COMMENT ON COLUMN public.parents.whatsapp_number IS
  'Preferred WhatsApp contact for the parent/guardian. Falls back to phone / emergency_contact when null.';

-- ---------------------------------------------------------------------------
-- 3. School WhatsApp / communication / POS settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_provider text NOT NULL DEFAULT 'cloud_api',
  ADD COLUMN IF NOT EXISTS whatsapp_default_country_code text NOT NULL DEFAULT '233',
  ADD COLUMN IF NOT EXISTS whatsapp_auto_send_fee_receipt boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_auto_send_fee_notification boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_auto_send_report_card boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_auto_send_weekly_attention boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_fee_receipt_template text,
  ADD COLUMN IF NOT EXISTS whatsapp_fee_notification_template text,
  ADD COLUMN IF NOT EXISTS whatsapp_report_card_template text,
  ADD COLUMN IF NOT EXISTS whatsapp_weekly_attention_template text,
  ADD COLUMN IF NOT EXISTS pos_terminal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pos_terminal_label text NOT NULL DEFAULT 'POS Terminal',
  ADD COLUMN IF NOT EXISTS pos_require_reference boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.school_settings.whatsapp_enabled IS
  'When true, school staff can queue WhatsApp messages to linked parent contacts.';

-- ---------------------------------------------------------------------------
-- 4. WhatsApp delivery log (queued / sent / failed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  recipient_phone text,
  recipient_name text,
  message_type text NOT NULL,
  -- fee_receipt | fee_notification | report_card | weekly_attention | custom
  related_entity_type text,
  related_entity_id uuid,
  message_body text,
  document_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'skipped')),
  provider text,
  provider_message_id text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_deliveries_idempotency_uidx
  ON public.whatsapp_deliveries (school_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_deliveries_school_created_idx
  ON public.whatsapp_deliveries (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_deliveries_status_idx
  ON public.whatsapp_deliveries (school_id, status);

CREATE INDEX IF NOT EXISTS whatsapp_deliveries_related_idx
  ON public.whatsapp_deliveries (related_entity_type, related_entity_id);

ALTER TABLE public.whatsapp_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School staff can view whatsapp deliveries" ON public.whatsapp_deliveries;
CREATE POLICY "School staff can view whatsapp deliveries"
  ON public.whatsapp_deliveries
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'accountant')
        OR public.has_role(auth.uid(), 'teacher')
      )
    )
  );

DROP POLICY IF EXISTS "School staff can insert whatsapp deliveries" ON public.whatsapp_deliveries;
CREATE POLICY "School staff can insert whatsapp deliveries"
  ON public.whatsapp_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'accountant')
        OR public.has_role(auth.uid(), 'teacher')
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update whatsapp deliveries" ON public.whatsapp_deliveries;
CREATE POLICY "Admins can update whatsapp deliveries"
  ON public.whatsapp_deliveries
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'accountant')
        OR public.has_role(auth.uid(), 'teacher')
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR school_id = public.get_user_school_id(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5. Weekly student attention reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_attention_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  attention_summary text NOT NULL,
  academic_notes text,
  behavioural_notes text,
  recommendations text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'sent', 'failed')),
  sent_via_whatsapp_at timestamptz,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  whatsapp_delivery_id uuid REFERENCES public.whatsapp_deliveries(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_attention_school_week_idx
  ON public.weekly_attention_reports (school_id, week_start DESC);

CREATE INDEX IF NOT EXISTS weekly_attention_student_idx
  ON public.weekly_attention_reports (student_id, week_start DESC);

CREATE INDEX IF NOT EXISTS weekly_attention_class_idx
  ON public.weekly_attention_reports (class_id, week_start DESC);

ALTER TABLE public.weekly_attention_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view weekly attention" ON public.weekly_attention_reports;
CREATE POLICY "Staff can view weekly attention"
  ON public.weekly_attention_reports
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'teacher')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      JOIN public.parents p ON p.id = psl.parent_id
      WHERE psl.student_id = weekly_attention_reports.student_id
        AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.parents p ON p.id = s.guardian_id
      WHERE s.id = weekly_attention_reports.student_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can insert weekly attention" ON public.weekly_attention_reports;
CREATE POLICY "Staff can insert weekly attention"
  ON public.weekly_attention_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'teacher')
      )
    )
  );

DROP POLICY IF EXISTS "Staff can update weekly attention" ON public.weekly_attention_reports;
CREATE POLICY "Staff can update weekly attention"
  ON public.weekly_attention_reports
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'teacher')
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR school_id = public.get_user_school_id(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete weekly attention" ON public.weekly_attention_reports;
CREATE POLICY "Admins can delete weekly attention"
  ON public.weekly_attention_reports
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.has_role(auth.uid(), 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Portal permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (category, module, action, code, description)
VALUES
  ('communication', 'portal.whatsapp', 'view', 'portal.whatsapp.view', 'View WhatsApp settings and delivery logs'),
  ('communication', 'portal.whatsapp', 'manage', 'portal.whatsapp.manage', 'Configure WhatsApp and resend messages'),
  ('communication', 'portal.whatsapp', 'create', 'portal.whatsapp.create', 'Send WhatsApp messages to parents'),
  ('academics', 'portal.weekly_attention', 'view', 'portal.weekly_attention.view', 'View weekly student attention reports'),
  ('academics', 'portal.weekly_attention', 'create', 'portal.weekly_attention.create', 'Create weekly attention reports'),
  ('academics', 'portal.weekly_attention', 'edit', 'portal.weekly_attention.edit', 'Edit weekly attention reports'),
  ('academics', 'portal.weekly_attention', 'manage', 'portal.weekly_attention.manage', 'Manage and send weekly attention via WhatsApp'),
  ('administration', 'portal.administration_settings', 'view', 'portal.administration_settings.view', 'View administration settings hub'),
  ('administration', 'portal.administration_settings', 'edit', 'portal.administration_settings.edit', 'Edit administration settings'),
  ('administration', 'portal.administration_settings', 'manage', 'portal.administration_settings.manage', 'Manage administration settings')
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('school_admin', 'super_admin', 'admin')
  AND r.school_id IS NULL
  AND (
    p.code LIKE 'portal.whatsapp.%'
    OR p.code LIKE 'portal.weekly_attention.%'
    OR p.code LIKE 'portal.administration_settings.%'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Teachers get weekly attention + send WhatsApp (not full WhatsApp config)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('teacher', 'class_teacher')
  AND r.school_id IS NULL
  AND p.code IN (
    'portal.weekly_attention.view',
    'portal.weekly_attention.create',
    'portal.weekly_attention.edit',
    'portal.weekly_attention.manage',
    'portal.whatsapp.create',
    'portal.whatsapp.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
