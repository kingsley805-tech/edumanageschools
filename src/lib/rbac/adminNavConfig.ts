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
  CreditCard as SubscriptionIcon,
  Video,
  BrainCircuit,
  Briefcase,
  CalendarOff,
  ClipboardCheck,
  Library,
  Bus,
  BedDouble,
  Package,
  Trophy,
  BookMarked,
  TrendingUp,
  Building2,
  CalendarDays,
  IdCard,
  ShieldAlert,
  DoorOpen,
  HeartPulse,
  Receipt,
  PiggyBank,
  CircleDollarSign,
  ShoppingBag,
  FlaskConical,
  PhoneCall,
  HardDrive,
  MessageCircle,
  Banknote,
} from "lucide-react";
import { PORTAL_CATEGORIES, permissionCode, type PermissionAction } from "@/lib/rbac/permissionCatalog";

export type AdminNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  viewPermission: string;
  showBadge?: boolean;
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
  live_classes: Video,
  grade_scales: Award,
  lesson_notes: NotebookPen,
  achievements: Trophy,
  programs: BookMarked,
  student_performance: TrendingUp,
  staff_employees: IdCard,
  departments: Building2,
  academic_calendar: CalendarDays,
  behavior_reports: ShieldAlert,
  exeats: DoorOpen,
  student_health: HeartPulse,
  finance_expenses: Receipt,
  finance_other_income: CircleDollarSign,
  finance_budgets: PiggyBank,
  school_shop: ShoppingBag,
  laboratory: FlaskConical,
  report_cards: FileText,
  report_archive: FileText,
  academic_reports: BarChart3,
  report_settings: Settings,
  class_registers: ClipboardList,
  attendance: Calendar,
  billing_fees: Wallet,
  billing_invoices: DollarSign,
  billing_payments: FileText,
  billing_manual_payments: Banknote,
  billing_pos_terminal: Banknote,
  billing_payment_gateways: CreditCard,
  billing_paid: Users,
  billing_outstanding: Users,
  billing_reports: BarChart3,
  billing_payroll: Wallet,
  staff_management: Briefcase,
  leave_management: CalendarOff,
  staff_attendance: ClipboardCheck,
  library_management: Library,
  transport: Bus,
  hostel: BedDouble,
  inventory: Package,
  number_generator: Hash,
  pending_users: UserCheck,
  parent_student_link: LinkIcon,
  teacher_class_link: BookOpen,
  parent_contacts: UserCircle,
  announcements: Megaphone,
  ai_assistant: BrainCircuit,
  ai_receptionist: PhoneCall,
  school_settings: Building,
  administration_settings: Settings,
  system_backup: HardDrive,
  weekly_attention: ClipboardCheck,
  whatsapp: MessageCircle,
  staff_access: Shield,
  approvals: FileText,
  audit_logs: FileText,
  organization_subscription: SubscriptionIcon,
  account_settings: Settings,
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  academics: BookOpen,
  examinations: FileText,
  class_registers: ClipboardList,
  attendance: Calendar,
  finance: DollarSign,
  hr: Briefcase,
  domestics: ShieldAlert,
  health: HeartPulse,
  resources: Package,
  library: Library,
  transport: Bus,
  hostel: BedDouble,
  inventory: Package,
  registration: LinkIcon,
  communication: Megaphone,
  administration: Shield,
  system_backup: HardDrive,
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

const CLASS_TEACHER_ACTIVITY_PATH = "/admin/class-teacher-activity";
const CLASS_TEACHER_ACTIVITY_ITEM: AdminNavItem = {
  label: "Class Teacher Activity",
  path: CLASS_TEACHER_ACTIVITY_PATH,
  icon: UserCheck,
  viewPermission: permissionCode("audit_logs", "view"),
};

/** Always shows the Class Teacher activity link inside the Administration group for admins. */
export function ensureClassTeacherActivityInNav(
  nav: (AdminNavItem | AdminNavGroup)[],
): (AdminNavItem | AdminNavGroup)[] {
  let inserted = false;
  const next = nav.map((entry) => {
    if (!("items" in entry)) return entry;
    if (entry.items.some((i) => i.path === CLASS_TEACHER_ACTIVITY_PATH)) {
      inserted = true;
      return entry;
    }
    if (entry.label === "Administration") {
      inserted = true;
      return { ...entry, items: [...entry.items, CLASS_TEACHER_ACTIVITY_ITEM] };
    }
    return entry;
  });
  if (!inserted) {
    next.push({ label: "Administration", icon: Shield, items: [CLASS_TEACHER_ACTIVITY_ITEM] });
  }
  return next;
}

const SYSTEM_BACKUP_PATH = "/admin/system-backup";
const SYSTEM_BACKUP_ITEM: AdminNavItem = {
  label: "System Backup",
  path: SYSTEM_BACKUP_PATH,
  icon: HardDrive,
  viewPermission: permissionCode("system_backup", "view"),
};

/** Ensures System Backup appears as its own sidebar module (not nested under Administration). */
export function ensureSystemBackupInNav(
  nav: (AdminNavItem | AdminNavGroup)[],
): (AdminNavItem | AdminNavGroup)[] {
  const alreadyStandalone = nav.some(
    (entry) => !("items" in entry) && entry.path === SYSTEM_BACKUP_PATH,
  );
  if (alreadyStandalone) return nav;

  const withoutNested = nav
    .map((entry) => {
      if (!("items" in entry)) return entry;
      const items = entry.items.filter((i) => i.path !== SYSTEM_BACKUP_PATH);
      if (items.length === entry.items.length) return entry;
      if (items.length === 0) return null;
      return { ...entry, items };
    })
    .filter((entry): entry is AdminNavItem | AdminNavGroup => entry != null);

  return [...withoutNested, SYSTEM_BACKUP_ITEM];
}

export function buildAdminNav(hasPermission: (code: string) => boolean): (AdminNavItem | AdminNavGroup)[] {
  const result: (AdminNavItem | AdminNavGroup)[] = [];

  for (const category of PORTAL_CATEGORIES) {
    const items: AdminNavItem[] = [];
    for (const mod of category.modules) {
      // Teacher-only routes belong in the teacher shell, not the admin sidebar.
      if (!mod.path.startsWith("/admin") && mod.path !== "/settings" && mod.path !== "/ai-assistant") continue;
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

    // Categories with a single module render as a direct link instead of a
    // one-item accordion (e.g. Library, Health, Transport, Hostel, Inventory).
    if (category.modules.length === 1) {
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
