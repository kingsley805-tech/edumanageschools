export type BackupScope =
  | "school_id"
  | "school_row"
  | "via_profiles"
  | "via_students"
  | "via_classes"
  | "via_teachers"
  | "via_parents"
  | "via_roles"
  | "via_exams"
  | "via_assignments"
  | "via_registers"
  | "via_invoices"
  | "via_payments"
  | "via_billing_accounts"
  | "via_online_exams"
  | "via_report_cards";

export type BackupEntityDef = {
  /** Excel sheet name (max 31 chars) */
  sheet: string;
  table: string;
  /** High-level folder group (Academics, Finance, …) */
  category: string;
  /** Admin sidebar submenu key — one Excel file per module */
  moduleKey: string;
  /** Admin sidebar submenu label used as the Excel file name */
  moduleLabel: string;
  scope: BackupScope;
  /** Optional columns to select; default * */
  select?: string;
  /** Soft-fail if table missing (migrations not applied) */
  optional?: boolean;
};

/**
 * Recoverable school data catalog for system backup.
 * Each `moduleKey` becomes its own Excel file under by_module/{category}/.
 */
export const BACKUP_ENTITIES: BackupEntityDef[] = [
  // —— People / Academics core ——
  { sheet: "Students", table: "students", category: "Academics", moduleKey: "students", moduleLabel: "Students", scope: "school_id" },
  { sheet: "Teachers", table: "teachers", category: "Academics", moduleKey: "teachers", moduleLabel: "Teachers", scope: "school_id" },
  { sheet: "Parents", table: "parents", category: "Academics", moduleKey: "parent_contacts", moduleLabel: "Parent Contacts", scope: "school_id" },
  /** Full profiles live under School Settings — not mixed into Students.xlsx */
  { sheet: "Profiles", table: "profiles", category: "Administration", moduleKey: "school_settings", moduleLabel: "School Settings", scope: "school_id" },
  { sheet: "Parent Student Links", table: "parent_student_links", category: "Academics", moduleKey: "parent_student_link", moduleLabel: "Parent-Student Link", scope: "via_students", optional: true },
  { sheet: "Staff Employees", table: "staff_employees", category: "Administration", moduleKey: "staff_employees", moduleLabel: "Staff", scope: "school_id", optional: true },
  { sheet: "Departments", table: "departments", category: "Administration", moduleKey: "departments", moduleLabel: "Departments", scope: "school_id", optional: true },
  { sheet: "Registration Numbers", table: "registration_numbers", category: "Administration", moduleKey: "number_generator", moduleLabel: "Number Generator", scope: "school_id", optional: true },
  { sheet: "Roles", table: "roles", category: "Administration", moduleKey: "staff_access", moduleLabel: "Permission Management", scope: "school_id", optional: true },
  { sheet: "User Roles", table: "user_roles", category: "Administration", moduleKey: "staff_access", moduleLabel: "Permission Management", scope: "via_profiles", optional: true },
  { sheet: "User Role Assignments", table: "user_role_assignments", category: "Administration", moduleKey: "staff_access", moduleLabel: "Permission Management", scope: "school_id", optional: true },
  { sheet: "Role Permissions", table: "role_permissions", category: "Administration", moduleKey: "staff_access", moduleLabel: "Permission Management", scope: "via_roles", optional: true },

  // —— Academics ——
  { sheet: "Classes", table: "classes", category: "Academics", moduleKey: "classes", moduleLabel: "Classes", scope: "school_id" },
  { sheet: "Subjects", table: "subjects", category: "Academics", moduleKey: "subjects", moduleLabel: "Subjects", scope: "school_id" },
  { sheet: "Class Subjects", table: "class_subjects", category: "Academics", moduleKey: "subjects", moduleLabel: "Subjects", scope: "via_classes", optional: true },
  { sheet: "Enrollments", table: "enrollments", category: "Academics", moduleKey: "classes", moduleLabel: "Classes", scope: "via_classes", optional: true },
  { sheet: "Terms", table: "terms", category: "Academics", moduleKey: "academic_calendar", moduleLabel: "Academic Calendar", scope: "school_id" },
  { sheet: "Academic Years", table: "academic_years", category: "Academics", moduleKey: "academic_calendar", moduleLabel: "Academic Calendar", scope: "school_id", optional: true },
  { sheet: "Exam Types", table: "exam_types", category: "Examinations", moduleKey: "report_cards", moduleLabel: "Report Cards", scope: "school_id", optional: true },
  { sheet: "Grade Scales", table: "grade_scales", category: "Academics", moduleKey: "grade_scales", moduleLabel: "Grade Scales", scope: "school_id", optional: true },
  { sheet: "Class Grading Config", table: "class_grading_config", category: "Academics", moduleKey: "grade_scales", moduleLabel: "Grade Scales", scope: "via_classes", optional: true },
  { sheet: "Exams", table: "exams", category: "Examinations", moduleKey: "report_cards", moduleLabel: "Report Cards", scope: "via_classes", optional: true },
  { sheet: "Exam Results", table: "exam_results", category: "Examinations", moduleKey: "report_cards", moduleLabel: "Report Cards", scope: "via_exams", optional: true },
  { sheet: "Grades", table: "grades", category: "Examinations", moduleKey: "result_scores", moduleLabel: "Enter Scores", scope: "via_students", optional: true },
  { sheet: "Results", table: "results", category: "Examinations", moduleKey: "result_scores", moduleLabel: "Enter Scores", scope: "via_students", optional: true },
  { sheet: "Term Report Cards", table: "term_report_cards", category: "Examinations", moduleKey: "report_cards", moduleLabel: "Report Cards", scope: "school_id", optional: true },
  { sheet: "Report Card Versions", table: "term_report_card_versions", category: "Examinations", moduleKey: "report_archive", moduleLabel: "Report Archive", scope: "via_report_cards", optional: true },
  { sheet: "Assignments", table: "assignments", category: "Academics", moduleKey: "lesson_notes", moduleLabel: "Lesson Notes", scope: "via_classes", optional: true },
  { sheet: "Submissions", table: "submissions", category: "Academics", moduleKey: "lesson_notes", moduleLabel: "Lesson Notes", scope: "via_assignments", optional: true },
  { sheet: "Question Bank", table: "question_bank", category: "Examinations", moduleKey: "report_cards", moduleLabel: "Report Cards", scope: "school_id", optional: true },
  { sheet: "Online Exams", table: "online_exams", category: "Examinations", moduleKey: "report_cards", moduleLabel: "Report Cards", scope: "via_classes", optional: true },
  { sheet: "Online Exam Questions", table: "online_exam_questions", category: "Examinations", moduleKey: "report_cards", moduleLabel: "Report Cards", scope: "via_online_exams", optional: true },
  { sheet: "Online Exam Attempts", table: "online_exam_attempts", category: "Examinations", moduleKey: "report_cards", moduleLabel: "Report Cards", scope: "via_online_exams", optional: true },
  { sheet: "Attendance Records", table: "attendance_records", category: "Attendance", moduleKey: "attendance", moduleLabel: "Student Attendance", scope: "school_id", optional: true },
  { sheet: "Attendance Summaries", table: "attendance_summaries", category: "Attendance", moduleKey: "attendance", moduleLabel: "Student Attendance", scope: "school_id", optional: true },
  { sheet: "Attendance Status Types", table: "attendance_status_types", category: "Attendance", moduleKey: "attendance", moduleLabel: "Student Attendance", scope: "school_id", optional: true },
  { sheet: "Class Registers", table: "class_registers", category: "Attendance", moduleKey: "class_registers", moduleLabel: "Class Registers", scope: "school_id", optional: true },
  { sheet: "Register Student Entries", table: "register_student_entries", category: "Attendance", moduleKey: "class_registers", moduleLabel: "Class Registers", scope: "via_registers", optional: true },
  { sheet: "Lesson Notes", table: "lesson_notes", category: "Academics", moduleKey: "lesson_notes", moduleLabel: "Lesson Notes", scope: "school_id", optional: true },
  { sheet: "Timetable Settings", table: "timetable_settings", category: "Academics", moduleKey: "timetable", moduleLabel: "Timetable", scope: "school_id", optional: true },
  { sheet: "Timetable Periods", table: "timetable_periods", category: "Academics", moduleKey: "timetable", moduleLabel: "Timetable", scope: "school_id", optional: true },
  { sheet: "Timetable Versions", table: "timetable_versions", category: "Academics", moduleKey: "timetable", moduleLabel: "Timetable", scope: "school_id", optional: true },
  { sheet: "Schedules", table: "schedules", category: "Academics", moduleKey: "timetable", moduleLabel: "Timetable", scope: "school_id", optional: true },
  { sheet: "Academic Recommendations", table: "academic_recommendations", category: "Academics", moduleKey: "student_performance", moduleLabel: "Performance Dashboard", scope: "school_id", optional: true },
  { sheet: "Academic Alerts", table: "academic_alerts", category: "Academics", moduleKey: "student_performance", moduleLabel: "Performance Dashboard", scope: "school_id", optional: true },
  { sheet: "Achievements", table: "achievements", category: "Academics", moduleKey: "achievements", moduleLabel: "Achievements", scope: "school_id", optional: true },
  { sheet: "Academic Programs", table: "academic_programs", category: "Academics", moduleKey: "programs", moduleLabel: "Programs", scope: "school_id", optional: true },
  { sheet: "Program Enrollments", table: "academic_program_enrollments", category: "Academics", moduleKey: "programs", moduleLabel: "Programs", scope: "school_id", optional: true },
  { sheet: "Program Class Assignments", table: "academic_program_class_assignments", category: "Academics", moduleKey: "programs", moduleLabel: "Programs", scope: "school_id", optional: true },

  // —— School ——
  { sheet: "Schools", table: "schools", category: "Administration", moduleKey: "school_settings", moduleLabel: "School Settings", scope: "school_row" },
  { sheet: "School Settings", table: "school_settings", category: "Administration", moduleKey: "school_settings", moduleLabel: "School Settings", scope: "school_id", optional: true },
  { sheet: "School Module Entitlements", table: "school_module_entitlements", category: "Administration", moduleKey: "organization_subscription", moduleLabel: "Subscription", scope: "school_id", optional: true },
  { sheet: "School Subscriptions", table: "school_subscriptions", category: "Administration", moduleKey: "organization_subscription", moduleLabel: "Subscription", scope: "school_id", optional: true },

  // —— Finance ——
  { sheet: "Fee Categories", table: "fee_categories", category: "Finance", moduleKey: "billing_fees", moduleLabel: "Fees", scope: "school_id", optional: true },
  { sheet: "Fee Items", table: "fee_items", category: "Finance", moduleKey: "billing_fees", moduleLabel: "Fees", scope: "school_id", optional: true },
  { sheet: "Fee Templates", table: "fee_templates", category: "Finance", moduleKey: "billing_fees", moduleLabel: "Fees", scope: "school_id", optional: true },
  { sheet: "Fee Assignments", table: "fee_assignments", category: "Finance", moduleKey: "billing_fees", moduleLabel: "Fees", scope: "school_id", optional: true },
  { sheet: "Billing Accounts", table: "billing_accounts", category: "Finance", moduleKey: "billing_family", moduleLabel: "Family Billing", scope: "school_id", optional: true },
  { sheet: "Billing Account Students", table: "billing_account_students", category: "Finance", moduleKey: "billing_family", moduleLabel: "Family Billing", scope: "via_billing_accounts", optional: true },
  { sheet: "Billing Invoices", table: "billing_invoices", category: "Finance", moduleKey: "billing_invoices", moduleLabel: "Invoices", scope: "school_id", optional: true },
  { sheet: "Billing Invoice Lines", table: "billing_invoice_line_items", category: "Finance", moduleKey: "billing_invoices", moduleLabel: "Invoices", scope: "via_invoices", optional: true },
  { sheet: "Billing Payments", table: "billing_payments", category: "Finance", moduleKey: "billing_payments", moduleLabel: "Payments", scope: "school_id", optional: true },
  { sheet: "Payment Allocations", table: "payment_allocations", category: "Finance", moduleKey: "billing_payments", moduleLabel: "Payments", scope: "via_payments", optional: true },
  { sheet: "Account Invoices", table: "account_invoices", category: "Finance", moduleKey: "billing_invoices", moduleLabel: "Invoices", scope: "school_id", optional: true },
  { sheet: "Account Payments", table: "account_payments", category: "Finance", moduleKey: "billing_payments", moduleLabel: "Payments", scope: "school_id", optional: true },
  { sheet: "Finance Expenses", table: "finance_expenses", category: "Finance", moduleKey: "finance_expenses", moduleLabel: "Expenses", scope: "school_id", optional: true },
  { sheet: "Finance Other Income", table: "finance_other_income", category: "Finance", moduleKey: "finance_other_income", moduleLabel: "Other Income", scope: "school_id", optional: true },
  { sheet: "Finance Budgets", table: "finance_budgets", category: "Finance", moduleKey: "finance_budgets", moduleLabel: "Budget Management", scope: "school_id", optional: true },
  { sheet: "Staff Salaries", table: "staff_salaries", category: "HR", moduleKey: "billing_payroll", moduleLabel: "Payroll", scope: "school_id", optional: true },
  { sheet: "Org Sub Payments", table: "organization_subscription_payments", category: "Administration", moduleKey: "organization_subscription", moduleLabel: "Subscription", scope: "school_id", optional: true },
  { sheet: "Payment Gateways", table: "tenant_payment_gateway_configs", category: "Finance", moduleKey: "billing_payment_gateways", moduleLabel: "Payment gateways", scope: "school_id", optional: true },

  // —— Communication ——
  { sheet: "Announcements", table: "announcements", category: "Communication", moduleKey: "announcements", moduleLabel: "Announcements", scope: "school_id", optional: true },
  { sheet: "SMS Logs", table: "sms_logs", category: "Communication", moduleKey: "announcements", moduleLabel: "Announcements", scope: "school_id", optional: true },
  { sheet: "Messages", table: "messages", category: "Communication", moduleKey: "announcements", moduleLabel: "Announcements", scope: "via_profiles", optional: true },
  { sheet: "Notifications", table: "notifications", category: "Communication", moduleKey: "announcements", moduleLabel: "Announcements", scope: "via_profiles", optional: true },
  { sheet: "Live Classes", table: "live_classes", category: "Academics", moduleKey: "live_classes", moduleLabel: "Online Learning", scope: "school_id", optional: true },
  { sheet: "Daily School Summaries", table: "daily_school_summaries", category: "Communication", moduleKey: "announcements", moduleLabel: "Announcements", scope: "school_id", optional: true },

  // —— Ops modules ——
  { sheet: "Hostel Blocks", table: "hostel_blocks", category: "Hostel", moduleKey: "hostel", moduleLabel: "Hostel", scope: "school_id", optional: true },
  { sheet: "Hostel Rooms", table: "hostel_rooms", category: "Hostel", moduleKey: "hostel", moduleLabel: "Hostel", scope: "school_id", optional: true },
  { sheet: "Hostel Allocations", table: "hostel_allocations", category: "Hostel", moduleKey: "hostel", moduleLabel: "Hostel", scope: "school_id", optional: true },
  { sheet: "Inventory Items", table: "inventory_items", category: "Resources", moduleKey: "inventory", moduleLabel: "Inventory", scope: "school_id", optional: true },
  { sheet: "Inventory Assets", table: "inventory_assets", category: "Resources", moduleKey: "inventory", moduleLabel: "Inventory", scope: "school_id", optional: true },
  { sheet: "Transport Routes", table: "transport_routes", category: "Transport", moduleKey: "transport", moduleLabel: "Transport", scope: "school_id", optional: true },
  { sheet: "Transport Buses", table: "transport_buses", category: "Transport", moduleKey: "transport", moduleLabel: "Transport", scope: "school_id", optional: true },
  { sheet: "Library Books", table: "library_books", category: "Library", moduleKey: "library_management", moduleLabel: "Library Management", scope: "school_id", optional: true },
  { sheet: "Shop Products", table: "shop_products", category: "Resources", moduleKey: "school_shop", moduleLabel: "School Shop", scope: "school_id", optional: true },
  { sheet: "Shop Orders", table: "shop_orders", category: "Resources", moduleKey: "school_shop", moduleLabel: "School Shop", scope: "school_id", optional: true },
  { sheet: "Calendar Events", table: "calendar_events", category: "Administration", moduleKey: "academic_calendar", moduleLabel: "Academic Calendar", scope: "school_id", optional: true },
  { sheet: "Behavior Reports", table: "behavior_reports", category: "Domestics", moduleKey: "behavior_reports", moduleLabel: "Behavior Reports", scope: "school_id", optional: true },
  { sheet: "Exeats", table: "exeats", category: "Domestics", moduleKey: "exeats", moduleLabel: "Exeats", scope: "school_id", optional: true },
  { sheet: "Student Health", table: "student_health_profiles", category: "Health", moduleKey: "student_health", moduleLabel: "Student Health", scope: "school_id", optional: true },

  // —— System ——
  { sheet: "Approval Requests", table: "approval_requests", category: "Administration", moduleKey: "approvals", moduleLabel: "Approvals", scope: "school_id", optional: true },
  { sheet: "Audit Logs", table: "audit_logs", category: "Administration", moduleKey: "audit_logs", moduleLabel: "Audit Logs", scope: "school_id", optional: true },
  { sheet: "Login Activity", table: "login_activity", category: "Administration", moduleKey: "audit_logs", moduleLabel: "Audit Logs", scope: "school_id", optional: true },
  { sheet: "Permission Logs", table: "permission_logs", category: "Administration", moduleKey: "staff_access", moduleLabel: "Permission Management", scope: "school_id", optional: true },
  { sheet: "User Signatures", table: "user_signatures", category: "Administration", moduleKey: "school_settings", moduleLabel: "School Settings", scope: "school_id", optional: true },
  { sheet: "WhatsApp Deliveries", table: "whatsapp_deliveries", category: "Communication", moduleKey: "whatsapp", moduleLabel: "WhatsApp", scope: "school_id", optional: true },
  { sheet: "Weekly Attention", table: "weekly_attention_reports", category: "Academics", moduleKey: "weekly_attention", moduleLabel: "Weekly Attention", scope: "school_id", optional: true },
];

/** Display order for Excel tabs within a category (lower = earlier). */
export const SHEET_TAB_PRIORITY: Record<string, number> = {
  students: 1,
  teachers: 2,
  parents: 3,
  profiles: 4,
  parent_student_links: 5,
  classes: 10,
  subjects: 11,
  class_subjects: 12,
  enrollments: 13,
  terms: 14,
  academic_years: 15,
  schools: 50,
};

export const CATEGORY_FILE_ORDER = [
  "Academics",
  "Examinations",
  "Attendance",
  "Finance",
  "HR",
  "Domestics",
  "Health",
  "Library",
  "Transport",
  "Hostel",
  "Resources",
  "Communication",
  "Administration",
  "People",
  "School",
  "Operations",
  "System",
] as const;

export const BACKUP_VERSION = "1.2.0";
export const BACKUP_BUCKET = "system-backups";
export const PAGE_SIZE = 1000;

/** Safe Excel / folder segment from a module label. */
export function sanitizeModuleFileName(label: string): string {
  const cleaned = label
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 80) || "Module";
}
