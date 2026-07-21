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

/** Shared sidebar nav classes — mingo shell (sharp edges, ink sidebar) */

export const portalNavLinkBase =
  "portal-nav-link flex items-center gap-[11px] px-5 py-2 text-[13px] font-normal text-sidebar-foreground/70 transition-[background,color] duration-100 hover:bg-sidebar-accent hover:text-sidebar-foreground";

export const portalNavLinkActive =
  "portal-nav-link-active text-white font-medium";

export const portalNavSubLinkBase =
  "portal-nav-sublink flex items-center gap-[11px] py-1.5 pl-11 pr-5 text-[13px] text-sidebar-foreground/65 transition-[background,color] duration-100 hover:bg-sidebar-accent hover:text-sidebar-foreground";

export const portalNavGroupTrigger =
  "portal-nav-group flex w-full items-center gap-[11px] px-5 py-2 text-[13px] font-normal text-sidebar-foreground/70 transition-[background,color] duration-100 hover:bg-sidebar-accent hover:text-sidebar-foreground";