import { supabase } from "@/integrations/supabase/client";
import {
  BACKUP_ENTITIES,
  PAGE_SIZE,
  type BackupEntityDef,
  type BackupScope,
} from "@/lib/system-backup/catalog";

export type FetchedSheet = {
  entity: BackupEntityDef;
  rows: Record<string, unknown>[];
  skipped?: boolean;
  skipReason?: string;
};

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

async function fetchAllPages(
  table: string,
  filter: { column: string; values: string[] } | { column: string; eq: string } | null,
  select = "*",
): Promise<Record<string, unknown>[]> {
  if (filter && "values" in filter && filter.values.length === 0) return [];

  const all: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);

    if (filter) {
      if ("eq" in filter) {
        q = q.eq(filter.column, filter.eq);
      } else if (filter.values.length <= 200) {
        q = q.in(filter.column, filter.values);
      } else {
        // Chunk large IN lists
        const chunkResults: Record<string, unknown>[] = [];
        for (let i = 0; i < filter.values.length; i += 200) {
          const chunk = filter.values.slice(i, i + 200);
          const part = await fetchAllPages(table, { column: filter.column, values: chunk }, select);
          chunkResults.push(...part);
        }
        return chunkResults;
      }
    }

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as Record<string, unknown>[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

function uniqueIds(rows: Record<string, unknown>[], key: string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[key];
    if (typeof v === "string" && v) set.add(v);
  }
  return [...set];
}

export type IdCache = {
  profileIds: string[];
  studentIds: string[];
  teacherIds: string[];
  parentIds: string[];
  classIds: string[];
  roleIds: string[];
  examIds: string[];
  assignmentIds: string[];
  registerIds: string[];
  invoiceIds: string[];
  paymentIds: string[];
  billingAccountIds: string[];
  onlineExamIds: string[];
  reportCardIds: string[];
};

export async function buildIdCache(schoolId: string): Promise<IdCache> {
  const [profiles, students, teachers, parents, classes, roles] = await Promise.all([
    fetchAllPages("profiles", { column: "school_id", eq: schoolId }, "id"),
    fetchAllPages("students", { column: "school_id", eq: schoolId }, "id"),
    fetchAllPages("teachers", { column: "school_id", eq: schoolId }, "id"),
    fetchAllPages("parents", { column: "school_id", eq: schoolId }, "id").catch(() => []),
    fetchAllPages("classes", { column: "school_id", eq: schoolId }, "id"),
    fetchAllPages("roles", { column: "school_id", eq: schoolId }, "id").catch(() => []),
  ]);

  return {
    profileIds: uniqueIds(profiles, "id"),
    studentIds: uniqueIds(students, "id"),
    teacherIds: uniqueIds(teachers, "id"),
    parentIds: uniqueIds(parents, "id"),
    classIds: uniqueIds(classes, "id"),
    roleIds: uniqueIds(roles, "id"),
    examIds: [],
    assignmentIds: [],
    registerIds: [],
    invoiceIds: [],
    paymentIds: [],
    billingAccountIds: [],
    onlineExamIds: [],
    reportCardIds: [],
  };
}

function filterForScope(
  scope: BackupScope,
  schoolId: string,
  ids: IdCache,
): { column: string; values: string[] } | { column: string; eq: string } | null {
  switch (scope) {
    case "school_id":
      return { column: "school_id", eq: schoolId };
    case "school_row":
      return { column: "id", eq: schoolId };
    case "via_profiles":
      return { column: "user_id", values: ids.profileIds };
    case "via_students":
      return { column: "student_id", values: ids.studentIds };
    case "via_classes":
      return { column: "class_id", values: ids.classIds };
    case "via_teachers":
      return { column: "teacher_id", values: ids.teacherIds };
    case "via_parents":
      return { column: "parent_id", values: ids.parentIds };
    case "via_roles":
      return { column: "role_id", values: ids.roleIds };
    case "via_exams":
      return { column: "exam_id", values: ids.examIds };
    case "via_assignments":
      return { column: "assignment_id", values: ids.assignmentIds };
    case "via_registers":
      return { column: "register_id", values: ids.registerIds };
    case "via_invoices":
      return { column: "invoice_id", values: ids.invoiceIds };
    case "via_payments":
      return { column: "payment_id", values: ids.paymentIds };
    case "via_billing_accounts":
      return { column: "billing_account_id", values: ids.billingAccountIds };
    case "via_online_exams":
      return { column: "online_exam_id", values: ids.onlineExamIds };
    case "via_report_cards":
      return { column: "report_id", values: ids.reportCardIds };
    default:
      return { column: "school_id", eq: schoolId };
  }
}

