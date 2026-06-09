-- Update Class Register RLS policies to allow Class Teachers (homeroom advisors)
-- to manage registers and register student entries for their assigned classes.

-- ============================================================
-- class_registers policies
-- ============================================================

DROP POLICY IF EXISTS "class registers teacher write" ON public.class_registers;
CREATE POLICY "class registers teacher write" ON public.class_registers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teachers t
      LEFT JOIN public.classes c ON c.id = class_id
      WHERE t.user_id = auth.uid()
        AND (t.id = teacher_id OR c.class_teacher_id = t.id)
        AND t.school_id = school_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "class registers teacher update" ON public.class_registers;
CREATE POLICY "class registers teacher update" ON public.class_registers
  FOR UPDATE TO authenticated
  USING (
    (locked = false AND status IN ('draft', 'rejected') AND EXISTS (
      SELECT 1
      FROM public.teachers t
      LEFT JOIN public.classes c ON c.id = class_id
      WHERE t.user_id = auth.uid()
        AND (t.id = teacher_id OR c.class_teacher_id = t.id)
    ))
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ============================================================
-- register_student_entries policies
-- Split into separate SELECT / INSERT / UPDATE / DELETE
-- so that USING and WITH CHECK are defined correctly per operation.
-- ============================================================

DROP POLICY IF EXISTS "register entries via register" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries select" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries insert" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries update" ON public.register_student_entries;
DROP POLICY IF EXISTS "register entries delete" ON public.register_student_entries;

-- SELECT: any authenticated user who can see the parent register
CREATE POLICY "register entries select"
ON public.register_student_entries
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.class_registers r
        WHERE r.id = register_id
    )
);

-- INSERT: register owner, class teacher, or admin
CREATE POLICY "register entries insert"
ON public.register_student_entries
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.class_registers r
        LEFT JOIN public.classes c
            ON c.id = r.class_id
        LEFT JOIN public.teachers t
            ON t.user_id = auth.uid()
        WHERE r.id = register_id
        AND (
            (
                r.locked = false
                AND r.status IN ('draft', 'rejected')
                AND (
                    t.id = r.teacher_id
                    OR c.class_teacher_id = t.id
                )
            )
            OR public.has_role(auth.uid(), 'admin'::app_role)
            OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
);

-- UPDATE: register owner, class teacher, or admin
CREATE POLICY "register entries update"
ON public.register_student_entries
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.class_registers r
        LEFT JOIN public.classes c
            ON c.id = r.class_id
        LEFT JOIN public.teachers t
            ON t.user_id = auth.uid()
        WHERE r.id = register_id
        AND (
            (
                r.locked = false
                AND r.status IN ('draft', 'rejected')
                AND (
                    t.id = r.teacher_id
                    OR c.class_teacher_id = t.id
                )
            )
            OR public.has_role(auth.uid(), 'admin'::app_role)
            OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.class_registers r
        LEFT JOIN public.classes c
            ON c.id = r.class_id
        LEFT JOIN public.teachers t
            ON t.user_id = auth.uid()
        WHERE r.id = register_id
        AND (
            (
                r.locked = false
                AND r.status IN ('draft', 'rejected')
                AND (
                    t.id = r.teacher_id
                    OR c.class_teacher_id = t.id
                )
            )
            OR public.has_role(auth.uid(), 'admin'::app_role)
            OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
);

-- DELETE: register owner, class teacher, or admin
CREATE POLICY "register entries delete"
ON public.register_student_entries
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.class_registers r
        LEFT JOIN public.classes c
            ON c.id = r.class_id
        LEFT JOIN public.teachers t
            ON t.user_id = auth.uid()
        WHERE r.id = register_id
        AND (
            (
                r.locked = false
                AND r.status IN ('draft', 'rejected')
                AND (
                    t.id = r.teacher_id
                    OR c.class_teacher_id = t.id
                )
            )
            OR public.has_role(auth.uid(), 'admin'::app_role)
            OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
);
