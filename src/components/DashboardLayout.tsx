// @ts-nocheck
import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  DollarSign,
  LogOut,
  ChevronDown,
  Copy,
  Check,
  UserCircle,
  FileText,
  Award,
  Settings,
  Clock,
  Megaphone,
  MonitorPlay,
  MessageSquare,
  Shield,
  Building,
  Hash,
  UserCheck,
  Link as LinkIcon,
  ClipboardList,
  BarChart3,
  Wallet,
  UserCog,
  PenLine,
  CreditCard,
  Moon,
  Sun,
  Video,
  BrainCircuit,
  Activity,
  ShoppingBag,
  Trophy,
  BookMarked,
  ClipboardCheck,
} from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { useTeacherAccountGuard } from "@/hooks/useTeacherAccountGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { SchoolSwitcher } from "./SchoolSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PortalTopNav } from "@/components/layout/PortalTopNav";
import { PortalMobileNav } from "@/components/layout/PortalMobileNav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ensurePaymentGatewaysInNav,
  ensureClassTeacherActivityInNav,
  ensureSystemBackupInNav,
} from "@/lib/rbac/adminNavConfig";
import { usePortalAccess } from "@/hooks/usePortalAccess";
import { ADMIN_SHELL_ROLES } from "@/lib/rbac/routeGuards";
import { toast } from "sonner";
import { ParentAdmissionNav } from "@/components/parent/ParentAdmissionNav";
import SubscriptionExpiryBanner from "@/subscription/components/SubscriptionExpiryBanner";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import { useTheme } from "@/contexts/ThemeContext";
import { PORTAL_ROLE_META } from "@/lib/portalNavStyles";
import { Ki } from "@/metronic/KiIcon";
import { MetronicSidebarMenu } from "@/components/layout/MetronicSidebarMenu";
import type { AdminNavGroup, AdminNavItem } from "@/lib/rbac/adminNavConfig";
import { AiFloatingButton } from "@/ai-assistant/components/AiFloatingButton";

const PORTAL_LABELS: Record<string, string> = {
  admin: "School Admin portal",
  super_admin: "School Admin portal",
  teacher: "Teacher portal",
  parent: "Parent portal",
  student: "Student portal",
  accountant: "Finance portal",
  auditor: "Auditor portal",
};

type MenuLinkDef = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  permission?: string;
  showBadge?: boolean;
};

type MenuItemDef =
  | MenuLinkDef
  | { type: "group"; label: string; icon: typeof Users; items: MenuLinkDef[] };

type PortalRole =
  | "admin"
  | "teacher"
  | "parent"
  | "student"
  | "super_admin"
  | "accountant"
  | "auditor";

interface DashboardLayoutProps {
  children: ReactNode;
  /** Optional — falls back to the signed-in user's role when omitted. */
  role?: PortalRole;
  hideSidebar?: boolean;
}

function navMatchesQuery(label: string | undefined, query: string) {
  if (!label) return false;
  return label.toLowerCase().includes(query);
}

function filterDynamicNav(
  items: (AdminNavItem | AdminNavGroup)[],
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items
    .map((item) => {
      if ("items" in item) {
        const childMatches = item.items.filter((sub) =>
          navMatchesQuery(sub.label, q),
        );
        if (childMatches.length) return { ...item, items: childMatches };
        if (navMatchesQuery(item.label, q)) return item;
        return null;
      }
      return navMatchesQuery(item.label, q) ? item : null;
    })
    .filter(Boolean) as (AdminNavItem | AdminNavGroup)[];
}

/** Convert static role menus into the admin sidebar format */
function menuItemsToAdminNav(
  items: MenuItemDef[],
): (AdminNavItem | AdminNavGroup)[] {
  return items.map((item) => {
    if (item.type === "group") {
      return {
        label: item.label,
        icon: item.icon,
        items: item.items.map((sub) => ({
          label: sub.label,
          path: sub.path,
          icon: sub.icon,
          viewPermission: sub.permission ?? "",
          showBadge: sub.showBadge,
        })),
      };
    }
    return {
      label: item.label,
      path: item.path,
      icon: item.icon,
      viewPermission: item.permission ?? "",
      showBadge: item.showBadge,
    };
  });
}

