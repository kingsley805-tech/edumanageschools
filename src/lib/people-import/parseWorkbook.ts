import * as XLSX from "xlsx";
import type { NormalizedRow } from "./types";

/** Normalize header labels to snake_case keys for matching. */
export function normalizeHeader(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s/\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  admission_number: "admission_no",
  student_id: "admission_no",
  admission_no: "admission_no",
  admission: "admission_no",
  adm_no: "admission_no",
  adm_number: "admission_no",
  student_no: "admission_no",
  student_number: "admission_no",
  index_number: "admission_no",
  index_no: "admission_no",
  student_admission_id: "admission_no",
  full_name: "full_name",
  name: "full_name",
  student_name: "full_name",
  teacher_name: "full_name",
  parent_name: "full_name",
  guardian_name: "full_name",
  gender: "gender",
  sex: "gender",
  date_of_birth: "date_of_birth",
  dob: "date_of_birth",
  birth_date: "date_of_birth",
  birthdate: "date_of_birth",
  birthday: "date_of_birth",
  class: "class",
  class_name: "class",
  form: "class",
  grade: "class",
  section: "section",
  stream: "section",
  section_stream: "section",
  academic_year: "academic_year",
  parent_guardian: "parent_name",
  parent: "parent_name",
  guardian: "parent_name",
  parent_phone: "parent_phone",
  guardian_phone: "parent_phone",
  parent_email: "parent_email",
  guardian_email: "parent_email",
  address: "address",
  teacher_id: "employee_no",
  employee_no: "employee_no",
  employee_number: "employee_no",
  staff_id: "employee_no",
  phone: "phone",
  mobile: "phone",
  email: "email",
  department: "department",
  subjects: "subjects",
  subject: "subjects",
  classes_assigned: "classes_assigned",
  classes: "classes_assigned",
  parent_id: "parent_id",
  guardian_id: "parent_id",
  occupation: "occupation",
  relationship: "relationship",
  relationship_to_student: "relationship",
  student_admission_no: "student_admission_nos",
  student_admission_numbers: "student_admission_nos",
  children_admission_numbers: "student_admission_nos",
  password: "password",
};

export function canonicalKey(header: string): string {
  const n = normalizeHeader(header);
  return HEADER_ALIASES[n] ?? n;
}

export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date detection (rough): treat large day-serials as dates
    if (value > 20000 && value < 60000) {
      try {
        const SSF = (XLSX as { SSF?: { parse_date_code?: (n: number) => { y: number; m: number; d: number } | null } }).SSF;
        const parsed = SSF?.parse_date_code?.(value);
        if (parsed) {
          const y = parsed.y;
          const m = String(parsed.m).padStart(2, "0");
          const d = String(parsed.d).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
      } catch {
        /* fall through */
      }
    }
    return String(value);
  }
  return String(value).trim();
}

export async function parseWorkbookFile(file: File): Promise<{
  headers: string[];
  rows: NormalizedRow[];
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets.");
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (!matrix.length) throw new Error("Spreadsheet is empty.");

  const headerCells = (matrix[0] ?? []).map((h) => cellToString(h));
  if (!headerCells.some((h) => h.length > 0)) {
    throw new Error("Missing header row.");
  }

  const keys = headerCells.map((h) => (h ? canonicalKey(h) : ""));
  const seen = new Set<string>();
  for (const k of keys) {
    if (!k) continue;
    if (seen.has(k)) throw new Error(`Duplicate column "${k}" in header row.`);
    seen.add(k);
  }

  const rows: NormalizedRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const row: NormalizedRow = {};
    let any = false;
    keys.forEach((key, colIdx) => {
      if (!key) return;
      const val = cellToString(line[colIdx]);
      if (val) any = true;
      row[key] = val;
    });
    if (!any) continue;
    rows.push(row);
  }

  return { headers: keys.filter(Boolean), rows };
}
