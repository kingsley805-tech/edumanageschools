import { downloadExcel } from "@/modules/lib/exportTable";
import type { BulkImportRowResult, ValidatedImportRow } from "./types";

export function downloadValidationErrorReport(
  entity: string,
  rows: ValidatedImportRow[],
) {
  const invalid = rows.filter((r) => r.status === "invalid");
  downloadExcel(
    `${entity}-import-validation-errors`,
    ["Row", "Errors", "Warnings"],
    invalid.map((r) => [
      r.rowNumber,
      r.errors.join("; "),
      r.warnings.join("; "),
    ]),
    "Errors",
  );
}

export function downloadImportResultReport(
  entity: string,
  results: BulkImportRowResult[],
) {
  downloadExcel(
    `${entity}-import-results`,
    ["Row", "Action", "Message", "Entity ID"],
    results.map((r) => [r.rowNumber, r.action, r.message ?? "", r.entityId ?? ""]),
    "Results",
  );
}
