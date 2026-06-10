-- Fix assign_class_teacher 400 errors on remote Supabase.
-- Dashboard → SQL → New query → paste → Run.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_classes_class_teacher_id ON public.classes(class_teacher_id);

NOTIFY pgrst, 'reload schema';
