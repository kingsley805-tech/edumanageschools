-- RBAC: roles, permissions, assignments, approvals, security audit extensions
-- Compatible with existing user_roles (portal) + app_role enum

-- Portal roles for accountant & auditor dashboards
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';

-- ==========================================
-- CORE RBAC TABLES
-- ==========================================

CREATE TABLE public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module      TEXT NOT NULL,
  action      TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);

CREATE TABLE public.roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, slug)
);

CREATE TABLE public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE public.user_role_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  school_id  UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, school_id)
);

CREATE INDEX idx_user_role_assignments_user ON public.user_role_assignments(user_id);
CREATE INDEX idx_user_role_assignments_school ON public.user_role_assignments(school_id);
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX idx_permissions_module ON public.permissions(module);

-- ==========================================
-- APPROVAL WORKFLOWS
-- ==========================================

CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE public.approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  request_type    TEXT NOT NULL,
  module          TEXT NOT NULL,
  record_id       UUID,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          approval_status NOT NULL DEFAULT 'pending',
  requested_by    UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by     UUID REFERENCES auth.users(id),
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX idx_approval_requests_school_status ON public.approval_requests(school_id, status);

-- ==========================================
-- EXTEND AUDIT LOGS (immutable)
-- ==========================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT,
  ADD COLUMN IF NOT EXISTS record_id UUID,
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS new_values JSONB,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Prevent updates/deletes on audit_logs
DROP RULE IF EXISTS audit_logs_no_update ON public.audit_logs;
DROP RULE IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE RULE audit_logs_no_update AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;

-- ==========================================
-- LOGIN ACTIVITY (security monitoring)
-- ==========================================

