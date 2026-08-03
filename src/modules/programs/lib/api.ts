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
  return (data ?? []).map((p) => ({
    ...p,
    status: (p.status ?? "active") as ProgramStatus,
    subjects: (p.subjects as string[] | null) ?? [],
  })) as AcademicProgram[];
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
  status?: ProgramStatus;
};

export async function saveProgram(
  schoolId: string,
  payload: ProgramPayload,
  id?: string,
  userId?: string | null,
) {
  const row = {
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
    status: payload.status ?? "active",
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  };

  if (id) {
    const { error } = await supabase.from("academic_programs").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase
    .from("academic_programs")
    .insert({ ...row, created_by: userId ?? null })
    .select("id")
    .single();
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

export async function deleteProgram(id: string) {
  const { error } = await supabase.from("academic_programs").delete().eq("id", id);
  if (error) throw error;
}
