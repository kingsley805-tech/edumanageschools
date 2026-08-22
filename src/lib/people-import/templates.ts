import * as XLSX from "xlsx";
import type { PeopleImportColumn, PeopleImportEntity } from "./types";

export const STUDENT_COLUMNS: PeopleImportColumn[] = [
  { key: "admission_no", header: "Admission Number", required: false, sample: "STU-2026-001" },
  { key: "full_name", header: "Full Name", required: true, sample: "Ama Mensah" },
  { key: "gender", header: "Gender", required: false, sample: "female" },
  { key: "date_of_birth", header: "Date of Birth", required: false, sample: "2012-05-14" },
  { key: "class", header: "Class", required: false, sample: "JHS 1" },
  { key: "section", header: "Section/Stream", required: false, sample: "A" },
  { key: "academic_year", header: "Academic Year", required: false, sample: "2025/2026" },
  { key: "parent_name", header: "Parent/Guardian", required: false, sample: "Kwame Mensah" },
  { key: "parent_phone", header: "Parent Phone", required: false, sample: "0244123456" },
  { key: "parent_email", header: "Parent Email", required: false, sample: "parent@example.com" },
  { key: "address", header: "Address", required: false, sample: "Accra" },
  { key: "password", header: "Password", required: false, sample: "ChangeMe123!" },
];

export const TEACHER_COLUMNS: PeopleImportColumn[] = [
  { key: "employee_no", header: "Teacher ID", required: true, sample: "TCH-001" },
  { key: "full_name", header: "Full Name", required: true, sample: "Kofi Asante" },
  { key: "gender", header: "Gender", required: false, sample: "male" },
  { key: "phone", header: "Phone", required: false, sample: "0201234567" },
  { key: "email", header: "Email", required: true, sample: "kofi@school.edu" },
  { key: "address", header: "Address", required: false, sample: "Kumasi" },
  { key: "department", header: "Department", required: false, sample: "Science" },
  { key: "subjects", header: "Subjects", required: false, sample: "Mathematics, Science" },
  { key: "classes_assigned", header: "Classes Assigned", required: false, sample: "JHS 1, JHS 2" },
  { key: "password", header: "Password", required: false, sample: "ChangeMe123!" },
];

export const PARENT_COLUMNS: PeopleImportColumn[] = [
  { key: "parent_id", header: "Parent/Guardian ID", required: false, sample: "PAR-001" },
  { key: "full_name", header: "Full Name", required: true, sample: "Akosua Boateng" },
  { key: "phone", header: "Phone", required: false, sample: "0244987654" },
  { key: "email", header: "Email", required: false, sample: "akosua@example.com" },
  { key: "address", header: "Address", required: false, sample: "Tema" },
  { key: "occupation", header: "Occupation", required: false, sample: "Trader" },
  { key: "relationship", header: "Relationship", required: false, sample: "Mother" },
  {
    key: "student_admission_nos",
    header: "Student/Admission ID",
    required: false,
    sample: "STU-2026-001, STU-2026-002",
  },
  { key: "password", header: "Password", required: false, sample: "ChangeMe123!" },
];

export function columnsForEntity(entity: PeopleImportEntity): PeopleImportColumn[] {
  if (entity === "student") return STUDENT_COLUMNS;
  if (entity === "teacher") return TEACHER_COLUMNS;
  return PARENT_COLUMNS;
}

export function downloadImportTemplate(entity: PeopleImportEntity) {
  const cols = columnsForEntity(entity);
  const headers = cols.map((c) => c.header);
  const sample = cols.map((c) => c.sample ?? "");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, Math.min(36, h.length + 4)) }));
  XLSX.utils.book_append_sheet(wb, ws, "Import");
  const name =
    entity === "student"
      ? "students-import-template.xlsx"
      : entity === "teacher"
        ? "teachers-import-template.xlsx"
        : "parents-import-template.xlsx";
  XLSX.writeFile(wb, name);
}
