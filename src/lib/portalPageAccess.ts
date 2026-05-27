import { PERMISSIONS } from "@/lib/permissions";

/** Actions shown in the admin portal-access matrix */
export const PORTAL_ACCESS_ACTIONS = ["view", "create", "edit", "manage"] as const;
export type PortalAccessAction = (typeof PORTAL_ACCESS_ACTIONS)[number];

export type PortalStaffRole = "accountant" | "auditor" | "teacher";

export type PortalPageDef = {
  key: string;
  label: string;
  section: string;
  path: string;
  description?: string;
  /** Which staff role templates this page applies to */
  assignableTo: PortalStaffRole[];
  permissions: Partial<Record<PortalAccessAction, string>>;
};

/**
 * Portal pages school admins can grant to staff (accountant / auditor / teacher).
 * Maps UI toggles → RBAC permission codes in `permissions` table.
 */
export const PORTAL_PAGES: PortalPageDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    section: "Overview",
    path: "/accountant",
    assignableTo: ["accountant", "auditor"],
    permissions: {},
  },
  {
    key: "students",
    label: "Students",
    section: "Academics",
    path: "/admin/students",
    assignableTo: ["teacher"],
    permissions: {
      view: PERMISSIONS.students.create,
      create: PERMISSIONS.students.create,
      edit: PERMISSIONS.students.edit,
      manage: PERMISSIONS.students.delete,
    },
  },
  {
    key: "teachers",
    label: "Teachers",
    section: "Academics",
    path: "/admin/teachers",
    assignableTo: [],
    permissions: {
      view: PERMISSIONS.teachers.manage,
      manage: PERMISSIONS.teachers.manage,
    },
  },
  {
    key: "classes",
    label: "Classes",
    section: "Academics",
    path: "/admin/classes",
    assignableTo: ["teacher"],
    permissions: {},
  },
  {
    key: "subjects",
    label: "Subjects",
    section: "Academics",
    path: "/admin/subjects",
    assignableTo: ["teacher"],
    permissions: {},
  },
  {
    key: "timetable",
    label: "Timetable",
    section: "Academics",
    path: "/admin/timetable",
    assignableTo: ["teacher"],
    permissions: {},
  },
  {
    key: "grade_scales",
    label: "Grade Scales",
    section: "Academics",
    path: "/admin/grade-scales",
    assignableTo: ["teacher"],
    permissions: { view: PERMISSIONS.school.grading, manage: PERMISSIONS.school.grading },
  },
  {
    key: "report_cards",
    label: "Report Cards",
    section: "Examinations & Results",
    path: "/admin/report-cards",
    assignableTo: ["teacher"],
    permissions: {
      view: PERMISSIONS.reports.viewAcademic,
      create: PERMISSIONS.reports.create,
      edit: PERMISSIONS.reports.edit,
      manage: PERMISSIONS.reports.publish,
    },
  },
  {
    key: "report_archive",
    label: "Report Archive",
    section: "Examinations & Results",
    path: "/admin/report-cards/archive",
    assignableTo: ["teacher"],
    permissions: { view: PERMISSIONS.reports.viewAcademic },
  },
  {
    key: "academic_reports",
    label: "Academic Reports",
    section: "Examinations & Results",
    path: "/admin/reports",
    assignableTo: ["teacher", "auditor"],
    permissions: { view: PERMISSIONS.reports.viewAcademic },
  },
  {
    key: "report_settings",
    label: "Report Settings",
    section: "Examinations & Results",
    path: "/admin/report-settings",
    assignableTo: [],
    permissions: { view: PERMISSIONS.school.settings, manage: PERMISSIONS.school.settings },
  },
  {
    key: "attendance",
    label: "Student Attendance",
    section: "Attendance",
    path: "/admin/attendance",
    assignableTo: ["teacher"],
    permissions: {},
  },
  {
    key: "billing_fees",
    label: "Fees",
    section: "Financial Management",
    path: "/admin/billing/fees",
    assignableTo: ["accountant"],
    permissions: {
      view: PERMISSIONS.billing.feeTemplates,
      create: PERMISSIONS.billing.feeTemplates,
      edit: PERMISSIONS.billing.feeCategories,
      manage: PERMISSIONS.billing.feeTemplates,
    },
  },
  {
    key: "billing_invoices",
    label: "Invoices",
    section: "Financial Management",
    path: "/admin/billing/invoices",
    assignableTo: ["accountant", "auditor"],
    permissions: {
      view: PERMISSIONS.invoices.view,
      create: PERMISSIONS.invoices.create,
      edit: PERMISSIONS.invoices.edit,
      manage: PERMISSIONS.invoices.approve,
    },
  },
  {
    key: "billing_payments",
    label: "Payments",
    section: "Financial Management",
    path: "/admin/billing/payments",
    assignableTo: ["accountant", "auditor"],
    permissions: {
      view: PERMISSIONS.payments.view,
      create: PERMISSIONS.payments.process,
      edit: PERMISSIONS.payments.allocate,
      manage: PERMISSIONS.payments.reverse,
    },
  },
  {
    key: "billing_paid",
    label: "Paid Students",
    section: "Financial Management",
    path: "/admin/billing/paid-students",
    assignableTo: ["accountant", "auditor"],
    permissions: { view: PERMISSIONS.fees.viewStatus },
  },
  {
    key: "billing_outstanding",
    label: "Outstanding Students",
    section: "Financial Management",
    path: "/admin/billing/outstanding",
    assignableTo: ["accountant", "auditor"],
    permissions: { view: PERMISSIONS.invoices.view },
  },
  {
    key: "billing_reports",
    label: "Billing Reports",
    section: "Financial Management",
    path: "/admin/billing/reports",
    assignableTo: ["accountant", "auditor"],
    permissions: {
      view: PERMISSIONS.reports.viewFinancial,
      manage: PERMISSIONS.reports.exportFinancial,
    },
  },
  {
    key: "announcements",
    label: "Announcements",
    section: "Communication",
    path: "/admin/announcements",
    assignableTo: ["teacher"],
    permissions: {},
  },
  {
    key: "audit_logs",
    label: "Audit Logs",
    section: "Administration",
    path: "/admin/audit-logs",
    assignableTo: ["auditor"],
    permissions: { view: PERMISSIONS.admin.viewAudit },
  },
  {
    key: "approvals",
    label: "Approval Requests",
    section: "Administration",
    path: "/admin/approvals",
    assignableTo: [],
    permissions: { view: PERMISSIONS.admin.approveRequests, manage: PERMISSIONS.admin.approveRequests },
  },
];

