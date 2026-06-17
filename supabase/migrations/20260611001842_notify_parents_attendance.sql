-- Parent in-app notifications for student absence/late, fired from both unified register entries and legacy attendance rows.

CREATE OR REPLACE FUNCTION public.notify_parents_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_status text;
  v_date date;
  v_student_name text;
  v_class_name text;
  v_subject_name text;
  v_parent_user uuid;
BEGIN
  IF TG_TABLE_NAME = 'register_student_entries' THEN
    v_student_id := NEW.student_id;
    v_status := lower(coalesce(NEW.attendance_status, ''));
    SELECT cr.register_date, c.name, s.name
      INTO v_date, v_class_name, v_subject_name
      FROM public.class_registers cr
      LEFT JOIN public.classes c ON c.id = cr.class_id
      LEFT JOIN public.subjects s ON s.id = cr.subject_id
     WHERE cr.id = NEW.register_id;
  ELSIF TG_TABLE_NAME = 'attendance_records' THEN
    v_student_id := NEW.student_id;
    v_status := lower(coalesce(NEW.attendance_status, ''));
    v_date := NEW.attendance_date;
    SELECT c.name, s.name INTO v_class_name, v_subject_name
      FROM public.classes c
      LEFT JOIN public.subjects s ON s.id = NEW.subject_id
     WHERE c.id = NEW.class_id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_status NOT IN ('absent','late','sick','excused','suspended') THEN
    RETURN NEW;
  END IF;

  -- Skip if status unchanged on UPDATE (avoid duplicate spam)
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'register_student_entries'
       AND lower(coalesce(OLD.attendance_status,'')) = v_status THEN
      RETURN NEW;
    END IF;
    IF TG_TABLE_NAME = 'attendance_records'
       AND lower(coalesce(OLD.attendance_status,'')) = v_status THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT coalesce(p.full_name, st.full_name, 'Your child')
    INTO v_student_name
    FROM public.students st
    LEFT JOIN public.profiles p ON p.id = st.profile_id
   WHERE st.id = v_student_id;

  FOR v_parent_user IN
    SELECT par.user_id
      FROM public.parent_student_links psl
      JOIN public.parents par ON par.id = psl.parent_id
     WHERE psl.student_id = v_student_id AND par.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, body, data, read)
    VALUES (
      v_parent_user,
      'Attendance alert: ' || coalesce(v_student_name,'your child'),
      coalesce(v_student_name,'Your child') || ' was marked ' || upper(v_status)
        || coalesce(' in ' || v_subject_name, '')
        || coalesce(' (' || v_class_name || ')', '')
        || ' on ' || to_char(v_date, 'DD Mon YYYY') || '.',
      jsonb_build_object(
        'type','attendance_alert',
        'student_id', v_student_id,
        'status', v_status,
        'date', v_date,
        'class', v_class_name,
        'subject', v_subject_name
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_parents_register_entry ON public.register_student_entries;
CREATE TRIGGER trg_notify_parents_register_entry
AFTER INSERT OR UPDATE OF attendance_status ON public.register_student_entries
FOR EACH ROW EXECUTE FUNCTION public.notify_parents_attendance();

DROP TRIGGER IF EXISTS trg_notify_parents_attendance_record ON public.attendance_records;
CREATE TRIGGER trg_notify_parents_attendance_record
AFTER INSERT OR UPDATE OF attendance_status ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.notify_parents_attendance();
