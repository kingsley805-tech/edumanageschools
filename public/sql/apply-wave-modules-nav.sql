-- Seed RBAC permissions so Wave A–F modules appear in sidebar + top nav
-- Run in Supabase SQL Editor, then soft-refresh the portal.

DO $$
DECLARE
  mod_key text;
  mod_label text;
  cat text;
  act text;
  acts text[];
  mod_keys text[] := ARRAY[
    'achievements',
    'programs',
    'student_performance',
    'staff_employees',
    'departments',
    'academic_calendar',
    'behavior_reports',
    'exeats',
    'student_health',
    'finance_expenses',
    'finance_other_income',
    'finance_budgets',
    'school_shop',
    'laboratory'
  ];
BEGIN
  FOREACH mod_key IN ARRAY mod_keys LOOP
    acts := CASE
      WHEN mod_key IN (
        'achievements', 'behavior_reports', 'exeats',
        'finance_expenses', 'finance_budgets'
      ) THEN ARRAY['view', 'create', 'edit', 'delete', 'export', 'manage', 'approve']
      WHEN mod_key = 'student_performance' THEN ARRAY['view', 'export', 'manage']
      ELSE ARRAY['view', 'create', 'edit', 'delete', 'export', 'manage']
    END;

    mod_label := initcap(replace(mod_key, '_', ' '));
    cat := CASE
      WHEN mod_key IN ('achievements', 'programs', 'student_performance') THEN 'academics'
      WHEN mod_key IN ('staff_employees', 'departments', 'academic_calendar') THEN 'administration'
      WHEN mod_key IN ('behavior_reports', 'exeats') THEN 'domestics'
      WHEN mod_key = 'student_health' THEN 'health'
      WHEN mod_key IN ('finance_expenses', 'finance_other_income', 'finance_budgets') THEN 'finance'
      WHEN mod_key IN ('school_shop', 'laboratory') THEN 'resources'
      ELSE 'administration'
    END;

    FOREACH act IN ARRAY acts LOOP
      INSERT INTO public.permissions (category, module, action, code, description)
      VALUES (
        cat,
        'portal.' || mod_key,
        act,
        'portal.' || mod_key || '.' || act,
        initcap(act) || ' ' || mod_label
      )
      ON CONFLICT (code) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Grant to system school_admin + super_admin roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('school_admin', 'super_admin')
  AND (
    p.code LIKE 'portal.achievements.%'
    OR p.code LIKE 'portal.programs.%'
    OR p.code LIKE 'portal.student_performance.%'
    OR p.code LIKE 'portal.staff_employees.%'
    OR p.code LIKE 'portal.departments.%'
    OR p.code LIKE 'portal.academic_calendar.%'
    OR p.code LIKE 'portal.behavior_reports.%'
    OR p.code LIKE 'portal.exeats.%'
    OR p.code LIKE 'portal.student_health.%'
    OR p.code LIKE 'portal.finance_expenses.%'
    OR p.code LIKE 'portal.finance_other_income.%'
    OR p.code LIKE 'portal.finance_budgets.%'
    OR p.code LIKE 'portal.school_shop.%'
    OR p.code LIKE 'portal.laboratory.%'
  )
ON CONFLICT DO NOTHING;

-- Also grant school-scoped admin roles (per-tenant copies)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('school_admin', 'admin')
  AND r.school_id IS NOT NULL
  AND (
    p.code LIKE 'portal.achievements.%'
    OR p.code LIKE 'portal.programs.%'
    OR p.code LIKE 'portal.student_performance.%'
    OR p.code LIKE 'portal.staff_employees.%'
    OR p.code LIKE 'portal.departments.%'
    OR p.code LIKE 'portal.academic_calendar.%'
    OR p.code LIKE 'portal.behavior_reports.%'
    OR p.code LIKE 'portal.exeats.%'
    OR p.code LIKE 'portal.student_health.%'
    OR p.code LIKE 'portal.finance_expenses.%'
    OR p.code LIKE 'portal.finance_other_income.%'
    OR p.code LIKE 'portal.finance_budgets.%'
    OR p.code LIKE 'portal.school_shop.%'
    OR p.code LIKE 'portal.laboratory.%'
  )
ON CONFLICT DO NOTHING;

-- Accountant finance extras + shop
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'accountant'
  AND (
    p.code LIKE 'portal.finance_expenses.%'
    OR p.code LIKE 'portal.finance_other_income.%'
    OR p.code LIKE 'portal.finance_budgets.%'
    OR p.code LIKE 'portal.school_shop.%'
  )
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
