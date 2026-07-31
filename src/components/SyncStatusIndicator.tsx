import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  WifiOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getDesktopAPI, isElectronDesktop } from "@/desktop/electronBridge";
import type { SyncLogEntry, SyncQueueItem, SyncStatus } from "@/desktop/electronBridge";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_STATUS: SyncStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  status: "idle",
  lastSyncAt: null,
  pending: 0,
  failed: 0,
  lastError: null,
  progress: null,
};

const STATE_META: Record<
  SyncStatus["status"],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  syncing: { label: "Syncing", icon: Loader2, className: "text-primary" },
  synced: { label: "Synced", icon: CheckCircle2, className: "text-[hsl(var(--success))]" },
  pending: { label: "Pending changes", icon: AlertTriangle, className: "text-[hsl(var(--warning))]" },
  failed: { label: "Sync failed", icon: XCircle, className: "text-[hsl(var(--critical))]" },
  offline: { label: "Offline", icon: WifiOff, className: "text-muted-foreground" },
  idle: { label: "Idle", icon: CheckCircle2, className: "text-muted-foreground" },
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleString();
}

/**
 * Real-time sync status icon for the dashboard navbar. Desktop-only — renders
 * nothing on the web build since there is no local queue to reflect there.
 */
export function SyncStatusIndicator() {
  const desktop = isElectronDesktop();
  const api = useMemo(() => getDesktopAPI(), []);
  const { toast } = useToast();

  const [status, setStatus] = useState<SyncStatus>(DEFAULT_STATUS);
  const [failedItems, setFailedItems] = useState<SyncQueueItem[]>([]);
  const [pendingItems, setPendingItems] = useState<SyncQueueItem[]>([]);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!api) return;
    const res = await api.backup.syncStatus();
    if (res.ok && res.data) setStatus(res.data);
  }, [api]);

  const refreshDetails = useCallback(async () => {
    if (!api) return;
    const [failedRes, pendingRes, logsRes] = await Promise.all([
      api.backup.syncFailedItems(20),
      api.backup.syncPendingItems(20),
      api.backup.syncLogs(30),
    ]);
    if (failedRes.ok && failedRes.data) setFailedItems(failedRes.data);
    if (pendingRes.ok && pendingRes.data) setPendingItems(pendingRes.data);
    if (logsRes.ok && logsRes.data) setLogs(logsRes.data);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    refreshStatus();
    const off = api.events.onSyncStatus((payload) => setStatus(payload));
    return off;
  }, [api, refreshStatus]);

  useEffect(() => {
    if (open) refreshDetails();
  }, [open, refreshDetails]);

  if (!desktop || !api) return null;

  const meta = STATE_META[status.status] ?? STATE_META.idle;
  const Icon = meta.icon;
  const badgeCount = status.failed > 0 ? status.failed : status.pending;

  const handleSyncNow = async () => {
    setSyncingNow(true);
    try {
      const res = await api.backup.syncNow({ includeFailed: true });
      if (res.ok) {
        toast({
          title: "Sync complete",
          description:
            res.data && "failed" in res.data && (res.data as SyncStatus & { failed: number }).failed
              ? `Finished with ${(res.data as any).failed} item(s) still failing.`
              : "All pending changes were synchronized.",
        });
      } else {
        toast({ title: "Sync failed", description: res.error?.message || "Unknown error" });
      }
    } finally {
      setSyncingNow(false);
      await refreshStatus();
      await refreshDetails();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-md border border-border text-muted-foreground hover:bg-muted"
          aria-label={`Sync status: ${meta.label}`}
          title={meta.label}
        >
          <Icon className={cn("h-4 w-4", meta.className, status.status === "syncing" && "animate-spin")} aria-hidden />
          {badgeCount > 0 && status.status !== "syncing" && (
            <span
              className={cn(
                "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none text-white",
                status.status === "failed" ? "bg-[hsl(var(--critical))]" : "bg-[hsl(var(--warning))]",
              )}
              aria-hidden
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", meta.className, status.status === "syncing" && "animate-spin")} aria-hidden />
            <h3 className="font-display text-sm font-semibold">{meta.label}</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 rounded-md px-2.5 text-[11.5px]"
            onClick={handleSyncNow}
            disabled={syncingNow || status.status === "syncing" || !status.online}
          >
            <RefreshCw className={cn("h-3 w-3", (syncingNow || status.status === "syncing") && "animate-spin")} />
            Sync Now
          </Button>
        </div>

        {status.progress && (
          <div className="border-b border-border px-4 py-2">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Syncing…</span>
              <span>
                {status.progress.current}/{status.progress.total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, (status.progress.current / Math.max(1, status.progress.total)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
          <div className="px-2 py-3">
            <div className="text-lg font-semibold tabular-nums">{status.pending}</div>
            <div className="text-[10.5px] text-muted-foreground">Pending</div>
          </div>
          <div className="px-2 py-3">
            <div
              className={cn(
                "text-lg font-semibold tabular-nums",
                status.failed > 0 && "text-[hsl(var(--critical))]",
              )}
            >
              {status.failed}
            </div>
            <div className="text-[10.5px] text-muted-foreground">Failed</div>
          </div>
          <div className="px-2 py-3">
            <div className={cn("text-lg font-semibold", status.online ? "text-[hsl(var(--success))]" : "text-muted-foreground")}>
              {status.online ? "Online" : "Offline"}
            </div>
            <div className="text-[10.5px] text-muted-foreground">Connection</div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 text-[11.5px] text-muted-foreground">
          <span>Last successful sync</span>
          <span className="font-medium text-foreground">{formatRelativeTime(status.lastSyncAt)}</span>
        </div>

        {failedItems.length > 0 && (
          <div className="border-t border-border">
            <div className="px-4 py-2 text-[11.5px] font-semibold text-[hsl(var(--critical))]">
              Failed items ({failedItems.length})
            </div>
            <ScrollArea className="h-28">
              <div className="space-y-1 px-4 pb-2">
                {failedItems.map((item) => (
                  <div key={item.id} className="rounded-md border border-[hsl(var(--critical-bg))] bg-[hsl(var(--critical-bg))]/40 px-2 py-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {item.entity} · {item.operation}
                      </span>
                      <span className="text-muted-foreground">#{item.attempts} tries</span>
                    </div>
                    {item.last_error && (
                      <div className="mt-0.5 truncate text-muted-foreground" title={item.last_error}>
                        {item.last_error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {pendingItems.length > 0 && (
          <div className="border-t border-border">
            <div className="px-4 py-2 text-[11.5px] font-semibold text-[hsl(var(--warning))]">
              Pending uploads ({status.pending})
            </div>
            <ScrollArea className="h-20">
              <div className="space-y-1 px-4 pb-2">
                {pendingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-[11px]">
                    <span>
                      {item.entity} · {item.operation}
                    </span>
                    <span className="text-muted-foreground">{formatRelativeTime(item.updated_at)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="border-t border-border">
          <div className="px-4 py-2 text-[11.5px] font-semibold text-foreground">Sync log</div>
          <ScrollArea className="h-32">
            <div className="space-y-1 px-4 pb-3">
              {logs.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">No activity yet</div>
              ) : (
                logs.map((entry, idx) => (
                  <div key={`${entry.at}-${idx}`} className="text-[10.5px] leading-snug">
                    <span className="text-muted-foreground">{new Date(entry.at).toLocaleTimeString()}</span>{" "}
                    <span
                      className={cn(
                        entry.level === "error" && "text-[hsl(var(--critical))]",
                        entry.level === "warn" && "text-[hsl(var(--warning))]",
                      )}
                    >
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