const DashboardLayout = ({
  children,
  role: roleProp,
  hideSidebar = false,
}: DashboardLayoutProps) => {
  const { signOut, user } = useAuth();
  const [navQuery, setNavQuery] = useState("");
  const [schoolCodeCopied, setSchoolCodeCopied] = useState(false);
  const unreadMessages = useUnreadMessages();
  const { currentSchool } = useSchoolInfo();
  const { role: userRole } = useUserRole();
  const { hasPermission, isSuperAdmin: isSuperAdminPerm } = usePermissions();
  const isSuperAdmin = userRole === "super_admin" || isSuperAdminPerm;
  // Fall back to the signed-in user's role when the prop is omitted.
  const role = (roleProp ?? userRole ?? "admin") as PortalRole;
  const { navItems: dynamicNavItems } = usePortalAccess();
  const { access: subscriptionAccess } = useOrganizationSubscription();
  const { toggleTheme, isDark } = useTheme();
  useTeacherAccountGuard();

  /* ── Metronic shell state ─────────────────────────────────────────── */
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  // Mirrors the demo's data-kt-sticky: the header gains a bottom border once
  // the page scrolls (the wrapper is the scroll container, not the window).
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onScroll = () => setHeaderScrolled(el.scrollTop > 0);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Close floating panels whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setUserMenuOpen(false);
    setThemeMenuOpen(false);
  }, [location.pathname]);

  // Close the user menu on outside click / Escape.
  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  // Close the theme menu on outside click / Escape.
  useEffect(() => {
    if (!themeMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setThemeMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [themeMenuOpen]);
  // Global search shortcut (Ctrl+K / Cmd+K) and Escape handler
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (event.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const usesDynamicAdminNav = (ADMIN_SHELL_ROLES as readonly string[]).includes(
    role,
  );

  const canShow = (permission?: string) =>
    !permission || isSuperAdmin || hasPermission(permission);

  const filterMenu = (items: MenuItemDef[]): MenuItemDef[] =>
    items
      .map((item) => {
        if (item.type === "group") {
          const filtered = item.items.filter((sub) => canShow(sub.permission));
          return filtered.length ? { ...item, items: filtered } : null;
        }
        return canShow(item.permission) ? item : null;
      })
      .filter(Boolean) as MenuItemDef[];

  const roleConfig = {
    admin: {
      title: "Admin",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
        {
          type: "group",
          label: "Academics",
          icon: BookOpen,
          items: [
            { icon: Users, label: "Students", path: "/admin/students" },
            { icon: GraduationCap, label: "Teachers", path: "/admin/teachers" },
            { icon: BookOpen, label: "Classes", path: "/admin/classes" },
            { icon: ClipboardList, label: "Subjects", path: "/admin/subjects" },
            { icon: Clock, label: "Timetable", path: "/admin/timetable" },
            {
              icon: Video,
              label: "Online Learning",
              path: "/admin/online-learning",
            },
            {
              icon: FileText,
              label: "Lesson Notes",
              path: "/admin/lesson-notes",
            },
            { icon: Award, label: "Grade Scales", path: "/admin/grade-scales" },
          ],
        },
        {
          type: "group",
          label: "Examinations & Results",
          icon: FileText,
          items: [
            {
              icon: FileText,
              label: "Report Cards",
              path: "/admin/report-cards",
            },
            {
              icon: FileText,
              label: "Report Archive",
              path: "/admin/report-cards/archive",
            },
            { icon: BarChart3, label: "Reports", path: "/admin/reports" },
            { icon: BarChart3, label: "Daily Summary", path: "/admin/daily-summary" },
            { icon: Activity, label: "Statistics", path: "/admin/stats" },
            {
              icon: Settings,
              label: "Report Settings",
              path: "/admin/report-settings",
            },
            {
              icon: GraduationCap,
              label: "WAEC Question Bank",
              path: "/admin/waec",
            },
          ],
        },
        {
          type: "group",
          label: "Attendance",
          icon: Calendar,
          items: [
            {
              icon: ClipboardList,
              label: "Class Registers",
              path: "/admin/register",
            },
            {
              icon: Calendar,
              label: "Student Attendance",
              path: "/admin/attendance",
            },
          ],
        },
        {
          type: "group",
          label: "Financial Management",
          icon: DollarSign,
          items: [
            {
              icon: LayoutDashboard,
              label: "Billing overview",
              path: "/admin/billing",
            },
            { icon: Wallet, label: "Fees", path: "/admin/billing/fees" },
            {
              icon: DollarSign,
              label: "Invoices",
              path: "/admin/billing/invoices",
            },
            {
              icon: FileText,
              label: "Payments",
              path: "/admin/billing/payments",
            },
            {
              icon: CreditCard,
              label: "Payment gateways",
              path: "/admin/billing/settings/payments",
            },
            {
              icon: Users,
              label: "Paid Students",
              path: "/admin/billing/paid-students",
            },
            {
              icon: Users,
              label: "Outstanding",
              path: "/admin/billing/outstanding",
            },
            {
              icon: BarChart3,
              label: "Billing Reports",
              path: "/admin/billing/reports",
            },
            {
              icon: Users,
              label: "Family Billing",
              path: "/admin/billing/family",
            },
            { icon: Wallet, label: "Payroll", path: "/admin/billing/payroll" },
            {
              icon: Settings,
              label: "Billing settings",
              path: "/admin/billing/settings",
            },
          ],
        },
        {
          type: "group",
          label: "Registration & Linking",
          icon: LinkIcon,
          items: [
            {
              icon: Hash,
              label: "Number Generator",
              path: "/admin/number-generator",
            },
            {
              icon: UserCheck,
              label: "Pending Approvals",
              path: "/admin/pending-users",
            },
            {
              icon: Users,
              label: "Parent–Student Link",
              path: "/admin/parent-student-link",
            },
            {
              icon: BookOpen,
              label: "Teacher–Class Link",
              path: "/admin/teacher-class-link",
            },
            {
              icon: UserCircle,
              label: "Parent Contacts",
              path: "/admin/parent-contacts",
            },
          ],
        },
        {
          type: "group",
          label: "Communication",
          icon: Megaphone,
          items: [
            {
              icon: Megaphone,
              label: "Announcements",
              path: "/admin/announcements",
            },
            {
              icon: BrainCircuit,
              label: "EduManage AI",
              path: "/ai-assistant",
            },
          ],
        },
        {
          type: "group",
          label: "Administration",
          icon: UserCog,
          items: [
            {
              icon: Building,
              label: "Settings",
              path: "/admin/settings",
            },
            {
              icon: Shield,
              label: "Permission Management",
              path: "/admin/roles",
              permission: "portal.staff_access.view",
            },
            {
              icon: FileText,
              label: "Approvals",
              path: "/admin/approvals",
              permission: PERMISSIONS.admin.approveRequests,
            },
            {
              icon: FileText,
              label: "Audit Logs",
              path: "/admin/audit-logs",
              permission: PERMISSIONS.admin.viewAudit,
            },
            {
              icon: Shield,
              label: "Student Password Recovery",
              path: "/admin/student-password-recovery",
            },
            ...(isSuperAdmin
              ? [
                  {
                    icon: Building,
                    label: "Platform Control",
                    path: "/platform",
                  },
                ]
              : []),
            { icon: Settings, label: "Account Settings", path: "/settings" },
          ],
        },
      ] as MenuItemDef[],
    },
    accountant: {
      title: "Accountant",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/accountant" },
        {
          type: "group",
          label: "Billing",
          icon: DollarSign,
          items: [
            {
              icon: LayoutDashboard,
              label: "Billing overview",
              path: "/admin/billing",
              permission: PERMISSIONS.invoices.view,
            },
            {
              icon: Wallet,
              label: "Fees",
              path: "/admin/billing/fees",
              permission: PERMISSIONS.billing.feeTemplates,
            },
            {
              icon: DollarSign,
              label: "Invoices",
              path: "/admin/billing/invoices",
              permission: PERMISSIONS.invoices.view,
            },
            {
              icon: FileText,
              label: "Payments",
              path: "/admin/billing/payments",
              permission: PERMISSIONS.payments.view,
            },
            {
              icon: CreditCard,
              label: "Payment gateways",
              path: "/admin/billing/settings/payments",
              permission: PERMISSIONS.payments.view,
            },
            {
              icon: Users,
              label: "Paid Students",
              path: "/admin/billing/paid-students",
              permission: PERMISSIONS.fees.viewStatus,
            },
            {
              icon: Users,
              label: "Outstanding",
              path: "/admin/billing/outstanding",
              permission: PERMISSIONS.invoices.view,
            },
            {
              icon: BarChart3,
              label: "Billing Reports",
              path: "/admin/billing/reports",
              permission: PERMISSIONS.reports.viewFinancial,
            },
            {
              icon: Users,
              label: "Family Billing",
              path: "/admin/billing/family",
            },
            {
              icon: Wallet,
              label: "Payroll",
              path: "/admin/billing/payroll",
              permission: PERMISSIONS.payroll.view,
            },
          ],
        },
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [
            {
              icon: BrainCircuit,
              label: "EduManage AI",
              path: "/ai-assistant",
            },
            { icon: Settings, label: "Settings", path: "/settings" },
          ],
        },
      ] as MenuItemDef[],
    },
    auditor: {
      title: "Auditor",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/auditor" },
        {
          type: "group",
          label: "Finance",
          icon: DollarSign,
          items: [
            {
              icon: DollarSign,
              label: "Invoices",
              path: "/admin/billing/invoices",
              permission: PERMISSIONS.invoices.view,
            },
            {
              icon: BarChart3,
              label: "Billing Reports",
              path: "/admin/billing/reports",
              permission: PERMISSIONS.reports.viewFinancial,
            },
            {
              icon: BarChart3,
              label: "Academic Reports",
              path: "/admin/reports",
              permission: PERMISSIONS.reports.viewAcademic,
            },
            {
              icon: FileText,
              label: "Audit Logs",
              path: "/admin/audit-logs",
              permission: PERMISSIONS.admin.viewAudit,
            },
          ],
        },
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [
            {
              icon: BrainCircuit,
              label: "EduManage AI",
              path: "/ai-assistant",
            },
            { icon: Settings, label: "Settings", path: "/settings" },
          ],
        },
      ] as MenuItemDef[],
    },
    teacher: {
      title: "Teacher",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/teacher" },
        {
          type: "group",
          label: "Academics",
          icon: BookOpen,
          items: [
            { icon: BookOpen, label: "My Classes", path: "/teacher/classes" },
            {
              icon: UserCheck,
              label: "My Class (Class Teacher)",
              path: "/teacher/my-class",
            },
            { icon: Clock, label: "Timetable", path: "/teacher/timetable" },
            {
              icon: Video,
              label: "Live Classes",
              path: "/teacher/live-classes",
            },
            {
              icon: ClipboardList,
              label: "Class Registers",
              path: "/teacher/register",
            },
            {
              icon: Calendar,
              label: "Attendance",
              path: "/teacher/attendance",
            },
            {
              icon: FileText,
              label: "Assignments",
              path: "/teacher/assignments",
            },
            { icon: Award, label: "Grades", path: "/teacher/grades" },
            { icon: BookOpen, label: "Resources", path: "/teacher/resources" },
            {
              icon: FileText,
              label: "Lesson notes",
              path: "/teacher/lesson-notes",
            },
            {
              icon: BookMarked,
              label: "Programs",
              path: "/teacher/programs",
            },
          ],
        },
        {
          type: "group",
          label: "Examinations & Results",
          icon: MonitorPlay,
          items: [
            { icon: FileText, label: "Exams", path: "/teacher/exams" },
            {
              icon: ClipboardList,
              label: "Question Bank",
              path: "/teacher/question-bank",
            },
            {
              icon: MonitorPlay,
              label: "Online Exams",
              path: "/teacher/online-exams",
            },
            { icon: FileText, label: "Enter Scores", path: "/teacher/scores" },
            {
              icon: FileText,
              label: "Report Cards",
              path: "/teacher/report-cards",
            },
            {
              icon: ClipboardCheck,
              label: "Weekly Attention",
              path: "/teacher/weekly-attention",
            },
            { icon: PenLine, label: "Signatures", path: "/teacher/signatures" },
          ],
        },
        { icon: ShoppingBag, label: "School shop", path: "/teacher/shop" },
        {
          type: "group",
          label: "Communication",
          icon: MessageSquare,
          items: [
            {
              icon: MessageSquare,
              label: "Messages",
              path: "/messages",
              showBadge: true,
            },
            {
              icon: BrainCircuit,
              label: "EduManage AI",
              path: "/ai-assistant",
            },
          ],
        },
        { icon: Settings, label: "Settings", path: "/settings" },
      ] as MenuItemDef[],
    },
    parent: {
      title: "Parent",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/parent" },
        {
          type: "group",
          label: "Academics",
          icon: BookOpen,
          items: [
            {
              icon: UserCircle,
              label: "My Children",
              path: "/parent/children",
            },
            {
              icon: ClipboardList,
              label: "Class Registers",
              path: "/parent/register",
            },
            { icon: Calendar, label: "Attendance", path: "/parent/attendance" },
            { icon: Award, label: "Grades", path: "/parent/grades" },
            { icon: FileText, label: "Report Cards", path: "/parent/reports" },
            {
              icon: MessageSquare,
              label: "Recommendations",
              path: "/parent/recommendations",
            },
            {
              icon: Trophy,
              label: "Achievements",
              path: "/parent/achievements",
            },
            {
              icon: BookMarked,
              label: "Programs",
              path: "/parent/programs",
            },
            { icon: Clock, label: "Timetable", path: "/parent/timetable" },
            {
              icon: Video,
              label: "Class Schedule",
              path: "/parent/class-schedule",
            },
          ],
        },
        {
          type: "group",
          label: "Finance",
          icon: DollarSign,
          items: [
            {
              icon: DollarSign,
              label: "School fees",
              path: "/parent/payments",
            },
            {
              icon: FileText,
              label: "Payment history",
              path: "/parent/payment-history",
            },
          ],
        },
        { icon: ShoppingBag, label: "School shop", path: "/parent/shop" },
        {
          type: "group",
          label: "Communication",
          icon: MessageSquare,
          items: [
            {
              icon: MessageSquare,
              label: "Messages",
              path: "/messages",
              showBadge: true,
            },
            {
              icon: BrainCircuit,
              label: "EduManage AI",
              path: "/ai-assistant",
            },
          ],
        },
        { icon: Settings, label: "Settings", path: "/settings" },
      ] as MenuItemDef[],
    },
    student: {
      title: "Student",
      menuItems: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/student" },
        {
          type: "group",
          label: "Academics",
          icon: BookOpen,
          items: [
            { icon: Clock, label: "Timetable", path: "/student/timetable" },
            {
              icon: Video,
              label: "Live Classes",
              path: "/student/live-classes",
            },
            {
              icon: ClipboardList,
              label: "Class Register",
              path: "/student/register",
            },
            {
              icon: FileText,
              label: "Assignments",
              path: "/student/assignments",
            },
            { icon: Award, label: "Grades", path: "/student/grades" },
            { icon: Award, label: "Performance", path: "/student/performance" },
            {
              icon: Trophy,
              label: "Achievements",
              path: "/student/achievements",
            },
            {
              icon: BookMarked,
              label: "Programs",
              path: "/student/programs",
            },
            { icon: BookOpen, label: "Resources", path: "/student/resources" },
          ],
        },
        {
          type: "group",
          label: "Examinations",
          icon: MonitorPlay,
          items: [
            {
              icon: GraduationCap,
              label: "Solve BECE & WASSCE Questions",
              path: "/student/waec-practice",
            },
            {
              icon: MonitorPlay,
              label: "Online Exams",
              path: "/student/online-exams",
            },
            {
              icon: FileText,
              label: "Report Card",
              path: "/student/report-card",
            },
          ],
        },
        {
          type: "group",
          label: "Finance",
          icon: DollarSign,
          items: [
            { icon: DollarSign, label: "My fees", path: "/student/billing" },
            {
              icon: FileText,
              label: "Payment history",
              path: "/student/payment-history",
            },
          ],
        },
        { icon: ShoppingBag, label: "School shop", path: "/student/shop" },
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [
            {
              icon: BrainCircuit,
              label: "EduManage AI",
              path: "/ai-assistant",
            },
            { icon: Settings, label: "Settings", path: "/settings" },
          ],
        },
      ] as MenuItemDef[],
    },
  };

  const shellTitles: Record<string, string> = {
    admin: "Admin",
    super_admin: "Admin",
    accountant: "Accountant",
    auditor: "Auditor",
  };

  // Map super_admin to admin config for shared admin shell
  const effectiveRole = role === "super_admin" ? "admin" : role;
  const baseConfig = roleConfig[effectiveRole] ?? roleConfig[role];
  const config = usesDynamicAdminNav
    ? { title: shellTitles[role] ?? "Portal", menuItems: [] as MenuItemDef[] }
    : baseConfig
      ? {
          ...baseConfig,
          menuItems: filterMenu(baseConfig.menuItems as MenuItemDef[]),
        }
      : undefined;

  const roleMeta = PORTAL_ROLE_META[role] ?? PORTAL_ROLE_META.admin;

  /** All roles share one nav shape (standalone links + grouped links) */
  const portalNavItems = useMemo(() => {
    if (usesDynamicAdminNav) {
      return ensureSystemBackupInNav(
        ensureClassTeacherActivityInNav(
          ensurePaymentGatewaysInNav(dynamicNavItems),
        ),
      );
    }
    const staticItems = config?.menuItems
      ? filterMenu(config.menuItems as MenuItemDef[])
      : [];
    return menuItemsToAdminNav(staticItems);
  }, [usesDynamicAdminNav, dynamicNavItems, config?.menuItems]);

  const filteredNavItems = useMemo(
    () => filterDynamicNav(portalNavItems, navQuery),
    [portalNavItems, navQuery],
  );

  const handleLogout = async () => {
    await signOut();
  };

  const accountEmail = user?.email ?? "";
  const [userEntityUrl, setUserEntityUrl] = useState<string>(
    role === "student"
      ? `/admin/students/${user?.id || ""}`
      : role === "teacher"
      ? `/admin/teachers/${user?.id || ""}`
      : role === "parent"
      ? `/parent`
      : `/admin/admins/${user?.id || ""}`,
  );
  const [userFullName, setUserFullName] = useState<string>("");

  useEffect(() => {
    let active = true;
    const resolveEntity = async () => {
      if (!user?.id) return;
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", user.id)
          .maybeSingle();

        if (prof?.full_name && active) {
          setUserFullName(prof.full_name);
        }

        const effectiveRole = role;

        if (effectiveRole === "student") {
          const { data: stu } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (stu?.id && active) {
            setUserEntityUrl(`/admin/students/${stu.id}`);
            return;
          }
          if (active) setUserEntityUrl(`/admin/students/${user.id}`);
        } else if (effectiveRole === "teacher") {
          const { data: tea } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (tea?.id && active) {
            setUserEntityUrl(`/admin/teachers/${tea.id}`);
            return;
          }
          if (active) setUserEntityUrl(`/admin/teachers/${user.id}`);
        } else if (effectiveRole === "parent") {
          if (active) setUserEntityUrl(`/parent`);
        } else {
          // Admin / super_admin / accountant / auditor / staff:
          // Check if teacher record exists or link to admin profile
          const { data: tea } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (tea?.id && active) {
            setUserEntityUrl(`/admin/teachers/${tea.id}`);
          } else if (active) {
            setUserEntityUrl(`/admin/admins/${user.id}`);
          }
        }
      } catch {
        if (active) {
          const fallback =
            role === "student"
              ? `/admin/students/${user?.id || ""}`
              : role === "teacher"
              ? `/admin/teachers/${user?.id || ""}`
              : role === "parent"
              ? `/parent`
              : `/admin/admins/${user?.id || ""}`;
          setUserEntityUrl(fallback);
        }
      }
    };

    void resolveEntity();
    return () => {
      active = false;
    };
  }, [user?.id, role]);

  const handleCopySchoolCode = async () => {
    const code = currentSchool?.school_code?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setSchoolCodeCopied(true);
      toast.success("School code copied");
      window.setTimeout(() => setSchoolCodeCopied(false), 2000);
    } catch {
      toast.error("Could not copy school code");
    }
  };


  // Guard against invalid or missing role
  if (!role || (usesDynamicAdminNav ? false : !config)) {
    return null;
  }

  const portalLabel = PORTAL_LABELS[role] ?? "School portal";
  const schoolInitial = (currentSchool?.school_name ?? "E")
    .substring(0, 1)
    .toUpperCase();
  const schoolName = currentSchool?.school_name ?? config?.title ?? "EduManage";
  const schoolLogoUrl = currentSchool?.logo_url;

  const navigateTo = () => {
    setMobileOpen(false);
    setSearchOpen(false);
  };

  const homePath = `/${role ?? "admin"}`;

  // Renders both logo variants like the demo: `default-logo` (wordmark) plus
  // `small-logo` which the Metronic CSS reveals when the sidebar collapses.
  const brandBlock = () => (
    <Link to={homePath} className="flex items-center gap-2.5" onClick={navigateTo}>
      {schoolLogoUrl ? (
        <>
          <span className="default-logo flex items-center gap-2.5 min-w-0">
            <img
              src={schoolLogoUrl}
              alt={schoolName}
              className="size-8 shrink-0 rounded-full object-cover border border-border/40"
            />
            <span className="text-base font-semibold leading-none text-foreground truncate max-w-[170px]">
              {schoolName}
            </span>
          </span>
          <img
            src={schoolLogoUrl}
            alt={schoolName}
            className="small-logo hidden size-8 shrink-0 rounded-full object-cover border border-border/40"
          />
        </>
      ) : (
        <>
          <span className="default-logo flex items-center gap-2.5 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {schoolInitial}
            </span>
            <span className="text-base font-semibold leading-none text-foreground truncate max-w-[170px]">
              {schoolName}
            </span>
          </span>
          <span className="small-logo hidden flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {schoolInitial}
          </span>
        </>
      )}
    </Link>
  );

  const sidebarMenu = (
    <MetronicSidebarMenu
      items={filteredNavItems}
      unreadMessages={unreadMessages}
      onNavigate={navigateTo}
    />
  );

  const headerIconBtn =
    "kt-btn kt-btn-ghost kt-btn-icon size-9 rounded-full hover:bg-primary/10 hover:[&_i]:text-primary";

  return (
    <div
      className={cn(
        "demo1 kt-sidebar-fixed kt-header-fixed relative flex h-screen w-full overflow-hidden bg-background text-base text-foreground antialiased",
        collapsed && "kt-sidebar-collapse",
        roleMeta.accentClass,
      )}
      data-portal-layout
      data-portal-role={role}
    >
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <div
        className={cn(
          // Width is driven by the Metronic CSS var (--sidebar-width) exactly
          // like the demo — no manual width utilities needed.
          "kt-sidebar dark fixed top-0 bottom-0 start-0 z-20 hidden lg:flex flex-col items-stretch shrink-0 bg-background border-e border-e-border transition-all duration-300",
        )}
        id="sidebar"
      >
        <div
          className="kt-sidebar-header hidden lg:flex items-center relative justify-between px-3 lg:px-6 shrink-0"
          id="sidebar_header"
        >
          {brandBlock()}
          {/* Toggle centered on the sidebar's right edge, aligned with the
              brand row — mirrors the demo / TASKER reference. Inline styles
              are used instead of the translate/rotate utilities because those
              classes exist in BOTH the school-hub Tailwind v3 build (transform
              property) and the Metronic v4 CSS (translate/rotate properties),
              which double-applies the shift. */}
          <div
            className="kt-btn kt-btn-outline kt-btn-icon rounded-lg absolute start-full top-1/2 cursor-pointer bg-white text-black hover:text-black/80 [&_i]:text-black hover:[&_i]:text-black/80"
            role="button"
            tabIndex={0}
            onClick={() => setCollapsed((c) => !c)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCollapsed((c) => !c);
              }
            }}
            aria-label="Toggle sidebar"
            style={{
              width: 30,
              height: 30,
              marginInlineStart: -15,
              marginTop: -15,
              /* The Metronic kt-btn-outline rules consume --background/--input,
                 which are bare HSL triplets here and resolve to a dark color in
                 dark mode, overriding the `bg-white`/`border-white` utilities.
                 Inline white bg + border keep the toggle crisply black-and-white
                 in both themes. */
              backgroundColor: "#ffffff",
              border: "1px solid #ffffff",
              boxShadow:
                "0 0 0 1px rgba(255, 255, 255, 0.14), 0 4px 12px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.3)",
            }}
          >
            <span
              className="inline-flex transition-transform duration-300"
              style={collapsed ? { transform: "rotate(180deg)" } : undefined}
            >
              <Ki name="black-left-line" />
            </span>
          </div>
        </div>
        <div
          className="kt-sidebar-content kt-sidebar-scroll flex flex-col grow overflow-y-auto overflow-x-hidden py-5 pe-2"
          id="sidebar_content"
        >
          <div className="grow flex flex-col ps-2 lg:ps-5 pe-1 lg:pe-3">
            <div className="flex w-full grow flex-col gap-3">
              {sidebarMenu}
            </div>
          </div>
        </div>
      </div>
      {/* End of Sidebar */}

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute top-0 bottom-0 start-0 flex w-[290px] max-w-[85vw] flex-col overflow-hidden bg-background border-e border-e-border">
            <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-b-border px-4">
              {brandBlock()}
              <button
                type="button"
                className="kt-btn kt-btn-icon kt-btn-ghost"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                style={{ boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)" }}
              >
                <Ki name="cross" className="text-lg" />
              </button>
            </div>
            <div className="kt-sidebar-scroll grow overflow-y-auto py-3">
              <div className="px-2 pt-1">{sidebarMenu}</div>
            </div>
            <div className="shrink-0 border-t border-t-border p-3">
              <div className="flex items-center justify-between gap-2.5 px-1.5 pb-2.5">
                <span className="flex items-center gap-2">
                  <Ki name="moon" className="text-base text-muted-foreground" />
                  <span className="font-medium text-2sm text-foreground">Dark Mode</span>
                </span>
                <input
                  className="kt-switch"
                  type="checkbox"
                  checked={isDark}
                  onChange={toggleTheme}
                  aria-label="Toggle dark mode"
                />
              </div>
              <button
                type="button"
                className="kt-btn kt-btn-outline justify-center w-full text-destructive"
                onClick={handleLogout}
              >
                <Ki name="exit-down" className="text-base" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* ── Wrapper ───────────────────────────────────────────────────── */}
      {/* Offsets are driven by the Metronic CSS vars (--sidebar-width /
          --header-height) via the root `kt-sidebar-fixed kt-header-fixed`
          classes, exactly like the demo. No manual ps/start utilities. */}
      <div
        ref={wrapperRef}
        className={cn(
          "kt-wrapper flex flex-col grow min-w-0 h-screen overflow-y-auto overflow-x-hidden transition-all duration-300",
        )}
      >
        {/* Header */}
        <header
          className={cn(
            "kt-header fixed top-0 z-10 start-0 end-0 flex items-stretch shrink-0 bg-background transition-all duration-300",
            headerScrolled && "border-b border-border",
          )}
          id="header"
        >
          <div
            className="kt-container-fixed flex justify-between items-stretch lg:gap-4"
            id="headerContainer"
          >
            {/* Mobile: logo + hamburger */}
            <div className="flex gap-2.5 lg:hidden items-center -ms-1">
              <button
                type="button"
                className="kt-btn kt-btn-icon kt-btn-ghost"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                style={{ boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)" }}
              >
                <Ki name="burger-menu-2" />
              </button>
              <span className="text-sm font-semibold text-foreground">{schoolName}</span>
            </div>

            {/* Search (desktop) */}
            <div className="hidden lg:flex items-center shrink-0">
              <button
                type="button"
                className={`group ${headerIconBtn}`}
                onClick={() => setSearchOpen(true)}
                aria-label="Search pages"
              >
                <Ki name="magnifier" className="text-lg group-hover:text-primary" />
              </button>
            </div>

            {/* Spacer between search and topbar right */}
            <div className="grow min-w-0" />

            {/* Topbar right */}
            <div className="flex items-center gap-1.5 lg:gap-2.5 shrink-0">
              {!hideSidebar ? (
                <>
                  {role === "parent" ? (
                    <div className="hidden md:block">
                      <ParentAdmissionNav variant="header" />
                    </div>
                  ) : null}
                  {isSuperAdmin ? (
                    <div className="hidden lg:block">
                      <SchoolSwitcher />
                    </div>
                  ) : null}
                </>
              ) : null}
              <SyncStatusIndicator />
              <NotificationCenter />
              {/* Theme dropdown */}
              <div className="relative shrink-0" ref={themeMenuRef}>
                <button
                  type="button"
                  className={headerIconBtn}
                  onClick={() => setThemeMenuOpen((o) => !o)}
                  aria-label="Theme settings"
                  aria-expanded={themeMenuOpen}
                >
                  {isDark ? (
                    <Ki name="sun" className="text-lg" />
                  ) : (
                    <Ki name="moon" className="text-lg" />
                  )}
                </button>
                {themeMenuOpen ? (
                  <div
                    className={cn(
                      "kt-dropdown-menu absolute end-0 top-full z-50 mt-2 w-[220px] rounded-xl border border-border bg-card shadow-xl overflow-hidden p-0",
                      themeMenuOpen && "open",
                    )}
                    data-kt-dropdown-menu="true"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                      <h3 className="font-semibold text-sm text-foreground">Theme</h3>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                      <button
                        type="button"
                        className={cn(
                          "w-full text-start px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors flex items-center justify-between text-sm",
                          !isDark && "bg-accent/40 font-semibold text-primary",
                        )}
                        onClick={() => {
                          if (isDark) toggleTheme();
                          setThemeMenuOpen(false);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <Ki name="sun" className="text-base" />
                          <span>Light Mode</span>
                        </span>
                        {!isDark && <Ki name="check" className="text-base text-primary" />}
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "w-full text-start px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors flex items-center justify-between text-sm",
                          isDark && "bg-accent/40 font-semibold text-primary",
                        )}
                        onClick={() => {
                          if (!isDark) toggleTheme();
                          setThemeMenuOpen(false);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <Ki name="moon" className="text-base" />
                          <span>Dark Mode</span>
                        </span>
                        {isDark && <Ki name="check" className="text-base text-primary" />}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* User dropdown */}
              <div className="relative shrink-0" ref={userMenuRef}>
                <button
                  type="button"
                  className="flex items-center gap-2 cursor-pointer group rounded-full py-1 px-1.5 hover:bg-muted/60 transition-colors"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label={`${userFullName || schoolName} account menu`}
                >
                  <span className="flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-muted text-sm font-semibold text-foreground group-hover:scale-105 transition-transform">
                    {schoolLogoUrl ? (
                      <img src={schoolLogoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      userFullName ? userFullName.charAt(0).toUpperCase() : schoolInitial
                    )}
                  </span>
                  <span className="hidden lg:inline-block text-xs font-semibold text-foreground group-hover:text-primary transition-colors max-w-[120px] truncate">
                    {userFullName || schoolName}
                  </span>
                  <ChevronDown
                    className="hidden lg:block h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform"
                    style={userMenuOpen ? { transform: "rotate(180deg)" } : undefined}
                    aria-hidden
                  />
                </button>
                {userMenuOpen ? (
                  <div
                    className={cn(
                      "kt-dropdown-menu absolute end-0 top-full z-50 mt-2 w-[280px] rounded-xl border border-border bg-card shadow-xl overflow-hidden p-0",
                      userMenuOpen && "open",
                    )}
                    data-kt-dropdown-menu="true"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                      <Link
                        to={userEntityUrl}
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigateTo();
                        }}
                        className="font-semibold text-sm text-foreground hover:text-primary hover:underline flex items-center gap-1.5 transition-colors"
                      >
                        <span>User Profile</span>
                        <Ki name="arrow-up-right" className="text-xs text-muted-foreground" />
                      </Link>
                      <Link
                        to={userEntityUrl}
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigateTo();
                        }}
                        className="kt-badge kt-badge-sm kt-badge-primary kt-badge-outline font-medium hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                        title="View profile entity page"
                      >
                        {roleMeta.label}
                      </Link>
                    </div>

                    <Link
                      to={userEntityUrl}
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigateTo();
                      }}
                      className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors group cursor-pointer"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-bold text-foreground group-hover:border-primary transition-colors">
                        {schoolLogoUrl ? (
                          <img src={schoolLogoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          userFullName ? userFullName.charAt(0).toUpperCase() : schoolInitial
                        )}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm text-foreground font-semibold group-hover:text-primary group-hover:underline transition-colors">
                          {userFullName || schoolName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                          {accountEmail || roleMeta.label}
                        </span>
                      </div>
                      <Ki name="right" className="ms-auto text-xs text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>

                    <div className="p-2 flex flex-col gap-0.5">
                      {currentSchool?.school_code && role !== "student" && role !== "parent" ? (
                        <button
                          type="button"
                          className="kt-dropdown-menu-link w-full text-start px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors flex items-center gap-2.5 text-sm"
                          onClick={handleCopySchoolCode}
                        >
                          <Ki name="information" className="text-base text-muted-foreground" />
                          <span>School code</span>
                          <span className="ms-auto flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
                            {currentSchool.school_code}
                            {schoolCodeCopied ? (
                              <Ki name="check" className="text-base text-primary" />
                            ) : (
                              <Ki name="copy" className="text-base text-muted-foreground" />
                            )}
                          </span>
                        </button>
                      ) : null}

                      <Link
                        className="kt-dropdown-menu-link w-full text-start px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors flex items-center gap-2.5 text-sm"
                        to="/settings"
                        onClick={navigateTo}
                      >
                        <Ki name="setting-2" className="text-base text-muted-foreground" />
                        <span>Account settings</span>
                      </Link>

                      <Link
                        className="kt-dropdown-menu-link w-full text-start px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors flex items-center gap-2.5 text-sm"
                        to="/messages"
                        onClick={navigateTo}
                      >
                        <Ki name="message-text" className="text-base text-muted-foreground" />
                        <span>Messages</span>
                        {unreadMessages > 0 ? (
                          <span className="ms-auto kt-badge kt-badge-sm kt-badge-danger kt-badge-outline font-semibold">
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </span>
                        ) : null}
                      </Link>
                    </div>

                    <div className="p-2 border-t border-border bg-card">
                      <button
                        type="button"
                        className="kt-dropdown-menu-link w-full text-start px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2.5 text-sm font-medium"
                        onClick={handleLogout}
                      >
                        <Ki name="exit-down" className="text-base text-destructive" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        {/* End of Header */}

        {/* Content — pt-5 matches the demo; the fixed header offset is
            handled by .kt-header-fixed .kt-wrapper { padding-top } */}
        <main className="grow pt-5" id="content">
          <div className="kt-container-fixed pb-16">
            {role === "admin" && subscriptionAccess?.can_use_platform ? (
              <SubscriptionExpiryBanner access={subscriptionAccess} />
            ) : null}
            {children}
          </div>
        </main>
        {/* End of Content */}

        {/* Footer */}
        <footer className="shrink-0 border-t border-t-border bg-background">
          <div className="kt-container-fixed">
            <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-3 py-5">
              <div className="flex order-2 md:order-1 gap-2 font-normal text-sm">
                <span className="text-secondary-foreground">
                  {new Date().getFullYear()}©
                </span>
                <span className="text-secondary-foreground">{schoolName}</span>
              </div>
              <div className="flex order-1 md:order-2 gap-4 font-normal text-sm text-secondary-foreground">
                <span className="text-muted-foreground">{portalLabel}</span>
              </div>
            </div>
          </div>
        </footer>
        {/* End of Footer */}
      </div>
      {/* End of Wrapper */}

      {/* ── Search modal ──────────────────────────────────────────────── */}
      {searchOpen ? (
        <div className="kt-modal open fixed inset-0 z-[60] flex items-start justify-center p-4" data-kt-modal="true">
          <div
            className="kt-modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setSearchOpen(false)}
            aria-hidden
          />
          <div className="kt-modal-content relative mx-auto w-full max-w-[600px] mt-[10vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card">
              <Ki name="magnifier" className="text-xl text-primary shrink-0" />
              <input
                autoFocus
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-medium"
                name="query"
                placeholder="Search pages, modules, settings…"
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
              />
              <button
                type="button"
                className="kt-btn kt-btn-sm kt-btn-icon kt-btn-dim shrink-0 rounded-lg hover:bg-accent"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                <Ki name="cross" className="text-sm" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-3">
              {filteredNavItems.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No pages match your search.
                </div>
              ) : (
                <div className="px-2 pt-1 pb-2">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Navigation & Pages
                  </div>
                  {sidebarMenu}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!hideSidebar ? <AiFloatingButton /> : null}
    </div>
  );
};

export default DashboardLayout;
