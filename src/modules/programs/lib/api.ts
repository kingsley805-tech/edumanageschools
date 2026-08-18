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
