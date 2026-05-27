-- Default portal.* grants for system roles (idempotent)

CREATE OR REPLACE FUNCTION public._grant_portal_codes_to_role(_role_slug TEXT, _codes TEXT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_code TEXT;
  v_perm_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE slug = _role_slug AND school_id IS NULL;
  IF v_role_id IS NULL THEN RETURN; END IF;
  FOREACH v_code IN ARRAY _codes LOOP
    SELECT id INTO v_perm_id FROM public.permissions WHERE code = v_code;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Accountant: finance + dashboard
SELECT public._grant_portal_codes_to_role('accountant', ARRAY(
  SELECT code FROM public.permissions
  WHERE code LIKE 'portal.billing_%' OR code = 'portal.dashboard.view'
));

-- Teacher: academics, attendance, examinations subset
SELECT public._grant_portal_codes_to_role('teacher', ARRAY(
  SELECT code FROM public.permissions
  WHERE code LIKE 'portal.students.%'
     OR code LIKE 'portal.classes.%'
     OR code LIKE 'portal.subjects.%'
     OR code LIKE 'portal.timetable.%'
     OR code LIKE 'portal.grade_scales.%'
     OR code LIKE 'portal.teachers.view'
     OR code LIKE 'portal.attendance.%'
     OR code LIKE 'portal.report_cards.%'
     OR code LIKE 'portal.report_archive.%'
     OR code LIKE 'portal.academic_reports.%'
     OR code = 'portal.dashboard.view'
));

-- Examiner
SELECT public._grant_portal_codes_to_role('examiner', ARRAY(
  SELECT code FROM public.permissions
  WHERE code LIKE 'portal.report_%'
     OR code LIKE 'portal.academic_reports.%'
     OR code = 'portal.dashboard.view'
));

-- Registrar
SELECT public._grant_portal_codes_to_role('registrar', ARRAY(
  SELECT code FROM public.permissions
  WHERE code LIKE 'portal.students.%'
     OR code LIKE 'portal.classes.%'
     OR code LIKE 'portal.subjects.%'
     OR code LIKE 'portal.number_generator.%'
     OR code LIKE 'portal.pending_users.%'
     OR code LIKE 'portal.parent_student_link.%'
     OR code LIKE 'portal.teacher_class_link.%'
     OR code LIKE 'portal.parent_contacts.%'
     OR code = 'portal.dashboard.view'
));

-- Auditor: finance view/export + audit logs
SELECT public._grant_portal_codes_to_role('auditor', ARRAY(
  SELECT code FROM public.permissions
  WHERE (code LIKE 'portal.billing_%' AND (code LIKE '%.view' OR code LIKE '%.export'))
     OR code LIKE 'portal.audit_logs.%'
     OR code = 'portal.dashboard.view'
));

-- Parent support
SELECT public._grant_portal_codes_to_role('parent_support', ARRAY(
  SELECT code FROM public.permissions
  WHERE code LIKE 'portal.parent_%'
     OR code LIKE 'portal.pending_users.%'
     OR code LIKE 'portal.announcements.%'
     OR code = 'portal.dashboard.view'
));

DROP FUNCTION IF EXISTS public._grant_portal_codes_to_role(TEXT, TEXT[]);
