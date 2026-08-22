import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export type EntityStatusType =
  | "active"
  | "inactive"
  | "pending"
  | "pending_review"
  | "reviewed"
  | "approved"
  | "published"
  | "rejected"
  | "archived"
  | "locked"
  | "draft"
  | "completed"
  | "paid"
  | "overdue";

export interface EntityAction {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  to?: string;
  variant?: "default" | "destructive" | "outline" | "ghost" | "secondary";
  disabled?: boolean;
}

export interface EntityMetaTag {
  label: string;
  icon?: string | React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "success" | "warning" | "destructive";
}

export interface EntityMetric {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}

export interface EntityRowProps {
  id: string;
  name: string;
  code?: string | null;
  avatarUrl?: string | null;
  initials?: string;
  to?: string;
  onView?: () => void;
  statusText?: string;
  statusVariant?: EntityStatusType | string;
  metaTags?: EntityMetaTag[];
  metrics?: EntityMetric[];
  primaryAction?: EntityAction;
  secondaryAction?: EntityAction;
  contextActions?: EntityAction[];
  className?: string;
  onClick?: () => void;
}

export function getEntityInitials(name?: string | null, fallback = "E"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getEntityStatusBadge(status?: string | null): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  dotColor?: string;
} {
  const norm = (status || "").toLowerCase().replace(/[\s_-]+/g, "_");

  switch (norm) {
    case "approved":
    case "active":
    case "published":
    case "completed":
    case "paid":
      return {
        label: status || "Active",
        variant: "outline",
        className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-medium",
        dotColor: "bg-emerald-500",
      };
    case "pending":
    case "pending_review":
    case "pending_approval":
    case "under_review":
      return {
        label: status || "Pending Review",
        variant: "outline",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-medium",
        dotColor: "bg-amber-500",
      };
    case "reviewed":
      return {
        label: status || "Reviewed",
        variant: "outline",
        className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-medium",
        dotColor: "bg-blue-500",
      };
    case "rejected":
    case "returned":
    case "overdue":
    case "locked":
      return {
        label: status || "Returned",
        variant: "outline",
        className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 font-medium",
        dotColor: "bg-rose-500",
      };
    case "archived":
    case "draft":
    case "inactive":
    default:
      return {
        label: status || "Archived",
        variant: "outline",
        className: "bg-muted text-muted-foreground border-border font-medium",
        dotColor: "bg-muted-foreground",
      };
  }
}

/**
 * Compact Identity Block for Table Cells
 */
export function EntityCellIdentity({
  name,
  code,
  avatarUrl,
  initials,
  to,
  onView,
  statusVariant,
}: {
  name: string;
  code?: string | null;
  avatarUrl?: string | null;
  initials?: string;
  to?: string;
  onView?: () => void;
  statusVariant?: string;
}) {
  const compInitials = initials || getEntityInitials(name);
  const statusInfo = getEntityStatusBadge(statusVariant);

  const content = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative shrink-0">
        <div className="size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden text-xs font-semibold text-primary shadow-xs">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="size-full object-cover" />
          ) : (
            <span>{compInitials}</span>
          )}
        </div>
        {statusInfo.dotColor && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
              statusInfo.dotColor,
            )}
          />
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
          {name}
        </span>
        {code && (
          <span className="text-xs text-muted-foreground font-mono truncate">
            {code}
          </span>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="group inline-flex items-center">
        {content}
      </Link>
    );
  }

  if (onView) {
    return (
      <button
        type="button"
        onClick={onView}
        className="group text-left inline-flex items-center hover:opacity-90"
      >
        {content}
      </button>
    );
  }

  return content;
}

/**
 * Responsive Mobile Card for an Entity Record
 */
export function EntityCardItem({
  name,
  code,
  avatarUrl,
  initials,
  to,
  onView,
  statusText,
  statusVariant,
  metaTags = [],
  metrics = [],
  primaryAction,
  secondaryAction,
  contextActions = [],
  className,
}: EntityRowProps) {
  const statusBadge = getEntityStatusBadge(statusVariant || statusText);

  return (
    <div
      className={cn(
        "p-4 rounded-xl border border-border bg-card shadow-xs hover:border-primary/40 transition-all space-y-3.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <EntityCellIdentity
          name={name}
          code={code}
          avatarUrl={avatarUrl}
          initials={initials}
          to={to}
          onView={onView}
          statusVariant={statusVariant}
        />
        <Badge variant={statusBadge.variant} className={cn("text-xs shrink-0", statusBadge.className)}>
          <span className={cn("mr-1.5 size-1.5 rounded-full", statusBadge.dotColor)} />
          {statusBadge.label}
        </Badge>
      </div>

      {/* Meta tags */}
      {metaTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {metaTags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-muted/60 text-secondary-foreground border border-border/60"
            >
              {typeof tag.icon === "string" ? (
                <i className={cn("text-xs", tag.icon)} />
              ) : (
                tag.icon
              )}
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
          {metrics.map((m, idx) => (
            <div key={idx} className="flex flex-col">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{m.label}</span>
              <span className={cn("text-sm font-semibold tabular-nums", m.highlight && "text-primary")}>
                {m.value}
                {m.sub && <span className="text-xs font-normal text-muted-foreground ml-1">{m.sub}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
        {secondaryAction && (
          secondaryAction.to ? (
            <Button asChild size="sm" variant={secondaryAction.variant || "outline"} className="h-8 text-xs">
              <Link to={secondaryAction.to}>
                {secondaryAction.icon}
                {secondaryAction.label}
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant={secondaryAction.variant || "outline"}
              className="h-8 text-xs"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )
        )}

        {primaryAction && (
          primaryAction.to ? (
            <Button asChild size="sm" variant={primaryAction.variant || "default"} className="h-8 text-xs">
              <Link to={primaryAction.to}>
                {primaryAction.icon}
                {primaryAction.label}
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant={primaryAction.variant || "default"}
              className="h-8 text-xs"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )
        )}

        {contextActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {contextActions.map((act, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={act.onClick}
                  disabled={act.disabled}
                  className={cn(act.variant === "destructive" && "text-destructive focus:text-destructive")}
                >
                  {act.icon && <span className="mr-2">{act.icon}</span>}
                  {act.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
