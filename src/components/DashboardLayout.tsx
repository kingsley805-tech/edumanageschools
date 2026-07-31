// @ts-nocheck
import {
  ReactNode,
  useState,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
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
} from "@/lib/rbac/adminNavConfig";
import { usePortalAccess } from "@/hooks/usePortalAccess";
import { ADMIN_SHELL_ROLES } from "@/lib/rbac/routeGuards";
import { toast } from "sonner";
import { ParentAdmissionNav } from "@/components/parent/ParentAdmissionNav";
import { PortalLiveFeedTicker } from "@/components/PortalLiveFeedTicker";
import SubscriptionExpiryBanner from "@/subscription/components/SubscriptionExpiryBanner";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import { useTheme } from "@/contexts/ThemeContext";
import { PORTAL_ROLE_META } from "@/lib/portalNavStyles";
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
  const role = (roleProp ?? userRole ?? undefined) as PortalRole | undefined;
  const { navItems: dynamicNavItems } = usePortalAccess();
  const { access: subscriptionAccess } = useOrganizationSubscription();
  const { toggleTheme, isDark } = useTheme();
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

  /** All roles share one nav shape (standalone links + grouped links) */
  const portalNavItems = useMemo(() => {
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

  const filteredNavItems = useMemo(
    () => filterDynamicNav(portalNavItems, navQuery),
    [portalNavItems, navQuery],
  );

  const handleLogout = async () => {
    await signOut();
  };

  const accountEmail = user?.email ?? "";

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const portalLabel = PORTAL_LABELS[role] ?? "School portal";
  const schoolInitial = (currentSchool?.school_name ?? "E")
    .substring(0, 1)
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative flex h-screen max-h-screen w-full flex-col overflow-hidden bg-background",
        roleMeta.accentClass,
      )}
      data-portal-layout
      data-portal-nav="top"
      data-portal-role={role}
    >
      {/* ── Single bar: brand · navigation · search · account ───────────── */}
      <header className="portal-topbar z-40 flex h-[56px] shrink-0 items-center gap-3 border-b border-border bg-background pl-3 pr-3 md:pl-4 md:pr-5">
        {!hideSidebar ? (
          <PortalMobileNav
            items={filteredNavItems}
            unreadMessages={unreadMessages}
            schoolName={currentSchool?.school_name}
            schoolLogoUrl={currentSchool?.logo_url}
            portalLabel={portalLabel}
            navQuery={navQuery}
            onNavQueryChange={setNavQuery}
            onSignOut={handleLogout}
          />
        ) : null}

        {/* Primary navigation — desktop only, fills the middle of the bar */}
        {!hideSidebar ? (
          <>
            <span className="portal-topbar-divider hidden lg:block" aria-hidden />
            <PortalTopNav
              items={filteredNavItems}
              unreadMessages={unreadMessages}
              className="hidden lg:block"
            />
          </>
        ) : (
          <div className="flex-1" />
        )}

        {/* Account controls */}
        <div className="topbar-right ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
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

          <button
            type="button"
            className="portal-icon-button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="portal-account-trigger"
                aria-label={`${currentSchool?.school_name ?? roleMeta.label} account menu`}
              >
                <span className="portal-account-avatar">
                  {currentSchool?.logo_url ? (
                    <img
                      src={currentSchool.logo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    schoolInitial
                  )}
                </span>
                <ChevronDown
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 opacity-60"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-72 border-border"
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 px-3 py-3">
                  <Avatar className="h-10 w-10 shrink-0 rounded-md border border-border">
                    <AvatarImage
                      src={currentSchool?.logo_url ?? undefined}
                      alt={currentSchool?.school_name ?? "School"}
                    />
                    <AvatarFallback className="rounded-md bg-foreground font-display text-sm font-bold text-background">
                      {schoolInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate font-display text-[13px] font-semibold text-foreground">
                      {currentSchool?.school_name ?? config?.title ?? "mingo"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {roleMeta.label}
                    </p>
                    {accountEmail ? (
                      <p className="truncate text-[11px] text-muted-foreground/80">
                        {accountEmail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </DropdownMenuLabel>

              {currentSchool?.school_code &&
              role !== "student" &&
              role !== "parent" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-[13px] focus:bg-muted"
                    onSelect={(event) => {
                      event.preventDefault();
                      handleCopySchoolCode();
                    }}
                  >
                    <Building className="mr-2 h-4 w-4 shrink-0" />
                    <span className="text-muted-foreground">School code</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="font-mono text-[12.5px] font-semibold text-foreground">
                        {currentSchool.school_code}
                      </span>
                      {schoolCodeCopied ? (
                        <Check className="h-3.5 w-3.5 text-foreground" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </span>
                  </DropdownMenuItem>
                </>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-[13px]">
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-[13px]">
                <Link to="/messages">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Messages
                  {unreadMessages > 0 ? (
                    <span className="ml-auto text-[11px] font-semibold text-destructive">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  ) : null}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-[13px]"
                onSelect={(event) => {
                  event.preventDefault();
                  toggleTheme();
                }}
              >
                {isDark ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {isDark ? "Light theme" : "Dark theme"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[13px] text-destructive focus:text-destructive"
                onSelect={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!hideSidebar ? <PortalLiveFeedTicker /> : null}

      {/* ── Page content — the only vertically scrolling region ─────────── */}
      <main
        className={cn(
          "portal-main-scroll relative z-10 min-h-0 flex-1 overflow-x-hidden bg-background",
          hideSidebar
            ? "overflow-hidden p-0"
            : "overflow-y-auto px-4 pb-10 pt-6 md:px-7 md:pt-[26px]",
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
  );
};

export default DashboardLayout;
