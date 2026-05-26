/** Permission codes — must match `permissions.code` in database seeds */

export const PERMISSIONS = {
  students: {
    create: "students.create",
    edit: "students.edit",
    delete: "students.delete",
    archive: "students.archive",
    transfer: "students.transfer",
    import: "students.import",
  },
  parents: { manage: "parents.manage" },
  teachers: { manage: "teachers.manage" },
  invoices: {
    view: "invoices.view",
    create: "invoices.create",
    edit: "invoices.edit",
    delete: "invoices.delete",
    approve: "invoices.approve",
    generateBulk: "invoices.generate_bulk",
  },
  payments: {
    view: "payments.view",
    process: "payments.process",
    allocate: "payments.allocate",
    reverse: "payments.reverse",
    approveRefund: "payments.approve_refund",
  },
  billing: {
    discount: "billing.apply_discount",
    waiver: "billing.apply_waiver",
    feeTemplates: "billing.manage_fee_templates",
    feeCategories: "billing.manage_fee_categories",
  },
  reports: {
    viewFinancial: "reports.view_financial",
    exportFinancial: "reports.export_financial",
    viewAcademic: "reports.view_academic",
    create: "reports.create",
    edit: "reports.edit",
    approve: "reports.approve",
    publish: "reports.publish",
    publishBulk: "reports.publish_bulk",
  },
  admin: {
    createAdmin: "admin.create_admin",
    suspendAdmin: "admin.suspend_admin",
    manageRoles: "admin.manage_roles",
    managePermissions: "admin.manage_permissions",
    viewAudit: "admin.view_audit",
    approveRequests: "admin.approve_requests",
  },
  platform: {
    manageSchools: "platform.manage_schools",
    manageSubscriptions: "platform.manage_subscriptions",
    systemConfig: "platform.system_config",
    integrations: "platform.manage_integrations",
    backups: "platform.manage_backups",
  },
  school: {
    settings: "school.manage_settings",
    grading: "school.manage_grading",
    analytics: "school.view_analytics",
  },
  fees: { viewStatus: "fees.view_status" },
} as const;

export type PermissionCode = string;

export const PORTAL_ROLE_ROUTES: Record<string, string> = {
  super_admin: "/admin",
  admin: "/admin",
  accountant: "/accountant",
  auditor: "/auditor",
  teacher: "/teacher",
  parent: "/parent",
  student: "/student",
};

/** Portal roles that use the admin shell layout */
export const ADMIN_SHELL_ROLES = ["admin", "super_admin", "accountant", "auditor"] as const;
