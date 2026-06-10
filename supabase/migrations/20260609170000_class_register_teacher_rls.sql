-- Create helper if not exists
CREATE OR REPLACE FUNCTION public.is_class_teacher_of(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.teachers t ON t.id = c.class_teacher_id
    WHERE c.id = _class_id AND t.user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_class_teacher_of(uuid, uuid) TO authenticated;

-- ============================================================
-- class_registers policies
-- ============================================================

-- Drop all old policies to prevent conflicts
DROP POLICY IF EXISTS "class registers school read" ON public.class_registers;
DROP POLICY IF EXISTS "class registers teacher write" ON public.class_registers;
DROP POLICY IF EXISTS "class registers teacher update" ON public.class_registers;
DROP POLICY IF EXISTS "class registers admin delete" ON public.class_registers;

-- SELECT: school isolation + teacher owner + class teacher
CREATE POLICY "class registers school read" ON public.class_registers
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() AND t.id = class_registers.teacher_id
    )
    OR public.is_class_teacher_of(auth.uid(), class_registers.class_id)
  );

-- INSERT: teacher owner or class teacher (must belong to the school)
CREATE POLICY "class registers teacher write" ON public.class_registers
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.user_id = auth.uid()
          AND t.school_id = class_registers.school_id
          AND (
            t.id = class_registers.teacher_id
            OR public.is_class_teacher_of(auth.uid(), class_registers.class_id)
          )
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- UPDATE: teacher owner or class teacher when draft/rejected
CREATE POLICY "class registers teacher update" ON public.class_registers
  FOR UPDATE TO authenticated
  USING (
    (
      class_registers.locked = false
      AND class_registers.status IN ('draft', 'rejected')
      AND EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.user_id = auth.uid()
          AND (
            t.id = class_registers.teacher_id
            OR public.is_class_teacher_of(auth.uid(), class_registers.class_id)
          )
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (
      class_registers.locked = false
      AND class_registers.status IN ('draft', 'rejected', 'submitted')
      AND EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.user_id = auth.uid()
          AND (
            t.id = class_registers.teacher_id
            OR public.is_class_teacher_of(auth.uid(), class_registers.class_id)
          )
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- DELETE: only admins can delete registers
CREATE POLICY "class registers admin delete" ON public.class_registers
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );


-- ============================================================
-- register_student_entries policies
-- ============================================================

DROP POLICY IF EXISTS "register entries via register" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries select" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries insert" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries update" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries delete" ON public.register_student_entries;

-- SELECT: allowed if user can see parent register
CREATE POLICY "register entries select" ON public.register_student_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
    )
  );

-- INSERT: allowed if not locked/draft and user is teacher/class-teacher/admin
CREATE POLICY "register entries insert" ON public.register_student_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
        AND (
          (
            r.locked = false
            AND r.status IN ('draft', 'rejected')
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.user_id = auth.uid()
                AND (
                  t.id = r.teacher_id
                  OR public.is_class_teacher_of(auth.uid(), r.class_id)
                )
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

-- UPDATE: allowed if not locked/draft and user is teacher/class-teacher/admin
CREATE POLICY "register entries update" ON public.register_student_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
        AND (
          (
            r.locked = false
            AND r.status IN ('draft', 'rejected')
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.user_id = auth.uid()
                AND (
                  t.id = r.teacher_id
                  OR public.is_class_teacher_of(auth.uid(), r.class_id)
                )
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
        AND (
          (
            r.locked = false
            AND r.status IN ('draft', 'rejected')
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.user_id = auth.uid()
                AND (
                  t.id = r.teacher_id
                  OR public.is_class_teacher_of(auth.uid(), r.class_id)
                )
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );

-- DELETE: allowed if not locked/draft and user is teacher/class-teacher/admin
CREATE POLICY "register entries delete" ON public.register_student_entries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_student_entries.register_id
        AND (
          (
            r.locked = false
            AND r.status IN ('draft', 'rejected')
            AND EXISTS (
              SELECT 1 FROM public.teachers t
              WHERE t.user_id = auth.uid()
                AND (
                  t.id = r.teacher_id
                  OR public.is_class_teacher_of(auth.uid(), r.class_id)
                )
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );
