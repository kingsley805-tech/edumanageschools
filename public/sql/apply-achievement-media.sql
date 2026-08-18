-- Achievement media storage (images + PDF/docs)
-- Run in Supabase SQL Editor after apply-achievements-programs.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'achievement-media',
  'achievement-media',
  true,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS achievement_media_storage_read ON storage.objects;
CREATE POLICY achievement_media_storage_read ON storage.objects FOR SELECT
  USING (bucket_id = 'achievement-media');

DROP POLICY IF EXISTS achievement_media_storage_insert ON storage.objects;
CREATE POLICY achievement_media_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'achievement-media'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'accountant'::app_role)
          OR public.has_role(auth.uid(), 'teacher'::app_role)
        )
      )
    )
  );

DROP POLICY IF EXISTS achievement_media_storage_update ON storage.objects;
CREATE POLICY achievement_media_storage_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'achievement-media'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'accountant'::app_role)
          OR public.has_role(auth.uid(), 'teacher'::app_role)
        )
      )
    )
  );

DROP POLICY IF EXISTS achievement_media_storage_delete ON storage.objects;
CREATE POLICY achievement_media_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'achievement-media'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'accountant'::app_role)
          OR public.has_role(auth.uid(), 'teacher'::app_role)
        )
      )
    )
  );
