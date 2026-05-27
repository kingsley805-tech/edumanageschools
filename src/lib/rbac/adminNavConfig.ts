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
  Hash,
  UserCheck,
  Link as LinkIcon,
  UserCircle,
  Megaphone,
  Building,
  Shield,
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
  report_cards: FileText,
  report_archive: FileText,
  academic_reports: BarChart3,
  report_settings: Settings,
  attendance: Calendar,
  billing_fees: Wallet,
  billing_invoices: DollarSign,
  billing_payments: FileText,
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

export function buildAdminNav(hasPermission: (code: string) => boolean): (AdminNavItem | AdminNavGroup)[] {
  const result: (AdminNavItem | AdminNavGroup)[] = [];

  for (const category of PORTAL_CATEGORIES) {
    const items: AdminNavItem[] = [];
    for (const mod of category.modules) {
      const viewPerm = permissionCode(mod.key, "view");
      if (!hasPermission(viewPerm)) continue;
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
