import { supabase } from "@/integrations/supabase/client";
import { setCurrentTerm } from "@/report/lib/terms";

export type AcademicYear = {
  id: string;
  school_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  created_at?: string;
};

export type FinanceTerm = {
  id: string;
  school_id: string;
  name: string;
  session: string;
  start_date: string | null;
  end_date: string | null;
  fees_due_date: string | null;
  academic_year_id: string | null;
  is_current: boolean | null;
  academic_years?: { name: string } | null;
};

export async function fetchAcademicYears(schoolId: string): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("*")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AcademicYear[];
}

export async function createAcademicYear(input: {
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  makeCurrent?: boolean;
}): Promise<AcademicYear> {
  if (input.makeCurrent) {
    const { error: clearErr } = await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("school_id", input.schoolId);
    if (clearErr) throw clearErr;
  }

  const { data, error } = await supabase
    .from("academic_years")
    .insert({
      school_id: input.schoolId,
      name: input.name.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      is_current: input.makeCurrent ?? false,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Academic year was created but could not be loaded.");
  return data as AcademicYear;
}

export async function setCurrentAcademicYear(schoolId: string, yearId: string): Promise<void> {
  const { error: clearErr } = await supabase
    .from("academic_years")
    .update({ is_current: false })
    .eq("school_id", schoolId);
  if (clearErr) throw clearErr;

  const { error } = await supabase
    .from("academic_years")
    .update({ is_current: true })
    .eq("id", yearId);
  if (error) throw error;
}

export async function deleteAcademicYear(yearId: string): Promise<void> {
  const { error } = await supabase.from("academic_years").delete().eq("id", yearId);
  if (error) throw error;
}

export async function fetchFinanceTerms(schoolId: string): Promise<FinanceTerm[]> {
  const { data, error } = await supabase
    .from("terms")
    .select("id, school_id, name, session, start_date, end_date, fees_due_date, academic_year_id, is_current, academic_years(name)")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as FinanceTerm[];
}

export async function createFinanceTerm(input: {
  schoolId: string;
  academicYearId: string;
  academicYearName: string;
  name: string;
  startDate: string;
  endDate: string;
  feesDueDate: string;
  makeCurrent?: boolean;
}): Promise<FinanceTerm> {
  if (input.makeCurrent) {
    await supabase.from("terms").update({ is_current: false }).eq("school_id", input.schoolId);
  }

  const row = {
    school_id: input.schoolId,
    academic_year_id: input.academicYearId,
    session: input.academicYearName.trim(),
    name: input.name.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
    fees_due_date: input.feesDueDate,
    is_current: input.makeCurrent ?? false,
  };

  const { data, error } = await supabase.from("terms").insert(row).select(
    "id, school_id, name, session, start_date, end_date, fees_due_date, academic_year_id, is_current, academic_years(name)"
  ).single();

  if (error) throw error;
  if (!data) throw new Error("Term was created but could not be loaded.");
  return data as FinanceTerm;
}

export async function setCurrentFinanceTerm(termId: string): Promise<void> {
  await setCurrentTerm(termId);
}

export async function deleteFinanceTerm(termId: string): Promise<void> {
  const { error } = await supabase.from("terms").delete().eq("id", termId);
  if (error) throw error;
}
