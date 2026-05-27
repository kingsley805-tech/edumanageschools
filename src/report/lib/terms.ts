import { supabase } from "@/integrations/supabase/client";
import { isMissingSchemaColumnError } from "@/report/lib/supabase-errors";

/** Safe column list (works with or without optional `term_kind` migration). */
const TERM_SELECT =
  "id, school_id, session, name, start_date, end_date, is_current, created_at";

function normalizeTerm(row: Record<string, unknown>): SchoolTerm {
  return {
    id: row.id as string,
    school_id: row.school_id as string,
    session: row.session as string,
    name: row.name as string,
    term_kind: (row.term_kind as TermKind | null) ?? "term",
    start_date: (row.start_date as string | null) ?? null,
    end_date: (row.end_date as string | null) ?? null,
    is_current: (row.is_current as boolean | null) ?? null,
    created_at: row.created_at as string,
  };
}

export type TermKind = "term" | "semester" | "academic_year";

export type SchoolTerm = {
  id: string;
  school_id: string;
  session: string;
  name: string;
  term_kind: TermKind | string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  created_at: string;
};

export const TERM_KIND_OPTIONS: { value: TermKind; label: string }[] = [
  { value: "term", label: "Term (e.g. Term 1, Term 2, Term 3)" },
  { value: "semester", label: "Semester" },
  { value: "academic_year", label: "Academic Year" },
];

export function formatTermLabel(term: Pick<SchoolTerm, "name" | "session"> | null | undefined): string {
  if (!term) return "—";
  return term.session ? `${term.name} · ${term.session}` : term.name;
}

export function academicYearFromTerm(term: Pick<SchoolTerm, "session" | "name"> | null | undefined): string {
  if (!term) return "";
  return term.session?.trim() || term.name || "";
}

/** Human-readable date for report card fields (e.g. 15 December 2024). */
export function formatTermDateForReport(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const raw = iso.trim();
  try {
    const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return raw;
  }
}

export type TermReportDates = {
  schoolCloses: string;
  reopeningDate: string;
  nextTerm: string;
};

type TermDateRow = Pick<SchoolTerm, "id" | "name" | "start_date" | "end_date" | "created_at">;

