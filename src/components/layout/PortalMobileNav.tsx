import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLast, LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DynamicAdminSidebarNav } from "@/components/layout/DynamicAdminSidebarNav";
import {
  portalNavLinkActive,
  portalNavLinkBase,
  portalNavSubLinkBase,
} from "@/lib/portalNavStyles";
import type { AdminNavGroup, AdminNavItem } from "@/lib/rbac/adminNavConfig";

type Props = {
  items: (AdminNavItem | AdminNavGroup)[];
  unreadMessages: number;
  schoolName?: string;
  schoolLogoUrl?: string | null;
  portalLabel: string;
  navQuery: string;
  onNavQueryChange: (value: string) => void;
  onSignOut: () => void;
};

/** Slide-in navigation drawer used below the `lg` breakpoint. */
export function PortalMobileNav({
  items,
  unreadMessages,
  schoolName,
  schoolLogoUrl,
  portalLabel,
  navQuery,
  onNavQueryChange,
  onSignOut,
}: Props) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const initial = (schoolName ?? "E").substring(0, 1).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="portal-icon-button lg:hidden"
          aria-label="Open navigation menu"
          title="Open navigation menu"
        >
          <ChevronLast className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="portal-nav-drawer flex w-[290px] flex-col gap-0 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:w-[320px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{schoolName ?? "Portal"} navigation</SheetTitle>
          <SheetDescription>
            Browse modules and pages in your {(portalLabel || "portal").toLowerCase()} portal.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-[18px]">
          {schoolLogoUrl ? (
            <Avatar className="h-7 w-7 shrink-0 border border-sidebar-border">
              <AvatarImage src={schoolLogoUrl} alt={schoolName ?? "School"} />
              <AvatarFallback className="bg-sidebar-primary font-display text-[13px] font-medium text-sidebar-primary-foreground">
                {initial}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary font-display text-[13px] font-medium text-sidebar-primary-foreground">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-display text-sm font-semibold text-sidebar-foreground">
              {schoolName ?? "mingo"}
            </p>
            <p className="truncate text-[11px] font-medium text-sidebar-foreground/65">
              {portalLabel}
            </p>
          </div>
        </div>

        <nav className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden pb-2 pt-1">
          <DynamicAdminSidebarNav
            items={items}
            unreadMessages={unreadMessages}
            navLinkBase={portalNavLinkBase}
            navLinkActive={portalNavLinkActive}
            navSubLinkBase={portalNavSubLinkBase}
            emptyMessage={
              navQuery.trim()
                ? "No menu items match your search."
                : "No modules assigned. Contact your administrator."
            }
          />
        </nav>

        <div className="mt-auto space-y-1 border-t border-sidebar-border bg-sidebar px-5 py-3.5">
          <Link
            to="/settings"
            className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
