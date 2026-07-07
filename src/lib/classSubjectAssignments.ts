import { supabase } from "@/integrations/supabase/client";

export type TeacherClassSubject = {
  assignmentId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
};

export type TeacherClassAssignmentGroup = {
  classId: string;
  className: string;
  classLevel: string | null;
  subjects: TeacherClassSubject[];
  isClassTeacher: boolean;
};

export type ClassSubjectTeacherRow = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string;
  teacherName: string;
};

export type ClassTeachersOverview = {
  classId: string;
  className: string;
  classLevel: string | null;
  classTeacherName: string | null;
  subjects: ClassSubjectTeacherRow[];
};

function teacherDisplayName(profiles: { full_name?: string | null } | null | undefined): string {
  return profiles?.full_name?.trim() || "—";
}

/** Group a teacher's class_subjects rows by class (supports multiple subjects per class). */
export async function fetchTeacherAssignmentGroups(
  teacherId: string,
): Promise<TeacherClassAssignmentGroup[]> {
  const [assignmentsRes, managedClassesRes] = await Promise.all([
    supabase
      .from("class_subjects")
      .select(`
        id,
        class_id,
        subject_id,
        classes(id, name, level),
        subjects(id, name, code)
      `)
      .eq("teacher_id", teacherId),
    supabase
      .from("classes")
      .select("id, name, level")
      .eq("class_teacher_id", teacherId),
  ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (managedClassesRes.error) throw managedClassesRes.error;

  const managedClassIds = new Set((managedClassesRes.data ?? []).map((row) => row.id));
  const map = new Map<string, TeacherClassAssignmentGroup>();

  for (const row of assignmentsRes.data ?? []) {
    const cls = row.classes as { id: string; name: string; level: string | null } | null;
    const subject = row.subjects as { id: string; name: string; code: string | null } | null;
    if (!cls?.id || !subject?.id) continue;

    const existing = map.get(cls.id) ?? {
      classId: cls.id,
      className: cls.name,
      classLevel: cls.level,
      subjects: [],
      isClassTeacher: managedClassIds.has(cls.id),
    };

    existing.subjects.push({
      assignmentId: row.id,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectCode: subject.code,
    });
    map.set(cls.id, existing);
  }

  for (const cls of managedClassesRes.data ?? []) {
    if (!map.has(cls.id)) {
      map.set(cls.id, {
        classId: cls.id,
        className: cls.name,
        classLevel: cls.level,
        subjects: [],
        isClassTeacher: true,
      });
    } else {
      map.get(cls.id)!.isClassTeacher = true;
    }
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      subjects: [...group.subjects].sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    }))
    .sort((a, b) => a.className.localeCompare(b.className));
}

/** Subjects and assigned teachers for a student's class. */
export async function fetchClassTeachersOverview(
  classId: string,
): Promise<ClassTeachersOverview | null> {
  const [classRes, subjectsRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, level, class_teacher:teachers!class_teacher_id(profiles(full_name))")
      .eq("id", classId)
      .maybeSingle(),
    supabase
      .from("class_subjects")
      .select(`
        subject_id,
        teacher_id,
        subjects(id, name, code),
        teachers(id, profiles(full_name))
      `)
      .eq("class_id", classId),
  ]);

  if (classRes.error) throw classRes.error;
  if (subjectsRes.error) throw subjectsRes.error;
  if (!classRes.data) return null;

  const classTeacher = classRes.data.class_teacher as
    | { profiles?: { full_name?: string | null } | null }
    | null;

  const subjects: ClassSubjectTeacherRow[] = (subjectsRes.data ?? [])
    .map((row) => {
      const subject = row.subjects as { id: string; name: string; code: string | null } | null;
      const teacher = row.teachers as { id: string; profiles?: { full_name?: string | null } | null } | null;
      if (!subject?.id || !teacher?.id) return null;
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code,
        teacherId: teacher.id,
        teacherName: teacherDisplayName(teacher.profiles),
      };
    })
    .filter((row): row is ClassSubjectTeacherRow => row !== null)
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  return {
    classId: classRes.data.id,
    className: classRes.data.name,
    classLevel: classRes.data.level,
    classTeacherName: classTeacher ? teacherDisplayName(classTeacher.profiles) : null,
    subjects,
  };
}
