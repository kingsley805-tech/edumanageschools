// @ts-nocheck
import {
  ReactNode,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  DollarSign,
  LogOut,
  ArrowLeftToLine,
  ArrowRightFromLine,
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
  Palette,
  Video,
  BrainCircuit,
  Activity,
} from "lucide-react";
import { SidebarIconTooltip } from "@/components/SidebarIconTooltip";
import { NotificationCenter } from "./NotificationCenter";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { useTeacherAccountGuard } from "@/hooks/useTeacherAccountGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { SchoolSwitcher } from "./SchoolSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DynamicAdminSidebarNav } from "@/components/layout/DynamicAdminSidebarNav";
import {
  ensurePaymentGatewaysInNav,
  ensureClassTeacherActivityInNav,
} from "@/lib/rbac/adminNavConfig";
import { usePortalAccess } from "@/hooks/usePortalAccess";
import { ADMIN_SHELL_ROLES } from "@/lib/rbac/routeGuards";
import { toast } from "sonner";
import { ParentAdmissionNav } from "@/components/parent/ParentAdmissionNav";
import { PortalLiveFeedTicker } from "@/components/PortalLiveFeedTicker";
import SubscriptionExpiryBanner from "@/subscription/components/SubscriptionExpiryBanner";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import { PortalSidebarSearch } from "@/components/PortalSidebarSearch";
import { useTheme } from "@/contexts/ThemeContext";
import {
  PORTAL_ROLE_META,
  portalNavLinkActive,
  portalNavLinkBase,
  portalNavSubLinkBase,
} from "@/lib/portalNavStyles";
import { MINGO } from "@/lib/designTokens";
import type { AdminNavGroup, AdminNavItem } from "@/lib/rbac/adminNavConfig";
import { AiFloatingButton } from "@/ai-assistant/components/AiFloatingButton";

const SIDEBAR_WIDTH_KEY = "portal-sidebar-width";
const SIDEBAR_OPEN_KEY = "portal-sidebar-open";
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 252;
const SIDEBAR_COLLAPSED = 56;

function readSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(SIDEBAR_OPEN_KEY);
  if (saved !== null) return saved === "true";
  return window.innerWidth >= 1024;
}

function readSidebarWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT;
  const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  const n = saved ? parseInt(saved, 10) : SIDEBAR_DEFAULT;
  if (!Number.isFinite(n)) return SIDEBAR_DEFAULT;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

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
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [navQuery, setNavQuery] = useState("");
  const [schoolCodeCopied, setSchoolCodeCopied] = useState(false);
  const sidebarResizeRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);
  const unreadMessages = useUnreadMessages();
  const { currentSchool } = useSchoolInfo();
  const { role: userRole } = useUserRole();
  const { hasPermission, isSuperAdmin: isSuperAdminPerm } = usePermissions();
  const isSuperAdmin = userRole === "super_admin" || isSuperAdminPerm;
  // Fall back to the signed-in user's role when the prop is omitted.
  const role = (roleProp ?? userRole ?? undefined) as PortalRole | undefined;
  const { navItems: dynamicNavItems } = usePortalAccess();
  const { access: subscriptionAccess } = useOrganizationSubscription();
  const { resetPersonalTheme } = useTheme();
  useTeacherAccountGuard();
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

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      const next = !open;
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
      return next;
    });
  }, []);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      sidebarResizeRef.current = {
        startX: event.clientX,
        startWidth: sidebarWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth],
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!sidebarResizeRef.current) return;
      const delta = event.clientX - sidebarResizeRef.current.startX;
      const next = Math.min(
        SIDEBAR_MAX,
        Math.max(SIDEBAR_MIN, sidebarResizeRef.current.startWidth + delta),
      );
      setSidebarWidth(next);
    };

    const onUp = () => {
      if (!sidebarResizeRef.current) return;
      sidebarResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((width) => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
        return width;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

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
              label: "Reports",
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
              label: "School Settings",
              path: "/admin/school-settings",
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
                  {
                    icon: Shield,
                    label: "Super Admin",
                    path: "/admin/super-admin-management",
                  },
                  {
                    icon: BarChart3,
                    label: "Report Monitor",
                    path: "/super-admin/reports",
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
              label: "Reports",
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
          label: "Reports",
          icon: BarChart3,
          items: [
            {
              icon: BarChart3,
              label: "Financial Reports",
              path: "/admin/billing/reports",
              permission: PERMISSIONS.reports.viewFinancial,
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
            { icon: FileText, label: "Enter Scores", path: "/teacher/scores" },
            {
              icon: FileText,
              label: "Report Cards",
              path: "/teacher/report-cards",
            },
            { icon: PenLine, label: "Signatures", path: "/teacher/signatures" },
            { icon: BookOpen, label: "Resources", path: "/teacher/resources" },
            {
              icon: FileText,
              label: "Lesson notes",
              path: "/teacher/lesson-notes",
            },
          ],
        },
        {
          type: "group",
          label: "Examinations",
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
          ],
        },
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
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [{ icon: Settings, label: "Settings", path: "/settings" }],
        },
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
        {
          type: "group",
          label: "Account",
          icon: Settings,
          items: [{ icon: Settings, label: "Settings", path: "/settings" }],
        },
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
              icon: FileText,
              label: "Report Card",
              path: "/student/report-card",
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

  /** All roles use the admin sidebar format (sections + collapsible groups) */
  const sidebarNavItems = useMemo(() => {
    if (usesDynamicAdminNav) {
      return ensureClassTeacherActivityInNav(
        ensurePaymentGatewaysInNav(dynamicNavItems),
      );
    }
    const staticItems = config?.menuItems
      ? filterMenu(config.menuItems as MenuItemDef[])
      : [];
    return menuItemsToAdminNav(staticItems);
  }, [usesDynamicAdminNav, dynamicNavItems, config?.menuItems]);

  const filteredSidebarNav = useMemo(
    () => filterDynamicNav(sidebarNavItems, navQuery),
    [sidebarNavItems, navQuery],
  );

  const handleLogout = async () => {
    await signOut();
  };

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

  /** Sidebar nav — shared portal design tokens */
  const navLinkBase = portalNavLinkBase;
  const navLinkActive = portalNavLinkActive;
  const navSubLinkBase = portalNavSubLinkBase;

  // Guard against invalid or missing role
  if (!role || (usesDynamicAdminNav ? false : !config)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-screen max-h-screen w-full overflow-hidden bg-background",
        roleMeta.accentClass,
      )}
      data-portal-layout
      data-portal-role={role}
      data-sidebar-collapsed={sidebarOpen ? undefined : "true"}
      style={{ "--portal-sidebar-width": `${sidebarOpen ? sidebarWidth : SIDEBAR_COLLAPSED}px` }}
    >
      {/* Sidebar — expanded labels, or icon rail when collapsed */}
      {!hideSidebar && (
        <div
          className="relative h-full max-h-screen shrink-0 transition-[width] duration-300 ease-out"
          style={{ width: sidebarOpen ? sidebarWidth : SIDEBAR_COLLAPSED }}
        >
          <aside
            className="flex h-full max-h-screen w-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
            style={{ width: sidebarOpen ? sidebarWidth : SIDEBAR_COLLAPSED }}
            aria-label={sidebarOpen ? "Main navigation" : "Icon navigation"}
          >
            <div
              className="flex h-full min-h-0 flex-col"
              style={{ width: sidebarOpen ? sidebarWidth : SIDEBAR_COLLAPSED }}
            >
            {/* Brand + role */}
            <div className="portal-sidebar-brand flex flex-col gap-3 border-b border-sidebar-border px-5 py-[22px]">
              <div className="flex items-center gap-2.5">
                {currentSchool?.logo_url ? (
                  <Avatar className="h-7 w-7 shrink-0 rounded-none border border-sidebar-border">
                    <AvatarImage
                      src={currentSchool.logo_url}
                      alt={currentSchool.school_name}
                    />
                    <AvatarFallback className="rounded-none bg-white text-sidebar-background text-[13px] font-display font-bold">
                      {currentSchool.school_name.substring(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-white text-sidebar-background font-display text-[13px] font-bold">
                    {(currentSchool?.school_name ?? "E").substring(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="portal-sidebar-brand-text min-w-0 flex-1 leading-tight">
                  <p className="truncate font-display text-sm font-semibold text-white">
                    {currentSchool?.school_name ?? "mingo"}
                  </p>
                  <p className="text-[11px] text-sidebar-foreground/50">
                    {role === "admin" || role === "super_admin"
                      ? "School Admin portal"
                      : role === "teacher"
                        ? "Teacher portal"
                        : role === "parent"
                          ? "Parent portal"
                          : role === "student"
                            ? "Student portal"
                            : role === "accountant"
                              ? "Finance portal"
                              : role === "auditor"
                                ? "Auditor portal"
                                : "School portal"}
                  </p>
                </div>
              </div>
            </div>

            {sidebarOpen ? (
              <PortalSidebarSearch value={navQuery} onChange={setNavQuery} />
            ) : null}

            {/* Menu Items — admin format for every portal role */}
            <nav className="flex-1 space-y-0 overflow-y-auto overflow-x-hidden pb-2 pt-1 custom-scrollbar">
              <DynamicAdminSidebarNav
                items={filteredSidebarNav}
                unreadMessages={unreadMessages}
                navLinkBase={navLinkBase}
                navLinkActive={navLinkActive}
                navSubLinkBase={navSubLinkBase}
                collapsed={!sidebarOpen}
                emptyMessage={
                  navQuery.trim()
                    ? "No menu items match your search."
                    : "No modules assigned. Contact your administrator."
                }
              />
            </nav>

            {/* Sidebar footer — mingo sticky foot */}
            <div className="portal-sidebar-foot sticky bottom-0 mt-auto space-y-1 border-t border-sidebar-border bg-sidebar px-5 py-3.5">
              {role === "parent" && sidebarOpen ? (
                <ParentAdmissionNav variant="sidebar" />
              ) : null}
              <SidebarIconTooltip label="Sign out" collapsed={!sidebarOpen}>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="portal-sign-out flex w-full items-center gap-2.5 text-[13px] transition-opacity hover:opacity-90"
                  style={{ color: MINGO.signOut }}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="portal-nav-label">Sign out</span>
                </button>
              </SidebarIconTooltip>
            </div>
            </div>
          </aside>

          {/* Drag handle to resize sidebar (expanded only) */}
          {sidebarOpen ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              title="Drag to resize sidebar"
              onMouseDown={handleResizeStart}
              className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-sidebar-border active:bg-sidebar-border/80"
            />
          ) : null}
        </div>
      )}

      {/* Edge toggle — sits on the sidebar/content seam */}
      {!hideSidebar ? (
        <button
          type="button"
          className="portal-sidebar-toggle"
          style={{
            left: sidebarOpen ? sidebarWidth : SIDEBAR_COLLAPSED,
          }}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <ArrowLeftToLine aria-hidden strokeWidth={1.75} />
          ) : (
            <ArrowRightFromLine aria-hidden strokeWidth={1.75} />
          )}
        </button>
      ) : null}

      {/* Main content — only this column scrolls vertically */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Top Bar */}
        <header
          className={`z-30 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 md:px-7 ${hideSidebar ? "" : ""}`}
        >
          <div className="topbar-left flex min-w-0 flex-1 items-center gap-3.5">
            {!hideSidebar && (
              <>
                {role === "parent" && <ParentAdmissionNav variant="header" />}
                {currentSchool?.school_code &&
                  role !== "student" &&
                  role !== "parent" && (
                    <div className="flex h-8 items-center gap-1.5 border border-border px-3 text-xs text-muted-foreground">
                      <span className="hidden sm:inline">Code</span>
                      <span className="font-mono font-semibold text-foreground">
                        {currentSchool.school_code}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 rounded-none hover:bg-muted"
                        onClick={handleCopySchoolCode}
                        aria-label="Copy school code"
                        title="Copy school code"
                      >
                        {schoolCodeCopied ? (
                          <Check className="h-3.5 w-3.5 text-foreground" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  )}
                {isSuperAdmin ? (
                  <SchoolSwitcher />
                ) : currentSchool ? (
                  <div className="hidden min-w-0 flex-col sm:flex">
                    <div className="truncate font-display text-sm font-semibold text-foreground">
                      {currentSchool.school_name}
                    </div>
                    <div className="truncate text-[11px] text-[hsl(var(--ink-faint))]">
                      {roleMeta.label}
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="font-display text-sm font-semibold">
                      {config.title}
                    </div>
                    <div className="text-[11px] text-[hsl(var(--ink-faint))]">
                      {roleMeta.label}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="topbar-right ml-auto flex shrink-0 items-center gap-3 md:gap-4">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-none border-border bg-background px-3.5 text-[12.5px] font-medium"
              onClick={() => {
                resetPersonalTheme();
                toast.success("Default Auth/Landing theme applied");
              }}
              title="Reset to default Auth/Landing theme"
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Theme</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 rounded-none border border-border text-muted-foreground hover:bg-muted"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <NotificationCenter />
          </div>
        </header>

        {!hideSidebar ? <PortalLiveFeedTicker /> : null}

        {/* Page Content */}
        <main
          className={cn(
            "portal-main-scroll relative z-10 min-h-0 flex-1 overflow-x-hidden bg-background",
            hideSidebar
              ? "overflow-hidden p-0"
              : "overflow-y-auto px-7 pb-10 pt-[26px]",
          )}
        >
          {role === "admin" && subscriptionAccess?.can_use_platform ? (
            <SubscriptionExpiryBanner access={subscriptionAccess} />
          ) : null}
          <div
            className={cn(
              "mx-auto w-full min-w-0",
              hideSidebar ? "h-full max-w-none" : "max-w-none",
            )}
          >
            {children}
          </div>
          {!hideSidebar ? <AiFloatingButton /> : null}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
