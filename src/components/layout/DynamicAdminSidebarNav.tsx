import { SidebarMenuGroup, type SidebarLink } from "@/components/SidebarMenuGroup";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import type { AdminNavGroup, AdminNavItem } from "@/lib/rbac/adminNavConfig";

type Props = {
  items: (AdminNavItem | AdminNavGroup)[];
  unreadMessages: number;
  navLinkBase: string;
  navLinkActive: string;
  navSubLinkBase: string;
};

function isGroup(item: AdminNavItem | AdminNavGroup): item is AdminNavGroup {
  return "items" in item;
}

export function DynamicAdminSidebarNav({
  items,
  unreadMessages,
  navLinkBase,
  navLinkActive,
  navSubLinkBase,
}: Props) {
  return (
    <>
      {items.map((item, index) => {
        if (isGroup(item)) {
          const links: SidebarLink[] = item.items.map((sub) => ({
            icon: sub.icon,
            label: sub.label,
            path: sub.path,
          }));
          return (
            <SidebarMenuGroup
              key={`${item.label}-${index}`}
              label={item.label}
              icon={item.icon}
              items={links}
              unreadMessages={unreadMessages}
              navSubLinkBase={navSubLinkBase}
              navLinkActive={navLinkActive}
            />
          );
        }
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/admin"}
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <item.icon className="h-[18px] w-[18px] flex-shrink-0 opacity-70 group-hover:opacity-100" />
            <span className="flex-1 truncate">{item.label}</span>
          </NavLink>
        );
      })}
      {items.length === 0 && (
        <p className="px-3 py-4 text-xs text-sidebar-foreground/60">
          No modules assigned. Contact your administrator.
        </p>
      )}
    </>
  );
}
