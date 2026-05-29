// @ts-nocheck
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

const DB_FIX_HINT =
  "Open Supabase → SQL Editor → run the full file: supabase/scripts/FIX_REPORT_RLS.sql then try again.";

function isRpcMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    msg.includes("could not find the function") ||
    msg.includes("schema cache") ||
    msg.includes("upsert_term_report_card")
  );
}

/** Save or update a term report card (uses DB RPC to avoid RLS failures). */
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

  const effectiveClassId = input.classId || existingRow?.class_id || studentRow?.class_id || null;
  const effectiveSchoolId =
    studentRow?.school_id ?? existingRow?.school_id ?? input.schoolId;

  if (!effectiveSchoolId) {
    throw new Error(
      "Cannot save report: student school is missing. Ask your admin to link the student to your school.",
    );
  }

  if (!effectiveClassId) {
    throw new Error(
      "Cannot save report: student has no class. Assign the student to a class first.",
    );
  }

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
    version: existingRow?.id ? (existingRow.version ?? input.version) + 1 : 1,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc("upsert_term_report_card", {
    p_row: payload as never,
  });

  if (rpcError) {
    if (isRpcMissing(rpcError)) {
      throw new Error(`Report save is not configured on the database yet. ${DB_FIX_HINT}`);
    }
    if ((rpcError.message ?? "").includes("row-level security")) {
      throw new Error(`Report save blocked by database security. ${DB_FIX_HINT}`);
    }
    throw new Error(rpcError.message);
  }

  if (!rpcData || typeof rpcData !== "object") {
    throw new Error(`Report save failed. ${DB_FIX_HINT}`);
  }

  const row = rpcData as { id: string; version: number; status: ReportCardStatus };
  const id = row.id;
  const nextVersion = row.version;

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

  return { id, version: nextVersion, status: input.nextStatus };
}