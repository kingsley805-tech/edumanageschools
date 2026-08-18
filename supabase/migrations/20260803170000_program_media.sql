-- Academic programs: cover image, promo video, gallery

ALTER TABLE public.academic_programs
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS gallery_urls text[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'program-media',
  'program-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS program_media_storage_read ON storage.objects;
CREATE POLICY program_media_storage_read ON storage.objects FOR SELECT
  USING (bucket_id = 'program-media');

DROP POLICY IF EXISTS program_media_storage_insert ON storage.objects;
CREATE POLICY program_media_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'program-media'
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

DROP POLICY IF EXISTS program_media_storage_update ON storage.objects;
CREATE POLICY program_media_storage_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'program-media'
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

DROP POLICY IF EXISTS program_media_storage_delete ON storage.objects;
CREATE POLICY program_media_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'program-media'
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
