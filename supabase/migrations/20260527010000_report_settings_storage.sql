-- Report settings: storage bucket for signatures/stamps + school_settings extras

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read school assets" ON storage.objects;
CREATE POLICY "public read school assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "school members upload assets" ON storage.objects;
CREATE POLICY "school members upload assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'teacher'::app_role)
      OR name LIKE ('%' || auth.uid()::text || '%')
    )
  );

DROP POLICY IF EXISTS "school members update own assets" ON storage.objects;
CREATE POLICY "school members update own assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR name LIKE ('%' || auth.uid()::text || '%')
    )
  );

DROP POLICY IF EXISTS "school members delete own assets" ON storage.objects;
CREATE POLICY "school members delete own assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR name LIKE ('%' || auth.uid()::text || '%')
    )
  );

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS allow_multiple_parents_per_student boolean DEFAULT true;
