import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { MetronicStatCard } from "@/components/metronic/MetronicStatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { usePermissions } from "@/hooks/usePermissions";
import { permissionCode } from "@/lib/rbac/permissionCatalog";
import {
  BACKUP_ENTITIES,
  deleteSystemBackup,
  downloadSystemBackup,
  formatBytes,
  isSystemBackupsTableMissing,
  listSystemBackups,
  runSystemBackup,
  SYSTEM_BACKUPS_MISSING_MSG,
  type BackupProgress,
  type SystemBackupRow,
} from "@/lib/system-backup";
import {
  Database,
  Download,
  Eye,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

const VIEW_PERM = permissionCode("system_backup", "view");
const MANAGE_PERM = permissionCode("system_backup", "manage");

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    failed: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
    preparing: "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30",
    collecting: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    generating_excel: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    creating_zip: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    uploading: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  };
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant="outline" className={`capitalize text-xs ${map[status] ?? ""}`}>
      {label}
    </Badge>
  );
}

function stageLabel(stage: string | null | undefined) {
  switch (stage) {
    case "preparing":
      return "Preparing";
    case "collecting":
      return "Collecting Data";
    case "generating_excel":
      return "Generating Excel";
    case "creating_zip":
      return "Creating ZIP";
    case "uploading":
      return "Uploading";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return stage ?? "—";
  }
}

