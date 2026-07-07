export type PortalRole =
  | "admin"
  | "teacher"
  | "parent"
  | "student"
  | "super_admin"
  | "accountant"
  | "auditor";

export const PORTAL_ROLE_META: Record<
  PortalRole,
  { label: string; shortLabel: string; accentClass: string }
> = {
  admin: {
    label: "School Admin",
    shortLabel: "Admin",
    accentClass: "portal-accent-admin",
  },

  super_admin: {
    label: "Super Admin",
    shortLabel: "Super",
    accentClass: "portal-accent-admin",
  },

  accountant: {
    label: "Finance",
    shortLabel: "Finance",
    accentClass: "portal-accent-accountant",
  },

  auditor: {
    label: "Audit & Compliance",
    shortLabel: "Auditor",
    accentClass: "portal-accent-auditor",
  },

  teacher: {
    label: "Teacher Portal",
    shortLabel: "Teacher",
    accentClass: "portal-accent-teacher",
  },

  parent: {
    label: "Parent Portal",
    shortLabel: "Parent",
    accentClass: "portal-accent-parent",
  },

  student: {
    label: "Student Portal",
    shortLabel: "Student",
    accentClass: "portal-accent-student",
  },
};

/** Shared sidebar nav classes — used by DashboardLayout, SidebarMenuGroup, DynamicAdminSidebarNav */

export const portalNavLinkBase =
  "portal-nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/85 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:translate-x-0.5";

export const portalNavLinkActive =
  "portal-nav-link-active text-sidebar-foreground";

export const portalNavSubLinkBase =
  "portal-nav-sublink flex items-center gap-2.5 rounded-lg py-1.5 pl-9 pr-3 text-sm text-sidebar-foreground/80 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:translate-x-0.5";

export const portalNavGroupTrigger =
  "portal-nav-group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/85 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground";
