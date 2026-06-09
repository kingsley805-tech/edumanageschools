-- Update Class Register RLS policies to allow Class Teachers (homeroom advisors) to manage registers
-- class_registers policies

DROP POLICY IF EXISTS "class registers teacher write" ON public.class_registers;
CREATE POLICY "class registers teacher write" ON public.class_registers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid() 
        AND (t.id = teacher_id OR EXISTS (
          SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.class_teacher_id = t.id
        ))
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
      SELECT 1 FROM public.teachers t 
      WHERE t.user_id = auth.uid() 
        AND (t.id = teacher_id OR EXISTS (
          SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.class_teacher_id = t.id
        ))
    ))
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- register_student_entries policies
DROP POLICY IF EXISTS "register entries via register" ON public.register_student_entries;
CREATE POLICY "register entries via register" ON public.register_student_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.class_registers r WHERE r.id = register_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_registers r
      WHERE r.id = register_id
        AND (
          (r.locked = false AND r.status IN ('draft', 'rejected') AND EXISTS (
            SELECT 1 FROM public.teachers t 
            WHERE t.user_id = auth.uid() 
              AND (t.id = r.teacher_id OR EXISTS (
                SELECT 1 FROM public.classes c WHERE c.id = r.class_id AND c.class_teacher_id = t.id
              ))
          ))
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
  );
