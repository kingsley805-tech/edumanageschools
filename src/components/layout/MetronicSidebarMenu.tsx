import { Fragment, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Ki, KiIcon } from "@/metronic/KiIcon";
import { SidebarIconTooltip } from "@/components/SidebarIconTooltip";
import type { AdminNavGroup, AdminNavItem } from "@/lib/rbac/adminNavConfig";

type NavEntry = AdminNavItem | AdminNavGroup;

type Props = {
  items: NavEntry[];
  unreadMessages?: number;
  onNavigate?: () => void;
  className?: string;
  collapsed?: boolean;
};

const DASHBOARD_PATHS = new Set([
  "/admin",
  "/teacher",
  "/parent",
  "/student",
  "/accountant",
  "/auditor",
]);

function isGroup(item: NavEntry): item is AdminNavGroup {
  return "items" in item;
}

function pathIsActive(pathname: string, path: string) {
  if (DASHBOARD_PATHS.has(path)) return pathname === path;
  return pathname === path || pathname.startsWith(path + "/");
}

function entryActive(pathname: string, entry: NavEntry) {
  if (isGroup(entry)) {
    return entry.items.some((sub) => pathIsActive(pathname, sub.path));
  }
  return pathIsActive(pathname, entry.path);
}

function sectionFor(item: NavEntry): string {
  const label = (item?.label || "").toLowerCase();
  if (
    label === "dashboard" ||
    ("path" in item && DASHBOARD_PATHS.has(item.path))
  ) {
    return "Overview";
  }
  if (
    label.includes("academic") ||
    label.includes("examination") ||
    label.includes("attendance") ||
    label.includes("library") ||
    label.includes("student") ||
    label.includes("teacher") ||
    label.includes("class") ||
    label.includes("subject") ||
    label.includes("timetable") ||
    label.includes("lesson") ||
    label.includes("grade") ||
    label.includes("online") ||
    label.includes("report") ||
    label.includes("assignment") ||
    label.includes("achievement") ||
    label.includes("program") ||
    label.includes("performance") ||
    label.includes("recommendation") ||
    label.includes("waec") ||
    label.includes("bece") ||
    label.includes("wassce")
  ) {
    return "Academics";
  }
  if (
    label.includes("financial") ||
    label.includes("finance") ||
    label.includes("billing") ||
    label.includes("hr") ||
    label.includes("transport") ||
    label.includes("hostel") ||
    label.includes("inventory") ||
    label.includes("payroll") ||
    label.includes("staff") ||
    label.includes("fee") ||
    label.includes("payment") ||
    label.includes("department") ||
    label.includes("calendar") ||
    label.includes("shop") ||
    label.includes("expense") ||
    label.includes("budget") ||
    label.includes("income") ||
    label.includes("laboratory") ||
    label.includes("domestic") ||
    label.includes("health") ||
    label.includes("resource")
  ) {
    return "Operations";
  }
  if (
    label.includes("admin") ||
    label.includes("setting") ||
    label.includes("backup") ||
    label.includes("audit") ||
    label.includes("approval") ||
    label.includes("subscription") ||
    label.includes("permission") ||
    label.includes("role") ||
    label.includes("announcement") ||
    label.includes("pending") ||
    label.includes("number") ||
    label.includes("ai")
  ) {
    return "Administration";
  }
  return "Administration";
}

/**
 * Metronic kt-menu sidebar. Supports expanded and compact collapsed modes.
 */
