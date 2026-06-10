-- classes.updated_at is referenced by assign_class_teacher but was never added to the table.
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';
