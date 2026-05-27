import { useState, type ComponentType } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
};

export function SidebarMenuGroup({
  label,
  icon: Icon,
  items,
  unreadMessages = 0,
  navSubLinkBase,
  navLinkActive,
}: SidebarMenuGroupProps) {
  const location = useLocation();
  const hasActiveChild = items.some(
    (sub) =>
      location.pathname === sub.path ||
      location.pathname.startsWith(sub.path + "/")
  );

  const [expanded, setExpanded] = useState(hasActiveChild);
  const [hovered, setHovered] = useState(false);
  const showItems = expanded || hovered || hasActiveChild;

  const handleHeaderClick = () => {
    setExpanded((p) => !p);
  };

  return (
    <div
      className="pt-2 first:pt-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={handleHeaderClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors",
          "text-sidebar-foreground/55 hover:text-sidebar-foreground",
          showItems && "text-sidebar-foreground",
          hasActiveChild && "font-medium"
        )}
        aria-expanded={showItems}
      >
        <Icon className="h-[18px] w-[18px] flex-shrink-0 opacity-70" />
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 flex-shrink-0 opacity-50 transition-transform duration-200",
            showItems && "rotate-90"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          showItems ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pb-1 pt-0.5">
            {items.map((subItem) => (
              <NavLink
                key={subItem.path}
                to={subItem.path}
                className={navSubLinkBase}
                activeClassName={navLinkActive}
              >
                <subItem.icon className="h-4 w-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
                <span className="flex-1 truncate">{subItem.label}</span>
                {subItem.showBadge && unreadMessages > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-5 px-1 flex items-center justify-center text-[10px] flex-shrink-0"
                  >
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </Badge>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
