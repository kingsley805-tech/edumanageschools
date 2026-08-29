-- Desktop offline sync mirror (Electron → Supabase)
-- Stores last-write-wins records from the local SQLite sync queue.

CREATE TABLE IF NOT EXISTS public.desktop_sync_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  operation text NOT NULL DEFAULT 'upsert',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  synced_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT desktop_sync_records_entity_id_unique UNIQUE (entity, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_desktop_sync_records_school
  ON public.desktop_sync_records (school_id);

CREATE INDEX IF NOT EXISTS idx_desktop_sync_records_updated
  ON public.desktop_sync_records (updated_at DESC);

ALTER TABLE public.desktop_sync_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desktop_sync_select_own_school" ON public.desktop_sync_records;
CREATE POLICY "desktop_sync_select_own_school"
  ON public.desktop_sync_records
  FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() AND p.school_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "desktop_sync_insert_own_school" ON public.desktop_sync_records;
CREATE POLICY "desktop_sync_insert_own_school"
  ON public.desktop_sync_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id IS NOT NULL
    AND (
      school_id IN (
        SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() AND p.school_id IS NOT NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "desktop_sync_update_own_school" ON public.desktop_sync_records;
CREATE POLICY "desktop_sync_update_own_school"
  ON public.desktop_sync_records
  FOR UPDATE
  TO authenticated
  USING (
    school_id IN (
      SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() AND p.school_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    school_id IS NOT NULL
    AND (
      school_id IN (
        SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() AND p.school_id IS NOT NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin', 'admin')
      )
    )
  );

COMMENT ON TABLE public.desktop_sync_records IS
  'Offline-first mirror for EduManage Desktop Electron sync queue (LWW by client_updated_at).';