/** Special-case: messages may use sender_id / receiver_id */
async function fetchMessages(ids: IdCache): Promise<Record<string, unknown>[]> {
  if (!ids.profileIds.length) return [];
  const [sent, received] = await Promise.all([
    fetchAllPages("messages", { column: "sender_id", values: ids.profileIds }).catch(() => []),
    fetchAllPages("messages", { column: "receiver_id", values: ids.profileIds }).catch(() => []),
  ]);
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...sent, ...received]) {
    const id = String(row.id ?? "");
    if (id) byId.set(id, row);
  }
  return [...byId.values()];
}

export async function fetchEntityRows(
  entity: BackupEntityDef,
  schoolId: string,
  ids: IdCache,
): Promise<FetchedSheet> {
  try {
    if (entity.table === "messages") {
      const rows = await fetchMessages(ids);
      return { entity, rows };
    }
    if (entity.table === "user_roles") {
      const rows = await fetchAllPages("user_roles", {
        column: "user_id",
        values: ids.profileIds,
      });
      return { entity, rows };
    }
    if (entity.table === "parent_student_links") {
      const byStudent = await fetchAllPages("parent_student_links", {
        column: "student_id",
        values: ids.studentIds,
      }).catch(() => []);
      const byParent = ids.parentIds.length
        ? await fetchAllPages("parent_student_links", {
            column: "parent_id",
            values: ids.parentIds,
          }).catch(() => [])
        : [];
      const byId = new Map<string, Record<string, unknown>>();
      for (const row of [...byStudent, ...byParent]) {
        const id = String(row.id ?? "");
        if (id) byId.set(id, row);
      }
      return { entity, rows: [...byId.values()] };
    }

    const filter = filterForScope(entity.scope, schoolId, ids);
    const rows = await fetchAllPages(entity.table, filter, entity.select ?? "*");

    // Enrich ID cache for dependent entities
    if (entity.table === "exams") ids.examIds = uniqueIds(rows, "id");
    if (entity.table === "assignments") ids.assignmentIds = uniqueIds(rows, "id");
    if (entity.table === "class_registers") ids.registerIds = uniqueIds(rows, "id");
    if (entity.table === "billing_invoices") ids.invoiceIds = uniqueIds(rows, "id");
    if (entity.table === "billing_payments") ids.paymentIds = uniqueIds(rows, "id");
    if (entity.table === "billing_accounts") ids.billingAccountIds = uniqueIds(rows, "id");
    if (entity.table === "online_exams") ids.onlineExamIds = uniqueIds(rows, "id");
    if (entity.table === "term_report_cards") ids.reportCardIds = uniqueIds(rows, "id");

    return { entity, rows };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (entity.optional || isMissingRelationError(err)) {
      return {
        entity,
        rows: [],
        skipped: true,
        skipReason: err.message || "Table not available",
      };
    }
    throw new Error(`Failed to export ${entity.table}: ${err.message || "unknown error"}`);
  }
}

export async function fetchAllBackupSheets(
  schoolId: string,
  onProgress?: (done: number, total: number, entity: BackupEntityDef) => void,
): Promise<FetchedSheet[]> {
  const ids = await buildIdCache(schoolId);
  const results: FetchedSheet[] = [];
  const total = BACKUP_ENTITIES.length;

  for (let i = 0; i < BACKUP_ENTITIES.length; i++) {
    const entity = BACKUP_ENTITIES[i];
    onProgress?.(i, total, entity);
    const sheet = await fetchEntityRows(entity, schoolId, ids);
    results.push(sheet);
  }
  onProgress?.(total, total, BACKUP_ENTITIES[BACKUP_ENTITIES.length - 1]);
  return enrichReadableSheets(results);
}

/** Add human-readable name/email/class columns for people & academic sheets. */
function enrichReadableSheets(sheets: FetchedSheet[]): FetchedSheet[] {
  const byTable = new Map(sheets.map((s) => [s.entity.table, s]));
  const profiles = byTable.get("profiles")?.rows ?? [];
  const classes = byTable.get("classes")?.rows ?? [];
  const students = byTable.get("students")?.rows ?? [];
  const parents = byTable.get("parents")?.rows ?? [];
  const teachers = byTable.get("teachers")?.rows ?? [];
  const subjects = byTable.get("subjects")?.rows ?? [];

  const profileById = new Map(profiles.map((p) => [String(p.id), p]));
  const classById = new Map(classes.map((c) => [String(c.id), c]));
  const studentById = new Map(students.map((s) => [String(s.id), s]));
  const parentById = new Map(parents.map((p) => [String(p.id), p]));
  const teacherById = new Map(teachers.map((t) => [String(t.id), t]));
  const subjectById = new Map(subjects.map((s) => [String(s.id), s]));

  const profileName = (userId: unknown) => {
    const p = profileById.get(String(userId ?? ""));
    return {
      full_name: String(p?.full_name ?? ""),
      email: String(p?.email ?? ""),
      phone: String(p?.phone ?? ""),
    };
  };

  return sheets.map((sheet) => {
    const table = sheet.entity.table;
    if (table === "students") {
      return {
        ...sheet,
        rows: sheet.rows.map((row) => {
          const p = profileName(row.user_id);
          const klass = classById.get(String(row.class_id ?? ""));
          const guardian = parentById.get(String(row.guardian_id ?? ""));
          const guardianProfile = guardian ? profileName(guardian.user_id) : null;
          return {
            full_name: p.full_name || String(row.full_name ?? ""),
            email: p.email,
            phone: p.phone,
            admission_no: row.admission_no ?? "",
            class_name: klass?.name ?? "",
            gender: row.gender ?? "",
            date_of_birth: row.date_of_birth ?? "",
            guardian_name: guardianProfile?.full_name ?? "",
            guardian_email: guardianProfile?.email ?? "",
            guardian_phone: guardianProfile?.phone || String(guardian?.phone ?? ""),
            id: row.id,
            user_id: row.user_id,
            class_id: row.class_id,
            guardian_id: row.guardian_id,
            school_id: row.school_id,
            created_at: row.created_at,
          };
        }),
      };
    }
    if (table === "teachers") {
      return {
        ...sheet,
        rows: sheet.rows.map((row) => {
          const p = profileName(row.user_id);
          return {
            full_name: p.full_name,
            email: p.email,
            phone: p.phone,
            employee_no: row.employee_no ?? "",
            subject_specialty: row.subject_specialty ?? "",
            id: row.id,
            user_id: row.user_id,
            school_id: row.school_id,
            created_at: row.created_at,
          };
        }),
      };
    }
    if (table === "parents") {
      return {
        ...sheet,
        rows: sheet.rows.map((row) => {
          const p = profileName(row.user_id);
          return {
            full_name: p.full_name,
            email: p.email,
            phone: p.phone || String(row.phone ?? ""),
            address: row.address ?? "",
            emergency_contact: row.emergency_contact ?? "",
            id: row.id,
            user_id: row.user_id,
            school_id: row.school_id,
            created_at: row.created_at,
          };
        }),
      };
    }
    if (table === "parent_student_links") {
      return {
        ...sheet,
        rows: sheet.rows.map((row) => {
          const student = studentById.get(String(row.student_id ?? ""));
          const parent = parentById.get(String(row.parent_id ?? ""));
          const sp = student ? profileName(student.user_id) : { full_name: "", email: "", phone: "" };
          const pp = parent ? profileName(parent.user_id) : { full_name: "", email: "", phone: "" };
          return {
            student_name: sp.full_name,
            student_admission_no: student?.admission_no ?? "",
            parent_name: pp.full_name,
            parent_email: pp.email,
            parent_phone: pp.phone,
            relationship: row.relationship ?? row.relation ?? "",
            id: row.id,
            student_id: row.student_id,
            parent_id: row.parent_id,
          };
        }),
      };
    }
    if (table === "class_subjects") {
      return {
        ...sheet,
        rows: sheet.rows.map((row) => {
          const klass = classById.get(String(row.class_id ?? ""));
          const subject = subjectById.get(String(row.subject_id ?? ""));
          const teacher = teacherById.get(String(row.teacher_id ?? ""));
          const tp = teacher ? profileName(teacher.user_id) : { full_name: "", email: "", phone: "" };
          return {
            class_name: klass?.name ?? "",
            subject_name: subject?.name ?? "",
            teacher_name: tp.full_name,
            teacher_email: tp.email,
            id: row.id,
            class_id: row.class_id,
            subject_id: row.subject_id,
            teacher_id: row.teacher_id,
          };
        }),
      };
    }
    if (table === "enrollments") {
      return {
        ...sheet,
        rows: sheet.rows.map((row) => {
          const student = studentById.get(String(row.student_id ?? ""));
          const klass = classById.get(String(row.class_id ?? ""));
          const sp = student ? profileName(student.user_id) : { full_name: "", email: "", phone: "" };
          return {
            student_name: sp.full_name,
            student_admission_no: student?.admission_no ?? "",
            class_name: klass?.name ?? "",
            status: row.status ?? "",
            enrolled_on: row.enrolled_on ?? "",
            id: row.id,
            student_id: row.student_id,
            class_id: row.class_id,
          };
        }),
      };
    }
    if (table === "profiles") {
      return {
        ...sheet,
        rows: sheet.rows.map((row) => ({
          full_name: row.full_name ?? "",
          email: row.email ?? "",
          phone: row.phone ?? "",
          id: row.id,
          school_id: row.school_id,
          avatar_url: row.avatar_url ?? "",
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
      };
    }
    if (table === "classes") {
      return {
        ...sheet,
        rows: sheet.rows.map((row) => ({
          name: row.name ?? "",
          level: row.level ?? "",
          id: row.id,
          school_id: row.school_id,
          created_at: row.created_at,
          ...Object.fromEntries(
            Object.entries(row).filter(
              ([k]) => !["name", "level", "id", "school_id", "created_at"].includes(k),
            ),
          ),
        })),
      };
    }
    return sheet;
  });
}