export default function SystemBackupPage() {
  const { user } = useAuth();
  const { currentSchool, loading: schoolLoading } = useSchoolInfo();
  const { hasPermission, isSuperAdmin, loading: permLoading } = usePermissions();
  const canView =
    isSuperAdmin || hasPermission(VIEW_PERM) || hasPermission(MANAGE_PERM) || hasPermission(permissionCode("school_settings", "manage"));
  const canManage =
    isSuperAdmin || hasPermission(MANAGE_PERM) || hasPermission(permissionCode("school_settings", "manage"));

  const schoolId = currentSchool?.id ?? null;
  const [rows, setRows] = useState<SystemBackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemBackupRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<SystemBackupRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);

  const refresh = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await listSystemBackups(schoolId);
      setRows(data);
      setSetupRequired(false);
    } catch (e) {
      if (isSystemBackupsTableMissing(e) || (e instanceof Error && e.message === SYSTEM_BACKUPS_MISSING_MSG)) {
        setSetupRequired(true);
        setRows([]);
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to load backups");
      }
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (schoolId && canView) void refresh();
  }, [schoolId, canView, refresh]);

  const completed = useMemo(() => rows.filter((r) => r.status === "completed"), [rows]);
  const lastBackup = completed[0] ?? null;
  const totalRecordsTracked = completed.reduce((s, r) => s + (r.record_count || 0), 0);
  const lastSize = lastBackup?.file_size_bytes ?? null;
  const inProgress = rows.find((r) =>
    ["preparing", "collecting", "generating_excel", "creating_zip", "uploading"].includes(r.status),
  );

  const handleCreate = async () => {
    if (!schoolId || !canManage) return;
    if (running || inProgress) {
      toast.error("A backup is already in progress");
      return;
    }
    setRunning(true);
    setProgress({ stage: "preparing", pct: 0, message: "Starting…" });
    try {
      const row = await runSystemBackup({
        schoolId,
        schoolName: currentSchool?.school_name || "School",
        schoolCode: currentSchool?.school_code,
        createdByEmail: user?.email,
        createdByName: user?.user_metadata?.full_name ?? user?.email,
        onProgress: setProgress,
      });
      toast.success("System backup completed. You can download the ZIP now.");
      await refresh();
      // Offer immediate download
      try {
        await downloadSystemBackup(row);
      } catch {
        /* history download still available */
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
      await refresh();
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const handleDownload = async (row: SystemBackupRow) => {
    setDownloadingId(row.id);
    try {
      await downloadSystemBackup(row);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSystemBackup(deleteTarget);
      toast.success("Backup deleted");
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (permLoading || schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </DashboardLayout>
    );
  }

  if (!canView) {
    return (
      <DashboardLayout role="admin">
        <div className="kt-card p-8 text-center space-y-2">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="text-lg font-semibold">Access denied</h2>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view system backups.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">System Backup</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Create a complete Excel + ZIP backup — one Excel file per admin submenu in by_module/
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="kt-btn kt-btn-outline gap-2"
            onClick={() => void refresh()}
            disabled={loading || running}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canManage ? (
            <Button
              type="button"
              className="kt-btn kt-btn-primary gap-2"
              onClick={() => void handleCreate()}
              disabled={running || Boolean(inProgress) || setupRequired}
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4" />
              )}
              Create New Backup
            </Button>
          ) : null}
        </div>
      </div>

      {setupRequired ? (
        <div className="kt-card mb-7.5 border border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2 min-w-0">
              <h2 className="text-base font-semibold text-mono">Database setup required</h2>
              <p className="text-sm text-secondary-foreground">
                The <code className="text-xs">system_backups</code> table is not on your Supabase project yet.
                Until you run the SQL below, backups cannot be created or listed.
              </p>
              <ol className="list-decimal pl-5 text-sm text-secondary-foreground space-y-1">
                <li>
                  Open{" "}
                  <a
                    className="text-primary underline underline-offset-2"
                    href="https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Supabase SQL Editor
                  </a>
                </li>
                <li>
                  Paste and run <code className="text-xs">public/sql/apply-system-backups.sql</code> (already open in your editor)
                </li>
                <li>Come back here and click Refresh</li>
              </ol>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 lg:gap-7.5 mb-7.5">
        <MetronicStatCard
          keenIcon="ki-abstract-26"
          badge={`${BACKUP_ENTITIES.length} entities`}
          value={totalRecordsTracked.toLocaleString()}
          label="Total Records"
          description="Across completed backups"
        />
        <MetronicStatCard
          icon={<Clock className="h-5 w-5 text-foreground" />}
          badge={lastBackup ? "Latest" : "None"}
          value={
            lastBackup
              ? new Date(lastBackup.completed_at || lastBackup.created_at).toLocaleDateString()
              : "—"
          }
          label="Last Backup"
          description={
            lastBackup
              ? new Date(lastBackup.completed_at || lastBackup.created_at).toLocaleTimeString()
              : "No backups yet"
          }
        />
        <MetronicStatCard
          keenIcon="ki-folder"
          badge="ZIP"
          value={formatBytes(lastSize)}
          label="Backup Size"
          description="Most recent completed file"
        />
        <MetronicStatCard
          keenIcon="ki-archive"
          badge="History"
          value={completed.length}
          label="Available Backups"
          description={`${rows.length} total jobs`}
        />
        <MetronicStatCard
          icon={
            running || inProgress ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : lastBackup ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <Database className="h-5 w-5 text-muted-foreground" />
            )
          }
          badge={running || inProgress ? "Busy" : lastBackup ? "Ready" : "Idle"}
          value={
            running || inProgress
              ? stageLabel(progress?.stage || inProgress?.progress_stage)
              : lastBackup
                ? "Healthy"
                : "No backup"
          }
          label="Backup Status"
          description={
            progress?.message ||
            inProgress?.progress_message ||
            (lastBackup ? "Last backup verified" : "Create your first backup")
          }
        />
      </div>

      {(running || progress) && (
        <div className="kt-card channel-stats-bg mb-7.5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="kt-card-title text-base">Backup in progress</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stageLabel(progress?.stage)} → keep this page open until completed
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums">{progress?.pct ?? 0}%</span>
          </div>
          <Progress value={progress?.pct ?? 0} className="h-2" />
          <p className="text-xs text-secondary-foreground">{progress?.message}</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {["Preparing", "Collecting Data", "Generating Excel", "Creating ZIP", "Completed"].map(
              (label) => {
                const active =
                  stageLabel(progress?.stage).toLowerCase() === label.toLowerCase() ||
                  (progress?.stage === "uploading" && label === "Creating ZIP") ||
                  (progress?.stage === "completed" && label === "Completed");
                return (
                  <span
                    key={label}
                    className={`rounded-md border px-2 py-0.5 ${
                      active
                        ? "border-primary/40 bg-primary/10 text-primary font-medium"
                        : "border-border"
                    }`}
                  >
                    {label}
                  </span>
                );
              },
            )}
          </div>
        </div>
      )}

      <div className="kt-card">
        <div className="kt-card-header flex flex-wrap items-center justify-between gap-3 py-4 px-5">
          <div>
            <h3 className="kt-card-title">Backup History</h3>
            <p className="text-xs text-secondary-foreground">
              Download, inspect, or delete previous system backups
            </p>
          </div>
        </div>
        <div className="kt-card-content p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading history…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2">
              <HardDrive className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="font-medium">No backups yet</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Create a new backup to generate one Excel file per module submenu inside a secure ZIP
                archive.
              </p>
              {canManage ? (
                <Button className="kt-btn kt-btn-primary mt-3" onClick={() => void handleCreate()}>
                  Create New Backup
                </Button>
              ) : null}
            </div>
          ) : (
            <Table className="kt-table min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Backup name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const when = new Date(row.completed_at || row.created_at);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium max-w-[220px] truncate" title={row.backup_name}>
                        {row.backup_name}
                      </TableCell>
                      <TableCell className="font-mono text-2sm whitespace-nowrap">
                        {when.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-mono text-2sm whitespace-nowrap">
                        {when.toLocaleTimeString()}
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="tabular-nums">{row.record_count?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell>{formatBytes(row.file_size_bytes)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => setDetailTarget(row)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Details
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            disabled={row.status !== "completed" || !row.file_path || downloadingId === row.id}
                            onClick={() => void handleDownload(row)}
                          >
                            {downloadingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5 mr-1" />
                            )}
                            Download
                          </Button>
                          {canManage ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive"
                              disabled={running}
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={Boolean(detailTarget)} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Backup details</DialogTitle>
            <DialogDescription>{detailTarget?.backup_name}</DialogDescription>
          </DialogHeader>
          {detailTarget ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                {statusBadge(detailTarget.status)}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Stage</span>
                <span>{stageLabel(detailTarget.progress_stage)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Sheets</span>
                <span className="tabular-nums">{detailTarget.sheet_count}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Records</span>
                <span className="tabular-nums">{detailTarget.record_count?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Size</span>
                <span>{formatBytes(detailTarget.file_size_bytes)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Started</span>
                <span className="text-right">{new Date(detailTarget.started_at).toLocaleString()}</span>
              </div>
              {detailTarget.completed_at ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="text-right">{new Date(detailTarget.completed_at).toLocaleString()}</span>
                </div>
              ) : null}
              {detailTarget.error_message ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-700 dark:text-rose-300 text-xs">
                  {detailTarget.error_message}
                </div>
              ) : null}
              {detailTarget.tables_included?.length ? (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                    Tables included ({detailTarget.tables_included.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 text-xs font-mono leading-relaxed">
                    {detailTarget.tables_included.join(", ")}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.backup_name}</span> and its
              ZIP file from secure storage. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Delete backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
