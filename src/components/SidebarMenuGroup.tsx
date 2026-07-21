import { useState, type ComponentType } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { SidebarIconTooltip } from "@/components/SidebarIconTooltip";
import { cn } from "@/lib/utils";
import { portalNavGroupTrigger } from "@/lib/portalNavStyles";

export type SidebarLink = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  path: string;
  showBadge?: boolean;
};

type SidebarMenuGroupProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: SidebarLink[];
  unreadMessages?: number;
  navSubLinkBase: string;
  navLinkActive: string;
  /** Icon-rail mode: show item icons only */
  collapsed?: boolean;
};

export function SidebarMenuGroup({
  label,
  icon: Icon,
  items,
  unreadMessages = 0,
  navSubLinkBase,
  navLinkActive,
  collapsed = false,
}: SidebarMenuGroupProps) {
  const location = useLocation();
  const hasActiveChild = items.some(
    (sub) =>
      location.pathname === sub.path ||
      location.pathname.startsWith(sub.path + "/"),
  );

  const [expanded, setExpanded] = useState(hasActiveChild);
  const showItems = collapsed || expanded || hasActiveChild;

  return (
    <div className="pt-0.5 first:pt-0">
      {!collapsed ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            portalNavGroupTrigger,
            hasActiveChild && "text-sidebar-foreground",
          )}
          aria-expanded={showItems}
        >
          <Icon className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/70" />
          <span className="portal-nav-label flex-1 truncate text-left">{label}</span>
          <ChevronRight
            className={cn(
              "portal-nav-chevron h-4 w-4 shrink-0 text-sidebar-foreground/40 transition-transform duration-150",
              showItems && "rotate-90",
            )}
          />
        </button>
      ) : null}

      {showItems ? (
        <div className="mt-0.5 space-y-0.5">
          {items.map((subItem) => (
            <SidebarIconTooltip
              key={subItem.path}
              label={subItem.label}
              collapsed={collapsed}
            >
              <NavLink
                to={subItem.path}
                className={navSubLinkBase}
                activeClassName={navLinkActive}
              >
                <subItem.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
                <span className="portal-nav-label flex-1 truncate">
                  {subItem.label}
                </span>
                {subItem.showBadge && unreadMessages > 0 && (
                  <Badge
                    variant="destructive"
                    className="portal-nav-badge h-5 min-w-5 px-1 flex items-center justify-center text-[10px] flex-shrink-0"
                  >
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </Badge>
                )}
              </NavLink>
            </SidebarIconTooltip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
