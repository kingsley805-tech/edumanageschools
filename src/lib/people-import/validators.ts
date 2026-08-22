import type {
  ImportContextLookups,
  PeopleImportEntity,
  ValidatedImportRow,
} from "./types";
import { parseClassLabel } from "./lookups";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /^[\d\s+\-()]{7,20}$/;

export function isValidEmail(value: string): boolean {
  return !value || EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 && PHONE_RE.test(value.trim());
}

export function parseDateOfBirth(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : v;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const d = new Date(iso + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function normalizeGender(raw: string): string | null {
  const g = raw.trim().toLowerCase();
  if (!g) return null;
  if (["m", "male", "boy"].includes(g)) return "male";
  if (["f", "female", "girl"].includes(g)) return "female";
  if (["other", "o", "non-binary", "nb"].includes(g)) return "other";
  return null;
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findClassId(
  lookups: ImportContextLookups,
  className: string,
  section: string,
): { id: string | null; error?: string; createdLabel?: string } {
  if (!className.trim()) return { id: null };

  const parsed = parseClassLabel(className, section);
  const target = normKey(className);
  const nameKey = normKey(parsed.name);
  const sectionKey = parsed.stream ? normKey(parsed.stream) : "";
  const combined = sectionKey ? `${nameKey}${sectionKey}` : nameKey;

  const matches = lookups.classes.filter((c) => {
    const name = normKey(c.name);
    const stream = c.stream ? normKey(c.stream) : "";
    const level = c.level ? normKey(c.level) : "";
    if (name === target) return true;
    if (`${name} ${stream}`.trim() === target) return true;
    if (`${name}${stream}` === target.replace(/\s+/g, "")) return true;
    if (name === nameKey && (!sectionKey || stream === sectionKey)) return true;
    if (`${name}${stream}` === combined) return true;
    if (level === target || level === nameKey) return true;
    return false;
  });

  if (matches.length === 0) {
    return {
      id: null,
      error: `Class "${className}"${section ? ` / ${section}` : ""} not found`,
    };
  }
  if (matches.length > 1 && sectionKey) {
    const exact = matches.find((c) => normKey(c.stream ?? "") === sectionKey);
    if (exact) return { id: exact.id };
    const byName = matches.find((c) => normKey(c.name) === nameKey && normKey(c.stream ?? "") === sectionKey);
    if (byName) return { id: byName.id };
  }
  if (matches.length > 1 && !sectionKey) {
    const exactName = matches.find((c) => normKey(c.name) === target || normKey(c.name) === combined);
    if (exactName) return { id: exactName.id };
  }
  return { id: matches[0].id };
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function admissionMatch(lookups: ImportContextLookups, admissionNo: string) {
  const key = admissionNo.trim().toLowerCase();
  return lookups.existingStudents.find((s) => {
    const a = (s.admission_no ?? "").trim().toLowerCase();
    const b = (s.admission_number ?? "").trim().toLowerCase();
    return a === key || b === key;
  });
}

function generateAdmissionNo(
  lookups: ImportContextLookups,
  rowNumber: number,
  used: Set<string>,
): string {
  const prefix = (lookups.schoolCode || "STU").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "STU";
  const year = new Date().getFullYear();
  let seq = lookups.existingStudents.length + used.size + 1;
  for (let i = 0; i < 5000; i++) {
    const candidate = `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
    const key = candidate.toLowerCase();
    if (!used.has(key) && !admissionMatch(lookups, candidate)) {
      used.add(key);
      return candidate;
    }
    seq += 1;
  }
  const fallback = `${prefix}-${year}-R${rowNumber}-${Date.now().toString(36).slice(-4)}`;
  used.add(fallback.toLowerCase());
  return fallback;
}

export function validateStudentRows(
  rows: Record<string, string>[],
  lookups: ImportContextLookups,
): ValidatedImportRow[] {
  const seenAdmissions = new Set<string>();
  return rows.map((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    let admission_no = (raw.admission_no ?? "").trim();
    const full_name = (raw.full_name ?? "").trim();
    const genderRaw = raw.gender ?? "";
    const dobRaw = raw.date_of_birth ?? "";
    const className = (raw.class ?? "").trim();
    const section = (raw.section ?? "").trim();
    const parent_name = (raw.parent_name ?? "").trim();
    const parent_phone = (raw.parent_phone ?? "").trim();
    const parent_email = (raw.parent_email ?? "").trim();
    const address = (raw.address ?? "").trim();
    const academic_year = (raw.academic_year ?? "").trim();
    const password = (raw.password ?? "").trim() || "ChangeMe123!";

    if (!admission_no) {
      admission_no = generateAdmissionNo(lookups, rowNumber, seenAdmissions);
      warnings.push(`Admission number auto-generated: ${admission_no}`);
    }
    if (!full_name) errors.push("Full name is required");

    const gender = normalizeGender(genderRaw);
    if (genderRaw.trim() && !gender) errors.push("Invalid gender (use male/female/other)");
    if (!genderRaw.trim()) warnings.push("Gender not set");

    const date_of_birth = parseDateOfBirth(dobRaw);
    if (dobRaw.trim() && !date_of_birth) errors.push("Invalid date of birth");
    if (!dobRaw.trim()) warnings.push("Date of birth not set");

    if (parent_email && !isValidEmail(parent_email)) errors.push("Invalid parent email");
    if (parent_phone && !isValidPhone(parent_phone)) errors.push("Invalid parent phone");

    let class_id: string | null = null;
    if (className) {
      const found = findClassId(lookups, className, section);
      if (found.error) errors.push(found.error);
      else class_id = found.id;
    } else {
      warnings.push("No class assigned");
    }

    const admKey = admission_no.toLowerCase();
    if ((raw.admission_no ?? "").trim() && seenAdmissions.has(admKey)) {
      errors.push("Duplicate admission number in this file");
    }
    seenAdmissions.add(admKey);

    const existing = admission_no ? admissionMatch(lookups, admission_no) : undefined;
    const status = errors.length ? "invalid" : existing ? "update" : "valid";

    const payload =
      status === "invalid"
        ? null
        : {
            admission_no,
            full_name,
            gender,
            date_of_birth,
            class_id,
            class_name: className,
            section,
            academic_year,
            parent_name,
            parent_phone,
            parent_email,
            address,
            password,
            existing_student_id: existing?.id ?? null,
          };

    return { rowNumber, raw, status, errors, warnings, payload };
  });
}

export function validateTeacherRows(
  rows: Record<string, string>[],
  lookups: ImportContextLookups,
): ValidatedImportRow[] {
  const seenEmp = new Set<string>();
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();

  return rows.map((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const employee_no = (raw.employee_no ?? "").trim();
    const full_name = (raw.full_name ?? "").trim();
    const gender = normalizeGender(raw.gender ?? "");
    const phone = (raw.phone ?? "").trim();
    const email = (raw.email ?? "").trim().toLowerCase();
    const address = (raw.address ?? "").trim();
    const department = (raw.department ?? "").trim();
    const subjectsRaw = (raw.subjects ?? "").trim();
    const classesRaw = (raw.classes_assigned ?? "").trim();
    const password = (raw.password ?? "").trim() || "ChangeMe123!";

    if (!employee_no) errors.push("Teacher ID / Employee number is required");
    if (!full_name) errors.push("Full name is required");
    if (!email) errors.push("Email is required");
    else if (!isValidEmail(email)) errors.push("Invalid email");
    if (phone && !isValidPhone(phone)) errors.push("Invalid phone");
    if ((raw.gender ?? "").trim() && !gender) errors.push("Invalid gender");

    const subjectNames = splitList(subjectsRaw);
    const subjectIds: string[] = [];
    for (const name of subjectNames) {
      const match = lookups.subjects.find((s) => normKey(s.name) === normKey(name));
      if (!match) errors.push(`Subject "${name}" not found`);
      else subjectIds.push(match.id);
    }

    const classNames = splitList(classesRaw);
    const classIds: string[] = [];
    for (const name of classNames) {
      const found = findClassId(lookups, name, "");
      if (found.error || !found.id) errors.push(found.error ?? `Class "${name}" not found`);
      else classIds.push(found.id);
    }

    const empKey = employee_no.toLowerCase();
    if (empKey && seenEmp.has(empKey)) errors.push("Duplicate teacher ID in this file");
    if (empKey) seenEmp.add(empKey);
    if (email && seenEmail.has(email)) errors.push("Duplicate email in this file");
    if (email) seenEmail.add(email);
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits && seenPhone.has(phoneDigits)) errors.push("Duplicate phone in this file");
    if (phoneDigits) seenPhone.add(phoneDigits);

    const existing =
      lookups.existingTeachers.find(
        (t) => (t.employee_no ?? "").trim().toLowerCase() === empKey,
      ) ??
      lookups.existingTeachers.find((t) => (t.email ?? "").trim().toLowerCase() === email);

    if (existing && email) {
      const otherWithEmail = lookups.existingTeachers.find(
        (t) => t.id !== existing.id && (t.email ?? "").toLowerCase() === email,
      );
      if (otherWithEmail) errors.push("Email already used by another teacher");
    }

    const status = errors.length ? "invalid" : existing ? "update" : "valid";
    const payload =
      status === "invalid"
        ? null
        : {
            employee_no,
            full_name,
            gender,
            phone,
            email,
            address,
            department,
            subject_ids: subjectIds,
            subject_names: subjectNames,
            class_ids: classIds,
            class_names: classNames,
            password,
            subject_specialty: subjectNames[0] ?? department ?? null,
            existing_teacher_id: existing?.id ?? null,
          };

    return { rowNumber, raw, status, errors, warnings, payload };
  });
}

export function validateParentRows(
  rows: Record<string, string>[],
  lookups: ImportContextLookups,
): ValidatedImportRow[] {
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();

  return rows.map((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const parent_id = (raw.parent_id ?? "").trim();
    const full_name = (raw.full_name ?? "").trim();
    const phone = (raw.phone ?? "").trim();
    const email = (raw.email ?? "").trim().toLowerCase();
    const address = (raw.address ?? "").trim();
    const occupation = (raw.occupation ?? "").trim();
    const relationship = (raw.relationship ?? "").trim() || "Parent";
    const studentAdmissionNos = splitList(raw.student_admission_nos ?? "");
    const password = (raw.password ?? "").trim() || "ChangeMe123!";

    if (!full_name) errors.push("Full name is required");
    if (!email && !phone) errors.push("Email or phone is required");
    if (email && !isValidEmail(email)) errors.push("Invalid email");
    if (phone && !isValidPhone(phone)) errors.push("Invalid phone");
    if (!studentAdmissionNos.length) {
      warnings.push("No student admission IDs — parent will not be linked to children");
    }

    const studentIds: string[] = [];
    for (const adm of studentAdmissionNos) {
      const st = admissionMatch(lookups, adm);
      if (!st) errors.push(`Student admission "${adm}" not found`);
      else studentIds.push(st.id);
    }

    if (email && seenEmail.has(email)) errors.push("Duplicate email in this file");
    if (email) seenEmail.add(email);
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits && seenPhone.has(phoneDigits)) errors.push("Duplicate phone in this file");
    if (phoneDigits) seenPhone.add(phoneDigits);

    const existing =
      (email
        ? lookups.existingParents.find((p) => (p.email ?? "").toLowerCase() === email)
        : undefined) ??
      (phoneDigits
        ? lookups.existingParents.find(
            (p) => (p.phone ?? "").replace(/\D/g, "") === phoneDigits,
          )
        : undefined);

    const status = errors.length ? "invalid" : existing ? "update" : "valid";
    const payload =
      status === "invalid"
        ? null
        : {
            parent_id,
            full_name,
            phone,
            email: email || null,
            address,
            occupation,
            relationship,
            student_ids: studentIds,
            student_admission_nos: studentAdmissionNos,
            password,
            existing_parent_id: existing?.id ?? null,
          };

    return { rowNumber, raw, status, errors, warnings, payload };
  });
}

export function validateRows(
  entity: PeopleImportEntity,
  rows: Record<string, string>[],
  lookups: ImportContextLookups,
): ValidatedImportRow[] {
  if (entity === "student") return validateStudentRows(rows, lookups);
  if (entity === "teacher") return validateTeacherRows(rows, lookups);
  return validateParentRows(rows, lookups);
}
