import JSZip from "jszip";
import * as XLSX from "xlsx";
import { BACKUP_VERSION } from "@/lib/system-backup/catalog";
import type { BackupSummaryMeta, ModuleWorkbookFile } from "@/lib/system-backup/buildWorkbook";

export type CategoryWorkbookFile = {
  fileName: string;
  category: string;
  bytes: Uint8Array;
  recordCount: number;
};

export type ZipBackupInput = {
  folderName: string;
  excelBytes: Uint8Array;
  excelFileName: string;
  categoryFiles: CategoryWorkbookFile[];
  moduleFiles: ModuleWorkbookFile[];
  meta: BackupSummaryMeta;
  totalRecords: number;
  sheetCount: number;
  tablesIncluded: string[];
};

export async function buildBackupZip(input: ZipBackupInput): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder(input.folderName);
  if (!root) throw new Error("Failed to create ZIP root folder");

  const excelBytes = new Uint8Array(input.excelBytes.byteLength);
  excelBytes.set(input.excelBytes);

  // Full workbook at ZIP root for one-click open
  zip.file("school_data.xlsx", excelBytes, { binary: true });
  root.file(input.excelFileName, excelBytes, { binary: true });

  const byCategory = root.folder("by_category");
  for (const file of input.categoryFiles) {
    const copy = new Uint8Array(file.bytes.byteLength);
    copy.set(file.bytes);
    byCategory?.file(file.fileName, copy, { binary: true });
  }

  // One Excel file per admin submenu, grouped by module category folder
  const byModule = root.folder("by_module");
  for (const file of input.moduleFiles) {
    const copy = new Uint8Array(file.bytes.byteLength);
    copy.set(file.bytes);
    const parts = file.relativePath.split("/");
    if (parts.length === 2) {
      byModule?.folder(parts[0])?.file(parts[1], copy, { binary: true });
    } else {
      byModule?.file(file.fileName, copy, { binary: true });
    }
  }

  const moduleList = input.moduleFiles
    .map(
      (f) =>
        `  - by_module/${f.relativePath} (${f.moduleLabel}, ${f.recordCount} records, ${f.sheetCount} sheets)`,
    )
    .join("\n");

  const categoryList = input.categoryFiles
    .map((f) => `  - by_category/${f.fileName} (${f.category}, ${f.recordCount} records)`)
    .join("\n");

  const readme = [
    "Edumanage System Backup",
    "=======================",
    "",
    `Backup name: ${input.meta.backupName}`,
    `Backup ID: ${input.meta.backupId}`,
    `School: ${input.meta.schoolName} (${input.meta.schoolId})`,
    `Created: ${input.meta.completedAt}`,
    `Created by: ${input.meta.createdByEmail ?? input.meta.createdByName ?? "unknown"}`,
    `Backup version: ${BACKUP_VERSION}`,
    `Total records: ${input.totalRecords}`,
    `Module Excel files: ${input.moduleFiles.length}`,
    "",
    "How to open",
    "-----------",
    "1. school_data.xlsx — full backup (Backup Information + every data sheet with rows).",
    "2. by_module/ — one Excel per admin page, data tabs only (e.g. Students.xlsx → Students sheet).",
    "3. by_category/ — optional group workbooks (Academics, Finance, …).",
    "",
    "Notes",
    "-----",
    "- Empty tables are omitted (no blank sheets).",
    "- Module files have no Overview cover — metadata is here and in metadata/backup_info.json.",
    "- Preserve primary keys when restoring.",
    "",
    "Contents",
    "--------",
    `- school_data.xlsx — full school data`,
    `- ${input.excelFileName} — same full workbook inside this folder`,
    moduleList ? `Module files:\n${moduleList}` : "",
    categoryList ? `Category files:\n${categoryList}` : "",
    "- metadata/backup_info.json — machine-readable backup metadata for future restore",
    "- README.txt — this file",
    "",
    "Security",
    "--------",
    "This archive may contain sensitive student, parent, finance, and staff data.",
    "Store and transfer it securely. Do not publish publicly.",
    "",
    "Restore",
    "-------",
    "This package is designed as the foundation for a future System Restore feature.",
    "Primary keys and foreign keys are preserved in the Excel worksheets.",
    "Do not import into production without a verified restore procedure.",
    "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  root.file("README.txt", readme);

  const metadata = {
    schema_version: BACKUP_VERSION,
    system: input.meta.systemName,
    backup_id: input.meta.backupId,
    backup_name: input.meta.backupName,
    school_id: input.meta.schoolId,
    school_name: input.meta.schoolName,
    school_code: input.meta.schoolCode ?? null,
    created_at: input.meta.completedAt,
    started_at: input.meta.startedAt,
    created_by_email: input.meta.createdByEmail ?? null,
    created_by_name: input.meta.createdByName ?? null,
    app_version: input.meta.appVersion ?? "0.1.0",
    sheet_count: input.sheetCount,
    record_count: input.totalRecords,
    tables_included: input.tablesIncluded,
    excel_file: input.excelFileName,
    module_files: input.moduleFiles.map((f) => ({
      path: f.relativePath,
      file: f.fileName,
      category: f.category,
      module_key: f.moduleKey,
      module_label: f.moduleLabel,
      records: f.recordCount,
      sheets: f.sheetCount,
    })),
    category_files: input.categoryFiles.map((f) => ({
      file: f.fileName,
      category: f.category,
      records: f.recordCount,
    })),
    status: "completed",
  };

  root.folder("metadata")?.file("backup_info.json", JSON.stringify(metadata, null, 2));

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const verify = await JSZip.loadAsync(blob);
  const excelEntry = verify.file("school_data.xlsx");
  if (!excelEntry) {
    throw new Error("ZIP integrity check failed: Excel file missing from archive");
  }
  const packed = await excelEntry.async("uint8array");
  if (packed.byteLength < 100) {
    throw new Error("ZIP integrity check failed: Excel file in archive is empty");
  }
  const parsed = XLSX.read(packed, { type: "array" });
  if (!parsed.SheetNames?.includes("Backup Information")) {
    throw new Error("ZIP integrity check failed: Excel in archive has no Backup Information sheet");
  }
  if (!parsed.Sheets["Backup Information"]?.["!ref"]) {
    throw new Error("ZIP integrity check failed: Excel in archive is blank");
  }
  const peopleTabs = ["Students", "Teachers", "Parents", "Classes"];
  const missingPeople = peopleTabs.filter((t) => !parsed.SheetNames.includes(t));
  if (missingPeople.length === peopleTabs.length) {
    throw new Error("ZIP integrity check failed: people/academic sheets missing from Excel");
  }

  if (input.moduleFiles.length > 0) {
    const sample = input.moduleFiles[0];
    const moduleEntry = verify.file(`${input.folderName}/by_module/${sample.relativePath}`);
    if (!moduleEntry) {
      throw new Error("ZIP integrity check failed: module Excel files missing from archive");
    }
  }

  const metaEntry = verify.file(`${input.folderName}/metadata/backup_info.json`);
  if (!metaEntry) {
    throw new Error("ZIP integrity check failed: metadata missing from archive");
  }

  return blob;
}

export function formatBackupStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

/** Safe file/folder segment from school name (keeps spaces as underscores). */
export function sanitizeBackupLabel(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 80) || "School";
}
