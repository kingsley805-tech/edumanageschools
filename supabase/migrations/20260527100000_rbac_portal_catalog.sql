-- Portal RBAC catalog: granular permissions, new roles, permission_logs

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Dedicated permission change audit trail
CREATE TABLE IF NOT EXISTS public.permission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  permission_code text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permission_logs_school ON public.permission_logs(school_id, created_at DESC);

ALTER TABLE public.permission_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school staff read permission logs" ON public.permission_logs;
CREATE POLICY "school staff read permission logs" ON public.permission_logs
  FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "admins insert permission logs" ON public.permission_logs;
CREATE POLICY "admins insert permission logs" ON public.permission_logs
  FOR INSERT WITH CHECK (
    public.has_permission(auth.uid(), 'portal.staff_access.manage', school_id)
    OR public.has_permission(auth.uid(), 'admin.manage_permissions', school_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role)
  );

-- Seed portal module permissions (idempotent)
INSERT INTO public.permissions (category, module, action, code, description) VALUES
  ('dashboard', 'portal.dashboard', 'view', 'portal.dashboard.view', 'View Dashboard'),
  ('academics', 'portal.students', 'view', 'portal.students.view', 'View Students'),
  ('academics', 'portal.students', 'create', 'portal.students.create', 'Create Students'),
  ('academics', 'portal.students', 'edit', 'portal.students.edit', 'Edit Students'),
  ('academics', 'portal.students', 'delete', 'portal.students.delete', 'Delete Students'),
  ('academics', 'portal.students', 'export', 'portal.students.export', 'Export Students'),
  ('academics', 'portal.students', 'manage', 'portal.students.manage', 'Manage Students'),
  ('academics', 'portal.teachers', 'view', 'portal.teachers.view', 'View Teachers'),
  ('academics', 'portal.teachers', 'create', 'portal.teachers.create', 'Create Teachers'),
  ('academics', 'portal.teachers', 'edit', 'portal.teachers.edit', 'Edit Teachers'),
  ('academics', 'portal.teachers', 'delete', 'portal.teachers.delete', 'Delete Teachers'),
  ('academics', 'portal.teachers', 'manage', 'portal.teachers.manage', 'Manage Teachers'),
  ('academics', 'portal.classes', 'view', 'portal.classes.view', 'View Classes'),
  ('academics', 'portal.classes', 'create', 'portal.classes.create', 'Create Classes'),
  ('academics', 'portal.classes', 'edit', 'portal.classes.edit', 'Edit Classes'),
  ('academics', 'portal.classes', 'delete', 'portal.classes.delete', 'Delete Classes'),
  ('academics', 'portal.classes', 'manage', 'portal.classes.manage', 'Manage Classes'),
  ('academics', 'portal.subjects', 'view', 'portal.subjects.view', 'View Subjects'),
  ('academics', 'portal.subjects', 'create', 'portal.subjects.create', 'Create Subjects'),
  ('academics', 'portal.subjects', 'edit', 'portal.subjects.edit', 'Edit Subjects'),
  ('academics', 'portal.subjects', 'delete', 'portal.subjects.delete', 'Delete Subjects'),
  ('academics', 'portal.subjects', 'manage', 'portal.subjects.manage', 'Manage Subjects'),
  ('academics', 'portal.timetable', 'view', 'portal.timetable.view', 'View Timetable'),
  ('academics', 'portal.timetable', 'create', 'portal.timetable.create', 'Create Timetable'),
  ('academics', 'portal.timetable', 'edit', 'portal.timetable.edit', 'Edit Timetable'),
  ('academics', 'portal.timetable', 'delete', 'portal.timetable.delete', 'Delete Timetable'),
  ('academics', 'portal.timetable', 'manage', 'portal.timetable.manage', 'Manage Timetable'),
  ('academics', 'portal.grade_scales', 'view', 'portal.grade_scales.view', 'View Grade Scales'),
  ('academics', 'portal.grade_scales', 'create', 'portal.grade_scales.create', 'Create Grade Scales'),
  ('academics', 'portal.grade_scales', 'edit', 'portal.grade_scales.edit', 'Edit Grade Scales'),
  ('academics', 'portal.grade_scales', 'delete', 'portal.grade_scales.delete', 'Delete Grade Scales'),
  ('academics', 'portal.grade_scales', 'manage', 'portal.grade_scales.manage', 'Manage Grade Scales'),
  ('examinations', 'portal.report_cards', 'view', 'portal.report_cards.view', 'View Report Cards'),
  ('examinations', 'portal.report_cards', 'create', 'portal.report_cards.create', 'Create Report Cards'),
  ('examinations', 'portal.report_cards', 'edit', 'portal.report_cards.edit', 'Edit Report Cards'),
  ('examinations', 'portal.report_cards', 'delete', 'portal.report_cards.delete', 'Delete Report Cards'),
  ('examinations', 'portal.report_cards', 'approve', 'portal.report_cards.approve', 'Approve Report Cards'),
  ('examinations', 'portal.report_cards', 'export', 'portal.report_cards.export', 'Export Report Cards'),
  ('examinations', 'portal.report_cards', 'manage', 'portal.report_cards.manage', 'Manage Report Cards'),
  ('examinations', 'portal.report_archive', 'view', 'portal.report_archive.view', 'View Report Archive'),
  ('examinations', 'portal.report_archive', 'export', 'portal.report_archive.export', 'Export Report Archive'),
  ('examinations', 'portal.report_archive', 'manage', 'portal.report_archive.manage', 'Manage Report Archive'),
  ('examinations', 'portal.academic_reports', 'view', 'portal.academic_reports.view', 'View Reports'),
  ('examinations', 'portal.academic_reports', 'export', 'portal.academic_reports.export', 'Export Reports'),
  ('examinations', 'portal.academic_reports', 'manage', 'portal.academic_reports.manage', 'Manage Reports'),
  ('examinations', 'portal.report_settings', 'view', 'portal.report_settings.view', 'View Report Settings'),
  ('examinations', 'portal.report_settings', 'edit', 'portal.report_settings.edit', 'Edit Report Settings'),
  ('examinations', 'portal.report_settings', 'manage', 'portal.report_settings.manage', 'Manage Report Settings'),
  ('attendance', 'portal.attendance', 'view', 'portal.attendance.view', 'View Student Attendance'),
  ('attendance', 'portal.attendance', 'create', 'portal.attendance.create', 'Create Student Attendance'),
  ('attendance', 'portal.attendance', 'edit', 'portal.attendance.edit', 'Edit Student Attendance'),
  ('attendance', 'portal.attendance', 'export', 'portal.attendance.export', 'Export Student Attendance'),
  ('attendance', 'portal.attendance', 'manage', 'portal.attendance.manage', 'Manage Student Attendance'),
  ('finance', 'portal.billing_fees', 'view', 'portal.billing_fees.view', 'View Fees'),
  ('finance', 'portal.billing_fees', 'create', 'portal.billing_fees.create', 'Create Fees'),
  ('finance', 'portal.billing_fees', 'edit', 'portal.billing_fees.edit', 'Edit Fees'),
  ('finance', 'portal.billing_fees', 'delete', 'portal.billing_fees.delete', 'Delete Fees'),
  ('finance', 'portal.billing_fees', 'manage', 'portal.billing_fees.manage', 'Manage Fees'),
  ('finance', 'portal.billing_invoices', 'view', 'portal.billing_invoices.view', 'View Invoices'),
  ('finance', 'portal.billing_invoices', 'create', 'portal.billing_invoices.create', 'Create Invoices'),
  ('finance', 'portal.billing_invoices', 'edit', 'portal.billing_invoices.edit', 'Edit Invoices'),
  ('finance', 'portal.billing_invoices', 'delete', 'portal.billing_invoices.delete', 'Delete Invoices'),
  ('finance', 'portal.billing_invoices', 'approve', 'portal.billing_invoices.approve', 'Approve Invoices'),
  ('finance', 'portal.billing_invoices', 'export', 'portal.billing_invoices.export', 'Export Invoices'),
  ('finance', 'portal.billing_invoices', 'manage', 'portal.billing_invoices.manage', 'Manage Invoices'),
  ('finance', 'portal.billing_payments', 'view', 'portal.billing_payments.view', 'View Payments'),
  ('finance', 'portal.billing_payments', 'create', 'portal.billing_payments.create', 'Create Payments'),
  ('finance', 'portal.billing_payments', 'edit', 'portal.billing_payments.edit', 'Edit Payments'),
  ('finance', 'portal.billing_payments', 'approve', 'portal.billing_payments.approve', 'Approve Payments'),
  ('finance', 'portal.billing_payments', 'export', 'portal.billing_payments.export', 'Export Payments'),
  ('finance', 'portal.billing_payments', 'manage', 'portal.billing_payments.manage', 'Manage Payments'),
  ('finance', 'portal.billing_paid', 'view', 'portal.billing_paid.view', 'View Paid Students'),
  ('finance', 'portal.billing_paid', 'export', 'portal.billing_paid.export', 'Export Paid Students'),
  ('finance', 'portal.billing_outstanding', 'view', 'portal.billing_outstanding.view', 'View Outstanding'),
  ('finance', 'portal.billing_outstanding', 'export', 'portal.billing_outstanding.export', 'Export Outstanding'),
  ('finance', 'portal.billing_reports', 'view', 'portal.billing_reports.view', 'View Billing Reports'),
  ('finance', 'portal.billing_reports', 'export', 'portal.billing_reports.export', 'Export Billing Reports'),
  ('finance', 'portal.billing_reports', 'manage', 'portal.billing_reports.manage', 'Manage Billing Reports'),
  ('registration', 'portal.number_generator', 'view', 'portal.number_generator.view', 'View Number Generator'),
  ('registration', 'portal.number_generator', 'create', 'portal.number_generator.create', 'Create Number Generator'),
  ('registration', 'portal.number_generator', 'manage', 'portal.number_generator.manage', 'Manage Number Generator'),
  ('registration', 'portal.pending_users', 'view', 'portal.pending_users.view', 'View Pending Approvals'),
  ('registration', 'portal.pending_users', 'approve', 'portal.pending_users.approve', 'Approve Pending Approvals'),
  ('registration', 'portal.pending_users', 'manage', 'portal.pending_users.manage', 'Manage Pending Approvals'),
  ('registration', 'portal.parent_student_link', 'view', 'portal.parent_student_link.view', 'View Parent–Student Link'),
  ('registration', 'portal.parent_student_link', 'create', 'portal.parent_student_link.create', 'Create Parent–Student Link'),
  ('registration', 'portal.parent_student_link', 'edit', 'portal.parent_student_link.edit', 'Edit Parent–Student Link'),
  ('registration', 'portal.parent_student_link', 'delete', 'portal.parent_student_link.delete', 'Delete Parent–Student Link'),
  ('registration', 'portal.parent_student_link', 'manage', 'portal.parent_student_link.manage', 'Manage Parent–Student Link'),
  ('registration', 'portal.teacher_class_link', 'view', 'portal.teacher_class_link.view', 'View Teacher–Class Link'),
  ('registration', 'portal.teacher_class_link', 'create', 'portal.teacher_class_link.create', 'Create Teacher–Class Link'),
  ('registration', 'portal.teacher_class_link', 'edit', 'portal.teacher_class_link.edit', 'Edit Teacher–Class Link'),
  ('registration', 'portal.teacher_class_link', 'delete', 'portal.teacher_class_link.delete', 'Delete Teacher–Class Link'),
  ('registration', 'portal.teacher_class_link', 'manage', 'portal.teacher_class_link.manage', 'Manage Teacher–Class Link'),
  ('registration', 'portal.parent_contacts', 'view', 'portal.parent_contacts.view', 'View Parent Contacts'),
  ('registration', 'portal.parent_contacts', 'create', 'portal.parent_contacts.create', 'Create Parent Contacts'),
  ('registration', 'portal.parent_contacts', 'edit', 'portal.parent_contacts.edit', 'Edit Parent Contacts'),
  ('registration', 'portal.parent_contacts', 'delete', 'portal.parent_contacts.delete', 'Delete Parent Contacts'),
  ('registration', 'portal.parent_contacts', 'export', 'portal.parent_contacts.export', 'Export Parent Contacts'),
  ('communication', 'portal.announcements', 'view', 'portal.announcements.view', 'View Announcements'),
  ('communication', 'portal.announcements', 'create', 'portal.announcements.create', 'Create Announcements'),
  ('communication', 'portal.announcements', 'edit', 'portal.announcements.edit', 'Edit Announcements'),
  ('communication', 'portal.announcements', 'delete', 'portal.announcements.delete', 'Delete Announcements'),
  ('communication', 'portal.announcements', 'manage', 'portal.announcements.manage', 'Manage Announcements'),
  ('administration', 'portal.school_settings', 'view', 'portal.school_settings.view', 'View School Settings'),
  ('administration', 'portal.school_settings', 'edit', 'portal.school_settings.edit', 'Edit School Settings'),
  ('administration', 'portal.school_settings', 'manage', 'portal.school_settings.manage', 'Manage School Settings'),
  ('administration', 'portal.staff_access', 'view', 'portal.staff_access.view', 'View Staff Portal Access'),
  ('administration', 'portal.staff_access', 'manage', 'portal.staff_access.manage', 'Manage Staff Portal Access'),
  ('administration', 'portal.approvals', 'view', 'portal.approvals.view', 'View Approvals'),
  ('administration', 'portal.approvals', 'approve', 'portal.approvals.approve', 'Approve Approvals'),
  ('administration', 'portal.approvals', 'manage', 'portal.approvals.manage', 'Manage Approvals'),
  ('administration', 'portal.audit_logs', 'view', 'portal.audit_logs.view', 'View Audit Logs'),
  ('administration', 'portal.audit_logs', 'export', 'portal.audit_logs.export', 'Export Audit Logs'),
  ('administration', 'portal.account_settings', 'view', 'portal.account_settings.view', 'View Account Settings'),
  ('administration', 'portal.account_settings', 'edit', 'portal.account_settings.edit', 'Edit Account Settings')
ON CONFLICT (code) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description;

-- New system roles
INSERT INTO public.roles (school_id, slug, name, description, is_system) VALUES
  (NULL, 'examiner', 'Examiner', 'Examinations and results focus', true),
  (NULL, 'registrar', 'Registrar', 'Students and registration', true),
  (NULL, 'parent_support', 'Parent Support', 'Parent linking and communication', true)
ON CONFLICT (school_id, slug) DO NOTHING;

-- Grant portal permissions to school_admin (all portal.*)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'school_admin' AND r.school_id IS NULL AND p.code LIKE 'portal.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Super admin gets all permissions including portal
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'super_admin' AND r.school_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;