function sortTermsChronologically(terms: TermDateRow[]): TermDateRow[] {
  return [...terms].sort((a, b) => {
    const aStart = a.start_date ? new Date(a.start_date).getTime() : Number.POSITIVE_INFINITY;
    const bStart = b.start_date ? new Date(b.start_date).getTime() : Number.POSITIVE_INFINITY;
    if (aStart !== bStart) return aStart - bStart;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/** School closes / reopening / next term from the active term and the following term. */
export async function fetchTermReportDates(
  schoolId: string,
  termId: string,
): Promise<TermReportDates> {
  if (!schoolId || !termId) {
    return { schoolCloses: "", reopeningDate: "", nextTerm: "" };
  }

  const { data: terms, error } = await supabase
    .from("terms")
    .select("id, name, start_date, end_date, created_at")
    .eq("school_id", schoolId);
  if (error) throw error;

  const rows = (terms ?? []) as TermDateRow[];
  const current = rows.find((t) => t.id === termId);
  if (!current) return { schoolCloses: "", reopeningDate: "", nextTerm: "" };

  const ordered = sortTermsChronologically(rows);
  const idx = ordered.findIndex((t) => t.id === termId);
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return {
    schoolCloses: formatTermDateForReport(current.end_date),
    reopeningDate: formatTermDateForReport(next?.start_date ?? null),
    nextTerm: next?.name?.trim() ?? "",
  };
}

export function applyTermDatesToForm(
  form: { schoolCloses: string; reopeningDate: string; nextTerm: string },
  dates: TermReportDates,
): typeof form {
  return {
    ...form,
    schoolCloses: form.schoolCloses?.trim() || dates.schoolCloses,
    reopeningDate: form.reopeningDate?.trim() || dates.reopeningDate,
    nextTerm:
      form.nextTerm?.trim() && form.nextTerm.trim() !== "Third Term"
        ? form.nextTerm
        : dates.nextTerm || form.nextTerm,
  };
}

async function selectTerms(schoolId: string, mode: "all" | "current" | "latest" = "all") {
  if (!schoolId) return mode === "all" ? [] : null;

  let q = supabase.from("terms").select(TERM_SELECT).eq("school_id", schoolId);
  if (mode === "current") q = q.eq("is_current", true);
  q = q.order("created_at", { ascending: false });
  if (mode === "current" || mode === "latest") {
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return data;
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchSchoolTerms(schoolId: string): Promise<SchoolTerm[]> {
  const data = await selectTerms(schoolId, "all");
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r) => normalizeTerm(r as Record<string, unknown>));
}

export async function fetchCurrentTerm(schoolId: string): Promise<SchoolTerm | null> {
  const current = await selectTerms(schoolId, "current");
  if (current) return normalizeTerm(current as Record<string, unknown>);
  const latest = await selectTerms(schoolId, "latest");
  return latest ? normalizeTerm(latest as Record<string, unknown>) : null;
}

export async function setCurrentTerm(termId: string): Promise<void> {
  const { error } = await supabase.rpc("set_school_current_term", { p_term_id: termId });
  if (!error) return;
  if (!/function|42883|PGRST202/i.test(error.message ?? "")) {
    throw error;
  }
  const { data: term, error: termErr } = await supabase
    .from("terms")
    .select("school_id")
    .eq("id", termId)
    .single();
  if (termErr || !term) throw termErr ?? new Error("Term not found");
  await supabase.from("terms").update({ is_current: false }).eq("school_id", term.school_id);
  const { error: upErr } = await supabase.from("terms").update({ is_current: true }).eq("id", termId);
  if (upErr) throw upErr;
}

export async function createSchoolTerm(input: {
  schoolId: string;
  session: string;
  name: string;
  termKind?: TermKind;
  startDate?: string;
  endDate?: string;
  makeCurrent?: boolean;
}): Promise<SchoolTerm> {
  if (input.makeCurrent) {
    const { error: clearErr } = await supabase
      .from("terms")
      .update({ is_current: false })
      .eq("school_id", input.schoolId);
    if (clearErr) throw clearErr;
  }
  const baseRow = {
    school_id: input.schoolId,
    session: input.session.trim(),
    name: input.name.trim(),
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    is_current: input.makeCurrent ?? false,
  };
  const withKind = { ...baseRow, term_kind: input.termKind ?? "term" };
  let { data, error } = await supabase.from("terms").insert(withKind).select(TERM_SELECT).single();
  if (isMissingSchemaColumnError(error)) {
    ({ data, error } = await supabase.from("terms").insert(baseRow).select(TERM_SELECT).single());
  }
  if (error) throw error;
  if (!data) throw new Error("Term was created but could not be loaded. Refresh the page.");
  const term = normalizeTerm({ ...data, term_kind: input.termKind ?? "term" } as Record<string, unknown>);
  return term;
}

export async function updateSchoolTerm(
  termId: string,
  patch: Partial<Pick<SchoolTerm, "session" | "name" | "term_kind" | "start_date" | "end_date">>,
): Promise<void> {
  const { term_kind, ...rest } = patch;
  const payload: Record<string, unknown> = { ...rest };
  if (term_kind !== undefined) payload.term_kind = term_kind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { error } = await supabase.from("terms").update(payload as any).eq("id", termId);
  if (isMissingSchemaColumnError(error) && term_kind !== undefined) {
    ({ error } = await supabase.from("terms").update(rest).eq("id", termId));
  }
  if (error) throw error;
}

export async function deleteSchoolTerm(termId: string): Promise<void> {
  const { count, error: countErr } = await supabase
    .from("term_report_cards")
    .select("id", { count: "exact", head: true })
    .eq("term_id", termId);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete a term that has report cards. Archive reports remain linked to this term.");
  }
  const { error } = await supabase.from("terms").delete().eq("id", termId);
  if (error) throw error;
}
