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

/** Shared sidebar nav classes — light shell, readable ink text */

export const portalNavLinkBase =
  "portal-nav-link flex items-center gap-3 px-5 py-2.5 text-[13px] font-medium text-sidebar-foreground transition-[background,color,border-color] duration-100 hover:bg-sidebar-accent hover:text-primary";

export const portalNavLinkActive =
  "portal-nav-link-active font-semibold";

export const portalNavSubLinkBase =
  "portal-nav-sublink flex items-center gap-3 py-2 pl-11 pr-5 text-[13px] font-medium text-sidebar-foreground/90 transition-[background,color,border-color] duration-100 hover:bg-sidebar-accent hover:text-primary";

export const portalNavGroupTrigger =
  "portal-nav-group flex w-full items-center gap-3 px-5 py-2.5 text-[13px] font-medium text-sidebar-foreground transition-[background,color] duration-100 hover:bg-sidebar-accent hover:text-primary";