CREATE TABLE public.login_activity (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id    UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  email        TEXT,
  success      BOOLEAN NOT NULL DEFAULT true,
  ip_address   TEXT,
  user_agent   TEXT,
  failure_reason TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_activity_user ON public.login_activity(user_id, created_at DESC);

-- ==========================================
-- PERMISSION CHECK FUNCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _permission_code TEXT,
  _school_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _permission_code IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Platform super admin: full access
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::app_role
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ura.user_id = _user_id
      AND p.code = _permission_code
      AND (
        _school_id IS NULL
        OR ura.school_id IS NULL
        OR ura.school_id = _school_id
      )
      AND (
        r.school_id IS NULL
        OR _school_id IS NULL
        OR r.school_id = _school_id
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role_slug(
  _user_id UUID,
  _slug TEXT,
  _school_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE ura.user_id = _user_id
      AND r.slug = _slug
      AND (_school_id IS NULL OR ura.school_id IS NULL OR ura.school_id = _school_id)
  )
  OR (
    _slug = 'super_admin' AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_school(
  _user_id UUID,
  _school_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _school_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::app_role
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.super_admin_schools
      WHERE user_id = _user_id AND school_id = _school_id
    )
    OR EXISTS (SELECT 1 FROM public.schools WHERE id = _school_id);
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND school_id = _school_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions(
  _user_id UUID,
  _school_id UUID DEFAULT NULL
)
RETURNS SETOF TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role
  ) THEN
    RETURN QUERY SELECT code FROM public.permissions;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT p.code
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ura.user_id = _user_id
    AND (_school_id IS NULL OR ura.school_id IS NULL OR ura.school_id = _school_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_school_id UUID,
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_module TEXT DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    school_id, action_type, entity_type, entity_id,
    performed_by, module, record_id, old_values, new_values, details
  )
  VALUES (
    p_school_id, p_action_type, p_entity_type, p_entity_id,
    auth.uid(), p_module, p_record_id, p_old_values, p_new_values, p_details
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Notify admins on permission / role changes
CREATE OR REPLACE FUNCTION public.notify_rbac_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_admin RECORD;
BEGIN
  IF TG_TABLE_NAME = 'user_role_assignments' THEN
    v_school_id := COALESCE(NEW.school_id, OLD.school_id);
  ELSIF TG_TABLE_NAME = 'role_permissions' THEN
    SELECT school_id INTO v_school_id FROM public.roles WHERE id = COALESCE(NEW.role_id, OLD.role_id);
  END IF;

  IF v_school_id IS NOT NULL THEN
    FOR v_admin IN
      SELECT DISTINCT p.id AS user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.school_id = v_school_id AND ur.role IN ('admin'::app_role, 'super_admin'::app_role)
    LOOP
      PERFORM public.create_notification(
        v_admin.user_id,
        'Access control updated',
        'Roles or permissions were modified. Review audit logs if unexpected.',
        jsonb_build_object('type', 'rbac_change', 'school_id', v_school_id)
      );
    END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ==========================================
-- SEED PERMISSIONS
-- ==========================================

INSERT INTO public.permissions (module, action, code, description) VALUES
  -- Students
  ('students', 'create', 'students.create', 'Create students'),
  ('students', 'edit', 'students.edit', 'Edit students'),
  ('students', 'delete', 'students.delete', 'Delete students'),
  ('students', 'archive', 'students.archive', 'Archive students'),
  ('students', 'transfer', 'students.transfer', 'Transfer students'),
  ('students', 'import', 'students.import', 'Bulk import students'),
  -- Parents & teachers
  ('parents', 'manage', 'parents.manage', 'Manage parents'),
  ('teachers', 'manage', 'teachers.manage', 'Manage teachers'),
  -- Billing
  ('invoices', 'create', 'invoices.create', 'Create invoice'),
  ('invoices', 'edit', 'invoices.edit', 'Edit invoice'),
  ('invoices', 'delete', 'invoices.delete', 'Delete invoice'),
  ('invoices', 'approve', 'invoices.approve', 'Approve invoice'),
  ('invoices', 'generate_bulk', 'invoices.generate_bulk', 'Bulk generate invoices'),
  ('payments', 'view', 'payments.view', 'View payments'),
  ('payments', 'process', 'payments.process', 'Process payments'),
  ('payments', 'allocate', 'payments.allocate', 'Allocate payments manually'),
  ('payments', 'reverse', 'payments.reverse', 'Reverse payments'),
  ('payments', 'approve_refund', 'payments.approve_refund', 'Approve refunds'),
  ('billing', 'discount', 'billing.apply_discount', 'Apply discounts'),
  ('billing', 'waiver', 'billing.apply_waiver', 'Apply waivers'),
  ('billing', 'fee_templates', 'billing.manage_fee_templates', 'Manage fee templates'),
  ('billing', 'fee_categories', 'billing.manage_fee_categories', 'Manage fee categories'),
  -- Reports
  ('reports', 'view_financial', 'reports.view_financial', 'View financial reports'),
  ('reports', 'export_financial', 'reports.export_financial', 'Export financial reports'),
  ('reports', 'view_academic', 'reports.view_academic', 'View academic reports'),
  -- Academic
  ('reports_cards', 'create', 'reports.create', 'Create report cards'),
  ('reports_cards', 'edit', 'reports.edit', 'Edit report cards'),
  ('reports_cards', 'approve', 'reports.approve', 'Approve report cards'),
  ('reports_cards', 'publish', 'reports.publish', 'Publish report cards'),
  ('reports_cards', 'publish_bulk', 'reports.publish_bulk', 'Bulk publish reports'),
  -- Admin
  ('admin', 'create_staff', 'admin.create_admin', 'Create admin users'),
  ('admin', 'suspend_staff', 'admin.suspend_admin', 'Suspend admin users'),
  ('admin', 'manage_roles', 'admin.manage_roles', 'Manage roles'),
  ('admin', 'manage_permissions', 'admin.manage_permissions', 'Manage permissions'),
  ('admin', 'view_audit', 'admin.view_audit', 'View audit logs'),
  ('admin', 'approve_requests', 'admin.approve_requests', 'Approve sensitive requests'),
  -- Platform (super admin)
  ('platform', 'manage_schools', 'platform.manage_schools', 'Manage all schools'),
  ('platform', 'manage_subscriptions', 'platform.manage_subscriptions', 'Manage subscriptions'),
  ('platform', 'system_config', 'platform.system_config', 'System configuration'),
  ('platform', 'integrations', 'platform.manage_integrations', 'Manage integrations'),
  ('platform', 'backups', 'platform.manage_backups', 'Manage backups'),
  -- School settings
  ('school', 'settings', 'school.manage_settings', 'Manage school settings'),
  ('school', 'grading', 'school.manage_grading', 'Configure grading'),
  ('school', 'analytics', 'school.view_analytics', 'View school analytics'),
  -- Read-only portals
  ('fees', 'view_status', 'fees.view_status', 'View fee status (read-only)')
ON CONFLICT (code) DO NOTHING;

-- ==========================================
-- SEED SYSTEM ROLES
-- ==========================================

INSERT INTO public.roles (school_id, slug, name, description, is_system) VALUES
  (NULL, 'super_admin', 'Super Admin', 'Full platform access', true),
  (NULL, 'school_admin', 'School Admin', 'Manages a single school', true),
  (NULL, 'accountant', 'Accountant / Bursar', 'Finance and billing operations', true),
  (NULL, 'auditor', 'Auditor', 'Read-only financial access', true),
  (NULL, 'teacher', 'Teacher', 'Academic access', true),
  (NULL, 'parent', 'Parent', 'Parent portal access', true)
ON CONFLICT (school_id, slug) DO NOTHING;

-- Helper: assign all permissions to a role slug
CREATE OR REPLACE FUNCTION public._grant_permissions_to_role(_role_slug TEXT, _permission_codes TEXT[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_role_id UUID;
  v_code TEXT;
  v_perm_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE slug = _role_slug AND school_id IS NULL;
  IF v_role_id IS NULL THEN RETURN; END IF;
  FOREACH v_code IN ARRAY _permission_codes LOOP
    SELECT id INTO v_perm_id FROM public.permissions WHERE code = v_code;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Super Admin: all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'super_admin' AND r.school_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- School Admin permissions
SELECT public._grant_permissions_to_role('school_admin', ARRAY[
  'students.create','students.edit','students.delete','students.archive','students.transfer','students.import',
  'parents.manage','teachers.manage',
  'invoices.create','invoices.edit','invoices.approve','invoices.generate_bulk',
  'payments.view','payments.process','payments.allocate',
  'billing.apply_discount','billing.apply_waiver','billing.manage_fee_templates','billing.manage_fee_categories',
  'reports.view_financial','reports.export_financial','reports.view_academic',
  'reports.create','reports.edit','reports.approve','reports.publish','reports.publish_bulk',
  'admin.create_admin','admin.suspend_admin','admin.manage_roles','admin.manage_permissions',
  'admin.view_audit','admin.approve_requests',
  'school.manage_settings','school.manage_grading','school.view_analytics'
]);

-- Accountant
SELECT public._grant_permissions_to_role('accountant', ARRAY[
  'invoices.create','invoices.edit','invoices.generate_bulk',
  'payments.view','payments.process','payments.allocate',
  'billing.apply_discount','billing.apply_waiver','billing.manage_fee_templates','billing.manage_fee_categories',
  'reports.view_financial','reports.export_financial','fees.view_status'
]);

INSERT INTO public.permissions (module, action, code, description) VALUES
  ('invoices', 'view', 'invoices.view', 'View invoices')
ON CONFLICT (code) DO NOTHING;

SELECT public._grant_permissions_to_role('accountant', ARRAY['invoices.view']);

-- Auditor (read-only financial)
SELECT public._grant_permissions_to_role('auditor', ARRAY[
  'invoices.view','payments.view','reports.view_financial','reports.export_financial',
  'admin.view_audit','fees.view_status'
]);

-- Teacher
SELECT public._grant_permissions_to_role('teacher', ARRAY[
  'reports.create','reports.edit','reports.view_academic','fees.view_status'
]);

-- Parent
SELECT public._grant_permissions_to_role('parent', ARRAY[
  'payments.view','payments.process','fees.view_status','reports.view_academic'
]);

DROP FUNCTION public._grant_permissions_to_role(TEXT, TEXT[]);

-- Auto-assign school_admin RBAC when portal admin role is granted
CREATE OR REPLACE FUNCTION public.sync_admin_rbac_on_portal_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_school_id UUID;
BEGIN
  IF NEW.role = 'admin'::app_role THEN
    SELECT id INTO v_role_id FROM public.roles WHERE slug = 'school_admin' AND school_id IS NULL;
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = NEW.user_id;
    IF v_role_id IS NOT NULL AND v_school_id IS NOT NULL THEN
      INSERT INTO public.user_role_assignments (user_id, role_id, school_id, assigned_by)
      VALUES (NEW.user_id, v_role_id, v_school_id, NEW.user_id)
      ON CONFLICT (user_id, role_id, school_id) DO NOTHING;
    END IF;
  ELSIF NEW.role = 'accountant'::app_role THEN
    SELECT id INTO v_role_id FROM public.roles WHERE slug = 'accountant' AND school_id IS NULL;
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = NEW.user_id;
    IF v_role_id IS NOT NULL AND v_school_id IS NOT NULL THEN
      INSERT INTO public.user_role_assignments (user_id, role_id, school_id, assigned_by)
      VALUES (NEW.user_id, v_role_id, v_school_id, NEW.user_id)
      ON CONFLICT (user_id, role_id, school_id) DO NOTHING;
    END IF;
  ELSIF NEW.role = 'auditor'::app_role THEN
    SELECT id INTO v_role_id FROM public.roles WHERE slug = 'auditor' AND school_id IS NULL;
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = NEW.user_id;
    IF v_role_id IS NOT NULL AND v_school_id IS NOT NULL THEN
      INSERT INTO public.user_role_assignments (user_id, role_id, school_id, assigned_by)
      VALUES (NEW.user_id, v_role_id, v_school_id, NEW.user_id)
      ON CONFLICT (user_id, role_id, school_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_rbac ON public.user_roles;
CREATE TRIGGER trg_sync_admin_rbac
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_rbac_on_portal_role();

-- Backfill: assign school_admin RBAC to existing portal admins
INSERT INTO public.user_role_assignments (user_id, role_id, school_id)
SELECT ur.user_id, r.id, p.school_id
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
JOIN public.roles r ON r.slug = 'school_admin' AND r.school_id IS NULL
WHERE ur.role = 'admin'::app_role AND p.school_id IS NOT NULL
ON CONFLICT (user_id, role_id, school_id) DO NOTHING;

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage permissions with admin.manage_permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.manage_permissions', public.get_user_school_id(auth.uid())))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.manage_permissions', public.get_user_school_id(auth.uid())));

CREATE POLICY "Users can view roles"
  ON public.roles FOR SELECT TO authenticated
  USING (
    school_id IS NULL
    OR school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins manage school roles"
  ON public.roles FOR ALL TO authenticated
  USING (
    public.has_permission(auth.uid(), 'admin.manage_roles', COALESCE(school_id, public.get_user_school_id(auth.uid())))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'admin.manage_roles', COALESCE(school_id, public.get_user_school_id(auth.uid())))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Users can view role permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.manage_permissions', public.get_user_school_id(auth.uid()))
    OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.manage_permissions', public.get_user_school_id(auth.uid()))
    OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users view own role assignments"
  ON public.user_role_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'admin.manage_roles', school_id));

CREATE POLICY "Admins manage role assignments"
  ON public.user_role_assignments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.manage_roles', school_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.manage_roles', school_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "School staff view approval requests"
  ON public.approval_requests FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff create approval requests"
  ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND requested_by = auth.uid());

CREATE POLICY "Approvers update requests"
  ON public.approval_requests FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.approve_requests', school_id));

CREATE POLICY "Users view own login activity"
  ON public.login_activity FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'admin.view_audit', school_id));

