import { supabase } from "@/integrations/supabase/client";
import type { ReportCardStatus } from "@/report/lib/report-card-status";
import type { ReportFormData } from "@/report/lib/shepherd-grading";
import {
  fetchTermReport,
  formToPayload,
  mergeStoredPositionsForSave,
  saveReportVersion,
} from "@/report/lib/term-report";

export type PersistTermReportInput = {
  form: ReportFormData;
  schoolId: string;
  studentId: string;
  termId: string | null;
  classId: string | null;
  teacherId: string;
  showPositions?: boolean;
  reportId: string | null;
  version: number;
  nextStatus: ReportCardStatus;
  adminComment?: string;
  rejectionReason?: string;
  note?: string;
  skipVersion?: boolean;
};

export type PersistTermReportResult = {
  id: string;
  version: number;
  status: ReportCardStatus;
};

/** Save or update a term report card (shared by editor hook and offline sync). */
export async function persistTermReportCard(
  input: PersistTermReportInput,
): Promise<PersistTermReportResult> {
  const termId = input.termId || null;
  const existingRow = await fetchTermReport(input.studentId, termId);

  let toSave = input.form;
  if (input.showPositions === false && existingRow) {
    toSave = mergeStoredPositionsForSave(input.form, existingRow);
  }

  const { data: studentRow } = await supabase
    .from("students")
    .select("class_id, school_id")
    .eq("id", input.studentId)
    .maybeSingle();

  let effectiveClassId = input.classId || existingRow?.class_id || studentRow?.class_id || null;
  const effectiveSchoolId =
    studentRow?.school_id ?? existingRow?.school_id ?? input.schoolId;

  const payload = {
    ...formToPayload(toSave, {
      schoolId: effectiveSchoolId,
      studentId: input.studentId,
      termId,
      classId: effectiveClassId,
      teacherId: input.teacherId,
      status: input.nextStatus,
      adminComment: input.adminComment,
      rejectionReason: input.rejectionReason,
    }),
    saved_at: new Date().toISOString(),
  };

  let id = existingRow?.id ?? input.reportId;
  let nextVersion = (existingRow?.version ?? input.version) + 1;

  if (id) {
    const { error } = await supabase
      .from("term_report_cards")
      .update({ ...payload, version: nextVersion } as never)
      .eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("term_report_cards")
      .insert({ ...payload, version: 1 } as never)
      .select("id")
      .single();
    if (error) throw error;
    id = (data as { id: string }).id;
    nextVersion = 1;
  }

  if (!input.skipVersion && id) {
    try {
      await saveReportVersion(
        id,
        nextVersion,
        input.nextStatus,
        toSave,
        input.teacherId,
        input.note,
      );
    } catch {
      /* Version history is optional. */
    }
  }

  return { id: id!, version: nextVersion, status: input.nextStatus };
}
