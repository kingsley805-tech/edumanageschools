-- Create storage buckets for file uploads

-- Assignments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assignments',
  'assignments',
  true,
  10485760,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Assignment submissions bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignment-submissions', 'assignment-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Resources bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- School logos bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Proctoring snapshots bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('proctoring-snapshots', 'proctoring-snapshots', false)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- STORAGE POLICIES - ASSIGNMENTS
-- ==========================================

CREATE POLICY "Students can upload their own assignment files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assignments' AND has_role(auth.uid(), 'student'::app_role));

CREATE POLICY "Students can view assignment files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assignments' AND (has_role(auth.uid(), 'student'::app_role) OR has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Teachers can upload assignment files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assignments' AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can update assignment files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'assignments' AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can delete assignment files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'assignments' AND has_role(auth.uid(), 'teacher'::app_role));

-- ==========================================
-- STORAGE POLICIES - SUBMISSIONS
-- ==========================================

CREATE POLICY "Students can upload their own submissions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assignment-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students can view their own submissions"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assignment-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Teachers can view all submissions"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assignment-submissions' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'teacher'));

-- ==========================================
-- STORAGE POLICIES - RESOURCES
-- ==========================================

CREATE POLICY "Teachers can upload resources"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'resources' AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can upload resources"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'resources' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view resources"
ON storage.objects FOR SELECT
USING (bucket_id = 'resources');

CREATE POLICY "Teachers can delete resources"
ON storage.objects FOR DELETE
USING (bucket_id = 'resources' AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can delete resources"
ON storage.objects FOR DELETE
USING (bucket_id = 'resources' AND has_role(auth.uid(), 'admin'));

-- ==========================================
-- STORAGE POLICIES - AVATARS
-- ==========================================

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- ==========================================
-- STORAGE POLICIES - SCHOOL LOGOS
-- ==========================================

CREATE POLICY "School logos are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'school-logos');

CREATE POLICY "Admins can upload school logos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'school-logos' AND auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can update school logos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'school-logos' AND auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can delete school logos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'school-logos' AND auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')));

-- ==========================================
-- STORAGE POLICIES - PROCTORING SNAPSHOTS
-- ==========================================

CREATE POLICY "Students can upload their proctoring snapshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proctoring-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Teachers can view proctoring snapshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'proctoring-snapshots' AND EXISTS (
  SELECT 1 FROM online_exam_attempts oea
  JOIN online_exams oe ON oea.online_exam_id = oe.id
  WHERE oe.created_by = auth.uid()
  AND oea.student_id::text = (storage.foldername(name))[2]
));