DROP POLICY IF EXISTS "class registers teacher write" ON public.class_registers;
CREATE POLICY "class registers teacher write" ON public.class_registers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid()
        AND t.id = class_registers.teacher_id
        AND t.school_id = class_registers.school_id
    )
    OR public.is_school_admin(auth.uid(), class_registers.school_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "class registers teacher update" ON public.class_registers;
CREATE POLICY "class registers teacher update" ON public.class_registers
  FOR UPDATE TO authenticated
  USING (
    (locked = false AND status IN ('draft','rejected') AND EXISTS (
      SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.id = class_registers.teacher_id
    ))
    OR public.is_school_admin(auth.uid(), class_registers.school_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (locked = false AND status IN ('draft','rejected','submitted') AND EXISTS (
      SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.id = class_registers.teacher_id
    ))
    OR public.is_school_admin(auth.uid(), class_registers.school_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );