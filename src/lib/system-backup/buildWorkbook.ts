// @ts-nocheck
import * as XLSX from "xlsx";
import {
  BACKUP_VERSION,
  CATEGORY_FILE_ORDER,
  SHEET_TAB_PRIORITY,
  sanitizeModuleFileName,
} from "@/lib/system-backup/catalog";
import type { FetchedSheet } from "@/lib/system-backup/fetchSchoolData";

export type BackupSummaryMeta = {
  systemName: string;
  schoolId: string;
  schoolName: string;
  schoolCode?: string;
  backupId: string;
  backupName: string;
  createdByEmail?: string | null;
  createdByName?: string | null;
  startedAt: string;
  completedAt: string;
  appVersion?: string;
};

const NAME_FIRST_COLUMNS = [
  "full_name",
  "student_name",
  "teacher_name",
  "parent_name",
  "guardian_name",
  "name",
  "email",
  "phone",
  "admission_no",
  "employee_no",
  "class_name",
  "subject_name",
  "subject_specialty",
  "level",
  "gender",
  "date_of_birth",
  "status",
  "relationship",
];

/** Internal / restore-only columns — keep at end of people sheets. */
const TRAILING_ID_COLUMNS = new Set([
  "id",
  "user_id",
  "school_id",
  "class_id",
  "guardian_id",
  "parent_id",
  "student_id",
  "teacher_id",
  "subject_id",
  "profile_id",
  "avatar_url",
  "created_at",
  "updated_at",
]);

function cellValue(v: unknown): string | number | boolean | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function formatSheetRows(rows: Record<string, unknown>[]): {
  headers: string[];
  data: (string | number | boolean | null)[][];
} {
  if (!rows.length) return { headers: ["(no records)"], data: [] };
  const headerSet = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((k) => headerSet.add(k));
  }
  const preferred = NAME_FIRST_COLUMNS.filter((h) => headerSet.has(h));
  const rest = [...headerSet].filter((h) => !preferred.includes(h));
  const mid = rest
    .filter((h) => !TRAILING_ID_COLUMNS.has(h))
    .sort((a, b) => a.localeCompare(b));
  const trailing = rest
    .filter((h) => TRAILING_ID_COLUMNS.has(h))
    .sort((a, b) => {
      if (a === "id") return -1;
      if (b === "id") return 1;
      return a.localeCompare(b);
    });
  const headers = [...preferred, ...mid, ...trailing];
  const data = rows.map((row) => headers.map((h) => cellValue(row[h])));
  return { headers, data };
}

function styleWorksheet(ws: XLSX.WorkSheet, colCount: number, rowCount: number) {
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, rowCount), c: Math.max(0, colCount - 1) },
    }),
  };
  const cols: XLSX.ColInfo[] = [];
  for (let c = 0; c < colCount; c++) {
    cols.push({ wch: 16 });
  }
  ws["!cols"] = cols;
}

function uniqueSheetName(base: string | undefined | null, used: Set<string>): string {
  const safeBase = String(base ?? "Sheet").trim() || "Sheet";
  let name = safeBase.slice(0, 31);
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let i = 2;
  while (i < 100) {
    const suffix = `_${i}`;
    const candidate = `${safeBase.slice(0, 31 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    i += 1;
  }
  const fallback = `Sheet_${used.size + 1}`.slice(0, 31);
  used.add(fallback);
  return fallback;
}

function sortSheetsForDisplay(sheets: FetchedSheet[]): FetchedSheet[] {
  const catRank = new Map(CATEGORY_FILE_ORDER.map((c, i) => [c, i]));
  return [...sheets].sort((a, b) => {
    const ca = catRank.get(a.entity.category as (typeof CATEGORY_FILE_ORDER)[number]) ?? 99;
    const cb = catRank.get(b.entity.category as (typeof CATEGORY_FILE_ORDER)[number]) ?? 99;
    if (ca !== cb) return ca - cb;
    const da = a.skipped ? 2 : a.rows.length === 0 ? 1 : 0;
    const db = b.skipped ? 2 : b.rows.length === 0 ? 1 : 0;
    if (da !== db) return da - db;
    const pa = SHEET_TAB_PRIORITY[a.entity.table] ?? 100;
    const pb = SHEET_TAB_PRIORITY[b.entity.table] ?? 100;
    if (pa !== pb) return pa - pb;
    return a.entity.sheet.localeCompare(b.entity.sheet);
  });
}

/** Data sheets only — skip empty / skipped tables. */
function sheetsWithData(sheets: FetchedSheet[]): FetchedSheet[] {
  return sortSheetsForDisplay(sheets.filter((s) => !s.skipped && s.rows.length > 0));
}

function appendDataSheet(wb: XLSX.WorkBook, sheet: FetchedSheet, usedNames: Set<string>) {
  const { headers, data } = formatSheetRows(sheet.rows);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  styleWorksheet(ws, headers.length, data.length);
  ws["!cols"] = headers.map((h) => ({
    wch: Math.max(12, Math.min(40, String(h).length + 4)),
  }));
  XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(sheet.entity.sheet, usedNames));
}

function buildSummarySheet(
  wb: XLSX.WorkBook,
  sheets: FetchedSheet[],
  meta: BackupSummaryMeta,
  usedNames: Set<string>,
) {
  const included = sheets.filter((s) => !s.skipped);
  const withData = sheetsWithData(sheets);
  const totalRecords = withData.reduce((sum, s) => sum + s.rows.length, 0);
  const completedAt = String(meta.completedAt ?? new Date().toISOString());

  const keyCounts = (table: string) =>
    sheets.find((s) => s.entity.table === table)?.rows.length ?? 0;

  const summaryRows: (string | number | null)[][] = [
    ["Field", "Value"],
    ["School", meta.schoolName],
    ["School code", meta.schoolCode ?? ""],
    ["Backup name", meta.backupName],
    ["Backup ID", meta.backupId],
    ["Created", completedAt],
    ["Created by", meta.createdByEmail ?? meta.createdByName ?? ""],
    ["Students", keyCounts("students")],
    ["Teachers", keyCounts("teachers")],
    ["Parents", keyCounts("parents")],
    ["Classes", keyCounts("classes")],
    ["Data sheets", withData.length],
    ["Total records", totalRecords],
    ["Backup version", BACKUP_VERSION],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  styleWorksheet(summaryWs, 2, summaryRows.length - 1);
  XLSX.utils.book_append_sheet(wb, summaryWs, uniqueSheetName("Backup Information", usedNames));

  return { included, totalRecords, withData };
}

export function buildBackupWorkbook(
  sheets: FetchedSheet[],
  meta: BackupSummaryMeta,
): { workbook: XLSX.WorkBook; totalRecords: number; sheetCount: number; tablesIncluded: string[] } {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const { included, totalRecords, withData } = buildSummarySheet(wb, sheets, meta, usedNames);

  for (const sheet of withData) {
    appendDataSheet(wb, sheet, usedNames);
  }

  return {
    workbook: wb,
    totalRecords,
    sheetCount: usedNames.size,
    tablesIncluded: included.map((s) => s.entity.table),
  };
}

/** One workbook per category — data sheets only (no Overview cover). */
export function buildCategoryWorkbooks(
  sheets: FetchedSheet[],
  meta: BackupSummaryMeta,
): { fileName: string; category: string; bytes: Uint8Array; recordCount: number }[] {
  void meta;
  const out: { fileName: string; category: string; bytes: Uint8Array; recordCount: number }[] = [];

  CATEGORY_FILE_ORDER.forEach((category, index) => {
    const catSheets = sheetsWithData(
      sheets.filter((s) => s.entity.category === category),
    );
    if (!catSheets.length) return;

    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    const records = catSheets.reduce((sum, s) => sum + s.rows.length, 0);

    for (const sheet of catSheets) {
      appendDataSheet(wb, sheet, usedNames);
    }

    const pad = String(index + 1).padStart(2, "0");
    out.push({
      fileName: `${pad}_${category}.xlsx`,
      category,
      bytes: workbookToBytes(wb),
      recordCount: records,
    });
  });

  return out;
}

export type ModuleWorkbookFile = {
  fileName: string;
  /** Relative path inside by_module/, e.g. Academics/Students.xlsx */
  relativePath: string;
  category: string;
  moduleKey: string;
  moduleLabel: string;
  bytes: Uint8Array;
  recordCount: number;
  sheetCount: number;
};

/**
 * One Excel file per admin submenu — data sheets only.
 * No Overview / metadata tabs (that lives in README + backup_info.json).
 */
export function buildModuleWorkbooks(
  sheets: FetchedSheet[],
  meta: BackupSummaryMeta,
): ModuleWorkbookFile[] {
  void meta;
  const included = sheets.filter((s) => !s.skipped);
  const byModule = new Map<
    string,
    { category: string; moduleKey: string; moduleLabel: string; sheets: FetchedSheet[] }
  >();

  for (const sheet of included) {
    const key = sheet.entity.moduleKey;
    const existing = byModule.get(key);
    if (existing) {
      existing.sheets.push(sheet);
    } else {
      byModule.set(key, {
        category: sheet.entity.category,
        moduleKey: key,
        moduleLabel: sheet.entity.moduleLabel,
        sheets: [sheet],
      });
    }
  }

  const orderedKeys = [...byModule.keys()].sort((a, b) => {
    const ma = byModule.get(a)!;
    const mb = byModule.get(b)!;
    const catRank = new Map(CATEGORY_FILE_ORDER.map((c, i) => [c, i]));
    const ca = catRank.get(ma.category as (typeof CATEGORY_FILE_ORDER)[number]) ?? 99;
    const cb = catRank.get(mb.category as (typeof CATEGORY_FILE_ORDER)[number]) ?? 99;
    if (ca !== cb) return ca - cb;
    return ma.moduleLabel.localeCompare(mb.moduleLabel);
  });

  const out: ModuleWorkbookFile[] = [];
  let index = 0;

  for (const key of orderedKeys) {
    const mod = byModule.get(key)!;
    const modSheets = sheetsWithData(mod.sheets);
    if (!modSheets.length) continue;
    index += 1;

    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    const records = modSheets.reduce((sum, s) => sum + s.rows.length, 0);

    for (const sheet of modSheets) {
      appendDataSheet(wb, sheet, usedNames);
    }

    const pad = String(index).padStart(2, "0");
    const safeCategory = sanitizeModuleFileName(mod.category);
    const safeModule = sanitizeModuleFileName(mod.moduleLabel);
    const fileName = `${pad}_${safeModule}.xlsx`;
    out.push({
      fileName,
      relativePath: `${safeCategory}/${fileName}`,
      category: mod.category,
      moduleKey: mod.moduleKey,
      moduleLabel: mod.moduleLabel,
      bytes: workbookToBytes(wb),
      recordCount: records,
      sheetCount: usedNames.size,
    });
  }

  return out;
}

function copyUint8(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out;
}

/**
 * Serialize workbook to a standalone Uint8Array.
 * Uses `type: "binary"` — `type: "array"` returns ArrayBuffer, and
 * `Uint8Array.from(arrayBuffer)` produces a 0-byte file that Excel opens as
 * a single blank sheet named after the filename.
 */
export function workbookToBytes(workbook: XLSX.WorkBook): Uint8Array {
  const binary = XLSX.write(workbook, { bookType: "xlsx", type: "binary" }) as string;
  if (typeof binary !== "string" || binary.length < 100) {
    throw new Error("Excel generation failed: workbook output was empty");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }

  const check = XLSX.read(bytes, { type: "array" });
  if (!check.SheetNames?.length) {
    throw new Error("Excel integrity check failed: workbook has no sheets");
  }
  const first = check.Sheets[check.SheetNames[0]];
  if (!first?.["!ref"]) {
    throw new Error("Excel integrity check failed: first sheet is empty");
  }

  return copyUint8(bytes);
}

/** @deprecated use workbookToBytes */
export function workbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  return workbookToBytes(workbook).buffer;
}
