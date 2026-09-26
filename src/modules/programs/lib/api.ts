// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type {
  AcademicProgram,
  ProgramStatus,
  ProgramsDashboardStats,
} from "@/modules/programs/lib/types";

export async function fetchProgramsDashboardStats(
  schoolId: string,
): Promise<ProgramsDashboardStats> {
  const { data, error } = await supabase
    .from("academic_programs")
    .select("id, status, is_archived, department")
    .eq("school_id", schoolId);
  if (error) throw error;
  const rows = data ?? [];
  const departments = new Set(
    rows.filter((r) => !r.is_archived && r.department).map((r) => r.department as string),
  );
  return {
    total: rows.filter((r) => !r.is_archived).length,
    active: rows.filter((r) => !r.is_archived && r.status === "active").length,
    inactive: rows.filter((r) => !r.is_archived && r.status === "inactive").length,
    archived: rows.filter((r) => r.is_archived || r.status === "archived").length,
    departments: departments.size,
  };
}

export async function fetchPrograms(schoolId: string): Promise<AcademicProgram[]> {
  const { data, error } = await supabase
    .from("academic_programs")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((p) => {
    const row = p as Record<string, unknown>;
    return {
      ...row,
      status: ((row.status as string) ?? "active") as ProgramStatus,
      subjects: (row.subjects as string[] | null) ?? [],
      image_url: typeof row.image_url === "string" && row.image_url.trim() ? row.image_url : null,
      video_url: typeof row.video_url === "string" && row.video_url.trim() ? row.video_url : null,
      gallery_urls: Array.isArray(row.gallery_urls)
        ? (row.gallery_urls as string[]).filter((u) => typeof u === "string" && u.trim())
        : [],
    } as AcademicProgram;
  });
}

export type ProgramPayload = {
  name: string;
  code: string;
  department?: string | null;
  faculty?: string | null;
  description?: string | null;
  duration_years?: number | null;
  credits?: number | null;
  level?: string | null;
  semester_structure?: string | null;
  coordinator_name?: string | null;
  subjects?: string[];
  image_url?: string | null;
  video_url?: string | null;
  gallery_urls?: string[];
  status?: ProgramStatus;
};

export async function saveProgram(
  schoolId: string,
  payload: ProgramPayload,
  id?: string,
  userId?: string | null,
) {
  const row: Record<string, unknown> = {
    school_id: schoolId,
    name: payload.name.trim(),
    code: payload.code.trim().toUpperCase(),
    department: payload.department ?? null,
    faculty: payload.faculty ?? null,
    description: payload.description ?? null,
    duration_years: payload.duration_years ?? null,
    credits: payload.credits ?? null,
    level: payload.level ?? null,
    semester_structure: payload.semester_structure ?? null,
    coordinator_name: payload.coordinator_name ?? null,
    subjects: payload.subjects ?? [],
    image_url: payload.image_url ?? null,
    video_url: payload.video_url ?? null,
    gallery_urls: payload.gallery_urls ?? [],
    status: payload.status ?? "active",
    updated_at: new Date().toISOString(),
  };
  if (userId) row.updated_by = userId;

  const isMissingColumn = (error: { message?: string; code?: string }) =>
    error.code === "PGRST204" ||
    /Could not find the '.+' column/i.test(error.message ?? "") ||
    /schema cache/i.test(error.message ?? "");

  const stripMedia = (r: Record<string, unknown>) => {
    const next = { ...r };
    delete next.image_url;
    delete next.video_url;
    delete next.gallery_urls;
    return next;
  };

  const hasMedia =
    Boolean(payload.image_url) ||
    Boolean(payload.video_url) ||
    (payload.gallery_urls?.length ?? 0) > 0;

  if (id) {
    let { error } = await supabase.from("academic_programs").update(row).eq("id", id);
    if (error && isMissingColumn(error)) {
      if (hasMedia) {
        throw new Error(
          "Program media columns are missing. Run public/sql/apply-program-media.sql in Supabase, then save again.",
        );
      }
      ({ error } = await supabase.from("academic_programs").update(stripMedia(row)).eq("id", id));
    }
    if (error) throw error;
    return id;
  }

  const insertRow = { ...row };
  if (userId) insertRow.created_by = userId;

  let { data, error } = await supabase
    .from("academic_programs")
    .insert(insertRow)
    .select("id")
    .single();

  if (error && isMissingColumn(error)) {
    if (hasMedia) {
      throw new Error(
        "Program media columns are missing. Run public/sql/apply-program-media.sql in Supabase, then save again.",
      );
    }
    ({ data, error } = await supabase
      .from("academic_programs")
      .insert(stripMedia(insertRow))
      .select("id")
      .single());
  }

  if (error) throw error;
  return data.id as string;
}

