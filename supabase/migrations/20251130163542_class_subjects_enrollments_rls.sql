-- RLS Policies for class_subjects
CREATE POLICY "Everyone can view class subjects" ON class_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage class subjects" ON class_subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage class subjects" ON class_subjects FOR ALL USING (public.has_role(auth.uid(), 'teacher'));

-- RLS Policies for enrollments
CREATE POLICY "Students can view own enrollments" ON enrollments FOR SELECT USING (
  EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = enrollments.student_id)
);
CREATE POLICY "Parents can view children enrollments" ON enrollments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students s JOIN parents p ON s.guardian_id = p.id
    WHERE p.user_id = auth.uid() AND s.id = enrollments.student_id
  )
);
CREATE POLICY "Teachers can view enrollments" ON enrollments FOR SELECT USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins can manage enrollments" ON enrollments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for fee_structures
CREATE POLICY "Everyone can view fee structures" ON fee_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage fee structures" ON fee_structures FOR ALL USING (public.has_role(auth.uid(), 'admin'));