import { supabase } from "@/integrations/supabase/client";
import { writeAuditLog } from "@/lib/auditLog";
import { BACKUP_BUCKET, BACKUP_VERSION } from "@/lib/system-backup/catalog";
import { fetchAllBackupSheets } from "@/lib/system-backup/fetchSchoolData";
import {
  buildBackupWorkbook,
  buildCategoryWorkbooks,
  buildModuleWorkbooks,
  workbookToBytes,
  type BackupSummaryMeta,
} from "@/lib/system-backup/buildWorkbook";
import { buildBackupZip, formatBackupStamp, sanitizeBackupLabel } from "@/lib/system-backup/buildZip";

export type BackupProgressStage =
  | "preparing"
  | "collecting"
  | "generating_excel"
  | "creating_zip"
  | "uploading"
  | "completed"
  | "failed";

export type BackupProgress = {
  stage: BackupProgressStage;
  pct: number;
  message: string;
};

export type SystemBackupRow = {
  id: string;
  school_id: string;
  created_by: string | null;
  backup_name: string;
  status: string;
  progress_pct: number;
  progress_stage: string | null;
  progress_message: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  record_count: number;
  sheet_count: number;
  tables_included: string[] | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export const SYSTEM_BACKUPS_SETUP_SQL = "public/sql/apply-system-backups.sql";

export const SYSTEM_BACKUPS_MISSING_MSG =
  "Database table public.system_backups is missing. Open Supabase → SQL Editor, run public/sql/apply-system-backups.sql, then refresh this page.";

export function isSystemBackupsTableMissing(error: unknown): boolean {
  const msg =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: string }).message ?? "")
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code ?? "")
      : "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    (/system_backups/i.test(msg) &&
      (/schema cache/i.test(msg) ||
        /could not find/i.test(msg) ||
        /does not exist/i.test(msg) ||
        /404/i.test(msg)))
  );
}

function throwBackupError(error: unknown): never {
  if (isSystemBackupsTableMissing(error)) {
    throw new Error(SYSTEM_BACKUPS_MISSING_MSG);
  }
  if (error && typeof error === "object" && "message" in error) {
    throw new Error(String((error as { message: string }).message));
  }
  throw error instanceof Error ? error : new Error(String(error));
}

