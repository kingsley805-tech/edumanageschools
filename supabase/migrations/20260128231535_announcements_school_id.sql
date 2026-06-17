-- Add school_id to announcements table for proper multi-tenancy
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);

-- Update existing announcements to have school_id from their creator's profile
UPDATE public.announcements a
SET school_id = (
  SELECT p.school_id 
  FROM public.profiles p 
  WHERE p.id = a.created_by
)
WHERE a.school_id IS NULL;

-- Drop old RLS policies on announcements
DROP POLICY IF EXISTS "All users can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;

-- Create proper school-scoped RLS policies for announcements
CREATE POLICY "Users can view school announcements"
ON public.announcements FOR SELECT
USING (
  school_id = get_user_school_id(auth.uid())
  OR has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Admins can manage school announcements"
ON public.announcements FOR ALL
USING (
  (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin')
);

-- ============================================
-- REGISTRATION NUMBERS TABLE
-- For admin-generated student/employee numbers
-- ============================================

CREATE TABLE public.registration_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  number_type TEXT NOT NULL CHECK (number_type IN ('student', 'employee')),
  registration_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used')),
  assigned_user_id UUID REFERENCES public.profiles(id),
  generated_by UUID REFERENCES public.profiles(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(school_id, registration_number)
);

-- Enable RLS
ALTER TABLE public.registration_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policies for registration_numbers
CREATE POLICY "Admins can manage registration numbers"
ON public.registration_numbers FOR ALL
USING (
  has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid())
);

CREATE POLICY "Anyone can check if registration number exists"
ON public.registration_numbers FOR SELECT
USING (true);

-- ============================================
-- PARENT-STUDENT RELATIONSHIPS TABLE
-- For supporting multiple parents per student
-- ============================================

CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

-- Enable RLS
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for parent_student_links
CREATE POLICY "Admins can manage parent student links"
ON public.parent_student_links FOR ALL
USING (
  has_role(auth.uid(), 'admin')
);

CREATE POLICY "Parents can view their links"
ON public.parent_student_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_student_links.parent_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can insert their links"
ON public.parent_student_links FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_student_links.parent_id
    AND p.user_id = auth.uid()
  )
);

-- ============================================
-- AUDIT LOGS TABLE
-- For tracking number generation and user registration
-- ============================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  performed_by UUID REFERENCES public.profiles(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_logs
CREATE POLICY "Admins can view school audit logs"
ON public.audit_logs FOR SELECT
USING (
  has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid())
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_registration_numbers_school ON public.registration_numbers(school_id, number_type, status);
CREATE INDEX idx_registration_numbers_number ON public.registration_numbers(registration_number);
CREATE INDEX idx_audit_logs_school ON public.audit_logs(school_id, created_at DESC);
CREATE INDEX idx_parent_student_links_parent ON public.parent_student_links(parent_id);
CREATE INDEX idx_parent_student_links_student ON public.parent_student_links(student_id);