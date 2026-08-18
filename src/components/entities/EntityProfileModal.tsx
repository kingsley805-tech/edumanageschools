import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type EntityStat = {
  label: string;
  value: string | number;
  sub?: string;
};

export type EntityInfoField = {
  label: string;
  value: React.ReactNode;
};

export type EntityTab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export interface EntityProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string; // e.g. "Student", "Teacher", "Customer", "Staff"
  entityCode?: string; // e.g. "#ADM-2026-0006" or "#CUST-2026-0006"
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  statusText?: string;
  statusVariant?: "success" | "warning" | "danger" | "info" | "secondary";
  metaItems?: Array<{
    icon: string;
    text: string;
  }>;
  rightMetric?: {
    label: string;
    value: string;
  };
  generalInfo: EntityInfoField[];
  stats?: EntityStat[];
  onRefreshStats?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  customTabs?: EntityTab[];
  children?: React.ReactNode;
}

export const EntityProfileModal: React.FC<EntityProfileModalProps> = ({
  open,
  onOpenChange,
  entityType,
  entityCode,
  name,
  avatarUrl,
  initials,
  statusText = "Active",
  statusVariant = "success",
  metaItems = [],
  rightMetric,
  generalInfo,
  stats = [],
  onRefreshStats,
  onEdit,
  onDelete,
  customTabs = [],
  children,
}) => {
  const [activeTab, setActiveTab] = useState<string>("overview");

  const computedInitials =
    initials ||
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() ||
    "E";

  const tabs: EntityTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: null,
    },
    ...customTabs,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border border-border bg-background shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{name} - {entityType} Details</DialogTitle>
        </DialogHeader>

        {/* ── Top Profile Hero / Header Banner ───────────────────────── */}
        <div className="relative overflow-hidden border-b border-border entity-hero-bg px-6 pt-8 pb-6 flex flex-col items-center text-center">
          {/* Large Circular Avatar with active accent ring */}
          <div className="relative mb-3">
            <div
              className={cn(
                "size-20 sm:size-24 rounded-full border-2 bg-background/95 shadow-md flex items-center justify-center overflow-hidden transition-all",
                statusVariant === "success" || statusText?.toLowerCase() === "active"
                  ? "border-emerald-500 shadow-emerald-950/20"
                  : statusVariant === "danger"
                  ? "border-rose-500 shadow-rose-950/20"
                  : statusVariant === "warning"
                  ? "border-amber-500 shadow-amber-950/20"
                  : "border-border",
              )}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-foreground">
                  {computedInitials}
                </span>
              )}
            </div>
          </div>

          {/* Entity Name + Verified Checkmark */}
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {name}
            </h2>
            <i className="ki-filled ki-verify text-primary text-base shrink-0" />
          </div>

          {/* Unified Status Pill + Metadata row */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mt-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border",
                statusVariant === "success" || statusText?.toLowerCase() === "active"
                  ? "text-emerald-400 bg-emerald-950/60 border-emerald-800/40"
                  : statusVariant === "danger"
                  ? "text-rose-400 bg-rose-950/60 border-rose-800/40"
                  : statusVariant === "warning"
                  ? "text-amber-400 bg-amber-950/60 border-amber-800/40"
                  : "text-foreground bg-accent/40 border-border",
              )}
            >
              {statusText}
            </span>

            {entityCode && (
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <i className="ki-filled ki-barcode text-sm" />
                <span>{entityCode}</span>
              </div>
            )}

            {metaItems.map((meta, index) => (
              <div key={index} className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <i className={cn("ki-filled text-sm text-muted-foreground", meta.icon)} />
                <span>{meta.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab Bar & Action Buttons Bar ────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between border-b border-border px-6 bg-card/60 gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-6 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "py-3.5 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                    isActive
                      ? "border-foreground text-foreground font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 py-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="kt-btn kt-btn-outline kt-btn-sm text-destructive hover:bg-destructive/10 border-border gap-1.5"
              >
                <i className="ki-filled ki-trash text-sm" />
                Delete
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="kt-btn kt-btn-primary kt-btn-sm gap-1.5"
              >
                <i className="ki-filled ki-pencil text-sm" />
                Edit {entityType}
              </button>
            )}
          </div>
        </div>

        {/* ── Content Area ────────────────────────────────────────────── */}
        <div className="p-6 space-y-6">
          {activeTab === "overview" ? (
            <>
              {/* Sub-header Summary Row */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {entityType} {entityCode ? `· ${entityCode}` : ""}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {name}
                    </h3>
                    <i className="ki-filled ki-verify text-primary text-base shrink-0" />
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {statusText}
                    </span>
                  </div>
                </div>

                {rightMetric && (
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-muted-foreground block">
                      {rightMetric.label}
                    </span>
                    <span className="text-lg font-bold text-foreground font-mono">
                      {rightMetric.value}
                    </span>
                  </div>
                )}
              </div>

              {/* 2-Column Card Grid: General Info (Left) + Summary Stats (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Card: General Info */}
                <div className="lg:col-span-5 kt-card p-5 border border-border rounded-xl bg-card shadow-xs">
                  <h4 className="text-sm font-semibold text-foreground pb-3 border-b border-border">
                    General Info
                  </h4>
                  <div className="divide-y divide-border/40 text-xs sm:text-sm pt-2">
                    {generalInfo.map((field, idx) => (
                      <div
                        key={idx}
                        className="py-2.5 flex items-start justify-between gap-3"
                      >
                        <span className="text-muted-foreground font-normal shrink-0">
                          {field.label}:
                        </span>
                        <span className="font-medium text-foreground text-right break-words">
                          {field.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Card: Summary & Stats */}
                <div className="lg:col-span-7 kt-card p-5 border border-border rounded-xl bg-card shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h4 className="text-sm font-semibold text-foreground">
                      {entityType} Summary
                    </h4>
                    {onRefreshStats && (
                      <button
                        type="button"
                        onClick={onRefreshStats}
                        className="kt-btn kt-btn-ghost kt-btn-sm text-xs gap-1.5 text-muted-foreground hover:text-foreground p-1.5"
                      >
                        <i className="ki-filled ki-arrows-circle text-xs" />
                        Refresh
                      </button>
                    )}
                  </div>

                  {stats.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                      {stats.map((st, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-accent/40 border border-border/40 text-center hover:bg-accent/60 transition-colors"
                        >
                          <span className="text-base sm:text-lg font-bold text-foreground tracking-tight leading-tight">
                            {st.value}
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-1 leading-tight font-medium">
                            {st.label}
                          </span>
                          {st.sub && (
                            <span className="text-[10px] text-muted-foreground/80 mt-0.5">
                              {st.sub}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {children && <div className="mt-4 pt-4 border-t border-border">{children}</div>}
                </div>
              </div>
            </>
          ) : (
            <div>{customTabs.find((t) => t.id === activeTab)?.content}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