export async function archiveProgram(id: string, archived: boolean, userId?: string | null) {
  const { error } = await supabase
    .from("academic_programs")
    .update({
      is_archived: archived,
      status: archived ? "archived" : "inactive",
      deleted_by: archived ? userId ?? null : null,
      updated_at: new Date().toISOString(),
      updated_by: userId ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Enable (active) or disable (inactive) a program for portals. */
export async function setProgramEnabled(
  id: string,
  enabled: boolean,
  userId?: string | null,
) {
  const { error } = await supabase
    .from("academic_programs")
    .update({
      status: enabled ? "active" : "inactive",
      is_archived: false,
      updated_at: new Date().toISOString(),
      updated_by: userId ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Active (enabled) programs for teacher / student / parent portals. */
export async function fetchActivePrograms(schoolId: string): Promise<AcademicProgram[]> {
  const { data, error } = await supabase
    .from("academic_programs")
    .select("*")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .eq("is_archived", false)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((p) => {
    const row = p as Record<string, unknown>;
    return {
      ...row,
      status: ((row.status as string) ?? "active") as ProgramStatus,
      subjects: (row.subjects as string[] | null) ?? [],
      image_url: typeof row.image_url === "string" && row.image_url.trim() ? row.image_url : null,
      video_url: typeof row.video_url === "string" && row.video_url.trim() ? row.video_url : null,
      gallery_urls: Array.isArray(row.gallery_urls)
        ? (row.gallery_urls as string[]).filter((u) => typeof u === "string" && u.trim())
        : [],
    } as AcademicProgram;
  });
}

export async function deleteProgram(id: string) {
  const { error } = await supabase.from("academic_programs").delete().eq("id", id);
  if (error) throw error;
}

export type ProgramEnrollmentRow = {
  id: string;
  program_id: string;
  student_id: string;
  enrolled_on: string;
  status: string;
  notes: string | null;
  students?: {
    id: string;
    admission_no?: string | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  } | null;
};

export type ProgramClassAssignmentRow = {
  id: string;
  program_id: string;
  class_id: string;
  teacher_id: string | null;
  assigned_on: string;
  status: string;
  notes: string | null;
  classes?: { id: string; name?: string | null; level?: string | null } | null;
  teachers?: {
    id: string;
    employee_no?: string | null;
    profiles?: { full_name?: string | null } | null;
  } | null;
};

function isMissingRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

export async function fetchProgramEnrollments(programId: string): Promise<ProgramEnrollmentRow[]> {
  const { data, error } = await supabase
    .from("academic_program_enrollments")
    .select(`
      id, program_id, student_id, enrolled_on, status, notes,
      students(id, admission_no, profiles(full_name, email))
    `)
    .eq("program_id", programId)
    .eq("status", "active")
    .order("enrolled_on", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []) as ProgramEnrollmentRow[];
}

export async function enrollStudentInProgram(params: {
  schoolId: string;
  programId: string;
  studentId: string;
  userId?: string | null;
  notes?: string;
}) {
  const { error } = await supabase.from("academic_program_enrollments").upsert(
    {
      school_id: params.schoolId,
      program_id: params.programId,
      student_id: params.studentId,
      enrolled_on: new Date().toISOString().slice(0, 10),
      status: "active",
      notes: params.notes ?? null,
      created_by: params.userId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "program_id,student_id" },
  );
  if (error) {
    if (isMissingRelation(error)) {
      throw new Error(
        "Program enrollments table is missing. Run public/sql/apply-program-enrollments.sql in Supabase.",
      );
    }
    throw error;
  }
}

export async function removeProgramEnrollment(enrollmentId: string) {
  const { error } = await supabase
    .from("academic_program_enrollments")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", enrollmentId);
  if (error) throw error;
}

export async function fetchProgramClassAssignments(
  programId: string,
): Promise<ProgramClassAssignmentRow[]> {
  const { data, error } = await supabase
    .from("academic_program_class_assignments")
    .select(`
      id, program_id, class_id, teacher_id, assigned_on, status, notes,
      classes(id, name, level),
      teachers(id, employee_no, profiles(full_name))
    `)
    .eq("program_id", programId)
    .eq("status", "active")
    .order("assigned_on", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []) as ProgramClassAssignmentRow[];
}

export async function assignClassTeacherToProgram(params: {
  schoolId: string;
  programId: string;
  classId: string;
  teacherId: string;
  userId?: string | null;
  notes?: string;
}) {
  const { error } = await supabase.from("academic_program_class_assignments").upsert(
    {
      school_id: params.schoolId,
      program_id: params.programId,
      class_id: params.classId,
      teacher_id: params.teacherId,
      assigned_on: new Date().toISOString().slice(0, 10),
      status: "active",
      notes: params.notes ?? null,
      created_by: params.userId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "program_id,class_id" },
  );
  if (error) {
    if (isMissingRelation(error)) {
      throw new Error(
        "Program class assignments table is missing. Run public/sql/apply-program-enrollments.sql in Supabase.",
      );
    }
    throw error;
  }
}

export async function removeProgramClassAssignment(assignmentId: string) {
  const { error } = await supabase
    .from("academic_program_class_assignments")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) throw error;
}