export function MetronicSidebarMenu({
  items,
  unreadMessages = 0,
  onNavigate,
  className,
  collapsed = false,
}: Props) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (isGroup(item) && entryActive(location.pathname, item)) {
        set.add(item.label);
      }
    }
    return set;
  });

  // Keep groups containing the active route open when the items change.
  const openGroupLabels = useMemo(
    () =>
      items
        .filter((item) => isGroup(item) && entryActive(location.pathname, item))
        .map((item) => item.label),
    [items, location.pathname],
  );
  const openSet = useMemo(() => {
    const merged = new Set(openGroups);
    for (const label of openGroupLabels) merged.add(label);
    return merged;
  }, [openGroups, openGroupLabels]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const go = () => onNavigate?.();

  const withSections = useMemo(() => {
    let last = "";
    return items.map((item) => {
      const section = sectionFor(item);
      const sameAsGroup = (item?.label || "").toLowerCase() === (section || "").toLowerCase();
      const showSection = section !== last && !sameAsGroup;
      if (section !== last) last = section;
      return { item, section: showSection ? section : null };
    });
  }, [items]);

  return (
    <div className={cn("kt-menu flex flex-col grow gap-1 font-sans", className)}>
      {withSections.map(({ item: entry, section }, idx) => {
        const sectionHeading = section && !collapsed ? (
          <div key={`section-${section}-${idx}`} className="kt-menu-item pt-2.25 pb-px font-sans">
            <span className="kt-menu-heading uppercase text-xs font-medium text-muted-foreground ps-[10px] pe-[10px] tracking-wider font-sans">
              {section}
            </span>
          </div>
        ) : section && collapsed && idx > 0 ? (
          <div key={`section-div-${section}-${idx}`} className="my-1.5 mx-2 border-t border-border/40" />
        ) : null;

        if (isGroup(entry)) {
          const open = openSet.has(entry.label);
          const here = entryActive(location.pathname, entry);
          const firstSubPath = entry.items[0]?.path;

          const groupTrigger = (
            <div
              className={cn(
                "kt-menu-link group flex items-center cursor-pointer border border-transparent rounded-lg hover:bg-accent/60 transition-colors font-sans",
                collapsed
                  ? "justify-center p-2 w-10 h-10 mx-auto"
                  : "grow gap-[10px] ps-[10px] pe-[10px] py-[6px]",
                here && collapsed && "bg-accent/60 text-primary border-border"
              )}
              tabIndex={0}
              role="button"
              onClick={() => {
                if (!collapsed) toggleGroup(entry.label);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!collapsed) toggleGroup(entry.label);
                }
              }}
            >
              <span className={cn(
                "kt-menu-icon flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors",
                collapsed ? "w-5 h-5" : "items-start w-[20px]",
                here && "text-primary"
              )}>
                <KiIcon icon={entry.icon} className="text-lg" />
              </span>
              {!collapsed && (
                <>
                  <span className="kt-menu-title text-sm font-medium text-foreground group-hover:text-primary kt-menu-item-active:text-primary transition-colors font-sans">
                    {entry.label}
                  </span>
                  <span className="kt-menu-arrow text-muted-foreground group-hover:text-primary transition-colors w-[20px] shrink-0 justify-end ms-1 me-[-10px]">
                    <span className={cn("inline-flex", open && "hidden")}>
                      <Ki name="plus" className="text-[11px]" />
                    </span>
                    <span className={cn("hidden", open && "inline-flex")}>
                      <Ki name="minus" className="text-[11px]" />
                    </span>
                  </span>
                </>
              )}
            </div>
          );

          return (
            <Fragment key={`group-wrap-${entry.label}`}>
              {sectionHeading}
              <div
                key={entry.label}
                className={cn("kt-menu-item font-sans", !collapsed && open && "show", here && "here")}
              >
                <SidebarIconTooltip label={entry.label} collapsed={collapsed}>
                  {collapsed && firstSubPath ? (
                    <Link to={firstSubPath} onClick={go} className="block">
                      {groupTrigger}
                    </Link>
                  ) : (
                    groupTrigger
                  )}
                </SidebarIconTooltip>
                {!collapsed && (
                  <div className="kt-menu-accordion gap-1 ps-[10px] relative before:absolute before:start-[20px] before:top-0 before:bottom-0 before:border-s before:border-border font-sans">
                    {entry.items.map((sub) => {
                      const active = pathIsActive(location.pathname, sub.path);
                      return (
                        <div key={sub.path} className={cn("kt-menu-item font-sans", active && "active")}>
                          <Link
                            to={sub.path}
                            className="kt-menu-link group border border-transparent items-center grow kt-menu-item-active:bg-accent/60 dark:menu-item-active:border-border kt-menu-item-active:rounded-lg hover:bg-accent/60 hover:rounded-lg gap-[14px] ps-[10px] pe-[10px] py-[8px] transition-colors font-sans"
                            onClick={go}
                          >
                            <span className="kt-menu-bullet flex w-[6px] -start-[3px] rtl:start-0 relative before:absolute before:-top-[3px] before:size-[6px] before:rounded-full group-hover:before:bg-primary" />
                            <span className="kt-menu-title text-2sm font-normal text-foreground group-hover:text-primary kt-menu-item-active:text-primary kt-menu-item-active:font-semibold transition-colors font-sans">
                              {sub.label}
                            </span>
                            {sub.showBadge && unreadMessages > 0 ? (
                              <span className="kt-menu-badge ms-auto">
                                <span className="kt-badge kt-badge-sm kt-badge-danger kt-badge-dot ms-1.5 font-sans">
                                  {unreadMessages > 9 ? "9+" : unreadMessages}
                                </span>
                              </span>
                            ) : null}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Fragment>
          );
        }

        const active = pathIsActive(location.pathname, entry.path);
        return (
          <Fragment key={`item-wrap-${entry.path}`}>
            {sectionHeading}
            <div key={entry.path} className={cn("kt-menu-item font-sans", active && "active")}>
              <SidebarIconTooltip label={entry.label} collapsed={collapsed}>
                <Link
                  to={entry.path}
                  className={cn(
                    "kt-menu-link group border border-transparent items-center transition-colors font-sans",
                    collapsed
                      ? "justify-center p-2 w-10 h-10 mx-auto rounded-lg"
                      : "grow kt-menu-item-active:bg-accent/60 dark:menu-item-active:border-border kt-menu-item-active:rounded-lg hover:bg-accent/60 hover:rounded-lg gap-[10px] ps-[10px] pe-[10px] py-[7px]",
                    active && collapsed && "bg-accent/60 text-primary border-border"
                  )}
                  onClick={go}
                >
                  <span className={cn(
                    "kt-menu-icon flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors",
                    collapsed ? "w-5 h-5" : "items-start w-[20px]",
                    active && "text-primary"
                  )}>
                    <KiIcon icon={entry.icon} className="text-lg" />
                  </span>
                  {!collapsed && (
                    <>
                      <span className="kt-menu-title text-sm font-medium text-foreground group-hover:text-primary kt-menu-item-active:text-primary transition-colors font-sans">
                        {entry.label}
                      </span>
                      {entry.showBadge && unreadMessages > 0 ? (
                        <span className="kt-menu-badge ms-auto">
                          <span className="kt-badge kt-badge-sm kt-badge-danger kt-badge-dot ms-1.5 font-sans">
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </span>
                        </span>
                      ) : null}
                    </>
                  )}
                </Link>
              </SidebarIconTooltip>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