export type PageAccessState = Record<string, Record<PortalAccessAction, boolean>>;

export function createEmptyPageAccess(): PageAccessState {
  const state: PageAccessState = {};
  for (const page of PORTAL_PAGES) {
    state[page.key] = { view: false, create: false, edit: false, manage: false };
  }
  return state;
}

export function pagesForStaffRole(roleSlug: string): PortalPageDef[] {
  if (roleSlug === "accountant") {
    return PORTAL_PAGES.filter((p) => p.assignableTo.includes("accountant"));
  }
  if (roleSlug === "auditor") {
    return PORTAL_PAGES.filter((p) => p.assignableTo.includes("auditor"));
  }
  if (roleSlug === "teacher") {
    return PORTAL_PAGES.filter((p) => p.assignableTo.includes("teacher"));
  }
  return PORTAL_PAGES;
}

/** Build checkbox state from role's granted permission codes */
export function pageAccessFromCodes(grantedCodes: Set<string>): PageAccessState {
  const state = createEmptyPageAccess();
  for (const page of PORTAL_PAGES) {
    for (const action of PORTAL_ACCESS_ACTIONS) {
      const code = page.permissions[action];
      if (code && grantedCodes.has(code)) {
        state[page.key][action] = true;
      }
    }
    if (!Object.values(page.permissions).some(Boolean) && grantedCodes.size > 0) {
      state[page.key].view = true;
    }
  }
  return state;
}

/** Collect permission codes to grant from page access matrix */
export function codesFromPageAccess(access: PageAccessState): Set<string> {
  const codes = new Set<string>();
  for (const page of PORTAL_PAGES) {
    const row = access[page.key];
    if (!row) continue;
    for (const action of PORTAL_ACCESS_ACTIONS) {
      if (!row[action]) continue;
      const code = page.permissions[action];
      if (code) codes.add(code);
    }
    if (row.view && !page.permissions.view) {
      for (const code of Object.values(page.permissions)) {
        if (code) codes.add(code);
      }
    }
  }
  return codes;
}

export function applyPreset(
  preset: "full_accountant" | "read_only_auditor" | "billing_only" | "teacher_reports",
): PageAccessState {
  const state = createEmptyPageAccess();
  const setPage = (key: string, patch: Partial<Record<PortalAccessAction, boolean>>) => {
    state[key] = { ...state[key], ...patch };
  };

  if (preset === "full_accountant") {
    for (const p of pagesForStaffRole("accountant")) {
      setPage(p.key, { view: true, create: true, edit: true, manage: true });
    }
  } else if (preset === "read_only_auditor") {
    for (const p of pagesForStaffRole("auditor")) {
      setPage(p.key, { view: true, create: false, edit: false, manage: false });
    }
  } else if (preset === "billing_only") {
    for (const p of PORTAL_PAGES.filter((x) => x.section === "Financial Management")) {
      setPage(p.key, { view: true, create: true, edit: false, manage: false });
    }
  } else if (preset === "teacher_reports") {
    for (const p of pagesForStaffRole("teacher")) {
      setPage(p.key, { view: true, create: true, edit: true, manage: false });
    }
  }
  return state;
}

export const STAFF_ROLE_OPTIONS = [
  { slug: "accountant", name: "Accountant", description: "Billing, invoices, payments, financial reports" },
  { slug: "auditor", name: "Auditor", description: "Read-only financial and audit access" },
  { slug: "teacher", name: "Teacher (admin pages)", description: "Report cards and academic tools in admin shell" },
] as const;
