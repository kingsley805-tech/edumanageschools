-- System Backup: history table + private storage for ZIP bundles
-- Run this entire script in Supabase → SQL Editor → Run
-- Project: xbhhpjtwawfawifhpxbe

CREATE TABLE IF NOT EXISTS public.system_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  backup_name text NOT NULL,
  status text NOT NULL DEFAULT 'preparing'
    CHECK (status IN (
      'preparing',
      'collecting',
      'generating_excel',
      'creating_zip',
      'uploading',
      'completed',
      'failed',
      'cancelled'
    )),
  progress_pct integer NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  progress_stage text,
  progress_message text,
  file_path text,
  file_size_bytes bigint,
  record_count integer NOT NULL DEFAULT 0,
  sheet_count integer NOT NULL DEFAULT 0,
  tables_included text[] DEFAULT '{}',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_backups_school_created
  ON public.system_backups (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_backups_school_status
  ON public.system_backups (school_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_backups_one_active_per_school
  ON public.system_backups (school_id)
  WHERE status IN ('preparing', 'collecting', 'generating_excel', 'creating_zip', 'uploading');

ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_backups_select_school" ON public.system_backups;
CREATE POLICY "system_backups_select_school" ON public.system_backups
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "system_backups_insert_admin" ON public.system_backups;
CREATE POLICY "system_backups_insert_admin" ON public.system_backups
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

DROP POLICY IF EXISTS "system_backups_update_admin" ON public.system_backups;
CREATE POLICY "system_backups_update_admin" ON public.system_backups
  FOR UPDATE TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
  );

DROP POLICY IF EXISTS "system_backups_delete_admin" ON public.system_backups;
CREATE POLICY "system_backups_delete_admin" ON public.system_backups
  FOR DELETE TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'system-backups',
  'system-backups',
  false,
  524288000,
  ARRAY[
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "system_backups_storage_select" ON storage.objects;
CREATE POLICY "system_backups_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'system-backups'
    AND (
      (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

DROP POLICY IF EXISTS "system_backups_storage_insert" ON storage.objects;
CREATE POLICY "system_backups_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'system-backups'
    AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

DROP POLICY IF EXISTS "system_backups_storage_update" ON storage.objects;
CREATE POLICY "system_backups_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'system-backups'
    AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

DROP POLICY IF EXISTS "system_backups_storage_delete" ON storage.objects;
CREATE POLICY "system_backups_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'system-backups'
    AND (
      (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
      OR public.has_role(auth.uid(), 'super_admin')
    )
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

-- Permissions are optional; failures here must not undo the table above.
DO $$
BEGIN
  INSERT INTO public.permissions (category, module, action, code, description)
  VALUES
    ('system_backup', 'portal.system_backup', 'view', 'portal.system_backup.view', 'View System Backup'),
    ('system_backup', 'portal.system_backup', 'manage', 'portal.system_backup.manage', 'Create and manage System Backups'),
    ('system_backup', 'portal.system_backup', 'export', 'portal.system_backup.export', 'Download System Backups')
  ON CONFLICT (code) DO UPDATE SET
    category = EXCLUDED.category,
    description = EXCLUDED.description;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
  WHERE r.slug IN ('school_admin', 'super_admin', 'admin')
    AND r.school_id IS NULL
    AND p.code LIKE 'portal.system_backup.%'
  ON CONFLICT (role_id, permission_id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'system_backup permissions seed skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify (should return true):
-- SELECT to_regclass('public.system_backups') IS NOT NULL;
