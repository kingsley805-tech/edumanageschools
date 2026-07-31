import { Fragment, useMemo } from "react";
import { SidebarMenuGroup, type SidebarLink } from "@/components/SidebarMenuGroup";
import { NavLink } from "@/components/NavLink";
import { SidebarIconTooltip } from "@/components/SidebarIconTooltip";
import type { AdminNavGroup, AdminNavItem } from "@/lib/rbac/adminNavConfig";

type Props = {
  items: (AdminNavItem | AdminNavGroup)[];
  unreadMessages: number;
  navLinkBase: string;
  navLinkActive: string;
  navSubLinkBase: string;
  emptyMessage?: string;
  collapsed?: boolean;
};

function isGroup(item: AdminNavItem | AdminNavGroup): item is AdminNavGroup {
  return "items" in item;
}

const DASHBOARD_PATHS = new Set([
  "/admin",
  "/teacher",
  "/parent",
  "/student",
  "/accountant",
  "/auditor",
]);

/** Map nav labels → section headers (Overview / Academics / Operations / System) */
function sectionFor(item: AdminNavItem | AdminNavGroup): string {
  const label = item.label.toLowerCase();
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
    label.includes("recommendation") ||
    label.includes("resource") ||
    label.includes("assignment") ||
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
    label.includes("payment")
  ) {
    return "Operations";
  }
  return "System";
}

export function DynamicAdminSidebarNav({
  items,
  unreadMessages,
  navLinkBase,
  navLinkActive,
  navSubLinkBase,
  emptyMessage = "No modules assigned. Contact your administrator.",
  collapsed = false,
}: Props) {
  const withSections = useMemo(() => {
    let last = "";
    return items.map((item) => {
      const section = sectionFor(item);
      const sameAsGroup = item.label.toLowerCase() === section.toLowerCase();
      const showSection = section !== last && !sameAsGroup;
      if (section !== last) last = section;
      return { item, section: showSection ? section : null };
    });
  }, [items]);

  return (
    <>
      {withSections.map(({ item, section }, index) => {
        const sectionLabel =
          section && !collapsed ? (
            <div className="portal-nav-group-label" role="presentation">
              <span className="portal-nav-group-mark" aria-hidden />
              <span className="portal-nav-group-title">{section}</span>
            </div>
          ) : null;

        if (isGroup(item)) {
          const links: SidebarLink[] = item.items.map((sub) => ({
            icon: sub.icon,
            label: sub.label,
            path: sub.path,
            showBadge: sub.showBadge,
          }));
          return (
            <Fragment key={`${item.label}-${index}`}>
              {sectionLabel}
              <SidebarMenuGroup
                label={item.label}
                icon={item.icon}
                items={links}
                unreadMessages={unreadMessages}
                navSubLinkBase={navSubLinkBase}
                navLinkActive={navLinkActive}
                collapsed={collapsed}
              />
            </Fragment>
          );
        }
        return (
          <Fragment key={item.path}>
            {sectionLabel}
            <SidebarIconTooltip label={item.label} collapsed={collapsed}>
              <NavLink
                to={item.path}
                end={DASHBOARD_PATHS.has(item.path)}
                className={navLinkBase}
                activeClassName={navLinkActive}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/80" />
                <span className="portal-nav-label flex-1 truncate">
                  {item.label}
                </span>
              </NavLink>
            </SidebarIconTooltip>
          </Fragment>
        );
      })}
      {items.length === 0 && (
        <p className="px-5 py-4 text-center text-xs font-medium text-sidebar-foreground/75">
          {emptyMessage}
        </p>
      )}
    </>
  );
}