CREATE POLICY "Insert login activity"
  ON public.login_activity FOR INSERT TO authenticated
  WITH CHECK (true);

-- Auditors can view audit logs
DROP POLICY IF EXISTS "Admins can view school audit logs" ON public.audit_logs;
CREATE POLICY "Staff with audit permission view logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
  public.has_permission(auth.uid(), 'admin.view_audit', school_id)
  OR (public.has_role(auth.uid(), 'admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()))
);

-- Triggers for RBAC notifications
DROP TRIGGER IF EXISTS trg_notify_user_role_assignment ON public.user_role_assignments;
CREATE TRIGGER trg_notify_user_role_assignment
  AFTER INSERT OR UPDATE OR DELETE ON public.user_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_rbac_change();

DROP TRIGGER IF EXISTS trg_notify_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_notify_role_permissions
  AFTER INSERT OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_rbac_change();

-- ==========================================
-- FINANCE RLS: permission-based access
-- ==========================================

DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Finance staff can view invoices" ON public.invoices FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_permission(auth.uid(), 'invoices.view', public.get_user_school_id(auth.uid()))
  OR EXISTS (SELECT 1 FROM students s WHERE s.id = invoices.student_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id WHERE p.user_id = auth.uid() AND s.id = invoices.student_id)
);
CREATE POLICY "Finance staff can manage invoices" ON public.invoices FOR ALL USING (
  (public.has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM students st WHERE st.id = invoices.student_id AND st.school_id = public.get_user_school_id(auth.uid())
  ))
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_permission(auth.uid(), 'invoices.edit', public.get_user_school_id(auth.uid()))
  OR public.has_permission(auth.uid(), 'invoices.create', public.get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
CREATE POLICY "Finance staff can manage payments" ON public.payments FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_permission(auth.uid(), 'payments.process', public.get_user_school_id(auth.uid()))
  OR public.has_permission(auth.uid(), 'payments.view', public.get_user_school_id(auth.uid()))
  OR auth.uid() = payer_user_id
);
