import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Clock,
  Award,
  FileText,
  BarChart3,
  Settings,
  Calendar,
  Wallet,
  DollarSign,
  CreditCard,
  Hash,
  UserCheck,
  Link as LinkIcon,
  UserCircle,
  Megaphone,
  Building,
  Shield,
  NotebookPen,
} from "lucide-react";
import { PORTAL_CATEGORIES, permissionCode, type PermissionAction } from "@/lib/rbac/permissionCatalog";

export type AdminNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  viewPermission: string;
};

export type AdminNavGroup = {
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  students: Users,
  teachers: GraduationCap,
  classes: BookOpen,
  subjects: ClipboardList,
  timetable: Clock,
  grade_scales: Award,
  lesson_notes: NotebookPen,
  report_cards: FileText,
  report_archive: FileText,
  academic_reports: BarChart3,
  report_settings: Settings,
  attendance: Calendar,
  billing_fees: Wallet,
  billing_invoices: DollarSign,
  billing_payments: FileText,
  billing_payment_gateways: CreditCard,
  billing_paid: Users,
  billing_outstanding: Users,
  billing_reports: BarChart3,
  number_generator: Hash,
  pending_users: UserCheck,
  parent_student_link: LinkIcon,
  teacher_class_link: BookOpen,
  parent_contacts: UserCircle,
  announcements: Megaphone,
  school_settings: Building,
  staff_access: Shield,
  approvals: FileText,
  audit_logs: FileText,
  account_settings: Settings,
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  academics: BookOpen,
  examinations: FileText,
  attendance: Calendar,
  finance: DollarSign,
  registration: LinkIcon,
  communication: Megaphone,
  administration: Shield,
};

export const PAYMENT_GATEWAYS_NAV_PATH = "/admin/billing/settings/payments";

const PAYMENT_GATEWAYS_NAV_ITEM: AdminNavItem = {
  label: "Payment gateways",
  path: PAYMENT_GATEWAYS_NAV_PATH,
  icon: CreditCard,
  viewPermission: permissionCode("billing_payment_gateways", "view"),
};

const FINANCE_MODULE_KEYS_FOR_GATEWAYS = [
  "billing_payment_gateways",
  "billing_payments",
  "billing_fees",
  "billing_invoices",
  "billing_overview",
] as const;

function canShowPaymentGateways(hasPermission: (code: string) => boolean): boolean {
  return FINANCE_MODULE_KEYS_FOR_GATEWAYS.some((key) =>
    hasPermission(permissionCode(key, "view")),
  );
}

/** Ensures Payment gateways appears under Financial Management when user has any billing access. */
export function ensurePaymentGatewaysInNav(
  nav: (AdminNavItem | AdminNavGroup)[],
): (AdminNavItem | AdminNavGroup)[] {
  return nav.map((entry) => {
    if (!("items" in entry) || entry.label !== "Financial Management") return entry;
    if (entry.items.some((i) => i.path === PAYMENT_GATEWAYS_NAV_PATH)) return entry;

    const items = [...entry.items];
    const paymentsIdx = items.findIndex((i) => i.path === "/admin/billing/payments");
    if (paymentsIdx >= 0) {
      items.splice(paymentsIdx + 1, 0, PAYMENT_GATEWAYS_NAV_ITEM);
    } else {
      items.push(PAYMENT_GATEWAYS_NAV_ITEM);
    }
    return { ...entry, items };
  });
}

export function buildAdminNav(hasPermission: (code: string) => boolean): (AdminNavItem | AdminNavGroup)[] {
  const result: (AdminNavItem | AdminNavGroup)[] = [];

  for (const category of PORTAL_CATEGORIES) {
    const items: AdminNavItem[] = [];
    for (const mod of category.modules) {
      // Teacher-only routes belong in the teacher shell, not the admin sidebar.
      if (!mod.path.startsWith("/admin") && mod.path !== "/settings") continue;
      const viewPerm = permissionCode(mod.key, "view");
      const canView =
        hasPermission(viewPerm) ||
        (mod.key === "billing_payment_gateways" && canShowPaymentGateways(hasPermission));
      if (!canView) continue;
      items.push({
        label: mod.label,
        path: mod.path,
        icon: MODULE_ICONS[mod.key] ?? FileText,
        viewPermission: viewPerm,
      });
    }
    if (items.length === 0) continue;

    if (category.modules.length === 1 && category.key === "dashboard") {
      result.push(items[0]);
      continue;
    }

    result.push({
      label: category.label,
      icon: CATEGORY_ICONS[category.key] ?? FileText,
      items,
    });
  }

  return result;
}

export function canPerform(
  hasPermission: (code: string) => boolean,
  moduleKey: string,
  action: PermissionAction,
): boolean {
  return hasPermission(permissionCode(moduleKey, action));
}