async function updateBackup(
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("system_backups")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function runSystemBackup(params: {
  schoolId: string;
  schoolName: string;
  schoolCode?: string;
  createdByEmail?: string | null;
  createdByName?: string | null;
  onProgress?: (p: BackupProgress) => void;
}): Promise<SystemBackupRow> {
  const { schoolId, schoolName, schoolCode, createdByEmail, createdByName, onProgress } = params;
  const stamp = formatBackupStamp();
  const resolvedSchoolName = (schoolName || "").trim() || "School";
  // Display / DB name = school name; file uses school name + stamp for uniqueness
  const backupName = resolvedSchoolName;
  const fileLabel = `${sanitizeBackupLabel(resolvedSchoolName)}_${stamp}`;
  const folderName = fileLabel;

  const emit = (stage: BackupProgressStage, pct: number, message: string) => {
    onProgress?.({ stage, pct, message });
  };

  emit("preparing", 2, "Preparing backup job…");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to create a backup");

  // Block duplicate in-progress backups
  const { data: active } = await supabase
    .from("system_backups")
    .select("id, status")
    .eq("school_id", schoolId)
    .in("status", ["preparing", "collecting", "generating_excel", "creating_zip", "uploading"])
    .limit(1)
    .maybeSingle();

  if (active?.id) {
    throw new Error("A backup is already in progress for this school. Wait for it to finish or fail.");
  }

  const startedAt = new Date().toISOString();
  const { data: job, error: insertErr } = await supabase
    .from("system_backups")
    .insert({
      school_id: schoolId,
      created_by: user.id,
      backup_name: backupName,
      status: "preparing",
      progress_pct: 2,
      progress_stage: "preparing",
      progress_message: "Preparing backup job…",
      started_at: startedAt,
      metadata: {
        backup_version: BACKUP_VERSION,
        folder_name: folderName,
      },
    })
    .select("*")
    .single();

  if (insertErr || !job) {
    if (insertErr) throwBackupError(insertErr);
    throw new Error("Could not create backup job (is the migration applied?)");
  }

  const backupId = job.id as string;

  try {
    await writeAuditLog({
      schoolId,
      actionType: "backup.create_started",
      entityType: "system_backup",
      entityId: backupId,
      module: "system_backup",
      details: { backup_name: backupName },
    });

    emit("collecting", 5, "Collecting school data…");
    await updateBackup(backupId, {
      status: "collecting",
      progress_pct: 5,
      progress_stage: "collecting",
      progress_message: "Collecting school data…",
    });

    const sheets = await fetchAllBackupSheets(schoolId, (done, total, entity) => {
      const pct = 5 + Math.round((done / Math.max(1, total)) * 55);
      const message = `Collecting ${entity.sheet} (${done}/${total})…`;
      emit("collecting", pct, message);
      // Throttle DB writes
      if (done % 5 === 0 || done === total) {
        void updateBackup(backupId, {
          progress_pct: pct,
          progress_stage: "collecting",
          progress_message: message,
        });
      }
    });

    emit("generating_excel", 65, "Generating Excel workbook…");
    await updateBackup(backupId, {
      status: "generating_excel",
      progress_pct: 65,
      progress_stage: "generating_excel",
      progress_message: "Generating Excel workbook…",
    });

    const completedAt = new Date().toISOString();
    const meta: BackupSummaryMeta = {
      systemName: "Edumanage",
      schoolId,
      schoolName: resolvedSchoolName,
      schoolCode,
      backupId,
      backupName,
      createdByEmail,
      createdByName,
      startedAt,
      completedAt,
      appVersion: "0.1.0",
    };

    const { workbook, totalRecords, sheetCount, tablesIncluded } = buildBackupWorkbook(sheets, meta);
    const excelBytes = workbookToBytes(workbook);
    const excelFileName = "school_data.xlsx";
    const categoryFiles = buildCategoryWorkbooks(sheets, meta);
    const moduleFiles = buildModuleWorkbooks(sheets, meta);

    emit("creating_zip", 80, "Creating ZIP archive…");
    await updateBackup(backupId, {
      status: "creating_zip",
      progress_pct: 80,
      progress_stage: "creating_zip",
      progress_message: `Packaging ${moduleFiles.length} module Excel files…`,
      record_count: totalRecords,
      sheet_count: sheetCount,
      tables_included: tablesIncluded,
    });

    const zipBlob = await buildBackupZip({
      folderName,
      excelBytes,
      excelFileName,
      categoryFiles,
      moduleFiles,
      meta,
      totalRecords,
      sheetCount,
      tablesIncluded,
    });

    emit("uploading", 90, "Uploading secure backup…");
    await updateBackup(backupId, {
      status: "uploading",
      progress_pct: 90,
      progress_stage: "uploading",
      progress_message: "Uploading secure backup…",
    });

    const filePath = `${schoolId}/${backupId}/${fileLabel}.zip`;
    const { error: uploadErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(filePath, zipBlob, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Upload failed: ${uploadErr.message}`);
    }

    // Verify object exists
    const { data: listed, error: listErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .list(`${schoolId}/${backupId}`, { limit: 10 });
    if (listErr) throw new Error(`Backup verification failed: ${listErr.message}`);
    const found = listed?.some((f) => f.name === `${fileLabel}.zip`);
    if (!found) throw new Error("Backup verification failed: ZIP not found in storage");

    await updateBackup(backupId, {
      status: "completed",
      progress_pct: 100,
      progress_stage: "completed",
      progress_message: "Backup completed successfully",
      file_path: filePath,
      file_size_bytes: zipBlob.size,
      record_count: totalRecords,
      sheet_count: sheetCount,
      tables_included: tablesIncluded,
      completed_at: completedAt,
      error_message: null,
      metadata: {
        backup_version: BACKUP_VERSION,
        folder_name: folderName,
        excel_file: excelFileName,
        school_name: resolvedSchoolName,
        school_code: schoolCode ?? null,
      },
    });

    await writeAuditLog({
      schoolId,
      actionType: "backup.create_completed",
      entityType: "system_backup",
      entityId: backupId,
      module: "system_backup",
      details: {
        backup_name: backupName,
        record_count: totalRecords,
        sheet_count: sheetCount,
        file_size_bytes: zipBlob.size,
      },
    });

    emit("completed", 100, "Backup completed successfully");

    const { data: finalRow, error: finalErr } = await supabase
      .from("system_backups")
      .select("*")
      .eq("id", backupId)
      .single();
    if (finalErr || !finalRow) throw new Error(finalErr?.message || "Backup row missing after completion");
    return finalRow as SystemBackupRow;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backup failed";
    emit("failed", 100, message);
    await updateBackup(backupId, {
      status: "failed",
      progress_pct: 100,
      progress_stage: "failed",
      progress_message: message,
      error_message: message,
      completed_at: new Date().toISOString(),
    }).catch(() => undefined);

    await writeAuditLog({
      schoolId,
      actionType: "backup.create_failed",
      entityType: "system_backup",
      entityId: backupId,
      module: "system_backup",
      details: { error: message, backup_name: backupName },
    }).catch(() => undefined);

    throw e instanceof Error ? e : new Error(message);
  }
}

export async function listSystemBackups(schoolId: string): Promise<SystemBackupRow[]> {
  const { data, error } = await supabase
    .from("system_backups")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throwBackupError(error);
  return (data ?? []) as SystemBackupRow[];
}

export async function getBackupSignedUrl(filePath: string, expiresIn = 120): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .createSignedUrl(filePath, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not create download link");
  }
  return data.signedUrl;
}

export async function downloadSystemBackup(row: SystemBackupRow): Promise<void> {
  if (!row.file_path || row.status !== "completed") {
    throw new Error("Backup file is not available for download");
  }
  const url = await getBackupSignedUrl(row.file_path);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${row.backup_name || "School_Backup"}.zip`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  await writeAuditLog({
    schoolId: row.school_id,
    actionType: "backup.download",
    entityType: "system_backup",
    entityId: row.id,
    module: "system_backup",
    details: { backup_name: row.backup_name, file_path: row.file_path },
  });
}

export async function deleteSystemBackup(row: SystemBackupRow): Promise<void> {
  if (row.file_path) {
    const { error: storageErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .remove([row.file_path]);
    if (storageErr) {
      // Still delete DB row if object already gone
      console.warn("Storage delete:", storageErr.message);
    }
  }

  const { error } = await supabase.from("system_backups").delete().eq("id", row.id);
  if (error) throw error;

  await writeAuditLog({
    schoolId: row.school_id,
    actionType: "backup.delete",
    entityType: "system_backup",
    entityId: row.id,
    module: "system_backup",
    details: { backup_name: row.backup_name, file_path: row.file_path },
  });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
