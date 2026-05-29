/**
 * Canonical portal permission catalog — single source for sidebar, routes, and RBAC UI.
 * Permission codes: portal.{moduleKey}.{action}
 */

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
  "manage",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
  manage: "Manage",
};

export type PortalModuleDef = {
  key: string;
  label: string;
  path: string;
  /** Actions enabled for this module in the permission matrix */
  actions: PermissionAction[];
};

export type PortalCategoryDef = {
  key: string;
  label: string;
  modules: PortalModuleDef[];
};

/** Exact category structure from product requirements */
export const PORTAL_CATEGORIES: PortalCategoryDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    modules: [{ key: "dashboard", label: "Dashboard", path: "/admin", actions: ["view"] }],
  },
  {
    key: "academics",
    label: "Academics",
    modules: [
      { key: "students", label: "Students", path: "/admin/students", actions: ["view", "create", "edit", "delete", "export", "manage"] },
      { key: "teachers", label: "Teachers", path: "/admin/teachers", actions: ["view", "create", "edit", "delete", "manage"] },
      { key: "classes", label: "Classes", path: "/admin/classes", actions: ["view", "create", "edit", "delete", "manage"] },
      { key: "subjects", label: "Subjects", path: "/admin/subjects", actions: ["view", "create", "edit", "delete", "manage"] },
      { key: "timetable", label: "Timetable", path: "/admin/timetable", actions: ["view", "create", "edit", "delete", "manage"] },
      { key: "grade_scales", label: "Grade Scales", path: "/admin/grade-scales", actions: ["view", "create", "edit", "delete", "manage"] },
      {
        key: "lesson_notes",
        label: "Lesson Notes",
        path: "/admin/lesson-notes",
        actions: ["view", "create", "edit", "approve", "export", "manage"],
      },
    ],
  },
  {
    key: "examinations",
    label: "Examinations & Results",
    modules: [
      { key: "result_scores", label: "Enter Scores", path: "/teacher/scores", actions: ["view", "create", "edit", "manage"] },
      { key: "report_cards", label: "Report Cards", path: "/admin/report-cards", actions: ["view", "create", "edit", "delete", "approve", "export", "manage"] },
      { key: "report_archive", label: "Report Archive", path: "/admin/report-cards/archive", actions: ["view", "export", "manage"] },
      { key: "academic_reports", label: "Reports", path: "/admin/reports", actions: ["view", "export", "manage"] },
      { key: "report_settings", label: "Report Settings", path: "/admin/report-settings", actions: ["view", "edit", "manage"] },
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    modules: [
      { key: "attendance", label: "Student Attendance", path: "/admin/attendance", actions: ["view", "create", "edit", "export", "manage"] },
    ],
  },
  {
    key: "finance",
    label: "Financial Management",
    modules: [
      { key: "billing_fees", label: "Fees", path: "/admin/billing/fees", actions: ["view", "create", "edit", "delete", "manage"] },
      { key: "billing_invoices", label: "Invoices", path: "/admin/billing/invoices", actions: ["view", "create", "edit", "delete", "approve", "export", "manage"] },
      { key: "billing_payments", label: "Payments", path: "/admin/billing/payments", actions: ["view", "create", "edit", "approve", "export", "manage"] },
      {
        key: "billing_payment_gateways",
        label: "Payment gateways",
        path: "/admin/billing/settings/payments",
        actions: ["view", "edit", "manage"],
      },
      { key: "billing_paid", label: "Paid Students", path: "/admin/billing/paid-students", actions: ["view", "export"] },
      { key: "billing_outstanding", label: "Outstanding", path: "/admin/billing/outstanding", actions: ["view", "export"] },
      { key: "billing_reports", label: "Reports", path: "/admin/billing/reports", actions: ["view", "export", "manage"] },
      {
        key: "billing_family",
        label: "Family Billing",
        path: "/admin/billing/family",
        actions: ["view", "create", "edit", "manage", "export"],
      },
      {
        key: "billing_payroll",
        label: "Payroll",
        path: "/admin/billing/payroll",
        actions: ["view", "create", "edit", "manage", "export"],
      },
      {
        key: "billing_overview",
        label: "Billing Overview",
        path: "/admin/billing",
        actions: ["view", "export"],
      },
    ],
  },
  {
    key: "registration",
    label: "Registration & Linking",
    modules: [
      { key: "number_generator", label: "Number Generator", path: "/admin/number-generator", actions: ["view", "create", "manage"] },
      { key: "pending_users", label: "Pending Approvals", path: "/admin/pending-users", actions: ["view", "approve", "manage"] },
      { key: "parent_student_link", label: "Parent–Student Link", path: "/admin/parent-student-link", actions: ["view", "create", "edit", "delete", "manage"] },
      { key: "teacher_class_link", label: "Teacher–Class Link", path: "/admin/teacher-class-link", actions: ["view", "create", "edit", "delete", "manage"] },
      { key: "parent_contacts", label: "Parent Contacts", path: "/admin/parent-contacts", actions: ["view", "create", "edit", "delete", "export"] },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    modules: [
      { key: "announcements", label: "Announcements", path: "/admin/announcements", actions: ["view", "create", "edit", "delete", "manage"] },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    modules: [
      { key: "school_settings", label: "School Settings", path: "/admin/school-settings", actions: ["view", "edit", "manage"] },
      { key: "staff_access", label: "Permission Management", path: "/admin/roles", actions: ["view", "manage"] },
      { key: "approvals", label: "Approvals", path: "/admin/approvals", actions: ["view", "approve", "manage"] },
      { key: "audit_logs", label: "Audit Logs", path: "/admin/audit-logs", actions: ["view", "export"] },
      { key: "account_settings", label: "Account Settings", path: "/settings", actions: ["view", "edit"] },
    ],
  },
];

export const ALL_PORTAL_MODULES = PORTAL_CATEGORIES.flatMap((c) =>
  c.modules.map((m) => ({ ...m, categoryKey: c.key, categoryLabel: c.label })),
);

export function permissionCode(moduleKey: string, action: PermissionAction): string {
  return `portal.${moduleKey}.${action}`;
}

export function parsePermissionCode(code: string): { moduleKey: string; action: PermissionAction } | null {
  const m = /^portal\.([^.]+)\.([a-z]+)$/.exec(code);
  if (!m) return null;
  const action = m[2] as PermissionAction;
  if (!PERMISSION_ACTIONS.includes(action)) return null;
  return { moduleKey: m[1], action };
}

export function moduleByPath(path: string): PortalModuleDef | undefined {
  const normalized = path.replace(/\/$/, "") || "/admin";
  let best: PortalModuleDef | undefined;
  let bestLen = 0;
  for (const m of ALL_PORTAL_MODULES) {
    const matches =
      normalized === m.path || (m.path !== "/admin" && normalized.startsWith(m.path + "/"));
    if (matches && m.path.length > bestLen) {
      best = m;
      bestLen = m.path.length;
    }
  }
  return best;
}

export function viewPermissionForPath(path: string): string | null {
  const mod = moduleByPath(path);
  if (!mod) return null;
  return permissionCode(mod.key, "view");
}

/** Flat list of all portal permission codes for DB seeding */
export function allPortalPermissionRows(): { module: string; action: string; code: string; description: string; category: string }[] {
  const rows: { module: string; action: string; code: string; description: string; category: string }[] = [];
  for (const cat of PORTAL_CATEGORIES) {
    for (const mod of cat.modules) {
      for (const action of mod.actions) {
        rows.push({
          category: cat.key,
          module: `portal.${mod.key}`,
          action,
          code: permissionCode(mod.key, action),
          description: `${ACTION_LABELS[action]} ${mod.label}`,
        });
      }
    }
  }
  return rows;
}

export const DEFAULT_SYSTEM_ROLES = [
  { slug: "super_admin", name: "Super Admin", description: "Full unrestricted platform access", is_system: true },
  { slug: "school_admin", name: "Admin", description: "School administrator — full school portal", is_system: true },
  { slug: "accountant", name: "Accountant", description: "Financial management modules", is_system: true },
  { slug: "teacher", name: "Teacher", description: "Academic and report modules", is_system: true },
  { slug: "examiner", name: "Examiner", description: "Examinations and results focus", is_system: true },
  { slug: "registrar", name: "Registrar", description: "Students, registration and academics", is_system: true },
  { slug: "auditor", name: "Auditor", description: "Read-only finance and audit", is_system: true },
  { slug: "parent_support", name: "Parent Support", description: "Parent linking and communication", is_system: true },
] as const;

/** Default permission codes per system role slug */
export function defaultCodesForRole(slug: string): string[] {
  const all = allPortalPermissionRows().map((r) => r.code);
  const viewOnly = all.filter((c) => c.endsWith(".view") || c.endsWith(".export"));
  const finance = all.filter((c) => {
    const p = parsePermissionCode(c);
    return p && ["billing_fees", "billing_invoices", "billing_payments", "billing_payment_gateways", "billing_paid", "billing_outstanding", "billing_reports", "dashboard"].includes(p.moduleKey);
  });
  const exams = all.filter((c) => {
    const p = parsePermissionCode(c);
    return p && ["report_cards", "report_archive", "academic_reports", "report_settings", "dashboard"].includes(p.moduleKey);
  });
  const academics = all.filter((c) => {
    const p = parsePermissionCode(c);
    return p && ["students", "classes", "subjects", "timetable", "grade_scales", "teachers", "lesson_notes", "dashboard"].includes(p.moduleKey);
  });
  const registrar = all.filter((c) => {
    const p = parsePermissionCode(c);
    return (
      p &&
      [
        "students",
        "classes",
        "subjects",
        "number_generator",
        "pending_users",
        "parent_student_link",
        "teacher_class_link",
        "parent_contacts",
        "dashboard",
      ].includes(p.moduleKey)
    );
  });
  const parentSupport = all.filter((c) => {
    const p = parsePermissionCode(c);
    return (
      p &&
      ["parent_student_link", "parent_contacts", "announcements", "pending_users", "dashboard"].includes(p.moduleKey)
    );
  });

  switch (slug) {
    case "super_admin":
    case "school_admin":
      return all;
    case "accountant":
      return finance;
    case "teacher":
      return [...academics, ...exams, ...all.filter((c) => c.includes("attendance"))];
    case "examiner":
      return exams;
    case "registrar":
      return registrar;
    case "auditor":
      return [...finance.filter((c) => c.endsWith(".view") || c.endsWith(".export")), ...viewOnly.filter((c) => c.includes("audit"))];
    case "parent_support":
      return parentSupport;
    default:
      return [];
  }
}
